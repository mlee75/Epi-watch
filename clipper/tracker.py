"""Log posted clips and compute what each one has earned."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from .config import DATA, load
from .payout import clip_payout

FIELDS = [
    "posted_at", "campaign", "platform", "post_url", "clip_file",
    "submitted", "views", "gross_usd", "net_usd", "last_checked", "notes",
]


def path() -> Path:
    return DATA / "tracker.csv"


def rows() -> list[dict]:
    p = path()
    if not p.exists():
        return []
    with p.open(newline="") as f:
        return list(csv.DictReader(f))


def write(all_rows: list[dict]) -> None:
    p = path()
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in all_rows:
            w.writerow({k: r.get(k, "") for k in FIELDS})


def log(campaign: str, platform: str, post_url: str, clip_file: str = "", notes: str = "") -> dict:
    campaigns, _ = load()
    c = campaigns[campaign]
    if platform not in c.platforms:
        raise SystemExit(f"{c.name} does not pay for {platform}. Allowed: {', '.join(c.platforms)}")
    r = {
        "posted_at": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "campaign": campaign, "platform": platform, "post_url": post_url,
        "clip_file": clip_file, "submitted": "no", "views": "0", "notes": notes,
    }
    write(rows() + [r])
    return r


def mark_submitted(post_url: str) -> bool:
    all_rows, hit = rows(), False
    for r in all_rows:
        if r["post_url"] == post_url:
            r["submitted"], hit = "yes", True
    write(all_rows)
    return hit


def refresh(fetch_views=None) -> list[dict]:
    """Update views (via fetch_views(url) -> int|None) and payouts for every row."""
    campaigns, fee = load()
    all_rows = rows()
    now = datetime.now(timezone.utc).isoformat(timespec="minutes")
    for r in all_rows:
        if fetch_views:
            v = fetch_views(r["post_url"])
            if v is not None:
                r["views"] = str(v)
                r["last_checked"] = now
        c = campaigns.get(r["campaign"])
        if c:
            p = clip_payout(int(r["views"] or 0), c, fee)
            r["gross_usd"], r["net_usd"] = f"{p.gross:.2f}", f"{p.net:.2f}"
    write(all_rows)
    return all_rows
