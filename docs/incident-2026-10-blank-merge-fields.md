# Blank merge fields in the angle campaigns, 2026-10-05 to 10-08

**Written 2026-10-16.** Read-only investigation: nothing was sent, and nothing
in Instantly or the outreach schema was changed. The per-lead list is
`data/blank-merge-fields-2026-10.json` (addresses, dates, steps and variable
names only). The proposed strata-parse fix is
`docs/incident-2026-10-blank-merge-fields.strata-parse.patch`.

## The answer

**671 sends to 479 leads went out with blank merge fields, all between 10-05
and 10-08 14:33 UTC. None have gone out since.** Every one of the 8,002
angle-campaign sends between 09-25 and 10-16 was checked, and every lead now in
sequence holds all its variables.

| Campaign | Sends checked | Blank sends | Leads |
|---|---:|---:|---:|
| GH-A1-Recompete | 895 | 81 | 81 |
| GH-A2-MatchedRFP | 3,673 | 563 | 371 |
| GH-A4-CompetitorWon | 1,367 | 27 | 27 |
| GH-A5-DebriefPain | 2,067 | 0 | 0 |
| **Total** | **8,002** | **671** | **479** |

By day: 207 on 10-05, 155 on 10-06, 154 on 10-07, 155 on 10-08.

There were two causes. Neither one was a send racing a variable write:

| Cause | Leads | Sends | What they read |
|---|---:|---:|---|
| 1. Wave 1 contacts **moved** into A1/A2/A4 still holding their wave 1 payload | 272 | 369 | A2: "Hi {first name},  posted  and . It closes . ." then "{first name},  closes ." A1: "your  contract looks like it runs out in ." A4: "Hi {first name},  awarded  in NAICS  to  out of  a few weeks back." |
| 2. A copy change on 10-03 put `{{sol_short}}` into A2 steps 2 and 3, and the leads already in sequence never had it | 207 | 302 | "{first name},  closes Oct 12." and "Should I record a 3 minute video on  instead?" |

The scan also found two problems that are separate from this incident and
still open:

- **A2 is naming presolicitations as open solicitations.** 71 of the 829
  notices A2 has matched are presolicitations (SAM type `p`), including
  W912HV27BA002. 146 leads have already been emailed about one, and 35
  queued rows will be pushed next. See section 5.
- **4,514 of the 8,002 sends carried no postal address.** `{{accountSignature}}`
  is empty on 27 of the 46 angle mailboxes. This started with the 09-29
  reallocation and is still happening on every send day. See section 6.

## 1. How it was measured

- **Fetch.** Every `email_type=sent` email per campaign, one day at a time.
  Any window that came back full (100) was split in half and re-queried, so
  `starting_after` was never followed. That cursor was what 5xx'd on 10-15.
  It took 382 calls, and every one completed.
- **Match.** `instantly-angles.mjs --dry-run` was run at each of the four
  commits whose copy was live in the window (`9197227`, `9c5c285`, `4698831`,
  `4ebbe6a`). Each sent body was matched against the exact step HTML for its
  step, with every `{{token}}` as a capture group, which reads back what each
  variable rendered as. All 8,002 bodies matched a known version, so every
  count above names the specific variables that were empty.
- **Cross-check.** A text heuristic ran as well: double spaces, " posted  and",
  " closes .", a space before punctuation, and `{{` left in. Its only flags
  that the template match did not explain were 782 false positives on A5's
  literal "after the window closes.".
- **Reconcile.** Per-campaign totals equal `GET /campaigns/analytics` for
  09-25 to 10-16 exactly: 895, 3,673, 1,367 and 2,067.
- **Live state.** `instantly-angles.mjs --audit-leads` (new, below) read every
  lead in A1, A2 and A4 on 10-16. 1,878 are still in sequence and none is
  missing a variable.

## 2. Cause 1: a move carries the lead, not its variables

The path, in strata-parse `outreach-push/index.ts`:

1. `POST /leads` is sent with `skip_if_in_workspace: true` and the angle's
   `custom_variables`. If the contact already exists in the workspace, which
   is true of every wave 1 contact released into the angle pool on 10-01,
   Instantly answers 200 with **the existing lead, untouched**. The
   `custom_variables` in the request are never applied.
2. From 10-06 00:41 UTC (`3bbd943`), push moves that lead out of its paused
   wave 1 campaign with `/leads/move`. The move changes the campaign and
   nothing else, so the lead arrives in an **active** angle campaign holding
   `segment`, `naics`, `uei`, and none of the angle's variables.
3. Instantly sends step 1 at the next slot. The reported lead was moved by the
   06:26 UTC run on 10-06 and emailed at 13:08 UTC, which is 09:08 Detroit,
   the first minute of the send window.

**Why no gate caught it.** `gate()` in job_assign and the second completeness
check in job_push both read `outreach.assignments.variables`. That is what
push *meant* to send, and it was complete. Nothing read the lead Instantly
actually renders. `instantly-angles.mjs --check` only proves that each token
in the copy is declared.

**Who moved them.** 118 leads (182 blank sends) were moved by the one-off
repair recorded in `docs/instantly-angle-coverage.md` Day 9. The other 154
(187 sends) were moved by job_push's own move path on 10-06, 10-07 and 10-08.

**Why the lead record now has its variables.** A reply on 10-08 ("What is this
regarding?", from the lead in the report) led to strata-parse `ced2699`
(10-08 23:56 UTC, "a move carries the lead, not the render"). Its message
counts the same 272 leads this scan found. The 272 were backfilled that night,
and none of them has had a blank send since 10-08 14:33 UTC. So the variables
were written after the steps had sent, as the report guessed. It was a repair
after the fact, though, not a race.

## 3. Cause 2: copy that needed a variable the live leads did not hold

`4698831` (10-03, this repo) "A2 names the solicitation in all three steps"
changed step 2 to "{{sol_short}} closes {{sol_close_date}}" and step 3 to
"video on {{sol_short}}". `sol_short` first came from job_assign on the same
day (strata-parse `6448ae1`). The 207 leads pushed between 09-22 and 10-02 had
no `sol_short`, `--sync` pushed the copy anyway, and their next steps rendered
it blank: 99 step-2 and 108 step-3 sends on 10-05, then 95 step-3 sends on
10-07. They were filled after that, and none has had a blank send since. No
commit in either repo records that write.

This one belongs to this repo, and it is now guarded here (section 4.3).

## 4. The guard

### 4.1 What production runs today, and the hole in it

**Production is not `main`.** The deployed `outreach-push` (version 20,
deployed 10-12 23:47 UTC) is byte-identical to strata-parse branch
`claude/instantly-campaign-results-af3kjm` at `52f011e`. That branch has 11
commits that were never merged. One is `ced2699`, which PATCHes the
variables onto a moved lead in an end-of-run confirm pass. **A deploy from
`main` would roll back that fix**, along with the daily-cap, pacing,
time-budget and close-floor fixes on the same branch.

`ced2699` closes the common case and leaves two gaps:

- **The variables go on after the lead is live.** Push runs at about 06:00 UTC,
  so normally the PATCH lands hours before the 13:00 UTC window opens. A run
  inside the window, or a slow confirm pass, sends first.
- **An unconfirmed move is never patched.** If the confirm pass misses a move
  (past `confirmDeadline`, a GET error, a PATCH error, a move still settling),
  the row stays `ready`. The next run's `POST /leads` then finds the lead
  already in the angle campaign, so `landed` is true and the ordinary path
  records the push with no PATCH. That lead sends blank for its whole sequence
  and nothing reports it. It has not happened yet: the 10-16 audit found no
  incomplete lead. The code allows it, though, and `moves_left_for_next_run`
  is the counter that feeds it.

### 4.2 Proposed strata-parse change (not applied)

`docs/incident-2026-10-blank-merge-fields.strata-parse.patch`, made against
`52f011e`, the deployed code. It applies cleanly there and touches 4 files
(+258/-9):

- **`_shared/outreach.ts`** gains `leadMissing(angle, lead)`, which is
  `REQUIRED` checked against the lead's own `payload` (the read shape), and
  `isOpenSolicitationType(type)` (section 5).
- **`outreach-push/index.ts`**, `fillLead()` and `dropBlankLead()`:
  - **Before the move**, the variables (and the person-name-safe
    `company_name`) are PATCHed onto the lead while it still sits in the
    paused campaign. The PATCH *response* is checked: per
    `wave1-display-names.mjs`, it echoes the merged payload at once, while a
    re-read can lag. If anything is still missing, the lead is not moved and
    the row stays `ready`. A lead can no longer reach a live campaign without
    its variables.
  - **On the ordinary path**, a lead the POST *found* (created before this run
    started) is always PATCHed and checked before the row is recorded. This
    closes the unconfirmed-move gap. It also covers a found lead holding
    *another* assignment's variables. A lead the POST created is trusted,
    since its variables were in the create body.
  - **In the confirm pass**, the existing GET is now a read-back. It writes only
    if the read comes back blank.
  - **If a lead still would not render**, it is deleted from the campaign and
    its row set to `failed`, which job_assign retries. A deleted lead can be
    pushed again; a blank email cannot be unsent.
  - **New summary counters:** `blocked_blank_on_lead` and `leads_refilled`.
- **`outreach-signals/index.ts`**: the type filter, section 5.
- **`scripts/outreach-tests/lead-gate.test.mjs`**: 34 cases, run from the
  shipped source like the other outreach tests. Mutation-checked: putting back
  the substring filter fails it, skipping the found-lead PATCH fails it, and
  trusting a PATCH without reading its response fails it. The other outreach
  tests are unchanged. `reply-classifier.test.mjs` has 2 failures on `52f011e`
  with or without this patch.

**Cost.** One PATCH (about 0.3 s) per found lead. Found leads are the moves:
29 to 58 a day since 10-06, so about 10 to 20 s spread over the morning runs. Fresh creates cost nothing. One assumption to check
on the first live run: a lead counts as found when its `timestamp_created`
predates the run, and a create response without that field counts as found
too. If `leads_refilled` comes out near `pushed`, the create response has no
timestamp, every lead is being PATCHed, and the time budget will feel it.

**To ship it:** merge `claude/instantly-campaign-results-af3kjm` into `main`
first so production and git agree, then apply the patch, run
`node scripts/outreach-tests/lead-gate.test.mjs`, and deploy `outreach-push`
and `outreach-signals`.

### 4.3 In this repo (implemented)

`node scripts/outreach/instantly-angles.mjs --audit-leads` is a read-only check
of what Instantly will actually render. It exits 1 if any lead still in
sequence (status active or paused) is missing a required variable, or if any
angle mailbox has no `{{accountSignature}}`. Run it after every push day and
before any copy change.

`--sync` now runs the lead half of that audit first and **refuses to push copy
that would render blank for a lead already in sequence**. That is cause 2.
Fill the leads first, then sync. The signature half only warns during
`--sync`, because a copy change cannot fix a mailbox setting.

## 5. Presolicitations

`outreach-signals` keeps a SAM extract row when
`Type.toLowerCase().includes("solicitation")`. The `Type` labels in the live
extract (sampled 10-16) are Combined Synopsis/Solicitation, Award Notice,
Solicitation, Sources Sought, **Presolicitation**, Special Notice,
Justification, Sale of Surplus Property, and Consolidate/(Substantially)
Bundle. "Presolicitation" contains "solicitation", so in that sample about 10%
of what the filter kept was presolicitations. The bug has been there since the
job was written (`60c0ffc`, 09-21).

A2's copy makes three claims a presolicitation cannot support: that the
agency "posted" the solicitation, that "it closes" on the response date, and
that there are disqualifiers "in this one". No solicitation document exists
yet. W912HV27BA002 is "FY27 ZNRE224302P1 Improve Military Family Housing PAIP
10 Phase 1", USACE Japan District, type `p`, responses due 10-16.

Measured by looking up every notice behind an A2 signal on SAM.gov's own
notice endpoint:

| | |
|---|---:|
| Notices A2 has matched | 829 (`o` 333, `k` 424, **`p` 71**, 1 no longer on SAM) |
| Leads already emailed about a presolicitation | **146** (09-22 to 10-15, 62 of them on 10-07) |
| Queued A2 rows that name one | **35**, on 11 notices closing 10-28 to 11-04 |
| Unused `new` signals on presolicitation notices | 473, of which 75 still have the 8 days A2 needs |
| Of the 479 blank-field leads, also on a presolicitation | 46 |

**Fix:** `isOpenSolicitationType()`, an exact match on `Solicitation` and
`Combined Synopsis/Solicitation` (codes `o` and `k`), is in the patch. It keys
on `Type`, the current type, so a presolicitation that has since been posted
as a solicitation passes. `BaseType` would keep it out.

**Cleanup.** The filter alone does not remove existing rows: `replace_signals`
only replaces `new` rows for companies in the current batch. The SQL below is
proposed and has **not** been run. `dropped_stale` is retryable, so job_assign
re-assigns those companies once a fresh signal shows up. The 71 notice ids are
in `data/blank-merge-fields-2026-10.json` under `presolicitations.notice_ids`.

```sql
begin;
-- The 71 presolicitation notice ids (also presolicitations.notice_ids).
create temp table presol (notice_id text primary key) on commit drop;
insert into presol values
  ('02cdd8de061e4fd0a8f7eca86c194b1d'), ('030881195c3043a1a7687069fe81aa4a'), ('0315d5650bd84aa0aa692900d796cb6c'),
  ('0f4925aabd2d458993c20e5c02be5fa4'), ('1075bed29dc64caca98de4b4d6673ddb'), ('13011d53de00468fa35cdf3ad48c19c1'),
  ('17f27b8ab745466f945a01169dee5f68'), ('18e3f463133e4868b27dd2633c9e3f38'), ('2a875eb14e6e4e16afdb64a07b6534c8'),
  ('2b3076727bc04f60b1f4809aa2b0e028'), ('2cd6ec5a27b243e3b18535089bd65166'), ('2db252bd66744277889eca0aa3c95908'),
  ('3009ffdae48342949d91e43116301741'), ('304e92aa89ac4dbd94107bfe42e95101'), ('343ef59596ee40948c831caf24d766ed'),
  ('354a91828fd442888a52a3b4c5c20bef'), ('38a2184686594bd899b3d60c7f1596fc'), ('3973fd2474e84f38b60c636f0a18041a'),
  ('3e9d24896b164d469cf2d571b9120118'), ('3f351a2742454c4089313dacd2c321ad'), ('42bbc58aa3744defaae1fa881a580e52'),
  ('45fdc319eb3c4330a593aad4609e7beb'), ('50214e18baae4028a7fc4b3993ea0a6d'), ('5215e3f91edc402aa82282bbbd182844'),
  ('545458d1368b44d3aa49cb63c583b520'), ('5683d57e22174c7db42289d0ed345504'), ('61a5ec75dc2b4997ba1fdc70bcf0788a'),
  ('63225ae46a21492b8ec375d1732a1631'), ('68a4eb97d7044a3e8c02ed5bae48871b'), ('6b6ea0960e0f4b2d8b627063fa969545'),
  ('6e6d082adb3147cd8bbd7b19675ed807'), ('6e99688feb1a48479c53b8e6d402bc33'), ('70669b38e1e34ba2b611da3bf03d8fba'),
  ('734cd0d5ae65404ca78210e4fd921b60'), ('7581883380c74315a3e7b13499031ebe'), ('7bd34e5ed23844f2aa2487540e9960de'),
  ('7ced471ce66442578491bae8281c45ce'), ('83684eb6a5774f8383c26070f9eedcf4'), ('86abf8e241f74c1a8560461f7534fe35'),
  ('885c60e0aeaf40bf91050cb5b29304eb'), ('88a7ec06a9be42ed89b80f5fd668a619'), ('8d2105924c044ad0910888ff3ef36175'),
  ('8ed86551d62144faa773f50824adf532'), ('970aaec1f61b4e459a0aa46471ae0185'), ('a856ba7d8ac84435a10f1aa5094f6bc7'),
  ('aa9a6d535c244304bac93aaefe9f5153'), ('abd2fc05fbff428fac47c6d83a955389'), ('ace01cc9924c4a80b28e7965560b18b9'),
  ('ae23b5e00091497f8428aafbf1aa8145'), ('af29e64f197446ea93742b9e5f011a0a'), ('b4709bd4b7d847d6b19b11ea6444bc1f'),
  ('b5b252567d4e43b097547fc6771f6d09'), ('bafa4ee2b1544c28b3c0114300e6feb9'), ('bd396ee6ba114f95a0b279fb63b12eb5'),
  ('c067e8db203941cc9df7822c563233c3'), ('c3d32f1d7bf4490ea86e138cbcdffff7'), ('c73804c98a3d456c91a817d23f1dafa6'),
  ('c916cb090a4a4ffc9a7210d0b3a3bade'), ('ce57d9193a7c443a85b31c07e4ab4f0e'), ('d0321795a6604faba55688cf6544907e'),
  ('d12ffba5201843b1ade1a764619decca'), ('d2f2c1098eac49308b211281a66743fb'), ('da4263b3b17443eb93ff7505021ba3ec'),
  ('da7d76da852c4a48a5b272df763ba91d'), ('de7423f8c62a4d9f99b804b358cdba85'), ('e1e98e99b86f414e9a635ad2c7068917'),
  ('ec430efe842e45b197ef1dd806c07408'), ('ee6ed9d6b50241ef8dffcf654c6f7af9'), ('eeca235b643040a686ceb0c588ab1367'),
  ('f62daacc86a04009b67fd9c9aeabb6b2'), ('f843d753fd4b4faba690e82983c7781c');

-- 35 queued A2 rows that name a presolicitation.
update outreach.assignments a
   set status = 'dropped_stale'
  from outreach.signals s
 where a.signal_id = s.id
   and a.angle = 'A2'
   and a.status in ('ready', 'approved', 'needs_review')
   and substring(s.source_url from 'opp/([0-9a-f]{32})') in (select notice_id from presol);

-- Every unsent signal on them, so job_assign cannot pick one again.
update outreach.signals
   set status = 'expired'
 where kind = 'rfp_match'
   and status in ('new', 'approved')
   and substring(source_url from 'opp/([0-9a-f]{32})') in (select notice_id from presol);
commit;
```

## 6. No postal address on 4,514 sends

`{{accountSignature}}` renders from the sending mailbox, and it is where the
postal address lives (see `TAIL` in `instantly-angles.mjs`). Only 21 of the 48
mailboxes have a signature: exactly the 21 that `set-signatures.mjs` lists
(influencer and wave 1). The 09-29 reallocation (`9c5c285`) moved boxes onto
the angle campaigns that the script never touched. All of them were in no
campaign when it was written.

| | |
|---|---:|
| Angle mailboxes with no signature | 27 of 46 (A1 2/6, A2 15/20, A4 4/8, A5 6/12) |
| Sends with an empty signature, 09-25 to 10-16 | 4,514 of 8,002 |
| Sends from a mailbox that has a signature | 0 empty |

The emails themselves read normally; the last line is just missing. The
postal address is the CAN-SPAM element this programme decided to keep when
it removed the opt-out line (09-29). Nothing was changed here, because
signatures are a live mailbox setting. Adding the 25 Earl Knight boxes to
`set-signatures.mjs` and running it is mechanical. `j.knight@` and `j.k@`
bidwithgovhub name a different person, which is why `set-signatures.mjs` left
them out, so they need their own signature or to come off A2. That is Earl's
call. The mailbox list is under `mailboxes_without_signature` in the data
file.

## 7. The affected leads, for a correction decision

`data/blank-merge-fields-2026-10.json` `leads` has one entry per lead and
campaign. Each entry gives the cause, every blank send (step, sent time,
sending mailbox, which variables were empty), the lead's status in Instantly
now, whether they have replied, and for A2 whether their solicitation was a
presolicitation.

| Now | Leads |
|---|---:|
| Sequence completed | 339 |
| Still in sequence; the remaining steps now render correctly | 137 |
| Bounced | 3 |
| Have replied (check the reply desk before writing to them) | 20 |

The A2 leads under cause 1 (164) got a step 1 with no content at all, so they
never learned what the email was about. The A1 and A4 leads under cause 1
(108) got the pitch with its specifics blank: the agency, the date, the award,
the competitor. Cause 2 leads (207) got a correct step 1 with the
solicitation named, then a later step missing only its short name. If Earl
sends a correction, the 164 are the group it would help most.

## 8. Re-checking

```
node scripts/outreach/instantly-angles.mjs --audit-leads   # live, read-only
node scripts/outreach/instantly-angles.mjs --check         # copy guardrails, offline
```

The send scan was a one-off and is not committed. Section 1 has enough to
reproduce it: day windows split until each holds fewer than 100, and bodies
matched against `--dry-run` output at each commit whose copy was live.
