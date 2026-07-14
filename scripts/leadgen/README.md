# GovHub Lead Engine

Builds an ICP lead list (govcon companies that bid frequently) with contacts
from free federal data sources, and reports honest per-field coverage.

## Sources

| Layer | Source | Key needed | What it gives |
|---|---|---|---|
| 1 | USASpending API | none | companies, UEI, award cadence/size (the tiering signal) |
| 2 | SBA certification search (DSBS successor) | none | **email, phone, contact person**, website, 8(a)/WOSB/HUBZone/SDVOSB certs |
| 2b | SAM.gov Entity API v3 | `SAM_API_KEY` (free, from your SAM.gov profile) | website, address, POC name/title, certs. **POC email/phone are FOUO-gated — public keys never get them.** |
| 3 | Tomba.io | `TOMBA_API_KEY` (base64 of `ta_key:ts_secret`) | fallback emails by website domain; trial = 200 searches/mo, budget-capped |

## Usage

```bash
pip install -r requirements.txt
python govhub_leadgen.py --probe                    # tiny sample; verify field yields first
python govhub_leadgen.py --count                    # volumes per NAICS, no pulls
python govhub_leadgen.py --full --enrich-top 500 --tomba-budget 80 -o out/leads.xlsx
```

Targeting (NAICS list, $100k–$25M band, 18-month lookback, tier rules) lives at
the top of `govhub_leadgen.py`.

Output workbook: **Companies** (enriched, with `email_source`/`phone_source`),
**Coverage** (per-field hit rates by source), **Tiers**, **Universe** (unenriched rest).

All API responses cache under `.cache/` — reruns resume where they stopped
without re-spending quota. Delete `.cache/` for a fresh pull.

Notes: SBA profile email/phone are only used when the profile's public display
flags allow it. The SBA `_api/v2` endpoint is undocumented (SPA backend) and
throttled here to ~2 req/s — re-verify with `--probe` if yields drop to zero.
