# GovHub legal drafting brief: fact table

Prompt 1 of the 2026-11-12 legal drafting pack. Audit date: 2026-11-13.

**What was inspected:** both repositories as of their `main` branches (govhub-marketing at `4c4721a`, strata-parse at `41bd51e`): code, migrations, edge functions, workers, scripts, committed data and docs. **Not inspected:** live dashboards and vendor settings (Supabase, Cloudflare, PostHog, Google, Instantly, Stripe), vendor contracts, DNS and domain registrations, and the live sites over the network. A fact marked "code" is what the code does when it runs, not proof that it is deployed.

Evidence paths are relative to each repository: **M** = govhub-marketing, **A** = strata-parse.

## A. Identity, formation and terms

| # | Issue | Evidence | Observed fact | Uncertainty | Documents affected | Product action |
|---|---|---|---|---|---|---|
| A1 | Terms acceptance | A `src/pages/Signup.tsx`, `handle_new_user()` in A `supabase/migrations/20260906120000_*` | No checkbox, no "by signing up you agree" text, and no record of acceptance. Outreach leads get accounts with `email_confirm: true` and a magic link, never seeing a form (A `supabase/functions/outreach-stage/index.ts`). | None | Terms 1, 19 | **Done on branch:** checkbox, `legal_acceptances` table, in-app prompt (off until `NEW_LEGAL_DOCS_LIVE`) |
| A2 | Contracting entity | Georgia certificate of incorporation and articles; IRS CP 575 A (supplied 2026-11-13) | **Confirmed:** Linkshub Ltd., Georgia domestic profit corporation, incorporated 2025-08-05, control number 25162414, principal office 3060 Mercer University Dr, Ste 110, Atlanta, GA 30341. The retired 2025 app Terms used the same name and address and chose Georgia law. | Venue county (Fulton on file; ZIP suggests DeKalb) | All | **Done:** `M src/data/legal.ts` and all documents use the registered name |
| A3 | Public identity | M `Footer.astro`, `about.astro`, `seo/SchemaOrg.astro` | Footer said "© GovHub"; About said "an independent private company"; no legal name anywhere on www. | None | Company page | **Done on branch:** footer, About, schema `parentOrganization` |
| A4 | Who can sign up | A `Signup.tsx:446-465` | "Work email" label, but personal email only warns. Company name required. No age gate or business check. | Whether individuals actually buy | Terms 1 | Decide B2B-only, then enforce or adjust Terms |
| A5 | Trial | A `handle_new_user`, `create-checkout-session` | 14 days, no card, database-only; never converts automatically. `check-trial-expiration` exists but nothing schedules it, and nothing enforces `expired`. | Dashboard schedules | Terms 3 | Schedule or remove the job |
| A6 | Billing | A `create-checkout-session`, `stripe-webhooks`, `cancel-subscription` | Monthly or annual Stripe subscriptions; self-serve cancel at period end; Stripe portal; deleting the account cancels immediately. **The plan tier comes from the client and is copied into `plan_type` without checking it against the Stripe price.** | None | Terms 4, 5 | Validate tier against price ID in the webhook |
| A7 | Refunds | M live Terms; A retired Terms `:231` | Live: non-refundable except as required by law. Retired 2025 Terms: 30-day money-back guarantee. | Which promise existing customers relied on | Terms 5 | Owner decision |
| A8 | Seats and teams | A `20260703120000_admin_console_domain.sql:4-5` | Single user per account; `seat_limit` column but no invite UI. Pricing advertises "Team collaboration". | Roadmap | Terms 2, pricing | Ship teams or remove the claim |

## B. AI and agents

| # | Issue | Evidence | Observed fact | Uncertainty | Documents affected | Product action |
|---|---|---|---|---|---|---|
| B1 | AI providers | A `cloudflare-workers/src/v2/lib/ai-config.ts`, `wrangler.toml`, edge functions | Anthropic (Claude Sonnet/Haiku, Files API, code execution, web search); OpenAI (gpt-5-mini, gpt-5, gpt-4o, gpt-image-1, search); Google Gemini through the Lovable AI gateway; an OCR service set by `OCR_SERVICE_URL`. No embeddings stored. | Retention and training terms per provider; OCR vendor identity | Privacy 4, subprocessors, Terms 6 | Confirm each provider's terms; name the OCR vendor |
| B2 | Data sent to AI | A `generate-spine.ts:887-893`, `anthropic-retry.ts`, `openai.ts:85-88` | Solicitation PDFs, attachments including resumes, and the full company profile (contact name, email, phone, UEI, address). Files uploaded to Anthropic are cached by ID and never deleted. OpenAI Chat Completions calls set no `store` parameter. | Provider defaults | Privacy 4, 8; DPA Annex I | Delete Anthropic files after use; set `store: false` where available |
| B3 | Training promise | M live Terms 3, Privacy 2, Security page | "We do not use your proposal content to train AI models." The code shows no training. | Provider-side use (B1) | Terms 6 | Verify provider terms |
| B4 | AI output notice | A `SubmittalPackage.tsx:1465`, `SubmitConfirmModal.tsx` | No general "AI-generated, review before submitting" notice; only a grade disclaimer and a partial-analysis alert. | None | AUP 1, Terms 8 | **Done on branch:** notice on download (once per session) and in the finalize dialog |
| B5 | Customer API | A (search across src, functions, workers) | None. No API keys, tokens, OAuth apps, webhooks or MCP server for customers. Workers accept a user's own Supabase JWT. Pricing listed "API access" on Team. | None | AUP 3, pricing | **Done on branch:** "API access" removed from both pricing files |
| B6 | Entitlements | A `UsageMeter.tsx:1-5`, `20260706120000_admin_console_entitlements.sql:8-10`, `agent-turn.ts:58-64` | **No plan, trial or usage limit is enforced on the server.** Trial, expired and paid users get the same AI features. Admin "suspend" is not enforced. RLS stops users granting themselves a paid plan. | None | AUP 3, 4; Terms 3, 9 | **Owner decision**, see implementation audit |
| B7 | Rate limits | A `agent-turn.ts:65-72` | Assistant: 25 turns per user per day, 3 searches per turn. Nothing else. No CAPTCHA or bot challenge on signup. | Supabase Auth limits (dashboard) | AUP 3 | Add per-user limits to AI routes |
| B8 | Built-in assistant | A `src/lib/agent.ts`, `prompts/agent.ts:4-6` | Chat panel; proposes edits the user accepts or dismisses; messages stored in `agent_messages`. | None | AUP 3 (excluded from "Customer-Directed Agent") | None |

## C. Privacy, analytics and data handling

| # | Issue | Evidence | Observed fact | Uncertainty | Documents affected | Product action |
|---|---|---|---|---|---|---|
| C1 | www tags | M `BaseLayout.astro`, `LeadLink.astro`, `Analytics.astro` | GA4, PostHog (no autocapture, no recording), Google tag (GTM-WZ4BBLKL), Meta Pixel, LinkedIn Insight, Calendly widget. Opt-out and GPC gated Meta and the Google tag; **LinkedIn ignored both** and was not in the Privacy Policy. | Tags configured inside the GTM container | Cookie Notice | **Done on branch:** LinkedIn gated |
| C2 | App tags | A `index.html`, `src/main.tsx` | Same tags. Only the Google tag honoured opt-out and GPC. PostHog sets no autocapture, recording or masking options, so posthog-js defaults apply (autocapture on). Identify sends email and company. Google Ads gets a hashed email at signup. | PostHog project settings (recording) | Cookie Notice, Privacy 5 | **Done on branch:** opt-out and GPC gating, PostHog text masking |
| C3 | Consent banner | Both | None. | Whether UK or EU visitors are targeted | Cookie Notice | Banner if targeting UK/EU |
| C4 | Cookies | M `Analytics.astro`; A `src/lib/attribution.ts:21` | gh_s, gh_lt, gh_ft (90 days on www, **2 years** in the app), gh_lv_*, gh_lid, gh_optout. Session in local storage. | None | Cookie Notice | Align gh_ft lifetime |
| C5 | Account deletion | A `delete-account/index.ts`, `20260621000000_account_soft_delete.sql` | Soft delete only. **The UI says data "is permanently removed after 30 days", but no purge job exists**, so nothing is ever removed (auth user, rows, storage, Anthropic files). | Backups | Privacy 8, Terms 15, DPA 10 | **Build the purge job** before publishing |
| C6 | Export | A `export-account-data/index.ts:41-55` | JSON of five tables; excludes uploaded files, library and assistant chats. | None | Privacy 10 | Expand export |
| C7 | Storage | A `form-engine.ts`, `finalize-submission.ts`, migrations | Private buckets for files, outputs, bundles; `company-logos` and `proposal-images` read through public URLs. Signature images stored when the user opts in. Several buckets are not created in migrations. | Bucket privacy settings | Privacy 1, DPA Annex II | Confirm bucket settings |
| C8 | Tenant isolation | A migrations (110 `enable row level security`) | Per-user RLS. Core v2 tables (`v2_submissions`, `v2_deliverables`, `v2_files`) are not defined in migrations, so their policies could not be checked. Workers use the service role with user_id checks in code. | v2 table RLS | Security page, DPA Annex II | Verify v2 RLS |
| C9 | Region | A `supabase/config.toml`, wrangler files | No region in config. The old app Security page claimed "US-based data centers". | Region | Privacy 11, subprocessors | Confirm with Supabase |
| C10 | CUI | A upload screens | No warning, block or classification check; files go to AI providers unfiltered. | None | Terms 11, AUP 2.5 | Optional upload warning |
| C11 | CRM | A `Signup.tsx:275-291`, `sync-to-zoho-crm` | Signup sends name, email, company and phone to Zoho CRM. | None | Privacy 3, subprocessors | None |

## D. Security and marketing claims

| # | Claim | Where | Code shows | Status | Action |
|---|---|---|---|---|---|
| D1 | "SAML single sign-on" | M `security.astro:28,58`, `audiences.ts:106,124` | Not implemented | **False** | **Corrected on branch** |
| D2 | "Full audit trail on user activity" | Same | Only admin actions (append-only) and assistant tool calls | Overstated | **Corrected on branch** |
| D3 | "Role-based access control" | M `security.astro` | A role column; customer accounts are single-user | Overstated | **Corrected on branch** |
| D4 | "Built to align with SOC 2", "architected for FedRAMP-ready deployment" | M `security.astro:72-73,23` | No evidence; "FedRAMP Ready" is a formal designation | Unsupported | **Reworded on branch**, with [CONFIRM] |
| D5 | "SOC 2 Type II certified", "FedRAMP Ready", "DoD Approved", Boeing/Lockheed/Raytheon/Booz Allen/WWT/Tesla logos | A `src/pages/Index.tsx`, prerendered into `dist/index.html` for every app route | No evidence | **False, and live in the app's HTML** | **Removed on branch** (prerender) |
| D6 | "API access" (Team) | M `pricing.ts`, A `pricing.ts` | No API | False | **Removed on branch** |
| D7 | "Team collaboration", "SMEs and subcontractors draft in parallel" | M `pricing.ts`, `audiences.ts:96` | Single-user accounts | Unsupported | Owner decision |
| D8 | "Can pull content from SharePoint" | M `audiences.ts` FAQ | No SharePoint integration found | Unsupported | Owner decision |
| D9 | "US-based cloud infrastructure" | M `security.astro` | Region not in config | Unverified | **Reworded on branch**, with [CONFIRM] |
| D10 | Retired app pages (Security, Compliance, Pricing, Privacy) claiming SOC 2, FedRAMP, CMMC | A `src/pages/*.tsx` | Not routed and not prerendered after D5 | Dead code | Delete the files |

## E. Email and outreach

| # | Issue | Evidence | Observed fact | Status after branch |
|---|---|---|---|---|
| E1 | Sending domains | M `set-signatures.mjs`, `instantly-*.mjs` | 48 Instantly mailboxes on 16 .com domains (list on `/legal/`), From "Earl Knight"; Resend from hello@govhub.online for vendor outreach and app mail; Prospector From is an env var. About page said www and app are "the only domains we publish". | Domains listed on `/legal/` and About corrected; registrant unconfirmed |
| E2 | Opt-out notice | M `instantly-angles.mjs:201-209`, `instantly-bline.mjs`, A `outreach-send-proposal:55-60` | **Angle (A1/A2/A4/A5) and B-line (B2/B4) emails carry no opt-out notice, and their checks fail if one is added** (removed 2026-09-29 at the owner's instruction). About 14,421 angle emails sent by 2026-10-29. Influencer and wave 1 say 'Reply "no" and I will not reach out again'. Proposal handovers have no opt-out by design. | **Restored on branch** for angles and B-line (separate commit) |
| E3 | Ad identification | M `set-signatures.mjs:68-87` | No campaign identifies itself as an advertisement; the signature checker forbids it (2026-09-03/04, owner's instruction). | **Added on branch** for angles and B-line; influencer and wave 1 still lack it |
| E4 | Postal address | M `set-signatures.mjs`; incident doc | Present in the signature. 4,514 angle sends (09-25 to 10-16) went out with an empty signature and no address. | Unchanged; address now prefixed with Linkshub Ltd. |
| E5 | Opt-out handling | M `reply-desk.mjs:279-283`, `docs/instantly-angle-coverage.md:4267` | "Stop/unsubscribe" and bare "no" replies recorded as `no_action`; only Instantly's per-campaign stop_on_reply applied. Blocklist had 2 entries against 16 written opt-outs until a manual back-fill on 11-04. | **Automated on branch:** blocklist write, retries, back-fill of 77 ledger rows |
| E6 | Global suppression | Both repos | Four unlinked stores: Instantly blocklist, `outreach.companies.suppressed` (never set by code), `data/vendor-outreach.json`, `prospect_suppression`. App unsubscribes are separate again. | Instantly blocklist now covers all 16 domains; the other stores are still separate |
| E7 | Tracking | M Instantly scripts | Open and click tracking off; text only. `gh_lid` added to links in reply desk sends. | Disclosed in Privacy 6 |
| E8 | Lead sources | M `scripts/leadgen/`, `vendor-outreach.mjs`; A `prospector-source/*` | USAspending, SBA certification search, SAM entity data, CSV import, hand research (LinkedIn, Feedspot), earlier Apollo and Tomba; MillionVerifier. Claude scores fit from public websites. **Enrichment scripts send a spoofed Chrome User-Agent**, unlike GovHubBot. | Disclosed in Privacy 7; spoofing unchanged (owner decision) |
| E9 | Recipients | M `data/*.json` | No UK or EU addresses found. Includes .gov recipients (national labs) and many small LLCs on free mail (likely sole traders). | No action unless non-US outreach starts |
| E10 | Personal data in git | M `data/*.json`, `docs/*.md` | Prospect names, emails, titles, notes and quoted replies are committed. | Retention decision; consider moving out of git |
| E11 | App email footer | A `_shared/email-templates.ts:92-95` | No company name or postal address. Unsubscribe and List-Unsubscribe present on user emails; trial nudges are commercial. Legacy "ProposalPro <onboarding@resend.dev>" sender in `check-trial-expiration`. | **Fixed on branch** |
| E12 | Prospector address | A `prospector-action/index.ts:583` | Sends even when `PROSPECT_MAILING_ADDRESS` is empty. | **Fixed on branch:** refuses to send |

## Consolidated blocker list

Publication of the new documents is blocked until each item below is resolved. Every one also appears as a `[CONFIRM: ...]` in the page text, and `npm run guard` fails until they are gone.

1. ~~Entity details~~ Resolved 2026-11-13 from the formation documents (A2).
2. Monitored legal, privacy and security email addresses. (legal@govhub.ai appears only in the retired Terms; govhub.ai ownership is unknown.)
3. Venue county (Georgia law is drafted; Fulton County is on file for the registered agent, but the ZIP code suggests DeKalb).
4. The liability cap, its exceptions and the free/trial amount.
5. Refund policy (A7).
6. Effective date for each document.
7. AI provider terms: training, retention, region and DPA for Anthropic, OpenAI, Lovable/Gemini and the OCR vendor (B1, B2), plus the OCR vendor's name.
8. **The 30-day account purge job (C5).** The Privacy Notice states it; it does not exist.
9. Export completeness (C6), or a sentence saying what export leaves out.
10. Supabase region and the transfer mechanism (C9).
11. Backup retention, billing record, analytics, prospect and support retention periods.
12. Whether each of the 16 outreach domains is registered to Linkshub Ltd. (E1).
13. SOC 2, FedRAMP and CMMC status statements on the security pages (D4), and Google Signals and session recording settings (C2).
14. Cookie consent banner decision for UK and EU visitors (C3).
15. Subprocessor change-notice period.
16. Calendly widget cookie behaviour.
