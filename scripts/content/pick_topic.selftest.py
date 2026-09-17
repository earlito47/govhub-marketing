#!/usr/bin/env python3
"""Self-test for the topic picker's demand guards. No network, no secrets.

Every case below is a real row from Search Console for sc-domain:govhub.online
over the 90 days to 2026-09-14, so this locks in behaviour against the traffic
that actually caused the misfires rather than against invented examples.

Run: python3 scripts/content/pick_topic.selftest.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pick_topic as pt  # noqa: E402

failures = []


def check(label, actual, expected):
    if actual != expected:
        failures.append(f"{label}: expected {expected!r}, got {actual!r}")
    print(f"{'ok  ' if actual == expected else 'FAIL'} {label}")


def row(query, impressions, position, clicks=0):
    return {"query": query, "impressions": impressions, "position": position,
            "clicks": clicks, "ctr": clicks / impressions if impressions else 0.0}


# --- singleton probes -------------------------------------------------------
# The query that triggered all of this: picked 2026-09-07, published, and at
# position 3.2 on 762 impressions it has never been clicked.
rhode_island = row("rhode island itsm contract awards", 762, 3.2)
real_cluster = [
    row("loopio pricing", 156, 22.0),
    row("loopio alternatives", 210, 15.8),
    row("loopio competitors", 177, 18.2),
    row("loopio alternative", 13, 13.2),
]
check("singleton: bot query with no sibling phrasings",
      pt.is_singleton_probe(rhode_island, [rhode_island] + real_cluster), True)
check("singleton: real query inside its own cluster",
      pt.is_singleton_probe(real_cluster[0], [rhode_island] + real_cluster), False)
# Low volume is how a genuine new topic starts; only volume without variants is
# suspicious, or the guard would block every emerging query.
check("singleton: low-volume loner survives",
      pt.is_singleton_probe(row("federal tail spend", 9, 68.0), []), False)

# --- dead demand ------------------------------------------------------------
check("dead demand: ranks 3rd on 762 impressions, zero clicks",
      pt.is_dead_demand(rhode_island), True)
check("dead demand: ranks 5th on 82 impressions, zero clicks",
      pt.is_dead_demand(row("sf330", 82, 3.4)), True)
# Every topic the pipeline picked well sat deep, where zero clicks is normal.
for q, impr, pos in [("govwin iq pricing", 21, 32.8), ("rfpio alternative", 32, 19.5),
                     ("loopio alternatives", 53, 21.1), ("loopio competitors", 87, 19.3),
                     ("rfpio pricing", 31, 16.7)]:
    check(f"dead demand: good historical pick {q!r} survives",
          pt.is_dead_demand(row(q, impr, pos)), False)
check("dead demand: a query that does earn clicks survives",
      pt.is_dead_demand(row("govhub", 1447, 6.9, clicks=10)), False)

# --- rival-intent coverage --------------------------------------------------
# /alternatives/loopio/ and /vs/loopio/ ship from the competitor catalog.
catalog_sigs = [{"loopio", "alternatives"}, {"responsive", "alternatives"}]
check("coverage: 'loopio competitors' blocked by /alternatives/loopio/",
      pt.already_covered("loopio competitors", catalog_sigs), True)
check("coverage: 'loopio alternative' blocked",
      pt.already_covered("loopio alternative", catalog_sigs), True)
check("coverage: 'loopio comparison' blocked",
      pt.already_covered("loopio comparison", catalog_sigs), True)
# Pricing is a different page and a different search, so it must stay open.
check("coverage: 'loopio pricing' still available",
      pt.already_covered("loopio pricing", catalog_sigs), False)
check("coverage: unrelated topic still available",
      pt.already_covered("how to write a past performance narrative", catalog_sigs), False)
# A bare intent word must not swallow every competitor query.
check("coverage: bare 'alternatives' route does not block a brand query",
      pt.already_covered("loopio competitors", [{"alternatives"}]), False)

# --- the catalog really does feed those signatures --------------------------
sigs = pt.covered_signatures()
check("signatures: catalog expands to /alternatives/loopio/",
      any(s == {"loopio", "alternatives"} for s in sigs), True)
check("signatures: catalog expands to the govwin-iq rival page",
      any("govwin" in s and "alternatives" in s for s in sigs), True)
# "vs" is a stopword, so a signature built around it could never be matched.
check("signatures: no inert 'vs' signature is emitted",
      any("vs" in s for s in sigs), False)

print()
if failures:
    print(f"{len(failures)} failure(s):")
    for f in failures:
        print(f"  {f}")
    sys.exit(1)
print("pick_topic guards: all checks pass")
