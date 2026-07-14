"""Layer 1: USASpending — WHO wins contracts, how often, how big. No API key.

Pulled one NAICS code at a time: the full ICP filter matches ~120k contracts,
and a single amount-sorted pull would cap out on the biggest firms. Per-code
pulls keep the request budget the same while sampling every segment.
"""
import hashlib
import json
import time
from datetime import date, timedelta

import requests

import cache

SEARCH = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
COUNT = "https://api.usaspending.gov/api/v2/search/spending_by_award_count/"

# sort key must also appear in fields, NAICS codes must be strings, limit max 100
FIELDS = [
    "Award ID", "Recipient Name", "Recipient UEI", "recipient_id", "Award Amount",
    "Awarding Agency", "Awarding Sub Agency", "Start Date", "End Date",
    "NAICS", "Place of Performance State Code", "Contract Award Type",
]

RETRY_DELAYS = [1, 4, 15]
SPACING = 0.25


def _post(url, payload):
    last = None
    for delay in [0] + RETRY_DELAYS:
        if delay:
            time.sleep(delay)
        try:
            r = requests.post(url, json=payload, timeout=90)
        except requests.RequestException as e:
            last = f"network: {e}"
            continue
        if r.status_code == 200:
            return r.json()
        last = f"HTTP {r.status_code}: {r.text[:300]}"
        if r.status_code not in (429, 500, 502, 503, 504):
            break
    raise RuntimeError(f"USASpending request failed: {last}")


def build_filters(naics_codes, months, min_award, max_award, states=None):
    end = date.today()
    start = end - timedelta(days=months * 31)
    f = {
        "time_period": [{"start_date": start.isoformat(), "end_date": end.isoformat()}],
        "award_type_codes": ["A", "B", "C", "D"],
        "naics_codes": [str(c) for c in naics_codes],
        "award_amount": [{"lower_bound": min_award, "upper_bound": max_award}],
    }
    if states:
        f["recipient_locations"] = [{"country": "USA", "state": s} for s in states]
    return f


def count_awards(naics_codes, months, min_award, max_award, states=None):
    payload = {
        "filters": build_filters(naics_codes, months, min_award, max_award, states),
        "subawards": False,
    }
    return _post(COUNT, payload).get("results", {})


def pull_awards(naics_codes, months, min_award, max_award, pages_per_naics=30,
                states=None, verbose=True):
    rows = []
    for code in naics_codes:
        filt = build_filters([code], months, min_award, max_award, states)
        fkey = hashlib.sha1(json.dumps(filt, sort_keys=True).encode()).hexdigest()[:12]
        page, got = 1, 0
        while page <= pages_per_naics:
            ck = f"{fkey}_p{page}"
            data = cache.get("usaspending", ck)
            if data is None:
                payload = {
                    "filters": filt, "fields": FIELDS, "page": page, "limit": 100,
                    "sort": "Award Amount", "order": "desc", "subawards": False,
                }
                data = _post(SEARCH, payload)
                cache.put("usaspending", ck, data)
                time.sleep(SPACING)
            batch = data.get("results", [])
            rows.extend(batch)
            got += len(batch)
            if not batch or not data.get("page_metadata", {}).get("hasNext"):
                break
            page += 1
        if verbose:
            print(f"  NAICS {code}: {got:,} awards ({page} page(s))", flush=True)
    return rows
