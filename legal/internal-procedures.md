# Internal data procedures (draft)

For LinksHub staff running GovHub. Not published. Where a period or tool is not decided it is marked [CONFIRM].

## 1. Retention schedule (proposed)

| Data | Where it lives | Proposed retention | Deletion mechanism today | Gap |
|---|---|---|---|---|
| Account profile, company profile, Customer Content | Supabase tables and storage buckets | While the account is open; purge 30 days after account deletion | **None.** `delete-account` only sets `deleted_at` | Build the purge job: auth user, rows, storage objects, Anthropic Files API uploads |
| Files uploaded to Anthropic's Files API | Anthropic | Delete when the submission's processing finishes, or with the account | None; file IDs are cached for reuse | Add deletion |
| Assistant conversations | `agent_messages` | With the account | None | Covered by purge job |
| Signature images | `v2-files/<user_id>/profile-signature/` | Until the user removes them, or with the account | Per-file delete in the app | Covered by purge job |
| Analytics events | PostHog, GA4 | [CONFIRM: set GA4 retention, for example 14 months; PostHog plan retention] | Provider settings | Confirm settings |
| Billing records | Stripe; `subscriptions` | [CONFIRM: tax record period, often 7 years] | Stripe | Decide |
| Email delivery events | `email_events` | [CONFIRM: for example 13 months] | None | Add cleanup |
| Support tickets | `support_*` | [CONFIRM: for example 3 years after closing] | None | Add cleanup |
| Prospects who never replied | `outreach.*`, `prospect_*`, `data/*.json` in git, Instantly | [CONFIRM: for example 24 months after last contact] | None; some data is committed to git | Decide; move prospect PII out of git |
| Suppression list entries | Instantly blocklist, `prospect_suppression` | Indefinitely, address only | n/a | Keeping them is what makes the opt-out stick |
| Backups | Supabase | [CONFIRM: plan's backup retention] | Provider rotation | Confirm |

## 2. Rights requests

1. **Log it** the day it arrives: date, requester, channel, request type. [CONFIRM: where the log lives.]
2. **Route it.** If it concerns data inside a customer's Customer Content (a resume uploaded by a customer, for example), reply that LinksHub processes it for that customer, name the customer if permitted, and tell the customer. Stop there.
3. **Verify identity** proportionately: a request from the account's own email address is usually enough; otherwise ask for information that matches what we hold. For an authorized agent, ask for signed permission.
4. **Find the data** in every system: Supabase (user_profiles, v2_profiles, subscriptions, v2_* tables, agent_messages, support_*, email_events, outreach.*, prospect_*), storage buckets, Stripe, Zoho CRM, PostHog (person by email), Instantly (lead and blocklist), Resend, GitHub-committed data files (`data/*.json` in govhub-marketing), and Anthropic files.
5. **Act:**
   - *Access or portability:* the in-app export plus the items it misses (files, library, assistant chats, CRM, PostHog person).
   - *Deletion:* run the purge for an account, delete the PostHog person, delete the Zoho contact, remove the lead from Instantly but **keep the address on the blocklist** (say so in the reply), remove the person from committed data files.
   - *Correction:* edit the records.
   - *Objection to marketing / opt-out:* blocklist in Instantly, set `prospect_suppression`, set `email_unsubscribed_at` if they have an account.
6. **Reply** within the period the applicable law sets (for example one month under GDPR, 45 days under the CCPA), and record the outcome.

## 3. Security incident response (outline)

1. **Detect and record.** Anyone who suspects an incident tells [CONFIRM: owner] at once. Start a timeline.
2. **Contain.** Rotate affected keys (Supabase service role, AI provider keys, Instantly, Resend, Stripe), revoke sessions, disable the affected function or worker.
3. **Assess.** What data, whose, how many, whether it is Customer Personal Data (DPA section 8 clock starts) or LinksHub's own (controller duties).
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
4. LinksHub LTD's valid postal address.
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
- **Safeguards:** suppression across all domains, retention limit for non-responders [CONFIRM], no special category data, no scraping that ignores a site's terms [CONFIRM: review the enrichment scripts that send a browser User-Agent].
