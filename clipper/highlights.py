"""Find candidate clip moments in a long VOD from audio energy.

Streamer highlights (yelling, laughing, crashes, explosions) show up as loudness
spikes. This is a cheap first pass: it ranks moments, a human picks the keepers.
"""
from __future__ import annotations

import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

SAMPLE_RATE = 8000


@dataclass
class Candidate:
    peak: float   # seconds into the source
    start: float
    end: float
    score: float  # z-score of smoothed loudness at the peak

    def to_dict(self) -> dict:
        return {k: round(v, 2) for k, v in asdict(self).items()}


def loudness_per_second(media: Path) -> np.ndarray:
    """RMS loudness in dB for each second of audio, decoded by ffmpeg."""
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(media), "-vn", "-ac", "1",
        "-ar", str(SAMPLE_RATE), "-f", "s16le", "-",
    ]
    pcm = subprocess.run(cmd, capture_output=True, check=True).stdout
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
    n = len(samples) // SAMPLE_RATE
    if n == 0:
        return np.zeros(0)
    frames = samples[: n * SAMPLE_RATE].reshape(n, SAMPLE_RATE)
    rms = np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-6
    return 20 * np.log10(rms)


def _z(x: np.ndarray, smooth: int) -> np.ndarray:
    pad = smooth // 2
    padded = np.pad(x, pad, mode="edge")
    s = np.convolve(padded, np.ones(smooth) / smooth, mode="valid")[: len(x)]
    std = s.std() or 1.0
    return (s - np.median(s)) / std


def find_candidates(
    db: np.ndarray,
    top: int = 8,
    pre: float = 20.0,
    post: float = 10.0,
    smooth: int = 3,
    min_gap: float = 45.0,
    chat: np.ndarray | None = None,
    chat_weight: float = 1.0,
    chat_lag: int = 4,
    edge: int = 3,
) -> list[Candidate]:
    """Rank moments by loudness (and chat spikes if given), return non-overlapping windows.

    chat_lag: chat reacts a few seconds after the moment, so chat is shifted back.
    edge: ignore the first and last seconds (encoder start/stop artefacts).
    """
    if len(db) == 0:
        return []
    z = _z(db, smooth)
    if chat is not None and len(chat):
        c = np.zeros(len(db))
        n = min(len(db), len(chat))
        c[:n] = chat[:n]
        c = np.roll(c, -chat_lag)
        z = z + chat_weight * _z(c, max(smooth, 5))
    if len(z) > 2 * edge:
        z[:edge] = -np.inf
        z[-edge:] = -np.inf
    order = np.argsort(z)[::-1]
    picked: list[Candidate] = []
    for i in order:
        if len(picked) >= top or z[i] <= 0:
            break
        t = float(i) + 0.5
        if any(abs(t - c.peak) < min_gap for c in picked):
            continue
        start = max(0.0, t - pre)
        end = min(float(len(db)), t + post)
        picked.append(Candidate(t, start, end, float(z[i])))
    return sorted(picked, key=lambda c: c.peak)


def candidates_for(media: Path, top: int = 8, chat_file: Path | None = None, **kw) -> list[Candidate]:
    db = loudness_per_second(media)
    chat = None
    if chat_file:
        from . import chat as chatmod
        chat = chatmod.per_second(chatmod.offsets(chat_file), len(db))
    return find_candidates(db, top=top, chat=chat, **kw)
