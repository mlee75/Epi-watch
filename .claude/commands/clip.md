---
description: Find the best moments of a stream and render shorts into the review app
argument-hint: <campaign> [VOD link] [number of clips]
---
Request: $ARGUMENTS

Run every command with `.venv/bin/clipper`. If `.venv` is missing, run `/setup` steps first.

1. Check the campaign in `campaigns/<key>.yaml` has `status: joined`. If not, stop and say so.
2. Pick the source:
   - If a link was given, use it.
   - Otherwise run `clipper scan <campaign>` and pick the newest finished stream or video that the brief allows (for GTA campaigns: GTA VI content only). If the newest one is still live, say so and offer the previous one, or wait until it ends.
3. Facecam: if the campaign file already has `facecam`, use it. Otherwise run `clipper frame <link> --at 900`, look at the PNG, write the webcam box as fractions `x,y,w,h` (left, top, width, height) with a small margin, and save it as `facecam:` in `campaigns/<key>.yaml` so future runs reuse it. No webcam: set `facecam: ""`.
4. Run `clipper auto <campaign> <link> --top <N, default 6> --chat auto`. For Twitch VODs, ask Matthias for a TwitchDownloaderCLI chat export or run without `--chat`.
5. Spot-check: grab one frame from two of the rendered clips (`ffmpeg -ss 3 -i <clip> -frames:v 1 /tmp/check.png`) and look at them. Fix the facecam box and re-render if the crop is wrong.
6. For each clip, write a hook (max 7 words, first-person streamer energy, no clickbait lies) into the `.txt` caption line, keeping the streamer name and hashtags.
7. Flag any clip that looks like a story cutscene or mission ending and move it to `out/rejected/<campaign>/`.
8. Start the review app in the background: `clipper review` (it opens http://127.0.0.1:8765). Tell Matthias how many clips are waiting.

Never post anything. Posting is his job.

Every rendered clip and a `_caption.txt` file are also copied to iCloud Drive > Clips > <campaign> (`phone_folder` in settings.yaml), so Matthias can pick them up in the Files app on his iPhone and post from the phone. Tell him how many landed there.
