# Instantly wave 1

Three campaigns, created 2026-08-12. Still **Draft**, but no longer empty:
1,794 leads after verification. Nothing sends until someone starts them.

Status as of 2026-09-03 is in the audit further down this file; the two lines
below the fold that this note supersedes are struck through where they sit.

| Campaign | Segment | ID | Mailboxes | Daily cap |
|---|---|---|---|---|
| A | serial_bidder | `31fc2282-4153-42f9-b8d7-94517162b47c` | 6 | 120 |
| B | new_prime | `61c3b5df-22b6-4f98-ae56-290a750f1833` | 3 | 60 |
| C | registered_no_awards | `09189743-6310-46bd-b48f-e5ca931d7e7e` | 3 | 60 |

Daily caps are 20 per inbox per day, raised from 5 on request 2026-09-04. See
the Ramp section for what that changes.

Source of truth is `scripts/outreach/instantly-wave1.mjs`. Edit the copy there
and re-run `--sync`; it matches campaigns by name and updates them in place, so
it is safe to run repeatedly and never activates anything.

```bash
node scripts/outreach/instantly-wave1.mjs --check    # guardrails, no API calls
node scripts/outreach/instantly-wave1.mjs --sync     # create or update in place
node scripts/outreach/instantly-wave1.mjs --verify   # assert copy survived the sanitizer
```

## Read this before you start them

**The domains are six days old.** *(Written 2026-08-12. As of 2026-09-03 the
mailboxes are 28 days old — day 30 is 2026-09-05. The reasoning below is
unchanged, the arithmetic has moved on.)* Every mailbox and domain in the
workspace was created 2026-08-06. Instantly's own guidance is a two-week minimum of warmup
before campaign sends, and three weeks is the number that holds up. A warmup
score of 100 does not contradict this: that score is inbox-vs-spam ratio inside
Instantly's own warmup pool over a rolling 7 days, measured against accounts
that are pre-conditioned to open and reply. It is a plumbing check. It says
nothing about how a cold pitch places with an unengaged federal contractor on
Microsoft 365, and you cannot warm your way out of being six days old.

Each mailbox has sent roughly 54 warmup emails in its life. That is not a
sending history.

The campaign schedule carries `start_date: 2026-08-27` as a backstop, so even
an accidental activation sends nothing before then. **That date is now in the
past and the backstop is spent** — as of 2026-09-03 an activation sends on the
next scheduled window. Push `start_date` forward before touching anything. **2026-08-27 is day 21 and
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
  sent from them"). There is not: no commercial mail has ever gone out from
  any address in this workspace, these two included. (The six influencer
  campaigns have since moved to status 1 with a start date of 2026-09-08; the
  three wave 1 campaigns are still Draft. Nothing has sent from either set.)

  What remains is a consistency question rather than a legal one: every other
  mailbox in the workspace sends as "Earl Knight", so putting this domain into
  service would mean either a second From name across the programme or
  repointing these two. Decide that on its merits. It is held out of wave 1
  because wave 1's allocation was already settled, not because it is unusable.
- **winwithgovhub.com** spare.

## Ramp

**Superseded 2026-09-04 on request: wave 1 opens at 20 per inbox per day, not
5.** All twelve mailboxes are set to `daily_limit: 20` and the campaign caps
are 120/60/60, so the programme opens at 240/day rather than 60/day. The
stepped table below is kept because the gates under it still apply and because
the reasoning for the original numbers should not have to be reconstructed.

What the change costs, stated plainly: 20/inbox/day is the number this ramp
treats as the **week-8 ceiling**, and it is being used on day one, on domains
29 days old with roughly a month of warmup behind them. Every gate below is
measured from sends that have not happened yet, so none of them can be checked
before the first batch goes out. The practical consequence is that the first
day of real data arrives at 240 sends instead of 60: if the list bounces, four
times as much of it bounces before anyone can react. Watch bounce rate on day
one, not at the end of week one, and be ready to drop the caps back the same
morning.

The original stepped plan, for reference:

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

1. ~~**Set each of the 12 mailboxes to `daily_limit: 5`.**~~ **Done 2026-09-04,
   at 20 rather than 5** (see Ramp). All twelve were still at 15. The campaign
   cap controls total volume and never its distribution, so without a
   per-mailbox ceiling a couple of mailboxes can absorb the whole daily
   allowance while the rest sit idle. Run
   `node scripts/outreach/instantly-wave1.mjs --mailbox-limits`; it is a
   separate flag from `--sync` because it writes shared mailbox accounts
   rather than campaigns.
2. ~~**Configure `{{accountSignature}}` on every one of the 12 mailboxes.**~~
   **Done 2026-09-03.** An API audit that day found all twelve still at
   `signature: null` while the nine influencer mailboxes had been set, so wave
   1 would have sent 5,400 messages with no postal address.
   `scripts/outreach/set-signatures.mjs` now covers both sets, 21 mailboxes,
   and a read-back of all 48 confirms every mailbox in every campaign carries:

   ```
   Earl Knight
   Founder, GovHub

   3060 Mercer University Dr Ste 110, Atlanta, GA 30341
   ```

   No solicitation line and no opt-out or unsubscribe wording, on request
   2026-09-03; the script's guardrails enforce both. The opt-out notice lives
   in every email body instead, which is where it was always meant to be so it
   cannot depend on a per-mailbox setting. **No valediction** ("Best,",
   "Thanks,") because the bodies do not carry one and it would double up.
   Item 3 below still stands: this is the one thing the API cannot confirm.
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
6. **Clean the list before import.** *(Partly done 2026-09-04: `firstName` was
   already clean on all 1,800 rows, and `companyName` has since been rewritten
   from the raw SAM legal name to a human display name by
   `scripts/outreach/wave1-display-names.mjs`, which keeps the original in a
   `legalName` variable. The role-account and free-provider filters below are
   still outstanding.)* Suppress any lead whose firstName is
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
9. ~~**Verify the list before sending.**~~ **Done 2026-09-04.** All 1,800
   addresses went through MillionVerifier's bulk API and the verdicts are in
   `data/email-verification.json`, so this is now checkable from the repo
   rather than taken on trust. The list came back far cleaner than the
   influencer set that preceded it:

   | Result | Count | Share |
   |---|---|---|
   | ok | 1,698 | 94.33% |
   | catch_all | 68 | 3.78% |
   | unknown | 28 | 1.56% |
   | invalid | 6 | 0.33% |

   The six invalid addresses were removed by
   `scripts/outreach/wave1-suppress.mjs`, leaving 1,794. Bounce exposure from
   known-bad addresses is now 0.00% against a 2% gate, which is the single
   biggest change to the launch risk on this page: the earlier estimate of
   roughly 117 bounces was extrapolated from the influencer list's 6.5%
   invalid rate and was wrong by a factor of twenty.

   Still outstanding, and deliberately not acted on: 68 catch_all and 28
   unknown. Instantly holds catch_alls back on its own while
   `allow_risky_contacts` is false, so deleting them here would do the same
   job twice and lose the leads permanently. `--drop-unknown` and
   `--drop-catch-all` exist if that call changes. MillionVerifier also flags
   80 role accounts and 239 free-provider addresses, which is the data
   checklist item 6 needs.
10. Run Instantly's spam-word checker and the spintax preview. Both pass today
   (`--check` expands all 13,192 renders and finds zero banned tokens), so treat
   this as confirmation, not as launch readiness. Placement is driven by domain
   age, authentication and complaint rate, not by word lists.

## Campaign settings and why

| Setting | Value | Reason |
|---|---|---|
| `text_only` | true | Plain text everywhere. No HTML to a young domain, and it matches the no-images rule. |
| `open_tracking` | false | The pixel is a remote image from a 6-day-old `inst.<domain>` subdomain, and it would put an image into the supposedly text-only email 1. Apple MPP and Microsoft prefetch fabricate opens anyway. |
| `link_tracking` | false | Would rewrite the one email 3 link through the same young tracking domain. |
| `insert_unsubscribe_header` | **false** | RFC 8058 List-Unsubscribe, **turned off on request 2026-09-03**. It had been on for the reason recorded here originally: it is a header rather than visible text, so recipients meet it as Gmail's and Outlook's one-click Unsubscribe control, and it gives anyone who will not reply a non-destructive exit instead of the Report Spam button, which is the single most destructive signal to a new domain. That trade-off was stated when the change was requested and the answer was to turn it off. The reply-based opt-out in every body is unaffected. |
| `stop_on_reply` | true | Structural opt-out safety. Any reply halts the sequence, so no missed opt-out keyword can cause a post-opt-out send. Load-bearing since the 2026-09-04 rewording, because "no" cannot be auto-matched safely. |
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
7. ~~Turned on `insert_unsubscribe_header`, which the doc does not mention.~~
   **Reversed 2026-09-03 on request:** it is now `false` on all three wave 1
   campaigns. See the settings table above for the trade that was made. The six
   influencer campaigns keep theirs on; only wave 1 changed. Item 6 above still
   holds either way, because the opt-out notice it added lives in the bodies.

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
    dropped-subject fragment in email 2 restored; the opt-out keyword quoted so
    the instruction does not scan as two stacked verbs.

    **Reworded 2026-09-04.** The opt-out was `Reply "remove" and I will stop.`,
    with `you are off my list` and `I will take you off my list` in emails 2
    and 3. It now reads `Reply "no" and I will not reach out again.` "Remove"
    and "off my list" are the vocabulary of list management, and a cold email
    that admits to having a list stops reading like one person writing to
    another, which is the whole premise of the message. The mechanism and the
    clarity of the notice are unchanged; only the frame is.

    Email 2's two sentences merged while doing it, because "just say so and I
    will close this out" followed by a separate "Reply ..." said the same thing
    twice. And email 3's "no problem at all" became "that is fine", so the word
    "no" is not doing two different jobs in adjacent sentences.

    Both halves are now enforced in `--check`: every step must carry the
    opt-out, and no step may contain remove / unsubscribe / off my list /
    mailing list. The wording cannot regress quietly in either direction.
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

  **One trap specific to the 2026-09-04 rewording:** the instruction is now
  `reply "no"`, and "no" must NOT be an automatic suppression trigger on its
  own. It is an ordinary word in ordinary replies ("no problem, let us talk",
  "no rush but yes, send it"), so matching the bare token would unsubscribe
  the people most worth keeping. Match the whole phrase, or read the replies by
  hand at this volume. `stop_on_reply: true` halts the sequence on any reply
  regardless, so nothing sends while that judgement is being made.
- **The agency-merge test variant.** Correctly parked in the doc until 500+
  sends of baseline data. Note its body ends in the literal placeholder "...rest
  identical to A/V1..." inside a fenced code block, so do not paste it as-is.
- **Lead import.** ~~No leads are in any campaign.~~ **Superseded: 1,800 leads
  were pushed on 2026-08-24** (A 900, B 450, C 450), with every custom variable
  populated and segment tags matching their campaign on every row. They were
  uploaded straight through the API, so nothing in this repo produced them and
  their provenance is untracked here. Deliverability verification was run in a
  separate session and is not reflected in `data/email-verification.json`,
  which still covers only the influencer database. The rest of this note
  describes the lead engine, which is still not the source of those rows.
  The lead engine
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
