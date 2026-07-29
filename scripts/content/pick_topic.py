#!/usr/bin/env python3
"""
pick_topic.py

Picks next week's blog topic from Google Search Console striking-distance
queries and writes topic.json for generate_post.py to consume.

Logic:
  1. Pull the last 28 days of query-level data for the property.
  2. Keep queries in "striking distance" (position 4-20) with real demand.
  3. Score by the clicks left on the table if we moved to position 3.
  4. Drop branded terms, and anything the site already targets.
  5. Cluster the winner with its sibling queries so the brief has substance.
  6. Fall back to a seed bank if GSC has nothing worth chasing.

Step 4 is deliberately broad. Scanning only src/content/blog would let us
publish a post that competes with an existing /solutions/ or /glossary/ page,
which splits the ranking signal instead of concentrating it. So the coverage
check reads every route the site already ships.

Env:
  GSC_SERVICE_ACCOUNT_JSON   Service account key, as a JSON string
  GSC_PROPERTY               default sc-domain:govhub.online
  CONTENT_DIR                default src/content/blog
  COVERED_LEDGER             default data/covered-topics.json
  MIN_IMPRESSIONS            default 25
  LOOKBACK_DAYS              default 28
"""

import json
import os
import re
import sys
from datetime import date, timedelta
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]

PROPERTY = os.environ.get("GSC_PROPERTY", "sc-domain:govhub.online")
CONTENT_DIR = Path(os.environ.get("CONTENT_DIR", "src/content/blog"))
LEDGER_PATH = Path(os.environ.get("COVERED_LEDGER", "data/covered-topics.json"))
MIN_IMPRESSIONS = int(os.environ.get("MIN_IMPRESSIONS", "25"))
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "28"))
EMERGING_MIN_IMPRESSIONS = int(os.environ.get("EMERGING_MIN_IMPRESSIONS", "3"))
EMERGING_MAX_POSITION = float(os.environ.get("EMERGING_MAX_POSITION", "50"))

# Candidate bands, tried in order: (source label, min impressions, position range).
#
# The strict band is the one worth chasing, a query already on page one or two
# with real volume. A young property has none of those, which is not a failure
# of the query, it is the actual shape of the data. As of the first live run
# govhub.online returned 439 queries and zero cleared the strict bar: the only
# things ranking 4-20 with 25+ impressions were branded ("govhub", "gov hub"),
# and everything non-branded sat at position 30-70 with 1-3 impressions.
#
# So rather than jumping straight to the seed bank and ignoring 439 real
# searches, widen once. Thin demand from the actual audience still beats a
# generic seed topic. As the site grows the strict band starts matching and the
# loose one stops being reached, with no code change.
TIERS = [
    ("gsc_striking_distance", MIN_IMPRESSIONS, 4.0, 20.0),
    ("gsc_emerging", EMERGING_MIN_IMPRESSIONS, 4.0, EMERGING_MAX_POSITION),
]

PAGES_DIR = Path("src/pages")
DATA_DIR = Path("src/data")

# Position -> expected CTR. Rough industry curve. Once GSC has a few months of
# our own history, refit this from actual clicks/impressions by position.
CTR_CURVE = {
    1: 0.275, 2: 0.155, 3: 0.100, 4: 0.070, 5: 0.053,
    6: 0.042, 7: 0.034, 8: 0.028, 9: 0.024, 10: 0.021,
}
TAIL_CTR = 0.010  # position 11+
TARGET_POSITION = 3

# Terms that are already ours. No point writing a post to win our own name.
BRAND_TOKENS = {"govhub", "gov hub", "pins", "professional integrated network"}

STOPWORDS = {
    "the", "a", "an", "for", "to", "of", "in", "on", "and", "or", "is",
    "how", "what", "with", "my", "your", "do", "does", "i", "you", "can",
    "best", "vs", "near", "me", "free", "online",
}

# Live pillars in src/content/blog. A new post joins one of these clusters so
# BlogPostLayout's "Related posts" block has something to show.
PILLARS = {
    "how-to-respond-to-a-government-rfp": {
        "rfp", "solicitation", "respond", "response", "bid", "proposal",
        "compliance", "matrix", "shred", "section", "l", "m", "submission",
    },
    "how-to-write-a-government-proposal": {
        "write", "writing", "proposal", "narrative", "past", "performance",
        "review", "color", "team", "sf330", "capture", "win", "theme",
    },
}
DEFAULT_PILLAR = "how-to-respond-to-a-government-rfp"

# Used only when GSC returns nothing actionable. Ordered by priority.
SEED_TOPICS = [
    "rfp compliance matrix template",
    "how to read a federal rfp section l and m",
    "sam.gov registration renewal checklist",
    "past performance narrative examples government proposal",
    "naics code selection for federal contracting",
    "far 52.212-1 instructions to offerors explained",
    "government proposal color team reviews explained",
    "small business set aside types explained",
]


def expected_ctr(position: float) -> float:
    return CTR_CURVE.get(int(round(position)), TAIL_CTR)


def load_client():
    raw = os.environ.get("GSC_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise RuntimeError("GSC_SERVICE_ACCOUNT_JSON is not set")
    # Imported here so the seed-bank fallback still works on a machine that
    # never installed the Google client libraries.
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    info = json.loads(raw)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def fetch_queries(client):
    end = date.today() - timedelta(days=3)  # GSC lags ~2-3 days
    start = end - timedelta(days=LOOKBACK_DAYS)
    body = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": ["query"],
        "rowLimit": 25000,
        "type": "web",
    }
    resp = client.searchanalytics().query(siteUrl=PROPERTY, body=body).execute()
    return [
        {
            "query": r["keys"][0],
            "clicks": r.get("clicks", 0),
            "impressions": r.get("impressions", 0),
            "ctr": r.get("ctr", 0.0),
            "position": r.get("position", 99.0),
        }
        for r in resp.get("rows", [])
    ]


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", text.lower()).strip()


def tokens(text: str) -> set:
    return {t for t in normalize(text).split() if t and t not in STOPWORDS}


def is_branded(query: str) -> bool:
    q = normalize(query)
    return any(b in q for b in BRAND_TOKENS)


def covered_signatures() -> list:
    """Token sets for every topic the site already targets.

    Covers four sources so a new post never competes with an existing page:
      - the ledger of posts this pipeline has already written
      - blog post filenames
      - static page routes under src/pages
      - slugs and primary keywords in the src/data catalogs
    """
    sigs = []

    if LEDGER_PATH.exists():
        ledger = json.loads(LEDGER_PATH.read_text())
        for entry in ledger.get("topics", []):
            sigs.append(tokens(entry.get("query", "")))

    if CONTENT_DIR.exists():
        for f in CONTENT_DIR.glob("*.md*"):
            sigs.append(tokens(f.stem.replace("-", " ")))

    if PAGES_DIR.exists():
        for f in PAGES_DIR.rglob("*.astro"):
            # Dynamic routes ([slug].astro) name no topic of their own.
            if f.stem.startswith("["):
                continue
            parts = [p for p in f.relative_to(PAGES_DIR).with_suffix("").parts]
            if parts and parts[-1] == "index":
                parts = parts[:-1]
            if parts:
                sigs.append(tokens(" ".join(parts).replace("-", " ")))

    # The catalogs are TypeScript, so scrape the string literals rather than
    # standing up a TS parser for two fields.
    if DATA_DIR.exists():
        for f in DATA_DIR.glob("*.ts"):
            text = f.read_text()
            for match in re.findall(r"(?:slug|primaryKeyword|term):\s*'([^']+)'", text):
                sigs.append(tokens(match.replace("-", " ")))

    return [s for s in sigs if s]


def already_covered(query: str, sigs: list) -> bool:
    qt = tokens(query)
    if not qt:
        return True
    return any(len(qt & s) / len(qt) >= 0.7 for s in sigs)


def score(row: dict) -> float:
    lift = expected_ctr(TARGET_POSITION) - row["ctr"]
    if lift <= 0:
        return 0.0
    return row["impressions"] * lift


def build_cluster(winner: dict, pool: list, limit: int = 8) -> list:
    wt = tokens(winner["query"])
    related = []
    for r in pool:
        if r["query"] == winner["query"]:
            continue
        rt = tokens(r["query"])
        if rt and len(wt & rt) / len(wt | rt) >= 0.3:
            related.append(r)
    related.sort(key=lambda r: r["impressions"], reverse=True)
    return related[:limit]


def pick_pillar(query: str, related: list) -> str:
    """Assign the post to the pillar whose vocabulary it overlaps most."""
    qt = tokens(query)
    for r in related:
        qt |= tokens(r["query"])
    best, best_overlap = DEFAULT_PILLAR, 0
    for slug, vocab in PILLARS.items():
        overlap = len(qt & vocab)
        if overlap > best_overlap:
            best, best_overlap = slug, overlap
    return best


def fallback_topic(sigs: list) -> dict:
    for seed in SEED_TOPICS:
        if not already_covered(seed, sigs):
            return {
                "source": "seed_bank",
                "query": seed,
                "impressions": 0,
                "clicks": 0,
                "ctr": 0.0,
                "position": None,
                "opportunity_clicks": 0.0,
                "related_queries": [],
            }
    sys.exit("No topic available. Add entries to SEED_TOPICS.")


def main():
    sigs = covered_signatures()
    print(f"Coverage check: {len(sigs)} topics already targeted by the site.",
          file=sys.stderr)

    try:
        rows = fetch_queries(load_client())
    except Exception as exc:  # noqa: BLE001
        # A missing secret, an API outage, or a brand new property all land
        # here. Falling back beats failing the weekly run.
        print(f"GSC fetch failed ({exc}); falling back to seed bank", file=sys.stderr)
        rows = []

    source, pool, candidates = None, [], []
    for label, min_impr, pos_lo, pos_hi in TIERS:
        pool = [
            r for r in rows
            if r["impressions"] >= min_impr
            and pos_lo <= r["position"] <= pos_hi
            and not is_branded(r["query"])
        ]
        candidates = []
        for r in pool:
            if already_covered(r["query"], sigs):
                continue
            s = score(r)
            if s > 0:
                candidates.append((s, r))
        print(f"Tier {label}: {len(pool)} in band, {len(candidates)} uncovered "
              f"and scoring above zero.", file=sys.stderr)
        if candidates:
            source = label
            break

    if not candidates:
        topic = fallback_topic(sigs)
        topic["pillar_hint"] = pick_pillar(topic["query"], [])
    else:
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, winner = candidates[0]
        cluster = build_cluster(winner, pool)
        topic = {
            "source": source,
            "query": winner["query"],
            "impressions": winner["impressions"],
            "clicks": winner["clicks"],
            "ctr": round(winner["ctr"], 4),
            "position": round(winner["position"], 1),
            "opportunity_clicks": round(best_score, 1),
            "related_queries": [
                {
                    "query": r["query"],
                    "impressions": r["impressions"],
                    "position": round(r["position"], 1),
                }
                for r in cluster
            ],
            "pillar_hint": pick_pillar(winner["query"], cluster),
        }

    topic["picked_on"] = date.today().isoformat()
    topic["runner_up"] = candidates[1][1]["query"] if len(candidates) > 1 else None

    Path("topic.json").write_text(json.dumps(topic, indent=2))
    print(json.dumps(topic, indent=2))


if __name__ == "__main__":
    main()
