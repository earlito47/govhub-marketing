# Instantly wave 1

Three campaigns, created 2026-08-12 and **left in Draft with zero leads**.
Nothing sends until someone uploads leads and starts them.

| Campaign | Segment | ID | Mailboxes | Daily cap |
|---|---|---|---|---|
| A | serial_bidder | `31fc2282-4153-42f9-b8d7-94517162b47c` | 6 | 30 |
| B | new_prime | `61c3b5df-22b6-4f98-ae56-290a750f1833` | 3 | 15 |
| C | registered_no_awards | `09189743-6310-46bd-b48f-e5ca931d7e7e` | 3 | 15 |

Source of truth is `scripts/outreach/instantly-wave1.mjs`. Edit the copy there
and re-run `--sync`; it matches campaigns by name and updates them in place, so
it is safe to run repeatedly and never activates anything.

```bash
node scripts/outreach/instantly-wave1.mjs --check    # guardrails, no API calls
node scripts/outreach/instantly-wave1.mjs --sync     # create or update in place
node scripts/outreach/instantly-wave1.mjs --verify   # assert copy survived the sanitizer
```

## Read this before you start them

**The domains are six days old.** Every mailbox and domain in the workspace was
created 2026-08-06. Instantly's own guidance is a two-week minimum of warmup
before campaign sends, and three weeks is the number that holds up. A warmup
score of 100 does not contradict this: that score is inbox-vs-spam ratio inside
Instantly's own warmup pool over a rolling 7 days, measured against accounts
that are pre-conditioned to open and reply. It is a plumbing check. It says
nothing about how a cold pitch places with an unengaged federal contractor on
Microsoft 365, and you cannot warm your way out of being six days old.

Each mailbox has sent roughly 54 warmup emails in its life. That is not a
sending history.

The campaign schedule carries `start_date: 2026-08-27` as a backstop, so even
an accidental activation sends nothing before then. **2026-08-27 is day 21 and
the earliest defensible launch date.** Day 30 (2026-09-05) is better if there
is no urgency.

Warmup is a separate bucket from campaign sends and does not count against
either daily limit, so leave it running permanently. It is additive: a mailbox
at campaign limit 15 plus warmup limit 12 makes 27 real sends a day.

## Mailbox allocation

One mailbox per domain, twelve domains, each campaign on its own set. That buys
twelve independent placement readings instead of four, leaves two untouched
mailboxes per domain as wave 2 capacity, and means campaign C (coldest list, so
the highest complaint risk) cannot contaminate the domains carrying A and B.

- **A** buildwithgovhub, usegovhub, govhubcontracts, govhubprocurement, govhubcapture, trygovhub
- **B** getgovhub, govhubteam, govhubnow
- **C** govhubhq, govhubsubmittals, govhubrfp

Every address is `warmup_status: 1` with a warmup score of 100.

Held out of wave 1 on purpose:

- **govhubbids.com, govhubproposal.com** warmup never started, score 0. Start
  warmup or leave them out.
- **bidwithgovhub.com** carries `j.knight@` and `j.k@` under the account name
  "Earl Knight". The original note here read: "if there is no J. Knight, that
  forfeits the CAN-SPAM §7704(a)(1)(B) safe harbour for an accurate From line",
  and recommended retiring both addresses.

  **That conditional has since been answered, and the answer is that there is
  a J. Knight.** The account holder confirmed on 2026-09-03 that they also go
  by Jerry and by EJ Knight. So `j.knight@` and `j.k@` name a real person and
  are not an inaccurate From line; §7704(a)(1)(B) is not in play and the domain
  is not disqualified on that basis.

  The original note also assumed there was historical exposure ("mail already
  sent from them"). There is not: all nine campaigns in this workspace read
  status 0 (Draft) as of 2026-09-03 and none has ever been activated, so no
  commercial mail has gone out from any address here, these two included.

  What remains is a consistency question rather than a legal one: every other
  mailbox in the workspace sends as "Earl Knight", so putting this domain into
  service would mean either a second From name across the programme or
  repointing these two. Decide that on its merits. It is held out of wave 1
  because wave 1's allocation was already settled, not because it is unusable.
- **winwithgovhub.com** spare.

## Ramp

Launch L = 2026-08-27. Weekdays only.

| Week | Volume |
|---|---|
| 1 | 12 mailboxes x 5/day = 60/day |
| 2 | 12 x 8 = 96/day |
| 3 | 12 x 12 = 144/day, plus wave 2 (2nd mailbox per domain) at 5/day = 204/day |
| 4 | wave 1 at 15/day, wave 2 at 8/day = 276/day |

Hard-cap every mailbox at 20/day through week 8. Only consider 25-30/day after
the domains pass 60 days old with clean placement tests.

Do not advance a step unless all of these held on the previous one: bounce rate
under 2% (stop and investigate at 3%), reply rate at or above 3%, zero spam
complaints, and seed placement at or above 90% primary inbox. If a gate fails,
hold volume flat for a full week rather than stepping down and back up.

Week 1 list quality matters more than anything else here. Bounces are what kill
a three-week-old domain, not content.

## Pre-launch checklist

1. **Set each of the 12 mailboxes to `daily_limit: 5`.** They are at 15 today.
   The campaign cap alone does not control distribution, so without this a
   couple of mailboxes can absorb the whole daily allowance. Left unchanged
   deliberately: it is a live config change on shared mailboxes and nothing is
   sending yet.
2. **Configure `{{accountSignature}}` on every one of the 12 mailboxes.** It is
   a per-mailbox setting, so one mailbox missing it sends with no signature at
   all while the campaign preview still looks fine. The signature is the sole
   carrier of the postal address and the solicitation disclosure, so a blank one
   is a compliance failure, not a cosmetic one. Content: name, GovHub, the
   solicitation line, the PINS mailing address. **No valediction** ("Best,",
   "Thanks,") because the bodies do not carry one and it would double up.
3. **Send a seed email from every mailbox** to an address you control and
   confirm the signature renders with the full address. Repeat on a same-thread
   follow-up, not just email 1.
4. **Run five canary leads** through the real import path before any real list:
   (a) every field blank but email, (b) firstName ALL CAPS with a raw legal
   company name, (c) firstName as "LAST, FIRST", (d) firstName as a role word
   like "Contracts", (e) a long company name with an embedded comma. Read the
   received plain-text part, not the preview pane. Instantly's preview
   substitutes a populated sample lead, so every blank-variable failure stays
   invisible until the first real send.
5. **Confirm the day mapping in the UI.** The schedule is
   `{0:false, 1..5:true, 6:false}` on the reading that 0 = Sunday. Instantly's
   own AI SDR wrote exactly that on a schedule it named "Weekdays" in this
   workspace, but the API reference never states the mapping and the spec's own
   example implies 0 = Monday. Open the campaign and check the picker shows
   Mon-Fri. Five seconds, and the alternative is sending Saturdays.
6. **Clean the list before import.** Suppress any lead whose firstName is
   blank, under 2 characters, contains a digit or `@`, matches a role word
   (info, sales, contracts, admin, office, procurement, bids, proposals, team,
   support, hr), or carries a company suffix (LLC, Inc, Corp, Ltd, Group,
   Solutions, Technologies, Services). "Hey CONTRACTS," is not a typo to a
   reader, it is proof of process. Reject any row with a blank companyName
   outright: no fallback text repairs "noticed ___ has been active".
7. **Filter to US-domiciled recipients.** CAN-SPAM is an opt-out regime; CASL
   (Canada) and GDPR/PECR (EU/UK) are consent regimes that cold outbound cannot
   satisfy retroactively. SAM data carries entity address, so this is a cheap
   filter and a single Canadian recipient is a materially larger exposure.
8. **Cross-check the suppression ledger.** `data/vendor-outreach.json` is the
   existing opt-out record for the vendor "claim your page" outreach. Anyone
   marked `opted-out` there must not enter these campaigns.
9. Run Instantly's spam-word checker and the spintax preview. Both pass today
   (`--check` expands all 13,192 renders and finds zero banned tokens), so treat
   this as confirmation, not as launch readiness. Placement is driven by domain
   age, authentication and complaint rate, not by word lists.

## Campaign settings and why

| Setting | Value | Reason |
|---|---|---|
| `text_only` | true | Plain text everywhere. No HTML to a young domain, and it matches the no-images rule. |
| `open_tracking` | false | The pixel is a remote image from a 6-day-old `inst.<domain>` subdomain, and it would put an image into the supposedly text-only email 1. Apple MPP and Microsoft prefetch fabricate opens anyway. |
| `link_tracking` | false | Would rewrite the one email 3 link through the same young tracking domain. |
| `insert_unsubscribe_header` | true | RFC 8058 List-Unsubscribe. Gives anyone who will not reply a non-destructive exit instead of the Report Spam button, which is the single most destructive signal to a new domain. |
| `stop_on_reply` | true | Structural opt-out safety. Any reply halts the sequence, so no missed removal keyword can cause a post-opt-out send. |
| `stop_on_auto_reply` | false | An out-of-office should not burn the lead. |
| `stop_for_company` | true | One conversation per company at a time. |
| `email_gap` | 12 min | A mailbox never bursts. |
| `prioritize_new_leads` | false | Finish sequences in flight before starting new leads, so follow-ups are not starved. |
| `match_lead_esp` | false | Every mailbox is the same provider, so this buys nothing. |
| `auto_variant_select` | null | Never auto-promote a subject line on a small sample. |
| `timezone` | America/Detroit | The field is a closed enum of 102 IANA strings and `America/New_York` is **not** in it. Detroit is the US Eastern slot. |

Cadence: email 1 on activation, email 2 three days later, email 3 four days
after that (day 7). `delay` is the gap to the **next** email, not a wait before
the step, so the last step's delay is inert.

## Changes made to the sequence doc

The copy came from `instantly_sequences_spintax.md`. Voice and structure are
unchanged. These are the substantive edits, in descending order of consequence.

**Two that would have broken sends:**

1. **Campaign B email 1 nested `{{companyName}}` inside a `{{RANDOM}}` block.**
   Nesting is documented as supported since April 2025, but a naive brace match
   terminates the block at the inner `}}` and emits a literal `}}` to every
   lead, on the first line, for 100% of that campaign. Restructured so the
   variable sits outside the block. Not worth the risk to find out.
2. **Campaign B email 1 fed a singular subject into plural verbs.** "the
   founder" + "still write every proposal" / "still do all the writing" broke
   512 of its 1,024 combinations, exactly half the campaign. Moved the verb into
   the subject block so agreement travels with it: "the founder is still
   writing".

**Blank-merge-field failures:**

3. Subjects that were a bare `{{companyName}}` sent as "(no subject)" when
   blank, and Campaign C's `{{firstName}}?` sent as a one-character `?`. Every
   subject now keeps a real word, so a blank degrades to "proposals", "next bid"
   or "bids" instead.
4. Email 3 opened on `{{firstName}},` which renders a leading comma, and that
   line is the whole inbox preview for a same-thread send. Reordered to
   "Last note from me, {{firstName}}."
5. Email 2 had `{{firstName}}?` sitting on a punctuation boundary in a 30-word
   bump where the artifact would be the entire email. Dropped the name; the
   message is already in the recipient's own thread.

**Compliance:**

6. **Added an opt-out line to emails 1 and 2.** Only email 3 had one, so about
   two-thirds of sends carried no opt-out notice. §7704(a)(5)(A) asks for three
   disclosures in *every* commercial message: identification as a solicitation,
   opt-out notice, and a postal address. The doc's conclusion that the address
   line plus reply-based removal covers CAN-SPAM accounts for one of the three.
   Reply-based opt-out is itself fine, the FTC guide allows it; it just has to
   be *noticed* in each message. Item 2 of the checklist puts the solicitation
   disclosure and the address in the signature.
7. Turned on `insert_unsubscribe_header`, which the doc does not mention. This
   is a header, not a visible link, so email 1 still has no links.

**Copy defects found by expanding all 26,012 original combinations:**

8. Campaign C had a comma splice in every one of its 256 renders ("is not
   capability, it is the proposal itself"). Split into two sentences. Not an em
   dash: `scripts/check-emdash.mjs` bans those as an AI-writing tell.
9. "drop good bids" and "drop the RFP in" could both be drawn, putting "drop"
   in a short email twice in opposite senses, in 25% of Campaign A renders.
10. "bid more" appeared twice in a 60-word Campaign B email in 256 renders, so
    the payoff line read as a restatement of the problem.
11. "What usually happens next:" introduced a sentence that starts with the past
    ("the first win comes on hustle").
12. Dangling appositive in email 3 item 3, "flags disqualifiers before you
    submit, the stuff that gets bids thrown out unread".
13. "not price" / "not on price" was a spin block whose two options differed by
    one preposition, adding combinations and no variation. Collapsed.
14. "a 2 minute example" now hyphenated; "active on federal work" now "has been
    bidding"; "the compliance matrix" now indefinite on first mention; the
    dropped-subject fragment in email 2 restored; "remove" quoted so the opt-out
    instruction does not scan as two stacked verbs.
15. "Worth a quick look?" was byte-identical across Campaigns A and C. CTA and
    subject vocabulary are now disjoint per campaign, which is the whole point
    of varying the fingerprint.
16. Dropped "congrats on the recent federal win": it asserts a specific fact
    from award data, which is what the doc's own signal-not-merge-variable
    decision exists to avoid. If the award was a subcontract, a modification or
    an option exercise, the opener congratulates someone on something that did
    not happen.
17. Dropped "but I could not find any prime awards yet" from Campaign C. Opening
    a cold email by telling a prospect your research found nothing they had won
    is a status dig on the first line, to the segment already most likely to
    reject.
18. Email 2's `{{RANDOM|Best|Thanks}},` sign-off was the only valediction in the
    file. Removed for consistency, and because it doubles up if a mailbox
    signature starts with one.

## Not built

- **Subsequences.** Not created, per the decision to keep this to campaigns and
  sequences. When you do build them, two things from the doc need fixing first.
  The two triggers overlap as substrings: "interested" is inside "not
  interested" and "send" is inside "stop sending", so "do not send anything
  further" matches the *asset* trigger and answers an opt-out request with a
  marketing email. And the removal keyword list (`remove`, `not interested`,
  `unsubscribe`, `stop`) misses "take me off your list", "no thanks", "not a
  fit", "wrong person", "opt me out", "this is spam". `stop_on_reply: true` is
  already on, which is the structural backstop, but widen the list too:
  over-matching costs one lead, under-matching costs a violation and a
  complaint.
- **The agency-merge test variant.** Correctly parked in the doc until 500+
  sends of baseline data. Note its body ends in the literal placeholder "...rest
  identical to A/V1..." inside a fenced code block, so do not paste it as-is.
- **Lead import.** No leads are in any campaign. The lead engine
  (`scripts/leadgen/`) has no `firstName` field at all: it emits `contact_person`
  and `poc_name` as pre-joined full-name strings, so a first-name column has to
  be derived before import. `tier == "A - serial bidder"` maps to segment A but
  over an 18-month window and only below $15M, so genuine serial bidders above
  that land in "D - review". `tier == "N - new prime"` is 1-award-only, so the
  2-award half of the new_prime definition sits in "B - repeat bidder". Nothing
  in the pipeline produces the registered_no_awards segment for C.
- **A `govhub.online` link on a `.com` sending domain.** All 12 sending domains
  are `.com` and the only link in the sequence points at `govhub.online`.
  Sender/link domain mismatch is a phishing-adjacent signal and `.online` has a
  worse baseline reputation than `.com`. It lands in email 3 and, if you build
  the asset subsequence, in the mail going to your warmest replies.
