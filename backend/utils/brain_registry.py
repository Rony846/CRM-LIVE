"""Brain registry — one place that maps a *persona* to the *model* that runs it.

The CRM is growing a fleet of AI "employees". Rather than hard-code a model id at
every call site, each agent declares which brain it wants and this module routes the
call to the right backend:

    Persona     Brain                       Backend         Cost      Role
    --------    ------------------------    -----------     ------    -----------------------------
    pratibha    qwen2.5:14b-instruct        Ollama (local)  free      front-line: basic/initial
                                                                      customer WhatsApp messages
    jasmine     qwen2.5:32b-instruct        Ollama (local)  free      the sharp workhorse: internal
                                                                      tasks + non-basic handling;
                                                                      powers the employee fleet
    kalpana     claude-opus-4-8             Anthropic API   paid      complex / high-stakes answers

Design constraints baked in (see the KVM-8 sizing work):
- 31 GB RAM can't hold 14B (9 GB) AND 32B (20 GB) resident at once. So Pratibha is kept
  WARM (long keep_alive) for instant customer latency, and Jasmine loads on demand and
  unloads quickly (keep_alive=0) to hand the RAM back. The ~11 s reload lands on internal
  async work, never on a waiting customer.
- All Jasmine "employees" share ONE 32B instance — requests serialize at ~5.7 tok/s
  aggregate. Fine for async/background work; they queue under burst load.

Everything is OFF by default: `available("pratibha"/"jasmine")` returns False until
LOCAL_BRAINS_ENABLED=1, so callers fall back to their current Claude path and nothing
repoints until you flip the flag.

This module is pure transport — no CRM/DB coupling. Kalpana reuses pratibha_brain's
Anthropic client so Opus usage stays in the one cost buffer; local usage is tracked
here (and costs ₹0).
"""
import os
import logging

import httpx

logger = logging.getLogger(__name__)


def _env(key, default):
    return (os.environ.get(key) or default).strip()


# --- persona -> brain config ------------------------------------------------ #
def brains() -> dict:
    """Built fresh from env each call so a .env edit + reload takes effect without code changes."""
    return {
        "pratibha": {
            "provider": "ollama",
            "model": _env("PRATIBHA_MODEL", "qwen2.5:14b-instruct"),
            # warm: stay resident so customer greetings are instant.
            "keep_alive": _env("PRATIBHA_KEEP_ALIVE", "30m"),
        },
        "jasmine": {
            "provider": "ollama",
            "model": _env("JASMINE_MODEL", "qwen2.5:32b-instruct"),
            # cold: unload right after each job so Pratibha keeps the RAM.
            "keep_alive": _env("JASMINE_KEEP_ALIVE", "0"),
        },
        "kalpana": {
            "provider": "anthropic",
            "model": _env("KALPANA_MODEL", "claude-opus-4-8"),
        },
        # Fast + cheaper Anthropic brain for latency-sensitive work (voice replies) — Sonnet 4.6.
        # Escalate to kalpana (Opus) only for genuinely hard turns.
        "riya": {
            "provider": "anthropic",
            "model": _env("RIYA_MODEL", "claude-sonnet-4-6"),
        },
        # Kimi K2 (Moonshot) — OpenAI-compatible API. Cheap + strong tool-use. A candidate "hard-turn"
        # / voice tier to A/B vs Sonnet on cost + Hindi + latency. Needs MOONSHOT_API_KEY.
        "kimi": {
            "provider": "openai",
            "model": _env("KIMI_MODEL", "kimi-k2-0711-preview"),
            "base_url": _env("KIMI_BASE_URL", "https://api.moonshot.ai/v1"),
            "api_key_env": "MOONSHOT_API_KEY",
        },
    }


def _cfg(brain: str) -> dict:
    b = brains().get(brain)
    if not b:
        raise ValueError(f"unknown brain {brain!r}; known: {list(brains())}")
    return b


def _local_enabled() -> bool:
    return _env("LOCAL_BRAINS_ENABLED", "0") in ("1", "true", "yes", "on")


def _ollama_base() -> str:
    return _env("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")


def available(brain: str) -> bool:
    """True if this brain can be called right now. Local brains require the master flag;
    Kalpana requires an Anthropic key. Callers use this to decide whether to fall back."""
    cfg = _cfg(brain)
    if cfg["provider"] == "anthropic":
        return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())
    if cfg["provider"] == "openai":
        return bool(os.environ.get(cfg.get("api_key_env", "MOONSHOT_API_KEY"), "").strip())
    return _local_enabled()


# --- local usage tracking (free, but counted for visibility) ---------------- #
_LOCAL_USAGE = []


def drain_local_usage():
    """Return and clear buffered local-model usage events (tokens; cost is ₹0)."""
    global _LOCAL_USAGE
    u, _LOCAL_USAGE = _LOCAL_USAGE, []
    return u


# --- the one call everyone uses --------------------------------------------- #
async def complete(brain: str, *, system: str = None, messages: list = None,
                   prompt: str = None, max_tokens: int = 1024,
                   temperature: float = None, tools: list = None,
                   timeout: float = 180.0) -> dict:
    """Run one completion on `brain`. Returns {"text", "model_ok", "tool_calls", "model"}.

    Provide either `prompt` (single user turn) or `messages` (Anthropic-style
    [{"role","content"}] list). `system` is the system prompt. On any error returns
    model_ok=False so the caller can fall back to another brain or hold for a human.

    `tools` are passed through where supported (Anthropic native; Ollama for qwen2.5).
    """
    cfg = _cfg(brain)
    msgs = messages if messages is not None else [{"role": "user", "content": prompt or ""}]
    if cfg["provider"] == "anthropic":
        return await _anthropic_complete(cfg, system, msgs, max_tokens, tools)
    if cfg["provider"] == "openai":
        return await _openai_complete(cfg, system, msgs, max_tokens, temperature, timeout)
    return await _ollama_complete(brain, cfg, system, msgs, max_tokens, temperature, tools, timeout)


async def _openai_complete(cfg, system, msgs, max_tokens, temperature, timeout):
    """OpenAI-compatible chat completions (Moonshot/Kimi, OpenRouter, etc.). Returns model_ok=False
    on any error (missing key, timeout, HTTP error) so the caller falls back to another brain."""
    import time as _time
    key = os.environ.get(cfg.get("api_key_env", "MOONSHOT_API_KEY"), "").strip()
    if not key:
        return {"text": "", "model_ok": False, "tool_calls": 0, "model": cfg["model"]}
    body = {
        "model": cfg["model"],
        "messages": ([{"role": "system", "content": system}] if system else []) + list(msgs),
        "max_tokens": max_tokens, "stream": False,
    }
    if temperature is not None:
        body["temperature"] = temperature
    t0 = _time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout) as hc:
            r = await hc.post(f"{cfg['base_url'].rstrip('/')}/chat/completions",
                              headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                              json=body)
            r.raise_for_status()
            data = r.json()
        text = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
        return {"text": text, "model_ok": bool(text), "tool_calls": 0, "model": cfg["model"],
                "latency_ms": int((_time.monotonic() - t0) * 1000), "raw": data}
    except Exception as e:
        logger.error(f"brain[{cfg['model']}] openai-compat call failed: {e}")
        return {"text": "", "model_ok": False, "tool_calls": 0, "model": cfg["model"]}


async def _anthropic_complete(cfg, system, msgs, max_tokens, tools):
    # Reuse pratibha_brain's wrapped client so Opus usage lands in the shared cost buffer.
    from utils import pratibha_brain as pb
    client = pb._client_or_none()
    if client is None:
        return {"text": "", "model_ok": False, "tool_calls": 0, "model": cfg["model"]}
    try:
        kw = dict(model=cfg["model"], max_tokens=max_tokens, messages=msgs)
        if system:
            kw["system"] = pb._sys(system)
        if tools:
            kw["tools"] = tools
        resp = await client.messages.create(**kw)
        calls = sum(1 for b in resp.content if getattr(b, "type", "") == "tool_use")
        return {"text": pb._text(resp), "model_ok": True, "tool_calls": calls,
                "model": cfg["model"], "raw": resp}
    except Exception as e:
        logger.error(f"brain[kalpana] call failed: {e}")
        return {"text": "", "model_ok": False, "tool_calls": 0, "model": cfg["model"]}


async def _ollama_complete(brain, cfg, system, msgs, max_tokens, temperature, tools, timeout):
    if not _local_enabled():
        return {"text": "", "model_ok": False, "tool_calls": 0, "model": cfg["model"]}
    payload = {
        "model": cfg["model"],
        "messages": ([{"role": "system", "content": system}] if system else []) + msgs,
        "stream": False,
        "keep_alive": cfg["keep_alive"],
        "options": {"num_predict": max_tokens},
    }
    if temperature is not None:
        payload["options"]["temperature"] = temperature
    if tools:
        payload["tools"] = tools  # qwen2.5 supports function calling via Ollama
    try:
        async with httpx.AsyncClient(timeout=timeout) as hc:
            r = await hc.post(f"{_ollama_base()}/api/chat", json=payload)
            r.raise_for_status()
            data = r.json()
        msg = data.get("message", {}) or {}
        tcalls = msg.get("tool_calls") or []
        _LOCAL_USAGE.append({"brain": brain, "model": cfg["model"],
                             "in": data.get("prompt_eval_count", 0) or 0,
                             "out": data.get("eval_count", 0) or 0})
        return {"text": (msg.get("content") or "").strip(), "model_ok": True,
                "tool_calls": len(tcalls), "model": cfg["model"], "raw": data}
    except Exception as e:
        logger.error(f"brain[{brain}] local call failed: {e}")
        return {"text": "", "model_ok": False, "tool_calls": 0, "model": cfg["model"]}


# --- ops helpers ------------------------------------------------------------ #
async def warm(brain: str = "pratibha") -> bool:
    """Preload a local model so the first real call is instant. Call at startup for Pratibha."""
    cfg = _cfg(brain)
    if cfg["provider"] != "ollama" or not _local_enabled():
        return False
    try:
        async with httpx.AsyncClient(timeout=120.0) as hc:
            r = await hc.post(f"{_ollama_base()}/api/chat",
                              json={"model": cfg["model"], "messages": [],
                                    "keep_alive": cfg["keep_alive"]})
            r.raise_for_status()
        logger.info(f"brain[{brain}] warmed ({cfg['model']})")
        return True
    except Exception as e:
        logger.error(f"brain[{brain}] warm failed: {e}")
        return False


async def health() -> dict:
    """Quick status: flag, reachability, and which local models are currently resident."""
    out = {"local_enabled": _local_enabled(), "ollama_url": _ollama_base(),
           "reachable": False, "loaded": [], "brains": {k: v.get("model") for k, v in brains().items()}}
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            r = await hc.get(f"{_ollama_base()}/api/ps")
            r.raise_for_status()
            out["reachable"] = True
            out["loaded"] = [m.get("name") for m in r.json().get("models", [])]
    except Exception as e:
        out["error"] = str(e)
    return out
