#!/usr/bin/env python3
"""
gsc_check.py

One-time diagnostic for the Search Console credentials. Answers "is the pull
working" in the only place it can be answered, inside an Actions runner where
the secret actually exists.

It deliberately does not stop at sites().list(). Listing properties succeeding
does not prove a query will succeed, and the two fail for different reasons.

Read-only: webmasters.readonly, no writes anywhere.

Env:
  GSC_SERVICE_ACCOUNT_JSON   the service account key, as raw JSON
  GSC_PROPERTY               default sc-domain:govhub.online
"""

import json
import os
import sys
from datetime import date, timedelta

# The scoring constants live in pick_topic so this reports on exactly the
# thresholds the real run uses, rather than a second copy that can drift.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pick_topic as pt  # noqa: E402

PROPERTY = os.environ.get("GSC_PROPERTY", "sc-domain:govhub.online")

failures = []


def head(n: int, title: str) -> None:
    print(f"\n{'=' * 66}\n{n}. {title}\n{'=' * 66}")


def fail(msg: str, fix: str) -> None:
    failures.append((msg, fix))
    print(f"FAIL: {msg}")
    print(f"FIX:  {fix}")


# ---------------------------------------------------------------- 1. secret
head(1, "Service account secret")

raw = os.environ.get("GSC_SERVICE_ACCOUNT_JSON")
if not raw:
    fail("GSC_SERVICE_ACCOUNT_JSON is empty inside the runner.",
         "Add it under Settings > Secrets and variables > Actions > "
         "Repository secrets. Paste the raw JSON, not base64, not a file path.")
    sys.exit(1)

try:
    info = json.loads(raw)
except json.JSONDecodeError as exc:
    fail(f"The secret is not valid JSON ({exc}).",
         "Re-paste the downloaded key file contents verbatim, including the "
         "outer braces. Do not base64 it or strip newlines from private_key.")
    sys.exit(1)

# Identifiers only. The private key never gets printed.
print(f"  type:         {info.get('type')}")
print(f"  project_id:   {info.get('project_id')}")
print(f"  client_email: {info.get('client_email')}")
print(f"  private_key present: {bool(info.get('private_key'))}")

if info.get("type") != "service_account":
    fail(f"Key type is '{info.get('type')}', not 'service_account'.",
         "You downloaded an OAuth client secret rather than a service account "
         "key. Create a service account, then Keys > Add key > JSON.")
    sys.exit(1)

# ------------------------------------------------------------ 2. list sites
head(2, "sites().list()")

from google.oauth2 import service_account  # noqa: E402
from googleapiclient.discovery import build  # noqa: E402
from googleapiclient.errors import HttpError  # noqa: E402

creds = service_account.Credentials.from_service_account_info(info, scopes=pt.SCOPES)
svc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)

sites = []
try:
    sites = svc.sites().list().execute().get("siteEntry", [])
except HttpError as exc:
    body = exc.content.decode("utf-8", "replace") if exc.content else str(exc)
    print(body[:600])
    if "SERVICE_DISABLED" in body or "has not been used in project" in body:
        fail("The Search Console API is not enabled on this GCP project.",
             f"Enable it: https://console.cloud.google.com/apis/library/"
             f"searchconsole.googleapis.com?project={info.get('project_id')} "
             f"Then wait a minute and re-run. Adding the service account in "
             f"Search Console does nothing while the API is off.")
    elif exc.resp.status == 403:
        fail("403 from the Search Console API.",
             "Usually the API is disabled, or the key belongs to a project "
             "without it enabled. Check the link in the error body above.")
    else:
        fail(f"sites().list() failed with HTTP {exc.resp.status}.",
             "See the response body above.")
    sys.exit(1)

if not sites:
    fail("The API works, but this service account can see zero properties.",
         f"In Search Console open the property, then Settings > Users and "
         f"permissions > Add user. Paste {info.get('client_email')} and give "
         f"it Restricted (or Full). The add is per property, not per account.")
    sys.exit(1)

print(f"  {len(sites)} property/properties visible:")
for s in sites:
    print(f"    {s['siteUrl']:<45} | {s['permissionLevel']}")

# -------------------------------------------------------- 3. property match
head(3, f"Configured property: {PROPERTY}")

match = next((s for s in sites if s["siteUrl"] == PROPERTY), None)
if match:
    print(f"  Found. permissionLevel={match['permissionLevel']}")
else:
    alternatives = "\n".join(f"    {s['siteUrl']}" for s in sites)
    fail(f"{PROPERTY} is not among the visible properties.",
         f"A 'sc-domain:' property must be a DNS-verified Domain property. If "
         f"you verified a URL-prefix property instead, set the GSC_PROPERTY "
         f"repo variable (Settings > Secrets and variables > Actions > "
         f"Variables) to one of these exact values:\n{alternatives}")

# ------------------------------------------------------ 4. permission level
head(4, "Permission level")

if match:
    level = match["permissionLevel"]
    if level == "siteUnverifiedUser":
        fail(f"Permission is '{level}', which cannot read search analytics.",
             "The user was added but not confirmed, or added at the wrong "
             "level. Re-add with Restricted or Full.")
    else:
        print(f"  {level} is sufficient for searchanalytics reads.")
else:
    print("  Skipped, the property was not found above.")

# ----------------------------------------------------------- 5. real query
head(5, "searchanalytics query, the call pick_topic.py actually makes")

rows = []
if match:
    end = date.today() - timedelta(days=3)  # GSC reporting lag
    start = end - timedelta(days=pt.LOOKBACK_DAYS)
    print(f"  Window: {start} to {end} ({pt.LOOKBACK_DAYS} days)")
    try:
        resp = svc.searchanalytics().query(
            siteUrl=PROPERTY,
            body={
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
                "dimensions": ["query"],
                "rowLimit": 25000,
                "type": "web",
            },
        ).execute()
        rows = resp.get("rows", [])
        print(f"  {len(rows)} query row(s) returned.")
        for r in rows[:10]:
            print(f"    {r['keys'][0][:45]:<45} "
                  f"pos {r.get('position', 0):5.1f}  "
                  f"impr {int(r.get('impressions', 0)):>6}  "
                  f"clicks {int(r.get('clicks', 0)):>4}")
        if not rows:
            print("  Zero rows is a valid result, not an error. A new or "
                  "low-traffic property has no query data yet, and the picker "
                  "will correctly use its seed bank until it does.")
    except HttpError as exc:
        body = exc.content.decode("utf-8", "replace") if exc.content else str(exc)
        print(body[:600])
        fail(f"searchanalytics query failed with HTTP {exc.resp.status}.",
             "Listing properties worked, so this is specific to the query. "
             "Check the property string and the date window above.")
else:
    print("  Skipped, the property was not found above.")

# ------------------------------------------------- 6. striking distance view
head(6, "Striking-distance candidates, scored the way pick_topic.py scores them")

if rows:
    parsed = [
        {
            "query": r["keys"][0],
            "clicks": r.get("clicks", 0),
            "impressions": r.get("impressions", 0),
            "ctr": r.get("ctr", 0.0),
            "position": r.get("position", 99.0),
        }
        for r in rows
    ]
    pool = [
        r for r in parsed
        if r["impressions"] >= pt.MIN_IMPRESSIONS
        and 4.0 <= r["position"] <= 20.0
        and not pt.is_branded(r["query"])
    ]
    print(f"  {len(parsed)} queries, {len(pool)} in striking distance "
          f"(position 4-20, >={pt.MIN_IMPRESSIONS} impressions, non-branded).")

    sigs = pt.covered_signatures()
    scored = []
    for r in pool:
        s = pt.score(r)
        if s > 0:
            scored.append((s, r, pt.already_covered(r["query"], sigs)))
    scored.sort(key=lambda x: x[0], reverse=True)

    fresh = [x for x in scored if not x[2]]
    print(f"  {len(scored)} scoring above zero, {len(fresh)} not already "
          f"covered by an existing page.\n")

    if fresh:
        print(f"  Top candidates (est. monthly clicks gained at position "
              f"{pt.TARGET_POSITION}):")
        for s, r, _ in fresh[:10]:
            print(f"    +{s:6.1f}  pos {r['position']:5.1f}  "
                  f"impr {int(r['impressions']):>6}  {r['query'][:45]}")
    else:
        print("  No uncovered candidates this week. The picker will use its "
              "seed bank, which is the correct behaviour.")

    skipped = [x for x in scored if x[2]]
    if skipped:
        print(f"\n  Skipped as already covered ({len(skipped)}), shown so you "
              f"can sanity check the cannibalisation filter:")
        for s, r, _ in skipped[:5]:
            print(f"    +{s:6.1f}  {r['query'][:55]}")
else:
    print("  Skipped, no rows to score.")

# ------------------------------------------------------------------ verdict
print(f"\n{'=' * 66}")
if failures:
    print(f"{len(failures)} check(s) failed:\n")
    for msg, fix in failures:
        print(f"  - {msg}\n    {fix}\n")
    sys.exit(1)
print("All checks passed. The Search Console pull is working.")
