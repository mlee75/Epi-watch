"""Import any Content Rewards campaign from its public link into campaigns.yaml.

The campaign page ships its data inside Next.js flight chunks
(self.__next_f.push([1,"..."])). We decode them and pull the campaign object.
Rates in the page are in cents.
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import yaml

from .config import ROOT

ID_RE = re.compile(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
CHUNK_RE = re.compile(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', re.S)
SOURCE_RE = re.compile(r"https?://(?:www\.)?(?:youtube\.com|youtu\.be|twitch\.tv|kick\.com)/[^\s\"'<>)]+")
PLATFORM_NAMES = {"twitter": "x"}


def fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def flight_text(html: str) -> str:
    out = []
    for raw in CHUNK_RE.findall(html):
        try:
            out.append(json.loads(f'"{raw}"'))
        except json.JSONDecodeError:
            continue
    return "".join(out)


def find_campaign(text: str, campaign_id: str) -> dict:
    dec = json.JSONDecoder()
    for m in re.finditer(r'"payoutModel"', text):
        start = m.start()
        for _ in range(4000):
            start = text.rfind("{", 0, start)
            if start < 0:
                break
            try:
                obj, _end = dec.raw_decode(text, start)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and obj.get("id") == campaign_id and "configuration" in obj:
                return obj
    raise ValueError("Campaign data not found on the page. Is the link a public campaign?")


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return "_".join(s.split("_")[:3]) or "campaign"


def to_entry(obj: dict, url: str) -> dict:
    cfg = obj.get("configuration", {})
    models = cfg.get("payoutModel") or []
    if not models:
        raise ValueError(f"Campaign type '{obj.get('type')}' has no per-view payout model. Pool campaigns are not supported yet.")
    rate = max(m.get("rate", 0) for m in models) / 100
    min_p = min(m.get("minPayout", 0) for m in models) / 100
    max_p = max(m.get("maxPayout", 0) for m in models) / 100
    platforms = [PLATFORM_NAMES.get(m["platform"], m["platform"]) for m in models]
    desc = obj.get("description") or ""
    metrics = obj.get("metrics") or {}
    budget = (cfg.get("budget") or 0) / 100
    spent = (metrics.get("budgetSpentCents") or 0) / 100
    return {
        "name": obj.get("name", ""),
        "url": url.split("?")[0],
        "owner": (obj.get("organization") or {}).get("name", ""),
        "status": "to_join",
        "rate_per_1k": rate,
        "min_payout": min_p,
        "max_payout": max_p,
        "budget_total": budget,
        "platforms": platforms,
        "streamer": "",
        "hashtags": [],
        "sources": sorted(set(u.rstrip(".,") for u in SOURCE_RE.findall(desc))),
        "notes": f"Fill streamer + hashtags from the brief. Description: {desc[:300]}",
        "live": {
            "status": obj.get("status"),
            "budget_spent": spent,
            "clippers": metrics.get("creatorCount", 0),
            "checked": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        },
    }


def import_campaign(url: str, key: str | None = None, html: str | None = None,
                    path: Path | None = None) -> tuple[str, dict]:
    m = ID_RE.search(url)
    if not m:
        raise ValueError("Not a Content Rewards campaign link (no campaign id found).")
    obj = find_campaign(flight_text(html or fetch_html(url)), m.group(1))
    entry = to_entry(obj, url)
    path = path or ROOT / "campaigns.yaml"
    data = yaml.safe_load(path.read_text())
    key = key or _slug(entry["name"])
    existing = data["campaigns"].get(key)
    if existing:  # keep what a human or Claude already filled in
        for k in ("status", "streamer", "hashtags", "notes"):
            if existing.get(k):
                entry[k] = existing[k]
        entry["sources"] = sorted(set(entry["sources"]) | set(existing.get("sources") or []))
    data["campaigns"][key] = entry
    path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=120))
    return key, entry
