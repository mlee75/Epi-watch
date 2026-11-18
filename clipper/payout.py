"""Payout math for CPM campaigns on Content Rewards."""
from __future__ import annotations

from dataclasses import dataclass

from .config import Campaign


@dataclass
class Payout:
    views: int
    gross: float   # before the creator fee, after min/max rules
    net: float     # what lands in the Content Rewards balance
    capped: bool
    below_min: bool


def clip_payout(views: int, c: Campaign, fee: float = 0.10) -> Payout:
    raw = views / 1000 * c.rate_per_1k
    below_min = raw < c.min_payout
    capped = raw >= c.max_payout
    gross = 0.0 if below_min else min(raw, c.max_payout)
    return Payout(views, round(gross, 2), round(gross * (1 - fee), 2), capped, below_min)
