"""Local, FREE speech-to-text for inbound WhatsApp voice notes (faster-whisper on CPU).

No paid API is involved — the model runs on this VPS. Used by the MG Brain relay so the
founder can SEND A VOICE NOTE instead of typing `cc <question>`. Lazy-loads the model on the
first voice note and keeps it warm. Handles Hinglish (auto language detect).
"""
import os
import io
import subprocess
import tempfile
import logging

logger = logging.getLogger(__name__)

_MODEL = None
_MODEL_NAME = os.environ.get("WA_WHISPER_MODEL", "small")  # base|small|medium — small handles Hinglish well


def available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except Exception:
        return False


def _get_model():
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel
        # int8 keeps RAM/CPU low; downloads once to ~/.cache/huggingface on first use.
        _MODEL = WhisperModel(_MODEL_NAME, device="cpu", compute_type="int8")
        logger.info(f"voice_transcribe: loaded whisper '{_MODEL_NAME}' (cpu/int8)")
    return _MODEL


def _to_wav(data: bytes) -> str:
    """Convert any WhatsApp audio (ogg/opus, m4a, …) to 16k mono wav via ffmpeg. Returns a temp path."""
    src = tempfile.NamedTemporaryFile(suffix=".in", delete=False)
    src.write(data)
    src.flush()
    src.close()
    out = src.name + ".wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", src.name, "-ar", "16000", "-ac", "1", out],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    try:
        os.unlink(src.name)
    except Exception:
        pass
    return out


def transcribe(data: bytes) -> str:
    """Transcribe audio bytes to text. Returns '' on any failure (caller falls back gracefully)."""
    if not data or not available():
        return ""
    wav = None
    try:
        wav = _to_wav(data)
        model = _get_model()
        segments, info = model.transcribe(wav, beam_size=1, vad_filter=True)
        text = " ".join(seg.text.strip() for seg in segments).strip()
        logger.info(f"voice_transcribe: lang={getattr(info,'language',None)} -> {text[:80]!r}")
        return text
    except Exception as e:
        logger.warning(f"voice_transcribe failed: {e}")
        return ""
    finally:
        if wav:
            try:
                os.unlink(wav)
            except Exception:
                pass
