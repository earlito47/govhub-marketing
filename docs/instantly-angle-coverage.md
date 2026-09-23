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
