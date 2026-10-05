# Reply desk: answering the people who said yes

**Written 2026-10-04.** The code is `scripts/outreach/reply-desk.mjs` and
`scripts/outreach/reply-desk/`. The workflow is `.github/workflows/reply-desk.yml`
and it ships disabled.

---

## 1. Where the campaigns stood on 2026-10-04

Every one of the 67 inbound emails across the 13 campaigns was read by hand.
Most were autoresponders or a bare "No". Seven people said yes, and **none of
them had been answered**: Instantly showed no manual reply in any of their
threads.

| Campaign | Status | Leads | Inbound | Positive | Not interested | Autoresponder |
|---|---|---:|---:|---:|---:|---:|
| GH-A1-Recompete | active | 85 | 5 | 1 | 3 | 1 |
| GH-A2-MatchedRFP | active | 291 | 14 | 2 | 2 | 4 |
| GH-A4-CompetitorWon | active | 148 | 2 | 1 | 1 | 0 |
| GH-A5-DebriefPain | active | 270 | 8 | 1 | 2 | 5 |
| Influencer C1 creators | completed | 16 | 4 | 1 | 1 | 0 |
| Influencer C2 podcasts and newsletters | completed | 5 | 0 | 0 | 0 | 0 |
| Influencer C3 media and blogs | completed | 8 | 1 | 0 | 1 | 0 |
| Influencer C4 consultants | active | 27 | 4 | 1 | 2 | 1 |
| Influencer C5 APEX advisors | active | 57 | 1 | 0 | 1 | 0 |
| Influencer C6 associations | completed | 6 | 1 | 0 | 1 | 0 |
| Wave 1 A serial_bidder | paused | 897 | 10 | 0 | 5 | 4 |
| Wave 1 B new_prime | paused | 449 | 10 | 0 | 8 | 1 |
| Wave 1 C registered_no_awards | paused | 448 | 7 | 0 | 4 | 3 |

Lead counts are Instantly's lead records per campaign; positives and negatives
are Instantly's `lt_interest_status`. All seven positives were checked by hand
against the reply text, and every one is real.

### The seven

| Who | Campaign | Said | Waiting since | What the email promised |
|---|---|---|---|---|
| Aadvik Solutions (shared inbox) | C4 | "Send details. Thanks." | Sep 23 | The partner terms |
| Proposal Master Academy (creator) | C1 | "Tell me." | Sep 24 | The creator offer: no-cap account, recurring share, audience rate |
| Exergy Systems (CEO) | A2 | "not sure what this is ... What is your cost? ... I can try to have a call" | Sep 25 | A free first draft of SPE4A626U4340, **which closed Oct 2 while she waited** |
| Dependable On-Site Scan & Shred | A4 | "What solution do you provide?" | Sep 28 | The next three open solicitations in her lane |
| The Stronghold Group (CEO, SDVOSB) | A1 | "Sure" | Oct 1 | A rundown of what would get the VA recompete bid tossed |
| 310 Buncombe LLC | A2 | "Yes, please" | Oct 1 | The disqualifier list for USDA 57-6395-25-006, **which closes Oct 12** |
| Williams Roofing & Construction | A5 (A2 holdout) | "Yes, please send." | Oct 2 | The debrief one-pager |

### None of the promised deliverables existed

| Promise | Existed before this? |
|---|---|
| A2: "the list of what would disqualify you on this one" | No. The A2 base copy says "There are a couple of those in this one" about every solicitation, but it is a fixed string (`strata-parse outreach-assign/index.ts`). No code had ever read the solicitation. |
| A2: "Want me to draft this one? Free" | No outreach path. The app can draft, but only from a user's uploaded package. |
| A1: the recompete rundown | No. The A1 signal also keeps only an end month, not the award id. |
| A4: "the next three in your lane" | No. The signal job keeps one solicitation per company. |
| A5: the debrief one-pager | No file, page or PDF anywhere. |
| C4: partner terms | No numbers exist. The app has no partner data model. |
| C1: creator offer | No numbers, no code, no unlimited plan. |
| Wave 1: the matrix builder link | **Yes**: `/solutions/compliance-matrix-generator/`. |

### Two things the deliverables will contradict

- **Stronghold's "December" contract is not a recompete.** USASpending shows the VA
  award ending 2026-12-31 is `36C24526F0394`, a $44K delivery order for sealed
  transport carts under his FSS contract `36F79722D0150`. Supply orders under a
  schedule are not recompeted. Its live VA services contracts are the ones that
  will be: `36C25726P0573` (South Texas move and storage, SDVOSB set-aside, 12
  offers, ends 2027-09-13) and `36C24123P0627` (offsite warehouse services in
  New Hampshire, no set-aside, 4 offers, ends 2027-09-29). The rundown says so
  plainly and plans around the SDVOSB one.
- **"There are a couple of those in this one" was never checked.** For 310 Buncombe's
  RLP it happens to be true: the floodplain rule, the Energy Star submission,
  the SAM-at-award rule, and a contradiction between the notice and the RLP on
  the delineated area. For the next A2 yes it may not be. The deliverable
  reports what the documents say, whatever the email claimed.

---

## 2. What the reply desk does

For each new inbound reply:

1. **Classify.** Rules first: the autoresponder and address-change patterns
   copied from `strata-parse outreach-metrics`, plus bare "No" and "Stop". A
   model reads everything a person wrote and reports whether they accepted the
   offer, what they asked, whether they want a call, and whether they pointed at
   someone else.
2. **Skip what is already handled.** A manual reply in the thread after theirs
   means Earl got there first. Campaign steps after an autoresponder do not
   count as answers.
3. **Build the deliverable from the real documents.**

   | Playbook | Built from |
   |---|---|
   | A2 disqualifier list | The SAM.gov notice, its detail, and the text of its attachments (pdftotext). An adversarial-reviewer prompt adapted from the app's forensic pass picks the 3 to 5 gates that can sink the offer, each cited to document and section. |
   | A2 after close | The next open solicitations in their NAICS code, ranked for real fit. |
   | A4 next three | SAM.gov search by NAICS **and** by keywords from the competitor's and the firm's names. NAICS alone is not a lane: every open 561990 notice on Oct 4 was cemetery inscription work, and the lead shreds documents. Each pick gets its one gating rule, cited. When fewer than three are open, the list is not padded. It shows what closed in the lane recently and starts a **lane watch** (below). |
   | A1 recompete rundown | The firm's USASpending awards and award detail (set-aside, procedure, offers, office), plus a SAM.gov search for a posted follow-on. |
   | A5 debrief one-pager | Fixed text in `reply-desk/content.mjs`. |
   | C4, C1 terms | Fixed terms in `content.mjs`. **The numbers are not set**, so these drafts hold for input. |
   | Wave 1 | The matrix builder link. |
   | C2, C3, C5, C6 | No generator yet. They get a short holding reply drafted and held for a human. |

   SAM.gov is read through the keyless endpoints its own website uses
   (`sam.gov/api/prod/...` with `Accept: application/hal+json`). Both SAM API
   keys on this account return 401.
4. **Compose.** The model writes only Earl's opening and closing lines. The
   deliverable goes in verbatim, so every checkable fact comes from the
   generator that cited it. The voice rules come from the copy these people
   already replied to: short sentences, one question at most, no em dashes, no
   exclamation marks, no support-desk phrasing, and no talk about "the data".
5. **Lint.** `voice.mjs lint()` enforces those rules mechanically, plus the
   programme's banned words, placeholders, markdown, and links. Earl's own lines
   get two rewrites to pass. A failure in the deliverable is reported, never
   silently reworded.
6. **Queue.** The draft is written to `.cache/reply-desk/<id>.txt`, which you
   can edit, and the metadata to `<id>.json`. `REVIEW.md` lists everything
   waiting.
7. **Send, only on approval.** `send <id>` re-reads the thread and refuses if
   they wrote again or someone already answered. It re-lints the text and
   refuses outside 8:40 to 17:20 Eastern on weekdays. It then replies in-thread
   from the mailbox that received their message, quoting their message the way
   Gmail would.

### Lane watches

"If I sent you the next three before they close" is a promise that runs over
time. When a reply goes out with fewer open than promised, its ledger row
carries a watch. Each scan re-runs that lane search once a day for 45 days.
When something new is open, it drafts a short follow-up into the same thread
for approval.

- The watch arms only after the first reply has actually been sent.
- It stands down the moment the prospect writes back, because a live
  conversation belongs to a person.
- It stops once the promised count has gone out.

`dismiss <id>` on a follow-up you do not want to send frees the watch to keep
looking.

### Safety rails

- **Nothing sends by default.** Every playbook has `autoSend: false`, and the
  self-test fails if one is turned on. Auto-send also needs the
  `REPLY_DESK_AUTOSEND=true` gate.
- **A send is never retried on a 5xx.** A duplicate reply to a yes costs more
  than a missing one.
- **Unfinished business decisions block sending.** Missing partner or creator
  numbers and an unapproved one-pager cannot send.
- **No prospect text in git.** `data/reply-desk.json` holds ids, addresses,
  statuses and timestamps only. Drafts live in `.cache/`, which is gitignored,
  and in the workflow's Actions cache.
- **Human timing.** A yes received at 11pm Friday is queued for Monday
  morning, not sent at once.

---

## 3. Using it

```
node scripts/outreach/reply-desk.mjs scan            # new replies -> drafts + REVIEW.md
node scripts/outreach/reply-desk.mjs show            # print every draft
node scripts/outreach/reply-desk.mjs send <id> --dry-run
node scripts/outreach/reply-desk.mjs send <id>       # approve and send
node scripts/outreach/reply-desk.mjs dismiss <id>    # decide not to send
node scripts/outreach/reply-desk.mjs notify --dry-run
node scripts/outreach/reply-desk.mjs status
node scripts/outreach/reply-desk.selftest.mjs        # network-free checks
```

Env: `INSTANTLY_API_KEY`, `OPENAI_API_KEY`, optional `REPLY_DESK_MODEL`
(default `gpt-5.5`), `REPLY_DESK_BCC` (set it for the first sends, so you see
exactly what Instantly delivered), `REPLY_DESK_QUOTE=0` to stop quoting their
message. Needs `pdftotext`.

**Check the quoting on the first send.** The workspace has never sent a manual
reply through the API, so it is unverified whether Instantly appends the
quoted thread itself. The desk adds a Gmail-style quote of their message. If
the BCC copy shows it twice, set `REPLY_DESK_QUOTE=0`.

### Reading the drafts

Every scan writes `.cache/reply-desk/REVIEW.html`, and `notify` emails the
same view (`reply-desk/review-email.mjs`). Each card shows:

- what they wrote, with their signature and legal footer trimmed;
- the reply exactly as it would land, with lists as lists, and any unfilled
  number highlighted in yellow;
- what the deliverable was built from, with links to the SAM.gov notices and
  USASpending awards;
- anything to check first;
- the id to approve it with.

Ready replies come first, and how long each person has been waiting is
called out.

```
node scripts/outreach/reply-desk.mjs notify --dry-run          # writes NOTIFY-PREVIEW.html
node scripts/outreach/reply-desk.mjs notify --all --to=you@x.com
```

`--all` re-sends everything still waiting, not just what is new. `--to`
overrides `REPLY_DESK_NOTIFY_TO`, which defaults to the digest recipients.

### On a schedule

`.github/workflows/reply-desk.yml` runs every 30 minutes on weekdays. It
drafts, emails Earl each new draft in full, and sends only:

- the ids pasted into **Run workflow**, then **send_ids**, or
- playbooks with `autoSend: true`, when `REPLY_DESK_AUTOSEND` is `"true"`.

Setup: add the secrets `INSTANTLY_API_KEY` and `OPENAI_API_KEY`
(`RESEND_API_KEY` is already there), then set the variable
`REPLY_DESK_ENABLED=true`.

### Turning on auto-send

Turn it on per playbook, by changing `autoSend` in `reply-desk/playbooks.mjs`
and the matching self-test line, in a reviewed commit, after Earl has
approved about five of that playbook's drafts without edits. Suggested order:

1. **A5**, once `DEBRIEF_ONE_PAGER.approved` is true. The deliverable is fixed
   text.
2. **A2 disqualifier lists**. They are cited, and the lint catches the style
   failures.
3. **A4 next three**.
4. **A1** last. Its rundown can correct the cold email, which deserves a human
   read every time.

---

## 4. Decisions only Earl can make

1. **C4 partner terms** and **C1 creator terms**: recommended numbers are in
   `content.mjs` (section 5 below). Approve them by setting `approved: true`
   on `PARTNER_TERMS` and `CREATOR_TERMS`, after creating the Stripe codes the
   replies quote.
2. **The debrief one-pager** (`content.mjs DEBRIEF_ONE_PAGER`): verified
   against the current FAR on 2026-10-05, and corrected where the first draft
   oversimplified (RFQ explanations, the protest and stay clocks, unit prices,
   task orders, competitive-range cuts). Set `approved: true` to release it,
   and recheck when the FAR overhaul's final rules publish.
3. After approving any of these, re-draft anyone waiting on it with
   `scan --redo --lead=<email>`, so their draft picks up the approved text.
4. **A2 "draft it free"**: the draft playbook asks for a capability statement
   and two or three past jobs before drafting. Producing the draft itself is
   still a manual run of the app.

---

## 5. Partner and creator terms (recommended 2026-10-05, not yet approved)

The cold emails already promised the shape of both deals: a free account,
and a recurring share "for as long as they stay". Only the numbers were
open. Both sets of terms live in `reply-desk/content.mjs` with
`approved: false`. Their drafts are written, but they cannot send until the
flag is flipped in a reviewed commit.

### Why these numbers

- **The share is the whole cost.** When the share is paid for as long as the
  customer stays, partner payouts and customer value both scale with tenure.
  So LTV:CAC is gross margin divided by the share, whatever the churn rate.
  At about 80 percent margin, 20 percent gives 4.0, 25 percent gives 3.2,
  and 30 percent gives 2.7. If AI costs pull margin toward 60 percent, the
  ceiling drops to about 20.
- **Benchmarks.** HubSpot Solutions Partner pays agencies 20 percent of net
  revenue. Gusto pays accountants up to 20. Rewardful's average across 2,847
  programs is 24 percent. The TrackRev B2B SaaS median is 20. beehiiv gives
  its audience a 14-day trial plus 20 percent off the first 3 months.

| | Consultant partner (C4) | Creator (C1) |
|---|---|---|
| Share | 20 percent of net collected revenue, for as long as the client stays | 30 percent of year one, then 20 percent for as long as they stay (about 24 blended) |
| Their own account | Pro, free while a partner | No cap (Team), theirs to keep |
| Client or audience rate | 10 percent off the first 3 months, with the partner's code | 20 percent off the first 3 months, on top of the 14-day trial |
| Attribution | Per-partner Stripe promotion code, e.g. `AADVIK` | Creator code, e.g. `KIZZY` |
| Payout | Monthly ACH, 30 days after month end, $50 minimum rolling over, W-9 first | Same |

The creator gets more in year one because one creator can reach a whole
audience (Kizzy Parks: about 80k YouTube subscribers and a 15k-member
group). The long tail stays at the sustainable 20.

### What the product can and cannot do today

- **Client workspaces do not exist.** The `accounts` and `account_memberships`
  tables are there, but there is no invite, switcher or UI. The partner
  reply says so instead of promising them.
- **There is no comp mechanism.** The admin console's plan change does not
  change what the product does, so a real free account means a 100 percent
  Stripe code.
- **Attribution only works by promotion code.** Stripe records the code on the
  subscription for both email and Google signups. UTM capture misses Google
  OAuth signups, and its `landing_path` column is never written, because the
  client sends `landing_page`.
- **Plan limits are display-only.** "No cap on solicitations" is true today,
  but only because nothing caps anyone.
- **Commissions have to be worked out by hand from Stripe.** Nothing in the app
  stores the code used or tracks commissions.

### Stripe setup (Dashboard, Billing, Coupons)

1. **Comp coupon:** 100 percent off, duration Forever. Add one promotion code
   per person, with max redemptions set to 1: `AADVIK-ACCOUNT` on Pro and
   `KIZZY-ACCOUNT` on Team. They enter it at checkout. Checkout will still
   ask for a card, because `create-checkout-session` does not set
   `payment_method_collection: 'if_required'`, but nothing is charged.
2. **Partner client coupon:** 10 percent off, duration repeating, 3 months.
   Promotion code `AADVIK`, with metadata `partner=aadvik-solutions`.
3. **Creator audience coupon:** 20 percent off, duration repeating, 3 months.
   Promotion code `KIZZY`, with metadata `partner=kizzy-parks`.
4. **Watch annual plans.** A repeating coupon applies to the whole first annual
   invoice, which means 20 percent off year one. Either accept that or
   restrict the code to the monthly prices.
5. **Each month,** list the subscriptions on coupons 2 and 3, sum the invoices
   paid in the month, multiply by the share, and pay 30 days later.

Do the Stripe codes **before** sending, because both replies quote them.

### Guardrails for the written terms

- **No success fees.** Never pay on a client winning a contract (FAR 52.203-5).
- **Exclusions:** self-referrals, federal employees, and employees of the
  buying company (41 USC 8701).
- **APEX and SBDC counselors cannot take a share** (13 CFR 130.470), which is
  why C5 never offers one.
- **Clawback** on refunds and chargebacks. "Stays" means a continuous paid
  subscription; a lapse of more than 60 days resets attribution.
- **Disclosure.** Partners tell clients in writing that they get a referral
  share. Creators disclose in the video (FTC Endorsement Guides, 16 CFR 255).
- **Comped accounts are not for resale.** Client work runs in an account the
  client pays for.
- **Changes going forward.** Rate changes apply to future referrals only, and
  existing referrals keep paying if the program ends.
