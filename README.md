# clip-engine

Turn any paid clipping campaign into a semi-automated pipeline.
Paste a Content Rewards campaign link, and clip-engine imports the rates and rules, watches the
creators' channels, finds the best moments, renders 9:16 shorts and tracks what you earn.
You stay in control of posting.

## Using it (no terminal)

1. Open this folder in Claude Code.
2. Type `/setup` once.
3. Then ask in plain words, or use the commands:

| Command | What it does |
|---|---|
| `/add-campaign <link>` | Imports rate, min/max payout, budget, platforms and source channels from any Content Rewards campaign, reads the brief, gives a join/watch/skip verdict |
| `/run` | Clips every new, finished, on-topic stream for every joined campaign |
| `/clip <campaign> [link]` | Clips one specific stream |
| `/review` | Opens the review app: watch, copy caption, keep or reject, download, log the post link |
| `/stats` | Views, estimated earnings, unsubmitted posts, budgets running low |

## How it works

```
campaign link -> campaigns/<key>.yaml (rates, caps, rules, sources)
sources       -> newest finished VODs, filtered by title_filter and since date, skipping ones already clipped
find          -> audio loudness spikes + chat velocity spikes (YouTube chat replay, Twitch chat export)
render        -> only the needed segment is downloaded, 1080x1920, facecam on top or blurred fill,
                 hook text, optional word-by-word captions (faster-whisper)
review app    -> out/review -> keep / reject -> post by hand -> log link -> submit in Content Rewards
stats         -> public view counts, payout after min, max and the 10% creator fee
```

Posting stays manual on purpose. Campaigns ban accounts for botting and reposting.

## Adding a campaign by hand

`campaigns/<key>.yaml`:

```yaml
name: Example Streamer Clipping
url: https://contentrewards.com/c/campaigns/<id>
status: joined
rate_per_1k: 1.5
min_payout: 3
max_payout: 100
platforms: [tiktok, youtube]
streamer: Example
hashtags: ["#Example"]
sources: [https://www.youtube.com/@example/streams]
title_filter: [GTA]          # optional: VOD title must contain one of these
since: "2026-11-18"          # optional: ignore older VODs
facecam: "0.72,0.02,0.26,0.26"   # optional: webcam box, x,y,w,h as fractions
clip: {top: 4, pre: 15}      # optional: override settings.yaml
```

## CLI (what Claude Code runs for you)

```bash
clipper doctor | campaigns | add <url> | scan <c> | run [c...] [--dry-run] | auto <c> <link>
clipper cut <c> <link> --start S --end E --hook "..." | frame <link> --at S | review | stats | payout <c> <views>
```

## Setup

`bash setup.sh` (installs ffmpeg with Homebrew if missing, creates `.venv`, installs, runs `clipper doctor`).
Optional captions: `.venv/bin/pip install -e '.[captions]'` and set `captions.enabled: true` in `settings.yaml`.
Optional Twitch chat: TwitchDownloaderCLI (github.com/lay295/TwitchDownloader), `chatdownload --id <vod> -o chat.json`.

## Optional heavy engine

OpenShorts (github.com/mutonby/openshorts, MIT): Docker, 8GB+ RAM, LLM moment selection and webcam
detection. Not needed for normal use. Do not use its auto-publish for campaign clips.

## Examples

`docs/examples/` has the GTA 6 launch-week research: campaign ranking and strategy.
