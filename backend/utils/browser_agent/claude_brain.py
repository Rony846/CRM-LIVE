"""
Claude-driven browser navigator.

When the deterministic scrapers in this package fail (selectors moved,
Amazon redesigned the page, unfamiliar UI), this module hands the live
Playwright page over to Claude Opus 4.7 and lets the model decide what
to click, what to type, and when the goal has been met. The browser is
still ours — Claude only emits structured tool calls; the dispatcher
below executes each one against `self.page` and feeds the result back.
We never `exec` JS that Claude wrote, only JS we wrote that Claude
parameterizes.

Costs are bounded by hard turn / tool-call caps. The system prompt is
cached so repeated scrape attempts within a 5-minute window only pay
for the diff.
"""

import asyncio
import base64
import json
import logging
import os
from typing import Any, Dict, List, Optional

import anthropic

logger = logging.getLogger(__name__)

MODEL = "claude-opus-4-7"
MAX_TURNS = 18
MAX_TOTAL_TOOL_CALLS = 40
SCREENSHOT_QUALITY = 60

TOOLS: List[Dict[str, Any]] = [
    {
        "name": "screenshot",
        "description": (
            "Take a fresh screenshot of the current page and return it. "
            "Use after every click / navigation / form fill to verify the result "
            "before deciding the next action."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "click_by_text",
        "description": (
            "Click the first visible element whose text contains the given "
            "pattern (case-insensitive). Use for menus, links, buttons. "
            "Prefer this over CSS selectors — Amazon's class names churn."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Visible text to match (substring)"},
                "tag_hint": {
                    "type": "string",
                    "enum": ["a", "button", "any"],
                    "description": "Restrict to anchor / button, or any clickable. Default 'any'.",
                },
            },
            "required": ["text"],
        },
    },
    {
        "name": "click_by_selector",
        "description": "Click the first element matching a CSS selector. Use only if click_by_text fails.",
        "input_schema": {
            "type": "object",
            "properties": {"selector": {"type": "string"}},
            "required": ["selector"],
        },
    },
    {
        "name": "fill_input",
        "description": (
            "Fill the first input whose nearby label / placeholder / aria-label "
            "matches the given pattern. Fires input + change events so React "
            "controlled inputs update."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "label_pattern": {"type": "string"},
                "value": {"type": "string"},
            },
            "required": ["label_pattern", "value"],
        },
    },
    {
        "name": "wait",
        "description": "Sleep N seconds for the page to render or settle.",
        "input_schema": {
            "type": "object",
            "properties": {"seconds": {"type": "number", "minimum": 1, "maximum": 15}},
            "required": ["seconds"],
        },
    },
    {
        "name": "page_summary",
        "description": (
            "Return a compact JSON summary of interactive elements on the page: "
            "links, buttons, inputs, and any visible <table> structure. Use when "
            "the screenshot alone is ambiguous (e.g. dense menus, modals)."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "navigate",
        "description": "Hard-navigate the page to a URL. Use sparingly — prefer in-page clicks.",
        "input_schema": {
            "type": "object",
            "properties": {"url": {"type": "string"}},
            "required": ["url"],
        },
    },
    {
        "name": "extract_table_rows",
        "description": (
            "Walk every <table>/[role='grid'] on the page, find the one whose "
            "header row contains the given keywords, and return up to 200 rows "
            "as objects keyed by the header cell text."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "header_keywords": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Lowercase words expected in the right table's header (e.g. ['reimbursement', 'amount']).",
                },
            },
            "required": ["header_keywords"],
        },
    },
    {
        "name": "done",
        "description": (
            "Terminal. Call when the goal is met (or you've decided it's "
            "unreachable). The return payload is what the caller receives."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["ok", "page_changed", "session_expired", "error"],
                },
                "rows": {"type": "array", "items": {"type": "object"}},
                "notes": {"type": "string"},
            },
            "required": ["status"],
        },
    },
]

SYSTEM_PROMPT = """You are driving a real Playwright-controlled browser that is signed in to Amazon Seller Central (India marketplace). Your job: navigate the site to reach a specific report and return structured row data.

Constraints:
- The browser is REAL. Every click affects a live Amazon session. Be deliberate.
- Prefer click_by_text over CSS selectors. Amazon's class names change weekly; visible text is stable.
- After every click / navigation / fill, call screenshot (or page_summary when the screenshot is ambiguous) to confirm what happened before the next action.
- Date ranges usually live behind a "Last 30 days" dropdown that exposes Custom / Start / End fields when opened.
- If the page redirects to a sign-in form or shows a CAPTCHA / OTP, call done with status="session_expired".
- If after ~5 attempts the report can't be reached, call done with status="page_changed" and explain in notes.
- Budget: 3-6 turns is typical, 10+ is a lot. Don't waste turns describing what you see — act.
- When you reach the report and the table is visible, call extract_table_rows once, then done with status="ok" and the rows."""


class ClaudeBrowserBrain:
    """One brain instance per scrape attempt. Not thread-safe; not reusable across goals."""

    def __init__(self, page, notify_status=None):
        self.page = page
        self.notify_status = notify_status
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set — Claude brain unavailable")
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.tool_call_count = 0
        self.input_tokens = 0
        self.output_tokens = 0
        self.cache_read_tokens = 0
        self.actions_log: List[str] = []

    async def run(self, goal: str, hint: str = "") -> Dict[str, Any]:
        """Drive the browser toward `goal`. Returns:
            {"status": "ok"|"page_changed"|"session_expired"|"error",
             "rows": [...],
             "notes": "...",
             "turns": int,
             "tokens": {"input": int, "output": int, "cache_read": int},
             "actions": [str, ...]}
        """
        await self._notify(f"Claude brain engaging: {goal[:80]}")

        initial_shot = await self._screenshot_b64()
        messages: List[Dict[str, Any]] = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": initial_shot,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            f"GOAL: {goal}\n\n"
                            f"HINT: {hint or '(none)'}\n\n"
                            f"CURRENT URL: {self.page.url}\n\n"
                            "Drive the browser to the goal. Take one or two actions per turn, "
                            "screenshot to verify, then continue. Call done when finished."
                        ),
                    },
                ],
            }
        ]

        for turn in range(MAX_TURNS):
            try:
                response = await self.client.messages.create(
                    model=MODEL,
                    max_tokens=4096,
                    thinking={"type": "adaptive"},
                    output_config={"effort": "medium"},
                    system=[
                        {
                            "type": "text",
                            "text": SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    tools=TOOLS,
                    messages=messages,
                )
            except anthropic.APIError as e:
                logger.exception(f"[claude-brain] API error on turn {turn}")
                return self._finish("error", [], f"Claude API error: {e}", turn)

            usage = getattr(response, "usage", None)
            if usage:
                self.input_tokens += getattr(usage, "input_tokens", 0) or 0
                self.output_tokens += getattr(usage, "output_tokens", 0) or 0
                self.cache_read_tokens += getattr(usage, "cache_read_input_tokens", 0) or 0

            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                final_text = next(
                    (b.text for b in response.content if b.type == "text"), ""
                )
                return self._finish(
                    "error", [],
                    f"Claude ended turn without calling done. Last text: {final_text[:300]}",
                    turn,
                )

            if response.stop_reason not in ("tool_use", "pause_turn"):
                return self._finish(
                    "error", [], f"Unexpected stop_reason: {response.stop_reason}", turn
                )

            tool_results: List[Dict[str, Any]] = []
            terminal_payload: Optional[Dict[str, Any]] = None

            for block in response.content:
                if block.type != "tool_use":
                    continue
                self.tool_call_count += 1
                if self.tool_call_count > MAX_TOTAL_TOOL_CALLS:
                    return self._finish(
                        "error", [], "Tool call budget exhausted", turn
                    )

                if block.name == "done":
                    terminal_payload = block.input or {}
                    break

                self.actions_log.append(f"{block.name}({self._brief(block.input)})")
                try:
                    result = await self._dispatch(block.name, block.input or {})
                    tool_results.append(self._tool_result_block(block.id, result))
                except Exception as e:
                    logger.exception(f"[claude-brain] tool {block.name} crashed")
                    tool_results.append(
                        self._tool_result_block(block.id, {"error": str(e)[:300]}, is_error=True)
                    )

            if terminal_payload is not None:
                return self._finish(
                    terminal_payload.get("status", "ok"),
                    terminal_payload.get("rows", []) or [],
                    terminal_payload.get("notes", ""),
                    turn,
                )

            if not tool_results:
                return self._finish(
                    "error", [],
                    "tool_use stop_reason but no tool_use blocks found",
                    turn,
                )

            messages.append({"role": "user", "content": tool_results})

        return self._finish("error", [], f"Exhausted {MAX_TURNS} turns", MAX_TURNS)

    # ------- result wrapper --------------------------------------------------

    def _finish(self, status: str, rows: List[Dict], notes: str, turns: int) -> Dict[str, Any]:
        return {
            "status": status,
            "rows": rows,
            "notes": notes,
            "turns": turns + 1,
            "tokens": {
                "input": self.input_tokens,
                "output": self.output_tokens,
                "cache_read": self.cache_read_tokens,
            },
            "actions": self.actions_log,
        }

    def _tool_result_block(self, tool_use_id: str, result: Any, is_error: bool = False) -> Dict[str, Any]:
        # Screenshots come back as a dict marked _kind=screenshot so we can
        # convert them into a real image block; everything else is JSON text.
        if isinstance(result, dict) and result.get("_kind") == "screenshot":
            content = [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": result["image_b64"],
                    },
                },
                {"type": "text", "text": f"After action — URL: {result.get('url', '?')}"},
            ]
        else:
            try:
                content = json.dumps(result, default=str)[:8000]
            except Exception:
                content = str(result)[:8000]
        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": content,
            "is_error": is_error,
        }

    @staticmethod
    def _brief(args: Optional[Dict[str, Any]]) -> str:
        if not args:
            return ""
        bits = []
        for k, v in args.items():
            s = str(v)
            if len(s) > 40:
                s = s[:37] + "…"
            bits.append(f"{k}={s}")
        return ", ".join(bits)

    async def _notify(self, msg: str):
        if self.notify_status:
            try:
                await self.notify_status(msg)
            except Exception:
                pass

    # ------- tool dispatch ---------------------------------------------------

    async def _dispatch(self, name: str, args: Dict[str, Any]) -> Any:
        if name == "screenshot":
            return {
                "_kind": "screenshot",
                "image_b64": await self._screenshot_b64(),
                "url": self.page.url,
            }
        if name == "click_by_text":
            return await self._click_by_text(args["text"], args.get("tag_hint", "any"))
        if name == "click_by_selector":
            return await self._click_by_selector(args["selector"])
        if name == "fill_input":
            return await self._fill_input(args["label_pattern"], args["value"])
        if name == "wait":
            sec = min(15, max(1, float(args["seconds"])))
            await asyncio.sleep(sec)
            return {"slept": sec, "url": self.page.url}
        if name == "page_summary":
            return await self._page_summary()
        if name == "navigate":
            try:
                await self.page.goto(args["url"], wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(3)
                return {"navigated": True, "url": self.page.url}
            except Exception as e:
                return {"navigated": False, "error": str(e)[:200], "url": self.page.url}
        if name == "extract_table_rows":
            return await self._extract_table_rows(args["header_keywords"])
        raise ValueError(f"Unknown tool: {name}")

    # ------- executors -------------------------------------------------------

    async def _screenshot_b64(self) -> str:
        raw = await self.page.screenshot(type="jpeg", quality=SCREENSHOT_QUALITY, full_page=False)
        return base64.b64encode(raw).decode("ascii")

    async def _click_by_text(self, text: str, tag_hint: str) -> Dict[str, Any]:
        safe_text = json.dumps(text)
        if tag_hint == "a":
            selector_set = "'a'"
        elif tag_hint == "button":
            selector_set = "'button, [role=\"button\"]'"
        else:
            selector_set = (
                "'a, button, [role=\"link\"], [role=\"button\"], [role=\"menuitem\"], "
                "[role=\"tab\"], [role=\"option\"], li[tabindex], summary'"
            )
        result = await self.page.evaluate(
            f"""
            () => {{
              const needle = ({safe_text}).toLowerCase();
              const els = Array.from(document.querySelectorAll({selector_set}));
              let best = null;
              let bestScore = Infinity;
              for (const el of els) {{
                if (el.offsetParent === null && el.tagName !== 'OPTION') continue;
                const t = ((el.innerText || el.textContent) || '').trim().toLowerCase();
                if (!t || !t.includes(needle)) continue;
                // Prefer the most exact match (shortest text containing the needle)
                const score = t.length;
                if (score < bestScore) {{ best = el; bestScore = score; }}
              }}
              if (!best) return {{ clicked: false }};
              best.scrollIntoView({{ block: 'center', behavior: 'instant' }});
              best.click();
              return {{
                clicked: true,
                matched_text: (best.innerText || '').trim().slice(0, 120),
                tag: best.tagName.toLowerCase(),
              }};
            }}
            """
        )
        if result.get("clicked"):
            await asyncio.sleep(2)  # let navigation / React state settle
        result["url"] = self.page.url
        return result

    async def _click_by_selector(self, selector: str) -> Dict[str, Any]:
        try:
            handle = await self.page.query_selector(selector)
            if not handle:
                return {"clicked": False, "reason": "no element matched", "url": self.page.url}
            await handle.scroll_into_view_if_needed()
            await handle.click()
            await asyncio.sleep(2)
            return {"clicked": True, "url": self.page.url}
        except Exception as e:
            return {"clicked": False, "error": str(e)[:200], "url": self.page.url}

    async def _fill_input(self, label_pattern: str, value: str) -> Dict[str, Any]:
        safe_pat = json.dumps(label_pattern.lower())
        safe_val = json.dumps(value)
        return await self.page.evaluate(
            f"""
            () => {{
              const pat = {safe_pat};
              const val = {safe_val};
              const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
              const labelOf = (el) => {{
                const id = el.id;
                const lbl = id ? document.querySelector(`label[for="${{id}}"]`) : null;
                return ((lbl && lbl.innerText) || el.placeholder || el.getAttribute('aria-label') || el.name || '').toLowerCase();
              }};
              for (const inp of inputs) {{
                if (!labelOf(inp).includes(pat)) continue;
                inp.scrollIntoView({{ block: 'center' }});
                inp.focus();
                if (inp.tagName === 'SELECT') {{
                  const opt = Array.from(inp.options).find(o => (o.text || '').toLowerCase().includes(val.toLowerCase()));
                  if (opt) inp.value = opt.value;
                }} else {{
                  inp.value = val;
                }}
                inp.dispatchEvent(new Event('input', {{ bubbles: true }}));
                inp.dispatchEvent(new Event('change', {{ bubbles: true }}));
                inp.blur();
                return {{ filled: true, matched_label: labelOf(inp).slice(0, 100), tag: inp.tagName.toLowerCase() }};
              }}
              return {{ filled: false }};
            }}
            """
        )

    async def _page_summary(self) -> Dict[str, Any]:
        return await self.page.evaluate(
            r"""
            () => {
              const trim = (s, n) => (s || '').trim().replace(/\s+/g, ' ').slice(0, n);
              const visible = (el) => el.offsetParent !== null;
              const links = Array.from(document.querySelectorAll('a, [role="link"], [role="menuitem"]'))
                .filter(visible)
                .map(a => trim(a.innerText || a.textContent, 80))
                .filter(t => t)
                .slice(0, 80);
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
                .filter(visible)
                .map(b => trim(b.innerText || b.value, 60))
                .filter(t => t)
                .slice(0, 40);
              const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
                .filter(visible)
                .map(i => {
                  const id = i.id;
                  const lbl = id ? document.querySelector(`label[for="${id}"]`) : null;
                  return {
                    type: i.type || i.tagName.toLowerCase(),
                    label: trim((lbl && lbl.innerText) || i.placeholder || i.getAttribute('aria-label') || i.name, 60),
                  };
                })
                .filter(i => i.label)
                .slice(0, 30);
              const tables = Array.from(document.querySelectorAll('table, [role="grid"]'))
                .filter(visible)
                .slice(0, 4)
                .map(t => {
                  const headerCells = Array.from(t.querySelectorAll('th, [role="columnheader"]')).slice(0, 12);
                  return {
                    headers: headerCells.map(c => trim(c.innerText, 40)),
                    row_count: t.querySelectorAll('tr, [role="row"]').length,
                  };
                });
              return {
                url: location.href,
                title: trim(document.title, 100),
                links, buttons, inputs, tables,
              };
            }
            """
        )

    async def _extract_table_rows(self, header_keywords: List[str]) -> Dict[str, Any]:
        kw_json = json.dumps([k.lower() for k in header_keywords])
        return await self.page.evaluate(
            f"""
            () => {{
              const kws = {kw_json};
              const trim = (s) => (s || '').trim().replace(/\\s+/g, ' ');
              const tables = Array.from(document.querySelectorAll('table, [role="grid"], .kat-table, .a-table'));
              for (const tbl of tables) {{
                const rows = Array.from(tbl.querySelectorAll('tr, [role="row"]'));
                if (rows.length < 2) continue;
                const headerCells = Array.from(rows[0].querySelectorAll('th, [role="columnheader"], td'))
                  .map(c => trim(c.innerText).toLowerCase());
                if (!headerCells.length) continue;
                const matches = kws.filter(k => headerCells.some(h => h.includes(k))).length;
                if (matches < Math.min(2, kws.length)) continue;
                const headers = headerCells.map(h => h || `col_${{headerCells.indexOf(h)}}`);
                const out = [];
                for (let i = 1; i < Math.min(rows.length, 201); i++) {{
                  const cells = Array.from(rows[i].querySelectorAll('td, [role="cell"]'))
                    .map(c => trim(c.innerText));
                  if (!cells.length) continue;
                  const row = {{}};
                  headers.forEach((h, idx) => {{ row[h] = cells[idx] || ''; }});
                  out.push(row);
                }}
                return {{ found: true, header_row: headers, rows: out, row_count: out.length }};
              }}
              return {{ found: false, reason: 'No table matched header keywords' }};
            }}
            """
        )
