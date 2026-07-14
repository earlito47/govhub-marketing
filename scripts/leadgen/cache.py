"""Tiny JSON file cache so rate-limited enrichment can resume for free.

Layout: scripts/leadgen/.cache/<source>/<key>.json
Negative results are cached too ({"not_found": true}) — a rerun after a quota
stop or crash skips everything already answered.
"""
import hashlib
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent / ".cache"


def _path(source: str, key: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", str(key))[:120]
    if not safe:
        safe = hashlib.sha1(str(key).encode()).hexdigest()[:16]
    d = BASE / source
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{safe}.json"


def get(source: str, key: str):
    p = _path(source, key)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return None
    return None


def put(source: str, key: str, obj):
    _path(source, key).write_text(json.dumps(obj, ensure_ascii=False))
    return obj
