# GovCon influencer and partner outreach

Six Instantly campaigns against the GovCon influencer, media and partner
database. Built, guardrailed, and **not created in Instantly yet**: the sync
step is blocked on one decision only a human can make, which is which mailboxes
send. Everything else is done.

| | |
|---|---|
| Database | `data/govcon-influencer-outreach.json`, 294 contacts, two research batches |
| Sendable after hygiene | **104**, across six campaigns |
| Total sends if all four steps run | 416, over roughly five weeks |
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

### 2. The relationship campaigns should not send from a cold-email domain

Wave 1 sends from twelve `.com` lookalike domains and flagged the mismatch
between those and the `govhub.online` link as a deliverability problem. Here it
is a conversion problem first, and a worse one.

Every recipient in C1, C2, C3 and C6 is a professional communicator who will
look GovHub up before replying. A partnership pitch for a product at
govhub.online, arriving from `govhubprocurement.com`, does not read as a growth
tactic. It reads as somebody impersonating the product they are pitching, which
is the single worst first impression available with a journalist.

The volume argument that justified twelve mailboxes in wave 1 does not exist
here: 104 leads and 416 total sends is about 25 sends a day, which is one
mailbox's normal work. So:

- **C1, C2, C3, C6** send from one named human at `govhub.online`. One address
  for all four, deliberately: a creator who gets the creator pitch and later the
  podcast pitch should see the same sender both times.
- **C4 and C5** behave more like cold sales and can borrow warmed wave 1
  domains. `winwithgovhub.com` was documented as the wave 1 spare;
  `govhubteam.com` is a wave 1 domain with spare mailbox capacity. Never
  `bidwithgovhub.com`, whose `j.knight@` and `j.k@` do not match the account name
  on file.

`MAILBOXES` in `instantly-influencer.mjs` ships with `REPLACE_ME@govhub.online`
placeholders and `--check` fails on them, so `--sync` cannot run until somebody
makes this call. That failure is the only one left:

```
 FAIL  mailboxes are set to real addresses  EDIT MAILBOXES BEFORE --sync
192 total renders checked. 1 FAILURES.
```

### 3. `{{recentContent}}` cannot exist, so the opener is written per lead

The brief asks for `{{firstName}}`, `{{companyName}}`, `{{channel}}`,
`{{recentContent}}`, `{{audienceType}}` and `{{specialty}}`. Three of those are
safe and three are traps.

- **`{{recentContent}}` has no source.** There is no recent-content field in the
  database and there never will be one that is current on the day of a send. A
  body that references it renders blank or, worse, stale.
- **`{{firstName}}` is blank for 57 of the 104 sendable contacts.** They are
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
They are a floor, not a finish. `--report` prints all 41 P1 contacts precisely
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
- **Sending from the real identity for the relationship segments was already
  the design** (§2 above), decided independently of any outside review, for
  the same reason: these recipients look senders up. C1, C2, C3 and C6 already
  send from `govhub.online`, not a wave-1 lookalike domain.
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

## What is held back, and why

190 of 294 contacts do not enter a campaign. A hold is not a deletion: everything
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
3. **Rewrite the openers for all 41 P1 contacts.** `npm run influencers` lists
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

Net effect: 265 + 33 - 4 = **294 contacts**, but **sendable stayed at 104**,
because every surviving new row lacks an email by design. `npm run
influencers` now prints two things specific to this batch: P1 rows that carry
a `contactPath` worth a human's time to chase an address for (currently one:
the Contracting Officer Podcast, 452 episodes, hosted by two former
contracting officers), and the handful of rows the sheet author flagged as
"needs verification": well-known ecosystem entities not independently
re-checked, worth confirming still exist and are described correctly before
spending research time on an address. This batch extends the pipeline's
runway; it does not move the block on sending, which is still the 41 P1
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
