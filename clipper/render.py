"""Turn a 16:9 stream segment into a 9:16 short with ffmpeg."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

W, H = 1080, 1920
DEFAULT_FONTS = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",       # macOS
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",    # Linux
]


@dataclass
class Facecam:
    """Facecam box as fractions of the source frame: x, y, width, height."""
    x: float
    y: float
    w: float
    h: float

    @classmethod
    def parse(cls, s: str) -> "Facecam":
        x, y, w, h = (float(v) for v in s.split(","))
        return cls(x, y, w, h)


def wrap(text: str, width: int = 18) -> str:
    """Break on-screen text into short centred lines so it never runs off a 1080px frame."""
    lines, cur = [], ""
    for word in text.split():
        if cur and len(cur) + 1 + len(word) > width:
            lines.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    if cur:
        lines.append(cur)
    return "\n".join(lines)


def _duration(p: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True).stdout.strip()
    return float(out or 0)


def _font() -> str | None:
    return next((f for f in DEFAULT_FONTS if Path(f).exists()), None)


def _escape_path(p: Path) -> str:
    return str(p).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")


CAM_H = 640


def build_filter(facecam: Facecam | None, hook_file: Path | None, srt: Path | None, hook_seconds: float = 4,
                 handle_file: Path | None = None, cta_file: Path | None = None,
                 cta_seconds: float = 3, duration: float | None = None,
                 layout: str = "smart", track_file: Path | None = None,
                 crop_px: tuple[int, int, int] | None = None) -> str:
    """crop_px = (crop width, crop height, first x) in source pixels for the tracked layout."""
    tracked = layout == "smart" and crop_px is not None
    if tracked:
        cw, ch, x0 = crop_px
        move = f"sendcmd=f='{_escape_path(track_file)}'," if track_file else ""
    if facecam:
        game_h = H - CAM_H
        game = (f"[g]{move}crop@g={cw}:{ch}:{x0}:0,scale={W}:{game_h}[game]" if tracked
                else f"[g]crop=ih*{W}/{game_h}:ih,scale={W}:{game_h}[game]")
        chain = (
            f"[0:v]split[c][g];[c]crop=iw*{facecam.w}:ih*{facecam.h}:iw*{facecam.x}:ih*{facecam.y},"
            f"scale={W}:{CAM_H}:force_original_aspect_ratio=increase,crop={W}:{CAM_H}[cam];"
            f"{game};[cam][game]vstack[v0]"
        )
    elif tracked:
        chain = f"[0:v]{move}crop@g={cw}:{ch}:{x0}:0,scale={W}:{H}[v0]"
    else:
        chain = (
            f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=20:2[bg];"
            f"[0:v]scale={W}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v0]"
        )
    last = "v0"
    if srt:
        chain += (
            f";[{last}]subtitles='{_escape_path(srt)}':force_style="
            "'Fontsize=14,Bold=1,Outline=3,Alignment=2,MarginV=60'[v1]"
        )
        last = "v1"
    font = _font()
    if hook_file and font:
        chain += (
            f";[{last}]drawtext=fontfile='{_escape_path(Path(font))}':textfile='{_escape_path(hook_file)}':"
            "fontsize=64:fontcolor=white:borderw=6:bordercolor=black:text_align=C:line_spacing=8:"
            f"x=(w-text_w)/2:y=170:enable='lt(t,{hook_seconds})'[v2]"
        )
        last = "v2"
    if handle_file and font:  # creator handle, small, whole clip (most briefs require it on screen)
        chain += (
            f";[{last}]drawtext=fontfile='{_escape_path(Path(font))}':textfile='{_escape_path(handle_file)}':"
            "fontsize=40:fontcolor=white@0.9:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h*0.30[v3]"
        )
        last = "v3"
    if cta_file and font and duration:  # call to action in the last seconds
        start = max(0.0, duration - cta_seconds)
        chain += (
            f";[{last}]drawtext=fontfile='{_escape_path(Path(font))}':textfile='{_escape_path(cta_file)}':"
            "fontsize=66:fontcolor=yellow:borderw=6:bordercolor=black:text_align=C:line_spacing=8:x=(w-text_w)/2:y=h*0.60:"
            f"enable='gte(t,{start:.2f})'[v4]"
        )
        last = "v4"
    return chain + f";[{last}]format=yuv420p[vout]"


def render(
    src: Path,
    out: Path,
    start: float = 0.0,
    end: float | None = None,
    facecam: Facecam | None = None,
    hook: str = "",
    srt: Path | None = None,
    hook_seconds: float = 4,
    handle: str = "",
    cta: str = "",
    cta_seconds: float = 3,
    layout: str = "smart",
) -> Path:
    """Cut [start, end] from src and render a 1080x1920 H.264 short.

    layout "smart": 9:16 crop that follows the action (default). "blur": whole 16:9 frame on a blurred fill.
    """
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg not found. Install it (brew install ffmpeg).")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        def _txt(name: str, value: str) -> Path | None:
            if not value:
                return None
            f = Path(tmp) / name
            f.write_text(value)
            return f
        hook_file, handle_file, cta_file = _txt("hook.txt", wrap(hook, 20)), _txt("handle.txt", handle), _txt("cta.txt", wrap(cta, 18))
        duration = (end - start) if end is not None else _duration(src) - start
        track_file, crop_px = None, None
        if layout == "smart":
            from . import reframe
            sw, sh = reframe.probe_size(src)
            target_h = H - CAM_H if facecam else H
            cw = min(sw, int(round(sh * W / target_h / 2) * 2))
            mask = (facecam.x, facecam.y, facecam.w, facecam.h) if facecam else None
            try:
                path = reframe.track(src, cw / sw, mask, start, duration)
            except Exception as e:  # never fail a render because tracking failed
                print(f"  tracking failed ({e}), using centre crop")
                path = [(0.0, 0.5)]
            track_file = Path(tmp) / "track.txt"
            x0 = reframe.sendcmd_file(path, sw, cw, track_file)
            crop_px = (cw, sh, x0)
        cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.2f}"]
        if end is not None:
            cmd += ["-t", f"{end - start:.2f}"]
        cmd += [
            "-i", str(src),
            "-filter_complex", build_filter(facecam, hook_file, srt, hook_seconds, handle_file, cta_file, cta_seconds, duration,
                                            layout, track_file, crop_px),
            "-map", "[vout]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
            str(out),
        ]
        subprocess.run(cmd, check=True)
    return out
