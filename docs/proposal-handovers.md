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
| `beni@monacomech.com` | Monaco Mechanical, Inc. | J041--Condenser Coils Replacement for the VA Illiana Heal... (36C25227Q0051) | 2026-10-25 19:46 UTC | `earl.knight@getgovhub.com` | `01a17499-35f0-70a4-b73c-6a877ca9a005` |
| `ads81460@gmail.com` | Certified Surface Inspections LLC | USAG Pressure Washing (W91247-27-Q-A001) | 2026-10-25 19:46 UTC | `earl.knight@trygovhub.com` | `01a17499-3da9-7145-95b5-03359fb26e1a` |
| `dporter@staffingetc.net` | D.h. Porter Enterprises, LLC | ISBEE Solicitation: Firm-Fixed-Price (FFP), non-personal ... (75H70627R00005 ) | 2026-10-25 19:46 UTC | `j.k@bidwithgovhub.com` | `01a17499-42d7-7609-8f6b-77e767e29d07` |
| `jwilder@stericert.com` | H & W Technology, LLC | Monitoring and Evaluation of Russian River Coho Salmon  (W912P727QA002) | 2026-10-25 19:46 UTC | `earl.knight@govhubproposal.com` | `01a17499-4b89-7c6c-aefd-495addac0ad2` |
| `anthony@wr-cinc.com` | Williams Roofing & Construction Inc | Fenn Ranger Station roofing replacement (1240LU26Q0130) | 2026-10-25 19:46 UTC | `earl@govhubrfp.com` | `01a17499-aee3-7a62-bab5-c84544c2a173` |
| `gcthornton@gmail.com` | 310 Buncombe LLC | General Services Administration (GSA) seeks to lease Ware... (4WA0688) | 2026-10-25 19:46 UTC | `earl@govhubproposal.com` | `01a17499-bb43-71ac-b7d8-7b7390b29870` |
| `dave@strongholdcare.com` | The Stronghold Group LLC | USNS CODY (T-EPF 14) - Eye Wash Stations (N3220527Q7011) | 2026-10-25 19:46 UTC | `earl@buildwithgovhub.com` | `01a17499-bf7c-7c5d-83e8-e109e452c57d` |
Each carries a link to a built proposal package for that solicitation, and for
the A2 leads the disqualifier list they asked for, quoted from the solicitation
with page numbers.

## What is coming

All fourteen servable accepts have now been answered. The two that were briefly
held -- H & W Technology and The Stronghold Group, where the NAICS match found
work the firm probably does not do -- were released on Earl's instruction and
sent, on the reasoning that the copy already says we picked the solicitation and
invites the correction.

Four of the eighteen accepts cannot be served at all: every biddable notice in
their NAICS closes too soon to be worth handing anyone (Pregl Services 333994,
J Jaqk Construction 812332, Human Domain Solutions 611430, Eyes On Earth
813312). They have had no reply from this pipeline.

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
