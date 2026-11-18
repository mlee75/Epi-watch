"""Fetch VOD lists, audio and segments with yt-dlp (YouTube, Twitch, Kick)."""
from __future__ import annotations

from pathlib import Path

from .config import DATA


def _ydl(opts: dict):
    try:
        import yt_dlp
    except ImportError as e:  # pragma: no cover
        raise SystemExit("yt-dlp missing: pip install -e .") from e
    base = {"quiet": True, "no_warnings": True}
    return yt_dlp.YoutubeDL({**base, **opts})


def recent(url: str, n: int = 5) -> list[dict]:
    """Latest entries of a channel/videos page: id, title, url, duration."""
    with _ydl({"extract_flat": True, "playlistend": n}) as y:
        info = y.extract_info(url, download=False)
    entries = info.get("entries") or [info]
    return [
        {
            "id": e.get("id"),
            "title": e.get("title"),
            "url": e.get("url") or e.get("webpage_url"),
            "duration": e.get("duration"),
            "live": e.get("live_status"),
        }
        for e in entries[:n]
    ]


def audio(url: str) -> Path:
    """Download audio only. Cheap way to scan a 6-hour VOD for highlights."""
    out_dir = DATA / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)
    opts = {"format": "bestaudio/best", "outtmpl": str(out_dir / "%(id)s.%(ext)s")}
    with _ydl(opts) as y:
        info = y.extract_info(url, download=True)
        return Path(y.prepare_filename(info))


def segment(url: str, start: float, end: float) -> Path:
    """Download only [start, end] of the video, up to 1080p."""
    from yt_dlp.utils import download_range_func

    out_dir = DATA / "segments"
    out_dir.mkdir(parents=True, exist_ok=True)
    tag = f"{int(start)}-{int(end)}"
    opts = {
        "format": "bv*[height<=1080]+ba/b[height<=1080]/b",
        "outtmpl": str(out_dir / f"%(id)s_{tag}.%(ext)s"),
        "download_ranges": download_range_func(None, [(start, end)]),
        "force_keyframes_at_cuts": True,
        "merge_output_format": "mp4",
    }
    with _ydl(opts) as y:
        info = y.extract_info(url, download=True)
        p = Path(y.prepare_filename(info))
        return p.with_suffix(".mp4") if not p.exists() else p


def view_count(post_url: str) -> int | None:
    """Public view count of a posted clip (works for YouTube, usually TikTok)."""
    try:
        with _ydl({"skip_download": True}) as y:
            info = y.extract_info(post_url, download=False)
        return info.get("view_count")
    except Exception:
        return None
