# GovCon influencer and partner outreach

Six Instantly campaigns against the GovCon influencer, media and partner
database. **Created in Instantly, Draft, zero leads, nothing sending.** The
mailbox decision that used to block `--sync` is made (see §2 below for the
governhub.online gap this surfaced) and the campaigns are live in the
workspace:

| Campaign | Instantly ID |
|---|---|
| C1 creators | `6f360a2e-4dee-4d75-8bd5-325162795616` |
| C2 podcasts and newsletters | `1d2dc5a8-f7c1-4ac1-ac1a-3a382e185b4a` |
| C3 media and blogs | `b2ee3665-fbee-4366-b2ee-d31cc0573e8e` |
| C4 consultants | `b179df62-09f5-4045-a3e6-eb19afab4d20` |
| C5 APEX advisors | `aceddf26-388d-45f4-be83-89eda98816a9` |
| C6 associations | `80a9659f-ba43-4411-969f-10ecfcd6b95d` |

What is still not done: no leads are uploaded, no campaign is started. That
is deliberate and gated on the "Before importing" checklist below, the 39 P1
openers chief among them. Re-running `--sync` after any future copy edit
updates these same campaigns in place (matched by name) rather than creating
duplicates.

| | |
|---|---|
| Database | `data/govcon-influencer-outreach.json`, 294 contacts, two research batches |
| Deliverability | all 216 addresses verified via MillionVerifier, verdicts in `data/email-verification.json` |
| Sendable after hygiene and verification | **94**, across six campaigns (70 confirmed deliverable, 24 catch-all) |
| Total sends if all four steps run | 376, over roughly five weeks |
| Sequence copy | `scripts/outreach/instantly-influencer.mjs` |
| List hygiene and lead export | `scripts/outreach/influencer-db.mjs` |
| Source rebuild | `scripts/outreach/build_influencer_db.py` (combines `parse_influencer_pdf.py` and `parse_expansion_xlsx.py`) |

```bash
npm run influencers            # what is in the list and what is held back
npm run influencers:check      # assert the export guarantees hold
npm run influencers:export     # per-campaign CSVs for Instantly import
npm run influencers:campaigns  # guardrail the sequence copy, no API calls

node scripts/outreach/instantly-influencer.mjs --sync    # create or update, never activates
node scripts/outreach/instantly-influencer.mjs --verify  # assert the copy survived the sanitizer
```

Everything in [instantly-wave1.md](instantly-wave1.md) about the Instantly API
still applies and is not repeated here: spintax needs `RANDOM`, no merge
variable goes inside a `RANDOM` block, every paragraph needs a `<div>` or the
sanitizer silently deletes it on a 200, the timezone enum has no
`America/New_York`, and every commercial message needs all three CAN-SPAM
disclosures rather than one.

## Six campaigns, not one

The brief called for this and it is right. A creator, a podcast host, a proposal
consultant and an APEX counselor want four unrelated things, and a single
campaign averages them into one reply rate that describes nobody. Six campaigns
is six independent readings, and the segment that produces a 12% positive reply
rate is invisible inside a blended 6%.

| | Campaign | In DB | Sendable | Ask |
|---|---|---|---|---|
| C1 | Creators and influencers | 41 | 20 | Run one of their real solicitations through GovHub, on camera |
| C2 | Podcasts and newsletters | 29 | 5 | An episode or a piece, not a promotion |
| C3 | GovCon media and blogs | 17 | 9 | Original USAspending analysis cut for their beat |
| C4 | Proposal and capture consultants | 57 | 27 | A referral partnership that names its own boundary |
| C5 | APEX advisors and education | 118 | 37 | A counselor account and a client session. Nothing back |
| C6 | Associations and communities | 25 | 6 | A member session delivered by us |

Sequence is four emails on day 0, 4, 8 and 14. Slower than wave 1's 0, 3, 7:
these are partnership asks to people with audiences, and a three-day bump on a
podcast pitch reads as pushy in a way a bid-cycle sales bump does not.

## Three things worth arguing about before launch

### 1. C5 is 40% of the database and it cannot be sold to

APEX Accelerators run on DoD Office of Small Business Programs cooperative
agreements and counsel contractors at no cost. Vendor neutrality is the entire
basis of that relationship. A counselor who forwards a referral-commission offer
to their program office has not just declined; they have made GovHub a name that
travels across a 117-contact network whose members all know each other.

C5 also carries the Veterans Business Outreach Centers (VBOC) network, added in
the expansion batch: a separate SBA-funded counseling network for veteran-owned
businesses, but the same vendor-neutrality rule and the same reason it cannot
carry commission language.

So C5 offers a counselor account and a tool-neutral client session, and asks for
nothing in return. No commission, no referral share, no affiliate anything, no
member rate. `--check` fails the build if any of that vocabulary appears in C5,
because this is the kind of rule that survives review and then dies in an edit
six weeks later.

The brief already said "do not use an aggressive affiliate pitch" for this
segment. The stronger version is that there is no affiliate pitch at all.

### 2. The relationship campaigns should not send from a cold-email domain, but govhub.online is not connected to Instantly

Wave 1 sends from twelve `.com` lookalike domains and flagged the mismatch
between those and the `govhub.online` link as a deliverability problem. Here it
is a conversion problem first, and a worse one: every recipient in C1, C2, C3
and C6 is a professional communicator who will look GovHub up before replying,
and a partnership pitch for a product at govhub.online, arriving from
`govhubprocurement.com`, reads as somebody impersonating the product they are
pitching.

The design called for these four campaigns to send from govhub.online. Checked
against the live workspace (`GET /accounts`, 2026-09-04): **there is no
govhub.online mailbox connected to Instantly at all.** Every one of the 48
connected accounts sits on one of the sixteen wave-1-style lookalike domains
(`buildwithgovhub.com`, `govhubbids.com`, and so on), the same domains built and
aged for cold sales. There is nothing to point the relationship campaigns at
except more of what they were designed to avoid.

Given that constraint, C1, C2, C3 and C6 share one mailbox on the least
sales-coded of the sixteen: `earl.knight@govhubhq.com`. "HQ" reads as a
company's own site; `govhubbids.com` or `govhubprocurement.com` read as what
they are, a lead-gen domain, which is the exact tell a journalist or podcast
host who vets pitches for a living would recognize. This is a compromise, not
the fix. **Connect a real govhub.online mailbox to this Instantly workspace
before these four campaigns start sending**. `PRIMARY_DOMAIN` and
`MAILBOXES.C1`-`.C6` are the only lines that need to change when one exists,
and everything else in the file is already built to point at it.

The volume argument that justified twelve mailboxes in wave 1 does not apply
here regardless of which domain is used: 94 leads and 376 total sends is
about 25 sends a day, which is one mailbox's normal work. So:

- **C1, C2, C3, C6** share one address, deliberately: a creator who gets the
  creator pitch and later the podcast pitch should see the same sender both
  times. Their campaign-level `daily_limit`s (6, 3, 3, 3) sum to 15, matching
  that mailbox's own account-level cap in Instantly exactly; `--check` now
  asserts this by address rather than relying on the arithmetic being done
  correctly by hand whenever a limit changes.
- **C4 and C5** behave more like cold sales and use separate, dedicated warmed
  wave-1 mailboxes, confirmed live via the API (`status: 1`, `stat_warmup_score:
  100` on both): `winwithgovhub.com` was the documented wave-1 spare;
  `govhubteam.com` is a wave-1 domain with spare capacity. Never
  `bidwithgovhub.com`: its `j.knight@` and `j.k@` addresses do not match the
  account name on file, and while the domain carries a third, clean address
  today (`e.knight@bidwithgovhub.com`), the original call was to resolve the
  whole domain before any of it sends, not to cherry-pick around the two bad
  addresses.

`MAILBOXES` in `instantly-influencer.mjs` now carries real, live-checked
addresses for all six campaigns, so `--check` passes clean and `--sync` is no
longer blocked:

```
192 total renders checked. All guardrails pass.
```

One thing the accounts API does not expose: whether `{{accountSignature}}` is
actually configured on `earl.knight@govhubhq.com`, `winwithgovhub.com`, or
`govhubteam.com`. That field is not in the `GET /accounts` response, so it
stays a manual check, item 2 in "Before importing" below.

### 3. `{{recentContent}}` cannot exist, so the opener is written per lead

The brief asks for `{{firstName}}`, `{{companyName}}`, `{{channel}}`,
`{{recentContent}}`, `{{audienceType}}` and `{{specialty}}`. Three of those are
safe and three are traps.

- **`{{recentContent}}` has no source.** There is no recent-content field in the
  database and there never will be one that is current on the day of a send. A
  body that references it renders blank or, worse, stale.
- **`{{firstName}}` is blank for 54 of the 94 sendable contacts.** They are
  shared inboxes at a publication or an accelerator. "Hi {{firstName}}," renders
  "Hi ," for more than half this list.
- **`{{audienceType}}` is populated for 9 contacts.** Not usable in a body.

So the research rides in `{{opener}}`, one complete sentence written per lead
and carried in the CSV, and the greeting rides in `{{greeting}}`, also written
per lead. `--check` refuses to export a lead missing either. A variable that
cannot be blank is the only kind that is safe to build a first line on, and
Instantly's preview substitutes a populated sample lead, so every blank-variable
failure stays invisible until the first real send.

`{{channel}}` survives, singular. The source stores it as a list, and "yours to
use on YouTube, Podcast, LinkedIn, Instagram however you like" is a mail merge
announcing itself.

The exported openers are **derived, not researched**. Every one is true of the
record it came from and none invents a claim about the recipient's recent work.
They are a floor, not a finish. `--report` prints all 39 P1 contacts precisely
so those openers get rewritten by hand from the person's actual last month of
output before import. That rewrite is the highest-leverage edit available on
this campaign and no script can do it.

### 4. A line-edit pass, after an outside review of this framework

The framework got a second read against the actual copy in
`instantly-influencer.mjs` (the emails themselves live in the repo, not in any
chat transcript, so a review of "the messaging framework" from a description of
it is necessarily a review of the intent, not the execution). Two things it
raised were real and are fixed; a few others were already handled by the build
and are noted here so they are not re-litigated:

- **C2 email 2 pitched a menu, not a topic.** It offered two named podcast
  topics as alternatives to email 1's opener, plus a line that literally counted
  them as "the three" once email 1's own topic was added in. That is the exact
  tell the brief itself warns against. Rewritten to name one alternative and ask
  one question.
- **C3 email 1 named the sending domain.** It referenced "the analysis at
  govhub.online/insights" in a cold first touch, which both guardrail and
  outside review agree is wrong on a young `.online` domain: a bare domain
  mention reads as a link for spam-filtering purposes whether or not it is
  markup, and there is no conversation yet to justify a link. Moved to email 2,
  once the thread exists and the recipient has already shown some interest, and
  `--check` now asserts every email 1 across all six campaigns carries zero
  links rather than trusting the campaign authors to remember by hand.
- **Subject lines were already there**, three per campaign, already lowercase
  and already not title-cased. Two read closer to campaign copy than an
  internal note (`episode idea: where AI fails on proposals`, a colon and six
  words; `when a client brings in a 200 page solicitation`, nine words) and are
  trimmed.
- **One ask per email was already a guardrail**, not a style note: `--check`
  fails the build if any rendered email carries more than one question mark.
  It caught nothing new this pass because nothing violated it, which is the
  point of making it mechanical instead of a read-through habit.
- **Sending from a non-lookalike identity for the relationship segments was
  already the design** (§2 above), decided independently of any outside
  review, for the same reason: these recipients look senders up. The design
  called for govhub.online specifically; checking the live Instantly workspace
  found no mailbox connected on that domain, so C1, C2, C3 and C6 currently
  share the least sales-coded of the sixteen connected lookalikes
  (`govhubhq.com`) instead, documented as a compromise pending a real
  govhub.online mailbox, not as the intended state.
- **C5's counselor copy got one real improvement**: email 2 now offers a worked
  compliance matrix from a real small-business set-aside solicitation, sent as
  a PDF, no account or scheduling required, rather than a second description of
  what the counselor session covers (which moved to email 3, next to the
  standalone account offer). A finished artifact that costs nothing to open is
  a stronger single ask than restated session logistics, the same instinct
  behind C1's on-camera RFP teardown. A separately drafted full replacement for
  C5 was not adopted: it opened with two questions stacked in one CTA ("is this
  something you'd feel comfortable pointing a client to, and if not, what's
  missing?"), which is the same menu problem as the C2 fix above, and it closed
  with a hardcoded name and title in the body where this system's compliance
  design puts that information in the per-mailbox `{{accountSignature}}` on
  purpose, so it does not double up with the mailbox's own signature block.
  The shared-inbox greeting problem that draft raised for APEX's 18 role
  addresses was already solved by `{{greeting}}` (`derives Hi <org> team` when
  there is no usable first name), built and guardrailed before that review ran.

## Deliverability: every address verified, five confirmed-dead ones caught

Structural hygiene answers "should we send here". It says nothing about
whether the address accepts mail, and every address in this database came off
a public web page rather than from a person who typed it in, so a share of
them are stale by construction: someone who left the company, a contact page
last updated in 2019, an address that was always a typo.

All 216 unique addresses went through MillionVerifier (216 credits):

| Verdict | Count | Meaning |
|---|---|---|
| `ok` | 142 | Confirmed deliverable |
| `catch_all` | 51 | The domain accepts every address at SMTP, so the mailbox cannot be confirmed either way |
| `invalid` | 14 | Confirmed bad. A guaranteed bounce |
| `unknown` | 9 | The provider would not answer (greylisting, timeout) |

**Five of those `invalid` addresses were in the 104 that were about to be
mailed**, including `mark@federaldirect.net`, a P1 creator. Five bounces on
104 sends is a 4.8% bounce rate, above the 3% that [instantly-wave1.md](instantly-wave1.md)
says to stop and investigate at, on domains three weeks old. That single fact
is the argument for verifying before sending rather than after.

How each verdict is treated:

- **`invalid` and `disposable`** get the `email-invalid` hold. Not negotiable.
- **`unknown`** gets a separate `email-unverifiable` hold. Not proof of a bad
  address, but a young sending domain cannot spend its reputation finding out.
  These go to the manual pile, where a human can confirm the address by hand
  or reach the person another way; Judy Bradt (P1) is one of them.
- **`catch_all` is deliberately NOT held.** Holding all 51 would drop a
  quarter of the sendable list, and most of them are universities and small
  firms where catch-all is simply how the mail server is configured. They are
  counted separately in `--report` instead, and they are the reason to ramp
  slowly and read the first days of bounce data rather than trusting the
  headline number.

The two holds are deliberately separate constants in `lib_influencer_db.py`
so either can be relaxed without the other, and `--check` fails if an
`invalid`, `disposable`, or `unknown` address ever reaches an export, or if
any exported address has no verdict at all.

Verification also feeds the caps. `keep_rank` now prefers a confirmed-`ok`
address over a catch-all or unverified one, so when the highest-priority
contact at an organization turns out to be dead, the runner-up wins on merit
rather than the cap silently keeping a dead address. That is why all 216 were
verified rather than only the 104 that were sendable at the time.

Re-running is cheap and does not re-bill: verdicts are cached per address in
`data/email-verification.json` and the Python build reads that file rather
than calling the API, so a rebuild months from now produces the same JSON.

```bash
export MILLIONVERIFIER_API_KEY=...
node scripts/outreach/verify-emails.mjs --dry-run   # what would be checked
node scripts/outreach/verify-emails.mjs             # verify anything not cached
node scripts/outreach/verify-emails.mjs --recheck   # re-verify everything
```

Addresses go stale. Re-run before any future batch, and re-run the whole list
if these campaigns sit unsent for more than a couple of months.

## What is held back, and why

200 of 294 contacts do not enter a campaign. A hold is not a deletion: everything
held lands in `held-manual-followup.csv` with its reason (and, for the
expansion batch, a `contactPath` describing where to go find the address), so
the manual pile is a worklist rather than a silent drop.

| Count | Hold | Why |
|---|---|---|
| 80 | `org-cap` | Several contacts at one organization. Eleven Colorado APEX counselors and eight Professional Services Council staff are in this list. Eight cold emails into one association produce one complaint, not eight replies |
| 69 | `no-public-email` | No address published. Manual channel, and every one retains a website, contact form, or (for the expansion batch) a `contactPath` describing where to look |
| 17 | `government-mailbox` | DCMA, DISA, DMEA, Air Force OSBP and three SBA program inboxes, plus APEX offices on `.gov`. The source database marks these "do not pitch as affiliate; use for public resource" and it is right |
| 10 | `email-not-first-party-verified` | The database supplies an address while its own verification note says none was found. These are inferred, and bounces are what kill a young sending domain |
| 9 | `duplicate-email` | One address, several records. Instantly would otherwise put the same person in two sequences |
| 8 | `domain-cap` | Seven Ohio University APEX counselors are filed under four different organization names and all seven answer at `ohio.edu`. Only the domain sees them as one office |
| 6 | `competitor` | Deltek GovWin, HigherGov, GovSpend, Capture2Proposal, GovDash, G2X. A partnership pitch to a competitor is a free product briefing for their sales team |
| 14 | `email-invalid` | MillionVerifier confirmed the address is bad. Five of these were in the list about to be mailed |
| 11 | `email-unverifiable` | MillionVerifier could not get an answer (greylisting, timeout). Manual pile rather than a send |
| 3 | `duplicate-org-in-expansion` | govmates, TheSmalls and GovKid Method each appeared twice in the expansion batch, as a bare organization and again as a named podcast host. The bare listing is held pointing at the named one |
| 2 | `email-salvaged-from-pdf-artifact` | Two addresses were recovered from a column collision in the source PDF and cannot be trusted without re-reading the site |
| 1 | `government-entity` | The Contracting Experience is an official Air Force Materiel Command podcast. Its address is a gmail, so nothing in the TLD says so |

Four more rows from the expansion batch were dropped before they could even
become a hold, because they turned out to already be existing, sendable
contacts under a different label: Washington Technology, FedBiz Access,
Jennifer Schaus and Judy Bradt. See "The expansion batch" below for why a
name-only dedup missed them and what caught it instead.

Four more addresses are exported but flagged for a human to open in a browser
first, because the mailbox does not carry the contact's name:

| Address | Filed under | |
|---|---|---|
| `bridget@govconnow.co` | Sheena Parker | The source's own note says the address books for Sheena and Bridget both, so "Hi Sheena" reaches Bridget |
| `smccall@koprince.com` | Steven Koprince | Different surname entirely |
| `thecompasscircle@gmail.com` | Casey Cooper | Brand mailbox, not a personal one |
| `lubatist@fiu.edu` | Luis Batista | Probably the university's own convention. Cheap to confirm |

One more was caught and then capped out on its own: `mlejuene@rsmfederal.com` is
filed under Michael LeJeune, and the local part is the letters of "LeJeune" in
the wrong order. That is a transcription slip, and a transcription slip is a
bounce. It is on the manual list.

The suppression cross-check against `data/vendor-outreach.json` currently
matches nobody, which is expected: that ledger is small-business vendors and this
list is media and advisors. It still runs on every export, and `--check` fails if
the ledger file goes missing rather than passing an unchecked list.

## Before importing

1. **Set `MAILBOXES`.** See the argument above. `--check` blocks `--sync` until
   this is done.
2. **Configure `{{accountSignature}}` on every sending mailbox.** It is a
   per-mailbox setting, so one mailbox missing it sends with no signature while
   the campaign preview looks fine. The signature is the sole carrier of the
   postal address and the solicitation disclosure, so a blank one is a
   compliance failure and not a cosmetic one. No valediction: the bodies do not
   carry one and it would double up.
3. **Rewrite the openers for all 39 P1 contacts.** `npm run influencers` lists
   them. This is the campaign.
4. **Open the four flagged addresses in a browser**, plus `mlejuene@`.
5. **Send a seed email from each mailbox** and read the received plain-text
   part, not the preview pane. Repeat on a same-thread follow-up: emails 2, 3
   and 4 send with an empty subject to thread into the original, and that is
   worth seeing land once before it happens to a journalist.
6. **Confirm the day picker shows Mon-Fri.** The schedule is
   `{0:false, 1..5:true, 6:false}` on the reading that 0 = Sunday. Instantly's
   own AI SDR wrote that on a schedule it named "Weekdays" in this workspace,
   but the API reference never states the mapping and the spec's own example
   implies 0 = Monday. Five seconds, and the alternative is emailing a podcast
   host on a Saturday.
7. **Import each CSV into its own campaign.** The file names match the campaign
   names. Do not merge them.

## Measuring it

Positive reply rate per campaign is the metric. Everything else is downstream of
it and slower.

The sample sizes are small on purpose and they bound what can be concluded:
C2 has 5 leads and C6 has 6, so neither will ever produce a statistically
meaningful reply rate. Read those two as a list of five conversations that
either happened or did not, not as a percentage. C4 at 27 and C5 at 37 can
support a real comparison after a full cycle.

Do not turn on `auto_variant_select`. Three subject variants against 20 leads
will produce a "winner" that is noise, and Instantly will promote it.

Worth tracking beyond replies, because this campaign is not measured in
subscriptions: conversations started, podcast bookings, newsletter placements,
guest posts, backlinks earned, affiliate and referral partners activated, and
customers attributed to a partner. Most of those land weeks after the sequence
ends, so judge a campaign on the quarter and not on the send window.

## The expansion batch, and why 29 new prospects added zero sendable leads

A second research pass (`GovCon_Outreach_Expansion.xlsx`, researched
2026-09-03) added 33 rows: more podcasts, a few media targets, consultants,
associations, and a veteran-focused counseling network (VBOC) that runs on the
same SBA-funded vendor-neutrality rules as APEX. All 33 were deliberately
researched with **no guessed email addresses**, the sheet author's rule, and
the right one, since a guessed address is a bounce and bounces are what kill a
young sending domain. Every row that had no publicly posted address shipped
with a `contactPath` instead: where a human would go look.

Four rows turned out to already be in the database under a different label,
and three more duplicated each other within the new batch itself. Neither kind
of collision is visible to a simple "have we seen this organization name
before" check:

- **Washington Technology, FedBiz Access, Jennifer Schaus and Judy Bradt** were
  all already present, three of them already sendable. The new batch's own
  dedup pass checked organization names against the master PDF tab only (254
  rows); the database that pass was checked against carries 11 more from the
  newsletter tab, and Washington Technology in particular is filed under its
  parent company (`GovExec`) rather than the outlet name, which a name-only
  check does not see. These four are dropped entirely rather than held, since
  the existing record already covers them, and `parse_expansion_xlsx.py`
  documents which existing contact each one duplicates.
- **govmates, TheSmalls and GovKid Method** each appear twice in the new batch:
  once as a bare organization listing, once as a podcast or channel with a
  named host attached. The named-host version is kept and the other is held
  pointing at it (`duplicate-org-in-expansion`), so it still shows up in the
  worklist rather than looking like it silently vanished from the sheet.

Net effect: 265 + 33 - 4 = **294 contacts**, and sendable was unchanged at
104 at the time (later 94, after deliverability verification),
because every surviving new row lacks an email by design. `npm run
influencers` now prints two things specific to this batch: P1 rows that carry
a `contactPath` worth a human's time to chase an address for (currently one:
the Contracting Officer Podcast, 452 episodes, hosted by two former
contracting officers), and the handful of rows the sheet author flagged as
"needs verification": well-known ecosystem entities not independently
re-checked, worth confirming still exist and are described correctly before
spending research time on an address. This batch extends the pipeline's
runway; it does not move the block on sending, which is still the 39 P1
openers and the mailbox decision below.

## Rebuilding the database

`data/govcon-influencer-outreach.json` is generated from every source batch in
one pass, never hand-edited:

```bash
pip install pdfplumber openpyxl
python3 scripts/outreach/build_influencer_db.py \
  --pdf path/to/GovCon_Influencer_Outreach_Database_200plus.pdf \
  --xlsx path/to/GovCon_Outreach_Expansion.xlsx
```

`--pdf` alone reproduces the original 265-contact database; add `--xlsx` to
merge in a research batch on top of it. Neither source file is committed: both
are research artifacts, and `build_influencer_db.py` plus the two parsers it
imports (`parse_influencer_pdf.py`, `parse_expansion_xlsx.py`) are what make
the committed JSON reproducible and auditable instead of a hand-edited blob.
The normalization and cross-record rules (person-vs-organization name
detection, the org and domain caps, hold reasons) live once, in
`lib_influencer_db.py`, and both parsers call into it, because those rules
have to run over every row from every source in a single pass to catch a
collision that spans sources, which is exactly what the expansion batch
produced twice.

The PDF extraction is awkward enough to be worth automating rather than
repeating by hand: it is a spreadsheet printed at 1.5pt, so the parser walks
raw characters, clusters them into rows by vertical position, and assigns
tokens to columns by the header row's x positions. Two segment values wrap
across the first column and read as phantom records until they are rejoined.
It asserts that its output reconciles with the PDF's own Expansion Dashboard,
all 254 records and every per-segment count, and refuses to write a short
list on a mismatch. A rebuild from `--pdf` alone is byte-identical to the
first commit of this database, field for field, before the expansion batch's
`origin` and `contactPath` fields were added to the schema.
