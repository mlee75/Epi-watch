"""clipper: command line for the clipping pipeline.

Flow: scan -> auto (find + cut + render into out/review) -> you review and post by hand
-> log -> submit in Content Rewards -> submitted -> stats.
"""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from . import config, highlights, render, sources, tracker
from .payout import clip_payout

REVIEW_CHECKLIST = """\
Before posting, check every box:
[ ] {streamer} is the main focus for most of the clip
[ ] No story cutscene, mission ending or plot reveal
[ ] No logos or watermarks from other accounts
[ ] Hook lands in the first 1.5 seconds
[ ] Posting to an allowed platform: {platforms}
[ ] Submit the post link in Content Rewards right after posting (Reach: within 30 min)
"""


def _is_local(src: str) -> bool:
    return Path(src).exists()


def cmd_campaigns(a):
    cs, fee = config.load()
    for c in cs.values():
        print(
            f"{c.key:18} {c.status:7} ${c.rate_per_1k:.2f}/1K (net ${c.rate_per_1k * (1 - fee):.2f}) "
            f"min ${c.min_payout:g} @ {c.views_to_min:,} views, max ${c.max_payout:g} @ {c.views_to_max:,} views "
            f"| {', '.join(c.platforms)}"
        )


def cmd_scan(a):
    c, _ = config.get(a.campaign)
    if not c.sources:
        raise SystemExit(f"No sources set for {c.key}. Add them to campaigns.yaml.")
    for url in c.sources:
        print(f"\n# {url}")
        for e in sources.recent(url, a.n):
            mins = f"{(e['duration'] or 0) / 60:.0f} min" if e["duration"] else (e["live"] or "?")
            print(f"- {e['title']} [{mins}] {e['url']}")


def _find(src: str, top: int, chat: str | None = None) -> list[highlights.Candidate]:
    media = Path(src) if _is_local(src) else sources.audio(src)
    chat_file = None
    if chat == "auto" and not _is_local(src) and "youtu" in src:
        from . import chat as chatmod
        chat_file = chatmod.fetch_youtube(src)
        print("Chat replay:", chat_file or "none found, using audio only")
    elif chat and chat != "auto":
        chat_file = Path(chat)
    return highlights.candidates_for(media, top=top, chat_file=chat_file)


def cmd_find(a):
    cands = _find(a.source, a.top, a.chat)
    print(json.dumps([c.to_dict() for c in cands], indent=2))


def _render_one(c: config.Campaign, src: str, start: float, end: float, hook: str, facecam, tag: str) -> Path:
    if _is_local(src):
        media, s, e = Path(src), start, end
    else:
        media, s, e = sources.segment(src, start, end), 0.0, None
    out_dir = config.OUT / "review" / c.key
    out = out_dir / f"{date.today()}_{tag}_{int(start)}.mp4"
    render.render(media, out, start=s, end=e, facecam=facecam, hook=hook)
    note = out.with_suffix(".txt")
    note.write_text(
        f"Source: {src} @ {start:.0f}s-{end:.0f}s\n\nCaption:\n{c.post_caption(hook)}\n\n"
        + REVIEW_CHECKLIST.format(streamer=c.streamer, platforms=", ".join(c.platforms))
    )
    return out


def cmd_cut(a):
    c, _ = config.get(a.campaign)
    fc = render.Facecam.parse(a.facecam) if a.facecam else None
    out = _render_one(c, a.source, a.start, a.end, a.hook, fc, a.tag)
    print(f"Rendered {out}")


def cmd_auto(a):
    c, _ = config.get(a.campaign)
    fc = render.Facecam.parse(a.facecam) if a.facecam else None
    cands = _find(a.source, a.top, a.chat)
    if not cands:
        raise SystemExit("No loud moments found.")
    for i, cand in enumerate(cands, 1):
        out = _render_one(c, a.source, cand.start, cand.end, "", fc, f"{a.tag}{i:02d}")
        print(f"[{i}/{len(cands)}] score {cand.score:.1f} -> {out}")
    print(f"\nReview queue: {config.OUT / 'review' / c.key}")


def cmd_log(a):
    r = tracker.log(a.campaign, a.platform, a.post_url, a.clip or "", a.notes or "")
    c, _ = config.get(a.campaign)
    print(f"Logged {r['post_url']}. Now submit it in Content Rewards: {c.url}")


def cmd_submitted(a):
    print("Marked submitted." if tracker.mark_submitted(a.post_url) else "Post URL not found in tracker.")


def cmd_stats(a):
    rows = tracker.refresh(None if a.offline else sources.view_count)
    total = sum(float(r.get("net_usd") or 0) for r in rows)
    pending = [r for r in rows if r.get("submitted") != "yes"]
    for r in rows:
        print(f"{r['campaign']:16} {r['platform']:9} {int(r['views'] or 0):>9,} views  ${r['net_usd']:>7}  {r['post_url']}")
    print(f"\nEstimated net: ${total:.2f} across {len(rows)} clips. Not yet submitted: {len(pending)}")


def cmd_payout(a):
    c, fee = config.get(a.campaign)
    p = clip_payout(a.views, c, fee)
    flag = " (below min: $0)" if p.below_min else " (capped)" if p.capped else ""
    print(f"{a.views:,} views on {c.key}: gross ${p.gross:.2f}, net ${p.net:.2f}{flag}")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="clipper")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("campaigns", help="list campaigns and payout thresholds").set_defaults(f=cmd_campaigns)

    s = sub.add_parser("scan", help="list latest VODs from a campaign's sources")
    s.add_argument("campaign"); s.add_argument("-n", type=int, default=5); s.set_defaults(f=cmd_scan)

    chat_help = "chat replay: 'auto' (YouTube), or a Twitch chat JSON from TwitchDownloaderCLI"
    s = sub.add_parser("find", help="rank loud moments in a VOD url or local file")
    s.add_argument("source"); s.add_argument("--top", type=int, default=8)
    s.add_argument("--chat", help=chat_help); s.set_defaults(f=cmd_find)

    for name, fn, helptext in [("cut", cmd_cut, "render one clip"), ("auto", cmd_auto, "find + render top N clips")]:
        s = sub.add_parser(name, help=helptext)
        s.add_argument("campaign"); s.add_argument("source")
        s.add_argument("--facecam", help="x,y,w,h as fractions of the frame, e.g. 0.72,0.02,0.26,0.26")
        s.add_argument("--tag", default="clip")
        if name == "cut":
            s.add_argument("--start", type=float, required=True)
            s.add_argument("--end", type=float, required=True)
            s.add_argument("--hook", default="", help="text shown for the first 4 seconds")
        else:
            s.add_argument("--top", type=int, default=6)
            s.add_argument("--chat", help=chat_help)
        s.set_defaults(f=fn)

    s = sub.add_parser("log", help="record a clip you posted")
    s.add_argument("campaign"); s.add_argument("platform"); s.add_argument("post_url")
    s.add_argument("--clip"); s.add_argument("--notes"); s.set_defaults(f=cmd_log)

    s = sub.add_parser("submitted", help="mark a post as submitted in Content Rewards")
    s.add_argument("post_url"); s.set_defaults(f=cmd_submitted)

    s = sub.add_parser("stats", help="refresh view counts and estimated payouts")
    s.add_argument("--offline", action="store_true"); s.set_defaults(f=cmd_stats)

    s = sub.add_parser("payout", help="what N views earn on a campaign")
    s.add_argument("campaign"); s.add_argument("views", type=int); s.set_defaults(f=cmd_payout)

    a = ap.parse_args(argv)
    a.f(a)


if __name__ == "__main__":
    main()
