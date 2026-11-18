---
description: Add any Content Rewards campaign from its link
argument-hint: <campaign link> [short-name]
---
Campaign to add: $ARGUMENTS

1. Run `.venv/bin/clipper add <link> --key <short-name>` (pick a short lowercase name like `tomo` if none was given).
2. Open the campaign page. If a browser tool is available and Matthias is signed in, read the brief, rules and reference materials. Otherwise ask him to paste the brief.
3. Edit the new entry in `campaigns/<key>.yaml`: set `streamer` (the person who must be the main focus), `hashtags` (required caption tags), `sources` (channels or VOD links the brief allows), and put hard rules in `notes` (allowed dates or timestamps, audience rules, minimum views, account rules).
4. Give Matthias a short verdict: net rate after the 10% fee, views needed for the min and max payout, budget left, number of clippers, red flags (upfront fees, pool campaigns with high view minimums, crypto payment, story-spoiler footage). Recommend join, watch or skip.
5. Do not join the campaign, accept terms or connect accounts. Ask him first. Set `status: joined` only after he confirms he joined.
