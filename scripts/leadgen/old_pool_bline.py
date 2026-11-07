"""The old pool's unsent contacts, as a B-line CSV.

Two groups from the August audience that never received an email:

  1. outreach.companies rows with no pushed assignment, not suppressed, and
     not wave 1 (wave 1 was pushed straight to Instantly, outside the
     assignments table, so prospect_pool.instantly_lead_id marks it). Most
     hold a queued A5 assignment that will never drain now A5 is retired.
  2. prospect_pool rows that verified ok in August but were left out of
     outreach.companies by the $5M ceiling.

Both were verified in August, so the CSV goes through verify_pool.py with
--recheck-since before anything is loaded. Columns match pull_universe.py's
output, so the same verifier and loader read either file.

  python old_pool_bline.py --instantly-leads <dir of leads-*.json> -o old_pool.csv

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""
import argparse
import csv
import glob
import json
import os
import re

import requests

from pull_universe import FREE_MAIL, SECTOR_WEIGHT, _person

U = os.environ["SUPABASE_URL"] + "/rest/v1/"
K = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def fetch(table, cols, profile=None, extra="", order="id"):
    out, off = [], 0
    while True:
        h = {"apikey": K, "Authorization": "Bearer " + K, "Range": f"{off}-{off + 999}"}
        if profile:
            h["Accept-Profile"] = profile
        r = requests.get(f"{U}{table}?select={cols}{extra}&order={order}", headers=h, timeout=120)
        r.raise_for_status()
        b = r.json()
        out += b
        if len(b) < 1000:
            return out
        off += 1000


def score(naics, total):
    s = SECTOR_WEIGHT.get(str(naics or "")[:2], 0)
    if total and 100_000 <= float(total) <= 2_000_000:
        s += 1
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--instantly-leads", help="directory of Instantly leads-*.json exports to exclude")
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()

    in_instantly = set()
    for f in glob.glob(os.path.join(a.instantly_leads or "", "leads-*.json")):
        d = json.load(open(f))
        for l in (d if isinstance(d, list) else d.get("items", [])):
            if l.get("email"):
                in_instantly.add(l["email"].strip().lower())

    pool = fetch("prospect_pool", "uei,name,state,total,domain,email,contact_person,naics,city,mv_result,instantly_lead_id", order="uei")
    wave1 = {p["email"].lower() for p in pool if p.get("instantly_lead_id") and p.get("email")}
    pool_by_uei = {p["uei"]: p for p in pool}
    companies = fetch("companies", "id,email,first_name,last_name,company_name,domain,state,uei,naics_codes,socio_flags,suppressed,total_obligated", "outreach")
    pushed = {x["company_id"] for x in fetch("assignments", "company_id", "outreach", "&status=eq.pushed")}

    rows, seen, why = [], set(), {}

    def skip(reason):
        why[reason] = why.get(reason, 0) + 1

    for c in companies:
        e = (c.get("email") or "").strip().lower()
        if c.get("suppressed"):
            skip("suppressed"); continue
        if c["id"] in pushed:
            skip("already emailed"); continue
        if not e or e in wave1 or e in in_instantly:
            skip("wave 1 or already in Instantly"); continue
        if e in seen:
            skip("duplicate email"); continue
        seen.add(e)
        naics = list(c.get("naics_codes") or [])
        p = pool_by_uei.get(c.get("uei") or "", {})
        dom = e.split("@", 1)[1]
        rows.append({
            "email": e, "first_name": c.get("first_name") or "", "last_name": c.get("last_name") or "",
            "contact_person": p.get("contact_person") or "", "company_name": c.get("company_name") or p.get("name") or "",
            "dba_name": "", "domain": c.get("domain") or (dom if dom not in FREE_MAIL else ""),
            "free_mail": int(dom in FREE_MAIL), "phone": "", "website": "",
            "city": p.get("city") or "", "state": c.get("state") or p.get("state") or "", "zip": "",
            "uei": c.get("uei") or "", "naics_primary": naics[0] if naics else (p.get("naics") or ""),
            "naics_all": " ".join(naics), "sector": (naics[0] if naics else str(p.get("naics") or ""))[:2],
            "certs": " ".join(c.get("socio_flags") or []), "business_size": "", "annual_revenue": "",
            "year_established": "", "total_12mo": c.get("total_obligated") or p.get("total") or "",
            "score": score(naics[0] if naics else p.get("naics"), c.get("total_obligated") or p.get("total")),
            "source": "old_pool_unsent", "company_id": c["id"],
        })

    in_outreach_uei = {c.get("uei") for c in companies if c.get("uei")}
    in_outreach_email = {(c.get("email") or "").lower() for c in companies}
    for p in pool:
        e = (p.get("email") or "").strip().lower()
        if p.get("mv_result") != "ok" or not e or float(p.get("total") or 0) <= 5_000_000:
            continue
        if p["uei"] in in_outreach_uei or e in in_outreach_email:
            continue
        if e in wave1 or e in in_instantly:
            skip("over $5M: wave 1 or already in Instantly"); continue
        if e in seen:
            skip("duplicate email"); continue
        seen.add(e)
        first, last = _person(p.get("contact_person"))
        dom = e.split("@", 1)[1]
        rows.append({
            "email": e, "first_name": first, "last_name": last, "contact_person": p.get("contact_person") or "",
            "company_name": p.get("name") or "", "dba_name": "", "domain": p.get("domain") or (dom if dom not in FREE_MAIL else ""),
            "free_mail": int(dom in FREE_MAIL), "phone": "", "website": "", "city": p.get("city") or "",
            "state": p.get("state") or "", "zip": "", "uei": p["uei"], "naics_primary": p.get("naics") or "",
            "naics_all": p.get("naics") or "", "sector": str(p.get("naics") or "")[:2], "certs": "",
            "business_size": "", "annual_revenue": "", "year_established": "", "total_12mo": p.get("total") or "",
            "score": score(p.get("naics"), p.get("total")), "source": "old_pool_over_5m", "company_id": "",
        })

    with open(a.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    by = {}
    for r in rows:
        by[r["source"]] = by.get(r["source"], 0) + 1
    print(json.dumps({"rows": len(rows), "by_source": by, "skipped": why}, indent=1))


if __name__ == "__main__":
    main()
