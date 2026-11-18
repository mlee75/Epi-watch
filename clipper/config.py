"""Settings, campaigns and project paths.

campaigns/<key>.yaml  one file per campaign (any creator, any game, any niche)
settings.yaml         global defaults, overridable per campaign
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "out"
CAMPAIGNS = ROOT / "campaigns"
SETTINGS = ROOT / "settings.yaml"

DEFAULTS = {
    "phone_folder": "",
    "send_all_to_phone": False,
    "creator_fee": 0.10,
    "clip": {"top": 6, "pre": 20, "post": 10, "min_gap": 45, "chat_weight": 1.0},
    "render": {"hook_seconds": 4, "cta_seconds": 3, "short_source": 75},
    "captions": {"enabled": False, "model": "small", "language": "en"},
}


def _merge(base: dict, over: dict | None) -> dict:
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def settings() -> dict:
    user = yaml.safe_load(SETTINGS.read_text()) if SETTINGS.exists() else {}
    return _merge(DEFAULTS, user)


@dataclass
class Campaign:
    key: str
    name: str
    url: str = ""
    owner: str = ""
    status: str = "to_join"          # to_join | joined | watch | avoid | ended
    rate_per_1k: float = 0.0
    min_payout: float = 0.0
    max_payout: float = 0.0
    budget_total: float = 0.0
    platforms: list[str] = field(default_factory=list)
    streamer: str = ""                # who must be the main focus
    hashtags: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    title_filter: list[str] = field(default_factory=list)  # VOD title must contain one of these (e.g. ["GTA"])
    facecam: str = ""                 # "x,y,w,h" fractions, found once per streamer
    since: str = ""                   # only clip VODs published on/after this date, YYYY-MM-DD
    handle: str = ""                  # on-screen creator handle, e.g. "@Tomovids"
    cta: str = ""                     # on-screen call to action at the end, e.g. "SUBSCRIBE TO TOMO ON YOUTUBE"
    caption_cta: str = ""             # call to action sentence for the post caption
    notes: str = ""
    rules_url: str = ""               # full rules page (Notion etc.)
    live: dict = field(default_factory=dict)
    clip: dict = field(default_factory=dict)       # overrides settings.clip
    render: dict = field(default_factory=dict)     # overrides settings.render
    captions: dict = field(default_factory=dict)   # overrides settings.captions

    @property
    def views_to_min(self) -> int:
        return round(self.min_payout / self.rate_per_1k * 1000) if self.rate_per_1k else 0

    @property
    def views_to_max(self) -> int:
        return round(self.max_payout / self.rate_per_1k * 1000) if self.rate_per_1k else 0

    def opts(self, section: str) -> dict:
        """Global setting section merged with this campaign's overrides."""
        return _merge(settings()[section], getattr(self, section))

    def allows(self, title: str) -> bool:
        return not self.title_filter or any(w.lower() in (title or "").lower() for w in self.title_filter)

    def post_caption(self, hook: str = "") -> str:
        """Caption with the creator name and the hashtags most briefs require."""
        lead = hook.strip() or self.streamer or self.name
        if self.streamer and self.streamer.lower() not in lead.lower():
            lead = f"{lead} | {self.streamer}"
        cta = f" {self.caption_cta}" if self.caption_cta else ""
        handle = f" {self.handle}" if self.handle and self.handle not in lead else ""
        return f"{lead}{handle}{cta} {' '.join(self.hashtags)}".strip()


FIELDS = set(Campaign.__dataclass_fields__) - {"key"}


def campaign_path(key: str, folder: Path | None = None) -> Path:
    return (folder or CAMPAIGNS) / f"{key}.yaml"


def load(folder: Path | None = None) -> tuple[dict[str, Campaign], float]:
    folder = folder or CAMPAIGNS
    out: dict[str, Campaign] = {}
    for p in sorted(folder.glob("*.yaml")):
        raw = yaml.safe_load(p.read_text()) or {}
        out[p.stem] = Campaign(key=p.stem, **{k: v for k, v in raw.items() if k in FIELDS})
    return out, float(settings()["creator_fee"])


def get(key: str) -> tuple[Campaign, float]:
    campaigns, fee = load()
    if key not in campaigns:
        raise SystemExit(f"Unknown campaign '{key}'. Known: {', '.join(campaigns) or 'none yet'}")
    return campaigns[key], fee


def save_raw(key: str, data: dict, folder: Path | None = None) -> Path:
    p = campaign_path(key, folder)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=120))
    return p


def read_raw(key: str, folder: Path | None = None) -> dict | None:
    p = campaign_path(key, folder)
    return yaml.safe_load(p.read_text()) if p.exists() else None


def phone_dir() -> Path | None:
    raw = settings().get("phone_folder") or ""
    return Path(raw).expanduser() if raw else None


def send_to_phone(clip: Path, campaign: str) -> Path | None:
    """Copy a clip and its caption file to the phone folder (iCloud Drive by default)."""
    import shutil
    base = phone_dir()
    if not base:
        return None
    if not base.parent.exists():  # no iCloud Drive on this machine
        return None
    dst = base / campaign
    dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(clip, dst / clip.name)
    note = clip.with_suffix(".txt")
    if note.exists():
        caption = note.read_text().split("Caption:\n", 1)[-1].split("\n\n", 1)[0]
        (dst / f"{clip.stem}_caption.txt").write_text(caption + "\n")
    return dst / clip.name
