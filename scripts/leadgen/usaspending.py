"""Layer 1: USASpending — WHO wins contracts (prime and sub), how often, how big.
No API key.

Pulled one NAICS code at a time: the full ICP filter matches six figures of
contracts, and a single amount-sorted pull would cap out on the biggest firms.
Per-code pulls keep the request budget the same while sampling every segment.

API quirks (all verified live):
  - hasNext lies past page 100 (ES 10k window) — stop on a short/empty page,
    never trust hasNext for deep pulls.
  - the award_amount filter is loose on primes ($0/negative/over-cap rows
    slip in) and silently ignored on subawards — dollar gates must be
    re-applied client-side.
  - "Sub-Recipient UEI" is the populated sub UEI field ("Sub-Awardee UEI"
    is accepted but always null).
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

SUB_FIELDS = [
    "Sub-Award ID", "Sub-Awardee Name", "Sub-Recipient UEI", "Sub-Award Amount",
    "Sub-Award Date", "Prime Award ID", "Prime Recipient Name",
    "Awarding Agency", "Awarding Sub Agency", "NAICS",
]

RETRY_DELAYS = [1, 4, 15]
SPACING = 0.25
LIMIT = 100


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


def build_filters(naics_codes, months, min_award=None, max_award=None, states=None,
                  date_type=None, recipient_types=None):
    end = date.today()
    start = end - timedelta(days=months * 31)
    period = {"start_date": start.isoformat(), "end_date": end.isoformat()}
    if date_type:
        period["date_type"] = date_type
    f = {
        "time_period": [period],
        "award_type_codes": ["A", "B", "C", "D"],
        "naics_codes": [str(c) for c in naics_codes],
    }
    if min_award is not None or max_award is not None:
        f["award_amount"] = [{"lower_bound": min_award, "upper_bound": max_award}]
    if recipient_types:
        f["recipient_type_names"] = list(recipient_types)
    if states:
        f["recipient_locations"] = [{"country": "USA", "state": s} for s in states]
    return f


def count_awards(naics_codes, months, min_award, max_award, states=None,
                 date_type=None, recipient_types=None):
    payload = {
        "filters": build_filters(naics_codes, months, min_award, max_award, states,
                                 date_type, recipient_types),
        "subawards": False,
    }
    return _post(COUNT, payload).get("results", {})


def count_subawards(naics_codes, months):
    payload = {
        "filters": build_filters(naics_codes, months),
        "subawards": True,
    }
    return _post(COUNT, payload).get("results", {})


def _paged_pull(filt, fields, sort_key, pages_cap, cache_prefix, subawards):
    fkey = cache_prefix + hashlib.sha1(
        json.dumps(filt, sort_keys=True).encode()).hexdigest()[:12]
    rows, page = [], 1
    while page <= pages_cap:
        ck = f"{fkey}_p{page}"
        data = cache.get("usaspending", ck)
        if data is None:
            payload = {
                "filters": filt, "fields": fields, "page": page, "limit": LIMIT,
                "sort": sort_key, "order": "desc", "subawards": subawards,
            }
            data = _post(SEARCH, payload)
            cache.put("usaspending", ck, data)
            time.sleep(SPACING)
        batch = data.get("results", [])
        rows.extend(batch)
        # hasNext lies past page 100 — a short or empty page is the real end
        if len(batch) < LIMIT:
            break
        page += 1
    return rows, page


def pull_awards(naics_codes, months, min_award, max_award, pages_per_naics=30,
                states=None, date_type=None, recipient_types=None, verbose=True):
    rows = []
    for code in naics_codes:
        filt = build_filters([code], months, min_award, max_award, states,
                             date_type, recipient_types)
        got, pages = _paged_pull(filt, FIELDS, "Award Amount", pages_per_naics, "", False)
        rows.extend(got)
        if verbose:
            print(f"  NAICS {code}: {len(got):,} awards ({pages} page(s))", flush=True)
    return rows


def pull_subawards(naics_codes, months, pages_per_naics=60, verbose=True):
    # no award_amount here — the server ignores it on subawards; band client-side
    rows = []
    for code in naics_codes:
        filt = build_filters([code], months)
        got, pages = _paged_pull(filt, SUB_FIELDS, "Sub-Award Amount",
                                 pages_per_naics, "sub_", True)
        rows.extend(got)
        if verbose:
            print(f"  NAICS {code}: {len(got):,} subawards ({pages} page(s))", flush=True)
    return rows


def prime_award_count(uei):
    """All-time prime contract count for a UEI — the 'never won a prime?' check."""
    if not uei:
        return None
    hit = cache.get("prime_check", uei)
    if hit is None:
        payload = {
            "filters": {
                "recipient_search_text": [uei],
                "award_type_codes": ["A", "B", "C", "D"],
                "time_period": [{"start_date": "2007-10-01",
                                 "end_date": date.today().isoformat()}],
            },
            "subawards": False,
        }
        hit = cache.put("prime_check", uei, _post(COUNT, payload).get("results", {}))
        time.sleep(SPACING)
    return int(hit.get("contracts") or 0)
