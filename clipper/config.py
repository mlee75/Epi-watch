"""Campaign config and project paths."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "out"


@dataclass
class Campaign:
    key: str
    name: str
    url: str
    owner: str
    status: str
    rate_per_1k: float
    min_payout: float
    max_payout: float
    budget_total: float
    platforms: list[str]
    streamer: str
    hashtags: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    notes: str = ""
    live: dict = field(default_factory=dict)

    @property
    def views_to_min(self) -> int:
        return round(self.min_payout / self.rate_per_1k * 1000)

    @property
    def views_to_max(self) -> int:
        return round(self.max_payout / self.rate_per_1k * 1000)

    def post_caption(self, hook: str = "") -> str:
        """Caption text with the streamer name and hashtags most briefs require."""
        lead = hook.strip() or (f"{self.streamer} in GTA 6" if self.streamer else self.name)
        if self.streamer and self.streamer.lower() not in lead.lower():
            lead = f"{lead} | {self.streamer}"
        return f"{lead} {' '.join(self.hashtags)}".strip()


def load(path: Path | None = None) -> tuple[dict[str, Campaign], float]:
    path = path or ROOT / "campaigns.yaml"
    raw = yaml.safe_load(path.read_text())
    fee = float(raw.get("creator_fee", 0.10))
    campaigns = {k: Campaign(key=k, **v) for k, v in raw["campaigns"].items()}
    return campaigns, fee


def get(key: str) -> tuple[Campaign, float]:
    campaigns, fee = load()
    if key not in campaigns:
        raise SystemExit(f"Unknown campaign '{key}'. Known: {', '.join(campaigns)}")
    return campaigns[key], fee
