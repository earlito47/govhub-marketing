# SEO and AI search baseline, October 2026

The frozen "before" picture, captured on 2026-10-30 before any work from the
Q4 2026 SEO + AI Search Strategy ships. Every later read of the strategy's
scorecard is measured against this file and
`data/seo-baseline-2026-10.json`.

**Baseline window: 2026-10-01 to 2026-10-28** (28 days, ending on the latest
day Search Console has final data for). The comparison window is
2026-09-03 to 2026-09-30, and "last 7 days" is 2026-10-22 to 2026-10-28. Re-pull
on the same definitions (bottom of this file) at each 30/60/90 gate.

## The baseline in one table

| Metric | Oct 1 to 28 | Sep 3 to 30 | Change | Oct 22 to 28 | Source |
|---|---|---|---|---|---|
| **Organic clicks (Google)** | **199** | 142 | +40% | 52 | Search Console |
| Organic impressions | 23,973 | 19,091 | +26% | 9,895 | Search Console |
| CTR | 0.83% | 0.74% | +0.09 pts | 0.53% | Search Console |
| Average position | 9.7 | 9.5 | | 8.8 | Search Console |
| **Keywords with impressions** | **721** | 630 | +14% | 371 | Search Console |
| Keywords in top 10 (avg position) | 274 | 273 | flat | 128 | Search Console |
| Keywords in top 3 | 82 | 74 | +11% | 36 | Search Console |
| Ranking keywords, US top 100 | 197 (Oct) | 182 (Sep) | +8% | | Semrush estimate |
| Ranking keywords, US top 10 | 11 (Oct) | 9 (Sep) | | | Semrush estimate |
| Unique visitors, raw | 1,403 | 707 \* | | 313 | PostHog |
| **Unique visitors, bot-filtered** | **920** | 524 \* | | 205 | PostHog |
| Organic search visitors | 259 | 180 \* | | 84 | PostHog |
| AI assistant visitors | 14 | 15 \* | | 3 | PostHog |
| Free trials started, all | 29 | 3 | | 25 | Supabase |
| **Free trials started, external** | **25** | 2 | | 23 | Supabase |
| **Self-serve trials (site, not outreach)** | **3** | 2 | | 1 | Supabase |
| Active trials today | 27 (23 external) | | | | Supabase |
| Paying customers | 0 | 0 | | 0 | Supabase |
| **Demo button clicks** | **not tracked** | not tracked | | not tracked | none |
| **Demos scheduled (Calendly)** | **1** | 0 | | 0 | Calendly via Gmail |

\* PostHog only has www data from 2026-09-06 (analytics was off the site in
August), so these cover Sep 6 to 30, 25 days. Do not read them as a 28-day
change.

## What the baseline says

- **Search traffic is already growing without the strategy.** Monthly clicks
  went 24 (Jul), 70 (Aug), 150 (Sep), 199 (Oct, 28 days). A later rise in total
  clicks is not proof the strategy worked. The clean test is the strategy's own
  folders, which start at roughly zero: `/bids/` 0, `/portals/` 0, `/for/` 0
  clicks, `/forms/` 8 (all from one PDF).
- **Insights pages bring in most search traffic:** 137 of 199 clicks (69%) from
  381 pages. `/insights/top-government-contractors/` alone gets 29.
- **October trials came from outreach, not the site.** 22 of 25 external trials
  were created by the outreach proposal handover. Only 3 external trials in 28
  days came through the site on their own. That 3 is the number SEO has to
  move.
- **Raw visitor counts are inflated.** 483 of 1,403 visitors (34%) came from
  Budapest, China or US cloud data centers, and 9 in 10 of them arrived direct
  on the homepage, which looks like link scanners rather than people. Use the
  filtered 920.
- **Two of the north-star metrics cannot be measured today.** Clicks on the
  Book a Demo button send no event anywhere, and 0 of 63 signups have a
  referrer, landing page or UTM saved. Both are week 1 fixes in the strategy
  (see "Gaps" below).

## 1. Clicks from search (Search Console)

Property `sc-domain:govhub.online`, all countries, web search. US alone was 165
clicks and 16,538 impressions in the baseline window.

| Month | Clicks | Impressions |
|---|---|---|
| 2026-06 (verified Jun 19) | 1 | 129 |
| 2026-07 | 24 | 4,134 |
| 2026-08 | 70 | 13,690 |
| 2026-09 | 150 | 20,986 |
| 2026-10 (1 to 28) | 199 | 23,973 |

Last 90 days (Jul 31 to Oct 28): 420 clicks, 58,973 impressions.

**By site folder, Oct 1 to 28.** The strategy's scorecard tracks the bold
rows.

| Folder | Pages with impressions | Clicks | Impressions |
|---|---|---|---|
| /insights/ | 381 | 137 | 16,568 |
| /blog/ | 22 | 25 | 1,822 |
| / (homepage) | 2 | 15 | 2,275 |
| /solutions/ | 7 | 9 | 801 |
| **/forms/** | 1 | 8 | 199 |
| /vs/ | 5 | 2 | 573 |
| /glossary/ | 7 | 2 | 214 |
| /alternatives/ | 4 | 0 | 934 |
| /faq/ | 8 | 0 | 436 |
| /pricing/ | 1 | 0 | 221 |
| **/for/** | 2 | 0 | 19 |
| **/bids/** | 0 (folder does not exist) | 0 | 0 |
| **/portals/** | 0 (folder does not exist) | 0 | 0 |

**Top pages by clicks, Oct 1 to 28**

| Page | Clicks | Impressions | Avg position |
|---|---|---|---|
| /insights/top-government-contractors/ | 29 | 2,649 | 14.7 |
| / | 15 | 2,274 | 4.9 |
| /forms/sf330-rev-2021-07.pdf | 8 | 199 | 8.4 |
| /blog/govwin-iq-pricing-real-ranges-terms-roi/ | 6 | 678 | 8.2 |
| /insights/expiring-federal-contracts/ | 6 | 244 | 6.6 |
| /blog/how-to-fill-out-sf330/ | 5 | 201 | 7.1 |
| /blog/biggest-government-contractors-top-10/ | 5 | 153 | 9.0 |
| /solutions/ai-proposal-generator/ | 3 | 291 | 24.2 |
| /blog/color-team-reviews-pink-red-gold/ | 3 | 130 | 8.1 |
| /insights/vendor/govcio/ | 3 | 124 | 6.2 |

**Most clicks cannot be tied to a query.** Only 14 of the 199 clicks (7%) are
on a query Google shows. The rest are anonymized, so a brand vs non-brand split
by query is not possible. The visible brand terms ("govhub" 6, "gov hub" 1)
plus 15 homepage clicks are the closest proxy.

**Cross-check:** PostHog counted 191 visitors arriving from www.google.com in
the same window, against 199 Search Console clicks. The two agree, so the
PostHog channel numbers below can be trusted for search.

## 2. Keywords we rank for

**Search Console (actual Google data).** Distinct queries with at least one
impression, bucketed by each query's average position.

| | Oct 1 to 28 | Sep 3 to 30 | Oct 22 to 28 |
|---|---|---|---|
| Queries with impressions | 721 | 630 | 371 |
| Position 1 to 3 | 82 | 74 | 36 |
| Position 4 to 10 | 192 | 199 | 92 |
| Position 11 to 20 | 117 | 86 | 65 |
| Position 21 to 50 | 199 | 144 | 109 |
| Position 51+ | 131 | 127 | 69 |
| Queries with at least 1 click | 9 | 11 | 1 |

**Semrush (US estimate, monthly).** Keywords ranking in the top 100.

| Month | Keywords | Top 3 | 4 to 10 | 11 to 20 | Est. traffic |
|---|---|---|---|---|---|
| 2026-06 | 1 | 0 | 0 | 0 | 0 |
| 2026-07 | 90 | 0 | 0 | 5 | 21 |
| 2026-08 | 167 | 0 | 5 | 12 | 39 |
| 2026-09 | 182 | 2 | 7 | 21 | 128 |
| 2026-10 | 197 | 4 | 7 | 28 | 125 |

181 of the 197 October keywords have an AI Overview on the results page.

**Strategy keyword clusters, Oct 1 to 28.** Search Console queries matching
each cluster in the strategy. This is the starting line for the new page
types.

| # | Cluster | Queries | Impressions | Clicks | In top 10 | Note |
|---|---|---|---|---|---|---|
| 1 | Procurement portals | 0 | 0 | 0 | 0 | No portal terms at all |
| 2 | Government forms | 8 | 76 | 0 | 4 | Almost all SF 330; "sf330" at 12.0 |
| 3 | Bid categories | 0 | 0 | 0 | 0 | 12 queries contain "bid" but all are AI proposal tool phrasing |
| 4 | Competitor comparisons | 88 | 1,127 | 1 | 28 | Loopio and Responsive alternatives lead |
| 5 | Persona / industry | 4 | 9 | 0 | 2 | Healthcare only |
| 6 | How-to and definitions | 6 | 40 | 0 | 2 | "rfq vs rfp" at 64.4 |
| 7 | Head terms | 2 | 2 | 0 | 2 | Single impressions |

**The strategy's ranking keywords, re-read in Search Console.** The strategy's
positions are Semrush estimates; the Search Console column is what Google
actually reported for Oct 1 to 28.

| Keyword | Semrush (strategy doc) | GSC avg position | Impressions | Clicks |
|---|---|---|---|---|
| rhode island itsm contract awards | 2 | 2.9 | 87 | 0 |
| rfp matrix generator | 3 | 5.7 | 3 | 0 |
| gov hub | 3 | 4.5 | 243 | 1 |
| govhub | 9 | 4.1 | 1,210 | 6 |
| how much does govwin cost | 10 | 4.3 | 25 | 0 |
| loopio competitors | 12 | 10.4 | 78 | 0 |
| top government contractors | 15 | 17.5 | 44 | 0 |
| govwin | 22 | 29.6 | 40 | 0 |
| palantir government contracts | 25 | 11.5 | 4 | 0 |
| sf330s | 41 | no data | 0 | 0 |

Target terms from clusters 1 to 3 with no impressions yet: commbuys,
cal eprocure, njstart, planetbids, bidnet direct, bidprime, sf 1449, sf 30,
dd 254, construction bids, government cleaning contracts, government bids,
how to find government contracts.

## 3. Unique visitors (PostHog, www.govhub.online)

| | Oct 1 to 28 | Sep 6 to 30 | Oct 22 to 28 |
|---|---|---|---|
| Unique visitors, raw | 1,403 | 707 | 313 |
| Unique visitors, bot-filtered | 920 | 524 | 205 |
| US visitors, raw / filtered | 679 / 512 | | |
| Pageviews | 1,598 | 836 | 335 |
| Sessions | 1,448 | 732 | 319 |
| Organic search visitors | 259 | 180 | 84 |
| AI assistant visitors | 14 | 15 | 3 |
| Visitors with 2+ pageviews | 95 | | |

**Where they came from, Oct 1 to 28** (session entry referrer): direct 1,118 ·
Google 191 · Bing 59 · app.govhub.online 18 · Yahoo 6 · DuckDuckGo 4 ·
AI assistants 14 (ChatGPT, Gemini, Copilot) · LinkedIn 1.

**Bot filter.** Removed from the raw count: 285 visitors from Budapest (all
direct, present since mid-September at up to 35 a day), 167 from US cloud data
center cities (Ashburn, Boardman, Council Bluffs, North Charleston and
similar), and 31 from China. Of those 483, 430 arrived direct on the homepage. The full rule is in the JSON
snapshot's `definitions`.

**Entry pages.** The homepage is the entry page for 938 visitors. The next
highest are /insights/top-government-contractors/ (37),
/insights/largest-federal-contracts-fy2026/ (35), /blog/how-to-fill-out-sf330/
(17) and /solutions/compliance-matrix-generator/ (14).

## 4. North-star funnel

**Free trial users.** Every signup gets a 14-day trial at once, so signups and
trials are the same count.

| Source | Oct 1 to 28 | Sep 3 to 30 | Oct 22 to 28 |
|---|---|---|---|
| Outreach proposal handover | 22 | 0 | 22 |
| Self-serve, email signup | 2 | 1 | 1 |
| Self-serve, Google sign-in | 1 | 1 | 0 |
| **External total** | **25** | **2** | **23** |
| Internal / test | 4 | 1 | 2 |
| All | 29 | 3 | 25 |

All time: 63 signups, 62 trials started, 27 active today (23 external), 34
expired, **0 paying** (no account has a Stripe subscription; one Team-plan
account created Oct 28 is active without one). "Google" in `signup_source` is
the sign-in method, not proof the person came from Google search.

**Demo button clicks: not tracked.** The site-wide Calendly "Book a Demo"
badge (`src/layouts/BaseLayout.astro`) loads, but no click or booking event
reaches PostHog or GA4. PostHog has exactly one `book_demo_clicked` event, from
the app on 2026-07-17. The baseline is unknown, not zero.

**Demos scheduled: 1.** One booking on the "30 Minute Demo: GovHub" event
type, made Oct 20 for Oct 26, by a company president who was not on any
outreach list (probably the staffing firm that signed up on Oct 26, still to be
confirmed). No other GovHub demo bookings exist in Calendly's notifications.

## Gaps to close in week 1

Without these, the next read can only repeat today's caveats.

1. **Track demo clicks and bookings.** Send a `demo_click` event when the
   Calendly badge is clicked, and a `demo_scheduled` event on Calendly's
   `calendly.event_scheduled` message, through the existing `track()` in
   `Analytics.astro`. *Done 2026-10-30 (`src/layouts/BaseLayout.astro`).
   Both events go to GA4 and PostHog with the page and the visitor's first
   touch. Demo click counts start from the deploy date, so the first full
   28-day read is the demo-click baseline.*
2. **Write first touch onto signups.** PostHog's `landing_view` event already
   records `is_first_touch`, `referrer_host`, `page_path` and the UTMs on www.
   The data is captured; it just never reaches `user_profiles` at signup.
3. **Bing Webmaster Tools.** Copilot citations have no baseline because the
   site is not verified there yet. Record the first AI Performance read as
   that metric's baseline.
4. **Sources not used here.** GA4 was not pulled (PostHog holds the same
   events). The Cloudflare token in this environment cannot read Web
   Analytics, and the connected Ahrefs plan cannot read Site Explorer or GSC
   projects.

## How each number was pulled

Re-run these with the same windows to get a comparable read.

- **Search Console:** `searchanalytics.query` on `sc-domain:govhub.online`,
  default `dataState` (final), with no dimension for totals, `query` for
  keyword counts and `page` for folders. Uses the `GSC_SERVICE_ACCOUNT_JSON`
  service account that `weekly-content` already uses.
- **Semrush:** `domain_rank` and `resource_rank_history` for `govhub.online`,
  database `us`.
- **PostHog:** project 481080, HogQL on `events` where
  `event = '$pageview'` and `properties.$host = 'www.govhub.online'`.
  Visitors are `count(distinct person_id)`. Channel comes from
  `properties.$session_entry_referring_domain` and `properties.utm_source`.
- **Supabase (GovProp `iqekrwearenblsmhvdjn`):** `user_profiles` (not
  deleted) by `created_at` and `signup_source`; `accounts.trial_start` and
  `trial_end`; `accounts.stripe_subscription_id` for paid. External excludes
  founder aliases, `@govhub.online`, test and example addresses, and the
  `outreach_stage_harness` account.
- **Calendly:** Gmail search `from:notifications@calendly.com subject:"New Event"`,
  counting the "30 Minute Demo: GovHub" event type by booking date.
