# GovHub legal documents

Drafted 2026-11-13 from the legal drafting pack of 2026-11-12. **These are drafts for review by a SaaS and privacy lawyer, not final policies.** Nothing here has been published or deployed.

## What is where

**Public documents** (rendered by the site; edit the Markdown):

| Page | Source |
|---|---|
| /terms/ | `src/legal/terms.md` |
| /acceptable-use/ | `src/legal/acceptable-use.md` (AI use, prohibited uses, customer-directed agents) |
| /privacy/ | `src/legal/privacy.md` |
| /cookies/ | `src/legal/cookies.md`, plus the analytics control in `src/pages/cookies.astro` |
| /subprocessors/ | `src/legal/subprocessors.md` |
| /legal/ | `src/legal/company.md` (company details, official and outreach domains) |

Company details, versions and effective dates: `src/data/legal.ts`. The footer, About page, Organization schema and legal pages read from it.

**Internal documents** (this folder, not published):

| File | What it is |
|---|---|
| [fact-table.md](fact-table.md) | What the code actually does, issue by issue, and the blocker list |
| [counsel-review-memo.md](counsel-review-memo.md) | Legal questions and citations for the lawyer |
| [dpa.md](dpa.md) | Customer Data Processing Addendum, draft |
| [internal-procedures.md](internal-procedures.md) | Retention schedule, rights requests, incident response, vendor review, email marketing rules |
| [implementation-audit.md](implementation-audit.md) | PASS / GAP / UNVERIFIED for every promise, what was tested, owner decisions |

## The publication gate

Every fact that is not yet confirmed is written as `[CONFIRM: ...]` in the text. `npm run guard`, which `npm run verify` runs on every pull request into main, fails while any `[CONFIRM` is in the built site. To publish:

1. Answer each item in the blocker list at the end of fact-table.md, edit the text, and delete the marker.
2. Fix the GAPs the documents depend on, above all the 30-day account purge (Privacy 8).
3. Have counsel review the result.
4. Set the effective dates in `src/data/legal.ts` and merge.
5. In strata-parse, set `NEW_LEGAL_DOCS_LIVE = true` in `src/lib/legal.ts` in the next release, so existing users accept the new versions.

## Related changes on the same branch

**govhub-marketing**

- LinkedIn Insight Tag honours the analytics opt-out and Global Privacy Control.
- The security page and enterprise audience copy no longer claim SAML SSO, a full audit trail, role-based access, or SOC 2 or FedRAMP alignment. "API access" is removed from the Team plan.
- Outreach (its own commit, reviewable separately): opt-out notice and advertisement label restored for the angle and B-line campaigns, Linkshub Ltd. in the shared signature, and the reply desk adds opt-outs to the Instantly blocklist. Live campaigns change only after each script's `--sync`.

**strata-parse**

- Signup checkbox and the `legal_acceptances` record; the in-app acceptance prompt (off until step 5 above).
- AI review notice on downloads and in the finalize dialog.
- The www opt-out and GPC now apply in the app; PostHog masks text.
- app.govhub.online no longer prerenders the old homepage claiming SOC 2, FedRAMP, "DoD Approved" and big-contractor logos.
- Company name and address in email footers; Prospector will not send without a postal address; the "ProposalPro" trial email is rebranded.

## Limits

"Use at your own risk" wording cannot remove privacy rights, regulatory duties or liability the law does not let a business exclude, and fine print cannot cure a misleading claim. The documents disclaim what can lawfully be disclaimed. The rest depends on the product doing what the documents say.
