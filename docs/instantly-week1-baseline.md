# Instantly week 1 baseline

The frozen record of the first sending week, captured before any copy changed.
Everything here is the control arm. When week 2 copy is measured against it,
this file and `data/instantly-baseline-week1.json` are what it is measured
against.

Window: **2026-09-07 (Mon) to 2026-09-11 (Fri)**, five sending days.
Snapshot: `data/instantly-baseline-week1.json`, captured 2026-09-12.

Regenerate or extend with:

```bash
node scripts/outreach/instantly-baseline.mjs --label week1 --from 2026-09-07 --to 2026-09-11
node scripts/outreach/instantly-baseline.mjs --show week1
node scripts/outreach/instantly-baseline.mjs --compare week1 week2
```

## Results

| Campaign | Contacted | Sent | Bounced | Replies | Positive | Reply % |
|---|---|---|---|---|---|---|
| A serial_bidder | 200 | 280 | 0 | 2 | 0 | 1.0% |
| B new_prime | 100 | 137 | 0 | 5 | 0 | **5.0%** |
| C registered_no_awards | 100 | 139 | 1 | 3 | 0 | 3.0% |
| C1 creators | 16 | 16 | 1 | 0 | 0 | 0% |
| C2 podcasts | 5 | 5 | 0 | 0 | 0 | 0% |
| C3 media | 8 | 8 | 0 | 0 | 0 | 0% |
| C4 consultants | 20 | 20 | 1 | 0 | 0 | 0% |
| C5 APEX | 16 | 16 | 0 | 0 | 0 | 0% |
| C6 associations | 6 | 6 | 0 | 0 | 0 | 0% |
| **Total** | **471** | **627** | **3** | **10** | **0** | **2.12%** |

Daily shape:

| | Mon | Tue | Wed | Thu | Fri |
|---|---|---|---|---|---|
| Sent | 80 | 100 | 100 | 176 | 171 |
| First touch | 80 | 100 | 100 | 98 | 93 |
| Follow-up | 0 | 0 | 0 | 78 | 78 |
| Replies | 2 | 0 | 2 | 5 | 1 |

**The headline number is zero.** 471 first touches, 0 positive replies, 0
meetings, 0 opportunities. Every one of the 10 human replies was a rejection,
and 8 of the 10 were a single word.

Deliverability was never the problem: 3 bounces on 471 contacted is 0.64%
against a 2% gate, with no unsubscribes and no complaints, on domains 32 to 36
days old running 170 sends a day by Friday.

## Why reply rate is computed on contacted, not sent

Sends include follow-up steps. Once a sequence rolls out, the sent count climbs
against a fixed set of humans, so a rate computed on sends falls week over week
for reasons that have nothing to do with the copy. Every rate in the snapshot
and in this file is over `contacted` (unique leads that got a first touch).
Week 2 must use the same denominator or the comparison is meaningless. The
snapshot file carries these definitions inline so a later reader does not have
to reconstruct them.

## Three findings that shaped the week 2 changes

### 1. The opt-out line is the most answered call to action in the programme

Every email carries `Reply "no" and I will not reach out again.` All ten replies
were that word or a close variant. The notice is required in every commercial
message (CAN-SPAM 15 USC 7704(a)(5)(A)(ii)) and is not removable, but in week 1
it sat directly beneath the CTA, where it competed with the ask and won every
time. It is also cheaper to answer than any real CTA, and with `stop_on_reply`
and `stop_for_company` both true, one person's reflex permanently burns every
contact at that company. Ten companies were spent this way for zero information.

### 2. Two of the three Wave 1 segments were sent a premise that does not describe them

Firmographics pulled from the live lead payloads:

| | A serial_bidder | B new_prime | C registered_no_awards |
|---|---|---|---|
| Median obligated | $13,185,030 | $695,935 | $1,088,211 |
| Max obligated | $658M | $224M | **$1.84B** |
| Share at or above $1M | 90.6% | 43.2% | 51.0% |
| new_awards | 3 to 10 | 1 to 2 | 0 |
| last_award_date | 2026-02 to 2026-08 | 2026-04 to 2026-08 | **2023-04 to 2023-08** |

**C is the worst mismatch.** "registered_no_awards" means no award in the recent
window, not no award ever. Half of C has over $1M in federal obligations, one
lead has $1.84B, and every one has a real award history ending around 2023.
These are lapsed contractors. Week 1 copy told them "what stops most firms from
their first win" and offered to help them "submit like a big one without a
proposal shop". One C recipient with $7.2M in obligations replied "NO" in
capitals.

**A is mismatched more quietly.** Median $13.2M obligated and 3 to 10 awards
this year. These firms are winning. The copy opened on small primes losing
winnable bids on compliance technicalities, which is not their experience, and A
returned the lowest reply rate of the three at 1.0%.

**B is the only segment whose premise was true**, and it returned the highest
reply rate at 5.0%. Tested against A and C pooled (5/100 against 5/300), that
concentration is real rather than noise.

The generalisable finding: **reply rate tracked premise accuracy, not tone.**

One caveat to carry forward: C's award dates sit in a tight 2023 band exactly
three years before A and B's. That is either genuine dormancy or an artifact in
the source pipeline, and it is worth confirming against USAspending before week
2 copy leans on the re-engagement angle.

### 3. Role inboxes predicted bounces better than catch-all did

All three bounces, with their MillionVerifier verdicts from 2026-09-03:

| Address | Verdict | Role |
|---|---|---|
| `partnerships@govcongiants.com` (C1) | catch_all / risky | yes |
| `info@fedcon.com` (C4) | ok / good | yes |
| `clint@mountfarmdrainage.com` (C) | ok / good | no |

Two of three were role addresses; only one was the catch-all the verification
flagged as risky. Two carried a clean `ok / good` verdict and bounced anyway,
seven days after being checked, which puts a short shelf life on a clean
verdict. On n=3 none of this is conclusive, but it does not support treating
catch-all density as the main bounce driver. The influencer list carries 49 role
addresses across 216, which is the exposure to watch rather than the 30
catch-alls.

## What was not measurable, and still is not

`open_tracking` and `link_tracking` are false on all nine campaigns, so there is
no open rate and no click rate in this baseline and none will exist in week 2
either. With zero positives, the programme cannot currently distinguish "not
read" from "read and rejected", and those need opposite fixes.

The one placement evidence available is indirect: five out-of-office replies
arrived from real firms, which means those messages reached real inboxes.
Combined with a 0.64% bounce rate it is reasonable to believe placement is not
catastrophic, but that is inference, not measurement.

The clean way to close this without putting a pixel in a prospect email is a
seed placement test. Every wave 1 mailbox carries
`inbox_placement_test_limit: 5`. If a seed test returns 90% or better to the
primary inbox, placement is ruled out and every remaining question is about the
message.

## Comparing week 2 against this

`--compare` exists so the comparison cannot quietly become invalid:

```bash
node scripts/outreach/instantly-baseline.mjs --label week2 --from 2026-09-14 --to 2026-09-18
node scripts/outreach/instantly-baseline.mjs --compare week1 week2
```

It prints a "copy changed" column per campaign, derived from a sha256 of each
live sequence step read back from the API rather than from this repo. That
matters for two reasons. A delta with **no** copy change is not a copy result,
it is the same message in a different week. And reading the hash from the API
catches copy edited here but never synced, which has already happened once on
this programme (the opt-out drift recorded in `instantly-influencer.mjs`).

Three confounds are unavoidable and should be stated whenever week 2 is quoted:

1. **Volume is not held constant.** A and C first-touch caps drop for week 2 so
   the new copy is validated before the rest of the list is spent. Fewer
   contacts means wider confidence intervals, not a worse message.
2. **Domain age moves.** The sending domains are a week older in week 2, which
   independently helps placement.
3. **List order is not randomised.** Leads are contacted in a fixed order, so
   week 2 draws from a different part of each list than week 1 did.

None of these is fatal at this stage, because the week 1 positive rate is
exactly zero and any positive result in week 2 is a signal rather than a
percentage-point difference to defend. They become important as soon as the
comparison is between two non-zero rates.

The honest sample-size note: at 471 contacts and a true 1% positive rate, week 1
would have returned zero about 1% of the time, so zero positives is already
weak evidence against the week 1 message rather than bad luck. But
distinguishing a 1% positive rate from a 2% one needs a few thousand contacts
per arm, which this programme will not have for a month. Week 2 can tell you
whether positives exist at all. It cannot rank two copy variants finely, and it
should not be asked to.

## The better experiment, when there is budget for it

Week over week is a sequential comparison and carries every confound above. A
concurrent test is strictly better and the machinery is already present:
`instantly-wave1.mjs` builds step 1 with real Instantly variants
(`auto_variant_select` is null, so nothing auto-promotes), and today those
variants differ only by subject line while sharing one body.

Pointing two variants at two different **bodies** inside one campaign gives a
randomised concurrent A/B on the same list, the same week, the same domains.
That removes all three confounds at once. It was not done for week 2 because
week 1 produced no positives at all, so the first job is to find out whether any
message in this space produces one, not to split a zero two ways.
