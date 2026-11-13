# Internal data procedures (draft)

For Linkshub staff running GovHub. Not published. Where a period or tool is not decided it is marked [CONFIRM].

## 1. Retention schedule (adopted 2026-11-13, matches Privacy Notice section 8)

| Data | Where it lives | Proposed retention | Deletion mechanism today | Gap |
|---|---|---|---|---|
| Account profile, company profile, Customer Content | Supabase tables and storage buckets | While the account is open; purge between day 30 and day 45 after account deletion | Admin console: Users page lists accounts waiting; the user's page has **Delete account data** (section 6) | Manual; consider a daily reminder |
| Files uploaded to Anthropic's Files API | Anthropic | With the account | The account purge deletes them | Per-proposal deletes do not yet remove them |
| Assistant conversations | `agent_messages` | With the account | Account purge | None |
| Signature images | `v2-files/<user_id>/profile-signature/` | Until the user removes them, or with the account | Per-file delete in the app; account purge | None |
| Analytics events | PostHog, GA4 | Recordings 30 days (PostHog setting); GA4 up to 14 months | Provider settings | Set GA4 data retention to 14 months (Admin, Data collection and modification, Data retention) |
| Billing records | Stripe; `subscriptions` | 7 years | Stripe keeps invoices; the purge removes the local mirror | None |
| Email delivery events | `email_events` | 13 months, or with the account | Account purge only | Add a cleanup job |
| Support tickets | `support_*` | 3 years after closing, or with the account | Account purge only | Add a cleanup job |
| Prospects who never replied | `outreach.*`, `prospect_*`, `data/*.json` in git, Instantly | 24 months after last contact | None; some data is committed to git | Add a cleanup job; move prospect PII out of git |
| Suppression list entries | Instantly blocklist, `prospect_suppression` | Indefinitely, address only | n/a | Keeping them is what makes the opt-out stick |
| Backups | Supabase (Pro plan) | 7 days | Provider rotation | None |

## 2. Rights requests

1. **Log it** the day it arrives: date, requester, channel, request type. Keep the log as a note on the user in the admin console (or a spreadsheet for people without an account).
2. **Route it.** If it concerns data inside a customer's Customer Content (a resume uploaded by a customer, for example), reply that Linkshub processes it for that customer, name the customer if permitted, and tell the customer. Stop there.
3. **Verify identity** proportionately: a request from the account's own email address is usually enough; otherwise ask for information that matches what we hold. For an authorized agent, ask for signed permission.
4. **Find the data** in every system: Supabase (user_profiles, v2_profiles, subscriptions, v2_* tables, agent_messages, support_*, email_events, outreach.*, prospect_*), storage buckets, Stripe, Zoho CRM, PostHog (person by email), Instantly (lead and blocklist), Resend, GitHub-committed data files (`data/*.json` in govhub-marketing), and Anthropic files.
5. **Act:**
   - *Access or portability:* the in-app export plus the items it misses (files, library, assistant chats, CRM, PostHog person).
   - *Deletion:* admin console, the user's page, **Delete account data** (give the reason "deletion request by email"); then the manual checklist it shows: PostHog person, Zoho contact, Instantly lead (**keep the address on the blocklist** and say so in the reply). Remove the person from committed data files.
   - *Correction:* edit the records.
   - *Objection to marketing / opt-out:* blocklist in Instantly, set `prospect_suppression`, set `email_unsubscribed_at` if they have an account.
6. **Reply** within the period the applicable law sets (for example one month under GDPR, 45 days under the CCPA), and record the outcome.

## 3. Security incident response (outline)

1. **Detect and record.** Anyone who suspects an incident tells the founder at once (support@govhub.online). Start a timeline.
2. **Contain.** Rotate affected keys (Supabase service role, AI provider keys, Instantly, Resend, Stripe), revoke sessions, disable the affected function or worker.
3. **Assess.** What data, whose, how many, whether it is Customer Personal Data (DPA section 8 clock starts) or Linkshub's own (controller duties).
4. **Notify** as required: customers under the DPA; regulators where a law applies (for example 72 hours under GDPR Art. 33 where it applies); individuals under state breach notification laws where personal information as those laws define it is involved. Counsel decides.
5. **Remediate and review.** Write up root cause and fixes in `docs/incident-*.md`, as the repository already does for operational incidents.

## 4. Vendor review

For each provider on the subprocessors page, record:

| Field | Note |
|---|---|
| Contract and DPA | Signed? Link |
| Training on our data | Contract term and account setting |
| Retention of inputs and logs | Period |
| Processing region | |
| Transfer mechanism | SCCs, DPF, or not needed |
| Security attestation | SOC 2 / ISO report date, if any |
| Deletion on request | How |
| Reviewed on | Date, by whom |

Highest priority: Anthropic, OpenAI, Lovable (the Gemini gateway), the unnamed OCR service, Supabase and Cloudflare, because they receive Customer Content.

## 5. Marketing email rules

### United States (CAN-SPAM)

Every commercial email, from every domain and tool:

1. Accurate From, To, Reply-To and routing information; the sending domain is on the public list at www.govhub.online/legal/.
2. A subject line that matches the content.
3. Identification as an advertisement (disclosure.mjs carries it for angles and B-line; add it to influencer and wave 1).
4. Linkshub Ltd.'s valid postal address.
5. A clear opt-out notice that works for at least 30 days after sending.
6. Opt-outs honored within 10 business days, across every campaign, domain and tool. The reply desk now blocklists "unsubscribe" and "no" replies in Instantly automatically; vendor outreach replies to hello@ and Prospector unsubscribes still need to reach the same list.
7. No selling or transferring of addresses of people who opted out.
8. Do not remove the opt-out or ad label from a campaign without counsel's sign-off.

### UK and EU (only if outreach reaches people there)

- PECR allows unsolicited marketing email to corporate subscribers in the UK, but not to sole traders or some partnerships without consent.
- UK GDPR or EU GDPR applies to the personal data: document a legitimate interests assessment (below), give the Art. 14 information no later than the first email (a link to the Privacy Notice section 7 in the footer does this), and honor objections.
- No country field exists in the prospect data today. Add one before any non-US campaign.

### Legitimate interests assessment (outline)

- **Purpose:** telling businesses that bid on government contracts about software relevant to that work.
- **Necessity:** email to a published business contact is the least intrusive way to reach a small contractor; data used is limited to business contact details and public award records.
- **Balancing:** recipients are acting in a business capacity; their details are published for business contact (SBA, company websites); every email carries an opt-out that is honored everywhere; no tracking pixels or link tracking; AI fit scoring uses only public business information and has no legal effect.
- **Safeguards:** suppression across all domains, retention limit of 24 months for non-responders, no special category data, no scraping that ignores a site's terms [CONFIRM: review the enrichment scripts that send a browser User-Agent].

## 6. Account deletion and purge

1. A user deletes their account in the app (or asks by email). The account is deactivated and the Stripe subscription cancelled at once.
2. Days 0 to 30: grace period. A user who asks can be restored by clearing `user_profiles.deleted_at`.
3. Days 30 to 45: admin console, **Users**. The red "Waiting for data deletion" list shows each account and its deadline. Open the user, **Delete account data**, **Preview**, type the email, purge.
4. The purge cancels any live Stripe subscription, deletes the user's Anthropic files and stored files, deletes their database rows, removes the login, marks them suppressed in outreach, and writes an audit entry with counts only. If any step fails it stops, and running it again is safe.
5. Then do the manual checklist it shows: PostHog person, Zoho contact, Instantly lead.
6. The 45-day deadline is in the Privacy Notice and matches the CCPA's 45-day response period.

## 7. Refunds

Policy: Terms section 5. 30-day money-back guarantee on the first payment (once per customer); full refund of an annual renewal if asked within 14 days of the charge; otherwise discretionary.

1. Requests arrive at support@govhub.online, usually from the "Request a refund by email" button in billing, with the account email and plan filled in.
2. Check the date of the charge in Stripe (Customers, search the email, Payments).
3. Refund in Stripe: open the payment, **Refund**, full amount, reason "Requested by customer".
4. For a money-back or annual-renewal refund, also cancel the subscription immediately in Stripe (Subscriptions, **Cancel immediately**). The app's webhook updates the plan.
5. Reply to the customer that the refund is on its way and usually shows within 5 to 10 business days.
6. Note it on the user in the admin console, so a second money-back request can be recognised.

## 8. Data export rules

The self-serve export (`export-account-data`) and any export done by hand for a rights request follow the same rules:

- **Include** everything the person gave us or GovHub produced for them, including their files (as download links) and the record of terms they accepted.
- **Leave out** passwords, login codes, magic links, API keys and other tokens (CCPA regulations, 11 CCR 7024(d), and the security exception in the same section).
- **Mask** Social Security, driver's licence, passport, bank account, routing and card numbers to the last four characters, so the person knows we hold them without the full number being exposed (7024(d)).
- **Do not include** other customers' data or internal system identifiers. Admin notes about a person are their personal data: include them in a manual rights-request response, and write notes accordingly.
- **When withholding anything else,** tell the person what and why (section 7024 requires an explanation of the basis for a denial).

