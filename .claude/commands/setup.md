---
description: Install or repair the clipper on this Mac
---
Run `bash setup.sh` from the repo root. It installs ffmpeg if missing, creates `.venv`, installs the package and runs `clipper doctor`.

If a step fails, read the error, fix the cause (missing Homebrew, old Python, network), and run it again. Report the doctor output to Matthias in two or three lines. Do not ask him to type commands unless something needs his password.
