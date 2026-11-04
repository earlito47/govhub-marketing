"""Fresh-audience puller: the recipe that built public.prospect_pool, rebuilt.

  1. USASpending recipients (spending_by_category/recipient): small businesses
     with a contract award in the last N months, per 2-digit NAICS sector.
     That endpoint ignores the award_amount filter, so the 12-month total is
     banded client-side (default $50K-$5M, the same ceiling the angle
     audience used).
  2. Drop every UEI / email / company domain already in prospect_pool,
     outreach.companies or the Instantly workspace (--exclude, built
     separately: {"ueis": [...], "emails": [...], "domains": [...]}).
  3. SBA certification-search profile per UEI (keyless, undocumented,
     ~2 req/s) -> email, contact person, primary NAICS, state, certs.
  4. Write one row per deliverable-looking contact, best prospects first.

MillionVerifier is NOT run here: verification spends paid credits, so it is
a separate, deliberate step on the CSV this writes.

Every HTTP answer is cached under .cache/ (see cache.py), so a rerun after a
crash or a stop resumes without repeating a single request.

  python pull_universe.py --exclude exclude.json -o out/universe.csv
  python pull_universe.py --exclude exclude.json --recipients-only   # stage 1 only
"""
import argparse
import csv
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import requests

import cache

RECIP = "https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/"
SBA = "https://search.certifications.sba.gov/_api/v2/profile/{uei}"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# Positive replies so far came from owner-operated trades and services firms
# (roofing, septic, mechanical, electrical, excavation, shredding, IT/legal
# services). Weight sectors by that, manufacturing (33) and wholesale (42)
# deliberately left out: parts RFQs are a poor fit for a proposal product.
SECTOR_WEIGHT = {"23": 3, "56": 3, "81": 2, "54": 2, "62": 1, "61": 1}

FREE_MAIL = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com",
    "msn.com", "live.com", "comcast.net", "att.net", "sbcglobal.net", "verizon.net",
    "me.com", "mac.com", "protonmail.com", "proton.me", "ymail.com", "bellsouth.net",
    "cox.net", "charter.net", "earthlink.net", "frontier.com", "windstream.net",
    "gmx.com", "zoho.com", "mail.com", "rocketmail.com", "juno.com", "optonline.net",
}
ROLE_LOCAL = re.compile(r"^(no-?reply|donotreply|postmaster|abuse|webmaster)@")
SET_ASIDES = {"8A", "8A_JV", "WOSB", "EDWOSB", "HZ", "SDVOSB", "SDVOSB_JV", "VOSB", "VOSB_JV"}

STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "district of columbia": "DC",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL",
    "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA",
    "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
    "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
    "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA",
    "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
    "puerto rico": "PR", "guam": "GU", "virgin islands": "VI",
}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- stage 1

AS_OF = date.today()


def _recip_filters(sector, months):
    end = AS_OF
    start = end - timedelta(days=months * 31)
    return {
        "time_period": [{"start_date": start.isoformat(), "end_date": end.isoformat()}],
        "award_type_codes": ["A", "B", "C", "D"],
        "naics_codes": {"require": [sector]},
        "recipient_type_names": ["small_business"],
    }


def _recip_page(sector, months, page):
    key = f"{sector}-{months}m-{AS_OF.isoformat()}-p{page}"
    hit = cache.get("usas_recip", key)
    if hit is not None:
        return hit
    body = {"filters": _recip_filters(sector, months), "limit": 100, "page": page,
            "category": "recipient"}
    last = None
    for delay in (0, 3, 10, 30, 60):
        if delay:
            time.sleep(delay)
        try:
            r = requests.post(RECIP, json=body, timeout=180)
        except requests.RequestException as e:
            last = str(e)
            continue
        if r.status_code == 200:
            rows = r.json().get("results") or []
            time.sleep(0.3)
            return cache.put("usas_recip", key, rows)
        last = f"HTTP {r.status_code}: {r.text[:200]}"
    raise RuntimeError(f"USASpending sector {sector} page {page}: {last}")


def _pull_sector(sector, months, lo, hi):
    rows_in_band, page = [], 1
    while True:
        rows = _recip_page(sector, months, page)
        for r in rows:
            uei = (r.get("uei") or "").strip().upper()
            amt = float(r.get("amount") or 0)
            if uei and lo <= amt <= hi:
                rows_in_band.append((uei, r.get("name") or "", amt))
        if len(rows) < 100 or float(rows[-1].get("amount") or 0) < lo:
            break
        page += 1
    log(f"sector {sector}: {page} pages, {len(rows_in_band)} recipients in band")
    return sector, rows_in_band


def pull_recipients(sectors, months, lo, hi, workers=3):
    """{uei: {name, total_12mo, sector}} — sorted-by-amount pages, stop below the band.

    Sectors run in parallel: an uncached deep USASpending page takes ~60s, so
    one sector at a time is hours. A sector can be any NAICS prefix (2-6
    digits); splitting a big one (54 -> 5411..5419) keeps each query small.
    """
    out = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for sector, rows in pool.map(lambda s: _pull_sector(s, months, lo, hi), sectors):
            for uei, name, amt in rows:
                prev = out.get(uei)
                # a firm in two sectors keeps its larger-dollar sector
                if prev is None or amt > prev["total_12mo"]:
                    out[uei] = {"name": name, "total_12mo": amt, "sector": sector}
    return out


# ---------------------------------------------------------------- stage 3

_tl = threading.local()


def _session():
    s = getattr(_tl, "s", None)
    if s is None:
        s = _tl.s = requests.Session()
        s.headers.update({"User-Agent": UA, "Accept": "application/json"})
    return s


def sba_raw(uei, spacing):
    hit = cache.get("sba_raw", uei)
    if hit is not None:
        return hit
    for delay in (0, 5, 20):
        if delay:
            time.sleep(delay)
        try:
            r = _session().get(SBA.format(uei=uei), timeout=40)
        except requests.RequestException:
            continue
        time.sleep(spacing)
        if r.status_code in (404,) or (r.status_code == 500 and "No matching" in r.text):
            return cache.put("sba_raw", uei, {"not_found": True})
        if r.status_code == 200:
            try:
                raw = r.json()
            except ValueError:
                continue
            ent = raw.get("entity") if isinstance(raw.get("entity"), dict) else raw
            keep = {k: ent.get(k) for k in (
                "uei", "legal_business_name", "dba_name", "email", "phone", "contact_person",
                "website", "city", "state", "zipcode", "naics_primary", "naics_all_codes",
                "business_size", "annual_revenue", "year_established", "public_display",
                "display_email", "display_phone", "current_principals", "keywords",
            )}
            keep["certs"] = sorted(
                k[len("active_"):-len("_boolean")].upper()
                for k, v in ent.items()
                if k.startswith("active_") and k.endswith("_boolean") and v is True)
            return cache.put("sba_raw", uei, keep)
        if r.status_code == 429:
            time.sleep(30)
    return {"error": True}  # transient: not cached, a rerun retries it


def _flag(d, k):
    v = d.get(k)
    return v if isinstance(v, bool) else True


def _person(contact):
    s = re.sub(r"\s+", " ", str(contact or "")).strip()
    if not s or any(ch.isdigit() for ch in s):
        return "", ""
    parts = [p for p in s.split(" ") if p.strip(".,")]
    if len(parts) < 2 or len(parts) > 4:
        return "", ""

    def tc(w):
        w = w.strip(",")
        return "-".join(x[:1].upper() + x[1:].lower() for x in w.split("-"))
    return tc(parts[0]), " ".join(tc(p) for p in parts[1:])


def _domain(email):
    return email.split("@", 1)[1] if "@" in email else ""


def _naics_list(v):
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        return [x for x in re.split(r"[^0-9]+", v) if x]
    return []


def score(rec, prof):
    s = SECTOR_WEIGHT.get(rec["sector"][:2], 0)
    if 100_000 <= rec["total_12mo"] <= 2_000_000:
        s += 1
    if set(prof.get("certs") or []) & SET_ASIDES:
        s += 2
    return s


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sectors", default="23,56,81,5411,5412,5413,5414,5415,5416,5417,5418,5419,62,61")
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--min-total", type=float, default=50_000)
    ap.add_argument("--max-total", type=float, default=5_000_000)
    ap.add_argument("--exclude", required=True, help="JSON {ueis, emails, domains}")
    ap.add_argument("--target-emails", type=int, default=22_000,
                    help="stop SBA lookups once this many new contacts are found "
                         "(~72%% MV-ok last time -> ~15.8k verified)")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--spacing", type=float, default=0.8, help="seconds between calls per worker")
    ap.add_argument("--recipients-only", action="store_true")
    ap.add_argument("--as-of", default=None,
                    help="YYYY-MM-DD end of the award window; pin it to resume a pull begun on an earlier day")
    ap.add_argument("-o", "--out", default="out/universe.csv")
    a = ap.parse_args()
    global AS_OF
    if a.as_of:
        AS_OF = date.fromisoformat(a.as_of)

    ex = json.load(open(a.exclude))
    ex_uei = {u.upper() for u in ex.get("ueis", [])}
    ex_email = {e.lower() for e in ex.get("emails", [])}
    ex_dom = {d.lower() for d in ex.get("domains", [])} - FREE_MAIL

    sectors = [s.strip() for s in a.sectors.split(",") if s.strip()]
    recips = pull_recipients(sectors, a.months, a.min_total, a.max_total)
    fresh = {u: r for u, r in recips.items() if u not in ex_uei}
    log(f"recipients in band: {len(recips)}; not already in pool/outreach: {len(fresh)}")
    json.dump({"in_band": len(recips), "fresh": len(fresh),
               "by_sector": {s: sum(1 for r in fresh.values() if r["sector"] == s) for s in sectors}},
              open(a.out + ".stage1.json", "w"), indent=1)
    if a.recipients_only:
        return

    # look up the likeliest-to-reply firms first so a stop at --target-emails keeps the best
    order = sorted(fresh, key=lambda u: (-SECTOR_WEIGHT.get(fresh[u]["sector"][:2], 0),
                                         not (100_000 <= fresh[u]["total_12mo"] <= 2_000_000),
                                         fresh[u]["total_12mo"]))
    seen_email, seen_dom = set(), set()
    rows, stats = [], {"looked_up": 0, "not_found": 0, "error": 0, "no_email": 0,
                       "hidden": 0, "dup_or_contacted": 0, "role": 0, "kept": 0}
    lock = threading.Lock()
    stop = threading.Event()

    def work(uei):
        if stop.is_set():
            return
        prof = sba_raw(uei, a.spacing)
        with lock:
            stats["looked_up"] += 1
            if prof.get("error"):
                stats["error"] += 1
                return
            if prof.get("not_found"):
                stats["not_found"] += 1
                return
            email = str(prof.get("email") or "").strip().lower()
            if not email or "@" not in email:
                stats["no_email"] += 1
                return
            if not _flag(prof, "public_display") or not _flag(prof, "display_email"):
                stats["hidden"] += 1
                return
            if ROLE_LOCAL.match(email):
                stats["role"] += 1
                return
            dom = _domain(email)
            company_dom = dom not in FREE_MAIL
            if email in ex_email or email in seen_email or \
               (company_dom and (dom in ex_dom or dom in seen_dom)):
                stats["dup_or_contacted"] += 1
                return
            seen_email.add(email)
            if company_dom:
                seen_dom.add(dom)
            rec = fresh[uei]
            first, last = _person(prof.get("contact_person"))
            naics_all = _naics_list(prof.get("naics_all_codes"))
            st = STATES.get(str(prof.get("state") or "").strip().lower(), str(prof.get("state") or "")[:2].upper())
            rows.append({
                "email": email, "first_name": first, "last_name": last,
                "contact_person": prof.get("contact_person") or "",
                "company_name": prof.get("legal_business_name") or rec["name"],
                "dba_name": prof.get("dba_name") or "",
                "domain": dom if company_dom else "", "free_mail": int(not company_dom),
                "phone": prof.get("phone") if _flag(prof, "display_phone") else "",
                "website": prof.get("website") or "",
                "city": prof.get("city") or "", "state": st, "zip": prof.get("zipcode") or "",
                "uei": uei, "naics_primary": str(prof.get("naics_primary") or ""),
                "naics_all": " ".join(naics_all), "sector": rec["sector"],
                "certs": " ".join(prof.get("certs") or []),
                "business_size": prof.get("business_size") or "",
                "annual_revenue": prof.get("annual_revenue") or "",
                "year_established": prof.get("year_established") or "",
                "total_12mo": round(rec["total_12mo"], 2),
                "score": score(rec, prof),
                "source": f"usas_recip_{AS_OF:%Y%m}+sba",
            })
            stats["kept"] += 1
            if stats["kept"] >= a.target_emails:
                stop.set()
            if stats["looked_up"] % 500 == 0:
                log(f"progress {stats}")

    with ThreadPoolExecutor(max_workers=a.workers) as pool:
        list(pool.map(work, order))

    rows.sort(key=lambda r: (-r["score"], r["total_12mo"]))
    with open(a.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["email"])
        w.writeheader()
        w.writerows(rows)
    stats["fresh_recipients"] = len(fresh)
    json.dump(stats, open(a.out + ".stats.json", "w"), indent=1)
    log(f"done: {stats} -> {a.out}")


if __name__ == "__main__":
    main()
