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
