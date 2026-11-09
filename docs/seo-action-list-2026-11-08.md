# SEO action list, Nov 8: status

The Nov 8 list came from the Nov 7 review of Search Console and GA4 after the bid
pages launched ([seo-traffic-check-2026-11-07.md](seo-traffic-check-2026-11-07.md)).
This records what was built, what is the owner's to do (saved for later, as asked),
and what needs app work first. Judge results over 3 to 4 weeks, not days.

## Owner's items (done 2026-11-09)

- [x] **GA4: mark trial signup as a key event.** `signup_completed` (fires for email
  and Google signups) is a key event since 2026-11-09. `sign_up` is email-only and
  stays unmarked, so email trials are not counted twice. Do not import it into
  Google Ads: the app sends Ads its own "Trial started" conversion.
- [x] **Search Console: resubmit `sitemap-index.xml`.** Read 2026-11-09 05:47 UTC,
  0 errors.
- [x] **Cloudflare Crawler Hints** turned on.
- [x] **Weekly check:** Indexing, Pages, filter "All submitted pages"; note Indexed,
  "Crawled - currently not indexed" and "Discovered - currently not indexed".

## Indexing check, 2026-11-09

Search Console's Pages report showed 7,052 "Discovered - currently not indexed",
58 "Crawled - currently not indexed", 43 "Not found (404)" and 9 "noindex".

- **"Discovered" is the crawl queue, not a rejection.** URL Inspection on 270 pages:
  bid pages 17% indexed, 36% discovered, 46% not yet known to Google; state and
  category hubs 25 of 25 indexed; Insights 21 of 25; blog and core pages all
  indexed; the six comparison pages sampled (`/vs/`, `/alternatives/`) all
  discovered, none crawled yet (request indexing for them by hand). Google crawled
  daily Nov 3 to 9. The quality signal, "Crawled - currently not indexed", is 58.
- **The 404s were ours.** 520 of the 2,119 URLs Google had shown since August were
  404, 514 of them bid pages: 361 had closed and 126 were open past the cap. Open
  bids had filled the 14,000 page slots, so closed bids got no page and the open
  bids with the latest deadlines lost theirs as the cut-off moved daily.
- **Fixed:** DLA parts buys (4,280 open) moved off single pages onto one indexable
  list, `/bids/dla-parts/`; the slots now go indexable open, held-back open,
  indexable closed (most recent first), held-back closed. On the 2026-11-09 data:
  9,525 + 1,596 open and 2,879 closed bids have pages; of the URLs the change
  removes, two had any Google impressions (one each). The `shared-title` noindex
  rule became `repeat-notice`: 857 of 891 open "shared title" bids were different
  bids with a generic name ("Custodial Services").
- **Still open:** closed bids keep their pages only while slots last, and the
  daily churn of category hubs at the 5-open-bid line. A paid Cloudflare plan
  (100,000 files per site) would remove the cap.

## Built (2026-11-08)

**Hub titles and snippets** (`src/components/bids/HubPage.astro`)
- Titles carry the live count and the month: "228 Open Government Bids in New York
  (Nov 2026)", "174 Open Janitorial and Cleaning Bids (Nov 2026)", "356 Open
  Construction Bids in Texas (Nov 2026)". Long names fall back to the state code.
- Meta descriptions come from live data: the count, "RFPs, RFQs and tenders", then
  two or three bids closing soon with their dates. They skip bids due within two
  days and notices that are corrections, intents to sole-source or RFIs.
- The intro paragraph names RFPs, RFQs, solicitations and tenders once.

**Hubs to watch** (Nov 1 to 5 baseline; compare after 3 to 4 weeks)

| Hub page | Impressions | Avg position | Clicks |
|---|---|---|---|
| /bids/new-york/ | 192 | 6.6 | 0 |
| /bids/healthcare/ | 103 | 7.2 | 1 |
| /bids/it-services/ | 100 | 7.0 | 0 |
| /bids/security/ | 97 | 8.1 | 2 |
| /bids/oklahoma/ | 79 | 4.6 | 0 |
| /bids/massachusetts/ | 79 | 7.1 | 0 |
| /bids/janitorial/ | 77 | 7.1 | 0 |

**Bid page template** (`src/components/bids/BidPage.astro`, `src/lib/bids/load.ts`)
- **Titles:** name, solicitation number, agency, due date, e.g. "Work Zone Safety
  Trucks (1449), State of Idaho, Due Nov 16". The agency drops first and the name
  is shortened before the number or date. Bid pages get up to 70 characters
  instead of 60, because Google matches the whole title; `check-meta.mjs` allows
  that for bid pages only. All 14,000 titles are unique.
- **Identifiers:** the solicitation number and agency sit in plain text directly
  under the title.
- **Breadcrumbs:** Home, then Bids, then the state, then the bid's category in
  that state, then the bid.
- **Similar open bids:** now 8, up from 6. It already existed.
- **Thin rows noindexed:** done on 2026-11-01 (#111). That PR noindexed the
  Defense Logistics Agency parts buys, shared titles and summaries under 15 words.

**Conversion on the bid page**
- **"Start a proposal for this bid"** is the main button on open bids (`gh_cta=bid_proposal`).
  After signup the visitor lands on that bid in GovHub, one click from Analyze this RFP.
- **Free versus trial,** in the trial card. Free on the page: GovHub's summary, the
  deadline, the set-aside and the NAICS code. In GovHub: the full solicitation and
  documents, Analyze this RFP, the forms and a drafted, scored proposal.

**Vendor Insights titles** (override in `scripts/insights/lib/interlink.mjs`, so the
pipeline keeps them)
- Maximus: "Maximus Federal Services Contracts: $430M by Agency (FY2026)".
- Palantir: "Palantir Contracts 2026: $370M in Federal Awards (FY2026)". Its queries
  include award numbers and "palantir contracts 2026".

## Needs app or data work first

- **Line items and part numbers on bid pages.** Deferred (2026-11-09). Only about
  340 open bids carry NSNs and about 1,000 mention part numbers, mostly Defense
  Logistics Agency parts buys the site already noindexes; parsing them from free
  text would be unreliable.
- **Saved-search email alerts.** The app has saved filters but sends no email. This
  is a new app feature.

**Done 2026-11-09**

- **"Required forms", as "Documents posted".** The real list of required forms
  exists only after the app analyzes a solicitation, which costs about $1.43 a bid
  (Nov 2026 cost log), so it is not run for 18,700 open bids. Instead
  `public_bid_listings()` now returns the posted files' names (strata-parse
  `20261109121000`, names only, never links), and bid pages list them, tagging
  statements of work, wage determinations and amendments and flagging the forms
  GovHub fills out (SF 30, SF 1449, SF 330, pricing sheets, reps and certs, past
  performance questionnaires). On the 2026-11-09 build: 4,741 of 14,000 bid pages
  have the list, 478 flag a form. Rules: `src/lib/bids/documents.ts`.
- **Start the analysis after signup.** "Start a proposal for this bid", "Fill out
  this bid's forms" and "Open these documents in GovHub" add `analyze=1`. The app
  presses Analyze this RFP once, for that bid, only when the bid is open and the
  account has no project yet; anyone else gets the button. Tracked in PostHog as
  `opportunity_auto_analyze`.
- **Found on the way: the linked bid did not open.** The app opened a listing only
  if it was in the first 50 rows of the feed it loaded, so most bid-page signups
  landed on their inbox, not their bid. The app now fetches the linked listing on
  its own (`opp_row`, strata-parse `20261109120000`).

## Next up (unchanged from the list)

- Agency and city hubs where there are enough open bids.
- Awarded bid pages. Closed bids have pages again since 2026-11-09 (see the
  indexing check above), as far as the 14,000 slots allow.
- Log Opportunities inbox searches and filters, and turn repeated queries into hubs.
- Weekly Monday Search Console pull, flagging new zero-click pages and
  identifier-style queries.

## Baseline to measure against

- Search Console clicks: about 8 a day Oct 20 to Nov 1; 47 on Nov 4 and 68 on Nov 5.
- GA4 organic sessions: about 14 a day Oct 24 to Nov 3; 75 a day on Nov 5 and 6.
  About three quarters landed on `/bids/`.
- Trials: 3 Google signups on Nov 5 and 6 landed directly on bid pages.
