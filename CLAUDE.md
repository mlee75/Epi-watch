# clip-engine: instructions for Claude Code

Matthias earns from paid clipping campaigns (Content Rewards, on Whop). This repo turns any
campaign into a pipeline: import the campaign, watch its creators' channels, find the best
moments, render 9:16 shorts, review them in a local app, track posts and payouts.
It is not tied to one game or creator. The GTA 6 campaigns are just the first ones.

## How Matthias uses this repo
He does not use the terminal. He opens this folder in Claude Code and asks in plain words.
Map requests to the slash commands in `.claude/commands/`:
- "set it up" / something broken -> `/setup`
- a Content Rewards link -> `/add-campaign <link>`
- "clip everything new" / "do today's batch" -> `/run`
- "clip Tomo" / "clip this stream <link>" -> `/clip <campaign> [link]`
- "show me the clips" -> `/review` (local app at http://127.0.0.1:8765)
- "how much did I make" -> `/stats`
Run the CLI as `.venv/bin/clipper ...`. Do the work yourself, then report in a few short lines.
Media downloads only work on his Mac (YouTube blocks cloud IPs). If YouTube asks to sign in,
set `cookies_from_browser: chrome` in `settings.yaml`.

## Layout
- `campaigns/<key>.yaml`: one file per campaign. Fields: rates, caps, platforms, `status`, `streamer`,
  `hashtags`, `sources`, `title_filter`, `since`, `facecam`, `notes`, and optional `clip` / `render` /
  `captions` overrides of `settings.yaml`.
- `settings.yaml`: global defaults (fee, clip length, clips per VOD, captions).
- `clipper/`: the engine. `cli.py` commands, `highlights.py` audio + chat moment finder, `render.py`
  ffmpeg 9:16 renderer, `campaign_import.py` Content Rewards page parser, `review_app.py` + `review.html`.
- `data/tracker.csv`: single record of posted clips. `data/processed.json`: VODs already clipped.
- `out/review|kept|rejected/<campaign>/`: rendered clips and their caption files.

## Hard rules (campaigns ban accounts for these, one strike)
- Never auto-post to TikTok, Instagram, YouTube or X. Clips go to `out/review/`. Matthias posts.
- Never buy, bot, loop or inflate views. Never repost the same clip, never collab-post.
- No AI-generated video. Auto-cutting and captioning real stream footage is fine.
- No story cutscenes, endings or spoilers (publishers take them down). Prefer reactions and gameplay chaos.
- No logos or other accounts' watermarks on clips.
- The creator named in the campaign must be the main focus of every clip.
- Only clip campaigns with `status: joined`, and only footage the brief allows (`title_filter`, `since`, `notes`).
- Caption must contain the creator's name and the campaign hashtags (`Campaign.post_caption`).

## Account and money rules
- Never sign in, join a campaign, accept terms, connect a social account or withdraw money without asking Matthias first.
- Never send messages, DMs or Discord posts in his name without showing the draft first.

## Working here
- Python 3.10+, ffmpeg required. `bash setup.sh`, then `.venv/bin/pytest -q`.
- Refresh a campaign's live numbers with `clipper add <url> --key <key>`. It keeps hand-filled fields.
- Re-verify rates and rules on the live page, never from memory.
- Writing style for anything he will read: short sentences, active voice, no em dashes.
