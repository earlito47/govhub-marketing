"""Layer 3: Tomba domain search — fallback emails where the registries had none.

TOMBA_API_KEY holds base64("ta_<key>:ts_<secret>") or the raw colon pair.
Trial plan = 200 domain searches/month, so the CLI budget-caps spending and
quota is checked via /v1/me before any search. Cloudflare blocks the default
python User-Agent — a browser UA is required.
"""
import base64
import os
import re
import time

import requests

import cache

BASE = "https://api.tomba.io/v1"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
PREFERRED = re.compile(
    r"ceo|president|owner|founder|principal|partner|business dev|capture|proposal|market", re.I)
SKIP_DOMAINS = {"facebook.com", "linkedin.com", "twitter.com", "x.com",
                "instagram.com", "youtube.com", "sites.google.com", "sam.gov"}


def creds():
    raw = os.environ.get("TOMBA_API_KEY", "").strip()
    if not raw:
        return None
    cand = raw
    if ":" not in cand:
        try:
            padded = raw + "=" * (-len(raw) % 4)
            cand = base64.b64decode(padded).decode("utf-8", "ignore").strip()
        except Exception:
            return None
    if ":" not in cand:
        return None
    k, _, s = cand.partition(":")
    k, s = k.strip(), s.strip()
    if not (k.startswith("ta_") and s.startswith("ts_")):
        return None
    return k, s


def _headers(kv):
    return {"X-Tomba-Key": kv[0], "X-Tomba-Secret": kv[1],
            "User-Agent": UA, "Accept": "application/json"}


def quota(kv):
    try:
        r = requests.get(f"{BASE}/me", headers=_headers(kv), timeout=30)
    except requests.RequestException as e:
        return {"error": str(e)}
    if r.status_code != 200:
        return {"error": f"HTTP {r.status_code}: {r.text[:150]}"}
    d = r.json().get("data") or {}
    dom = (d.get("requests") or {}).get("domains") or {}
    return {"used": dom.get("used"), "available": dom.get("available"),
            "plan": (d.get("pricing") or {}).get("name") or ""}


def domain_of(url):
    """example: 'https://www.acme.com/about' -> 'acme.com'; social/registry links -> ''"""
    if not url:
        return ""
    d = re.sub(r"^https?://", "", str(url).strip().lower())
    d = d.split("/")[0].split("?")[0].split(":")[0]
    d = re.sub(r"^www\.", "", d).strip(".")
    if "." not in d or d in SKIP_DOMAINS:
        return ""
    return d


def domain_search(domain, kv):
    """One domain-search call (spends quota). Returns best-guess email + metadata."""
    hit = cache.get("tomba", domain)
    if hit is not None:
        return {**hit, "_cached": True}
    try:
        r = requests.get(f"{BASE}/domain-search",
                         params={"domain": domain, "limit": 10},
                         headers=_headers(kv), timeout=30)
    except requests.RequestException as e:
        return {"error": str(e)}
    time.sleep(0.5)
    if r.status_code != 200:
        return {"error": f"HTTP {r.status_code}: {r.text[:150]}"}
    data = (r.json() or {}).get("data") or {}
    org = data.get("organization") or {}
    emails = [e for e in (data.get("emails") or []) if e.get("email")]
    if not emails:
        return cache.put("tomba", domain, {"not_found": True})

    def rank(e):
        pos = str(e.get("position") or "")
        return (0 if PREFERRED.search(pos) else 1, -(e.get("score") or 0))

    best = sorted(emails, key=rank)[0]
    return cache.put("tomba", domain, {
        "found": True,
        "email": best.get("email", ""),
        "email_name": " ".join(x for x in [best.get("first_name"), best.get("last_name")] if x),
        "email_position": best.get("position") or "",
        "email_score": best.get("score"),
        "accept_all": bool(org.get("accept_all")),
        "emails_found": len(emails),
    })
