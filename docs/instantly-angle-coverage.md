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
| ...matching the B profile ($100K–1M obligations, 1–2 awards) | **2,405** | **−10,663** |
| ...loaded and unsuppressed in `outreach.companies` | **2,385** | −20 |

**The B-profile gate removes 82% of the reachable pool — far more than any
angle's coverage gap.** Of the 13,068 deliverable, never-contacted contacts,
7,120 sit *above* the band (>$1M obligations) and 2,104 below it. Widening the
profile is a much bigger lever on reach than anything in the sections below,
and the runbook deferred it deliberately rather than by accident.

Every coverage figure that follows is against the 2,385 currently loaded.

---

## 2. Coverage per angle, measured

| Angle | Signal | Coverage | How measured | External dependency |
|---|---|---:|---|---|
| **A2** Matched RFP | live solicitation in your NAICS closing in 8–21 days | **66.0%** (1,574 / 2,385) | full census, every company tested against every solicitation | **none** — free public CSV, no key, no quota |
| **A4** Competitor won | award ≤45 days old in your NAICS + state | **44.4%** (79 / 178 scanned) | sample, ±7pp | USASpending API, no key, ~55 calls per run |
| **A1** Recompete | your own contract ending 60–150 days out | **13.4%** (16 / 119 scanned) | sample, ±6pp | USASpending API, no key, ~59 calls per run |
| **A3** SAM expiry | registration lapsing in 14–75 days | **0%** | blocked before any measurement | **SAM.gov key — both keys failing** |
| **A5** Generic | none | remainder | | none |

### A2 is the one that carries the system

One streaming pass over SAM's daily Contract Opportunities extract (236 MB,
83,926 records) matched 1,574 of 2,385 companies. No API key, no quota, no
per-company call — the entire universe is covered in a single ~3-minute run.

It is also genuinely personalized rather than nominally so: 172 distinct
solicitations were cited across those companies, a mean of 9.2 companies per
solicitation. Two companies get the same RFP named only when they are direct
competitors in the same NAICS, where the claim is equally true of both.

The same NAICS codes cover **65.4% of the wider 13,068-contact pool** (8,548
contacts), so A2's coverage is a property of the NAICS mix, not of this
particular 2,385. It generalizes if the audience widens.

**Caveat — A2's stock is a flow, not a reservoir.** 954 of today's 1,577
eligible companies are keyed to solicitations closing 1–2 October, which leave
the 8-day buffer within three days. The stock is refilled nightly from new
postings, but "1,577 ready" is today's reading, not a balance.

### A3 is dead until a key works

```
SAM_API_KEY      → 401  {"code":"900901","message":"Invalid Credentials"}
SAM_GOV_API_KEY  → 429  {"code":"900804","message":"Message throttled out"}
```

`SAM_API_KEY` is rejected outright. `SAM_GOV_API_KEY` is valid but its daily
quota is already spent — it is shared with the user-facing `company-lookup`
feature, which has first claim on it. A3 needs a third key, dedicated to
outreach, or it stays at zero.

---

## 3. Projected steady-state mix

The assigner's priority is A1 > A3 > A2 > A4 > A5, so a company with several
signals takes the most specific one. That makes each angle's *marginal*
contribution, not its standalone rate, the number that matters — and the angles
are not independent.

**A4 overlaps A2 almost completely.** Of the 79 companies with a competitor
award, 69 (87%) also have a matched RFP; of the 99 without one, only 50 (51%)
do. A4-eligible firms are the same firms A2 already reaches, which stands to
reason: both angles key off an active NAICS. A1 shows no such correlation — 69%
of its hits also carry an A2 signal against 71% of its misses, which is nothing.

| Angle | Standalone rate | Marginal after higher priority | Share |
|---|---:|---:|---:|
| A1 Recompete | 13.4% | 320 | 13% |
| A3 SAM expiry | 0% | 0 | 0% |
| A2 Matched RFP | 66.0% | 1,363 | 57% |
| A4 Competitor won | 44.4% | **119** | 5% |
| A5 Generic | — | 583 | 24% |
| **Personalized** | | **1,802** | **76%** |

**A4's 44% standalone rate is worth 5% of incremental reach.** It is also the
most expensive angle to run: ~1,550 API calls and roughly two weeks of nightly
scanning to complete a pass, for 119 companies A2 would not already have
covered. Run A4 because its *message* may beat A2's, not to extend coverage —
for reach it barely earns its keep.

Half of the A2-eligible are coin-flipped into A5 with `holdout = true` — that is
the experiment, and it is why the live A2 share will read lower than 57% until
the test concludes.

**Currently 1,629 of 2,385 (68%) already carry a signal**, with A1 and A4 only
5% and 12% scanned. The rest arrives as the scanners walk the list.

---

## 4. Coverage is not the constraint. Sending capacity is.

Daily caps are A1 10, A2 10, A3 10, A4 10, A5 15 — 55/day, or 45/day with A3 at
zero. Against 2,385 companies that is **53 working days, about 11 weeks**.

A2 alone has 1,577 companies ready against a cap of 10/day: **158 days of
backlog from one angle**. Even if its supply halved it would still be 78× the
rate at which it can be consumed.

So the honest framing is not "do we have enough coverage" — coverage exceeds
capacity by roughly 35×. It is "which angle do we want the 45 daily slots spent
on", which is exactly what the A2-versus-holdout test is designed to answer.

---

## 5. Scanner throughput

Both per-company angles are time-boxed to ~110 seconds per invocation:

| Job | Per run | Full pass at 1 run/day | At hourly |
|---|---:|---:|---:|
| A1 recompetes | ~59 companies | 40 days | ~1.7 days |
| A4 awards | ~55 API calls / ~178 companies | ~14 days | ~14 hours |
| A2 opportunities | all 2,385 | 1 day | — |

A4 covers 3.2 companies per API call on the clustered pairs it has reached so
far, but 77% of the 1,550 NAICS+state pairs are singletons, so the rate will
fall toward 1:1 as it works into the tail.

Raising the cron from nightly to hourly is the cheapest way to finish a first
full pass; nothing else needs to change.

---

## 6. Recommendation

1. **Run it.** A2 alone justifies the system: 66% coverage, no key, no quota,
   one run, and 158 days of backlog against its own send cap.
2. **Do not make the emails more generic.** A5 already *is* the generic arm, and
   half the A2-eligible population is being routed to it as a controlled
   holdout. Making the personalized angles generic would delete the experiment
   before it returns a result.
3. **Stop waiting on A3.** It needs its own SAM key. Until then it is 0% and
   its 10 daily slots are dead capacity — reallocate them to A2.
4. **Keep A1 despite the 13%.** Its coverage is low but it is *uncorrelated*
   with A2, so all 320 companies are reach A2 would not have delivered. It only
   has to fill 10 slots a day, so 320 is 32 days of supply. Low coverage is not
   low value when the cap is the binding constraint.
5. **Treat A4 as a copy test, not a coverage play.** 87% of the companies it
   reaches are already reachable by A2, so it adds ~119 companies for ~1,550 API
   calls. Worth running to see whether "a competitor just won" outperforms "here
   is a live RFP" — not worth running for reach.
6. **If reach is the goal, widen the profile, not the angles.** The B-profile
   gate costs 10,663 contacts; the worst angle gap costs a few hundred.

---

## 7. What this measurement fixed

The first attempt at these numbers was unreconcilable — 28% of companies had an
A2 signal, yet 68% of the first 800 assigned were A2-eligible. Chasing that
contradiction surfaced five defects, none of which threw an error:

- **PostgREST `max_rows` truncation, four separate places.** The opportunities
  NAICS index was built from the first 1,000 of 2,385 companies, which is the
  whole 28%-versus-66% gap. `job_assign` would have reported "nothing
  unassigned" while 1,385 companies sat untouched, the moment 1,000 were
  assigned.
- **The A1 and A4 scanners never advanced.** Their only memory of "done" was
  "carries a live signal", so a company scanned and found to have nothing came
  back in the next batch forever. At a 13% hit rate the cursor moved 16
  companies per run instead of 119 — roughly 200 nights to walk the universe.
- **Unbounded bulk writes.** Deleting 1,556 companies' old signals in one
  `.in()` is a 57 KB request line; the worker died with `WORKER_RESOURCE_LIMIT`
  while the identical dry run passed.

All are fixed, deployed and verified by re-running. The measurements above are
from the fixed code.
