"""clipper: command line for clip-engine.

Flow: add (campaign link) -> run / auto (find + cut + render into out/review)
-> review app (keep, post by hand, log) -> stats.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from datetime import date
from pathlib import Path

from . import config, highlights, render, sources, tracker
from .payout import clip_payout

REVIEW_CHECKLIST = """\
Before posting, check every box:
[ ] {focus} is the main focus for most of the clip
[ ] No story cutscene, ending or spoiler
[ ] No logos or watermarks from other accounts
[ ] Hook lands in the first 1.5 seconds
[ ] Posting to an allowed platform: {platforms}
[ ] Submit the post link in Content Rewards right after posting
"""
PROCESSED = config.DATA / "processed.json"


def _is_local(src: str) -> bool:
    return Path(src).exists()


def _processed() -> dict:
    return json.loads(PROCESSED.read_text()) if PROCESSED.exists() else {}


def _mark_processed(campaign: str, vod_id: str) -> None:
    d = _processed()
    d.setdefault(campaign, [])
    if vod_id not in d[campaign]:
        d[campaign].append(vod_id)
    PROCESSED.parent.mkdir(parents=True, exist_ok=True)
    PROCESSED.write_text(json.dumps(d, indent=2))


# ---------- core steps ----------

def _find(src: str, c: config.Campaign | None, top: int | None, chat: str | None,
          media: Path | None = None) -> list[highlights.Candidate]:
    opts = c.opts("clip") if c else config.settings()["clip"]
    media = media or (Path(src) if _is_local(src) else sources.audio(src))
    chat_file = None
    if chat == "auto" and not _is_local(src) and "youtu" in src:
        from . import chat as chatmod
        chat_file = chatmod.fetch_youtube(src)
        print("Chat replay:", chat_file or "none found, audio only")
    elif chat and chat != "auto":
        chat_file = Path(chat)
    return highlights.candidates_for(
        media, top=top or opts["top"], chat_file=chat_file,
        pre=opts["pre"], post=opts["post"], min_gap=opts["min_gap"], chat_weight=opts["chat_weight"],
    )


def _render_one(c: config.Campaign, src: str, start: float, end: float, hook: str,
                facecam: render.Facecam | None, tag: str, captions: bool | None = None) -> Path:
    cap_opts = c.opts("captions")
    use_caps = cap_opts["enabled"] if captions is None else captions
    out = config.OUT / "review" / c.key / f"{date.today()}_{tag}_{int(start)}.mp4"
    with tempfile.TemporaryDirectory() as tmp:
        if _is_local(src):
            media = Path(tmp) / "seg.mp4"
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.2f}", "-t", f"{end - start:.2f}",
                            "-i", src, "-c", "copy", str(media)], check=True)
        else:
            media = sources.segment(src, start, end)
        srt = None
        if use_caps:
            from .captions import transcribe
            srt = transcribe(media, Path(tmp) / "subs.srt", cap_opts["model"], cap_opts["language"])
        ro = c.opts("render")
        render.render(media, out, facecam=facecam, hook=hook, srt=srt, hook_seconds=ro["hook_seconds"],
                      handle=c.handle, cta=c.cta, cta_seconds=ro["cta_seconds"])
    focus = c.streamer or "The creator"
    out.with_suffix(".txt").write_text(
        f"Source: {src} @ {start:.0f}s-{end:.0f}s\n\nCaption:\n{c.post_caption(hook)}\n\n"
        + REVIEW_CHECKLIST.format(focus=focus, platforms=", ".join(c.platforms))
    )
    return out


def _facecam(c: config.Campaign, arg: str | None) -> render.Facecam | None:
    s = arg if arg is not None else c.facecam
    return render.Facecam.parse(s) if s else None


def clip_vod(c: config.Campaign, src: str, top: int | None, chat: str | None,
             facecam: str | None, tag: str, captions: bool | None) -> list[Path]:
    fc = _facecam(c, facecam)
    media = Path(src) if _is_local(src) else sources.audio(src)
    length = render._duration(media)
    if 0 < length <= c.opts("render")["short_source"]:  # a ready-made clip (e.g. Twitch Clips): use it whole
        out = _render_one(c, src, 0.0, length, "", fc, f"{tag}01", captions)
        print(f"  short source ({length:.0f}s) rendered whole -> {out.name}")
        return [out]
    cands = _find(src, c, top, chat, media=media)
    outs = []
    for i, cand in enumerate(cands, 1):
        out = _render_one(c, src, cand.start, cand.end, "", fc, f"{tag}{i:02d}", captions)
        print(f"  [{i}/{len(cands)}] score {cand.score:.1f} -> {out.name}")
        outs.append(out)
    return outs


# ---------- commands ----------

def cmd_campaigns(a):
    cs, fee = config.load()
    if not cs:
        print("No campaigns yet. Add one with: clipper add <Content Rewards link>")
    for c in cs.values():
        print(
            f"{c.key:18} {c.status:7} ${c.rate_per_1k:.2f}/1K (net ${c.rate_per_1k * (1 - fee):.2f}) "
            f"min ${c.min_payout:g} @ {c.views_to_min:,} views, max ${c.max_payout:g} @ {c.views_to_max:,} views "
            f"| {', '.join(c.platforms)}"
        )


def cmd_scan(a):
    c, _ = config.get(a.campaign)
    if not c.sources:
        raise SystemExit(f"No sources set for {c.key}. Add them to campaigns/{c.key}.yaml.")
    done = set(_processed().get(c.key, []))
    for url in c.sources:
        print(f"\n# {url}")
        for e in sources.recent(url, a.n):
            mins = f"{(e['duration'] or 0) / 60:.0f} min" if e["duration"] else (e["live"] or "?")
            flags = []
            if e["id"] in done:
                flags.append("done")
            if not c.allows(e["title"]):
                flags.append("off-topic")
            if e["live"] == "is_live":
                flags.append("LIVE")
            print(f"- {e['title']} [{mins}] {e['url']} {' '.join(f'({f})' for f in flags)}")


def cmd_find(a):
    c = config.get(a.campaign)[0] if a.campaign else None
    print(json.dumps([x.to_dict() for x in _find(a.source, c, a.top, a.chat)], indent=2))


def cmd_cut(a):
    c, _ = config.get(a.campaign)
    out = _render_one(c, a.source, a.start, a.end, a.hook, _facecam(c, a.facecam), a.tag, a.captions)
    print(f"Rendered {out}")


def cmd_auto(a):
    c, _ = config.get(a.campaign)
    outs = clip_vod(c, a.source, a.top, a.chat, a.facecam, a.tag, a.captions)
    print(f"\n{len(outs)} clips in {config.OUT / 'review' / c.key}")


def cmd_run(a):
    """Clip every new, finished, on-topic VOD for every joined campaign."""
    cs, _ = config.load()
    targets = [c for c in cs.values() if c.status == "joined" and (not a.campaign or c.key in a.campaign)]
    if not targets:
        raise SystemExit("No joined campaigns to run.")
    total = 0
    for c in targets:
        print(f"\n== {c.key}")
        done = set(_processed().get(c.key, []))
        picked = 0
        for url in c.sources:
            try:
                entries = sources.recent(url, a.scan)
            except Exception as e:
                print(f"  skip source {url}: {e}")
                continue
            for e in entries:
                if picked >= a.vods:
                    break
                if e["id"] in done or e["live"] == "is_live" or not c.allows(e["title"]) or not e["url"]:
                    continue
                if c.since:
                    pub = sources.published(e["url"])
                    if pub and pub < c.since:
                        continue
                print(f"  VOD: {e['title']}")
                if a.dry_run:
                    picked += 1
                    continue
                try:
                    total += len(clip_vod(c, e["url"], a.top, "auto", None, f"{e['id']}_", a.captions))
                    _mark_processed(c.key, e["id"])
                except Exception as err:
                    print(f"  failed: {err}")
                picked += 1
        if not picked:
            print("  nothing new")
    print(f"\nDone. {total} new clips waiting in the review app.")


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


def cmd_add(a):
    from .campaign_import import import_campaign
    key, e = import_campaign(a.url, a.key)
    print(f"Saved campaigns/{key}.yaml: {e['name']} by {e['owner']}")
    print(f"  ${e['rate_per_1k']:.2f}/1K, min ${e['min_payout']:g}, max ${e['max_payout']:g}, budget ${e['budget_total']:,.0f}")
    live = e.get("live", {})
    print(f"  spent ${live.get('budget_spent', 0):,.0f}, {live.get('clippers', 0)} clippers, status {live.get('status')}")
    print(f"  platforms: {', '.join(e['platforms'])}")
    print(f"  sources: {', '.join(e['sources']) or 'none found'}")
    if not e.get("streamer"):
        print("  To fill in: streamer, hashtags, title_filter (from the brief).")


def cmd_review(a):
    from .review_app import serve
    serve(a.port, not a.no_browser)


def cmd_frame(a):
    """Save one frame so Claude (or you) can locate the facecam box."""
    if _is_local(a.source):
        media, t = Path(a.source), a.at
    else:
        media, t = sources.segment(a.source, a.at, a.at + 3), 1
    out = config.DATA / "frames" / f"frame_{int(a.at)}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(media),
                    "-frames:v", "1", "-vf", "scale=1280:-2", str(out)], check=True)
    print(out)


def cmd_doctor(a):
    import importlib.util
    import shutil
    ok = True
    for tool in ("ffmpeg", "ffprobe"):
        found = shutil.which(tool)
        print(f"{'OK     ' if found else 'MISSING'} {tool} {found or '(brew install ffmpeg)'}")
        ok &= bool(found)
    for mod in ("yt_dlp", "numpy", "yaml"):
        found = importlib.util.find_spec(mod) is not None
        print(f"{'OK     ' if found else 'MISSING'} python: {mod}")
        ok &= found
    caps = importlib.util.find_spec("faster_whisper") is not None
    print(f"{'OK     ' if caps else 'OPTIONAL'} captions (faster-whisper){'' if caps else ': pip install -e .[captions]'}")
    cs, _ = config.load()
    joined = [c.key for c in cs.values() if c.status == "joined"]
    print(f"OK      {len(cs)} campaigns, joined: {', '.join(joined) or 'none'}")
    print("All good." if ok else "Fix the MISSING lines, then run clipper doctor again.")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="clipper", description="clip-engine: paid clipping campaigns, semi-automated")
    sub = ap.add_subparsers(dest="cmd", required=True)
    chat_help = "chat replay: 'auto' (YouTube) or a Twitch chat JSON from TwitchDownloaderCLI"
    fc_help = "webcam box x,y,w,h as fractions of the frame; default: the campaign's facecam"

    sub.add_parser("campaigns", help="list campaigns and payout thresholds").set_defaults(f=cmd_campaigns)
    sub.add_parser("doctor", help="check the install").set_defaults(f=cmd_doctor)

    s = sub.add_parser("add", help="import any Content Rewards campaign from its link")
    s.add_argument("url"); s.add_argument("--key", help="short name, e.g. tomo"); s.set_defaults(f=cmd_add)

    s = sub.add_parser("scan", help="list latest VODs from a campaign's sources")
    s.add_argument("campaign"); s.add_argument("-n", type=int, default=5); s.set_defaults(f=cmd_scan)

    s = sub.add_parser("find", help="rank moments in a VOD link or local file")
    s.add_argument("source"); s.add_argument("--campaign"); s.add_argument("--top", type=int)
    s.add_argument("--chat", help=chat_help); s.set_defaults(f=cmd_find)

    for name, fn, helptext in [("cut", cmd_cut, "render one clip"), ("auto", cmd_auto, "find + render the top clips of one VOD")]:
        s = sub.add_parser(name, help=helptext)
        s.add_argument("campaign"); s.add_argument("source")
        s.add_argument("--facecam", help=fc_help); s.add_argument("--tag", default="clip")
        s.add_argument("--captions", action=argparse.BooleanOptionalAction, default=None)
        if name == "cut":
            s.add_argument("--start", type=float, required=True); s.add_argument("--end", type=float, required=True)
            s.add_argument("--hook", default="", help="text shown at the start")
        else:
            s.add_argument("--top", type=int); s.add_argument("--chat", help=chat_help)
        s.set_defaults(f=fn)

    s = sub.add_parser("run", help="clip new VODs for every joined campaign")
    s.add_argument("campaign", nargs="*", help="limit to these campaigns")
    s.add_argument("--vods", type=int, default=1, help="new VODs per campaign (default 1)")
    s.add_argument("--scan", type=int, default=5, help="how many recent entries to look at per source")
    s.add_argument("--top", type=int); s.add_argument("--dry-run", action="store_true")
    s.add_argument("--captions", action=argparse.BooleanOptionalAction, default=None)
    s.set_defaults(f=cmd_run)

    s = sub.add_parser("frame", help="save one frame of a VOD to find the facecam box")
    s.add_argument("source"); s.add_argument("--at", type=float, default=600); s.set_defaults(f=cmd_frame)

    s = sub.add_parser("review", help="open the local review app")
    s.add_argument("--port", type=int, default=8765); s.add_argument("--no-browser", action="store_true")
    s.set_defaults(f=cmd_review)

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
