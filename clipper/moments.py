"""Find the most clippable moments in a long stream, with what was said.

Signals, combined per second:
- audio spikes (yelling, laughing, explosions)
- chat velocity (YouTube chat replay, Twitch chat export)
- YouTube "Most replayed" heatmap, when the video has one
Then each top window is transcribed (faster-whisper) and scored for hype words and laughter,
so Claude Code (or you) can read the shortlist and pick the funniest, most viral ones.
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from . import highlights

HYPE = [
    "no way", "oh my god", "omg", "bro", "what", "wait", "holy", "yo", "dude", "let's go", "lets go",
    "wtf", "what the", "are you serious", "no no no", "run", "help", "stop", "why", "how", "insane",
    "crazy", "dead", "i'm dead", "oh no", "nah", "chat", "look at", "did you see",
]
LAUGH = re.compile(r"\b(ha){2,}|\bhaha\w*|\blol\b|\blmao\b|\blmfao\b|\bhehe\w*", re.I)


def heat_per_second(heatmap: list[dict] | None, length: int) -> np.ndarray | None:
    if not heatmap:
        return None
    out = np.zeros(length)
    for seg in heatmap:
        a, b = int(seg.get("start_time", 0)), int(seg.get("end_time", 0)) + 1
        out[max(0, a): min(length, b)] = max(out[max(0, a): min(length, b)].max(initial=0), seg.get("value", 0))
    return out if out.any() else None


def hype_score(text: str) -> tuple[float, list[str]]:
    t = f" {text.lower()} "
    found = [w for w in HYPE if f" {w}" in t]
    laughs = len(LAUGH.findall(text))
    exclaims = text.count("!") + text.count("?")
    caps = len(re.findall(r"\b[A-Z]{3,}\b", text))
    return len(found) * 0.6 + laughs * 1.2 + exclaims * 0.2 + caps * 0.3, found + (["laughing"] if laughs else [])


def _transcribe_window(audio: Path, start: float, end: float, model, language: str | None) -> list[tuple[float, float, str]]:
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "w.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.2f}", "-t", f"{end - start:.2f}",
                        "-i", str(audio), "-ac", "1", "-ar", "16000", str(wav)], check=True)
        segs, _ = model.transcribe(str(wav), word_timestamps=True, language=language, vad_filter=True)
        return [(round(start + w.start, 2), round(start + w.end, 2), w.word.strip())
                for s in segs for w in (s.words or [])]


def shortlist(audio: Path, n: int = 20, chat_file: Path | None = None, heatmap: list[dict] | None = None,
              clip: dict | None = None, model_name: str = "small", language: str | None = "en",
              transcribe: bool = True) -> list[dict]:
    clip = clip or {}
    db = highlights.loudness_per_second(audio)
    chat = None
    if chat_file:
        from . import chat as chatmod
        chat = chatmod.per_second(chatmod.offsets(chat_file), len(db))
    heat = heat_per_second(heatmap, len(db))
    pre, post = clip.get("pre", 20) + 10, clip.get("post", 10) + 10  # wider windows: Claude trims later
    cands = highlights.find_candidates(db, top=n, pre=pre, post=post, min_gap=clip.get("min_gap", 45),
                                       chat=chat, chat_weight=clip.get("chat_weight", 1.0), heat=heat)
    model = None
    if transcribe:
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel(model_name, compute_type="int8")
        except ImportError:
            print("faster-whisper not installed: shortlist without transcripts (pip install -e '.[captions]')")
    out = []
    for i, c in enumerate(cands, 1):
        item = {"id": i, "start": round(c.start, 1), "end": round(c.end, 1), "peak": round(c.peak, 1),
                "signal": round(c.score, 2), "text": "", "words": [], "hype": 0.0, "hype_words": []}
        if model:
            words = _transcribe_window(audio, c.start, c.end, model, language)
            text = " ".join(w[2] for w in words)
            h, found = hype_score(text)
            item.update(text=text, words=words, hype=round(h, 2), hype_words=found)
        item["score"] = round(item["signal"] + item["hype"] * 0.5, 2)
        out.append(item)
        print(f"  moment {i}/{len(cands)} at {c.peak / 60:.1f} min, score {item['score']}")
    return sorted(out, key=lambda x: -x["score"])


def save(items: list[dict], source: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"source": source, "moments": items}, indent=1, ensure_ascii=False))
    return path
