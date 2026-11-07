# B-line launch runbook

The B-line is two Instantly campaigns, `GH-B4-CompetitorWon` and
`GH-B2-MatchedRFP`, built on the two angles that earn positive replies (A4
0.66%, A2 0.61% real positive per person). They are fed by a fresh audience
pulled with the recipe that built the original pool. Copy, rules and evidence
are in `scripts/outreach/instantly-bline.mjs`; the variables are rendered in
strata-parse `supabase/functions/_shared/bline.ts`.

Nothing sends until step 6. Every step before it can be undone.

## 0. Audience (done 2026-11-04 to 11-07)

| Step | Script | Result |
|---|---|---|
| Pull USASpending small-business recipients, 24 months, $50K-$5M; SBA profiles | `scripts/leadgen/pull_universe.py` | 13,509 new contacts into `public.prospect_pool` |
| MillionVerifier | `scripts/leadgen/verify_pool.py` | 9,866 ok (73%) |
| Old pool's unsent contacts (never emailed, plus those over $5M) | `scripts/leadgen/old_pool_bline.py` | 6,626, re-verified with `--recheck-since 2026-11-01` |

The "ok" CSVs hold PII and are not committed.

## 1. Deploy the pipeline change (strata-parse)

Merging the B-line PR runs migration `20261107190000_bline_angles.sql`. It:
- adds `outreach.companies.line`;
- allows B2/B4 in `assignments.angle`;
- seeds `campaign_ids` for both drafts;
- sets `daily_caps` B4 = B2 = **0**;
- adds `no_push_dates`.

The merge also redeploys `outreach-assign` and `outreach-push`. With the caps
at 0, nothing is assigned or pushed.

## 2. Load the audience

```bash
python scripts/leadgen/load_bline.py --csv verified.csv --csv old_verified.csv --dry-run
python scripts/leadgen/load_bline.py --csv verified.csv --csv old_verified.csv
```

What the loader does:
- **Refuses to run until step 1 is live.** A B company loaded under the old assign job would be given an A angle the next morning.
- **Fresh contacts** are inserted with `line = 'B'`.
- **Old-pool companies** are switched to `line = 'B'`. Their queued A5 rows are marked `dropped_stale`, so the assign job re-assigns them as B4/B2.

## 3. Let signals build (about a week before launch)

B companies are unassigned, so the signal jobs scan them:
- **opportunities** (nightly) matches their NAICS to open SAM solicitations.
- **outreach-fit** (40 a run) judges each match. B2 only uses fit or plausible.
- **awards** (4 a day, about 40 NAICS-and-state pairs a run) finds competitor wins for B4.

Watch supply:

```sql
select s.kind, count(*) from outreach.signals s join outreach.companies c on c.id = s.company_id
 where c.line = 'B' and s.status in ('new','approved') and s.valid_until >= current_date group by 1;
```

## 4. Mailboxes

Attach mailboxes to the two campaigns in Instantly. A5 (retired 11-04) frees
12 boxes as its in-flight sequences finish, and A2/A4 free theirs as they
drain. Keep 25/day per box. At 3 steps, a campaign settles at about 3x its
new-lead rate: 9 boxes (225/day) carry 75 new a day, and 12 boxes (300/day)
carry 100.

## 5. Before the first send

- Run a seed-inbox placement test on email 2. It is the one step with a link,
  and contractors often sit behind Mimecast, Proofpoint or strict M365.
- Check BidNet's national price by hand, since the 25% arm quotes it ($1,999/yr).
- Re-verify anything verified more than 30 days before its push date:
  `verify_pool.py --recheck-since <date>`.

## 6. Launch

```sql
update outreach.config set value = value || '{"B4": 75, "B2": 100}'::jsonb, updated_at = now()
 where key = 'daily_caps';
```

Then set each campaign's `daily_max_leads` to its cap and `daily_limit` to
3x the cap, and activate both in Instantly. The next 05:00 assign fills the
queues, and the 06:00 push loads the leads.

## Replies

- The reply desk maps both campaigns (`reply-desk/playbooks.mjs`). B4 uses A4's "next three" builder, and B2 uses A2's disqualifier-list builder.
- A bare "send" is classified as an accept by rule, unless the reply also asks a question.
- Accepts go through the existing `sync-proposal-accepts` -> stage -> advance -> handover path.
