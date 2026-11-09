#!/usr/bin/env python3
"""Loescht Papierkorb-Eintraege (trashedAt aelter als 7 Tage) aus content/site.json samt media/videos/<id>/."""
import datetime, json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAYS = 7
sj = os.path.join(ROOT, "content", "site.json")
site = json.load(open(sj, encoding="utf-8"))
now = datetime.datetime.now(datetime.timezone.utc)

def old(ts):
    if not ts: return False
    try:
        d = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return False
    if d.tzinfo is None: d = d.replace(tzinfo=datetime.timezone.utc)
    return (now - d) > datetime.timedelta(days=DAYS)

changed = False
for key in ("videos", "texts"):
    keep = []
    for it in site.get(key, []):
        if old(it.get("trashedAt")):
            changed = True
            if key == "videos" and it.get("id"):
                p = os.path.join(ROOT, "media", "videos", it["id"])
                if os.path.realpath(p).startswith(os.path.join(ROOT, "media", "videos") + os.sep) and os.path.isdir(p):
                    shutil.rmtree(p); print("geloescht:", p)
            print("entfernt:", key, it.get("id"))
        else:
            keep.append(it)
    site[key] = keep
if changed:
    with open(sj, "w", encoding="utf-8") as f:
        json.dump(site, f, ensure_ascii=False, indent=2); f.write("\n")
else:
    print("nichts zu loeschen")
