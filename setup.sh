#!/usr/bin/env bash
# One-time setup on a Mac. Claude Code runs this for you via /setup.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    HOMEBREW_NO_AUTO_UPDATE=1 brew install ffmpeg
  else
    echo "ffmpeg missing and Homebrew not found. Install Homebrew from https://brew.sh first." >&2
    exit 1
  fi
fi

[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -e '.[dev,captions]'   # captions: both current briefs require them
pip install -q --upgrade yt-dlp   # YouTube changes often, newest yt-dlp matters
clipper doctor
