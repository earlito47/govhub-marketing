# Implementation audit

Prompt 5 of the legal drafting pack: each promise in the draft documents checked against what the code does on the `claude/govhub-legal-drafting-zc3w14` branches of both repositories. **PASS** means the code does it on the branch. **GAP** means it does not yet. **UNVERIFIED** means it depends on something outside the repositories. This is not a certification of compliance.

## Promise by promise

| Promise (document, section) | Status | Evidence or what is missing |
|---|---|---|
| Linkshub Ltd. named as the company behind GovHub (all; footer; About; schema) | PASS | M `src/data/legal.ts`, `Footer.astro`, `about.astro`, `SchemaOrg.astro`; A email footer, sidebar |
| Affirmative acceptance at signup with version and timestamp (Terms 1) | PASS | A `Signup.tsx` checkbox, `legal_acceptances` migration and trigger. Not run against a database: test once on a Supabase branch |
| Acceptance for accounts created without a form, and re-acceptance on change (Terms 1, 19) | PASS, off by default | A `LegalAcceptanceGate.tsx`; enable with `NEW_LEGAL_DOCS_LIVE` after www publishes |
| Review AI output before relying or submitting (AUP 1, Terms 8) | PASS | A `ai-notice.ts`: once-per-session notice on every download, and in the finalize dialog |
| Agents only for paid subscribers and paid seats (AUP 3, Terms 9) | **GAP** | No server-side entitlement check exists for any feature (fact table B6). The rule is contractual only today |
| Free and trial accounts have no agent access (AUP 3, Terms 3) | **GAP** | Same. Trial and expired users have full access |
| Plan usage limits (AUP 4) | **GAP** | Proposal limits are display-only (`UsageMeter.tsx`) |
| We may rate-limit and suspend (AUP 3, Terms 14) | **GAP** | Only the assistant is rate-limited; admin "suspend" is not enforced |
| No customer API (AUP 3) | PASS | No API exists; "API access" removed from pricing |
| No training on Customer Content (Terms 6, Privacy 2) | PASS for Anthropic and OpenAI; UNVERIFIED for Lovable | Both providers' own pages (2026-11-13): API data not used for training by default. Lovable needs its workspace training setting checked |
| AI providers listed (Privacy 4, subprocessors) | PASS | List built from code. OCR vendor unnamed |
| Account data deleted within 45 days, after a 30-day grace period (Privacy 8, Terms 15, DPA 10) | PASS on branch, manual | Admin console purge (`account.purge`, migration 20261113130000) and a pending-deletion queue. Not yet run against a database |
| Export of account data, with security redactions (Privacy 10) | PASS on branch | `export-account-data` adds files (7-day links), library, assistant chats, support tickets and acceptances; `_shared/export-redact.ts` drops tokens and masks ID and account numbers; `npm run test:export` |
| Opt-out stops analytics and ad tags on www and app (Cookie Notice) | PASS | M `BaseLayout.astro` (LinkedIn fixed); A `index.html`, `main.tsx`; A `bot-filter.test.mjs` |
| GPC stops ad tags (Cookie Notice, Privacy 5) | PASS | Same files and test |
| No proposal content in analytics (Cookie Notice) | PASS on branch; **live gap** | PostHog session recording is ON for the app project (30-day retention, no masking set). The branch masks all text and inputs; until it ships, recordings can show proposal text |
| Cookie list complete (Cookie Notice) | PASS for first-party cookies; UNVERIFIED for tags inside the GTM container | |
| Consent before non-essential cookies in UK/EU | **GAP** if UK/EU visitors are targeted | No banner |
| Outreach carries ad label, opt-out and postal address (Privacy 7, company page) | PASS for angles and B-line; **GAP** for influencer and wave 1 (no ad label) | M `disclosure.mjs`; live campaigns change only after `--sync` |
| Opt-outs honored within 10 business days across all domains (Privacy 7) | PASS for Instantly programmes, once merged; **GAP** for vendor outreach and Prospector | M `reply-desk/suppress.mjs`. Endpoint verified against Instantly's API reference; the key needs block list scope |
| Every outreach domain listed (company page) | PASS | 16 domains from the code. Registrant unconfirmed |
| Security page claims match the product | PASS on branch | SAML SSO, audit trail, RBAC and SOC 2/FedRAMP wording corrected; app prerender no longer ships the old claims |
| No fabricated SOC 2, FedRAMP, CMMC or accessibility certifications | PASS on branch for live pages | Dead files in A `src/pages/*.tsx` still contain them; delete |
| Prospect emails always carry a postal address | PASS | A `prospector-action` refuses to send without one |

## What was tested

| Check | Result |
|---|---|
| M `npm run check` (astro check) | 0 errors |
| M `npm run build` | 16,208 pages built |
| M `npm run guard` | **Fails, as intended**, on the 8 pages with `[CONFIRM]` (the legal pages, /security/, /for/system-integrators/) |
| M `check:meta`, `guard:emdash`, `check:links` | Pass (the link checker needs `NODE_OPTIONS=--max-old-space-size=6144` in this environment) |
| M reply desk self-test, including new suppression tests | Pass |
| M angles, B-line, influencer, wave 1 `--check`; set-signatures `--dry-run` | Pass (no network) |
| A `tsc` | 8 errors, all pre-existing and unchanged |
| A eslint on changed files | Clean |
| A `npm run build` with prerender | Pass; `dist/index.html` no longer contains the old claims; signup prerender shows the checkbox |
| A `test:analytics` (with new consent tests), `test:proposal-reply`, `test:outreach`, `test:export` | Pass |
| Migrations against a database | **Not run.** The legal_acceptances and purge migrations have not been applied anywhere. A rolled-back test of the purge function on production needed your approval in the Supabase connector and timed out. Apply both to a Supabase branch, sign up once, and purge a test account before merging |
| Instantly blocklist write | **Not run.** No API calls were made |

## Owner decisions

1. **Entitlement enforcement.** The agent rule and the trial terms cannot be enforced until the server checks plan status. Proposed design: one `entitlements(user_id)` function in the database (plan, status, trial end, `accounts.status`), read by a shared helper in the Workers and edge functions that start AI work. It returns 402 for expired trials and 403 for suspended accounts, and enforces the monthly proposal count. This changes what every trial user experiences, so it is not on the branch.
2. **Outreach copy.** The separate commit in govhub-marketing reverses the opt-out and ad label removals of September. Keep it (recommended) or drop that commit.
3. Validate `plan_type` against the Stripe price ID in the webhook (fact table A6).
4. "Team collaboration" and "SharePoint" claims (D7, D8).
5. Delete the dead legacy pages in strata-parse `src/pages/` that still carry false claims and third-party logos.
6. Whether enrichment scripts should keep sending a browser User-Agent.

## For counsel

See counsel-review-memo.md. In short: entity and jurisdiction, governing law and venue, liability cap and exceptions, DPA transfer mechanism, outreach basis, clickwrap wording, and the corrected security copy.
