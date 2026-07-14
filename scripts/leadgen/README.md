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

## Segments

| `--segment` | Who | Tiers |
|---|---|---|
| `primes` (default) | serial bidders, 18mo, $100k–25M | A/B/C/D |
| `new-primes` | small businesses whose FIRST award landed in the last 12mo, $100k–2M | N |
| `subs` | subcontractors from FSRS subaward reports (12mo, $30k–5M client-side band); each enriched sub gets a 1-request "ever won a prime?" check | S (never-prime, sorted first) / SP |
| `all` | all three, cross-deduped, one workbook tab each | |

## Usage

```bash
pip install -r requirements.txt
python govhub_leadgen.py --probe [--segment subs]   # tiny sample; verify field yields first
python govhub_leadgen.py --count --segment all      # volumes, no pulls
python govhub_leadgen.py --full --segment all --enrich-top 500 -o out/leads.xlsx
```

Targeting (NAICS list, dollar bands, tier rules) lives at the top of
`govhub_leadgen.py`.

USASpending quirks handled in `usaspending.py`: `hasNext` lies past page 100
(stop on short page instead); the `award_amount` filter is loose on primes and
ignored on subawards (all dollar gates re-applied client-side); the populated
sub UEI field is `Sub-Recipient UEI` (`Sub-Awardee UEI` is always null).

Output workbook: **Companies** (enriched, with `email_source`/`phone_source`),
**Coverage** (per-field hit rates by source), **Tiers**, **Universe** (unenriched rest).

All API responses cache under `.cache/` — reruns resume where they stopped
without re-spending quota. Delete `.cache/` for a fresh pull.

Notes: SBA profile email/phone are only used when the profile's public display
flags allow it. The SBA `_api/v2` endpoints (profile by UEI + name search used
as a subs fallback, exact-normalized match only) are undocumented (SPA backend)
and throttled here to ~2 req/s — re-verify with `--probe` if yields drop to zero.
FSRS only requires subaward reporting ≥ $30k and prime compliance is patchy, so
the subs universe is a floor, not a census.
