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


def _font() -> str | None:
    return next((f for f in DEFAULT_FONTS if Path(f).exists()), None)


def _escape_path(p: Path) -> str:
    return str(p).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")


def build_filter(facecam: Facecam | None, hook_file: Path | None, srt: Path | None, hook_seconds: float = 4) -> str:
    if facecam:
        cam_h = 640
        chain = (
            f"[0:v]crop=iw*{facecam.w}:ih*{facecam.h}:iw*{facecam.x}:ih*{facecam.y},"
            f"scale={W}:{cam_h}:force_original_aspect_ratio=increase,crop={W}:{cam_h}[cam];"
            f"[0:v]crop=ih*{W}/{H - cam_h}:ih,scale={W}:{H - cam_h}[game];"
            f"[cam][game]vstack[v0]"
        )
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
            "fontsize=64:fontcolor=white:borderw=6:bordercolor=black:"
            f"x=(w-text_w)/2:y=170:enable='lt(t,{hook_seconds})'[v2]"
        )
        last = "v2"
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
) -> Path:
    """Cut [start, end] from src and render a 1080x1920 H.264 short."""
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg not found. Install it (brew install ffmpeg).")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        hook_file = None
        if hook:
            hook_file = Path(tmp) / "hook.txt"
            hook_file.write_text(hook)
        cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.2f}"]
        if end is not None:
            cmd += ["-t", f"{end - start:.2f}"]
        cmd += [
            "-i", str(src),
            "-filter_complex", build_filter(facecam, hook_file, srt, hook_seconds),
            "-map", "[vout]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
            str(out),
        ]
        subprocess.run(cmd, check=True)
    return out
