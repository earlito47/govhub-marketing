# GovCon influencer and partner outreach

Six Instantly campaigns against the GovCon influencer, media and partner
database. Built, guardrailed, and **not created in Instantly yet**: the sync
step is blocked on one decision only a human can make, which is which mailboxes
send. Everything else is done.

| | |
|---|---|
| Database | `data/govcon-influencer-outreach.json`, 265 contacts |
| Sendable after hygiene | **104**, across six campaigns |
| Total sends if all four steps run | 416, over roughly five weeks |
| Sequence copy | `scripts/outreach/instantly-influencer.mjs` |
| List hygiene and lead export | `scripts/outreach/influencer-db.mjs` |
| Source rebuild | `scripts/outreach/parse-influencer-pdf.py` |

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
| C1 | Creators and influencers | 39 | 20 | Run one of their real solicitations through GovHub, on camera |
| C2 | Podcasts and newsletters | 16 | 5 | An episode or a piece, not a promotion |
| C3 | GovCon media and blogs | 15 | 9 | Original USAspending analysis cut for their beat |
| C4 | Proposal and capture consultants | 53 | 27 | A referral partnership that names its own boundary |
| C5 | APEX advisors and education | 117 | 37 | A counselor account and a client session. Nothing back |
| C6 | Associations and communities | 18 | 6 | A member session delivered by us |

Sequence is four emails on day 0, 4, 8 and 14. Slower than wave 1's 0, 3, 7:
these are partnership asks to people with audiences, and a three-day bump on a
podcast pitch reads as pushy in a way a bid-cycle sales bump does not.

## Three things worth arguing about before launch

### 1. C5 is 45% of the database and it cannot be sold to

APEX Accelerators run on DoD Office of Small Business Programs cooperative
agreements and counsel contractors at no cost. Vendor neutrality is the entire
basis of that relationship. A counselor who forwards a referral-commission offer
to their program office has not just declined; they have made GovHub a name that
travels across a 117-contact network whose members all know each other.

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

## What is held back, and why

161 of 265 contacts do not enter a campaign. A hold is not a deletion: everything
held lands in `held-manual-followup.csv` with its reason, so the manual pile is a
worklist rather than a silent drop.

| Count | Hold | Why |
|---|---|---|
| 80 | `org-cap` | Several contacts at one organization. Eleven Colorado APEX counselors and eight Professional Services Council staff are in this list. Eight cold emails into one association produce one complaint, not eight replies |
| 40 | `no-public-email` | No address published. Manual channel, and every one retains a website or contact form |
| 17 | `government-mailbox` | DCMA, DISA, DMEA, Air Force OSBP and three SBA program inboxes, plus APEX offices on `.gov`. The source database marks these "do not pitch as affiliate; use for public resource" and it is right |
| 10 | `email-not-first-party-verified` | The database supplies an address while its own verification note says none was found. These are inferred, and bounces are what kill a young sending domain |
| 9 | `duplicate-email` | One address, several records. Instantly would otherwise put the same person in two sequences |
| 8 | `domain-cap` | Seven Ohio University APEX counselors are filed under four different organization names and all seven answer at `ohio.edu`. Only the domain sees them as one office |
| 6 | `competitor` | Deltek GovWin, HigherGov, GovSpend, Capture2Proposal, GovDash, G2X. A partnership pitch to a competitor is a free product briefing for their sales team |
| 2 | `email-salvaged-from-pdf-artifact` | Two addresses were recovered from a column collision in the source PDF and cannot be trusted without re-reading the site |
| 1 | `government-entity` | The Contracting Experience is an official Air Force Materiel Command podcast. Its address is a gmail, so nothing in the TLD says so |

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

## Rebuilding the database

`data/govcon-influencer-outreach.json` is generated, not hand-edited:

```bash
pip install pdfplumber
python3 scripts/outreach/parse-influencer-pdf.py path/to/GovCon_Influencer_Outreach_Database_200plus.pdf
```

The source PDF is a research artifact and is not committed. The extraction is
awkward enough to be worth automating rather than repeating by hand: it is a
spreadsheet printed at 1.5pt, so the parser walks raw characters, clusters them
into rows by vertical position, and assigns tokens to columns by the header
row's x positions. Two segment values wrap across the first column and read as
phantom records until they are rejoined.

The script asserts that its output reconciles with the PDF's own Expansion
Dashboard, all 254 records and every per-segment count, and refuses to write a
short list. The committed JSON is byte-identical to a fresh rebuild.
