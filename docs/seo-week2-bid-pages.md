# SEO strategy week 2: public bid pages and hubs

The first two page templates from the Q4 2026 SEO strategy: one public page
per bid, and category by state hubs. Built 2026-10-31. The strategy's rule is
that nothing else starts until these are indexed, and that if they are not
indexed by Dec 1 the fix is technical (crawl, sitemap, internal links), not
more pages.

## What is published (owner's decision, 2026-10-31)

| Source | On public pages | Open now |
|---|---|---|
| Federal (SAM.gov) | Facts, GovHub summary, link to the notice | 5,927 |
| State and local portals | Facts, GovHub summary, link to the notice. Never the source's description text | 4,599 |
| CivicPlus city sites | Nothing. Their terms limit us to listing in the app and linking out | 0 |

Counts are open bids with a GovHub summary, and only those get a page: a page
with no text of our own is the thin templated kind the strategy says not to
index. About 2,000 more state and local bids are waiting on a summary
(enrichment queued) and get a page once they have one. Closed bids add about
1,800 pages (below).

## Pages

| Path | What | Count (2026-10-31) |
|---|---|---|
| `/bids/` | Every place and category, the next 20 deadlines | 1 |
| `/bids/{state}/`, `/bids/federal/` | Open bids in a state (federal bids with that place of performance included), or federal bids with none | 54 |
| `/bids/{category}/` | A category nationwide | 29 |
| `/bids/{category}/{state}/` | A category in a state, generated only with 5+ open bids | 240 |
| `/bids/{state or federal}/{slug}/` | One bid, open or closed within 90 days | 12,313 |

Bid pages open with GovHub's summary and the deadline in the bid's own time
zone, then the facts (agency, level, solicitation number, set-aside, value,
NAICS, the title as posted when cleanup changed it), the official notice link,
links to its category hubs, six similar open bids and a sign-up band. Hubs open
with the count, agency count and next deadline, list up to 200 open bids
soonest-first, then cross-link categories and states and list up to 10
recently closed bids.

**Categories** (`src/lib/bids/categories.ts`) come from the strategy's keyword
clusters and the segments signing up: the bid's primary NAICS code (published,
or the model's top guess) plus keywords in the title. E-Rate requests are
always telecom. `npm run bids:selftest` pins the rules.

**Closed bids** stay up for 90 days after the nightly archive marks them: a
closed banner, similar open bids, and the official link. A small script flips
Open to Closed as soon as the deadline passes between builds. After 90 days the
page is gone at the next build.

## How the data gets here

```
strata-parse: public_bid_listings()   security definer, granted to anon,
              (migration 20261031120000)  public columns only, 1000 rows a call
        │
        ▼  read at build time with the publishable key (src/config.ts)
govhub-marketing: src/lib/bids/load.ts  → pages under src/pages/bids/
```

- **Freshness:** bids refresh whenever the site builds. Today that is every
  push to `main`, which the daily vendor-publish run and the Monday Insights run
  already make daily. Hub pages say "checked {build date}", never more.
- **Fail closed:** a fetch error, or fewer than 1,000 rows, fails the build, and
  Cloudflare keeps the last good deploy live. Every build (Cloudflare,
  `verify` CI, IndexNow, the weekly-content gate) now reads the database.
- **Offline:** `BIDS_SNAPSHOT=<file.json> npm run build` builds from a file in
  the function's row shape instead.
- **Order to ship:** the strata-parse migration must be live before this
  branch builds anywhere, or the build fails with "public_bid_listings HTTP 404".

**Size:** the build goes from about 1,800 files to about 14,500, in about 80
seconds. Cloudflare Pages allows 20,000 files per deploy on the free plan, so
there is room, but growth in sources will reach it. The 90-day closed window is
the lever (one constant in the migration).

**IndexNow** now submits in batches of 10,000 (its per-request limit). It still
resubmits every sitemap URL on each push; submitting only new or changed URLs is
a later improvement.

## Checks after it ships

1. Search Console: Sitemaps should show about 13,000 discovered URLs within a
   few days, then Pages → "Indexed" climbing for `/bids/`. If they sit at
   "Discovered, currently not indexed", the fix is internal links (the footer
   and hubs are the only paths in today), not more pages.
2. GSC query report filtered to page contains `/bids/`: first impressions.
3. PostHog: `landing_view` with `page_path` starting `/bids/`, and
   `signup_completed` with a first-touch landing page under `/bids/`.
4. The baseline for these folders is zero (see
   [seo-baseline-2026-10.md](seo-baseline-2026-10.md)), so anything here is new.
