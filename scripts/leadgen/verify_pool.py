"""MillionVerifier pass over fresh public.prospect_pool contacts.

Reads the puller's CSV (pull_universe.py) for the contacts and their ranking,
checks every address not yet verified in prospect_pool, best-ranked first,
and writes each verdict back to prospect_pool (mv_result, mv_subresult,
mv_free) as it goes. The database is the resume point: a rerun skips every
address that already has an mv_result there, so a crash or a stop never
spends a credit twice.

A per-address API error is not a verdict and is not written; the next run
retries it. Only "ok" is sendable: the campaigns run allow_risky_contacts =
false, so catch_all / unknown are held back by Instantly anyway.

  python verify_pool.py --csv universe_all.csv --out verified.csv            # all unverified
  python verify_pool.py --csv universe_all.csv --out verified.csv --limit 500  # a slice
  python verify_pool.py --csv universe_all.csv --out verified.csv --dry-run    # count only

Env: MV_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""
import argparse
import csv
import datetime as dt
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import requests

MV = "https://api.millionverifier.com/api/v3/"


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=sys.stderr, flush=True)


def sb_headers(extra=None):
    k = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": k, "Authorization": "Bearer " + k, "Content-Type": "application/json"}
    h.update(extra or {})
    return h


def already_verified(ueis):
    """UEIs whose prospect_pool row already carries an mv_result."""
    url = os.environ["SUPABASE_URL"] + "/rest/v1/prospect_pool"
    done, ueis = set(), list(ueis)
    for i in range(0, len(ueis), 150):
        chunk = ",".join(ueis[i:i + 150])
        r = requests.get(url, headers=sb_headers(),
                         params={"select": "uei,mv_result", "uei": f"in.({chunk})"}, timeout=60)
        r.raise_for_status()
        done |= {x["uei"] for x in r.json() if x.get("mv_result")}
    return done


def write_back(rows):
    if not rows:
        return
    url = os.environ["SUPABASE_URL"] + "/rest/v1/prospect_pool?on_conflict=uei"
    for t in range(4):
        r = requests.post(url, headers=sb_headers({"Prefer": "resolution=merge-duplicates,return=minimal"}),
                          json=rows, timeout=60)
        if r.status_code in (200, 201, 204):
            return
        time.sleep(2 ** t)
    raise RuntimeError(f"prospect_pool write failed: {r.status_code} {r.text[:200]}")


def check(email):
    for t in range(3):
        try:
            r = requests.get(MV, params={"api": os.environ["MV_API_KEY"], "email": email, "timeout": 20}, timeout=40)
            b = r.json()
        except (requests.RequestException, ValueError):
            time.sleep(2 + 3 * t)
            continue
        if r.ok and not b.get("error") and b.get("result"):
            return b
        if "credit" in str(b.get("error", "")).lower():
            raise SystemExit(f"MillionVerifier: {b.get('error')}")
        time.sleep(2 + 3 * t)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--out", required=True, help="CSV of contacts that verified ok (appended across runs)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    rows = list(csv.DictReader(open(a.csv)))
    rows.sort(key=lambda r: (-int(r.get("score") or 0), float(r.get("total_12mo") or 0)))
    done = already_verified([r["uei"] for r in rows])
    todo = [r for r in rows if r["uei"] not in done]
    if a.limit:
        todo = todo[:a.limit]
    log(f"{len(rows)} contacts, {len(done)} already verified, {len(todo)} to check")
    if a.dry_run or not todo:
        return

    lock = threading.Lock()
    pending, tally, out_rows = [], {}, []
    fields = list(rows[0].keys()) + ["mv_result", "mv_subresult", "mv_quality", "mv_checked_at"]
    new_file = not os.path.exists(a.out)
    out = open(a.out, "a", newline="")
    w = csv.DictWriter(out, fieldnames=fields)
    if new_file:
        w.writeheader()
    today = dt.date.today().isoformat()
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    n = [0]

    def work(r):
        b = check(r["email"])
        with lock:
            n[0] += 1
            if b is None:
                tally["api_error"] = tally.get("api_error", 0) + 1
            else:
                res = b.get("result")
                tally[res] = tally.get(res, 0) + 1
                pending.append({"uei": r["uei"], "mv_result": res, "mv_subresult": b.get("subresult"),
                                "mv_free": 1 if b.get("free") else 0, "updated_at": now})
                if res == "ok":
                    w.writerow({**r, "mv_result": res, "mv_subresult": b.get("subresult"),
                                "mv_quality": b.get("quality"), "mv_checked_at": today})
            if len(pending) >= 200:
                write_back(pending)
                pending.clear()
                out.flush()
            if n[0] % 500 == 0:
                log(f"progress {n[0]}/{len(todo)} {json.dumps(tally)}")

    with ThreadPoolExecutor(max_workers=a.workers) as pool:
        list(pool.map(work, todo))
    write_back(pending)
    out.close()
    log(f"done {n[0]}/{len(todo)} {json.dumps(tally)}")
    json.dump({"checked": n[0], "tally": tally, "at": now}, open(a.out + ".stats.json", "w"), indent=1)


if __name__ == "__main__":
    main()
