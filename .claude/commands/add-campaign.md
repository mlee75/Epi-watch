---
description: Add any Content Rewards campaign from its link
argument-hint: <campaign link> [short-name]
---
Campaign to add: $ARGUMENTS

1. Run `.venv/bin/clipper add <link> --key <short-name>` (pick a short lowercase name like `tomo` if none was given).
2. Open the campaign page. If a browser tool is available and Matthias is signed in, read the brief, rules and reference materials. Otherwise ask him to paste the brief.
3. Read the full rules page too (often a Notion link in the brief) and save it as `rules_url`. Then edit `campaigns/<key>.yaml`:
   - `streamer`: who must be the main focus
   - `hashtags`: required tags first, then a few discovery tags
   - `handle`: the on-screen handle the brief asks for (e.g. `@Tomovids`, `twitch.tv/name`)
   - `cta` (short, CAPS, on screen) and `caption_cta` (sentence for the post caption)
   - `sources`: channels the brief allows (YouTube `/streams` + `/videos`, Twitch `/clips?filter=clips&range=7d` + `/videos?filter=archives`, Kick)
   - `title_filter` and `since`: only footage the brief allows
   - `captions: {enabled: true}` if captions must be readable without sound
   - `notes`: every hard rule (audience country %, analytics proof, min views, warm-up, submit deadline, Discord needed for payout)
   If the card and the rules page disagree, follow the stricter one and tell Matthias.
4. Give Matthias a short verdict: net rate after the 10% fee, views needed for the min and max payout, budget left, number of clippers, red flags (upfront fees, pool campaigns with high view minimums, crypto payment, story-spoiler footage). Recommend join, watch or skip.
5. Do not join the campaign, accept terms or connect accounts. Ask him first. Set `status: joined` only after he confirms he joined.
