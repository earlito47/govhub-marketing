# SEO strategy week 1: attribution

Week 1 of the Q4 2026 SEO + AI Search Strategy is "fix attribution first":
nothing else in the plan is measurable until a signup or a booked demo can be
tied to the page and source that brought it in. This records what was broken,
what changed on 2026-10-31, the link-tagging convention every campaign should
follow, and what is still open. The "before" numbers are in
[seo-baseline-2026-10.md](seo-baseline-2026-10.md).

## Why 0 of 63 signups had a source

The database side was built and correct: `handle_new_user()` reads
`utm_*`, `referrer`, `landing_path` and `first_seen_at` out of signup metadata,
and `set_first_touch_attribution()` exists for OAuth. Three breaks in the app
(`strata-parse`) meant nothing ever reached them:

1. **Two cookie formats under one name.** www writes `gh_ft` as
   `{ t, lp, rf, utm_* }` (`src/components/Analytics.astro`). The app expected
   `{ first_seen_at, landing_page, referrer }`, so for anyone who started on
   www it sent no timestamp, and the trigger only records a first touch when
   `first_seen_at` is present. All 6 email and Google signups since September
   sent zero attribution keys.
2. **Wrong key name.** The app sent `landing_page`; the trigger reads
   `landing_path`. No profile could ever get a landing page.
3. **Google sign-in had no path.** Nothing called
   `set_first_touch_attribution`.

Outreach-proposal accounts are created server-side before the lead visits, so
they had no cookie to forward at all.

## What changed

| Where | Change |
|---|---|
| `strata-parse` `src/lib/attribution.ts` | Reads both cookie shapes; sends `landing_path` |
| `strata-parse` `src/contexts/AuthContext.tsx` | Calls `set_first_touch_attribution` once for a new Google account |
| `strata-parse` `supabase/functions/outreach-stage` | Outreach accounts get `instantly / email / proposal_handover` |
| `strata-parse` `scripts/attribution-tests` | `npm run test:attribution` pins all of the above (21 pass; 13 fail on the old code) |
| `src/layouts/BaseLayout.astro` | Calendly bookings carry UTMs (below) |
| `scripts/content`, `scripts/outreach` | LinkedIn and Instantly links carry UTMs (below) |

None of it affects existing profiles: the 63 stay blank unless backfilled.
Signups from the deploy onward are attributed.

## Link-tagging convention

Every link we post or mail to govhub.online carries all three tags. Without
them a click lands as direct traffic, which is where most of October's
"direct" homepage visitors came from.

| Channel | utm_source | utm_medium | utm_campaign |
|---|---|---|---|
| LinkedIn weekly blog post | linkedin | social | weekly_post |
| LinkedIn daily post | linkedin | social | daily_post |
| Instantly wave 1, email 3 | instantly | email | wave1 |
| Reply desk matrix-builder link | instantly | email | reply_desk |
| Blank-field follow-up signup link | instantly | email | blank_field_followup |
| Outreach-proposal accounts (server-side) | instantly | email | proposal_handover |

New campaigns: lowercase, `snake_case` campaign names, link to `www` (the apex
301 costs a hop), and put the query before any `#fragment`.

**Calendly bookings** carry the visitor's first touch, so the booking itself
says where it came from:

| Calendly field | Value |
|---|---|
| utm_source | first-touch utm_source, else the referrer host, else `(direct)` |
| utm_medium | first-touch utm_medium, else `organic`, `ai`, `referral` or `(none)` from the referrer |
| utm_campaign | first-touch utm_campaign, when there is one |
| utm_content | the page the Book a Demo badge was clicked on |
| utm_term | the first-touch landing page |

## Signups that already happened

PostHog has a first touch for 5 of the 7 external self-serve signups since
July:

| Signup | Came from | Landed on |
|---|---|---|
| Sep 7 (Google sign-in) | ChatGPT (`utm_source=chatgpt.com`) | homepage |
| Sep 25 | direct | homepage |
| Oct 6 | www, then the app signup page | /signup |
| Oct 12 (Google sign-in) | Google search | /pricing/ |
| Oct 26 | direct | homepage |
| Jul 5, Jul 24 | not in PostHog (before www analytics) | |

The Oct 26 signup geolocates to the same city as the founder's test booking
and was created three minutes before the Oct 26 demo started, so it may have
been set up from our side for that demo rather than by the prospect. Confirm
before treating it as a staffing-firm signup.

## Still open in week 1

These need someone with the dashboard login:

- [ ] **GA4 AI Assistant channel.** Admin → Data display → Channel groups →
  Create new channel group. Copy the default group, add a channel named
  `AI Assistant` with condition *Session source* matches regex
  `chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|copilot\.com`,
  and move it above Referral.
- [ ] **Bing Webmaster Tools.** Add the site at bing.com/webmasters and choose
  "Import from Google Search Console" (no DNS or file step). Then open
  the AI Performance report; its first read is the Copilot-citations baseline.
- [ ] **Calendly question.** Event type "30 Minute Demo: GovHub" → Booking form
  → Invitee questions → add a required "How did you find GovHub?" question with Google, ChatGPT or
  other AI, referral, LinkedIn, email from us, other.
- [ ] **Sync the wave 1 copy** to Instantly so email 3 sends the tagged link:
  `node scripts/outreach/instantly-wave1.mjs --sync`, then `--verify`. It
  updates the live campaigns in place and never starts or stops them.

Done or confirmed:

- [x] First-touch capture fixed for email, Google and outreach signups.
- [x] UTMs passed to Calendly on every Book a Demo booking.
- [x] Campaign links tagged.
- [x] PostHog checked for existing signups (table above).
- [x] Search Console is readable from Claude sessions (the
  `GSC_SERVICE_ACCOUNT_JSON` service account).
- [x] AI crawlers are allowed: `robots.txt` allows them and Cloudflare is not
  adding a block; OAI-SearchBot, PerplexityBot, Claude-SearchBot and GPTBot user
  agents get 200s.
- [ ] "How did you find GovHub?" in app onboarding: not built yet.

## How to check it worked

After both repos deploy, sign up once through www with a tagged link, for
example `https://www.govhub.online/?utm_source=test&utm_medium=test&utm_campaign=week1`,
then:

```sql
select utm_source, utm_medium, utm_campaign, referrer, landing_path, first_seen_at, first_touch_captured_at
from user_profiles order by created_at desc limit 1;
```

Every column should be filled except `referrer`, which stays empty for a
link typed into the address bar. Delete the test account afterwards.
