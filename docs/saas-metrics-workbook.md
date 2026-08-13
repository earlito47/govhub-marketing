# GovHub SaaS metrics workbook — data sources and findings

Rebuilt 2026-08-13. Artifact: `docs/GovHub_SaaS_Metrics_v2.xlsx`.
Generator: `scripts/finance/build-saas-workbook.py` (needs `openpyxl`).

The generator is the source of truth for every actual in the workbook. Each
number is a named constant at the top of the script with the query or file it
came from. Re-run it to rebuild, then recalculate with LibreOffice so the
formula cache is populated:

```bash
python3 scripts/finance/build-saas-workbook.py
soffice --headless --convert-to xlsx --outdir . GovHub_SaaS_Metrics_v2.xlsx
```

## Why it was rebuilt

The July 2026 workbook (`GovHub_SaaS_Metrics` in Drive, created 2026-07-05)
reported $1,085 MRR, 5 paying customers, 4,250 organic clicks and 10,000 cold
emails sent. None of it was real. It was placeholder data written to exercise
the formulas — the README labelled months Jan–Jun 2026 "ILLUSTRATIVE SAMPLE
DATA" — and it was never overwritten with actuals. Every one of those figures
is replaced below with a queried value.

## Actuals as of 2026-08-13

### Product and funnel — Supabase `GovProp` (`iqekrwearenblsmhvdjn`)

| Metric | Value | Source |
|---|---|---|
| Signups (all-time) | 30 | `user_profiles` where `deleted_at is null` |
| — external (not founder alias / test) | 9 | email-domain classification |
| — internal / test | 21 | founder aliases, QA accounts |
| Activated (onboarding complete) | 21 | `user_profiles.onboarding_completed` |
| Proposals generated | 30 | `v2_submissions` (2026-05 → 2026-08) |
| Trials started | 29 | `accounts.trial_start` |
| Trials expired | 26 | `trial_end <= now()` |
| Trials active | 3 | `trial_end > now()` |
| **Paying customers** | **0** | `subscriptions` — zero rows carry a `stripe_subscription_id` |
| **MRR** | **$0** | consequence of the above |

Signups by month: 2025-09 (1), 2025-10 (11), 2025-11 (1), 2025-12 (1),
2026-03 (1), 2026-07 (12), 2026-08 (3 MTD).

Live price list from `plans`: Trial $0 / Solo $129 / Pro $349 / Team $699 per
month; annual is 10× monthly. **Every row has a null `stripe_price_id`** for
both monthly and annual — there is no code path that can charge a card today.
Trial → paid is therefore 0% structurally, not behaviourally.

Anthropic API spend from `v2_token_usage.est_cost_usd`: $0.19 (Jun-26),
$26.75 (Jul-26), $7.90 (Aug-26 MTD). API cost is not a margin concern.

### SEO — Semrush `us` database, pulled 2026-08-13

| Month | Organic keywords | Est. traffic |
|---|---|---|
| 2025-12 → 2026-06 | 1 | 0 |
| 2026-07 | 90 | 21 |
| 2026-08 | 114 | 20 |

This inflection is real and it is the strongest number in the business.

Top keyword by traffic share: **`govwin`, position 23, 9,900 searches/month,
$12.59 CPC — 70% of all organic traffic**, landing on `/vs/govwin-iq/`.
Moving it from page 3 into the top 10 is the single highest-leverage SEO action
available. Also ranking: `gov hub` (pos 7), `govwin iq pricing` (pos 14),
`responsive io alternative` (pos 29), `govtribe pricing` (pos 40).

Google Search Console (property verified 2026-06-20): 5 clicks per 28-day
window at 2026-07-16, 15 clicks at 2026-07-24.

### Cold email — Instantly, per `docs/instantly-wave1.md`

**Zero emails have been sent.** Three campaigns were created 2026-08-12 and
left in Draft with zero leads. 16 domains were purchased 2026-08-06; 12
mailboxes are warmed to score 100 with roughly 54 warmup emails each, which is
not a sending history. Earliest defensible launch is **2026-08-27** (day 21);
day 30 (2026-09-05) is safer.

A separate motion *is* sending: vendor/PR outreach via Resend has delivered 48
emails (10 in Jul-26, 38 in Aug-26) from a 91-row ledger, 43 of which had no
contact found. There is no open/click/reply tracking on it — `email_events` has
0 rows — so its funnel contribution is currently unmeasurable. Wiring Resend
webhooks into that table would fix it cheaply.

## Cost stack (founder-provided 2026-08-13)

**Operational** — Claude $100.00/mo · Anthropic API variable · OpenAI API
variable · Resend $20.00/mo · Cloudflare $5.00/mo · govhub.online $40.00/yr
(renews 9/26).

**Marketing** — Postiz $29.00/mo · Instantly.ai $99.00/mo · Apollo $59.00/mo ·
MillionVerifier $59.00/mo · 16 cold-email domains $141.00 first year, then
$10.00/yr each ($160.00/yr).

Total monthly burn at current run-rate: **$393.98** (operational $136.23 +
marketing $257.75). Annualised: ~$4,728. Lovable is decommissioned and removed.

Apollo is flagged as uncertain — the workbook carries a scenario block for it
at $0 / $59 / $159 per month.

Two open items:

1. **Supabase is not in the cost list** but the GovProp project is
   `ACTIVE_HEALTHY` and serving production. Either it is on the free tier (a
   capacity risk) or it is billed (a missing cost line). Stubbed at $0.
2. **No labour cost is booked anywhere.** The Calculator imputes $5,000/mo of
   founder time to sales & marketing by default, because at $0 the CAC is just
   the software bill and LTV:CAC comes out around 65x — not a number to present.

## Modelled unit economics (Calculator defaults)

Not actuals. These are what the model produces at its stated assumptions, and
the workbook keeps them in a separate column from the actuals throughout.

| Metric | Value |
|---|---|
| Effective ARPA | $237 |
| New customers / mo | 4.2 |
| Blended CAC (fully loaded) | $1,266 |
| LTV (GM-adjusted) | $4,026 |
| LTV : CAC | 3.2x |
| CAC payback | 6.3 months |
| Ceiling if acquisition never grows | $19,668 MRR |
| Months to $10k MRR | 13.8 |

24-month projection (Sep-26 → Aug-28, assumes billing ships and cold email
launches): MRR $12,758 at month 12, $31,623 at month 24, ARR $379k, 124
customers, first cash-flow-positive month Apr-27.
