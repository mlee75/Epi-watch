---
description: Refresh view counts and report earnings
---
Run `.venv/bin/clipper stats`. Report in five lines max: estimated net earnings, best clip (views and payout), posts not yet submitted in Content Rewards, clips close to the max payout cap, and one concrete suggestion (which streamer or clip style to do more of).

Also re-check each joined campaign's budget left: `clipper add <campaign url> --key <key>` refreshes rates and budget from the live page. Warn if a campaign is above 80% spent.
