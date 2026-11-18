---
description: Clip every new stream for every joined campaign, then open the review app
argument-hint: [campaign ...] [--vods N]
---
Request: $ARGUMENTS

1. Run `.venv/bin/clipper run --dry-run $ARGUMENTS` and show Matthias which VODs it would clip (one line each).
2. For any joined campaign without a `facecam` value, find it once: `clipper frame <VOD link> --at 900`, look at the PNG, and save the box as `facecam: "x,y,w,h"` in `campaigns/<key>.yaml`. Use "" if there is no webcam.
3. Run `.venv/bin/clipper run $ARGUMENTS`. This can take several minutes per VOD.
4. Spot-check two rendered clips by looking at one frame each. Fix the crop and re-render if wrong.
5. Write a hook (max 7 words) on the caption line of each clip's `.txt`, keeping the creator name and hashtags.
6. Move clips that look like story cutscenes or endings to `out/rejected/<campaign>/`.
7. Start `clipper review` in the background and report: clips waiting per campaign, and any campaign that failed and why.

Every rendered clip and a `_caption.txt` file are also copied to iCloud Drive > Clips > <campaign> (`phone_folder` in settings.yaml), so Matthias can pick them up in the Files app on his iPhone and post from the phone. Tell him how many landed there.
