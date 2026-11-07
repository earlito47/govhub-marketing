# Traffic check, 2026-11-07: the November bump

Search clicks jumped from 4 to 14 a day to 47, 67 and 70 on Nov 4, 5 and 6.
This note records what drove it, whether it is people or bots, and which
numbers to trust when reporting traffic. It is the reference point for the
Dec 1 indexing check in the strategy. The "before" numbers are in
[seo-baseline-2026-10.md](seo-baseline-2026-10.md).

Sources: Search Console (`sc-domain:govhub.online`), GA4 (property
`properties/542598881`, "GovHub.online"), PostHog (project 481080) and the
app database's `user_profiles` (first-touch columns only). Search Console's
latest days are preliminary and can still move a little.

## Verdict

- **The click jump is people, from Google, landing on bid pages.** 84% of the
  Nov 4 to 6 clicks went to `/bids/` (155 of 184), spread over 125 different
  pages. The bid pages launched Oct 31; this is them getting indexed and ranking.
- **Bot traffic also rose, but not in search clicks.** It is in GA4's Direct
  and Unassigned channels: data-centre cities, fixed screen sizes, almost no
  engagement.
- **The search visitors convert.** 5 people signed up from Google search on
  Nov 5 and 6; 3 of them landed first on a bid page. The baseline had about 7
  self-serve signups from July through October.

The timing is the bid pages, not the orphan-link fix (#115). That fix went
live in the afternoon of Nov 4, and the jump had already started that day.
The fix should add to it over the following weeks.

## Search Console

**Clicks by day**

| Day | Clicks | Impressions | CTR | Avg position |
|---|---|---|---|---|
| Oct 28 | 7 | 1,366 | 0.5% | 7.8 |
| Oct 29 | 10 | 1,677 | 0.6% | 9.7 |
| Oct 30 | 8 | 1,703 | 0.5% | 8.3 |
| Oct 31 | 4 | 1,342 | 0.3% | 7.6 |
| Nov 1 | 6 | 1,303 | 0.5% | 10.2 |
| Nov 2 | 13 | 1,585 | 0.8% | 7.7 |
| Nov 3 | 14 | 2,216 | 0.6% | 8.9 |
| **Nov 4** | **47** | 2,613 | 1.8% | 7.5 |
| **Nov 5** | **67** | 2,758 | 2.4% | 8.7 |
| **Nov 6** | **70** | 3,505 | 2.0% | 7.7 |

**Clicks by section**

| Section | Oct 28 to Nov 3 (7 days) | Nov 4 to 6 (3 days) |
|---|---|---|
| Individual bid pages | 3 | **127** (100 pages) |
| Bid hubs and lists | 3 | **28** (25 pages) |
| Insights | 39 | 15 |
| Homepage | 5 | 6 |
| Blog | 7 | 3 |
| Everything else | 5 | 5 |
| **Total** | **62** | **184** |

Insights held steady at about 5 clicks a day; the rest of the site did not change.

**Bid pages appearing in Google:** 1,082 `/bids/` pages had impressions on
Nov 4 to 6, against 145 in the 7 days before. This is the best proxy the API
gives for "indexed and ranking"; the Pages report in the Search Console UI is
the authoritative count for Dec 1.

**Who clicked:** 163 of 184 clicks from the US. 141 desktop, 42 mobile.
Google hides most queries (only 9 of the 184 clicks have a visible query). The
visible ones are brand ("govhub", "gov hub") and long-tail searches naming a
specific solicitation. The bid pages rank at positions 1 to 5 for those.

## GA4

**Sessions by channel**

| Channel | Oct 28 to Nov 3 (7 days) | Nov 4 to 6 (3 days) | Engaged, before → after | Avg session, before → after |
|---|---|---|---|---|
| Organic Search | 94 (13/day) | **198 (66/day)** | 50% → 47% | 143s → 92s |
| Direct | 394 (56/day) | 409 (136/day) | 11% → **5%** | 18s → **4s** |
| Unassigned | 257 (37/day) | 153 (51/day) | 8% → **3%** | 49s → 48s |

GA4's 198 Organic Search sessions match Search Console's 184 clicks. Their
engagement rate held. Daily Organic Search sessions were 50, 75 and 73 on
Nov 4 to 6, against 4 to 22 a day before.

**Organic Search looks like people:**
- **Location:** spread across US cities (Atlanta, New York, Denver and others).
  Only 5 sessions came from a data-centre location (Boardman, Oregon).
- **Screens:** ordinary sizes. 1920×1080 is the most common, then laptop
  sizes and iPhones.
- **New visitors:** 186 of 198 are new users, as expected from search.
- **Landing pages:** 150 of 198 on `/bids/`, 47% engaged.

**Direct and Unassigned look like bots:**
- **Location:** 150 Direct sessions came from Ashburn, Virginia, Amazon's main
  US data-centre hub. Others came from Budapest (54) and Singapore (83 Direct,
  91 Unassigned).
- **Fixed screens:** exactly 150 sessions report a 1280×1600 screen,
  matching the Ashburn count, and 173 report 1280×1200 (the Singapore traffic).
  Automated browsers run with a fixed window size.
- **Missing details:** 152 Direct sessions have no browser recorded, and 119
  land on the homepage.

These are automated browsers that run JavaScript (AI tools, monitoring,
crawlers). They inflate GA4's Users and Sessions totals, but not Search
Console clicks or the Organic Search channel.

## PostHog

**Google-referred landings on www, by day:** 12, 9, 13, 6, 4, 14, 14 from
Oct 28 to Nov 3, then **39, 67, 75** on Nov 4 to 6 (28, 56 and 60 of them on
`/bids/`).

**Signs these are real browsers:** the 180 people behind them on Nov 4 to 6
sent 626 Web Vitals measurements, 321 pageviews and 304 page-leave events.
Only browsers that actually render and use the page send those.

**What they did next:** 2 completed signup (PostHog), 5 logged in, one
clicked "Book a demo", and one analysed an RFP and created a proposal in the
app. Trial clicks from bid pages that reached the app's signup page: 3, 7 and
2 on Nov 5, 6 and 7.

**A separate bot spike on Nov 2:** 197 views of the app's signup page from bid
pages' trial links, all headless Chrome on Linux at 1920 wide, mostly with no
city. That was a crawler following links. It did not recur.

## Signups (app database, first touch)

| Day | Source | First page |
|---|---|---|
| Oct 28 to 30 | none recorded (4 signups; attribution fixed Oct 31) | |
| Nov 3 | Instantly email, proposal handover | /open-proposal |
| Nov 5 | Google | / |
| Nov 6 | Google | a Georgia bid page |
| Nov 6 | Google | / |
| Nov 6 | Google | a Georgia bid page |
| Nov 6 | Google | a Tennessee bid page |
| Nov 7 | Instantly email, proposal handover (3) | /open-proposal |

Five signups from Google search in two days, three of them straight from a bid page.

## Which numbers to report

- **Human traffic from search:** Search Console clicks, and GA4 Organic Search
  sessions (engaged sessions if you want one stricter number). Neither
  includes the bots above.
- **Do not report GA4 total Users or Sessions as visitors.** Direct and
  Unassigned are mostly bots this week.
- **To clean GA4 totals:** in an exploration, exclude the cities Ashburn,
  Singapore and Budapest, or the screen sizes 1280×1600 and 1280×1200. That
  removes most of this week's bot traffic.
- **Outcomes:** signups by first-touch source (`user_profiles`) and
  `demo_click` in PostHog.

## Reproducing this

- **Access:** the `GSC_SERVICE_ACCOUNT_JSON` service account reads both
  Search Console and GA4. Use scopes `webmasters.readonly` and
  `analytics.readonly`; the Admin API's account summaries list the GA4 property.
- **Search Console:** `searchanalytics.query` on `sc-domain:govhub.online`
  with dimensions `date`, `page`, `country`, `device` and `query`, and
  `dataState: all`.
- **GA4:** `runReport` on `properties/542598881`, split by
  `sessionDefaultChannelGroup`, `landingPage`, `city`, `screenResolution`,
  `browser` and `newVsReturning`. Metrics: sessions, engaged sessions,
  average session duration and pages per session.
- **PostHog:** `landing_view` events where `referrer_host` contains `google.`,
  then those visitors' later events. App signup pageviews are matched on
  `gh_cta=bid` in the URL.
