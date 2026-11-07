"""Load MillionVerifier-ok contacts into outreach.companies as the B-line.

Reads the "ok" CSVs verify_pool.py writes (fresh pull and old pool alike) and,
for each contact:

  - an old-pool row (it carries company_id): set line = 'B' on the existing
    company, and mark its queued A-assignment dropped_stale, which is the
    status outreach-assign retries -- so the next morning it is assigned B4 or
    B2 instead of sitting in A5's queue, which no longer drains;
  - a fresh row: insert it with line = 'B'. The unique key is email, and a
    duplicate is skipped, never overwritten.

REFUSES TO RUN until the B-line is deployed: a B company loaded while the old
outreach-assign is live would be given an A angle the next morning. The
migration that adds outreach.companies.line also adds daily_caps.B4, and both
ship with the assign change, so their presence is the check. Nothing sends
on load either way: B4/B2 caps start at 0, and the queues are sized from them.

  python load_bline.py --csv verified.csv --csv old_verified.csv --dry-run
  python load_bline.py --csv verified.csv --csv old_verified.csv

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""
import argparse
import csv
import json
import os
import sys

import requests

U = os.environ["SUPABASE_URL"] + "/rest/v1/"
K = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def h(extra=None):
    x = {"apikey": K, "Authorization": "Bearer " + K, "Content-Type": "application/json",
         "Accept-Profile": "outreach", "Content-Profile": "outreach"}
    x.update(extra or {})
    return x


def deployed():
    r = requests.get(U + "config?select=value&key=eq.daily_caps", headers=h(), timeout=30)
    r.raise_for_status()
    caps = (r.json() or [{}])[0].get("value") or {}
    col = requests.get(U + "companies?select=line&limit=1", headers=h(), timeout=30)
    return "B4" in caps and col.status_code == 200


def naics_list(row):
    out = []
    for code in [row.get("naics_primary", "")] + (row.get("naics_all") or "").split():
        code = code.strip()
        if code and code not in out:
            out.append(code)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", action="append", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    if not deployed():
        sys.exit("The B-line is not deployed yet (no daily_caps.B4 or no companies.line). "
                 "Loading now would let the old outreach-assign give these companies A angles.")

    fresh, old_ids, seen = [], [], set()
    for path in a.csv:
        for r in csv.DictReader(open(path)):
            if r.get("mv_result") != "ok":
                continue
            e = r["email"].strip().lower()
            if e in seen:
                continue
            seen.add(e)
            if r.get("company_id"):
                old_ids.append(r["company_id"])
                continue
            total = r.get("total_12mo") or ""
            fresh.append({
                "email": e,
                "first_name": r.get("first_name") or None,
                "last_name": r.get("last_name") or None,
                "company_name": r.get("company_name") or None,
                "domain": r.get("domain") or None,
                "state": (r.get("state") or "")[:2] or None,
                "uei": r.get("uei") or None,
                "naics_codes": naics_list(r),
                "socio_flags": [c for c in (r.get("certs") or "").split() if c],
                "total_obligated": int(float(total)) if total else None,
                "source": r.get("source") or "bline",
                "suppressed": False,
                "line": "B",
            })

    print(f"fresh contacts to insert: {len(fresh)}; old-pool companies to move to the B-line: {len(old_ids)}")
    if a.dry_run:
        return

    inserted = 0
    for i in range(0, len(fresh), 500):
        r = requests.post(U + "companies?on_conflict=email",
                          headers=h({"Prefer": "resolution=ignore-duplicates,return=representation"}),
                          json=fresh[i:i + 500], timeout=120)
        if r.status_code not in (200, 201):
            sys.exit(f"insert failed at {i}: {r.status_code} {r.text[:300]}")
        inserted += len(r.json())

    moved = requeued = 0
    for i in range(0, len(old_ids), 150):
        ids = ",".join(old_ids[i:i + 150])
        r = requests.patch(U + f"companies?id=in.({ids})&suppressed=eq.false",
                           headers=h({"Prefer": "return=representation"}), json={"line": "B"}, timeout=60)
        r.raise_for_status()
        moved += len(r.json())
        r = requests.patch(U + f"assignments?company_id=in.({ids})&status=in.(ready,needs_review,approved)",
                           headers=h({"Prefer": "return=representation"}), json={"status": "dropped_stale"}, timeout=60)
        r.raise_for_status()
        requeued += len(r.json())

    print(json.dumps({"inserted": inserted, "skipped_duplicates": len(fresh) - inserted,
                      "old_pool_moved": moved, "queued_a_assignments_released": requeued}, indent=1))


if __name__ == "__main__":
    main()
