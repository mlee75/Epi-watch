# gta6-clipper: instructions for Claude Code

Matthias runs paid clipping campaigns on Content Rewards (contentrewards.com, on Whop).
This repo finds highlight moments in streamer VODs, renders 9:16 shorts, and tracks
posts and payouts. Read `README.md` for the pipeline and `campaigns.yaml` for live campaigns.

## Hard rules (campaigns ban accounts for these, one strike)
- Never auto-post to TikTok, Instagram, YouTube or X. Clips go to `out/review/`. Matthias posts.
- Never buy, bot, loop or inflate views. Never repost the same clip, never collab-post.
- No AI-generated video. Auto-cutting and captioning real stream footage is fine.
- No story cutscenes, mission endings or plot reveals (Rockstar takedowns). Prefer free-roam chaos and reactions.
- No logos or other accounts' watermarks on clips.
- The streamer named in the campaign must be the main focus of every clip.
- Only clip streamers with an active campaign in `campaigns.yaml` (status `joined`).
- Caption must contain the streamer's name and the campaign hashtags (`Campaign.post_caption`).

## Account and money rules
- Never sign in, join a campaign, accept terms, connect a social account or withdraw money without asking Matthias first.
- Never send messages, DMs or Discord posts in his name without showing the draft first.

## Working here
- Python 3.10+, ffmpeg required. `pip install -e '.[dev]'`, then `pytest -q`.
- Update `campaigns.yaml` when a campaign's rate, cap or budget changes. Re-verify on the live page, never from memory.
- Keep `data/tracker.csv` the single record of posted clips.
- Writing style for anything he will read: short sentences, active voice, no em dashes.
