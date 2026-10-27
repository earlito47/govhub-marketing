# Proposal handovers sent via Instantly

**If you run the reply desk: read this before sending a drafted reply to anyone
listed below. They have already had a reply from us today.**

A second pipeline, in `strata-parse`, now answers accepts by building the lead a
first-draft proposal and replying **in their existing Instantly thread**, from
the mailbox that received their message. It uses `POST /emails/reply`, the same
transport the reply desk uses, so these are ordinary in-thread replies and look
like nothing new to the prospect.

This file exists so that is not invisible from this side.

## Where the authoritative record lives

`outreach.proposal_sends` in the strata-parse Supabase project, one row per
handover, keyed `(company_id, notice_id)`:

```sql
select c.email, c.company_name, ps.sent_at, ps.eaccount, ps.instantly_email_id
from outreach.proposal_sends ps
join outreach.companies c on c.id = ps.company_id
where ps.retracted_at is null
order by ps.sent_at desc;
```

Each row also carries `body` -- the exact text the person received, recovered
from what was delivered rather than recomposed -- plus the login link and its
fallback code, so "the link did not work" is answerable from the row.

## THE SHARED SOURCE OF TRUTH IS THE THREAD, NOT EITHER DATABASE

The two pipelines keep their state in different places: the reply desk in
`data/reply-desk.json`, the proposal side in `outreach.proposal_sends`. Neither
can read the other at runtime -- one is a file in this repository, the other is
a table an Edge Function talks to.

What both CAN read is the Instantly thread. So the thread is the coordination
point, and the proposal sender already treats it that way: before every send it
reads `GET /emails?lead=<address>` and skips the lead if any message in the
thread already carries an `/open-proposal` link. That check was verified by
deleting the `proposal_sends` row and confirming the thread alone still stopped
a resend.

**The reciprocal check for the reply desk is the same one.** A lead whose thread
already contains an `app.govhub.online/open-proposal` link has had today's
answer. Sending a drafted reply on top of it means two emails from Earl in one
day, and the reply desk's own transport note is the reason that matters: "a
prospect who gets the same reply twice has learned exactly what we do not want
them to learn."

## Sent so far

| lead | company | solicitation | sent | from mailbox | Instantly email id |
|---|---|---|---|---|---|
| `stengesdal@baosystems.com` | Bao Systems LLC | Enterprise Cloud Support Services (N0018926RL011) | 2026-10-25 02:47 UTC | `earl@govhubcapture.com` | `01a170f4-5ded-733d-8095-7aebc34b114b` |
| `brandon.bcelectric@gmail.com` | B & C Electric Solutions, L.l.c | T--NHOTIC AV SYSTEM REPLACEMENT (140L4326Q0126) | 2026-10-25 18:25 UTC | `earl.knight@govhubprocurement.com` | `01a1744f-9090-7ae1-93d3-0258b57279d5` |
| `bill.bailey@musicministryintl.com` | Music Ministry International Inc | Chaplin Priest Services (N0018927QW013) | 2026-10-25 18:25 UTC | `e.knight@buildwithgovhub.com` | `01a1744f-9bd3-7a73-bf65-fb84c9015d68` |
| `thomas.showman@gmail.com` | Terra Umbris Legal And Land Services, LLC | Recovery Worldwide BPA (83310127Q0007) | 2026-10-25 18:25 UTC | `e.knight@trygovhub.com` | `01a1744f-a1e7-763a-8047-21bd9cdbfd3f` |
| `setapart.excavatingservices@gmail.com` | Set-Apart Excavating & Services, LLC | Y--Hickman Wildlife Water Catchment and Pipe Fence (140L1726Q0054) | 2026-10-25 19:45 UTC | `earl.knight@trygovhub.com` | `01a17499-1edc-7b6a-aae5-dbcc81b04be2` |
| `creid@chpsolutionstoday.com` | Chp Solutions LLC | Scaffolding for Repair and Repoint Chalmette Monum (140D0427Q0915) | 2026-10-25 19:45 UTC | `earl@govhubprocurement.com` | `01a17499-2bc0-7492-b076-4b64a04d0c4d` |
| `precisionsepticandpumping@gmail.com` | Precision Septic And Pumping Services, LLC | Septic Toilet Pumping for Chippewa National Forest (12444527Q0003) | 2026-10-25 19:45 UTC | `e.knight@getgovhub.com` | `01a17499-311a-76cd-9159-50befa5db4e4` |
| `beni@monacomech.com` | Monaco Mechanical, Inc. | J041--Condenser Coils Replacement for the VA Illiana He... (36C25227Q0051) | 2026-10-25 19:46 UTC | `earl.knight@getgovhub.com` | `01a17499-35f0-70a4-b73c-6a877ca9a005` |
| `ads81460@gmail.com` | Certified Surface Inspections LLC | USAG Pressure Washing (W91247-27-Q-A001) | 2026-10-25 19:46 UTC | `earl.knight@trygovhub.com` | `01a17499-3da9-7145-95b5-03359fb26e1a` |
| `dporter@staffingetc.net` | D.h. Porter Enterprises, LLC | ISBEE Solicitation: Firm-Fixed-Price (FFP), non-persona... (75H70627R00005 ) | 2026-10-25 19:46 UTC | `j.k@bidwithgovhub.com` | `01a17499-42d7-7609-8f6b-77e767e29d07` |
| `jwilder@stericert.com` | H & W Technology, LLC | Monitoring and Evaluation of Russian River Coho Salmon  (W912P727QA002) | 2026-10-25 19:46 UTC | `earl.knight@govhubproposal.com` | `01a17499-4b89-7c6c-aefd-495addac0ad2` |
| `anthony@wr-cinc.com` | Williams Roofing & Construction Inc | Fenn Ranger Station roofing replacement (1240LU26Q0130) | 2026-10-25 19:46 UTC | `earl@govhubrfp.com` | `01a17499-aee3-7a62-bab5-c84544c2a173` |
| `gcthornton@gmail.com` | 310 Buncombe LLC | General Services Administration (GSA) seeks to lease Wa... (4WA0688) | 2026-10-25 19:46 UTC | `earl@govhubproposal.com` | `01a17499-bb43-71ac-b7d8-7b7390b29870` |
| `dave@strongholdcare.com` | The Stronghold Group LLC | USNS CODY (T-EPF 14) - Eye Wash Stations (N3220527Q7011) | 2026-10-25 19:46 UTC | `earl@buildwithgovhub.com` | `01a17499-bf7c-7c5d-83e8-e109e452c57d` |
| `jjaqkcon@gmail.com` | J Jaqk Construction LLC | 9 RW Linen Services ( FA468627QS002) | 2026-10-26 14:43 UTC | `earl.knight@govhubbids.com` | `01a178aa-52b1-7e88-94d9-1dd72236895f` |
| `kurt.marisa@human-domain.com` | Human Domain Solutions, LLC | NNSY FY27 DOT/NRC RAD WASTE TRAINING (N4215827QE002) | 2026-10-26 14:43 UTC | `e.knight@getgovhub.com` | `01a178aa-58cd-7de7-bcd1-e4e8d991de16` |
| `andrew.pregl@pregl.com` | Pregl Services Inc | Preventative Maintenance Gas Detection System (Re-Bid) (N6852026Q1069) | 2026-10-26 14:43 UTC | `e.knight@govhubhq.com` | `01a178aa-5d80-79d6-8966-f042b9564d4b` |
Each carries a link to a built proposal package for that solicitation, and for
the A2 leads the disqualifier list they asked for, quoted from the solicitation
with page numbers.

## What is coming

All seventeen servable accepts have now been answered. The two that were briefly
held -- H & W Technology and The Stronghold Group, where the NAICS match found
work the firm probably does not do -- were released on Earl's instruction and
sent, on the reasoning that the copy already says we picked the solicitation and
invites the correction.

ONE of the eighteen accepts remains unserved: Eyes On Earth Inc. Its registered
NAICS 813312 is "Environment, Conservation and Wildlife Organizations" and holds
exactly one biddable notice in all of SAM, which is closed. Widening it would
mean guessing their business rather than reading it -- their website is a
JavaScript shell whose only text is the page title, and SAM's unauthenticated
entity index returns no NAICS -- so it has deliberately not been guessed. They
are the ONLY accept where sending a drafted reply from this repository would not
duplicate something.

Three others were rescued after the first round: J Jaqk Construction and Human
Domain Solutions once the close-date floor was dropped, and Pregl Services by
searching NAICS 811310 (machinery repair) alongside their registered 333994,
on the evidence of their own homepage title, "Repair & Parts for Vacuum
Furnaces, Hot Zones, and Control Systems".

The hold mechanism remains in `outreach.staged_proposals.send_hold_at`, with a
reason and who set it, and excludes a lead from both the send queue and the
build queue.

## Not written from this side

Nothing in this repository has been changed by the proposal pipeline.
`data/reply-desk.json` and the scripts and pages around it are read-only to it,
and that includes its own classifications: the accept sync copies them into
`outreach.proposal_accepts` and records that the judgement was the reply desk's
MODEL classification, not a human read, because the provisioning gate exists
precisely so a model flag cannot create an account on its own.

## Suppressed people who still hold a live draft — do not send these

Added 2026-10-27. These addresses are suppressed in `outreach.companies`
(`suppressed = true`, with a reason and date on the row) and still appear as
`drafted` in `data/reply-desk.json`. Sending their drafts would email somebody
who asked us to stop, or who was suppressed for another reason. Suppression is
always on **that person's row only** — never the company, and in each case here
no colleague is affected.

| address | campaign | why suppressed |
| --- | --- | --- |
| `chris.dcouto@agnisemi.ai` | A5 | Answered our "Want me to close this out?" with "Sure. Please close this out." Model scored it `accept` on the word "Sure". |
| `luke.cawleythd@gmail.com` | A2 | Answered the same question with "Yes - close it please, we do not provide Boiler services." Scored `accept` on "Yes". |
| `kparks@kpcinc.com` | C1 | Suppressed before this pipeline existed; a fresh `drafted` entry appeared 2026-10-27. Reason is on the company row. |

The first two are the reason `sync-proposal-accepts.mjs` prints the quote and
writes nothing without `--apply`: both were classified as accepts and would
have had an account provisioned and a proposal emailed. The pattern to watch
for is agreement with our own closing question — "sure", "yes", "please do" —
which reads as interest to a classifier and is a refusal in the thread.

The authoritative check before sending any draft is the `suppressed` column,
not this list: it is a snapshot of one day. A suppressed company is also
refused by the accept sync and by the push job's last gate, so this table is
the only place the desk would not otherwise see it.
