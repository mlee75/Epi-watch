import numpy as np

from clipper import config, highlights
from clipper.captions import to_srt
from clipper.payout import clip_payout


def camp(**kw):
    base = dict(key="t", name="T", url="", owner="", status="joined", rate_per_1k=2.0,
                min_payout=4.0, max_payout=150.0, budget_total=1000, platforms=["tiktok"],
                streamer="Tomo", hashtags=["#Tomo", "#GTA6"])
    base.update(kw)
    return config.Campaign(**base)


def test_payout_below_min_pays_nothing():
    p = clip_payout(1_999, camp())
    assert p.below_min and p.gross == 0 and p.net == 0


def test_payout_normal_and_fee():
    p = clip_payout(10_000, camp())
    assert p.gross == 20.0 and p.net == 18.0


def test_payout_capped():
    p = clip_payout(1_000_000, camp())
    assert p.capped and p.gross == 150.0 and p.net == 135.0


def test_views_thresholds():
    c = camp()
    assert c.views_to_min == 2_000 and c.views_to_max == 75_000


def test_caption_contains_name_and_tags():
    cap = camp().post_caption("He did NOT see that coming")
    assert "Tomo" in cap and "#GTA6" in cap


def test_campaign_file_loads():
    cs, fee = config.load()
    assert fee == 0.10 and "tomo" in cs and cs["tomo"].allows("Playing GTA 6") and not cs["tomo"].allows("Backrooms")


def test_find_candidates_picks_spikes_and_spacing():
    db = np.full(600, -40.0)
    db[100], db[103], db[400] = -5.0, -6.0, -8.0
    cands = highlights.find_candidates(db, top=5, min_gap=45)
    peaks = [round(c.peak) for c in cands]
    assert any(abs(p - 100) <= 3 for p in peaks) and any(abs(p - 400) <= 2 for p in peaks)
    assert all(c.start >= 0 and c.end <= 600 for c in cands)


def test_edges_ignored():
    db = np.full(300, -40.0)
    db[0] = 0.0
    db[150] = -10.0
    peaks = [round(c.peak) for c in highlights.find_candidates(db, top=3)]
    assert 0 not in peaks and any(abs(p - 150) <= 2 for p in peaks)


def test_chat_boosts_quiet_moment(tmp_path):
    from clipper import chat
    db = np.full(400, -40.0)
    db[100] = -20.0          # loud but chat silent
    f = tmp_path / "c.json"  # Twitch export shape: chat explodes at ~304s
    f.write_text('{"comments": [' + ",".join(
        f'{{"content_offset_seconds": {304 + i * 0.05}}}' for i in range(80)) + "]}")
    counts = chat.per_second(chat.offsets(f), len(db))
    top = highlights.find_candidates(db, top=1, chat=counts, chat_weight=2.0)
    assert abs(top[0].peak - 300) <= 4


def test_youtube_chat_lines(tmp_path):
    from clipper import chat
    f = tmp_path / "x.live_chat.json"
    f.write_text('{"replayChatItemAction": {"videoOffsetTimeMsec": "1500"}}\nnot json\n'
                 '{"replayChatItemAction": {"videoOffsetTimeMsec": "62000"}}\n')
    assert chat.offsets(f) == [1.5, 62.0]


def test_srt_groups_words():
    srt = to_srt([(0.0, 0.4, "no"), (0.4, 0.8, "way"), (0.8, 1.2, "bro"), (1.2, 1.6, "what")])
    assert "NO WAY BRO" in srt and "WHAT" in srt


def _fake_page(obj):
    import json
    payload = json.dumps({"state": {"data": obj}})
    return '<script>self.__next_f.push([1,' + json.dumps(payload) + '])</script>'


def test_import_campaign(tmp_path):
    import shutil
    from clipper.campaign_import import import_campaign
    cid = "df6de26f-86ec-4782-b818-1fc8053b99a4"
    obj = {"id": cid, "name": "Test Streamer GTA VI", "description": "Clips from https://www.youtube.com/@test now",
           "organization": {"name": "Agency"}, "status": "active",
           "metrics": {"budgetSpentCents": 5000, "creatorCount": 3},
           "configuration": {"budget": 100000, "payoutModel": [
               {"platform": "tiktok", "rate": 150, "minPayout": 300, "maxPayout": 10000},
               {"platform": "twitter", "rate": 150, "minPayout": 300, "maxPayout": 10000}]}}
    key, e = import_campaign(f"https://contentrewards.com/c/campaigns/{cid}", "t1", html=_fake_page(obj), folder=tmp_path)
    assert e["rate_per_1k"] == 1.5 and e["min_payout"] == 3 and e["max_payout"] == 100
    assert e["platforms"] == ["tiktok", "x"] and e["sources"] == ["https://www.youtube.com/@test"]
    assert e["live"]["clippers"] == 3
    cs, _ = config.load(tmp_path)
    assert cs["t1"].budget_total == 1000
    # re-import keeps hand-filled fields
    raw = config.read_raw("t1", tmp_path); raw["streamer"] = "Test"; raw["status"] = "joined"
    config.save_raw("t1", raw, tmp_path)
    _, e2 = import_campaign(f"https://contentrewards.com/c/campaigns/{cid}", "t1", html=_fake_page(obj), folder=tmp_path)
    assert e2["streamer"] == "Test" and e2["status"] == "joined"


def test_review_move(tmp_path, monkeypatch):
    from clipper import review_app
    monkeypatch.setattr(config, "OUT", tmp_path)
    d = tmp_path / "review" / "tomo"; d.mkdir(parents=True)
    (d / "a.mp4").write_bytes(b"x"); (d / "a.txt").write_text("Caption:\nhi #Tomo\n\nBefore posting")
    clips = review_app.list_clips()
    assert clips[0]["caption"] == "hi #Tomo"
    review_app.move_clip("tomo", "a.mp4", "kept")
    assert (tmp_path / "kept" / "tomo" / "a.mp4").exists() and (tmp_path / "kept" / "tomo" / "a.txt").exists()


def test_settings_override():
    c = camp(clip={"top": 2})
    o = c.opts("clip")
    assert o["top"] == 2 and o["pre"] == 20


def test_caption_without_streamer():
    assert camp(streamer="", hashtags=["#x"]).post_caption() == "T #x"


def test_wrap_keeps_lines_short():
    from clipper.render import wrap
    out = wrap("FOLLOW BOBBY VANRIPER ON TWITCH", 18)
    assert all(len(l) <= 18 for l in out.split("\n")) and out.count("\n") == 1


def test_send_to_phone(tmp_path, monkeypatch):
    phone = tmp_path / "cloud" / "Clips"; phone.parent.mkdir()
    monkeypatch.setattr(config, "phone_dir", lambda: phone)
    clip = tmp_path / "a.mp4"; clip.write_bytes(b"x")
    clip.with_suffix(".txt").write_text("Source: s\n\nCaption:\nNo way #Tomo\n\nBefore posting")
    out = config.send_to_phone(clip, "tomo")
    assert out.exists() and (phone / "tomo" / "a_caption.txt").read_text() == "No way #Tomo\n"


def test_hype_score_counts_laughs_and_hype():
    from clipper.moments import hype_score
    s, found = hype_score("NO WAY bro hahaha what was that!!")
    s0, _ = hype_score("so we drive to the store now")
    assert s > s0 and "laughing" in found and "no way" in found


def test_heat_boosts_replayed_moment():
    from clipper.moments import heat_per_second
    rng = np.random.default_rng(0)
    db = -40.0 + rng.normal(0, 2, 600); db[100] = -34.0
    heat = heat_per_second([{"start_time": 395, "end_time": 405, "value": 1.0}], 600)
    top = highlights.find_candidates(db, top=1, heat=heat)
    assert abs(top[0].peak - 400) <= 6


def test_reframe_follows_action():
    from clipper import reframe
    sal = np.zeros((40, 320))
    for i in range(40):
        x = 20 + i * 7
        sal[i, x:x + 10] = 100.0
    raw = reframe.best_centres(sal, 0.32)
    path = reframe.smooth_path(raw, 0.32)
    assert path[0] < 0.3 and path[-1] > 0.7
    assert all(0.16 <= p <= 0.84 for p in path)


def test_shortlist_with_fake_transcriber(tmp_path, monkeypatch):
    import subprocess
    from types import SimpleNamespace
    from clipper import moments
    wav = tmp_path / "a.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                    "sine=frequency=300:duration=200", "-af", "volume='if(between(t,100,103),1,0.02)':eval=frame",
                    str(wav)], check=True)
    W = lambda s, e, w: SimpleNamespace(start=s, end=e, word=w)
    fake = SimpleNamespace(transcribe=lambda *a, **k: ([SimpleNamespace(words=[W(0, .5, "NO"), W(.5, 1, "WAY"), W(1, 1.5, "hahaha")])], None))
    monkeypatch.setitem(__import__("sys").modules, "faster_whisper", SimpleNamespace(WhisperModel=lambda *a, **k: fake))
    items = moments.shortlist(wav, n=2)
    assert items and items[0]["hype"] > 0 and "laughing" in items[0]["hype_words"]
    assert any(abs(i["peak"] - 101) < 5 for i in items)
