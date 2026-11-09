#!/usr/bin/env python3
"""Neues Hintergrundvideo anlegen: Varianten per ffmpeg erzeugen + Eintrag (deaktiviert) in content/site.json.

Aufruf:
  tools/add_video.py <id> "<Name>" <master-oder-1080.mp4> [--4k datei.mp4] [--mobile-crop-x 50] [--enabled] [--force]

  <id>              z. B. v4-sanddaemmerung  (nur a-z 0-9 -)  -> media/videos/<id>/
  master            Quelle (ideal >= 1080p; bei >= 3840 Breite wird daraus auch das 4K-Video erzeugt)
  --4k              separate 4K-Quelle (sonst: master, falls >= 3840 breit; sonst entfaellt 4k.mp4)
  --mobile-crop-x   horizontale Lage des Hochkant-Ausschnitts in Prozent (0 = links, 50 = Mitte, 100 = rechts)
Erzeugt: 1080.mp4 (H.264 faststart), 1080.webm (VP9), 4k.mp4 (HEVC hvc1), mobile.mp4 (1080x1920 Crop),
         poster.jpg, poster-mobile.jpg (erstes Bild, passend zum Loop-Start)
"""
import argparse, datetime, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = os.environ.get("FFMPEG", "/Users/julian/homebrew/bin/ffmpeg")
FP = os.environ.get("FFPROBE", os.path.join(os.path.dirname(FF), "ffprobe"))
FILES = ["1080.mp4", "1080.webm", "4k.mp4", "mobile.mp4", "poster.jpg", "poster-mobile.jpg"]

def run(args):
    print("+", " ".join(args[:6]), "...", flush=True)
    subprocess.run(args, check=True)

def probe(path):
    o = subprocess.check_output([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path], text=True).strip()
    w, h = o.split(",")[:2]
    return int(w), int(h)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("id"); ap.add_argument("name"); ap.add_argument("master")
    ap.add_argument("--4k", dest="k4"); ap.add_argument("--mobile-crop-x", type=float, default=50.0)
    ap.add_argument("--enabled", action="store_true"); ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", a.id): sys.exit("id: nur a-z, 0-9, -")
    out = os.path.join(ROOT, "media", "videos", a.id)
    sj = os.path.join(ROOT, "content", "site.json")
    site = json.load(open(sj, encoding="utf-8"))
    if any(v["id"] == a.id for v in site["videos"]) and not a.force: sys.exit("id existiert bereits (--force zum Ueberschreiben)")
    os.makedirs(out, exist_ok=True)
    src = a.master; w, h = probe(src)
    k4src = a.k4 or (src if w >= 3840 else None)
    base = ["-y", "-hide_banner", "-loglevel", "error", "-i", src, "-an"]
    vf = "scale=1920:1080:flags=lanczos,format=yuv420p"
    run([FF] + base + ["-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "6M", "-bufsize", "12M", "-movflags", "+faststart", os.path.join(out, "1080.mp4")])
    run([FF] + base + ["-vf", vf, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", os.path.join(out, "1080.webm")])
    if k4src:
        run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", k4src, "-an", "-vf", "scale=3840:2160:flags=lanczos,format=yuv420p", "-c:v", "libx265", "-preset", "medium", "-crf", "24", "-tag:v", "hvc1", "-movflags", "+faststart", os.path.join(out, "4k.mp4")])
    cx = max(0.0, min(100.0, a.mobile_crop_x)) / 100.0
    # auf Hoehe 1920 skalieren, dann 1080 breit ausschneiden; x = Anteil des Ueberstands
    mvf = "scale=-2:1920:flags=lanczos,crop=1080:1920:(iw-1080)*%.4f:0,format=yuv420p" % cx
    run([FF] + base + ["-vf", mvf, "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-maxrate", "3M", "-bufsize", "6M", "-movflags", "+faststart", os.path.join(out, "mobile.mp4")])
    run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-frames:v", "1", "-vf", "scale=1920:1080:flags=lanczos", "-q:v", "3", os.path.join(out, "poster.jpg")])
    run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-frames:v", "1", "-vf", mvf.replace(",format=yuv420p", ""), "-q:v", "3", os.path.join(out, "poster-mobile.jpg")])
    files = {f: os.path.getsize(os.path.join(out, f)) for f in FILES if os.path.exists(os.path.join(out, f))}
    for f, s in files.items():
        if s > 95 * 1024 * 1024: print("WARNUNG: %s hat %.0f MB (GitHub-Limit 100 MB)" % (f, s / 1048576))
    entry = {"id": a.id, "name": a.name, "created": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S"), "enabled": a.enabled, "trashedAt": None, "files": files}
    site["videos"] = [v for v in site["videos"] if v["id"] != a.id] + [entry]
    with open(sj, "w", encoding="utf-8") as f:
        json.dump(site, f, ensure_ascii=False, indent=2); f.write("\n")
    print("OK: %s  (%d Dateien, %.1f MB) – Eintrag %s" % (out, len(files), sum(files.values()) / 1048576, "aktiv" if a.enabled else "deaktiviert"))

main()
