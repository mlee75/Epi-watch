"""Chat-velocity signal: moments where chat explodes are moments worth clipping.

Reads two chat replay formats:
- YouTube live chat replay (yt-dlp `live_chat` subtitle, JSON lines)
- Twitch chat export from TwitchDownloaderCLI (`chatdownload --id <vod> -o chat.json`)
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .config import DATA


def offsets(path: Path) -> list[float]:
    """Message timestamps in seconds from the start of the VOD."""
    text = path.read_text(encoding="utf-8", errors="ignore").strip()
    if not text:
        return []
    if text.startswith("{") and '"comments"' in text[:2000]:
        data = json.loads(text)
        return [float(c["content_offset_seconds"]) for c in data.get("comments", [])
                if "content_offset_seconds" in c]
    out: list[float] = []
    for line in text.splitlines():
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        ms = (item.get("replayChatItemAction") or {}).get("videoOffsetTimeMsec")
        if ms is not None:
            out.append(int(ms) / 1000)
    return out


def per_second(times: list[float], length: int) -> np.ndarray:
    counts = np.zeros(max(length, 1))
    for t in times:
        i = int(t)
        if 0 <= i < len(counts):
            counts[i] += 1
    return counts


def fetch_youtube(url: str) -> Path | None:
    """Download the live chat replay of a YouTube VOD with yt-dlp."""
    from .sources import _ydl

    out_dir = DATA / "chat"
    out_dir.mkdir(parents=True, exist_ok=True)
    opts = {
        "skip_download": True, "writesubtitles": True, "subtitleslangs": ["live_chat"],
        "outtmpl": str(out_dir / "%(id)s.%(ext)s"),
    }
    with _ydl(opts) as y:
        info = y.extract_info(url, download=True)
    p = out_dir / f"{info['id']}.live_chat.json"
    return p if p.exists() else None
