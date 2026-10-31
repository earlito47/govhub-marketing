# How competitors talk about themselves (October 2026)

What eleven competitors say on their own sites, read 2026-10-31, and what it
means for GovHub's copy now that GovHub finds and matches bids as well as
writing the response. Quotes are from each competitor's own pages unless
marked. Review-site points (G2, Capterra) came from search summaries because
those sites block automated reads: check them in a browser before quoting.

## The short version

- **Everyone sells the find step.** Every bid service opens with "win more"
  and a big coverage number (110,000 agencies, 90,000 agencies, 25,000 daily
  open bids). Those numbers rarely agree, even on the same company's own pages.
- **Hardly anyone sells what comes after.** None of the bid services
  (BidNet Direct, BidPrime, PlanetBids, DemandStar, Periscope S2G) writes a
  proposal, scores one or fills out a government form.
- **Nobody claims the whole chain.** Find, match, summarize, write, score and
  fill out forms: no competitor claims all six. The closest are Sweetspot (no
  form filling, demo only, no published price) and GovTribe (no scoring, fills
  Word/Excel/PowerPoint files only, $1,900 a seat a year).
- **So GovHub should lead with the chain, not the count.** A coverage-number
  contest is one GovHub would lose. "From finding the bid to submitting it,
  in one place, from $129 a month" is a claim nobody else can make.

## What each one does

Y = claimed on its own site. Partial = something close, described in the
notes. Blank = not mentioned.

| | Find bids | Match to your company | AI summary | Write the proposal | Score the proposal | Fill out forms |
|---|---|---|---|---|---|---|
| **GovHub** | Y | Y | Y | Y | Y | Y |
| BidNet Direct | Y | Partial (NIGP codes) | | | | |
| BidPrime | Y | Y | Y | Partial (outlines, checklists, cover letters) | | |
| PlanetBids VendorLine | Y | Y | Y | | | |
| DemandStar (Euna OpenBids) | Y | Partial (commodity codes) | | Partial ("bid templates") | | |
| Periscope S2G | Y | Partial ("matching algorithms") | | | | |
| GovSpend | Y | Y | Y | | | |
| HigherGov | Y | Partial ("recommended opportunities") | | Partial (one pricing-page line) | | |
| GovTribe | Y | Y | Y | Y (Office templates) | | Partial (Word, Excel, PowerPoint only) |
| Sweetspot | Y | Y | | Y | Y ("AI Proposal Review") | |
| Instafill.ai | | | | | | Y (any PDF) |

Loopio, Responsive and GovWin IQ are covered in `src/data/competitors.ts`
already: the first two write responses but do not find bids; GovWin forecasts
federal contracts before the RFP and does not write.

## How they describe themselves

### Bid services

| | Headline | Who it is for | Price | CTA |
|---|---|---|---|---|
| BidNet Direct (SOVRA) | "Find Public Sector Opportunities in the U.S." / "The #1 Network for U.S. Government Bids" | Suppliers; "Trusted by 1 Million Suppliers" | Free for member-agency bids; $100/mo one state, $200/mo three, $330/mo national | "Register for Free" |
| BidPrime | Site blocks automated reads; press-release boilerplate: "government opportunity intelligence, helping companies identify, qualify, and win public sector contracts" | Contractors bidding across many local agencies | Annual, by quote; one G2 reviewer cites $749 then $812 on auto-renewal | Free trial (length unconfirmed) |
| PlanetBids VendorLine | "Leveling the playing field for Public Sector Vendors"; "The Smarter Way to Win Government Contracts" | "small and mid-sized vendors"; "real businesses, not procurement pros" | Free to bid with PlanetBids agencies; Pro $547/yr, Pro Plus AI $897/yr | "Get VendorLine Now" |
| DemandStar (now Euna OpenBids) | "Win more government bids." | Small, woman- and minority-owned businesses selling to local government | Free for one agency; $60/yr a county; $100 to $1,499/yr a state; $2,699/yr national; $5 per document package outside your area | "Get Started" |
| Periscope S2G (SOVRA) | "Find Government Contracts & Bid Opportunities" | Suppliers | Free tier "only represents 2% of all available bids"; paid from $779/mo billed annually (verify in a browser) | "Try for free" |

### Govcon platforms and point tools

| | Headline | Who it is for | Price | CTA |
|---|---|---|---|---|
| GovSpend | "B2G intelligence" / "Your Public-Sector GTM Engine" | Sales and procurement teams on both sides; recommends "at least 3 people dedicated to using GovSpend" | Quote only, annual, multi-year options; onboarding "typically lasts 3 months" | "Get Started" (demo request) |
| HigherGov | "Tools to Win. Insights to Lead." | Contractors, grant seekers, consultants, investors, agencies | Starter $500/yr (1 user); Standard $2,500/yr (10 users); 2-week trial, business email required | "Free Trial" / "Schedule Demo" |
| GovTribe | "Your AI-powered govcon agent" | Federal, defense and SLED teams of 5 to 50+; a small-business page | $1,900 a seat a year (Pro $2,100), AI metered by credits; 7-day trial, no card | "Try GovTribe Free" |
| Sweetspot | "AI for Government Contracting" | BD, capture and proposal teams "with a history of past performance" | Not published; demo only | "Schedule a Demo" |
| Instafill.ai | "AI Form Filler" / "The AI does the paperwork. Not you." | Any business with high form volume; government contractors are one of many | $99/mo for 50 fills | "Try Instafill.ai" |

## Patterns worth knowing

1. **Coverage numbers are the default headline, and they are soft.** BidPrime
   says 110,000 agencies on one page and 120,000 sources on another. HigherGov
   states its source count four different ways. PlanetBids' vendor homepage
   shows placeholder zeros. GovHub's own counts come from the live data at
   build time; keep it that way, and do not inflate them to compete.
2. **"Free to bid with our agencies, pay to see the rest."** BidNet Direct,
   PlanetBids and DemandStar are agency portals first. Their free tier is the
   agencies on their network; everything else is sold by county, state or
   region. GovHub's `/bids/` pages are free to browse, with no account and no
   per-state pricing.
3. **AI claims are loud and vague.** "Powered by real AI (not just filters)",
   "the first AI-powered supplier portal", "Think ChatGPT for B2G sales".
   GovHub's stronger move is naming the output: a plain-English summary, a
   compliance matrix, a draft, a score, a filled form.
4. **Pricing friction is a theme in reviews.** Auto-renewal complaints
   (BidPrime, Periscope S2G), by-state plans (BidNet Direct, S2G, DemandStar),
   metered AI credits (GovTribe), and demo-gated pricing (GovSpend, Sweetspot,
   BidPrime). GovHub publishes a monthly price and a 14-day trial with no card.
5. **Several sell to agencies and vendors at once** (PlanetBids, GovSpend,
   HigherGov, DemandStar), so their vendor message is diluted. GovHub only
   serves contractors and can say so.
6. **Almost nobody talks to the brand-new contractor.** PlanetBids ("real
   businesses, not procurement pros") and DemandStar (small, woman- and
   minority-owned) come closest; Sweetspot explicitly targets firms with past
   performance. The "Swiss Army knife for the small jobs" angle is open.

## What this means for GovHub copy

Done in this change:

- Homepage: "Government contracting software, from finding the bid to winning
  it", with a six-step strip (Find, Match, Read, Write, Score, Fill out forms)
  under the logos. The six steps link to the matching solution pages.
- New solution page: `/solutions/government-contract-search/`, first in the
  solutions list, footer and homepage grid.
- New comparison and alternatives pages for BidNet Direct, BidPrime and
  PlanetBids, with published prices where the competitor publishes them.
- GovWin IQ pages no longer say GovHub does not find opportunities.
- A "New to government contracting?" paragraph on the homepage and the search
  page.

Rules for future copy:

- Lead with the chain and the price, not a coverage number.
- Say how matching works (NAICS codes, states, set-asides, keywords, with the
  reason for each match). Most competitors say "AI matching" and stop there.
- Name outputs, not "AI-powered".
- No "#1", "first" or "only" unless it can be shown. "No competitor we
  reviewed claims all six steps (October 2026)" is defensible; "the only
  all-in-one platform" is not.
- Before claiming "cancel anytime" or "no auto-renewal" against BidPrime or
  S2G, confirm GovHub's own billing terms.

## Next comparison pages, by search demand

US monthly searches, Semrush, 2026-10-31.

| Competitor | Brand searches | Built |
|---|---|---|
| BidNet Direct | 8,100 | Yes (this change) |
| GovSpend | 3,600 | No |
| PlanetBids | 3,600 | Yes (this change) |
| DemandStar | 2,900 | No (on the alternatives rosters) |
| BidPrime | 2,400 | Yes (this change) |
| HigherGov | 1,900 | No (on the alternatives rosters) |
| GovTribe | 1,900 | No (on the alternatives rosters) |

GovTribe and Sweetspot are the closest products to GovHub and the ones to
watch: both already match bids to a company profile and draft proposals.

## Still to verify in a browser

- BidPrime's homepage headline, CTA, trial length and any public price (its
  site blocked every automated read).
- PlanetBids VendorLine: $429/yr on its "why VendorLine" page vs $547/yr on
  its pricing page. The comparison page uses the pricing page.
- Periscope S2G: whether "$779/month billed annually" is a monthly or yearly
  figure.
- Every G2, Capterra and TrustRadius rating and quote above.
