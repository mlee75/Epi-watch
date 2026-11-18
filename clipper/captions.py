"""Optional burned-in captions with faster-whisper (pip install -e '.[captions]')."""
from __future__ import annotations

from pathlib import Path


def _ts(t: float) -> str:
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int((s % 1) * 1000):03d}"


def to_srt(words: list[tuple[float, float, str]], per_line: int = 3) -> str:
    """Group words into short punchy lines, the usual shorts caption style."""
    lines, i = [], 0
    for n, k in enumerate(range(0, len(words), per_line), start=1):
        chunk = words[k : k + per_line]
        text = " ".join(w[2].strip() for w in chunk).upper()
        lines.append(f"{n}\n{_ts(chunk[0][0])} --> {_ts(chunk[-1][1])}\n{text}\n")
        i = n
    return "\n".join(lines) if i else ""


def transcribe(media: Path, out: Path, model: str = "small", language: str | None = "en") -> Path | None:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("Captions skipped: pip install -e '.[captions]' to enable.")
        return None
    m = WhisperModel(model, compute_type="int8")
    segments, _ = m.transcribe(str(media), word_timestamps=True, language=language)
    words = [(w.start, w.end, w.word) for s in segments for w in (s.words or [])]
    if not words:
        return None
    out.write_text(to_srt(words))
    return out
