"""Action-tracked 9:16 framing for 16:9 stream footage.

For each moment we look at low-res frames, measure where things move (and where faces are),
and pick the horizontal crop window that holds the most action, with a pull toward the centre
(third-person games keep the character centred). The path is smoothed like a camera operator:
it holds still while the action stays in frame and pans smoothly when it leaves.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np

SAMPLE_W = 320
FPS = 4


def probe_size(media: Path) -> tuple[int, int]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-of", "csv=p=0", str(media)], capture_output=True, text=True, check=True).stdout.strip()
    w, h = out.split(",")[:2]
    return int(w), int(h)


def _frames(media: Path, start: float = 0.0, duration: float | None = None) -> tuple[np.ndarray, int]:
    w, h = probe_size(media)
    sh = int(round(SAMPLE_W * h / w / 2) * 2)
    seek = ["-ss", f"{start:.2f}"] + (["-t", f"{duration:.2f}"] if duration else [])
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", *seek, "-i", str(media), "-vf", f"fps={FPS},scale={SAMPLE_W}:{sh},format=gray",
         "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    n = len(raw) // (SAMPLE_W * sh)
    return np.frombuffer(raw[: n * SAMPLE_W * sh], dtype=np.uint8).reshape(n, sh, SAMPLE_W).astype(np.float32), sh


def _faces(frame: np.ndarray) -> list[tuple[int, int]]:
    try:
        import cv2
    except ImportError:
        return []
    cascade = getattr(_faces, "_c", None)
    if cascade is None:
        cascade = False
        try:
            path = Path(getattr(cv2, "data", None).haarcascades) / "haarcascade_frontalface_default.xml"
            if path.exists():
                c = cv2.CascadeClassifier(str(path))
                cascade = c if not c.empty() else False
        except Exception:
            cascade = False
        _faces._c = cascade
    if cascade is False:
        return []  # no face model available: motion only
    found = cascade.detectMultiScale(frame.astype(np.uint8), scaleFactor=1.15, minNeighbors=5, minSize=(18, 18))
    return [(int(x + fw / 2), int(fw)) for x, y, fw, fh in found]


def column_saliency(frames: np.ndarray, mask: tuple[float, float, float, float] | None = None) -> np.ndarray:
    """Per sampled frame, how much is happening in each pixel column."""
    n, h, w = frames.shape
    out = np.zeros((n, w), dtype=np.float32)
    for i in range(n):
        motion = np.abs(frames[i] - frames[i - 1]) if i else np.zeros_like(frames[i])
        if mask:
            x, y, mw, mh = mask
            motion[int(y * h): int((y + mh) * h), int(x * w): int((x + mw) * w)] = 0
        col = motion.sum(axis=0)
        for cx, fw in _faces(frames[i]):
            if mask and mask[0] * w <= cx <= (mask[0] + mask[2]) * w:
                continue  # the webcam is shown separately
            sigma = max(fw, 10)
            col += col.max(initial=1.0) * 1.5 * np.exp(-((np.arange(w) - cx) ** 2) / (2 * sigma ** 2))
        out[i] = col
    return out


def best_centres(sal: np.ndarray, crop_frac: float, centre_pull: float = 0.45) -> np.ndarray:
    """Crop centre (as fraction of width) that keeps the most action in each sample."""
    n, w = sal.shape
    cw = max(2, int(round(crop_frac * w)))
    half = cw / 2
    centres = np.arange(cw // 2, w - cw // 2 + 1)
    out = np.full(n, 0.5)
    for i in range(n):
        col = sal[i]
        total = col.sum()
        if total <= 1e-6:
            continue
        csum = np.concatenate([[0], np.cumsum(col)])
        inside = (csum[(centres + half).astype(int).clip(0, w)] - csum[(centres - half).astype(int).clip(0, w)]) / total
        dist = np.abs(centres / w - 0.5) / 0.5
        score = inside - centre_pull * 0.25 * dist
        out[i] = centres[int(np.argmax(score))] / w
    return out


def smooth_path(raw: np.ndarray, crop_frac: float, dead_zone: float = 0.12,
                max_speed: float = 0.35, fps: int = FPS) -> np.ndarray:
    """Camera-operator smoothing: hold while the target stays near frame, pan with limited speed."""
    if len(raw) == 0:
        return raw
    k = min(len(raw), 5)
    med = np.array([np.median(raw[max(0, i - k // 2): i + k // 2 + 1]) for i in range(len(raw))])
    lo, hi = crop_frac / 2, 1 - crop_frac / 2
    pos = float(np.clip(med[0], lo, hi))
    step = max_speed / fps
    out = np.empty(len(med))
    target = pos
    for i, m in enumerate(med):
        if abs(m - pos) > dead_zone * crop_frac * 2:
            target = m
        delta = np.clip(target - pos, -step, step)
        pos = float(np.clip(pos + delta * 0.85, lo, hi))
        out[i] = pos
    return out


def track(media: Path, crop_frac: float, mask: tuple[float, float, float, float] | None = None,
          start: float = 0.0, duration: float | None = None) -> list[tuple[float, float]]:
    """[(seconds from clip start, centre fraction)] for the crop window."""
    frames, _ = _frames(media, start, duration)
    if len(frames) < 2:
        return [(0.0, 0.5)]
    path = smooth_path(best_centres(column_saliency(frames, mask), crop_frac), crop_frac)
    return [(i / FPS, float(c)) for i, c in enumerate(path)]


def sendcmd_file(path: list[tuple[float, float]], src_w: int, crop_w: int, out: Path, target: str = "crop@g") -> int:
    """Write an ffmpeg sendcmd script moving the crop x. Returns the first x."""
    lines, first = [], None
    last_x = None
    for t, c in path:
        x = int(round(min(max(c * src_w - crop_w / 2, 0), src_w - crop_w)))
        x -= x % 2
        if first is None:
            first = x
        if x != last_x:
            lines.append(f"{t:.2f} {target} x {x};")
            last_x = x
    out.write_text("\n".join(lines) + "\n")
    return first or 0
