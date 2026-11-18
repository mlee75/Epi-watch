"""Local review app: watch clips, copy captions, keep or reject, log posts, see earnings.

Runs on http://127.0.0.1:8765 with the Python standard library only.
Folders: out/review/<campaign>/ -> out/kept/<campaign>/ or out/rejected/<campaign>/
"""
from __future__ import annotations

import json
import mimetypes
import shutil
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from . import config, tracker

STATES = ("review", "kept", "rejected")
HTML = (Path(__file__).parent / "review.html")


def _clip_dir(state: str, campaign: str) -> Path:
    return config.OUT / state / campaign


def list_clips() -> list[dict]:
    campaigns, _ = config.load()
    posted = {r.get("clip_file") for r in tracker.rows()}
    out = []
    for state in STATES:
        base = config.OUT / state
        if not base.exists():
            continue
        for mp4 in sorted(base.glob("*/*.mp4"), reverse=True):
            key = mp4.parent.name
            c = campaigns.get(key)
            note = mp4.with_suffix(".txt")
            text = note.read_text() if note.exists() else ""
            caption = text.split("Caption:\n", 1)[1].split("\n\n", 1)[0] if "Caption:\n" in text else ""
            out.append({
                "state": state, "campaign": key, "file": mp4.name,
                "campaign_name": c.name if c else key,
                "campaign_url": c.url if c else "",
                "platforms": c.platforms if c else [],
                "caption": caption, "note": text,
                "posted": mp4.name in posted,
            })
    return out


def move_clip(campaign: str, file: str, to: str) -> None:
    if to not in STATES:
        raise ValueError("bad state")
    for state in STATES:
        src = _clip_dir(state, campaign) / file
        if src.exists():
            dst_dir = _clip_dir(to, campaign)
            dst_dir.mkdir(parents=True, exist_ok=True)
            for p in (src, src.with_suffix(".txt")):
                if p.exists():
                    shutil.move(str(p), dst_dir / p.name)
            return
    raise FileNotFoundError(file)


def _safe(campaign: str, file: str) -> bool:
    return "/" not in campaign and "/" not in file and ".." not in campaign + file


def stats() -> dict:
    rows = tracker.refresh(None)
    total = sum(float(r.get("net_usd") or 0) for r in rows)
    return {"rows": rows, "total_net": round(total, 2),
            "unsubmitted": sum(1 for r in rows if r.get("submitted") != "yes")}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet
        pass

    def _json(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/":
            body = HTML.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/api/clips":
            self._json(list_clips())
        elif path == "/api/stats":
            self._json(stats())
        elif path.startswith("/media/"):
            parts = path.split("/")
            if len(parts) != 5 or parts[2] not in STATES or not _safe(parts[3], parts[4]):
                return self._json({"error": "bad path"}, 400)
            self._file(_clip_dir(parts[2], parts[3]) / parts[4])
        else:
            self._json({"error": "not found"}, 404)

    def _file(self, p: Path):
        if not p.exists():
            return self._json({"error": "missing"}, 404)
        size = p.stat().st_size
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        if rng and rng.startswith("bytes="):
            a, _, b = rng[6:].partition("-")
            start = int(a) if a else 0
            end = int(b) if b else size - 1
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(p.name)[0] or "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with p.open("rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                left -= len(chunk)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            b = self._body()
            if path == "/api/move":
                if not _safe(b["campaign"], b["file"]):
                    raise ValueError("bad path")
                move_clip(b["campaign"], b["file"], b["to"])
                return self._json({"ok": True})
            if path == "/api/posted":
                r = tracker.log(b["campaign"], b["platform"], b["post_url"].strip(), b.get("file", ""))
                c, _ = config.get(b["campaign"])
                return self._json({"ok": True, "row": r, "submit_url": c.url})
            if path == "/api/submitted":
                return self._json({"ok": tracker.mark_submitted(b["post_url"])})
            if path == "/api/refresh":
                from .sources import view_count
                tracker.refresh(view_count)
                return self._json(stats())
            self._json({"error": "not found"}, 404)
        except SystemExit as e:
            self._json({"error": str(e)}, 400)
        except Exception as e:  # show errors in the UI instead of crashing
            self._json({"error": f"{type(e).__name__}: {e}"}, 400)


def serve(port: int = 8765, open_browser: bool = True) -> None:
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}"
    print(f"Review app running at {url}  (Ctrl+C to stop)")
    if open_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
