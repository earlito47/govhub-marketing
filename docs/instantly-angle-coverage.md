# Signal personalization: measured coverage and whether it is worth running

**Measured 2026-09-22.** Every number here came from a live run against the real
data, not an estimate. Where a number is an extrapolation it says so and gives
the sample it came from.

The question this answers: with 24,000 contacts, how many can actually receive a
personalized email rather than a generic one, and is the machinery worth the
trouble?

---

## 1. The funnel: 24,000 contacts are not 24,000 prospects

| Stage | Count | Lost |
|---|---:|---:|
| Raw contacts in `prospect_pool` | 24,000 | |
| ...with an email address | 20,552 | −3,448 |
| ...deliverable (`mv_result = ok`) | 14,868 | −5,684 |
| ...never contacted in a prior wave | 13,068 | −1,800 |
| ...matching the gate ($50K–5M obligations, ≤2 new awards) | 7,506 | −5,562 |
| ...loaded and unsuppressed in `outreach.companies` | **7,326** | −180 |

**The audience gate was widened on 2026-09-22, from $100K–1M with 1–2 awards to
$50K–5M with at most 2.** The live universe went from 2,385 to 7,326.

The widening was measured before it was made. A2's NAICS coverage is flat
across every obligation band — 57% under $50K, 65% in the old band, 68% above
$10M — so the old gate was never buying personalization quality. What the new
ceiling protects is the *message*: above $5M or more than 2 awards a year,
firms average 1.7 to 3.2 awards and plainly do have capture staff, so "you have
no proposal team" would be addressing someone who is not there.

| Obligation band | Contacts | A2 coverage |
|---|---:|---:|
| under $50K | 1,378 | 57.4% |
| $50K–100K | 726 | 62.7% |
| $100K–1M (old band) | 3,838 | 65.1% |
| $1M–2.5M | 2,031 | 67.6% |
| $2.5M–5M | 1,502 | 66.3% |
| $5M–10M | 1,224 | 66.7% |
| over $10M | 2,369 | 68.2% |

Every coverage figure that follows is against the 7,326 now loaded.

---

## 2. Coverage per angle, measured

| Angle | Signal | Coverage | How measured | External dependency |
|---|---|---:|---|---|
| **A2** Matched RFP | live solicitation in your NAICS closing in 8–21 days | **66.1%** (4,844 / 7,326) | full census, every company against all 83,926 records | **none** — free public CSV, no key, no quota |
| **A4** Competitor won | award ≤45 days old in your NAICS + state | 44.4% standalone (79 / 178) | sample, ±7pp | USASpending API, no key |
| **A1** Recompete | your own contract ending 60–150 days out | 15.6% (28 / 179) | sample, 95% CI 11–22% | USASpending API, no key |
| **A5** Generic | none | remainder | | none |

**A3 (SAM registration expiring) was removed on 2026-09-22.** Both keys fail:

```
SAM_API_KEY      → 401  {"code":"900901","message":"Invalid Credentials"}
SAM_GOV_API_KEY  → 429  {"code":"900804","message":"Message throttled out"}
```

`SAM_GOV_API_KEY` is valid but its daily quota is spent on the user-facing
`company-lookup` feature, which has first claim. The angle sat at 0% coverage
while holding 10 of the 45 daily send slots and two mailboxes open for mail it
could never generate. Its cap and its mailboxes went to A2. Restoring it needs
a third SAM key dedicated to outreach; the code comment in `job_assign` lists
exactly what to put back.

### A2 is the one that carries the system

One streaming pass over SAM's daily Contract Opportunities extract (236 MB,
83,926 records) matched 4,844 of 7,326 companies. No API key, no quota, no
per-company call — the whole universe is covered in a single run.

It is also genuinely personalized rather than nominally so: at the old size,
172 distinct solicitations were cited across 1,577 companies, a mean of 9.2
each. Two companies get the same RFP named only when they are direct
competitors in the same NAICS, where the claim is equally true of both.

**Caveat — A2's stock is a flow, not a reservoir.** At the last reading, 954 of
1,577 eligible companies were keyed to solicitations closing within three days
of leaving the 8-day buffer. The stock is refilled nightly from new postings,
but any single figure is that day's reading, not a balance.

## 3. Projected steady-state mix

The assigner's priority is A1 > A2 > A4 > A5, so what matters per angle is its
*marginal* contribution after the ones above it, not its standalone rate.

**A4 overlaps A2 heavily.** Of the companies A4 finds an award for, 87% also
have a matched RFP, against 51% of the ones it finds nothing for — both angles
key off the same active NAICS, so they reach the same firms. A1 shows no such
correlation (69% of its hits carry an A2 signal against 71% of its misses).

A4's rate *within the A2 remainder* is now measured directly rather than
derived: **165 hits in 436 scanned, 37.8%**. An earlier version of this
document put it at 17.5%, computed from a 2×2 overlap table whose relevant cell
held ten observations; that figure was noise and is withdrawn. (The 436 come
from the first ~120 NAICS+state pairs in id order, and larger pairs are
over-represented, so treat 37.8% as the optimistic end of a 25–40% range.)

| Angle | Standalone rate | Marginal after higher priority | Share |
|---|---:|---:|---:|
| A1 Recompete | 15.6% | 1,143 | 16% |
| A2 Matched RFP | 66.1% | 4,087 | 56% |
| A4 Competitor won | 44.4% | 792 | 11% |
| A5 Generic | — | 1,304 | 18% |
| **Personalized** | | **6,022** | **82%** |

Half of the A2-eligible are coin-flipped into A5 with `holdout = true` — that
is the experiment, and it is why the live A2 share reads lower than 56% until
the test concludes. A preview run over 2,000 companies gave 670 A2 and 609
holdouts, a clean 50/50 of the 1,279 eligible, with **0 gate fallbacks**: every
render passed the truthfulness gate.

---

## 4. Coverage is not the constraint. Sending capacity is.

Daily caps after A3's removal: A1 10, A2 20, A4 10, A5 15 — **55/day**. Against
7,326 companies that is **133 working days, about 6 months**.

A2 alone has ~4,800 companies ready against a cap of 20/day: **240 days of
backlog from one angle**. Total signal coverage exceeds sending capacity by
roughly 100×.

So the question is not "do we have enough coverage". It is "which angle gets
the 55 daily slots", which is exactly what the A2-versus-holdout test measures.
If volume is the goal, the lever is mailbox capacity and sending caps, not
signal supply — and deliverability, not arithmetic, sets that ceiling.

---

## 5. Scanner throughput

| Job | Per run | Full pass at 1 run/day |
|---|---:|---:|
| A2 opportunities | all 7,326 (one streamed pass) | 1 day |
| A4 awards | ~60 API calls / ~377 companies | ~24 days |
| A1 recompetes | ~59 companies | ~124 days |

**A1's cron was weekly**, which at ~59 companies a run is 124 *weeks* for this
universe — the angle would never have reached most of the audience. It is daily
now, which matches its own 10/day send cap: 59 scans at 15.6% yields ~9 signals
a day.

**A4 now only scans companies A2 did not reach.** A signal for an A2-covered
company is one the assigner will never read, since A2 outranks A4. In the run
that proved this out, 4,599 companies were skipped on that basis and 377
scanned. One correction to an earlier claim: this does *not* cut the API call
count much — pairs are keyed NAICS+state and a pair survives if any member is
uncovered, so the pair count only fell from 1,506 to 1,448. What it changes is
that every signal produced is now incremental reach rather than dead weight,
and each call serves 6.3 uncovered companies instead of 3.2 mixed ones.

---

## 6. Recommendation

1. **Run it.** A2 alone justifies the system: 66% coverage, no key, no quota,
   one run, 240 days of backlog against its own send cap.
2. **Do not make the emails more generic.** A5 already *is* the generic arm and
   half the A2-eligible population is routed to it as a controlled holdout.
   Making the personalized angles generic deletes the experiment before it
   returns a result.
3. **A3 is removed.** It needs its own SAM key. Its slots went to A2.
4. **Keep A1 despite the 16%.** It is uncorrelated with A2, so all ~1,143
   companies are reach A2 would not have delivered, and it only has to fill 10
   slots a day.
5. **Keep A4 too.** At 37.8% of the A2 remainder it contributes ~792 companies,
   11% of reach — enough to be worth its ~1,448 API calls. An earlier version
   of this document recommended demoting it to a copy test on the strength of a
   17.5% estimate; that estimate was wrong.
6. **The audience gate is widened** to $50K–5M with ≤2 awards, 2,385 → 7,326.
   Further widening is available (no dollar gate at all reaches 11,993) but
   costs message accuracy: past 2 awards a year the "no proposal staff" premise
   stops being true.

---

## 7. What measuring this turned up

Chasing a 28%-versus-68% contradiction, and then widening the audience, surfaced
nine defects. Not one of them threw an error where anybody would see it.

**Silent data loss**
- **PostgREST `max_rows` truncation, five places.** The opportunities NAICS
  index was built from the first 1,000 of 2,385 companies — the entire
  28%-versus-66% gap. `job_assign` would have reported "nothing unassigned"
  while 1,385 companies sat untouched, the moment 1,000 were assigned.
- **The A1 and A4 scanners never advanced.** Their only memory of "done" was
  "carries a live signal", so a company scanned and found to have nothing came
  back in the next batch forever. At a 15.6% hit rate the cursor moved 16
  companies a run instead of 119 — about 200 nights to walk the universe.
- **`outreach-recompetes` ran weekly**, which is 124 weeks per pass at this
  size.

**Writes that half-succeeded**
- **An unbounded 1,556-id `.in()` delete** — a 57 KB request line — killed the
  worker. Chunking fixed it at 2,385; at 7,326 the chunked version wrote all
  3,972 rows and *then* died returning, half-committing and reporting nothing.
  Both are gone: the write is one set-based RPC.
- **The signal refresh deleted rows an assignment pointed at**, correctly
  rejected by `assignments_signal_id_fkey`.
- **`job_assign` treated every assignment as final**, so a company whose signal
  went stale between assign and push was burned permanently. At 500 assignments
  a day against a 55/day send rate that would have quietly eaten the audience.
- **`?preview=1` deleted rows** before reaching the preview check.

**Wrong in front of the reader**
- **Every first name was in capitals.** 2,383 of 2,385. Every email would have
  opened "Hi PHONG," about "ADVANCED SOLUTIONS LIFE SCIENCES, LLC" — the most
  visible text in the message, reading as an obvious mail merge, in a system
  built to not look like one.
- **A4's plausibility ceiling was a flat $5M**, right for a $100K–1M universe
  and wrong at both ends of a $50K–5M one. It is ten times the reader's own
  obligations now, checked per reader rather than per pair.

All fixed, deployed, and verified by re-running. Two numbers published earlier
in this document were also wrong and have been withdrawn above: A4's marginal
rate (17.5%, from a ten-observation cell; directly measured at 37.8% on 436)
and a claim that restricting A4's scan cuts two thirds of its API calls (it
cuts 4%; what it cuts is wasted output).

---

## 8. Verification log, 2026-09-22

| Check | Result |
|---|---|
| Live universe | 7,326 |
| Suppression leaks vs every contacted lead, case-insensitive | **0** |
| Unsuppressed rows matching a suppressed row by email case | **0** |
| Rows missing uei / naics / state / first_name | **0** |
| A2 census at the new size | 4,844 / 7,326 = 66.1% |
| Opportunities run accounting | 4,844 matched − 872 already assigned = 3,972 written, 3,972 replaced |
| Assign preview over 2,000 | 670 A2 + 609 holdouts, 0 gate fallbacks |
| Name rendering | "Knexus Research LLC", "Madison Avenue Support Services, Inc" |
| Assign run, 300 companies | A1 4, A2 89, A4 18, A5 189, 99 holdouts, 0 gate fallbacks |
| Push dry run | 211 candidates, 29 to outbox, 0 stale / 0 suppressed / 0 incomplete / 0 failed |
| `dry_run` | **false** since 2026-09-22 — the programme is live |
| Campaigns | A1, A2, A4, A5 Active, start 2026-09-23, 09:00-16:00 America/Detroit |
| First push | 49 leads, 0 failed, verified against the live API |
| A2 live arm split | 11 base / 9 speed |

Manual approval was turned off on go-live: the owner chose volume at scale,
and the premise check every A2 row has to pass (a real solicitation whose
NAICS matches this company) is enforced by job_assign's gate rather than by a
human. `outreach-push` also had no cron entry, so leads only entered Instantly
when triggered by hand; it now runs weekday mornings at 06:00 UTC, an hour
after assign and seven hours before the sending window opens.

**A note on one thing that did not go wrong.** The first live push looked, for
about a minute, like it had written 20 A2 leads with every variable blank --
"Hi Abel, undefined posted undefined". All four campaigns were paused and
`dry_run` reverted on the strength of it. The leads were correct; the checker
was reading `custom_variables`, which is the field job_push WRITES, while
Instantly returns them under `payload` on read. Nothing had been sent. The
verification is a committed tool now (`scripts/outreach-tests/verify-live-leads.mjs`
in strata-parse) with that asymmetry documented at the top of it.

---

## 9. Day 1 — 2026-09-23

First live sending day. Window 09:00–16:00 America/Detroit.

| Angle | Contacted | Sent | Bounced | Human replies | Positive |
|---|---:|---:|---:|---:|---:|
| A1 Recompete | 4 | 4 | 0 | 1 | 0 |
| A2 Matched RFP | 20 | 20 | 0 | 0 | 0 |
| A4 Competitor won | 10 | 10 | 0 | 0 | 0 |
| A5 Generic | 15 | 15 | 0 | 0 | 0 |
| **Total** | **49** | **49** | **0** | **1** | **0** |

Rates are over **contacted**, per the week-1 convention. Reply rate 2.0%
(1/49) against wave 1's 2.12% overall and 5.0% for its closest segment — a
difference of one reply either way would move it by two points, so the two are
indistinguishable and neither number means anything yet.

**This is a smoke test, not a result.** It answers three questions: did it
send (yes, 49 for 49), did it bounce (no, 0.00% against a 2% gate and wave 1's
0.64%), and did anything reply at all (yes, once). It cannot say anything
about which angle or which A2 arm works. Detecting a doubling of reply rate
needs roughly 440 contacts per arm — about 45 working days at these caps — and
today put 11 in one A2 arm and 9 in the other.

### The one reply

A1, to a Maryland firm with $576K in obligations whose VA contract ends in
December. The reply was **"No."** — negative, and the person's answer rather
than the company's, which is why `stop_for_company` is false.

Worth separating from wave 1's negatives: this one **did not dispute the
premise**. Wave 1's campaign C drew "NO" from people whose stated premise was
wrong about them, and reply rate there tracked premise accuracy rather than
tone. A terse "No." to an accurate, checkable claim about the reader's own
contract is a different thing — a no to the offer, not a correction.

### Personalization verified in delivered mail

Both A2 arms, read back from the sent feed rather than from the templates:

> **Speed** — "Hi Acksa, DoD posted HR001126S0016 and on paper Defense
> Consulting And Technology LLC clears the bar on NAICS 541715. It closes
> Oct 2. Putting a full response together is usually a week or more of nights
> and weekends… We turn the first draft around in about an hour."

> **Base** — "Hi Clayton, DoD posted W912ER26RA017 and on paper Advantage
> Paving & Excavating Inc clears the bar on NAICS 237310. It closes Oct 5.
> There are a couple of things in it that typically get small firm bids tossed
> before evaluation."

Real solicitation numbers, real NAICS matches, real close dates, correct
casing, signature and opt-out intact, zero unrendered tokens across all 94
live leads.

### Two caps, not one

94 leads exist but 49 were contacted, because `daily_max_leads` gates entry to
each Instantly campaign independently of `job_push`'s own caps, and every
campaign hit its gate exactly. The two are near-balanced, which keeps the queue
flat — but raising volume means raising **both**, and raising `daily_caps`
alone would do nothing.

### Fixed on the day

- **A1 was structurally dead.** `job_assign` and the recompete scanner both
  walk the universe in email order, and assign moves 150/day against the
  scanner's 60 — so the scanner is permanently behind and every hit belongs to
  a company already assigned. On launch morning that was 239 of 239. It found
  20 real recompetes and wrote none. The scanners now skip assigned companies;
  the re-run wrote 14 of 14. A1's four sends today were the last of the old
  stock, and it refills tomorrow.
- **`job_health` could not remember.** pg_net keeps responses ~5.5 hours, so by
  evening every job from the small hours read "NO RESPONSE (overdue)" —
  including five verified 200 at 06:35. Outcomes are now copied into
  `outreach.job_run` by a harvester every ten minutes. This also repairs the
  metrics job's incremental email read, which had fallen back to the epoch for
  the same reason.

---

## 10. Running log

Cumulative, rates over **contacted**. One line a day; anything that needed a
decision gets its own note below the table.

| Day | Date | Contacted | Sent | Bounced | Human replies | Positive |
|---|---|---:|---:|---:|---:|---:|
| 1 | 2026-09-23 | 49 | 49 | 0 | 1 | 0 |
| 2 | 2026-09-24 | 104 | 104 | 0 | 2 | 0 |
| 3 | 2026-09-25 | 155 | 175 | 0 | 2 | **1** |
| 4 | 2026-09-28 | 211 | 386 | 2 | 6 | **2** |
| 5 | 2026-09-29 | 310 | 485 | 5 | 6 | **2** |
| 6 | 2026-09-30 | 495 | 727 | 8 | 7 | **2** |
| 7 | 2026-10-01 | 725 | 980 | 9 | 11 | **4** |
| 8 | 2026-10-02 | 896 | 1,351 | 12 | 15 | **5** |

Per angle at end of day 2 — A1 14, A2 40, A4 20, A5 30. Every campaign hit its
`daily_max_leads` exactly both days, so throughput is cap-bound, not
supply-bound. Bounce rate 0.00% against the 2% gate.

**Reply 2 (day 2, A5, holdout).** A Maryland sole proprietor, to the generic
debrief email: *"No."* It matters which arm this is — the lead is A2-eligible
and was coin-flipped into the holdout, so it belongs to the
A2-versus-generic comparison rather than to true-generic A5. Like reply 1 it
disputes nothing: A5 asks a question rather than asserting anything about the
reader, so there is no premise to be wrong about.

Both replies so far are negative and neither is a correction. Wave 1's pattern
was that reply rate tracked premise accuracy; two "No"s to accurate or
premise-free copy is a different signal from campaign C's "NO"s to wrong ones,
and it is far too early to read either way.

### A2 base vs speed

31 base / 29 speed pushed, 40 contacted so far. Against the ~440 per arm needed
to detect a doubling, that is **about 4%**. Nothing is readable and no
comparison should be attempted yet.

### Open: A1 runway

1.2 days (6 queued + 6 unassigned supply against a cap of 10). Two extra
scanner runs were added at 01:00 and 08:00 UTC and have not fired yet — their
first runs are the morning of the 25th. If A1 is still under two days after
that, the scanner budget is the constraint, not the schedule.


### Day 3 — the first positive reply, and a classifier that was inflating the count

**First positive in the programme**, A2 **speed** arm, to a DoD solicitation:

> *"Thanks for reaching out but not sure what is this all about nor how you
> help. What is your cost to do this reply? Please advise. I have a hectic day
> but I can try to have a call with you if this is of interest."*
> — CEO, a California firm, on SPE4A626U4340

Wave 1 got 0 positives on 471 contacts. This is 1 on 155. **It is one reply and
it settles nothing** about base versus speed: at these counts a single reply
moves an arm's rate by two points. Recorded because it is the first evidence
that any of this copy can produce interest at all, not as a result.

It is also a live question from a named CEO asking about price and offering a
call. Fulfilment was deliberately deferred; this is what that decision now
looks like in practice.

**The classifier was counting a machine as a person.** Three autoresponders
arrived on A2. Two announced themselves in the subject and were caught. The
third came back as `Re: DoD` and read *"I am no longer involved in day-to-day
operations at Lexset. Please reach out to Francis Bitonti."* — a delegation
autoresponder, written by a person once and now sent by a machine to everyone.
One in four A2 replies that day, on the metric the programme is judged on.

Fixed with body-level matching over the sender's own words only (the quoted
original sits below the reply, so matching the whole text classifies our own
copy). The patterns are narrow on purpose: *"not interested"* and *"we already
have a proposal team"* are human decisions and still count as human replies.
Eight real cases now under test, including two rejections that must not be
reclassified.

### Day 3 — the A1 scanner, and two wrong diagnoses

Throughput had collapsed from 40 companies a run to 8. I blamed cold-start
latency, then time of day, and scheduled two extra runs off-peak on the
strength of the second theory. Those runs scanned eight and nine.

Timing the real query across twelve live UEIs settled it: **three of the first
seven hung past thirty seconds** while the other four returned in 160ms, 295ms,
2.2s and 2.3s. It is per-UEI — certain `recipient_search_text` values send the
query down a slow path server-side and never come back.

So the five-second timeout added the day before was right about the ceiling and
wrong about the retry: a hanging UEI cost 5s x 3 attempts plus backoff, and
adding the timeout made throughput **worse**. The tell was in the job's own
output for a full day before I read it — `api_calls` had dropped *below*
companies scanned, which can only mean calls were failing rather than slowing.

Timeouts are no longer retried. Measured after: **50 scanned, 12 signals, 33
api_calls** — 17 of 50 UEIs hung, a 34% rate matching the sample, and above the
original 40.

A1 runway is still only 1.4 days (2 queued + 12 supply against a cap of 10),
but supply is now being produced faster than the cap consumes it, which it was
not before.

### Day 4 — 2026-09-28

The log jumps from Friday to Monday because it should: `outreach-push` runs
`0 6 * * 1-5`, so the weekend sent nothing. Day 4 is the fourth *sending* day.

| Angle | Leads | Contacted | Sent | Bounced | Human replies | Positive |
|---|---:|---:|---:|---:|---:|---:|
| A1 Recompete | 34 | 34 | 57 | 0 | 2 | 0 |
| A2 Matched RFP | 100 | 79 | 157 | 1 | 2 | **1** |
| A4 Competitor won | 46 | 38 | 68 | 0 | 1 | **1** |
| A5 Generic | 75 | 60 | 104 | 1 | 1 | 0 |
| **Total** | **255** | **211** | **386** | **2** | **6** | **2** |

Bounce rate **0.95%** (2 / 211) against the 2% gate. 386 emails on 211 people is
1.83 each: the follow-up steps are now most of the volume, which is where the
second positive came from.

44 of the 255 pushed leads have not been emailed yet — `daily_max_leads` admits
them tomorrow. Contacted, not pushed, is the denominator for every rate here.

**What the six human replies actually say.** Four are a bare "No" — two on A1,
one on A5, one on A2. Two are interested. That is the honest shape of the
result: 1.9% say no in one word, 0.95% ask a question. Three more replies came
from machines and are correctly excluded.

### Day 4 — the second positive, on A4

> *"What solution do you provide?"*
> — Dependable On-Site Scan & Shred, Inc., Georgia

It arrived on a **follow-up step**, not the first email, which is the first
evidence that the sequence past step 1 earns anything. One reply settles
nothing, but A4 now has 1 positive on 38 contacted and A2 has 1 on 79.

Both positives are questions about what we do and what it costs. Fulfilment was
deliberately deferred; two named people are now waiting on an answer.

**The classifier fix holds in production.** The Lexset delegation autoresponder
that was counted as a human reply on day 3 now reads `human_reply: false` in
`outreach.outcomes`, and the two genuine one-word rejections that arrived today
were *not* reclassified — which is the half of that fix that could have gone
wrong quietly.

### Day 4 — A2 was naming the reader instead of their company

`Mcguire Tamara` replied "No" this morning. The email she got said:

> on paper **Mcguire Tamara** clears the bar on NAICS 541620

2.3% of the live universe — **167 of 7,326** — carries the contact's own name in
the company field, usually surname-first. A2's fit line is the only copy in the
whole programme that names the company, so every one of those rows reads as a
mail merge artefact, addressed to the single reader able to recognise it, with
their own name backwards. The pool has plenty of shapes: `Major Amy`,
`Davidson Robert`, `Anderson Cynthia Elizabeth`, `Starr Constance R`.

Nine had been assigned. **Four were already delivered** and cannot be taken
back; one had gone stale; the four still queued were repaired in place before
the 06:00 push.

Fixed by treating a person-named company as an *absent* company name, so the
line falls back to "on paper your team clears the bar on NAICS 541620" — true of
every row, and no template change. The detector is deliberately conservative,
because a false positive throws away real personalization while a false negative
only leaves one odd sentence: any corporate marker wins, so "Knight Aerospace
LLC" stays a company even when the contact is Earl Knight, and both parts of the
person's name must appear, so plain "Mcguire" is left alone — it reads as a firm
the way "Bechtel" does. 21 cases under test, including all nine live rows.

This is the kind of defect the coverage numbers cannot see. A2 counted all nine
as personalized, and by its own definition it was right.

### Day 4 — the opportunities job, and a retry guard that fired for nothing

`outreach-opportunities` streams the whole SAM export in one pass and fails on
memory when it does not fit:

| Date | Primary 03:00 | Retry 03:25 |
|---|---|---|
| 09-23 | 200 | — |
| 09-24 | 200 | — |
| 09-25 | 200 | — |
| 09-26 | **546 WORKER_RESOURCE_LIMIT** | 200 |
| 09-27 | **546** | **546** |
| 09-28 | 200 | — |

**Two of six primary runs failed, and Sunday lost both attempts** — no A2 signal
refresh that day. Sending was unaffected, because the previous day's signals are
still valid until their close dates; the cost of a lost day is staleness, not an
outage. Added `outreach-opportunities-retry2` at `30 4 * * *` with a 120-minute
window, so a day needs three failures to lose its refresh. The real fix is
flushing in batches during the stream rather than holding the pass in memory,
and it is still not done.

**Testing that retry with a 24-hour window exposed a worse bug in the guard
itself.** `retry_job_if_failed` read `net._http_response` directly, and pg_net
drops those rows after about 5.5 hours — exactly the retention trap that made
`job_health` read "NO RESPONSE (overdue)" for every overnight job last week. So
a run that had *succeeded* twenty hours earlier read as "no attempt recorded",
and the guard re-fired: a full 236MB re-stream of the SAM export for nothing.

Fixed with `coalesce(jr.status_code, r.status_code)` so the guard reads the
persisted `job_run` status first and pg_net only as a fallback — migration
`outreach_retry_reads_persisted_status`. Both branches verified: a job that
succeeded inside the window returns null, an unknown job still fires.

The lesson is the same one twice. pg_net's table is a *buffer*, not a record, and
anything that decides something hours later must read the harvested copy.

### Day 4 — runway

| Angle | Queued | Unassigned supply | Daily cap | Days of sending |
|---|---:|---:|---:|---:|
| A1 Recompete | 59 | 11 | 10 | **7.0** |
| A2 Matched RFP | 259 | 4,309 | 20 | 228 |
| A4 Competitor won | 9 | 375 | 10 | 38 |
| A5 Generic | 836 | — | 15 | 56 |

A1 was at 1.4 days on Friday. Not retrying the USASpending timeouts is what
recovered it; the scanner now produces faster than the cap consumes.

A2 arms: **53 base / 47 speed** pushed, against the ~440 per arm needed to detect
a doubling of reply rate. That is **12%**. Still nothing to read.

### Day 4 — still open

- **Wave 1 migration.** ~1,205 never-contacted leads sit suppressed from the
  personalized system, ~460 of which pass the current gate. Three options were
  put up (release them, let wave 1 finish, leave it); releasing was the
  recommendation. No decision yet, so nothing has been touched.
- **Two positive replies** waiting on a fulfilment answer.
- **Batched flushing** in the opportunities job, to stop the memory failures at
  the source rather than adding retries around them.

---

## 11. 2026-09-29 — the scale-up

Four things changed on the same day: capacity, audience, copy, and the job that
feeds A2. Recorded together because they interact.

### Capacity: 12 shared mailboxes to 42 dedicated ones

The four campaigns had been running on twelve mailboxes **shared with the still
active wave 1 campaigns**, while 32 of the account's 48 warmed mailboxes were
attached to nothing at all. 480 emails a day of paid, warmed capacity idle.

Worse, each campaign's ceiling was set to exactly what its own boxes could
carry, and a 4-step sequence settles at 4x its new-lead rate:

| | Mailboxes | Capacity | Steady state at old cap |
|---|---:|---:|---:|
| A2 | 4 | 80/day | 20 x 4 = **80/day** |
| A1 | 2 | 40/day | 10 x 4 = **40/day** |
| A4 | 2 | 40/day | 10 x 4 = **40/day** |

Every campaign was provisioned to hit its wall the moment its sequence filled
out, about a week away, while sharing those boxes with wave 1.

**Nothing was moved out of a campaign, only added.** Instantly threads a lead's
follow-ups from the mailbox that sent its first email, and 266 leads were
mid-sequence; pulling a box out would have made their next "Re:" arrive from a
stranger. Each campaign gained the idle boxes on domains it already owned, plus
the unused domains.

| | Mailboxes | Capacity | New cap | Steady state |
|---|---:|---:|---:|---:|
| A2 | 16 | 320/day | 80 | 320/day |
| A5 | 12 | 240/day | 60 | 240/day |
| A4 | 8 | 160/day | 35 | 140/day |
| A1 | 6 | 120/day | 20 | 80/day |
| **Total** | **42** | **840/day** | **195** | |

**195 new contacts a day against 55.** Every mailbox set to 20/day.

The one-mailbox-per-domain rule became one-campaign-per-domain. The old rule
capped the programme at 16 mailboxes on an account of 16 domains x 3 — it spent
3x the domain budget to hold 1x the capacity. The new rule keeps the property
that matters: a burned domain takes one campaign down, not a slice of all four.

### Audience: wave 1 closed, 1,765 contacts released

All three wave 1 campaigns paused. 1,145 people were mid-sequence, so pausing
cuts them off mid-thread; that is the cost of the decision and it was taken
deliberately.

Their contacts were then released from suppression into the personalized pool —
**except anyone who replied or bounced**. 29 held on that rule, plus 6 that no
longer matched a live campaign lead and were left suppressed as the conservative
reading. The live universe went **7,326 to 9,091**, with 0 missing required
fields and 0 suppression leaks.

### Inventory: ceilings, because a deep queue is not free

The ask was 2,500 queued contacts per angle. Two of the four cannot have that,
and A2 should not:

- **A2's signals die.** A solicitation is taken 8 to 21 days from closing and
  push wants 8 days left, so an assignment is sendable for about 13 days. At
  80/day the useful queue is ~1,040. Queue 2,500 and the excess closes unsent —
  which is exactly what the **115 already-expired A2 rows** were.
- **A1 and A4 are supply-limited.** A1 signals exist for ~15% of the universe;
  A4 only gets companies A2 does not outrank. Neither reaches 2,500 at any cap.
- **A5 could**, but every company parked in generic A5 is one that can never be
  personalized later, so its generic queue is capped too.

So each angle now stops at however many days of sending its signal survives:
A2 13, A4 40, A1 60, generic A5 15. **An angle at its ceiling leaves the company
unassigned** rather than spilling it into generic copy, keeping it available
tomorrow against a fresh signal. The first live run left 1,131 companies
unassigned for exactly that reason.

The awards scanner went from 1 run a day to 4 and the recompete scanner from 3
to 6, because A1 and A4 are fed by scanners bounded by the 150s function budget
per run, so runs per day is the only lever.

**A5 was two things wearing one label**, which the first version of the ceiling
got wrong: of 1,727 rows queued there, **1,308 are A2 holdouts** — the control
arm — and only 419 are true generics. A2 sends 80/day and A5 sent 30, so the
control arm was falling further behind the test arm every day. A starved control
does not make the experiment smaller, it makes it unreadable. A5's cap went to
60 and the ceiling now counts generics only.

| End of day | Queued | Cap | Days |
|---|---:|---:|---:|
| A1 | 81 | 20 | 4.1 |
| A2 | 1,040 (at ceiling) | 80 | 13.0 |
| A4 | 159 | 35 | 4.5 |
| A5 holdout | 1,308 | 60 | — |
| A5 generic | 419 | | |

### Copy: say what the company does

The emails never said what GovHub does. They offered a "rundown", a "one pager",
"the next three in your lane". The programme's first positive reply opened *"not
sure what is this all about nor how you help"*, which is the clearest possible
verdict on that.

Every angle now carries one plain sentence: **we read the solicitation and find
the things that would get your bid disqualified before anyone scores it, and we
write the proposal itself.** A2 carries it in the server-rendered lines so both
arms of the base/speed test say it, and the 268 rows already queued were
repaired in place rather than going out with the old wording.

**The opt-out line is gone from every email**, at the owner's instruction, along
with the two guardrails that asserted it. A guardrail now fails if unsubscribe
language reappears, since Instantly can be configured to append one. The postal
address stays.

### The opportunities job was never running out of memory

It had been diagnosed wrong for a week, by me. `WORKER_RESOURCE_LIMIT` on half
its runs read as "it runs out of memory holding the matches", and the plan of
record was to flush in batches during the stream. **That would have fixed
nothing.**

Instrumenting it settled it: **heap peaks at 20 MB and does not move.** Two
identical dry runs two minutes apart, one killed and one clean, both nowhere
near a memory ceiling.

What the limit tracks is bytes pulled through **one response**. Bisecting with
the record cap, twice at each size:

| Records | Result |
|---:|---|
| 20,000 | passed, twice |
| 45,000 | passed, twice |
| 60,000 | passed, twice |
| 75,001 | passed, twice |
| 82,605 (all) | **killed, every time** |

Stopping early cancels the download, so the only thing separating a run that
lives from one that dies is the last 9% of a 222 MB file.

Fixed by reading the extract as sequential 48 MB byte ranges, each request
closed before the next opens, with one `TextDecoder` spanning all of them so a
character split across a range seam survives. **Eight consecutive full runs
since: 82,605 records, ~3 seconds, 20 MB.**

Separately, the CSV parser was **14.6x slower than it needed to be** — the inner
loop called `indexOf` four times per field, each scanning to the end of the
buffer, and a quote is rare enough that the scan for it walked the whole
remaining buffer on every plain field. 11,433 records/sec before, 167,118 after.
Not the cause, found while chasing the CPU theory that preceded the right one.

**The lesson, again:** this job has now been misdiagnosed three times, and each
time the wrong answer was plausible enough to act on. The instrumentation stays,
writing its trace to the database as it goes, so a killed run still says where
it died.

### The schema is finally in the repository

All seventeen outreach migrations had been applied straight to the project and
never committed, so five edge functions were reading tables git had never seen.
Committed as **one idempotent baseline** rather than the seventeen, because the
merge workflow re-applies migration files and several of those were written to
run once. Verified: built into an empty schema twice, diffed against production
(70/70 columns, 18/18 indexes, 5/5 functions, 20/20 constraints, zero
difference), then applied to production with a before/after fingerprint over
every object — identical.

### Day 5 — 2026-09-29, the day before the ramp actually lands

| Angle | Contacted | Sent | Bounced | Bounce % | Human replies | Positive |
|---|---:|---:|---:|---:|---:|---:|
| A1 Recompete | 44 | 67 | 2 | **4.55%** | 2 | 0 |
| A2 Matched RFP | 120 | 198 | 1 | 0.83% | 2 | **1** |
| A4 Competitor won | 56 | 86 | 1 | 1.79% | 1 | **1** |
| A5 Generic | 90 | 134 | 1 | 1.11% | 1 | 0 |
| **Total** | **310** | **485** | **5** | **1.61%** | **6** | **2** |

**The scale-up had not taken effect yet.** Assign runs at 05:00 and push at
06:00; everything in section 11 was changed around 17:00. So today sent at the
OLD 55/day, and 1.61% is a pre-ramp number. The first day at 195/day is the 30th,
which makes tomorrow's bounce reading the one that matters.

**A1 is the one to watch: 4.55%, 2 of 44.** Under the 5% pause threshold and on a
two-event sample whose confidence interval runs roughly 0.6% to 15%, so there is
nothing to act on yet. A1 crosses 50 contacts tomorrow, at which point the rule
fires on its own.

No new replies today. Zero on 55 new contacts.

Every job green except `outreach-opportunities`, which failed its 03:00 primary
and was caught by the 03:25 retry — both of which ran hours **before** the
byte-range fix was deployed, so that failure is the old bug, not a regression.

The widened scanners are already visible: recompetes wrote 28 in its new 20:00
run (its best yet) and awards wrote 49 at 21:45 against the ~25 it managed as a
single daily run. A1 supply went 11 to 28, A4 supply 216 to 240.

### Day 5 — the person-name fix had a hole in it, and mail went out through it

A sample of what actually shipped today read:

> on paper **Bruce Diamond** clears the bar on NAICS 541690

The contact is Bruce. This is the exact defect fixed the previous morning, one
day later.

The detector required **both** parts of the contact's name before it would call a
company field a person. `last_name` for this row is null — and that is not an
edge case: **4,149 of 9,091 live rows, 46%, have no last_name at all.** Every one
of them was invisible to it. Measured properly: the fix was catching 167 and
missing 110. It solved 60% of the problem and reported success.

Closed by testing on the first name alone when there is no surname: a short,
marker-free company name carrying the contact's first name. Weaker by necessity,
and it will occasionally take a real firm named after its founder — which costs a
company-name mention while still saying something true, against the cost of
telling a named person we think their own name is their company.

Nine queued rows were repaired before the 06:00 push. A recheck of the whole
queue under both rules returns zero.

**What this says about the day before.** The fix was verified against the nine
rows the detector itself had found, which is circular: it proved the detector
agreed with itself. What it never asked was how many rows the detector could not
see. The test that would have caught this is the one asked afterwards — how many
live rows have no last_name — and it takes one query.

### Day 5 — inventory

| Angle | Queued | Unassigned supply | Cap | Days |
|---|---:|---:|---:|---:|
| A1 | 81 | 28 | 20 | 4.1 |
| A2 | 1,040 (at ceiling) | 4,145 | 80 | 13.0 |
| A4 | 159 | 240 | 35 | 4.5 |
| A5 holdout | 1,308 | — | 60 | — |
| A5 generic | 419 | — | | |

A2 expired unsent: 111, down from 115 — the retry path is recycling them.

A2 arms: 62 base / 58 speed pushed. The control arm (A5 holdout) is at 51 pushed
against A2's 120, still behind, which the cap change addresses from tomorrow.
Nothing is readable at these counts and no comparison should be attempted.

### Day 6 — 2026-09-30, the first day at 195/day

**The bounce rate did not move.** 1.61% yesterday at 55 contacts a day, 1.62%
today at 195. That was the one thing worth being nervous about and it held.

| Angle | Contacted | Sent | Bounced | Bounce % | Human replies | Positive |
|---|---:|---:|---:|---:|---:|---:|
| A1 Recompete | 64 | 87 | 2 | 3.12% | 2 | 0 |
| A2 Matched RFP | 190 | 325 | 3 | 1.58% | 2 | **1** |
| A4 Competitor won | 91 | 121 | 1 | 1.10% | 1 | **1** |
| A5 Generic | 150 | 194 | 2 | 1.33% | 2 | 0 |
| **Total** | **495** | **727** | **8** | **1.62%** | **7** | **2** |

All four caps filled exactly: A2 80, A5 60, A4 35, A1 20. Nothing waiting
uncontacted in any campaign. A1's bounce rate came DOWN, 4.55% to 3.12%, as its
denominator grew — which is what a two-event sample does and why it was not
acted on.

One new reply, a polite decline on A5: *"Thanks for the outreach, but we are not
interested at this time."* Human, counted, not positive.

The new copy is live and reads as intended. An actual A2 send from today:

> Hi Chase, DoD posted FA469026Q0027 and on paper Arctic Plumbing And Heating,
> LLC clears the bar on NAICS 238220. It closes Oct 9. **We read solicitations
> for the things that get small firm bids disqualified before anyone scores
> them, then write the proposal itself.** There are a couple of those in this
> one. Want the list of what would disqualify you on this one?

### Day 6 — push was ordering by arrival instead of by deadline

A2 assignments dropped unsent went from 111 to **245**, 134 of them in one day.

Two questions mattered: were they genuinely dead, and was the ceiling wrong.
Neither. **All 245 were still open**, closing between 1 and 8 days out, and none
was dropped for being too far out. They were created between 09-22 and 09-28,
which is the backlog built while A2 sent 20 a day — so most of that number is a
one-time cost of the old rate, exactly as predicted when the ceilings went in.

But it exposed a real defect underneath. Push fetched candidates ordered by
`created_at`, with a comment explaining that "the oldest assignment is the one
whose signal is closest to expiring." That is a proxy for urgency, and the wrong
one: a row created today against a solicitation closing in 9 days is more urgent
than one created three days ago against a solicitation closing in 22. **Expiry
was a function of queue position rather than of the deadline.**

Now sorted by the signal's own deadline, soonest first. A dry run after the
change filled all four caps and dropped 21 instead of 134. That is not yet a
clean before-and-after — today's remaining queue is almost entirely one close
date, so ordering had little to chew on — and tomorrow's drop count is the real
test.

**A dry run was also never dry.** Previewing the change wrote 21 `dropped_stale`
rows and expired their signals, because the staleness and failure updates ran
regardless of the flag. The rows were genuinely unsendable so nothing was lost,
but the entire reason `dry_run` exists in this job is that it sends real mail to
real people. All three update sites are gated now.

### Day 6 — the opportunities primary, three days running

03:00 failed, 03:25 succeeded. Third consecutive day, and now on the byte-range
code that ran eight consecutive clean full passes when tested. So the failure
mode that was measured is fixed and a different one is left.

It behaves like the other thing this 546 means: **a cold worker refused at
boot**. The 03:00 call is the first invocation after nine idle hours; every
warm call succeeds. The reported durations are useless for confirming this —
`settled_at` is when the harvester noticed, so they read as exactly 600s or
300s, the polling interval.

Two changes to settle it rather than argue it:

- The trace now keeps the **last five runs** instead of one. It kept one, so the
  03:25 success overwrote the only evidence of the 03:00 failure. It also writes
  a `boot` row before any work, which makes the *absence* of rows a reading: a
  failed run with no trace never executed.
- A cheap warmup call at 02:58 (a request with no `?job=`, which returns the
  usage error without touching SAM or the database) boots the worker two minutes
  ahead. If the primary stops failing, cold start was the cause.

Retry moved 03:25 to 03:08, because the job takes three seconds now, not
minutes.

### Day 6 — inventory and the experiment

| Angle | Queued | Supply | Cap | Days |
|---|---:|---:|---:|---:|
| A1 | 101 | 125 | 20 | 11.3 |
| A2 | 815 | 4,108 | 80 | 10.2 |
| A4 | 172 | 301 | 35 | 13.5 |
| A5 holdout | 1,277 | — | 60 | — |
| A5 generic | 401 | — | | |

A1 supply went 28 to 125 and A4 216 to 301 — the widened scanners working. A1
was at 4.1 days yesterday and is at 11.3 today.

A2 arms: **105 base / 85 speed** pushed. Against a fair coin over 190 that gap
is noise.

**The control arm is still behind and that now sets the timetable.** The holdout
lives in A5 and has 82 pushed against A2's 190 contacted. A5's cap of 60 is
shared with generics, so holdouts accrue at roughly 35 a day against A2's 80,
and A5 is already at its mailbox ceiling (12 boxes x 20 = 240 = 60 x 4). The
test arm reaches the ~440 it needs in about three days; the control needs about
ten. **The experiment finishes when the slower arm does, so nothing should be
read from it before roughly 10 October.**

### Day 7 — 2026-10-01, two more positives and the bounce rate falling

| Angle | Contacted | Sent | Bounced | Bounce % | Human replies | Positive |
|---|---:|---:|---:|---:|---:|---:|
| A1 Recompete | 85 | 114 | 2 | 2.35% | 4 | **1** |
| A2 Matched RFP | 285 | 441 | 3 | 1.05% | 4 | **2** |
| A4 Competitor won | 130 | 157 | 2 | 1.54% | 2 | **1** |
| A5 Generic | 225 | 268 | 2 | 0.89% | 1 | 0 |
| **Total** | **725** | **980** | **9** | **1.24%** | **11** | **4** |

**Bounce rate is falling as volume rises**: 1.61% at 55/day, 1.62% at 195/day,
**1.24%** today. A1 came down again, 4.55% to 3.12% to 2.35%.

**Two new positives, both on copy that says what we do.** Day one of the plain
English version reaching inboxes at scale:

> **"Yes, please"**
> — George, 310 Buncombe LLC, South Carolina, on USDA 57-6395-25-006 (A2)

> **"Sure"**
> — Dave Henderson, President, The Stronghold Group LLC, Pennsylvania (A1)

That is the first unambiguous yes the programme has had, and the first positive
on A1. Four positives now, on 725 contacted. Two replies is still two replies
and the copy change is not proven by them, but both arrived on the first day the
new wording was out at volume.

**Both predictions from yesterday held.** The 03:00 opportunities primary
succeeded for the first time in four days, with no retry needed — so the
02:58 warmup call settles it: the residual failure was a cold worker refused at
boot, not a resource ceiling. And the A1 and A4 scanners kept supply ahead of
their caps.

### Day 7 — A2 was queueing hundreds of rows against a single close date

A2 rows dropped unsent went 245 to **682**. Yesterday's reading was that push
sent them in the wrong ORDER. That was true, and it was not the cause.

| Closes | Days out | Ready | Dropped | Pushed | Sendable before it closes |
|---|---:|---:|---:|---:|---:|
| 2026-10-02 | 1 | 0 | 63 | 27 | 0 |
| 2026-10-05 | 4 | 0 | 60 | 15 | 0 |
| 2026-10-08 | 7 | 0 | 64 | 17 | 0 |
| **2026-10-09** | **8** | 9 | **433** | 25 | **0** |
| 2026-10-12 | 11 | 115 | 0 | 97 | 240 |
| 2026-10-13 | 12 | 143 | 0 | 16 | 320 |

**467 A2 rows closed on the same day.** At 80 a day with the 8-day floor the
sequence needs, at most 80 could ever be sent before 10-09. The other 433 were
arithmetic the moment they were assigned, and they died together the morning the
date crossed the floor. No send order rescues 467 rows sharing one deadline.

The flat 13-day ceiling assumed close dates spread evenly over those 13 days.
They do not: the opportunities job takes the **closest-deadline** solicitation
per company, and federal notices cluster on a handful of dates, so the queue
arrives in lumps.

Admission is now budgeted **per date**: for a solicitation closing on C the
sending days available are (C − today − 8), every queued row closing on or
before C competes for them, and a row is admitted only while that cumulative
count is under the budget. A preview over 1,200 companies refuses **863** on
this rule and admits 116 — still above the 80 a day A2 sends. Refused companies
are left unassigned and keep their turn.

One consolation: `dropped_stale` is retryable, so those 682 companies return to
the pool rather than being burned. The cost was wasted renders and a queue that
looked deeper than it was.

### Day 7 — three things reading the replies turned up

Counts would have shown none of these.

**A "Stop" from a named person, on A4.** The programme carries no opt-out line
by the owner's decision, which makes honouring the requests that arrive anyway
more important rather than less. Suppressed at the person level, which is the
standing rule here.

**The person-name fix never reached `{{companyName}}`.** Brenda Unrein was asked
what would get "Brenda Unrein's" recompete bid tossed, and answered "No, thank
you". The fix two days ago reached A2's `fit_line` because that is the only copy
`job_assign` renders; A1's first email uses Instantly's own `{{companyName}}`
built-in, filled from the lead `job_push` creates, which nothing in assign could
touch. A token census found it — and the earlier census had missed it, because
it grepped for lowercase `{{snake_case}}` and so skipped every camelCase
built-in. Now fixed on the lead payload, which covers every template use at
once. 277 of 9,091 live rows are in this shape.

**An address-change notice counted as a human reply.** *"My email account will
now be ... please update your files accordingly"* — written by a person once,
now sent by a machine to everyone. Exactly the Lexset shape from a week ago.
Three patterns added; the classifier test now carries twelve real replies,
including both of today's positives and the one-word "Stop", none of which may
be reclassified as machine. Today's count was corrected: 11 human, not 12.

### Day 7 — inventory

| Angle | Queued | Supply | Cap | Days |
|---|---:|---:|---:|---:|
| A1 | 141 | 43 | 20 | 7.1 |
| A2 | 529 | 3,588 | 80 | 6.6 |
| A4 | 188 | 296 | 35 | 5.4 |
| A5 holdout | 1,507 | — | 60 | — |
| A5 generic | 400 | — | | |

The A2 queue is within its per-date budget on every date for the first time,
which is what the new rule is for. Arms: the control arm now has 1,507 queued
against A2's 529, so the holdout is no longer the starved side of the
experiment — but it is still the slower one to *send*, and nothing should be
read from base-vs-generic before about 10 October.

### Day 8 — 2026-10-02, the date budget held

| Angle | Contacted | Sent | Bounced | Bounce % | Human replies | Positive |
|---|---:|---:|---:|---:|---:|---:|
| A1 Recompete | 98 | 148 | 3 | 3.06% | 4 | 1 |
| A2 Matched RFP | 331 | 570 | 4 | 1.21% | 6 | 2 |
| A4 Competitor won | 168 | 231 | 2 | 1.19% | 2 | 1 |
| A5 Generic | 299 | 402 | 3 | 1.00% | 3 | **1** |
| **Total** | **896** | **1,351** | **12** | **1.34%** | **15** | **5** |

**Zero new A2 drops.** The per-date budget did what it was built for. Every
close date is now inside its sending budget:

| Closes | Days out | Ready | Sendable before it closes |
|---|---:|---:|---:|
| 2026-10-12 | 10 | 52 | 160 |
| 2026-10-13 | 11 | 143 | 240 (cumulative 195) |
| 2026-10-14 | 12 | 94 | 320 (cumulative 289) |
| 2026-10-15 | 13 | 69 | 400 (cumulative 358) |
| 2026-10-16 | 14 | 65 | 480 (cumulative 423) |

And push's own staleness count tracks it: **134 dropped on 09-30, 21 on 10-01,
3 today**. The expired total went DOWN, 682 to 671, as retried companies were
re-assigned against fresh solicitations.

The dry run used to check this was also confirmed read-only — the expired count
was identical before and after, which is what yesterday's fix was for.

### Day 8 — the fifth positive is on the control arm

> **"Yes, please send."**
> — Anthony, Williams Roofing & Construction Inc, Florida

That is **A5, and specifically a holdout**: an A2-eligible company that lost the
coin flip and got the generic debrief email instead of its own matched
solicitation. It said yes anyway.

That is worth more than another A2 positive would have been, because it is the
first evidence bearing on the question the holdout exists to answer. The three
cells as they stand:

| Cell | Contacted | Human replies | Positive | Contacts to 440 |
|---|---:|---:|---:|---:|
| A2 personalized (test) | 347 | 4 | 2 | 93 |
| A5 holdout (control, same population) | 150 | 2 | 1 | 290 |
| A5 generic (no signal population) | 120 | 1 | 0 | 320 |

0.58% positive on the test arm against 0.67% on the control. **That is three
replies in total and means nothing**, but it is a useful corrective: nothing in
the data so far says personalization is winning, and the programme should not
assume it will.

Seven out-of-office autoresponders arrived (Friday afternoon), every one
correctly classified as machine — the classifier work holding up under the first
real volume of them. One human decline on A2: *"We have our internal team that
does this."*

### Day 8 — the control arm now gets A5's whole budget

A5's 60 a day was split between the holdout and true generics, so the control
accrued at roughly 30 against the test arm's 80: A2 was 93 contacts from a
readable sample and its own control was 290 away. An experiment finishes when
its slower arm does, so that gap was the schedule.

Generics are the least valuable sends here — no signal, no deadline, nothing
expiring if they wait — so they now yield. A dry run after the change gives all
60 A5 slots to holdouts and none to generics, which puts the control about five
days from readable rather than ten. The generic queue is capped at 900 anyway
and nothing under it can go stale.

### Day 8 — inventory

| Angle | Queued | Supply | Cap | Days |
|---|---:|---:|---:|---:|
| A1 | 152 | 108 | 20 | 7.6 |
| A2 | 485 | 3,540 | 80 | 6.1 |
| A4 | 209 | 317 | 35 | 6.0 |
| A5 holdout | 1,511 | — | 60 | — |
| A5 generic | 424 | — | | |

A2's queue is deliberately shallower now — the date budget refuses what cannot
be sent in time, so 6.1 days of queue is 6.1 days of *sendable* queue rather
than a number inflated by rows that were going to die. Bounce rate 1.34%,
eighth day under the gate.

### Day 9 (2026-10-06) — the queue said sent, Instantly said somewhere else

The chart and the campaigns disagreed, and the chart was wrong. Queue against
what the four campaigns actually hold, before the repair:

| Angle | Rows marked pushed | Leads in the campaign | Missing |
|---|---:|---:|---:|
| A1 | 124 | 86 | 38 |
| A2 | 422 | 357 | 65 |
| A4 | 194 | 179 | 15 |
| A5 | 330 | 330 | 0 |

Every one of the 118 was a wave 1 contact released into the angle pool on
10-01, and every one of them was still sitting in a **paused wave 1 campaign**,
where nothing is sending. Fetching the stored lead ids says so directly: 83 in
wave 1 A, 22 in B, 44 in C, none of them with a reply.

The cause is one flag doing exactly what it says. `job_push` sends
`skip_if_in_workspace: true`, and Instantly does not error on a duplicate — it
answers **200 with the lead that already exists**, carrying the id of the
campaign that lead is already in. The push stored that id, marked the row
pushed and moved on. The flag was right while wave 1 was live, because the one
thing that must not happen is two campaigns mailing the same person. It became
the thing blocking those contacts the moment wave 1 was closed and its people
were released.

Two things were wrong at once and only one of them was the flag:

- **Reported.** A row recorded as pushed with no email behind it. Three days of
  inventory and runway numbers were overstated by 118.
- **Unsent.** 593 more queued rows — 18% of the whole queue, A1 116, A2 76,
  A4 51, A5 350 — share an email with a lead still parked in a paused wave 1
  campaign, and would have gone the same way over the coming fortnight.

Repaired: all 118 moved into their angle campaigns (Instantly's move is a
background job per source/target pair; nine jobs, confirmed landed). Queue and
campaigns now agree exactly at 124/422/194/330. `job_push` now checks the
landing campaign instead of assuming it: a lead that did not land here is not a
push, it is moved when the campaign holding it is paused, and left ready and
counted when that campaign is active.

**The lesson is the one from the person-name fix, in a different place.** A 200
is not evidence that the thing you asked for happened. Both times the check
that would have caught it was cheap and both times it was skipped because the
API said OK.

### Day 9 — one solicitation took 52 of 80 A2 emails

Yesterday's A2 batch, by solicitation:

| Solicitation | Emails |
|---|---:|
| 15JPSS26R00000038 — ICITAP/OPDAT Worldwide Support Services | 52 |
| W9128F26QA099 | 14 |
| 47PD5526Q0052 — IRS Intrusion Detection System, C. Clifton Young Fed. Bldg. | 6 |
| 19BE2026Q0620 — NEC Rail Waterproofing Membrane Repair | 2 |
| W519TC26RA054 — EAGLE Fort Riley KS | 1 |

The deadline sort caused it, by working: a cohort shares a close date, so it
leaves together. Nothing in those 52 emails was untrue and no reader saw
another, but 52 consulting firms in one NAICS asked about one RFP on one
morning is a blast with a merge field in it, and the first two of them to
compare notes can see that. It also concentrates the premise risk — one
cancelled solicitation would be 52 wrong emails rather than a handful.

A flat per-solicitation cap would have paced rows past the 8-day floor and
turned concentration into drops, which is strictly worse. So the rate is the
slowest one that still clears: **cohort size over sending days left, rounded
up**, and no cap at all on the last day. Measured on today's queue the summed
allowance is 148 against a cap of 85, so the spread is free — the dry run still
fills all 85 and the largest solicitation falls from 52 of 80 to 11 of 85.

`sendingDaysUntil` moved to `_shared` for it. The budget `job_assign` sizes and
the pace `job_push` runs have to agree about what a day is, or the budget
promises seats the pace never fills.

### Day 9 — A2's lead count, which is a send-capacity number and nothing else

A2 has no supply problem. 3,500 companies hold a live matched solicitation
right now; 800 of them have ever been assigned to A2. Yesterday's assign run
refused **923** of them with `a2_left_close_date_full` — the close-date budget
saying there is no sending day left before those solicitations close.

The whole chain, in the only unit that matters:

| Stage | A2 |
|---|---:|
| Live matched solicitations (companies) | 3,500 |
| Max queue the date budget will hold (13 days x 85) | 1,105 |
| Queued now | 378 |
| Sends per day | 85 |
| Refused yesterday for want of a sending day | 923 |

85/day is 17 mailboxes x 20 emails / 4 sequence steps. Every lever is a
capacity lever:

| Lever | A2 leads/day | Change |
|---|---:|---|
| Now | 85 | 17 mailboxes x 20 |
| Per-mailbox 20 -> 30 | 127 | +50%, no new domains |
| A5's 12 mailboxes to A2 (after the holdout reads) | 145 | +71% |
| Both | 217 | +155% |

### Day 9 — the awards scanner has finished its walk

Three of the four awards runs returned `naics_state_pairs: 0` and did no work.
Not a failure: the scanner has walked every pair it is allowed to see. Measured
directly — of 11,013 non-suppressed companies, 5,738 are unassigned, 1,354 of
those are not already covered by A2, and **0** of those 1,354 are scannable
(248 hold a live award signal, 1,352 were scanned inside the 21-day recheck
window). Stamps start expiring 10-13 at ~40/day and in volume 10-21 to 10-26
(1,088 over six days), so the runs resume on their own. A4 has 436 queued, 12
days at 35/day, which outlasts the gap.

Worth naming rather than acting on: A4's eligible set is small *because A2
claims 4,384 of the 5,738 unassigned companies*, and A2 can mail 85 a day. The
rule that A2 outranks A4 was measured and correct — 87% of the companies A4
finds an award for already hold an A2 signal, so the call bought a signal the
assigner would never read. It assumed A2 had the capacity to use them. With 923
refused a day for want of a sending day, thousands of companies are reserved
for an angle that cannot reach them and withheld from one that could.

### Day 9 — inventory and replies

| Angle | Queued | Cap | Sending days of queue |
|---|---:|---:|---:|
| A1 | 335 | 20 | 16.8 |
| A2 | 378 | 85 | 4.4 |
| A4 | 436 | 35 | 12.5 |
| A5 holdout | 1,606 | 60 | — |
| A5 generic | 571 | | — |

Bounce 1.34% (15 of 1,119 contacted), ninth day under the 2% gate; no angle
over 2.8%. Replies 32 total, 16 human, 6 positive. New yesterday: one positive
on A2 (*"Sure."*), one human decline (*"This opportunity does not match our
product line"*), and one real answer on an A5 holdout worth reading — *"I lost
the last bid because I was higher on my quote than others and also the gov is
asking for too much ridiculous information on employees and their
qualifications"* — a generic email with no signal in it getting the exact pain
point the programme is built on.

A fourth autoresponder shape got through as a human reply: an out-of-office in
the future tense (*"I will be on leave beginning Sept. 29 and will be returning
on Oct. 13"*). Row reclassified, A4's human count 3 -> 2, three patterns added,
and a case added for a human who happens to say "returning" so the fix cannot
go too far.

25% of queued A2 rows (96 of 378) still render `sol_short` as the bare
solicitation number, because `solHeadline` rejects their title. That is the
"too computerized" look, at a quarter of the batch rather than all of it.

### Day 9 — why A2 does not hold the whole pool, and what 25/mailbox buys

The pool number on the chart is real: **7,393** companies hold a live matched
solicitation today, 5,042 of them with the 8 days the sequence needs. The
campaign holds 422. The gap is not a loading problem and loading them would not
send one more email.

**A lead in Instantly is a scheduled send, not a stored contact.** Instantly
meters by mailbox. 20 mailboxes x 25 emails is 500 a day; a 4-step sequence
settles at 500/4 = 125 new leads a day whether the campaign holds 500 leads or
7,393. The only difference is that 7,000 would sit in it uncontacted.

**And they would go stale in the campaign.** A2's email names a solicitation
and its close date. It is true the day it is sent and false after the
solicitation closes, and the 4-step sequence needs 8 days to run, so a lead
loaded today and reached in 40 days ships a dead RFP. That is what sank wave
1's campaign C. The queue is therefore sized to what can be sent in time, which
is what `a2_left_close_date_full` counts: 1,508 companies refused in today's
preview, every one of them because its close date is already fully booked.

So the pool is a flow, not a backlog. The opportunities job writes ~4,100
matched solicitations a day; at 125/day A2 reaches about 2,750 a month. It will
never contain the pool — it will always be rate-limited, and the rate is
mailboxes.

Applied today, owner's call, 25 stated as the ceiling:

| | Before | After |
|---|---:|---:|
| Per mailbox, emails/day | 20 | 25 |
| A2 mailboxes | 17 | 20 |
| A2 emails/day | 340 | 500 |
| **A2 new leads/day** | **85** | **125** |
| A1 / A4 / A5 new leads/day | 20 / 35 / 60 | 37 / 45 / 75 |

A2's preview under the new cap queues 237 rather than 83, taking the queue to
615. A4 is held at 45 rather than the 50 its boxes carry, because its scanner
does not refill until 10-13.

What it would actually take to hold 7,393 sendable leads inside the 13-day
queue window: 569 sends a day, 2,276 emails a day, **92 mailboxes** — 72 more
than now, roughly 24 more domains. That is the price of the ask, and it is a
domain-buying decision rather than a software one.

The one-campaign-per-domain guardrail earned its keep on this change: putting
the two idle bidwithgovhub boxes on A2 split that domain across A2 and A4, and
the check refused to sync until A4's box on it followed. A blacklisted domain
has to be able to take down one campaign, not two.

### Day 9 — the close window was below the cap

Raising A2 to 125 sends a day did not get 125 sends. The dry run filled **106**,
and the missing 19 were not a supply problem: **92 of the 378 queued A2 rows
close more than 21 days out**, and `A2_close_max_days` was 21. At 85 a day that
ceiling never bound, because the queue always held more rows inside the window
than a day could send. At 125 it binds hard.

Measured both ways on the same queue:

| `A2_close_max_days` | A2 sends today | Held for being early |
|---|---:|---:|
| 21 | 106 | 92 |
| 30 | 122 | 0 |

Widened to 30. `QUEUE_DAYS.A2` follows from 13 to 22 — the 13 was 21 minus the
8-day floor, the widest a cohort's seats could be under the old window, and
left alone it becomes the new silent cap. Assign's preview now queues 344 A2
rather than 237, with `a2_left_close_date_full` down from 1,508 to 1,272.

**The cost is urgency, and it is the thing to watch.** The sequence runs about
12 days, so the last step now lands 18 days before the close rather than 9, and
step 1 says "closes in a month" where it said "three weeks". A2 carries the
best reply evidence in the programme. If the reply rate moves, this is the
first thing to put back, and it reverts with one row in
`outreach.config.freshness_buffers` — no deploy.

**A latent bug surfaced while measuring this.** `freshEnough` returned a
boolean and the caller writes `dropped_stale` on a false, so a row whose
solicitation closed too FAR out was expired *for being early* — discarded, with
its signal marked expired, when a week's wait would have made it ideal. It had
cost nothing yet purely by luck: candidates sort deadline-first, so far-out
rows sit at the back and get skipped over the daily cap before the check ever
sees them. The first day A2's queue fell below its cap, all 92 would have gone.
Three answers now — ok, stale, early — and `held_close_date_too_far_out` is
what showed the window was the binding constraint in the first place.

### Day 9 — the 30-day sending ceiling, for the record

30 calendar days from 10-06 is **22 sending days** (job_push runs weekdays).
Mailboxes today: A1 6, A2 20, A4 8, A5 12. A 4-step sequence settles at a
quarter of the mailbox email capacity.

At **20 emails/mailbox/day**:

| Angle | Boxes | Emails/day | New leads/day | 30-day emails | 30-day contacts |
|---|---:|---:|---:|---:|---:|
| A2 matched RFP | 20 | 400 | 100 | 8,800 | 2,200 |
| A4 competitor won | 8 | 160 | 40 | 3,520 | 880 |
| A1 recompete | 6 | 120 | 30 | 2,640 | 660 |
| **A2 + A4** | 28 | 560 | 140 | **12,320** | **3,080** |

At **25 emails/mailbox/day** (what is live as of 10-06):

| Angle | Boxes | Emails/day | New leads/day | 30-day emails | 30-day contacts |
|---|---:|---:|---:|---:|---:|
| A2 | 20 | 500 | 125 | 11,000 | 2,750 |
| A4 | 8 | 200 | 50 (capped 45) | 4,400 | 990 |
| A1 | 6 | 150 | 37 | 3,300 | 814 |
| **A2 + A4** | 28 | 700 | 170 | **15,400** | **3,740** |

A1 is the recompete angle, not A4. A4 is "a competitor near you just won".

### Day 10 (10-06 sending) — the first day on the new capacity, and push could not finish

Both push runs returned **504 IDLE_TIMEOUT**. The cap raise took the day's work
from 195 leads to 282, and the duplicate-move path added the same day sleeps
2.5s per hit against ~593 queued rows that collide with wave 1. Edge Functions
cut a request off at 150s idle and this job streams nothing until the end, so
06:00 died after 80 leads and the 06:25 retry after 178.

The 504 hid three separate failures, because the summary never returned:

| | Cap | Pushed 10-06 |
|---|---:|---:|
| A2 | 125 | **201** |
| A4 | 45 | 49 |
| A1 | 37 | **8** |
| A5 | 75 | **0** |

- **A second run spent a second full cap.** The retry started from scratch, so
  A2 took 201 against a day the close-date budget had sized for 125. The cap is
  a daily budget, so a run now reads what the day already pushed and takes only
  what is left. That is also what makes the new continuation crons safe.
- **The sort order became a starvation order.** Candidates sort deadline-first
  and A5 carries no deadline, so it sits at the very back: A5 got nothing and
  A1 got 8 of 37. A5 holds the control arm of the only experiment this
  programme exists to run, so the control lost a day to a timeout. Each angle
  now keeps its own deadline-sorted queue and the run takes one row from each in
  turn.
- **A run that cannot finish now says so** — a 115s budget reported as
  `stopped_on_time_budget`, rather than a 504 that says nothing. Two
  unconditional continuation crons at 06:50 and 07:15 finish the day's budget;
  `retry_job_if_failed` could not, because a run that stops early returns 200.

Cheaper per lead too: the move is no longer confirmed inline (the next run
confirms it for free — Instantly answers with the lead already in our campaign
and the landing check passes) and the inter-lead sleep goes 350ms to 200ms,
which alone was 99s of the budget spent waiting.

**TWO CONTACTS WERE BEING EMAILED WITH NO RECORD.** The campaigns held 133 and
624 against 132 and 623 in the queue. Both extras were created in Instantly at
06:03 — the minute the first run died — so the kill landed between the Instantly
write and the Supabase write. One of them, a wave 1 lead moved into A1, was
contacted at 13:08 with nothing in our database saying so: invisible to
metrics, to suppression and to reply handling. Both repaired.

The window is real but it closes itself: the rows were still `ready`, so the
next run posts them again, Instantly answers with the lead already in our
campaign, and yesterday's landing check marks them pushed without sending
twice. The fix for the cause is the time budget; the landing check is what
makes the leftovers harmless.

### Day 10 — what went right

**The pacing held.** Today's 202 A2 emails spread over 60 solicitations, the
largest taking 26. Monday's 80 took 52 from one. 13% against 65%.

**Assign filled the new ceiling.** 595 written (A2 257, A5 297), A2's queue to
635, and `a2_left_close_date_full` down to **605** from 1,508 before the window
widened — the refusals are now a third of what they were.

**Bounce 1.11%**, 17 of 1,536 contacted, tenth day under the gate and the
lowest reading yet. A1 1.69%, A2 0.94%, A4 1.72%, A5 0.69%.

### Day 10 — replies, and a fifth autoresponder shape

Six replies. One new positive on A2 — *"Yes, I would be interested."* — which
makes **seven** awaiting a fulfilment answer, the oldest from 09-25. Two real
declines worth reading, both naming price rather than process: *"It always comes
down to price. We are always compliant and do it in house."* (A1) and *"I don't
see this solicitation has anything to do with what we could offer."* (A2).

A delegation notice counted as a human reply: *"For all business matters, please
reach out to Jordan Martin at jordan@titantechinc.org"* plus a signature. The
existing delegation pattern wants a trailing "instead", "in my absence" or "for
urgent" and this had none. Naming someone else's address IS the redirect, so
the address is the tell. Row reclassified, A4's human count 3 to 2.

The lookahead on that pattern is the whole distinction, and the test for it
failed on the first cut: *"email me at dave@..."* is a human answering and
handing over a better address, not a redirect.

### Day 10 — 112 joint ventures were going out as "Jv"

Found by reading five of today's fit lines rather than by any counter: *"on
paper Eb-Mei One, Jv clears the bar on NAICS 238210"*. JV is a genuine
initialism and it was missing from both title-case lists, so `initcap` lowered
it at load and the name was persisted that way. 112 companies, 52 of them
queued or already sent. Repaired: the names, the copy already rendered from
them, and the 22 live Instantly payloads so the remaining sequence steps render
it too.

Not fixed, and not fixable from a word list: the same names carry arbitrary
acronyms `initcap` also lowered — "Aci-Ac", "Aims-Usgp", "Aici-Archirodon".
That is the case `solHeadline` already refuses to guess at, and the original
casing is gone from the database for these rows. 21% of queued A2 rows still
render the bare solicitation number (88 of 410), down from 25%.

### Day 10 — inventory

| Angle | Queued | Cap | Sending days of queue |
|---|---:|---:|---:|
| A1 | 355 | 37 | 9.6 |
| A2 | 410 | 125 | 3.3 |
| A4 | 399 | 45 | 8.9 |
| A5 holdout | 1,824 | 75 | — |
| A5 generic | 650 | | — |

A2 at 3.3 days is the shallowest it has been, and that is the capacity raise
working rather than a supply problem: assign queued 257 A2 rows today against
125 sent. The experiment still reads on its slower side — the A5 holdout
control sits at 210 contacted against A2's 624, and today's zero cost it a day.

### Day 11 (10-07 sending) — push landed exactly on budget, and broke two other things

The timeout fix worked, precisely. Three runs, all 200, and every angle finished
on its cap:

| | 06:00 | 06:50 | 07:15 | Total | Cap |
|---|---:|---:|---:|---:|---:|
| A1 | 8 | 24 | 5 | **37** | 37 |
| A2 | — | 60 | 65 | **125** | 125 |
| A4 | 13 | 32 | — | **45** | 45 |
| A5 | 16 | 59 | — | **75** | 75 |

Two runs stopped on the time budget and said so; the third finished early. The
06:25 retry correctly did not fire, because nothing failed. `a2_left_close_date_full`
fell again, to **419** from 605 and from 1,508 before the window widened.

Then both of yesterday's own fixes turned out to have the same flaw in a new
place: **per-run state where the day is the unit.**

**A MOVED LEAD IS LIVE IMMEDIATELY.** I stopped confirming the
retired-campaign move inline, reasoning the next run would confirm it for free.
That ignored what a move does. It lands within seconds, the lead is then in a
LIVE campaign, and Instantly emails it at once. **31 contacts went through a
sequence on 10-07 while their rows still said `ready`** — every one already
contacted when I checked, none with an outcomes row, so invisible to metrics
and to reply attribution, and healed only by the next morning's run. The
campaigns held 175/773/290 against 170/749/288 in the queue; that gap was the
whole of it.

Fixed by confirming at the *end of the same run* rather than inline or next
run: the move goes on a list walked after the main loop, by which point the
earliest are minutes old and the latest seconds old — all the settling a
background job needs, at one GET per duplicate instead of a 2.5s sleep. The
loop gives up 20s of its budget for that pass. A queued move now also spends
the angle's budget and the solicitation's allowance at the moment it is queued,
because the move is the irreversible act.

**THE SOLICITATION PACE RESET EVERY RUN.** push runs three times a morning and
`solSentToday` was run-local, so each run recomputed the cohort, started its
counter at zero and spent a fresh allowance. 49 of the day's 149 A2 emails went
to one solicitation — W50S8A27BA001, a 70-row cohort with 3 sending days left
and an allowance of 24, spent twice over. The day's sends per solicitation are
now read from the database alongside the angle totals, and the cohort includes
them, so the allowance is the same number at 06:00 and at 07:15.

The pace test now simulates three runs over one cohort: seeded from the day it
spends its allowance once, unseeded three times.

**And the cap was overshot after all** — A2 sent 149, not 125 — because the 24
moved leads were never counted against it. Both halves of that are now closed.

### Day 11 — the lesson, stated plainly

Three days running, the bug has been the same shape: a number that was correct
when one run owned the day, and wrong once the day had several runs or several
paths into it. The daily cap, the solicitation pace, and the push record all
broke that way. Anything that spends a budget now reads what the day has
already spent out of the database rather than assuming it starts at zero.

### Day 11 — replies, and five suppressions

Eleven replies, eight of them machine and all eight correctly classified — the
first clean day for the classifier since the shapes started arriving.

Three human declines, two of them naming price or scope rather than process:
*"We are not quoting these types of contract"* (A1) and *"No, thanks"* (A2).
And **two explicit stops**: *"Stop emailing me."* (A2) and *"Stop"* (A5).

All five suppressed at the person level, which is the standing rule — a no is
that person's answer, not their employer's — and each of the five is the only
row for its company, so nothing company-wide happened. Their sequences were
already halted: `stop_on_reply` is on for all four campaigns and
`stop_on_auto_reply` is off, which is the right pair of settings and worth
recording, because it means an autoresponder does not end a sequence but a
real reply does.

No new positives. **Seven are still waiting on a fulfilment answer**, the
oldest from 09-25.

### Day 11 — the rest

**Bounce 1.10%**, 21 of 1,915 contacted, eleventh day under the gate. A1 1.35%,
A2 1.00%, A4 1.42%, A5 0.93%.

| Angle | Queued | Cap | Sending days of queue |
|---|---:|---:|---:|
| A1 | 380 | 37 | 10.3 |
| A2 | 523 | 125 | 4.2 |
| A4 | 391 | 45 | 8.7 |
| A5 holdout | 2,049 | 75 | — |
| A5 generic | 739 | | — |

The awards scanner produced again on its own: 32 written at 03:45 as the first
scan stamps aged past the 21-day window, exactly as the 10-13 estimate said it
would start. Bare solicitation numbers down to 16% of queued A2 rows (82 of
523) from 21%.

The holdout control is moving now that A5 is no longer starved: 285 contacted
against A2's 773. Still the slower side, still short of the ~440 per arm a
readable answer needs.

### Day 12 (10-08 sending) — the machinery is right, and the emails were still broken

Everything a counter can see was green. Every job 2xx. Push ran three times and
every angle landed exactly on its cap — A1 37, A2 125, A4 45, A5 75. All 58
retired-campaign moves were queued, confirmed and recorded in the same run,
`moves_left_for_next_run` 0 on all three runs, and `blocked_duplicate_elsewhere`
0. Queue and campaigns agreed exactly in both directions: 212/898/335/480, zero
unclaimed, zero missing — yesterday's 31 became none. Bounce **0.94%**, first
day under 1%, twelfth under the gate.

Then a reply said this:

> What is this regarding?
> On Thu, Oct 8, 2026 at 9:04 AM Earl Knight wrote:
> > **Brandon, closes .**

**A MOVE CARRIES THE LEAD, NOT THE RENDER.** `/leads/move` changes which
campaign a lead sits in and nothing else, so a moved wave 1 lead arrived in A2
still holding its wave 1 custom variables — `segment`, `new_awards`,
`last_award_date` — and none of A2's. Instantly then rendered the sequence
against variables that do not exist. The close date was blank because the lead
had no `sol_close_date` at all.

Audited every lead in all four campaigns against `REQUIRED`:

| Cause | Leads | Missing |
|---|---:|---|
| Moved wave 1 leads (A1 81, A2 164, A4 27) | 272 | every variable the angle needs |
| A2 leads pushed before 10-03 | 291 | `sol_line`, `sol_short` only |
| **Total, all already contacted** | **563** | |

The second group is a different mistake with the same consequence: `sol_line`
and `sol_short` were added on 10-03 when the owner asked for the solicitation
title, the A2 steps were changed to use them, and the 291 leads already in
flight were never backfilled. Their steps 2 and 3 have been going out with the
title slot empty ever since.

Repaired in two halves. The queue side is done: the 347 whose stored render
also lacked the two keys were recomputed with the **shipped** `solHeadline`
rather than a reimplementation, so they hold exactly what `job_assign` would
have written — 289 a real title, 58 the bare number, which is the documented
75% hit rate — and no pushed A2 row is missing `sol_line` any more. The
Instantly side took two passes — 563 PATCHes at the 20-request-a-minute rate
limit is about half an hour, and the first background job was stopped at a
28-minute cap I had set myself rather than the two hours allowed, after 470 of
them. Re-auditing rather than resuming from a log position found exactly 93
left (A2 66, A4 27); those patched clean. **Final audit: 1,925 leads across the
four campaigns, 0 missing a key from `REQUIRED`.** `job_push` sends the payload
on a confirmed move as well as on a create, so nothing new joins the set.

**The gate was only guarding one of the two ways in.** Rule 0.7 — no blank
variable reaches a reader — is asserted in `job_assign` and again in
`job_push`, and both assertions are on the create path. The move path was added
on 10-06 and bypassed both. Every angle variable in the programme was
guaranteed by a check that a new code path simply walked around.

### Day 12 — the measurement that was nearly wrong

The first audit reported 212 of 212 A1 leads broken, which was obviously false
— A1 has been getting replies that quote its copy. The script was checking a
`REQUIRED` map I had typed from memory, and A1's real keys are `agency_short`
and `contract_end_month`, not `fit_line`. Read off `_shared/outreach.ts`, the
count was 81. **694 would have been reported as broken on a guessed key list.**

### Day 12 — concentration, which is working correctly now

46 of today's 125 A2 emails named one solicitation, and that is the pace doing
its job rather than failing: ARPA-H-SOL-26-163 has 92 unsent rows and closes
10-18, so with the 8-day floor it had **two sending days** left. 92 over 2 is
46. The other 46 go tomorrow.

The pace can spread a cohort across the days it has; it cannot create days. A
cohort that matched late arrives with no runway, and the only remedy — refusing
the excess — means dropping it, which is worse. Worth watching rather than
fixing: this is the second 90-plus firm cohort in one NAICS inside a week.

### Day 12 — the rest

**A4's cap goes 45 to 50**, its true ceiling (8 mailboxes x 25, over 4 steps).
It was held back from 10-06 while the awards scanner had nothing to do; the
scan stamps aged out on schedule and the scanner wrote 32 signals on 10-07 and
8 on 10-08, so the brake comes off. 411 queued at 50 a day is 8 sending days
with the scanner refilling behind it.

The recompete scanner reached `still_unscanned: 0` at 20:00 — it has now walked
all 11,008 companies for the first time. A1's supply will thin until its 30-day
stamps start expiring.

Four replies, two machine and both correctly classified. Two humans, both
asking what this is: *"What is this regarding?"* (the broken one above) and
*"What are you offering to debreif?"* (A5). Neither counted positive and
neither is a decline — they are people who would answer a clear email. No new
positives; **seven are still waiting on a fulfilment answer**, oldest 09-25.

| Angle | Queued | Cap | Sending days |
|---|---:|---:|---:|
| A1 | 421 | 37 | 11.4 |
| A2 | 552 | 125 | 4.4 |
| A4 | 411 | 50 | 8.2 |
| A5 holdout | 2,143 | 75 | — |
| A5 generic | 830 | | — |

Holdout control 360 contacted against A2's 898. Bare solicitation numbers 15%
of queued A2 rows (82 of 552).

### Day 13 (10-09 sending) — clean, and a correction I owe the log

First fully clean day since the ramp. Every job 2xx. Push hit every cap exactly
— A1 37, A2 125, A4 50 (its new ceiling), A5 75. All 49 retired-campaign moves
queued, confirmed and recorded in-run, `moves_left_for_next_run` 0 on all three
runs, `blocked_duplicate_elsewhere` 0. The full audit across 2,212 leads:

| | Queue says | Campaign holds | Unclaimed | Missing | Blank variables |
|---|---:|---:|---:|---:|---:|
| A1 | 249 | 249 | 0 | 0 | 0 |
| A2 | 1,023 | 1,023 | 0 | 0 | 0 |
| A4 | 385 | 385 | 0 | 0 | 0 |
| A5 | 555 | 555 | 0 | 0 | 0 |

Bounce **0.94%**, 28 of 2,966, thirteenth day under the gate and the second
under 1%.

**THE CORRECTION.** This log and the daily routine have said for several days
that "seven positive replies are awaiting a fulfilment answer, the oldest from
09-25". That was wrong in two ways.

It was read off `outcomes.positive`, which mirrors Instantly's lead-interest
flag — something a person or Instantly's own model sets and can change. It read
7 on 10-07 and 5 today with no new data, because the flag moved. **A count that
can go down on its own is not a tally**, and I was quoting it as one.

And the premise was wrong. The reply desk built in the other session has been
answering them. Its ledger (`data/reply-desk.json`, 108 entries) says of the
ten replies that actually asked for something: **six sent** — Exergy, Document
Security Solutions, Stronghold, Thornton, WR-C, StériCert — and **four
drafted**: Staffing Etc, Mathematician Jr, Smith (Certified Surface
Inspection), Alden LG. One is `needs_human`: Cleveland (A2), whose question
was *"What is this regarding?"* in reply to the blank-variable email from
10-08 — so the one reply the desk cannot answer is one this programme caused.

So the standing item is not "seven unanswered since 09-25". It is: **one
`needs_human`, four drafts waiting to go out.** The routine now says to read
the ledger rather than count a flag.

### Day 13 — a seventh autoresponder shape

A bilingual out-of-office counted as a human reply: *"Bonjour, je serai de
retour au bureau le 13 octobre... Hi, I am out of the office and will return on
October 13."* Neither half matched — `i will be out of the office` wants "will
be", and `will be returning on` does not cover "will return on". Fourth of the
seven shapes whose only fault was a verb tense the pattern had not anticipated.
Three patterns added, including the French, and a case for a human who is away
and still answers, so the present-tense pattern cannot eat them.

### Day 13 — two scanners are now idle, both by design

`recompetes` wrote 0 on all six runs: `still_unscanned: 0`, and every company
is assigned, holds a live signal, or was scanned inside the 30-day window. It
has walked the whole universe once. `awards` is in the same state most runs.
Neither is broken and neither needs touching — A1 has 472 queued at 37 a day
(12.8 sending days) and A4 394 at 50 (7.9), and the 30-day and 21-day stamps
start expiring inside both windows.

What this does change is A2's share of the pool: `a2_left_close_date_full` rose
to **857** from 419, because the opportunities job keeps matching new
solicitations while the other two angles stop claiming companies.

### Day 13 — inventory

| Angle | Queued | Cap | Sending days |
|---|---:|---:|---:|
| A1 | 472 | 37 | 12.8 |
| A2 | 486 | 125 | 3.9 |
| A4 | 394 | 50 | 7.9 |
| A5 holdout | 2,153 | 75 | — |
| A5 generic | 891 | | — |

A2 base 537 contacted against speed 486. Holdout control 435 against A2's
1,023 — still the slower side but gaining 75 a day now that A5 is not starved.
45 of today's 125 A2 emails named one solicitation, the same short-runway
cohort arithmetic as 10-08. Bare solicitation numbers 14% of queued A2 rows (69
of 486).

### Day 14 (10-12 sending) — 99 rows died of an off-by-one between two clocks

Everything else was clean. All 17 jobs 2xx, every cap hit exactly (A1 37, A2
125, A4 50, A5 75), the three-way Instantly audit zero on all counts across
2,499 leads, bounce **0.97%** on the fourteenth day under the gate, and the
tightest concentration since the pace shipped — 16 of 125 on the largest
solicitation.

The one number out of place was `dropped_stale: 92` in the 06:50 run, against a
normal 0 to 9. It was a whole cohort dying at once, and the cause is two parts
of the system measuring the same thing differently.

`futureOk` compares a close date against **`Date.now()`**. `sendingDaysUntil`,
which sizes the close-date budget that admits an A2 row in the first place,
compares **midnight to midnight**. So for a solicitation closing 10-20, at a
06:50 push on 10-12:

| | says |
|---|---|
| Whole days out | **8** — at the floor |
| `futureOk` at 06:50 | **7.715** — under the floor |
| Sending days the budget counted | **1**, today |
| A2 rows dropped | **99** |

Every cohort has been promised a final day job_push would not spend, and this
one was relying on it. They are not recoverable: tomorrow they are 7 days out,
under the floor however it is measured. **99 firms with a live matched
solicitation will not hear from us about it.**

All three places now ask in whole days — the floor and the far edge of the
window in `job_push`, and the signal gate in `job_assign`, which was refusing
the same rows at 05:00 by the same arithmetic. Dates are what the copy says
("closes Oct 20") and what the budget counts, so dates are what gets checked.
57 queued rows sit one day above the floor tonight and would have hit that
boundary tomorrow; a new test pins the floor, the budget and the gate to each
other so they cannot drift apart again.

**This is the fifth instance of one shape of mistake.** The daily cap, the
solicitation pace, the push record, the lead render, and now the floor: each was
correct in the one place it was written and wrong against a second place that
had to agree with it. The rule the log has been accumulating — assert a
guarantee on every path that reaches the same place — extends to units. Two
correct calculations in different units are one bug.

### Day 14 — we sent 287 emails on a federal holiday

Found in an autoresponder: *"I will be out of the office Friday October 9th,
returning to work Tuesday October 13th **due to the federal holiday on Monday
October 12th**."*

Today was Columbus Day. The push cron is `0 6 * * 1-5` and knows about weekends
but not holidays, so a day's full cap — 287 contacts — went to federal
contractors on a day the agencies they sell to were shut. That is not a defect
and nothing is broken, but it is a wasted day of capacity against the one
audience for whom federal holidays are not ordinary days, and the expensive
ones are close: Thanksgiving (11-26 and the Friday after), Christmas, New Year.

Not changed unilaterally, because it is a judgement about timing rather than a
fault, and the harm cannot be measured from here — link tracking is off and the
reply samples are too small to separate a holiday from noise. The cheap version
is a list of federal dates that `job_push` returns early on, which also stops
the close-date budget counting them as sending days. Worth a decision before
the last week of November.

### Day 14 — replies, and a second reader who could not tell what we wanted

Nine replies since Friday, four machine and all four correctly classified. Two
new accepts, both drafted by the reply desk: *"I like Face Time then Emails
please send me your cell number"* (A4) and *"Yes I was aware. Sure send me some
info"* (A4).

Two declines, suppressed at person level: *"I don't have an interest"* and
*"I don't know you, you don't know me... I have no interest in paying someone
to find contracts for me. Please do not contact me again."*

And a third: *"I have no idea what your talking about....zero understanding"*
(A2). The quoted email was rendered correctly, so this is not the 10-08
blank-variable bug — it is a reader who read a correct email and could not tell
what was being offered. **Second one this week**, after *"What is this
regarding?"*, which was the broken one. I suppressed her and then reversed it:
the reply desk classified it a question and drafted an answer, and suppressing
someone who asked the programme something would stop the programme answering.

Two confused readers in five days, out of 28 human replies, is worth watching
rather than acting on — but the copy was already rewritten once for clarity on
the owner's instruction, and these are the smallest firms in the pool.

Reply desk ledger: **one `needs_human`** (still Cleveland, the 10-08 blank
email) and **nine drafted**, up from four on Friday. The drafts are the backlog
worth clearing — every one is someone who asked for the deliverable.

### Day 14 — inventory

| Angle | Queued | Cap | Sending days |
|---|---:|---:|---:|
| A1 | 585 | 37 | 15.8 |
| A2 | 600 | 125 | 4.8 |
| A4 | 418 | 50 | 8.4 |
| A5 holdout | — | 75 | — |
| A5 generic | 3,406 total A5 | | — |

A2 base 595 contacted against speed 553. Holdout control 510 against A2's
1,148. Bare solicitation numbers rose to 19.5% of queued A2 rows (117 of 600)
from 14%, which is new solicitations arriving with titles `solHeadline` will not
vouch for rather than anything changing in the code.

### Day 15 (10-13 sending) — the holdout experiment is readable, and it does not support the premise

Both arms have passed the sample the experiment was designed around. This is
the comparison the whole system was built to make, so here it is plainly.

| Arm | Contacted | Human replies | Rate |
|---|---:|---:|---:|
| A2 personalized (named solicitation, close date, fit line) | 1,273 | 16 | **1.26%** |
| A5 holdout — the SAME population, generic copy | 585 | 6 | **1.03%** |
| A5 generic — no signal at all | 928 | 14 | **1.51%** |

A2 against its own holdout: **z = 0.43, p = 0.67.** Indistinguishable. The
arm with no personalization at all has the highest rate of the three.

On the better metric — people who asked for the deliverable, which is what the
business actually sells — A2 has 4 accepts to all of A5's 2: 0.31% against
0.13%, **p = 0.30**. Also indistinguishable, though the direction favours A2.

**What is now ruled out:** that personalization doubles the reply rate. The
~440-per-arm target was sized to detect a doubling, and at 1,273 and 585 a
doubling would be visible. It is not there.

**What cannot be settled this way:** a difference of the size actually
observed. At 1.26% against 1.03%, confirming it at 80% power needs roughly
**33,000 contacts per arm** — 265 sending days at the current cap. That is not
a number this programme will reach, so no amount of further sending will turn
this into a clean answer.

Three honest caveats, because the headline is stark:

1. The holdout is not "no email". It gets A5's generic debrief question, which
   is a good email. This measures personalized copy against generic copy, not
   personalization against silence.
2. 16 replies and 6 replies are small absolute numbers. The confidence interval
   on each rate is wide.
3. Reply rate is not revenue. A2's accepts arrive attached to a live
   solicitation with a deadline; A5's arrive attached to nothing. Whether that
   converts differently downstream is not visible from here and is the only
   question that would actually settle the matter.

So the finding is not "turn A2 off". It is that **the expensive machinery —
solicitation scanning, NAICS matching, close-date budgets, per-solicitation
pacing, the whole render pipeline — has not bought a measurable reply-rate
advantage over a well-written generic question**, and the case for it now rests
entirely on what happens to those four accepts. That is a decision for the
owner, and the data to make it is downstream conversion, not more sending.

### Day 15 — the off-by-one fix did exactly what it should

`dropped_stale: 0` on all three push runs, against 92 yesterday. The cohort
that would have died: close 10-21, exactly 8 whole days out today, 145 rows —
**62 sent today, 0 dropped, 0 left waiting.** Every cap hit exactly (A1 37, A2
125, A4 50, A5 75), 31 moves queued and all 31 confirmed in-run, and the
three-way audit clean across 2,786 leads.

Bounce **0.82%** — 36 of 4,381, the lowest reading yet and the fifteenth day
under the gate.

### Day 15 — replies, and one match that was wrong

Nine replies, six machine and all six correctly classified, including two
shapes this log added patterns for last week (the future-tense leave notice and
the Titan Tech delegation) — they are being caught now rather than counted.

Three declines, suppressed at person level. One is worth keeping:

> Thanks but no thanks. **We don't make antennas.**

A2 matched Wheatstone to a solicitation outside what they actually do. The
copy hedges correctly — "on paper you clear the bar on NAICS 334220" — and on
paper they do, because that is the code they are registered under. This is the
inherent cost of NAICS matching rather than a bug, and the hedge is doing its
job, but it is the first reply to name it outright. One instance; worth
counting, not acting on.

### Day 15 — bare solicitation numbers are climbing

27% of queued A2 rows now render `sol_short` as the bare number, up from 19.5%
and 14% on the two previous days. The cause is not the code: sampling the
rejected titles shows they are the two cases `solHeadline` refuses on purpose
— ALL CAPS ("RENOVATE MILITARY FAMILY HOUSING TOWER 4511, CAMP COURTNEY",
"CONTRACTOR-OPERATED PARTS STORE (COPARS)") and over-length (110, 152, 200
characters, against a 90 limit).

So this is the incoming mix changing, not a regression. But over a quarter of
the queue now shows the "too computerized" look the owner objected to on 10-03,
and two of the three causes look addressable: an ALL CAPS title could be
title-cased if the acronym problem were solved, and a 200-character title could
be truncated at a clause boundary. Neither is free and both risk a worse render
than the bare number. Flagged rather than attempted.

### Day 15 — inventory

| Angle | Queued | Cap | Sending days |
|---|---:|---:|---:|
| A1 | 578 | 37 | 15.6 |
| A2 | 652 | 125 | 5.2 |
| A4 | 394 | 50 | 7.9 |
| A5 | 3,539 | 75 | — |

Reply desk: **one `needs_human`** (still Cleveland) and **nine drafted**,
unchanged from yesterday. Largest solicitation 15 of today's 125 A2 emails.

### Day 16 (10-14 sending) — green, and a narrow leak the detector cannot see

All 17 jobs 2xx, every cap exact (A1 37, A2 125, A4 50, A5 75), 31 moves all
confirmed in-run, the three-way audit clean across **3,073 leads**, one stale
drop, and bounce **0.81%** — 40 of 4,934, the lowest yet and the sixteenth day
under the gate. Largest solicitation 15 of 125.

Two replies, both human. One decline, suppressed. The other was *"I am not even
sure what you're talking about"* — the third of that shape in a week, so I read
the email rather than the counter. It was this:

> on paper **Woods Electric LLC** clears the bar on NAICS 238210
> **CLWTP FISMA Compliance** (140R4026Q0108), DOI, closes Oct 16

Josh Woods is an electrician in Big Pine Key. FISMA is the federal information
security statute. The solicitation is coded 238210 — electrical contractors —
because the work sits inside a water treatment plant, and he is registered
under 238210, so "on paper you clear the bar" is literally true and completely
useless. **His reply is the correct response to our email, not a confused one.**

Same shape as 10-13's *"we don't make antennas"*. Two in two days.

**But a sample says the matching is mostly sound, so the generalisation does
not hold.** Fourteen of today's A2 matches read by eye: an independent artist
(NAICS 711510) matched to an art-in-architecture project, a drilling firm to a
water treatment rehab, a plumbing contractor to reverse-osmosis modifications,
site-work firms to a wildlife water catchment. Those are good. The bad ones are
a tail, and NAICS is assigned to the *procurement* by a contracting officer,
not validated against the work — so the tail is inherent, and the "on paper"
hedge is what carries it. Counted, not acted on.

### Day 16 — isPersonName cannot see a stranger's name

Reading that sample turned up two company fields that are people: `Frye Rebecca
G` (contact Rebecca Frye) rendered **"your team"** — correct — and `Matthew
Foust`, whose contact is **Jacy Serva**, rendered *"on paper Matthew Foust
clears the bar"*.

That is the gap. `isPersonName` asks "is the company field THIS contact's
name?" and cannot ask "is it SOMEBODY's name?". Separating the live leaks from
the original September bug:

| | |
|---|---|
| Pre-fix, 09-23 to 09-29 | 7 rows — the known bug, repaired at the time |
| Post-fix leaks | **3** — `Comer Lphelps` / Sid Phelps (10-12), `Matthew Foust` / Jacy Serva (10-14), `Kathryn Johnson` / Robert Johnson (queued) |

Two sent, one caught before it went. The queued one is repaired to "your team".

**And a measurement caution worth recording.** My first pass at sizing this
used a regex for "two capitalised words, no corporate marker" and reported
**38**. Reading the 38 by eye, most are real companies — Banks Lawn Care,
Imperial Cleaning, Kiowa Tribe Of Oklahoma, Tazlina River Contractors. The real
number is 3. A crude filter over a name column produces a confident wrong
number, which is the same mistake as the `REQUIRED` list typed from memory on
10-08.

**Not fixed, because the fix is a judgement rather than a correction.** A pure
shape test (2-3 capitalised words, no marker) would catch Matthew Foust and
also turn Banks Lawn Care into "your team", losing real personalization. The
asymmetry favours over-triggering — "your team" to a real company is harmless,
naming a stranger is not — but it is still a trade, and there are two ways to
make it:

1. **A given-name test built from our own data.** The universe has 11,008
   `first_name` values. If the company field's first token appears among them,
   has no corporate marker and is at most three words, treat it as a person.
   Self-contained, testable, no external list. "Matthew" and "Kathryn" hit;
   "Imperial" and "Brandywine" do not.
2. **A trade-word stoplist** — Cleaning, Lawn, Engineering, Contractors. Open
   ended and needs maintaining.

(1) is the better shape. 3 rows in two weeks is the size of the problem, so it
is worth doing deliberately rather than at the end of a daily check.

### Day 16 — inventory and the open desk

| Angle | Queued | Cap | Sending days |
|---|---:|---:|---:|
| A1 | 588 | 37 | 15.9 |
| A2 | 699 | 125 | 5.6 |
| A4 | 383 | 50 | 7.7 |
| A5 | 3,706 | 75 | — |

Holdout control 660 contacted against A2's 1,398, so yesterday's reading is
firming rather than changing. Bare solicitation numbers 25% (178 of 699), level
with yesterday.

Reply desk: **one `needs_human`** (still Cleveland) and **ten drafted**, up
from nine. Six of the ten are accepts — people who asked for the deliverable —
and the oldest has been drafted since 10-06.

### Day 17 (10-15 sending) — green, and the warm leads are the bottleneck now

All 17 jobs 2xx, every cap exact (A1 37, A2 125, A4 50, A5 75), the three-way
audit clean across **3,360 leads**, two stale drops, and bounce **0.74%** — 42
of 5,652, the lowest yet and the seventeenth day under the gate. Two replies,
both declines, both suppressed.

Nothing in the machinery needs fixing. The thing that does need attention is
not a bug.

### Day 17 — eleven drafted replies are not going out

The reply desk's open items, by the date the reply arrived:

| Drafted since | Lead | Campaign | Category |
|---|---|---|---|
| 10-06 | kparks@kpcinc.com | C1 | accept |
| 10-06 | dporter@staffingetc.net | A2 | accept |
| 10-07 | alan@eyesonearth.org | A5 | accept |
| **10-08** | **gidcleveland@gmail.com** | A2 | **needs_human** |
| 10-08 | ameerah@mathjr.org | A5 | question |
| 10-09 | ads81460@gmail.com | A2 | accept |
| 10-09 | kalden@aldenlg.com | A4 | question |
| 10-12 | beni@monacomech.com | A4 | accept |
| 10-12 | precisionsepticandpumping@gmail.com | A4 | accept |
| 10-12 | alohacleaningexperts@gmail.com | A2 | question |
| 10-14 | jwoodselectric@gmail.com | A2 | question |

Plus one with no received date recorded. The count has gone **4 → 9 → 10 → 11
→ 12** across the week while `sent` has stayed at 9. Drafts are accumulating,
not clearing, and the oldest has been drafted for **nine days**.

Six of them are accepts — people who read a cold email and asked for the
deliverable. That is the entire output of seventeen days of sending, and it is
the one number in this programme that is not a proxy for anything. The desk is
built and run from another session and is not mine to touch, so this is a
report rather than a repair: **the constraint on this programme has moved from
the sending side to the answering side.** Nothing about more capacity, better
pacing or cleaner renders matters while these sit.

### Day 17 — A4's constraint has flipped from signals to mailboxes

The awards scanner came back hard, exactly as the 21-day stamps predicted,
starting a week earlier than my 10-21 estimate:

| Run | Signals written |
|---|---:|
| 09:45 | 128 |
| 15:45 | 97 |
| 21:45 | 10 |

Live `competitor_award` signals now **1,054**, against 248 on 10-06, with 283
of them on companies that have no assignment at all. A1's scanner has started
too — 31 written at 08:00 as its 30-day stamps began expiring.

So A4 is no longer supply-limited. Its queue is 342 at 50 a day, and 50 is the
hard ceiling of its 8 mailboxes over a 4-step sequence. A4 has the second-best
accept rate in the programme (3 of the 6 open accepts) and now has the signals
to feed more capacity, so if mailboxes are to move anywhere, A4 is where the
case is strongest. Not acted on — it is a reallocation decision, and A2's 20
boxes are the only place they would come from.

### Day 17 — the rest

`assign` wrote only 117 against 503 yesterday, with
`left_unassigned_at_ceiling: {A5: 408}` — A5's generic queue hit its ceiling
exactly (1,125 = 15 days x 75) for the first time. Working as designed:
generics are the least valuable sends and yield first.

| Angle | Queued | Cap | Sending days |
|---|---:|---:|---:|
| A1 | 565 | 37 | 15.3 |
| A2 | 611 | 125 | 4.9 |
| A4 | 342 | 50 | 6.8 |
| A5 | 3,686 | 75 | — |

Holdout control 735 contacted against A2's 1,523 — the 10-13 reading is firming
with every day, not shifting. Largest solicitation 29 of today's 125. Bare
solicitation numbers down to 20% (121 of 611) from 25%.

One reply was *"Please put us on a do not email list."* Allied Imperium Global
is the only row for that company, so suppressing the person is the whole of the
request, and nothing was inferred about anybody else — the person-level rule
and an explicit company-level request did not actually conflict here. Worth
noting that they could, on a company with several contacts, and that would be a
decision for the owner rather than a default.

### Day 18 (10-16 sending) — the best reply day, and the backlog grew with it

Thirteen replies, the most of any day. Eight machine, all eight correctly
classified. **Three new accepts** — *"Yes"* (A2), *"Sure"* (A4), *"Yes, I would
be interested"* (A2) — plus a fourth the desk also booked as an accept.

Every cap exact (A1 37, A2 125, A4 50, A5 75), the three-way audit clean across
**3,647 leads**, two stale drops, bounce **0.79%** on the eighteenth day under
the gate.

And the reply desk went **12 open to 16**. `sent` is still 9, unchanged for
eight days. Nine of the sixteen are accepts, and the oldest two have been
drafted since 10-06 — ten days.

| | 10-15 | 10-16 |
|---|---:|---:|
| Drafted | 11 | **15** |
| needs_human | 1 | 1 |
| Sent | 9 | **9** |

Yesterday's entry said the constraint had moved from sending to answering. A
day later the sending side produced its best result yet and the answering side
absorbed none of it. Nine firms have now asked for a deliverable and not had
one.

### Day 18 — opportunities hit WORKER_RESOURCE_LIMIT, and the trace said why

First 546 since the ranged-read fix on 09-29 — seventeen clean days. The 03:08
guarded retry succeeded, and the instrumentation answered the question in one
query, which is what it was built for:

| Stage | Failed 03:00 | Retry 03:08 |
|---|---:|---:|
| after_index | 2,728 ms, 15 MB | 1,714 ms, 15 MB |
| 65,536 records | 7,018 ms, 20 MB | 4,653 ms, 19 MB |
| after_stream | **died here** | 4,944 ms, 21 MB |

**Not memory.** Heap was flat at 19-21 MB in both, the same as every clean run
since 09-29. The failed run was roughly 50% slower at every checkpoint on
identical work and died in the last ~6,000 records of the stream. That is CPU
or a slow worker, which `WORKER_RESOURCE_LIMIT` also covers — the distinction
that took a week of misdiagnosis to learn in September and one query to settle
now. No change made.

### Day 18 — a reply that argues with the deadline-first sort

> We already submitted our bid for this opportunity.

A correct match — right firm, right solicitation, Hickman Wildlife Water
Catchment — that arrived after they had already bid. The disqualifier list was
no use to them by then.

`job_push` sorts deadline-first, which is what stops rows dying under the
8-day floor, so the rows that go out are the ones closest to closing. That is
right for not wasting a matched signal and wrong for being useful to the
reader, who wants the list while there is still time to act on it. One data
point against an ordering that exists for a measured reason (245 A2 rows died
of arrival-order on 09-30), so this is recorded rather than acted on. If a
second or third arrives, the question is whether the window's early end is
worth more than its late end.

### Day 18 — inventory

| Angle | Queued | Cap | Sending days |
|---|---:|---:|---:|
| A1 | 542 | 37 | 14.6 |
| A2 | 472 | 125 | 3.8 |
| A4 | 310 | 50 | 6.2 |
| A5 | 3,635 | 75 | — |

`assign` wrote 82 against yesterday's 117, with A5 at its ceiling again (223
left unassigned) and `a2_left_close_date_full` back up to 895. A2's queue is at
its thinnest since the ramp — 3.8 sending days — which is the close-date budget
refusing what cannot be sent in time rather than a supply problem.

### Days 19-20 — every rate in this document was divided by a junk number

The bounce rates reported here since launch — 1.61%, 1.62%, 1.24%, 1.34%,
0.79% — were computed as `bounced_count / contacted_count`, straight from
Instantly's lifetime campaign analytics. `contacted_count` is not a count of
people. It is not a count of anything that holds still.

A2 on 10-18, from one API response:

| Field | Value |
|---|---:|
| `leads_count` | 1,648 |
| `contacted_count` | 3,147 |
| `emails_sent_count` | 3,903 |

3,147 is larger than the number of leads in the campaign and smaller than the
number of emails sent. It cannot be unique people contacted, because a campaign
cannot contact more people than it holds. It is not a send counter, because it
is not the send count. And it is not a lagging copy of one: across the four
campaigns `contacted_count` rose **847 on Saturday 10-17**, a day the daily
series reports `sent: 0` for every campaign. A denominator that moves while
nothing is sent cannot carry a rate.

The daily series is self-consistent, which is why it is believed instead. Summed
over A2's whole life: daily `sent` 3,903, equal to `emails_sent_count` to the
digit. Daily `new_leads_contacted` 1,386 — the unique-people number the label
`contacted` was reaching for. And `leads_count` is confirmed against our own
books rather than trusted: 434 / 1,648 / 635 / 930 is exactly the count of
assignments at status `pushed` per angle, which is what the three-way audit
reconciles every day.

The honest numbers, for the whole programme:

| Angle | First emailed | Sent | Bounced | Per person | Per send | Pushed, not yet mailed |
|---|---:|---:|---:|---:|---:|---:|
| A1 | 398 | 975 | 4 | 1.01% | 0.41% | 36 |
| A2 | 1,386 | 3,903 | 26 | **1.88%** | 0.67% | 262 |
| A4 | 574 | 1,475 | 10 | 1.74% | 0.68% | 61 |
| A5 | 853 | 2,229 | 13 | 1.52% | 0.58% | 77 |
| **All** | **3,211** | **8,582** | **53** | **1.65%** | **0.62%** | **436** |

Both rates ship from now on, because they answer different questions. Per
person is how dead the list is, and it is what predicts the rest of the 11,008
pool. Per send is what a mailbox provider sees. The number this document has
been quoting, 0.73%, answers neither — it was 53 over a denominator that
corresponds to nothing.

**What this changes.** The claim "eighteen consecutive days under the 2% gate"
survives: 1.65% is under 2%. The claim that it was comfortably under does not.
A2 on its own is at 1.88%, twelve hundredths of a point from the gate, and A2
is the angle carrying the most volume and the whole close-date ramp. Nothing
was ever gated automatically on this number, so no decision was taken on it —
the damage is confined to what was reported, which is bad enough.

**And a third number nobody had.** 436 leads are pushed into Instantly and
have not yet received a first email; they sit in its own daily queue behind
`daily_max_leads`. Every report to date counted them as mailed. A2's 262 is
two days of its cap.

The reasoning that put rates over people rather than over sends was right and
is unchanged: follow-up steps inflate sends for reasons that have nothing to do
with the copy, so a rate over sends drifts down as a sequence rolls out. Only
the field claiming to be the people number has changed. Fixed in
`outreach-metrics` and in `instantly-baseline.mjs`, which froze the same junk
denominator into every weekly snapshot it has ever written.

### Days 19-20 — `outcomes.first_touch_at` holds the push, not the touch

Found while looking for a second source for the denominator above. Our own
table has a column for when a company was first emailed, and it is populated
for 3,645 of 3,647 rows — suspiciously exactly our pushed count, when Instantly
says only 3,211 have been emailed.

Measured: of 3,645 rows joined to their assignment, **3,556 have
`first_touch_at` within two minutes of `pushed_at`**. It is the push clock.

Two paths write it. `outreach-push` stamps `new Date()` at push time. `metrics`
writes the real first-send timestamp from the email feed — but only for
companies that replied, and only within the feed window it reads, so for almost
every row the push time stands. The column therefore means "when we handed the
lead over" for 97.6% of rows and "when the first email actually went out" for
the rest. One column, two meanings, no way to tell which from the value.

This is the shape this programme keeps producing: a value that was correct
while one path owned it, wrong once a second path reached the same place. The
A2 cap spending itself twice, the render guarantee asserted twice with both
assertions on the create path, the solicitation pace reset on every run — all
the same defect wearing different clothes. Nothing reads the column yet — grep finds no consumer
outside the writer itself — which is the only reason this is a note rather than
a repair. It is recorded now because the first cohort analysis keyed on "first
touch" will be wrong by up to the queue depth, and 436 leads deep is not a
rounding error. `assignments.pushed_at` is the honest push clock and should be
what any such query uses.

### Days 19-20 — the `positive` flag, scored against five real replies

Five human replies landed on 10-16. Read by eye against what Instantly's
`lt_interest_status` said about each:

| Reply | Flag | Truth |
|---|---|---|
| "Yes" | positive | **decline** — it answers our own "Want me to close this out?" |
| "Sure" | positive | accept |
| "At this time we are not interested" | not positive | decline |
| "Yes, I would be interested." | **not positive** | accept |
| "We already submitted our bid" | not positive | neither |

Two of five wrong, in both directions: a decline marked positive and an
unambiguous accept missed. The first is the more interesting failure — "Yes" is
positive or negative depending entirely on what was asked, and a close-out
question inverts it. No classifier reading the reply alone can get that right
without the outbound question beside it.

This is the flag that produced "seven positives awaiting answer since 09-25",
repeated here for days before it was corrected. It is not evidence. Accepts are
counted by reading the replies.

### Days 19-20 — inventory

| Angle | Queued | Cap | Sending days |
|---|---:|---:|---:|
| A1 | 546 | 37 | 14.8 |
| A2 | 620 | 125 | 5.0 |
| A4 | 326 | 50 | 6.5 |
| A5 | 3,797 | 75 | — |

No `job_push` run on either day, which is correct: the cron is `0 6 * * 1-5`
and both were weekend days. The daily series confirms it from the other side,
`sent: 0` on 10-17 for all four campaigns. The first send after this is Monday
10-19.

`assign` wrote 210 on 10-17 and 120 on 10-18, A5 at its ceiling both days (239
then 397 left unassigned) and `a2_left_close_date_full` easing from 751 to 683.
A2's queue has recovered from day 18's 3.8 sending days to 5.0 without any
change — the close-date budget letting through what the 30-day window admits.

**A4's awards scanner has refilled, four days ahead of the estimate.** It wrote
37 signals on 10-17 and 103 on 10-18 against 0 for the week before, with 15
NAICS/state pairs still unscanned at the end of today's run — the first time
that number has been non-zero since the walk completed. The day-9 note put the
refill at 10-21 to 10-26 from scan-stamp expiry; it started on 10-17. A4 is at
326 queued against a cap of 50, so the 45-vs-50 question that held it back is
now moot and the cap can stay where it is.

The three-way audit reads zero on all three counts for the twentieth
consecutive day: 3,647 leads in the campaigns, 3,647 in the database, 0
unclaimed, 0 missing, 0 rendering a blank variable.

### Days 19-20 — a null `status_code` is not a failure, and the retry knows that

Investigated and found to be nothing, recorded so it is not investigated again.
A manually fired run sat in `outreach.job_run` with `status_code` null and an
empty body and looked like a job that had vanished. It had been eight minutes.
`outreach-harvest` runs `*/10` and copies `net._http_response` into `job_run`;
the row settled at the next sweep with a 200.

Two properties worth knowing while reading that table:

**A null is normal for up to ten minutes after a fire.** The watcher that
chased this had a seven-minute limit, shorter than the sweep interval, so it
was guaranteed to give up before an answer existed. Any poll of `job_run` needs
to outlast the harvest, not the job.

**`retry_job_if_failed` does not depend on the harvest at all.** It reads
`coalesce(jr.status_code, r.status_code)` and joins `net._http_response`
itself, so an unswept row still reports its real status. `pg_net.ttl` is 6
hours against a 45-minute retry window, so the response is always still there
when the retry looks. That `coalesce` is load-bearing: without it a successful
job whose row had not been swept would read as failed and be re-run, and a
spurious `job_push` retry is exactly what spent 201 against a cap of 125 on
10-06.

### Day 20 — spike: can we fetch solicitation documents server-side?

The question was whether a proposal can be built for a lead who replies without
asking them to upload anything. The whole v2 pipeline starts from user uploads,
and the only SAM endpoint this programme uses is the entity API, so the premise
was that server-side document fetch was the blocking unknown. It is not a
blocker, and the thing that is one turned out to be somewhere else entirely.

**Documents are public and need no key.** Three sam.gov front-end endpoints,
unauthenticated, no login.gov, no API key, no quota:

```
/api/prod/opps/v2/opportunities/{noticeId}            metadata + full narrative
/api/prod/opps/v3/opportunities/{noticeId}/resources  attachment list
/api/prod/opps/v3/opportunities/resources/files/{resourceId}/download
```

The narrative text is inline in the first response at `description[0].body` as
HTML; there is no `/description` sub-path and asking for one 404s. The
attachment list carries `accessLevel`, `accessStatus`, `fileExists`, `size` and
`mimeType`, so a gated or missing file is visible before anything is downloaded.

And **we already hold the notice id**: `signals.source_url` is
`https://sam.gov/workspace/contract/opp/<32-hex>/view` for every `rfp_match`,
so there is no search step. This matters because the SAM Opportunities API
would have made the idea unaffordable — `SAM_API_KEY` returns 401 on every form
(recorded in `_shared/outreach.ts` since 09-21) and the working
`SAM_GOV_API_KEY` is noted there as ~10 Opportunities calls a day. The
unauthenticated path has neither limit.

**Measured against the 28 distinct solicitations named in real replies:**

| | Notices | |
|---|---:|---:|
| Documents fetched | 21 | 75.0% |
| Narrative text only (>= 1,500 chars) | 1 | 3.6% |
| Nothing to build from | 6 | 21.4% |

122 attachments listed, 121 public, **exactly one access-gated**. 116 of the 121
public files downloaded — 95.9% — for 167 MB of real pdf, docx and xlsx,
verified by magic bytes rather than by status code. The five misses were
individual files, not notices.

For **the six accepts that name a solicitation, four yield documents.** The two
that do not have no attachments at all: the notice is a short text posting, 224
and 357 characters, too thin for a compliance matrix.

**The actual blocker is the close date.** Of the 29 replies with a solicitation
attached, **4 are still open today**. The median gap from reply to close is
**6 days**, and four replies arrived *after* their solicitation had already
closed. Of the nine accepts, exactly one — Terra Umbris, closing 10-22 — is
still live on the thing they answered.

That last number was nearly reported as "one of nine is servable", which would
have been wrong. The opportunities job skips companies that already hold an
assignment (6,553 skipped on 10-18), so a zero in our signals table is our own
bookkeeping and not a statement about the market. Checked against live
solicitations in each company's NAICS instead: **seven of the nine have one to
three open right now**, closing 10-19 to 11-09. The backlog is servable, but
with a different solicitation than the one they replied to.

**What the replies say about building this automatically.** Three of the 23 A2
repliers told us the solicitation was irrelevant to them — "does not match our
product line", "nothing to do with what we could offer", "we don't make
antennas". A NAICS match is not a judgement that the work is biddable, so an
auto-generated proposal would hand those readers a confidently wrong document,
which is worse than sending nothing. Any such flow has to propose the
solicitation and have the reader confirm it, not assume it.

**Integration, for when this is built.** `process-solicitation` reads files
through `downloadDoc` against `v2_files` rows under an owner id, so the
server-side feed is: fetch, upload to the `v2-files` bucket under an owner,
insert `v2_files`, create `v2_submissions`, POST. Magic links are not missing
either — Supabase supports them and `signInWithOtp` is simply unwired in
`AuthContext`.

The design consequence is the six-day median: this cannot be a batch job over a
backlog. It has to fire within hours of a reply landing, which the queue-backed
pipeline can do, but which means the trigger belongs to the reply desk.

### Day 21 — all four angles on cap, and the concentration arithmetic checked

First day every angle landed exactly on its cap: A1 37, A2 125, A4 50, A5 75,
across three push runs. Two of the three stopped on the time budget and the
third finished with room, which is the continuation crons doing what they were
added for.

**A4 looked one over and was not.** Summing `per_angle` across the three runs
gives A4 51 against a cap of 50, and the 07:15 run reported only 49 already
pushed. The database says 50. That is the known and legitimate divergence: a
queued move spends the budget when it is queued and is recorded when it is
confirmed, so a move straddling two runs is counted once in each place at
different moments. The DB count is the one to trust, and it is on cap.

**53 of 125 on one solicitation, and that is correct.** RFQHT001426QE048, a
cohort of 107, closes 2026-10-28. The A2 floor is 8 days
(`A2_close_min_days`), so the last day it may be sent is 10-20, not 10-28 —
today is 9 days out and tomorrow is 8. Two sending days, 107 rows, allowance
`ceil(107/2) = 54`, sent 53, and the remaining 53 go tomorrow on the final day
where the pace deliberately uncaps. The arithmetic is the formula working, not
a fault; recorded here with the numbers so the next check does not re-derive
it. The 36 rows `held_for_solicitation_pace` in the 07:15 run are other
cohorts being paced correctly at the same time.

**Bounce, on the honest denominators:** 1.65% per person first-emailed and
0.57% per email sent, over 3,330 people and 9,654 sends. A4 1.86% and A2 1.85%
are the two closest to the 2% gate; nothing is near the 5% per-angle trip.

**The bare solicitation number has doubled.** 132 of 467 queued A2 rows render
`sol_short` as the bare number — 28.3%, against 14% on 10-09. `solHeadline`
refuses ALL CAPS and over-length titles on purpose, so this is the refusal
firing more often rather than a regression, but it has gone from one row in
seven to one in four and the copy reads materially worse for them: "DoD posted
SPE7M127U0795" against "DoD posted Hospital Communications Support
(RFQHT001426QE048)". Worth a decision on loosening the refusal rather than
leaving it to drift further.

**The wrong-match rate is now measurable: 5 of 51 human replies, 9.8%**, up
from 3 of 45. Today added "We don't do protein engineering" and "We're a cold
weather training company". A NAICS match is not a judgement that the work is
biddable, and this is the number that decides how a built proposal may be
offered — at one in ten, a proposal auto-sent on the match alone would be
confidently wrong for every tenth reader, which is worse than sending nothing.

Five human replies, all honoured by suppressing the person: one out of
business, two declines, two wrong-match declines, and one explicit stop
covering "all entities affiliated with GovHub". Each of the five is the only
contact at their company, so the person-not-company rule did not bite today —
checked rather than assumed. Three autoresponders were classified correctly,
including a "no longer working for" and two future-tense out-of-offices.

Reply desk: 1 `needs_human`, 15 `drafted`, `sent` still 9. Drafted has run
4 → 16 → 15 across eleven days while sent has not moved, so the queue is
accumulating answers nobody has released.

Three-way audit clean for the twenty-first consecutive day: 3,934 leads in the
campaigns, 3,934 in the database, 0 unclaimed, 0 missing, 0 rendering a blank
variable. All nine A2 required keys are populated across today's 125 pushes.

### Day 22 — "15 drafted" was overstating the backlog by six

Six of the eight accepts queued for a holding reply had already been answered,
and the ledger did not know. Caught by re-reading each thread before sending,
which is the desk's own rule and the reason it exists: *a duplicate reply to a
yes is worse than a missing one.*

On 2026-10-16 a holding note went out by hand from the Instantly inbox to
kparks@kpcinc.com, dporter@staffingetc.net, alan@eyesonearth.org,
ads81460@gmail.com, beni@monacomech.com and
precisionsepticandpumping@gmail.com — "sorry for the slow reply, we've had a
lot of demand on this". Sent outside the desk, so nothing wrote it back to
`data/reply-desk.json`, which still carries all six as `drafted` while its
`sent` counter sits at 9.

So the queue depth this log has been reporting is wrong in a specific way: the
ledger records what the DESK sent, not what the LEAD received. Of the 15
`drafted`, six are already answered, two are misclassified (Chp Solutions said
"Yes" to our own "want me to close this out?", Set-Apart said "We already
submitted our bid" — both tagged `accept` by the model), and two more are
genuinely unanswered accepts who replied on 10-16 and missed that batch:
kurt.marisa@human-domain.com and thomas.showman@gmail.com.

Two things follow. The daily check should stop quoting `drafted` as a backlog
without reading the threads behind it — the number is an upper bound, not a
count. And any sender other than the desk has to write back to the ledger or
re-read the thread first; this one re-reads, because writing to the desk is
another session's business.

The send itself is blocked in this session by the outbound-email permission and
is not done. The two messages are drafted and approved; the remaining step is
someone with send rights running them.

### Day 22 — the loosened renderer in production, and an accept the pipeline cannot serve

Second day with every angle exactly on cap: A1 37, A2 125, A4 50, A5 75. The
caps in the push bodies still read A4 50 because the raise to 55 landed after
the morning runs; it binds tomorrow. A4 summed to 51 across runs and the
database says 50 — the queued-move divergence again, same as 10-19.

Bounce 1.66% per person and 0.57% per send over 3,622 people and 10,491 sends.
A2 1.89% and A4 1.86% are still the two nearest the gate and neither moved
materially.

**The renderer change held.** The bare-number share is 10.2% of the queued A2
rows, where it was 28.3% before the fix, and the lines that went out today read
as intended: "Bonneville Lock and Dam - Navigation Lock 1 Bridge Replacement
(W9127N26BA024)", "Construction Contract Sources Sought (89233126NNA000150)",
"Hospital Communications Support (RFQHT001426QE048)". The two bare numbers in a
sample of ten were SPE7LX27U0239 and SPE7M127U0828 — both DLA parts stubs,
refused on purpose.

**Yesterday's concentration arithmetic predicted today exactly.** RFQHT001426QE048
closes 10-28; with an 8-day floor, today at 8 days out was its last sendable
day, and it sent precisely the 53 rows that yesterday's note said would carry
over. 53 of 125 again, and correct again, for the reason already written down.

**A2's queue is at 3.1 sending days**, its thinnest yet (3.7 on 10-18, 5.2 on
10-19). Not a fault — the close-date budget refusing what cannot be sent in
time — but it is the number to watch, because a queue under a day would start
costing sends rather than deferring them.

**An accept arrived that this pipeline cannot serve.** Dr. Bailey at Music
Ministry International, on A1: *"Please send over the information regarding the
potential pitfalls for the recompete bid; I would be interested in reviewing
your assessment."* Articulate, warm, and asking for exactly what the analysis
produces — a disqualifier list.

It is recorded in `outreach.proposal_accepts` and `stage_candidates` correctly
returns nothing for them, because A1 is the recompete angle: there is no open
solicitation to stage, and `live_sols` is 0. The staged-proposal flow is built
on a matched solicitation and A1 has none by construction. So the one thing this
reader asked for is the one thing the pipeline cannot hand them, and what they
want is a different deliverable — an assessment of a contract that is ending,
not a quotation for a solicitation that is open.

Worth deciding deliberately rather than letting it sit: either A1 accepts get a
recompete assessment built from the expiring contract, or they get matched to a
live solicitation in their NAICS and told so, or they are answered by hand. The
third is what happens today by default.

Two declines honoured by suppressing the person: "Not interested" and "Pls. do
not include me in your mailing list". Two autoresponders classified correctly,
one of them an out-of-office whose stated return date (29 August 2026) is
already two months past.

**The reply-desk ledger is now wrong about my own sends.** 16 `drafted`, 1
`needs_human`, `sent` still 9. kurt.marisa@human-domain.com and
thomas.showman@gmail.com both still read `drafted` although both were answered
on 10-20 from the Instantly mailbox. A bulk release of that queue would
double-send to exactly the two people who did get a reply. Same defect as the
six from 10-16, with the difference that this time it is a reply this session
sent. Any sender outside the desk has to write back to the ledger or the ledger
stops describing reality — re-reading the thread catches it at send time, but
only for whoever re-reads.

Three-way audit clean for the twenty-second consecutive day: 4,221 leads in the
campaigns, 4,221 in the database, 0 unclaimed, 0 missing, 0 blank-variable.

### Day 23 — the A1 recompete assessment, and what public award data can carry

Answered Dr. Bailey at Music Ministry International, who asked for "the
potential pitfalls for the recompete bid". Built from USASpending rather than
from the solicitation, because there is no solicitation: A1 fires on a contract
that is ending, and the follow-on RFQ has not posted. That is the whole
distinction between this and the A2 staged-proposal flow, and it turns out not
to be a limitation.

**The contract.** W9115126PA009, Army, FY26 Catholic Pastoral Life Coordinator,
$59,160, expiring 2027-01-29. Found by matching the recompete signal's
end_date and amount against their award history; our own signal payload carries
only the month and the agency.

**Pricing led the assessment, on the owner's instruction and because another
reader on this programme had already said "it always comes down to price". The
finding was sharper than expected and it is entirely public.** Their four
Catholic Pastoral Life Coordinator awards since 2024 run $21,852 (Fort Benning,
expiring the same day), $22,619 (BENELUX/SHAPE), $26,496 (USAG Bavaria) and
$59,160 (the expiring Texas one). Their own median for the role is $24,557.
Across all vendors there have been 17 such awards since 2024, $14,820 to
$94,800, median $25,992 — so the expiring contract sits at about 2.3x the
market median, and a contracting officer doing market research sees every one
of those figures.

The assessment says that without claiming it is overpriced: hours and scope
differ by installation and an "Administrative Pastoral Life Coordinator" is not
the same job. The point put to them is that this is the first question market
research raises and the answer has to be inside the quote.

**The competitive field is thin and includes individuals.** They hold 4 of the
17, more than any vendor; Family Tree Secured 3, Mack Global 2, the rest single
awards with at least two to what look like individuals rather than companies.
That is the real pricing floor: a sole practitioner's rate, which no company
carrying overhead beats on price alone.

**Two facts worth the lookup.** A company-lookup sam_entity call on their UEI
returned SAM active to 2027-07-28, which clears the award and removes a generic
worry rather than inventing one, plus Minority-Owned and Self Certified Small
Disadvantaged Business status. If the requirement comes out as a set-aside the
field of 17 narrows sharply and the price comparison changes with it. Neither
fact was in our database: `sam_expiration` was null and `enriched_at` never
set, because outreach-enrich has no cron.

**What this establishes.** An A1 accept can be served without a solicitation.
The deliverable is a market-position assessment from public award data, not a
proposal, and for a recompete it may be the more useful artifact: it is about
the question the contracting officer will ask, which no proposal can answer
after the fact. Worth building as its own path rather than treating A1 accepts
as cases the pipeline cannot reach.

Sent in-thread from e.knight@buildwithgovhub.com after the same staleness check
the reply desk uses. Nothing was written back to the desk's ledger, which still
does not know about this session's three sends.

## Day 24 (2026-10-21) — the audience runs out before the experiment finishes

**Everything green on the gates.** Bounce 1.64% over 3,899 contacted, the
twenty-fourth day under the 2% gate, and no angle over 5%: A1 1.06%, A2 1.75%,
A4 1.85%, A5 1.59%. All sixteen jobs 200/ok with no retry fired. The three push
runs summed onto cap for every angle — A1 37/37, A2 124/125, A4 55/55, A5 75/75
— and the Instantly audit read zero on all three questions across 4,512 leads,
which is now the expected result rather than a finding.

A cross-check worth keeping: the overview field `new_leads_contacted_count`
matched the daily-series sum exactly for all four campaigns. After the junk
denominator, the daily series was the only figure trusted for contacted; the
overview field is equivalent and one call instead of five.

**Both signal scanners came back to life, by design.** `recompetes` wrote 8, 4
and 1 across its runs and `awards` 43 and 12, after days of writing nothing with
`still_unscanned: 0`. The 30-day and 21-day scan stamps are expiring inside the
queue runway exactly as predicted, so the scanners are re-walking a universe
they had finished. Not a fault, and nothing to touch.

**The finding: the programme has under two weeks of audience left.** Every
company carries exactly one assignment, ever — 9,692 companies, 9,692
assignment rows, no company twice. So the universe is strictly consumed, and
nothing has added a company to it since 2026-10-03 (loaded in three batches on
09-21, 09-22 and 10-03, 11,168 rows).

Against 292 sends a day the non-holdout queue holds 2,203 rows, which is 7.5
days, and 1,322 companies have never been assigned behind it. Per angle, counting
the pools each can actually draw on:

| angle | queued | cap/day | days | fresh pool behind it |
|---|---|---|---|---|
| A1 | 463 | 37 | 12.5 | 108 companies with a recompete signal |
| A2 | 420 | 125 | 3.4 | 465 held on close date, recycling in → ~7 days |
| A4 | 194 | 55 | 3.5 | 127 companies with a competitor_award signal → ~5.8 days |
| A5 generic | 1,127 | 75 | 15.0 | 741 companies carrying no signal |

A4 is the one to watch: `assign` wrote it 5 rows today against 55 spent. There
are 1,218 unassigned competitor_award *signals*, which looks like plenty until
you count companies instead — only 127 of them sit on a company with no
assignment. A signal on an already-assigned company is unusable, because the
company has had its one email. Signal supply was never A4's constraint and is
not now; company supply is.

Nothing here is a bug. Signal-bearing companies already sort to the front of
`assign`, which was the fix for A4 starving once before. This is the audience
being finite, and it is a decision about where more companies come from rather
than something to repair.

**The A2 test cannot finish inside that runway.** Arms are past the ~440 per arm
the routine set: base 1,034, speed 988, A5 holdout control 1,035. Human reply
rates are 1.16%, 1.72% and 0.87%. None of the three differences clears
significance — speed against control is the widest at 0.85pp against a 0.50pp
standard error, z≈1.7, p≈0.09.

The ~440 threshold was calibrated for a larger effect than the ~1% reply rates
these angles actually produce. Confirming the gap now observed between speed and
control needs roughly 2,800 per arm at 80% power, which is 29 more days at A2's
current split — against under two weeks of audience. **At current caps the test
runs out of people before it can return an answer.** Either the caps rise, the
universe grows, or the test is called on the practical grounds that three arms
sitting inside noise after 3,000 sends is itself the finding.

**A4 named an aggregation bucket as a competitor, nine times.** Reading the
lines that went out, one A4 row told Global Power Group that Pacific Gas and
Electric had won in their space, and nine told small firms their competitor was
"Miscellaneous Foreign Awardees" — a USASpending aggregation bucket, not a
company. Three more signals were pending, one already a queued email.

No counter was wrong. The signal had a recipient, a city, an amount and an
agency, so it passed every gate including REQUIRED; the award was real and only
the name was not a company. This is item 8's whole justification: the bug is
invisible to every number and obvious in one line of prose.

Fixed in `outreach-signals` v29 with `notACompany()`, a list rather than a word
filter — "Miscellaneous Supply Company" and "Unknown Brewing Company" are real
firms a keyword match would discard, and both are in the 32-case test. The
pending signals are expired and the queued email dropped to `dropped_stale`,
which is retryable, so those companies take a different angle next run.

Left as a question rather than fixed: Lockheed Martin (16 sends), Dell Federal
Systems (13) and The Rand Corporation (6) are real companies that passed the
plausibility ceiling honestly, because that ceiling tests the *award* size
against the reader's scale, not the firm's. Whether "a firm like yours just won
this" survives naming a mega-prime is a copy judgement, not a bug.

**17.7% of A2 sends rendered a bare solicitation number, and the fix is
working.** Up from 10.2% after the backfill, but the cause is today's cohort:
18 of the 22 are DLA numbers (`SPE7M1`, `SPE7LX`, `SPE4A6`), and their titles
are `61--ADAPTER,POWER SUPPLY` and `48--VALVE,REGULATING,TEMPE` — FSC-prefixed
catalogue stubs truncated mid-word. The FSC rule refuses them correctly.

Measuring the nomenclature field shows hard truncation caps with spikes at 22
characters (212 rows) and 46 (59 rows, the ` IN REPAIR/MODIFICATION OF` form
cut to 19). "ADAPTER,POWER SUPPLY" at 20 is complete; "ABSORBER,AIRCRAFT A" at
19 is not, so length alone cannot tell them apart, and no cheap test separates
"ELECTRON" the real word from "ELECTRONIC" truncated.

Not attempted, and the reason is targeting rather than difficulty: these are
parts buys. The goods/services gate built on 10-20 exists because the proposal
product is for services bids, and 22 of 124 A2 sends today pitched proposal
drafting on a DLA parts RFQ. Polishing the headline would word a better email
for an offer that may not fit. **Whether A2 should send on FSC-prefixed parts
buys at all is the question, and it is the user's.**

**Replies.** Eight inbound since 10-20, five of them real. Dr. Bailey answered
the recompete assessment — "very helpful information to have as we prepare" —
and restated the commitment that still has nothing watching it: *"I look forward
to hearing from you once the solicitation is posted."* Nothing watches SAM for
W9115126PA009's successor. Quenten at J Jaqk wants the disqualifier list and
amendment alerts; Andrew Pregl answered "Yes, please!" to closing his out. Three
were autoresponders, correctly not counted.

Two suppressions applied, person only and never the company, per the standing
rule. Brandt McMillan asked to be unsubscribed. Ramsi Taylor's autoreply says he
has left Virtual Energy Solutions and refers inquiries to jblye@veschicago.com —
suppressed as a dead address with the referral recorded in the reason, and
neither person had a colleague in the universe to lose.

The reply desk now holds 20 drafted and 2 needs_human, five of them new today,
and still carries a second drafted reply to Bailey against a thread already
answered by hand. It has not marked this session's three sends.

**A column read as evidence that nothing writes.** `outcomes.substantive` is
NULL for all 4,512 rows and no function assigns it; `outreach-metrics` only
reads it, including in the recommendation rule at line 514, where
`r.substantive >= 2` is one of three triggers for "SCALE: raise caps". The rule
still fires on its other two triggers so nothing is currently blocked, but a
scaling decision has a dead input. Same shape as the junk denominator: a figure
consumed as though something populated it. Not fixed here because what counts as
substantive is a definition worth agreeing before it gates a cap increase, and
`positive` — the other trigger — mirrors the Instantly flag this routine already
says not to trust.

## 2026-10-23 — the A2 speed arm has been dead for 24 days

`verify-live-leads.mjs` reports the A2 arms every morning and the routine says
each arm needs roughly 440 contacts before a winner can be called. The speed
arm last received a lead on **2026-09-29**. It has been frozen at 58 while base
grew to 2,214 — zero speed pushes on every one of the last ten send days.

So the daily "do not call a winner, ~440 needed" has been reporting on a test
that stopped running three weeks ago. At zero per day it will never conclude.
Whether to restart the arm or retire the test is a decision about the
experiment, so nothing was changed here. The A5 holdout control is healthy by
contrast: 1,185 contacted against A2's 2,272, still the slower side and still
gaining.

This is the recurring bug shape wearing new clothes. The counter was right —
58 is 58 — and nobody read it as "stopped", because a small number that grows
slowly and a small number that has stopped growing look identical in a daily
line. The arm split needs an assertion that both arms moved today, not just a
count of where they stand.

## 2026-10-23 — "JV" was not on the initialism list, so the audit cried wolf daily

The live-lead audit failed every morning with 54 ALL-CAPS names across all four
angles. Every one of the 54 was the token `JV` — "Bay Marine JV LLC",
"King-Albert JV LLC", "Aici-Archirodon JV LLC". Zero were genuine shouts.

`INITIALISMS` in `scripts/outreach-tests/verify-live-leads.mjs` stripped LLC,
PLLC, LLP, PC, USA, II–IV and INC but not JV, which is how a joint venture
writes its own name. Added. The audit now passes clean on all four angles with
the lead counts matching `outreach.assignments` exactly.

The comment above that regex already described this exact failure from launch
morning, when "Retina Consultants Of Oklahoma PLLC" was reported as a defect.
It was one initialism short of being right. A check that fails every day over
correct data teaches everyone to scroll past it, which costs more than the
check was worth.

## 2026-10-23 — daily_caps A4 is 55, not 50

`outreach.config.daily_caps` reads `{"A1": 37, "A2": 125, "A4": 55, "A5": 75}`,
updated 2026-10-20 14:27. A4 has pushed exactly 55 on 10-21, 10-22 and 10-23,
and exactly 50 before that. The routine's stored context still says A4 50, so
three days of correct behaviour read as five-over-cap until config was checked.
All four angles land exactly ON cap; nothing is overshooting.

The cap rise shortened A4's runway: 122 sendable queued is 2.2 days at 55,
where it would be 2.4 at 50. A4 is now the angle nearest the ~2-day flag.

## 2026-10-26 — the A2 speed arm was never dead; the classifier was

The 10-23 entry above says the speed arm had been frozen at 58 since 09-29 and
asked whether to restart it or retire the test. Both arms are in fact running
and have been all along: **base 1,211, speed 1,186**, and both moved on every
send day of the week (10-26 55/70, 10-23 67/58, 10-22 55/70, 10-21 58/66,
10-20 63/62 — nothing on 10-24 or 10-25, which were the weekend).

`verify-live-leads.mjs` read the arm back out of the rendered prose, because
push strips `body_variant` before the lead reaches Instantly, so a live lead
carries only the copy. The speed line changed on 09-29 from "we turn the first
draft **around** in about an hour" to "first draft **back** in about an hour".
The test matched the retired wording and **everything that did not match fell
through to `base`** — so 1,128 live speed leads were counted as base, base read
2,214, and speed read the 58 that still carried the old sentence.

Two independent readings now agree: the audit reports
`arms {"base":1211,"speed":1186}` and `body_variant` on the assignment rows
gives the same split. Both arms are past the ~440 the routine asks for, and the
A5 holdout control is at 1,260. Still not calling a winner — that is a decision
about the experiment — but it is a live experiment with enough data, not a dead
one.

The fix is the shape of the lesson rather than a better regex. A classifier with
a fallback **cannot report its own ignorance**: every lead landed in some arm
whether or not the patterns still matched anything, so the arms always summed to
the lead count and the line always looked plausible. Both arms are now matched
explicitly, anything unrecognised is counted as `unclassified`, and an
unclassified row fails the audit. Removing the current speed phrase reproduces
the original defect exactly — `{"base":1211,"unclassified":1128,"speed":58}` —
where the old code printed `{"base":2214,"speed":58}` and passed.

This is the same recurring bug the 10-23 entry named, one level up. That entry
asked for "an assertion that both arms moved today". The deeper problem was that
the arm numbers were not measuring the arms at all.

## 2026-10-26 — the scanners are idle because the universe is spoken for

Both signal scanners report `naics_state_pairs: 0` and the routine's standing
context reads that as "idle BY DESIGN ... the 30-day and 21-day scan stamps
start expiring inside the current queue runway". The stamps have expired —
2,583 of 4,488 `competitor_award` rows are past their 21-day recheck — and the
scanners still produce nothing, because that was never the binding constraint.

`companiesToSkip` excludes three sets: companies with a live signal, companies
scanned recently, and **every company that already carries an assignment**. The
summary printed the first two and said nothing about the third. On 10-26 it was
**10,029 of 10,984 non-suppressed companies already assigned**, against 1,905
held by the recheck window. One company takes one angle for good, so an expiring
scan stamp cannot free any of those 10,029: the signal it might find is one
`job_assign` will never read.

Both scanners now report `already_assigned`. The awards dry run reads:

    "skipped_a2_covered": 262, "already_had_signal": 1058,
    "recently_scanned": 1905, "already_assigned": 10029

The two readings call for opposite decisions — wait for the windows, or go and
acquire more companies — and until today the summary carried no number that
could tell them apart.

**What this means for runway.** 985 non-suppressed companies are unassigned.
Daily burn is 292 (A1 37, A2 125, A4 55, A5 75). Inventory in sending days at
cap: **A4 1.96** (108 ready — under the ~2-day flag), **A2 2.19** (274),
**A1 9.92** (367), A5 51.3 (3,848, of which 2,795 is the holdout). A1+A2+A4 hold
749 between them and burn 217 a day, so the three angles that carry the
programme's reach have roughly three and a half days left. `assign` is not
holding anything back: `left_unassigned_at_ceiling` is 0 for A1, A2 and A4.

## 2026-10-26 — two of three "accepts" were people asking us to stop

The reply desk's model classified three replies as accepts on 10-26. Reading the
words, two of them are declines, and both were produced by the same mechanism:
our own step-4 line asks **"Want me to close this out?"**, so agreement with it
is a refusal.

- `chris.dcouto@agnisemi.ai` — "Sure. Please close this out."
- `luke.cawleythd@gmail.com` — "Yes - close it please, we do not provide Boiler
  services."

Scored `accept` on "Sure" and "Yes". `sync-proposal-accepts.mjs` writes nothing
without `--apply` and prints the quote for exactly this reason; applied blind,
both would have had an account provisioned and a first-draft proposal emailed to
them minutes after asking to be left alone. Both suppressed — **the person's row
only, with reason and date, no colleague affected**; neither company has a
sibling contact row.

The third, `cam@tgha.co` ("Sure, please recored a quick video"), is a genuine
accept and is now in `outreach.proposal_accepts`. Note what he agreed to is a
**video**; the pipeline builds a proposal. The send is manual, so that is a
human's call.

This is the failure the `proposal_accepts` migration was written to prevent,
and it is worth restating because the category flag keeps looking authoritative:
`outcomes.positive` and the desk's `category` are both model judgements, and a
"yes" is only as good as the question it answers. Seven autoresponder shapes and
now three "close this out" agreements have been miscounted as interest.

Also found: `luke.cawleythd@gmail.com` was pitched *Boiler Rental Montrose VAMC*
on NAICS 238220 and replied that his firm does not do boilers — the NAICS was
right and the work was not, which is what the relevance signal added on 10-26
exists to catch. And `chris.dcouto@agnisemi.ai` was addressed as "Gerard"
throughout, four emails, because that is the contact name on the lead.

## 2026-10-26 — 14 of the reply desk's 27 drafts have already been answered

`data/reply-desk.json` holds 27 `drafted` and 2 `needs_human`. **14 of the 27
drafts (13 distinct people) already had a reply** — the proposal pipeline
answered them in their own Instantly threads on 10-25 and 10-26, which is what
`docs/proposal-handovers.md` records. Sending those drafts would be a second
answer to the same inbound email.

Of the 2 `needs_human`, only one is genuinely waiting:
`john@truthintelligence.com` (10-21, "I don't believe I notice that. But
thanks!" — a polite non-answer to "Want me to close this out?", not a decline,
so no suppression). `gidcleveland@gmail.com` is marked `needs_human` since 10-08
but **was answered on 10-16**; the status is stale. That is the same lag the
routine warns about in the other direction, and it is the second time a count
taken from a status field has disagreed with the thread. The thread is the
record.

## 2026-10-26 — a move-leads job blocks creates in the same campaign

New Instantly behaviour, seen in the 06:50 push: after that run queued 33
`/leads/move` calls, a subsequent `/leads` create returned

    409 Conflict — There is a move-leads job in progress. You cannot add or
    remove leads from this campaign until the process is complete.

It cost one push (`sorensoninstallations@gmail.com`, correctly marked `failed`;
`apiCall` fails fast on a non-429 4xx rather than retrying a rejected payload).
The coupling is worth knowing: the more duplicates a run moves out of retired
campaigns, the likelier later creates in that campaign are rejected. It is
self-healing — the row stays ready and the next run takes it — but a morning
with a large move backlog will under-send by about the number of moves.

Unresolved from the same run: `per_angle` reported A4 39 where 35 rows recorded,
and the day's totals still landed exactly on cap (A1 37, A2 125, A4 55, A5 75)
because the budget reads the database rather than trusting the counter. Nothing
in the logs names a cause, every pushed row has a lead id and a `pushed_at`, the
campaign/queue audit is 0/0/0 across 5,388 leads, and the direction is the safe
one — over-counting `used` makes a run stop early. `recordPush` now checks its
writes and the summary carries `live_but_unrecorded`, so if it is a lost write
the next occurrence will say so instead of having to be reconstructed from
timestamps.

## 2026-10-27 — the audience is the binding constraint now, and it is days away

Yesterday's entry put A1+A2+A4 at roughly three and a half days. A day later the
picture is worse than that extrapolation, because the refill is falling as fast
as the inventory.

| angle | ready | cap | days | assigned today |
| --- | --- | --- | --- | --- |
| A4 | 74 | 55 | **1.35** | 21 |
| A2 | 235 | 125 | **1.88** | 87 |
| A1 | 330 | 37 | 8.92 | **0** |
| A5 | 3,871 | 75 | 51.6 | 98 (holdout) |

Unassigned non-suppressed companies: **821**, down from 985 yesterday and
falling ~164 a day against a 292/day burn. `left_unassigned_at_ceiling` is 0 for
A1, A2 and A4 — `assign` is not holding anything back, it cannot find more.

Two series matter more than the snapshot. **A1's daily assignment count** over
the last eight days: 9, 3, 4, 8, 0, 0, 3, **0**. A1 burns 37 a day and is being
fed about one. It is living entirely off a 330-row backlog, so it will keep
hitting cap for about nine days and then stop in a single step rather than
tapering. **`a2_left_close_date_full`**, the pool A2 draws from: 703, 465, 465,
565, 467, 371, 283, **104**. The routine's standing note reads a rise in this
number as "the pool growing, not a fault" — it has now fallen 85% in a week,
which is the same number read the other way and it is the one that matters.

At the last four days' average refill, A4 under-sends its cap in about two days,
A2 in four or five, and A1 in about nine. A5 holds 1,128 generic rows, 15 days
at cap, plus 2,818 holdout that are not for sending. Nothing is broken; the
programme is simply reaching the end of this universe. Acquiring companies is a
decision, so this is measured and not acted on.

## 2026-10-27 — a null error is not a write, which is what yesterday's counter asked

`live_but_unrecorded`, added yesterday to catch a push whose row never landed,
read 0 on all three runs today while A1 counted 20 against 19 recorded rows. The
counter was asking the one question that cannot fail: **an UPDATE that matches
no row is a successful statement.** Verified straight against the project —

    PATCH /assignments?id=eq.<nonexistent>   ->  204, Content-Range: */0
    PATCH /assignments?id=eq.<real row>      ->  204, Content-Range: 0-0/1

so PostgREST reports no error and supabase-js hands back `{error: null}`. The
check was as blind as the dropped error objects it replaced, just louder about
it. The row count is in the same response, costs a header to ask for, and is the
only answer that means "the database now says this person was emailed". A record
is now a match of exactly one, and error and no-match are logged apart because
the causes differ: the database refusing a write, against the row not being
there to write to.

Worth naming the shape, because it is the second instance in two days from the
same hand: **a check whose negative answer is unreachable proves nothing by
staying silent.** The A2 arm classifier defaulted unrecognised copy to `base`,
so the arms always summed and always looked plausible; this counter only ever
saw an error object, so it always read zero. Both were written as guards and
both were decorative. The test for the next one: what exact input makes it fire,
and has that input ever occurred?

The per_angle gap itself is still unexplained — 1 on A1 today, 4 on A4
yesterday. It is not a lost write and not a failed one, every pushed row has a
lead id and a `pushed_at`, the audit is 0/0/0 across 5,680 leads, and the day's
totals land exactly on cap because the budget reads the database. The next
occurrence will now distinguish a no-match from an error, which is the one thing
it could not do before.

## 2026-10-27 — the first reply to a pipeline-built proposal

Of the 17 proposals delivered in-thread on 10-25 and 10-26, **one recipient has
replied**: Dr. Bailey at Music Ministry International, on the Chaplin Priest
Services draft (N0018927QW013, NAVSUP, closes 23 November) —

> Thank you for this information. I am traveling this week for site visits but
> will review it soon and send feedback and questions.

Engaged, no decline, nothing to answer yet. The other 16 are silent after one to
two days, with no bounce, complaint or decline among them. The desk has it as
`needs_human`, which is right — it needs no automated reply.

One methodological note, because it nearly went in this file as "nobody
replied": the first pass of that check read 0 of 17. `sent_at` comes out of
Postgres as `2026-10-25 18:25:37+00`, and appending `Z` to it produces an
invalid date, so every comparison against it was false. A query that answers
"none" deserves the same suspicion as one that answers "all".

## 2026-10-27 — checked and not a fault

Three things that looked like defects and are not, recorded so they are not
re-investigated:

**`Repair KIT, Mechanical Transmi`** went out to a real reader, truncated
mid-word at exactly 30 characters, which looks like a hard cap of ours. It is
not: sam.gov's own title for 70ZU0327Q50201B00 is `REPAIR KIT, MECHANICAL
TRANSMI`, 30 characters, truncated at source. Title lengths across the sent A2
rows are 13, 31, 39, 43, 47, 51, 70, 88 — no cap of ours exists. The 13-length
group of 518 rows is the bare-solicitation-number case, not a truncation.

**Concentration** was 18 of 125 on the top solicitation today, against 45
yesterday. `sol_short` renders as the bare number on 13.6% (17 of 125), back at
its ~14% baseline from 10.4% yesterday; it moves with the mix of solicitations
that carry a usable short title.

**Two non-200s in `job_health`**, both at 19:01–19:02 and both from another
session working by hand: six concurrent `stage` fires, of which one returned a
cold-start `BOOT_ERROR` 503 while five succeeded, and a `signals-boot` probe
that returned its own validation error, `pass ?job=recompetes|opportunities|
awards`. Every scheduled `:22` stage run since is 200. No guarded retry fired
anywhere today.

## 2026-10-27 — Tgha has no biddable notice, and no evidence to widen on

`cam@tgha.co` is the one genuine accept of 10-26 and is in `proposal_accepts`,
but `stage` has reported `no open biddable notice in NAICS` on every run since.
That verdict is correct: NAICS **483212** (inland water passenger
transportation) has **zero** open biddable notices in all of SAM.

Widening to the 4-digit prefix 4832 finds exactly one open and otherwise usable
notice, HTC71127RE117, "Scheduled Fuel Barge Transportation Service in Gulf",
closing 9 November — comfortably past the 10-day floor. It was **not** taken.
4832 freight is not 483212 passenger, and the `search_naics_codes` mechanism
exists to widen on *evidence* from the company itself; Tgha has no domain and no
`site_text`, so there is none. The same reasoning left Eyes On Earth unserved on
10-26 rather than assuming 541620.

What he actually asked for is a **video** ("Sure, please recored a quick
video"), not a proposal, so the pipeline was never the right answer for him. He
needs a human reply.

## 2026-10-28 — A4 runs out tomorrow morning, and the A2 pool is empty

The projection in the 10-27 entry said A4 would under-send its cap "in about two
days". It happens tomorrow.

| angle | 10-26 | 10-27 | **10-28** | cap | assigned today |
| --- | --- | --- | --- | --- | --- |
| A4 | 1.96 | 1.35 | **0.36** (20 ready) | 55 | **1** |
| A2 | 2.19 | 1.88 | **1.38** (173 ready) | 125 | 63 |
| A1 | 9.92 | 8.92 | 7.92 (293 ready) | 37 | **0** |
| A5 | 51.3 | 51.6 | 51.6 | 75 | 71 (holdout) |

**A4 sends 20 of 55 tomorrow** and misses by 35. **`a2_left_close_date_full` is
0** — the pool A2 draws from is exhausted, so its 173 rows are 1.4 days with
nothing behind them. A1 was assigned nothing for the fifth time in nine days and
is coasting on a backlog that ends in about eight. Unassigned non-suppressed
companies: 687, from 821 yesterday and 985 the day before.

The cleanest measure is the `opportunities` job's own `written` count, which is
A2's entire signal supply, one value a day:

    803  780  756  545  645  592  497  382  287  133
    10-19 ------------------------------------> 10-28

Halving roughly every three days. Today's run also reports
`skipped_already_assigned: 6737` of 6,870 companies matched to a live
solicitation — the signals are being found, there is just almost nobody left who
can use one. Every angle's `left_unassigned_at_ceiling` is 0 except A5's, so
nothing is being held back by a ceiling.

Today also brought the first `opportunities` failure in ten days:
`replace_signals(rfp_match): canceling statement due to statement timeout` at
03:00, on 6,870 incoming rows against a 9,755-row rfp_match table. **The guarded
retry fired at 03:08 and succeeded**, which is what it is for, so nothing was
changed. If it recurs the replace needs batching — noting it here so the second
occurrence is recognised as a pattern rather than investigated fresh.

## 2026-10-28 — the 409 was marking good rows terminal

Yesterday's entry recorded Instantly's `409 There is a move-leads job in
progress` as self-healing. That was wrong, and the reason is worth keeping.

The 409 scales with the moves the run makes itself: **33 moves cost 1 create on
10-26, 58 moves cost 6 today.** Each one was written `status = 'failed'`, and
push only ever reads `ready`/`approved`, so a failed row comes back only if
`job_assign` notices it is RETRYABLE *and finds the company a fresh signal*.
That caveat is doing all the work. It rescued the single 10-26 case
(`sorensoninstallations@gmail.com`, failed 10-26, pushed 10-27 06:51) because a
fresh signal still existed then. With `a2_left_close_date_full` at 0 and 687
companies unassigned, it will not rescue today's six.

So a transient 409 now leaves the row `ready` and is counted as
`deferred_still_ready`, separately from `failed` — six deferred contacts should
not read as six broken rows. The six from this morning were restored to `ready`
by hand: each had a null `pushed_at` and null `instantly_lead_id`, and none
appeared in any campaign in the day's audit, so the create was genuinely blocked
rather than half-completed.

The general shape, which is the fourth variant of the recurring bug: **a
recovery path that depends on a resource the system is running out of is not a
recovery path.** It tested fine while signals were plentiful. Nothing about the
409 handling changed between 10-26 and today; what changed was the supply that
made it survivable.

## 2026-10-28 — a clean day for the two counters added this week

First day since the push counters were added where **`per_angle` matches the
database exactly on every angle** — A1 37, A2 125, A4 55, A5 75, with the 07:15
run's `already_pushed_today_before_this_run` agreeing on all four. The gaps were
4 on A4 (10-26) and 1 on A1 (10-27); today, none.

`live_but_unrecorded` read 0, and today that zero carries information, because
since yesterday it requires a match of exactly one row rather than merely a null
error. A zero from a check whose negative answer is reachable is worth something;
the same zero on 10-27 was not.

## 2026-10-28 — one new accept, and his solicitation closes Friday

`mike@eighty2degrees.com` (Eighty2degrees LLC, A2) replied thirteen minutes
after the email, answering "Want me to draft this one?" with

> Yes, I would be interested. Open to exploring this possibility.

An unambiguous accept, and checked against the question it answers rather than
scored on the word "yes" — which is the lesson of 10-26, when two "sure, please
close this out" refusals were classified as accepts. Recorded in
`outreach.proposal_accepts`.

`stage_candidates()` holds him against **the exact solicitation he said yes to**,
140LL027Q0005, DOI, Signage Project for Garnet Hill Recreation Area — which
**closes 30 October**. The 10-day floor applies to the backlog search, not to a
notice the person has explicitly accepted, so the build will proceed. But the
send is manual, so his proposal is worth two days and then nothing.

Still waiting, unchanged: `john@truthintelligence.com` (10-21) is the only
genuinely unanswered `needs_human`; Bill Bailey's 10-27 entry is his engaged "I
will review it soon and send feedback" and needs no reply.
`kparks@kpcinc.com` now carries **two** `drafted` entries and is suppressed —
already on the do-not-send table in `proposal-handovers.md`.

## 2026-10-28 — checked and not a fault

`cdf5678@myctl.net` shows `John Beckett` as its company name on the assignment,
which is the person-name shape that produced the 10-01 "what would get Brenda
Unrein's recompete bid tossed" email. The guard is working: the lead Instantly
actually holds carries `company_name: "your team"`, and the payload's
`companyName` is `"your team"` too. The real name stays on the assignment on
purpose, because that is the record a human reads.

Concentration was 20 of 125 on the top solicitation, and `sol_short` renders as
the bare number on 8.8% (11 of 125), the lowest yet — 13.6% yesterday, 14% on
10-09.

### The number behind all of it: 20 companies of refill, and none for A4

Measured after the entry above, and it reframes the inventory table. Of the 687
unassigned non-suppressed companies, the number holding a **live, usable signal**
is:

| signal | angle | unassigned companies holding one |
| --- | --- | --- |
| `rfp_match` | A2 | **14** |
| `recompete` | A1 | **6** |
| `competitor_award` | A4 | **0** |

A4 holds 1,397 `new` competitor_award signals and not one of them belongs to an
unassigned company. Its scanner confirms there is nothing left to look at —
`naics_state_pairs: 0`, `already_assigned: 10,327`, `written: 0` on every run
today. **A4 has no refill mechanism at all: 20 more sends, then zero**, unless
companies are added or it is pointed at a different signal.

The other 667 unassigned companies hold no live signal. They are not lost — a
signal appears for them when a matching solicitation posts, which is what
`opportunities` does each morning, and today that produced 133. So the
programme's real daily capacity is no longer the 292 of the caps; it is the
`written` count, 133 and halving every three days or so. A5 can still use those
667 directly, because A5 needs no signal.

That is the honest statement of the constraint: the caps describe what the
mailboxes could send, and have stopped describing what the audience can supply.

## 2026-10-29 — the handover handed people a credential that died in an hour

The `c=` parameter in every proposal email is a Supabase magiclink OTP, redeemed
by `OpenProposal.tsx` through `verifyOtp`, and for a first-time lead it is the
only way in. The project's `mailer_otp_exp` was **3600**. So every handover sent
somebody a passcode that stopped working sixty minutes later, and the email said
nothing about expiry at all.

Noel Elman at GearJump is the confirmed case. Draft sent 10-28 13:56, reply
10-28 21:53:

> I still don't understand what this is about (**the link doesn't work
> w/passcode**.) I am on a tight deadline right now. Can we discuss next week?

Eight hours, so the code had been dead for seven of them. `OpenProposal.tsx`
already anticipated this exact failure in its own copy — "It may have expired,
reply to the email and we will send a new one" — but **nothing mints a new
one**. The lead does as instructed, the reply lands in the desk queue as a
question, and the lead stays locked out.

Now 21600, six hours, and the body says so: *"It works for six hours. After
that, reply here and I will send a new one."* Six rather than longer because
the window is a real security property, and a stated six hours the reader can
plan around beats a silent twenty four.

**What this does not tell us is how many others hit it.** The obvious measure,
`auth.users.last_sign_in_at`, is useless here: every value sits a few minutes
*before* its own send, because the pipeline mints a JWT from `lead_user_id` to
call the worker routes, so the column records our own service sign-ins and not
the prospect's. It cannot distinguish a lead who got in from one who never
tried. The 10-28 entry's "16 silent recipients, no declines" therefore stands as
written — silence, cause unknown — and must not be upgraded into "16 people were
locked out", which is what the expiry makes tempting to assume.

### Three copies of one number

`LOGIN_CODE_HOURS` in `proposal-reply.ts`, the prose in the body, and Supabase's
`mailer_otp_exp`. The prose is keyed off the constant through `HOURS_IN_WORDS`,
so the words cannot drift from the digit, and three guards cover the pair: the
body states the declared lifetime, the lifetime is spelled out rather than left
as digits, and the constant stays inside a plausible OTP window. Raising the
constant past the word map fails on the digit leak; removing the sentence fails
all three copy assertions. Both verified.

The third copy is project config and a test cannot read it, so the constant's
comment carries that obligation explicitly. This is the same shape as the A2 arm
classifier and the `live_but_unrecorded` counter: a value that is right until a
second place depends on it.

## 2026-10-29 — the staged login code was stale on all 24 sends

The send mints a fresh OTP, because `generate_link` is what produces the code,
and wrote it only to `proposal_sends`. `staged_proposals.login_code` kept
whatever staging minted hours or days earlier, and `login_sent_at` was never
stamped at all.

    lead                      emailed   staged row   agree
    mike@eighty2degrees.com   133423    143233       no
    noel@gearjumptech.com     512676    773274       no

Every send since the first carried that mismatch. Nothing user-facing read the
column — it is on no admin page — so the exposure was to anyone querying the
database directly to help a lead in, who would have read out a code
`generate_link` had already invalidated. The send now syncs the staged row, and
all 24 existing rows were repaired from `proposal_sends`, which held the truth
the whole time.

## 2026-10-29 — pricing, stated

`$129/month`, 14-day free trial, and the trial is the whole catalogue: every
federal, state and local solicitation matched to the company's NAICS codes.
Recorded here because Nick Athanassov at TechSystems answered a draft offer
with one word, "Price?", and nothing in this repository or the pipeline had an
answer to give him.
