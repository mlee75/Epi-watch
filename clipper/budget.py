"""Budget runway: how fast each campaign's budget is being spent, and how long is left.

Every refresh (`clipper add <url> --key k` or `clipper budgets --refresh`) appends a snapshot to
data/budget_history.csv. Burn rate = spend between the oldest and newest snapshot of the last 48h.
"""
from __future__ import annotations

import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config

FIELDS = ["checked", "campaign", "spent", "budget", "clippers", "status"]


def path() -> Path:
    return config.DATA / "budget_history.csv"


def record(key: str, live: dict, budget: float) -> None:
    p = path()
    p.parent.mkdir(parents=True, exist_ok=True)
    new = not p.exists()
    with p.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new:
            w.writeheader()
        w.writerow({"checked": live.get("checked") or datetime.now(timezone.utc).isoformat(timespec="minutes"),
                    "campaign": key, "spent": live.get("budget_spent", 0), "budget": budget,
                    "clippers": live.get("clippers", 0), "status": live.get("status", "")})


def _rows(key: str) -> list[dict]:
    if not path().exists():
        return []
    with path().open(newline="") as f:
        return [r for r in csv.DictReader(f) if r["campaign"] == key]


def runway(key: str, launched: str | None = None, now: datetime | None = None) -> dict:
    """{'spent','budget','left','per_day','days_left','status'} from the snapshots."""
    now = now or datetime.now(timezone.utc)
    rows = _rows(key)
    if not rows:
        return {}
    last = rows[-1]
    spent, budget = float(last["spent"]), float(last["budget"])
    window = [r for r in rows if datetime.fromisoformat(r["checked"]) >= now - timedelta(hours=48)] or rows
    first = window[0]
    hours = (datetime.fromisoformat(last["checked"]) - datetime.fromisoformat(first["checked"])).total_seconds() / 3600
    per_day = None
    if hours >= 2:
        per_day = (spent - float(first["spent"])) / hours * 24
    elif launched:  # one snapshot only: average since launch
        days = (now - datetime.fromisoformat(launched)).total_seconds() / 86400
        per_day = spent / days if days > 0.1 else None
    left = max(0.0, budget - spent)
    days_left = (left / per_day) if per_day and per_day > 0 else None
    return {"spent": spent, "budget": budget, "left": left, "per_day": per_day,
            "days_left": days_left, "status": last["status"], "clippers": int(float(last["clippers"] or 0))}
