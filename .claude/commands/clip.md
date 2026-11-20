---
description: Find the funniest, most viral moments of a stream and render shorts for Matthias to post
argument-hint: <campaign> [VOD link] [number of clips]
---
Request: $ARGUMENTS

Run every command with `.venv/bin/clipper`. If `.venv` is missing, run `/setup` first.

1. Check `campaigns/<campaign>.yaml`: `status: joined`, and `live.status` is not paused. If paused or ended, stop and say so.
2. Pick the source:
   - A link was given: use it.
   - Otherwise `clipper scan <campaign>` and take the newest finished, on-topic VOD that is not marked `(done)`. If the only new one is LIVE, say so.
3. Shortlist: `clipper moments <campaign> <link> --top 20`. It ranks moments by audio spikes, chat spikes and YouTube "Most replayed", and transcribes each one. Read the saved JSON in `data/moments/`.
4. Pick the best 4 to 6 yourself, like a viral clip editor:
   - Prefer: big reactions, laughing fits, chaos, fails, rage, first reactions to something new, a clear setup and punchline.
   - Skip: quiet talking, menus, loading screens, ads, sponsor reads, story cutscenes or endings, anything that needs more than a few seconds of context, anything that shows the creator in a negative light.
   - Set tight bounds from the word timestamps: start 1 to 3 seconds before the setup line, end right after the payoff or laugh. 15 to 45 seconds total. Never start mid-sentence.
   - Write a hook for each (max 7 words, what the viewer is about to see, no lies).
5. Facecam: use `facecam` from the campaign file. If it is empty, run `clipper frame <link> --at <a picked start>`, look at the PNG, and save the webcam box as `facecam: "x,y,w,h"` (fractions, small margin) in the campaign file. No webcam: `facecam: ""`.
6. Render each pick: `clipper cut <campaign> <link> --start S --end E --hook "..." --tag pick`. Layout `smart` follows the action in a 9:16 crop. Captions, handle and call to action come from the campaign file.
7. Check every clip: extract frames at 2 s, the middle and 2 s before the end (`ffmpeg -ss T -i clip.mp4 -frames:v 1 /tmp/f.png`) and look at them. The main action and the creator must be in frame, captions readable, nothing cut off. If the crop misses the action, re-render that clip with `--layout blur`, or adjust bounds.
8. Mark the VOD done so `/run` skips it: add its id to `data/processed.json` under the campaign.
9. Report to Matthias in a few lines: how many clips, one line per clip (time in the VOD, hook, why it should hit). Clips and captions are already in iCloud Drive > Clips > <campaign> on his phone.

Never post anything. Posting is his job.
