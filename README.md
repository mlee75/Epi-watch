# gta6-clipper

Semi-automated pipeline for paid GTA 6 clipping campaigns on Content Rewards.
The machine finds moments and renders shorts. You review, post and submit.

## Using it (no terminal)

1. Open this folder in Claude Code (desktop app: open folder `~/Projects/gta6-clipper`).
2. Type `/setup` once.
3. Then ask in plain words, or use the commands:
   - `/add-campaign <Content Rewards link>`: imports rates, caps, budget, platforms and sources, then reads the brief
   - `/clip tomo`: picks the latest allowed stream, finds the facecam, renders shorts
   - `/review`: opens the review app. Watch, copy caption, keep or reject, download, paste the post link after posting
   - `/stats`: views, estimated earnings, unsubmitted posts, budgets running low

## Pipeline

```
scan        list latest VODs/streams from a campaign's sources        (yt-dlp)
find        rank moments by audio spikes + chat spikes                (ffmpeg, numpy, chat replay)
auto/cut    download only the needed segment, render 1080x1920 short  (yt-dlp sections, ffmpeg)
            -> out/review/<campaign>/<date>_<tag>_<start>.mp4 + .txt (caption + checklist)
YOU         watch, keep the good ones, post natively on each platform
log         record the post URL                                       (data/tracker.csv)
YOU         submit the link in Content Rewards (Reach: within 30 min)
submitted   mark it done
stats       refresh public view counts, estimate payout after min/max/fee
```

Posting stays manual on purpose. Campaigns ban botting and reposting, and auto-posting
tools put the accounts at risk. Automation stops at the review queue.

## Setup (Mac)

```bash
brew install ffmpeg
python3 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'            # add ,captions for Whisper captions
pytest -q
```

Twitch chat replay (optional, better highlights on Twitch VODs):
`brew install --cask twitchdownloader` or get TwitchDownloaderCLI from
github.com/lay295/TwitchDownloader, then `TwitchDownloaderCLI chatdownload --id <vod_id> -o chat.json`.

## Commands

```bash
clipper campaigns                                   # rates, thresholds, platforms
clipper scan tomo                                   # latest Tomo streams/videos
clipper find "<vod url>" --chat auto                # YouTube: chat replay pulled automatically
clipper find "<twitch vod url>" --chat chat.json    # Twitch: chat from TwitchDownloaderCLI
clipper auto tomo "<vod url>" --top 6 --chat auto --facecam 0.72,0.02,0.26,0.26
clipper cut bobby "<vod url>" --start 3605 --end 3635 --hook "He did NOT see that coming"
clipper log tomo tiktok "https://www.tiktok.com/@you/video/123"
clipper submitted "https://www.tiktok.com/@you/video/123"
clipper stats
clipper payout tomo 30000                           # 30,000 views on tomo: gross $60.00, net $54.00
```

`--facecam x,y,w,h` is the webcam box as fractions of the frame. With it: webcam on top,
gameplay below. Without it: gameplay centered on a blurred fill.

## Optional heavy engine: OpenShorts

github.com/mutonby/openshorts (MIT). Docker, 8GB+ RAM. Adds LLM moment selection, webcam-inset
detection on stream VODs, word-level captions. Use it when the light pipeline is not enough.
Do not use its auto-publish feature for campaign clips (see rules above).

Rejected: FujiwaraChoki/supoclip (noncommercial license, paid clipping is commercial).

## Files
- `campaigns.yaml`: joined and watched campaigns, rates and caps from the live pages
- `docs/campaigns-2026-11-18.md`: research and ranking behind the picks
- `data/tracker.csv`: every clip posted, views, payout
- `CLAUDE.md`: rules for Claude Code sessions

## Kill criteria
After 7 days: if net earnings per hour stay under ~$10 and are not rising, change angle or stop.
