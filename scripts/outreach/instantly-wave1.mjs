// Instantly wave 1: create the three GovHub cold-email campaigns.
//
// Builds Campaign A (serial_bidder), B (new_prime) and C (registered_no_awards)
// from the sequences in docs/instantly-wave1.md via POST /api/v2/campaigns.
// Campaigns are created and LEFT PAUSED with no leads. Nothing sends until a
// human uploads leads and hits start.
//
// Rules that shape everything here:
//   - Copy is spintax, Instantly native: {{RANDOM|one|two}}. RANDOM is required;
//     without it Instantly parses {{a|b}} as "variable a, fallback b" and the
//     block silently renders "b" every time.
//   - No merge variable is ever nested inside a RANDOM block. Nesting is
//     documented as supported since 2025-04, but a naive brace match would
//     terminate the block at the inner }} and emit a literal }} to every lead.
//     Not worth the risk on the first line of an email.
//   - No merge variable ever opens a body or is the whole subject. A blank then
//     renders a leading comma or a subject of "(no subject)" / "?", and the
//     inbox preview is the only thing a same-thread bump shows.
//   - No em dashes. The content voice standard bans them (scripts/check-emdash.mjs);
//     readers read the em dash as an AI-writing tell.
//   - Every step carries a plain-text opt-out line. CAN-SPAM 15 USC 7704(a)(5)(A)
//     wants three disclosures in EVERY commercial message: identification as
//     solicitation, opt-out notice, and a postal address. The postal address
//     ships in the per-mailbox {{accountSignature}}; the solicitation line was
//     dropped on request (see set-signatures.mjs); the opt-out notice is in the
//     body so it cannot depend on a mailbox setting being configured.
//
//     The wording of that notice is deliberate. It reads 'reply "no" and I will
//     not reach out again', not 'reply "remove"'. "Remove" and "off my list"
//     are the vocabulary of list management, and a cold email that admits to
//     having a list stops reading like one person writing to another, which is
//     the whole premise of the message. The mechanism is identical and the
//     notice is just as clear; only the frame changes.
//
//     One consequence to carry into any reply automation: do NOT trigger
//     suppression on a bare "no". It is a common word in ordinary replies
//     ("no problem, let us talk", "no rush but yes"), so matching it alone
//     would unsubscribe interested people. Match the phrasing, or read the
//     replies. stop_on_reply is true either way, so the sequence halts on any
//     reply regardless.
//   - Every paragraph is wrapped in a <div>. This is NOT optional and the API
//     reference does not mention it: the docs say only "use <br/> tags for
//     line breaks", but the server-side sanitizer DISCARDS BARE TEXT NODES at
//     the root of the body. A body of "text<br/><br/>text" comes back as
//     "<br /><br />" with every word gone, silently, on a 200 response.
//     Verified by probing all six encodings against the live API on 2026-08-12:
//     bare text stripped; <div>, <p>, <span> and plain \n all survive.
//     <div> is used because it is what Instantly's own editor emits.
//     text_only still delivers the result as text/plain, so no HTML ships.
//
// Env: INSTANTLY_API_KEY
// Usage:
//   node instantly-wave1.mjs --check          expand all spintax, run guardrails, no API calls
//   node instantly-wave1.mjs --dry-run        print the exact payloads that would POST
//   node instantly-wave1.mjs --sync           create the campaigns, or update them in place
//                                             if they already exist (matched by name).
//                                             Idempotent, and never activates anything.
//   node instantly-wave1.mjs --verify         re-read the campaigns and assert the copy
//   node instantly-wave1.mjs --mailbox-limits set each wave 1 mailbox to MAILBOX_DAILY_LIMIT
//                                             survived the sanitizer

const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

// ---- Sending window -------------------------------------------------------
// Recipients are federal contractors, so the workday that matters is US Eastern.
// The timezone field is a CLOSED enum of 102 IANA strings and America/New_York
// is NOT in it; America/Detroit is the US Eastern slot.
//
// days: keys are "0".."6". Instantly's own AI SDR wrote {0:false,1..5:true,6:false}
// on a schedule it named "Weekdays" in this same workspace, so 0 = Sunday.
// Worth eyeballing once in the UI, since the API reference never says it.
const SCHEDULE = {
  // Hard floor on the first send. Every mailbox and domain in this workspace
  // was created 2026-08-06. Instantly's own guidance is a 2-week minimum
  // before campaign sends; 3 weeks is the defensible number. Even if someone
  // activates early, nothing goes out before this date.
  //
  // Moved forward 2026-09-04. The original 2026-08-27 was day 21, and it had
  // quietly become a date in the past, which meant the backstop was doing
  // nothing at all: activating a campaign would have started sending on the
  // next window. Day 30 is 2026-09-05, a Saturday and not a sending day, so
  // the floor is the Monday after it.
  start_date: '2026-09-07',
  end_date: null,
  schedules: [
    {
      name: 'Weekdays',
      timing: { from: '09:00', to: '16:00' },
      days: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
      timezone: 'America/Detroit',
    },
  ],
};

// Per-mailbox ceiling, applied by --mailbox-limits. Kept beside the mailbox
// list rather than inside a campaign because it is an account setting: the
// same twelve accounts would carry it into any later campaign too.
const MAILBOX_DAILY_LIMIT = 20;

// ---- Mailboxes ------------------------------------------------------------
// One mailbox per domain, twelve domains, and each campaign gets its own set.
// One-per-domain buys twelve independent placement readings and leaves two
// untouched mailboxes on every domain as wave 2 capacity. Per-campaign
// isolation means campaign C (the coldest list, so the highest complaint risk)
// cannot contaminate the domains carrying A and B.
//
// Every address below is warmup_status 1 with a warmup score of 100.
// Deliberately excluded from wave 1:
//   govhubbids.com, govhubproposal.com  warmup never started, score 0
//   bidwithgovhub.com                   j.knight@ and j.k@ do not match the
//                                       "Earl Knight" account name; resolve
//                                       before that domain sends anything
//   winwithgovhub.com                   held as spare
const MAILBOXES = {
  A: [
    'earl.knight@buildwithgovhub.com',
    'earl.knight@usegovhub.com',
    'earl.knight@govhubcontracts.com',
    'earl.knight@govhubprocurement.com',
    'earl.knight@govhubcapture.com',
    'earl.knight@trygovhub.com',
  ],
  B: [
    'earl.knight@getgovhub.com',
    'earl.knight@govhubteam.com',
    'earl.knight@govhubnow.com',
  ],
  C: [
    'earl.knight@govhubhq.com',
    'earl.knight@govhubsubmittals.com',
    'e.knight@govhubrfp.com',
  ],
};

// ---- Shared steps ---------------------------------------------------------
// Campaigns B and C reuse A's emails 2 and 3 unchanged, per the sequence doc.

// Email 2, day 3, same thread (empty subject threads the reply).
// Self-contained on purpose: if email 1 landed in spam the recipient has no
// "below" to look at, so this restates the offer instead of pointing at it.
const EMAIL_2_BODY = [
  '{{RANDOM|Following up on my note about|Circling back on}} turning an RFP into a compliance matrix and a first draft.',
  '',
  '{{RANDOM|There is a matrix builder on our site that runs without an account|We put a matrix builder on the site that runs without an account}}, {{RANDOM|so you can judge the output before talking to anyone|so the output speaks before I do}}.',
  '',
  '{{RANDOM|Want me to point you at it?|Worth a look?}}',
  '',
  '{{accountSignature}}',
  '',
  '{{RANDOM|If I am barking up the wrong tree, reply "no" and I will not reach out again.|If this is not relevant, reply "no" and you will not hear from me again.}}',
];

// Email 3, day 4 after email 2 (so day 7), same thread. The info dump.
// One link, and the removal line is the last thing they read.
const EMAIL_3_BODY = [
  '{{RANDOM|Last note from me|Closing the loop here}}, {{firstName}}.',
  '',
  '{{RANDOM|Three things worth knowing about|Quick rundown on}} GovHub:',
  '',
  '1. It reads the full RFP and builds the compliance matrix {{RANDOM|automatically|for you}}, every Section L and M requirement mapped.',
  '2. It drafts the response sections against those requirements, so {{RANDOM|your team edits instead of staring at a blank page|you are editing, not writing from scratch}}.',
  '3. It flags {{RANDOM|the disqualifiers that get bids thrown out unread|the technicalities that kill otherwise strong bids}} before you submit.',
  '',
  'There is a working compliance matrix builder on our site you can try without creating an account: https://govhub.online',
  '',
  '{{RANDOM|If the timing is off, that is fine.|If now is not the time, all good.}}',
  '',
  '{{accountSignature}}',
  '',
  '{{RANDOM|Reply "no" and I will not reach out again.|Reply "no" and you will not hear from me again.}}',
];

// ---- Campaign A: serial_bidder -------------------------------------------
// Rewritten 2026-09-12 on the week 1 result. These are not struggling small
// primes: median obligated is $13.2M, 90.6% sit above $1M, and every one has
// between 3 and 10 awards this year. Week 1 opened on small primes losing
// winnable bids to compliance technicalities, which is not their experience,
// and A returned the lowest reply rate of the three at 1.0% against B's 5.0%.
// At this cadence the constraint is capacity: good solicitations get passed on
// for want of hours, not for want of skill. See docs/instantly-week1-baseline.md.
const A_EMAIL_1_BODY = [
  '{{RANDOM|Hey|Hi}} {{firstName}}, {{RANDOM|noticed|saw}} {{companyName}} {{RANDOM|has been winning federal work steadily|keeps landing federal work}} {{RANDOM|this year|all year}}.',
  '',
  '{{RANDOM|At that cadence the ceiling is usually capacity, not capability|Past a certain cadence the limit is hours, not capability}}. {{RANDOM|Solicitations worth bidding get passed on because nobody has the hours|Good solicitations get passed on because nobody has the week to spare}}.',
  '',
  'GovHub {{RANDOM|turns an RFP into a compliance matrix and a working draft|reads the RFP, builds the compliance matrix, and drafts the sections}}, so {{RANDOM|the same team covers more of the pipeline|a team covers more pipeline without adding headcount}}.',
  '',
  '{{RANDOM|How many do you pass on in a month for capacity?|Who carries the proposal load for you now, in-house or outside?}}',
  '',
  '{{accountSignature}}',
  '',
  'Reply "no" and I will not reach out again.',
];

// ---- Campaign B: new_prime ----------------------------------------------
// They broke through. The next wins are harder because agencies expect more
// polish and the founder is still writing proposals at night.
//
// The doc's opener nested {{companyName}} inside a RANDOM block and fed a
// singular subject ("the founder") into plural verbs ("still write"), which
// broke half of this campaign's renders. Both are restructured here.
//
// The premise below is deliberately UNCHANGED for week 2. B was the only wave 1
// segment whose opener was true of its audience (1 to 2 recent awards, median
// obligated $695,935, last award inside five months) and the only one that drew
// human replies, at 5.0% against A's 1.0%. Rewriting the one thing that worked
// would leave nothing to compare A and C against, so B keeps its copy and moves
// only on the two changes applied programme-wide: the CTA is now a question
// about their process rather than a request for a meeting, and the opt-out sits
// below the signature instead of under the ask.
const B_EMAIL_1_BODY = [
  '{{RANDOM|Hey|Hi}} {{firstName}}, saw {{companyName}} {{RANDOM|recently landed federal work|picked up federal work recently}}.',
  '',
  '{{RANDOM|The pattern we see|What we keep seeing}}: the first award comes on hustle, then {{RANDOM|bid volume has to go up|the volume has to climb}} while {{RANDOM|the same one or two people are|the founder is}} still {{RANDOM|writing every proposal by hand|doing all the writing at night}}.',
  '',
  'GovHub {{RANDOM|reads the RFP, builds the compliance matrix, and drafts the sections|turns an RFP into a compliance matrix and a working draft}} so you can {{RANDOM|chase more of the right bids|bid more without burning out}}.',
  '',
  '{{RANDOM|Who writes your proposals today, in-house or a consultant?|Is the proposal work in-house for you, or outsourced?}}',
  '',
  '{{accountSignature}}',
  '',
  'Reply "no" and I will not reach out again.',
];

// ---- Campaign C: registered_no_awards -----------------------------------
// Rewritten 2026-09-12, and the segment name is the trap that caused it.
// "registered_no_awards" means no award in the RECENT window, not no award
// ever. Median obligated inside this campaign is $1,088,211, 51% sit at or
// above $1M, one lead carries $1.84B, and all 448 have a real award history
// ending around 2023. These are LAPSED contractors, not first-time bidders.
//
// Week 1 told them "what stops most firms from their first win" and offered to
// help them "submit like a big one without a proposal shop". A recipient with
// $7.2M in federal obligations replied "NO" in capitals. The premise was false,
// and a false premise reads as not having done the homework, which is worse
// than a weak offer because it cannot be recovered later in the thread.
//
// Reframed as re-engagement: they already know how to win federal work, they
// stopped. Ask what changed rather than explain their own business to them.
// See docs/instantly-week1-baseline.md.
//
// Worth confirming before leaning harder on this angle: C's award dates sit in
// a tight 2023 band exactly three years before A's and B's, which is either
// genuine dormancy or an artifact in the source pipeline.
const C_EMAIL_1_BODY = [
  '{{RANDOM|Hey|Hi}} {{firstName}}, {{RANDOM|saw|noticed}} {{companyName}} {{RANDOM|has federal awards on the record but nothing recent|won federal work a few years back, nothing lately}}.',
  '',
  '{{RANDOM|Usually that gap is not a decision anyone made|In my experience that gap is rarely a decision}}. {{RANDOM|The pursuits just stopped being worth the nights they cost|Bidding stopped being worth the nights it cost}}.',
  '',
  'GovHub reads the RFP, builds the compliance matrix, and drafts the sections, so {{RANDOM|coming back does not mean staffing a proposal team|getting back in does not mean hiring for it}}.',
  '',
  '{{RANDOM|Still bidding, or is federal on hold for now?|Are you still chasing federal, or has that gone quiet?}}',
  '',
  '{{accountSignature}}',
  '',
  'Reply "no" and I will not reach out again.',
];

// Subject variants are real A/B variants, not spintax, so Instantly reports
// per-variant reply rate. Every one keeps a real word so a blank merge field
// degrades to a shorter valid subject instead of "(no subject)" or "?".
// CTA and subject vocabulary are disjoint across campaigns: identical closing
// lines across all three would undo the point of varying the fingerprint.
// Volume. Raised to 20 per inbox per day on request, 2026-09-04, from the 5
// the ramp in docs/instantly-wave1.md opens on.
//
// Three knobs have to agree or the change does nothing. The per-mailbox
// `daily_limit` on the account is the real ceiling (see --mailbox-limits
// below); `daily_limit` here is the campaign-wide cap, mailboxes x 20; and
// `daily_max_leads` is how many NEW leads enter per day. A three-email
// sequence means steady-state sends are roughly three times the new-lead rate,
// so daily_max_leads is the campaign cap divided by 3. Leaving it at the old
// 12/6/6 would have held actual volume near 72/day whatever the caps said.
//
// Recorded because it is a real departure and the record should not have to be
// reconstructed later: 20/inbox/day is the number the ramp treats as the
// week-8 ceiling, not its opening step, and it is being used on domains 29
// days old. The ramp's own gates -- bounce under 2%, reply at or above 3%,
// zero complaints, seed placement at or above 90% -- are all measured from
// sends that have not happened yet, so none of them can be checked before the
// first one. Opening at the ceiling means the first day of real data arrives
// at 240 sends rather than 60. That trade was put to the account holder and
// this is the answer; watch bounces on day one rather than at the end of week
// one.
const CAMPAIGNS = [
  {
    key: 'A',
    name: 'GovHub Wave 1 - A serial_bidder',
    subjects: [
      '{{companyName}} proposals', // blank -> "proposals"
      'bid capacity',
      'the ones you pass on',
    ],
    email1: A_EMAIL_1_BODY,
    daily_limit: 120, // 6 mailboxes x 20/day
    // Halved from 40 for week 2 (2026-09-12). A has 697 untouched leads and the
    // copy above is new and unvalidated; week 1 spent 200 of them on a premise
    // that did not describe the segment. 20/day is roughly 100 contacts a week,
    // enough to see whether positives exist at all without burning the rest of
    // the list to find out. Restore to 40 once a week 2 read exists.
    daily_max_leads: 20,
  },
  {
    key: 'B',
    name: 'GovHub Wave 1 - B new_prime',
    subjects: [
      '{{companyName}} next bid', // blank -> "next bid"
      'after the first award',
      'proposal workload',
    ],
    email1: B_EMAIL_1_BODY,
    daily_limit: 60, // 3 mailboxes x 20/day
    daily_max_leads: 20,
  },
  {
    key: 'C',
    name: 'GovHub Wave 1 - C registered_no_awards',
    // "first federal bid" and "getting the first bid out" carried the same
    // false premise as the old body and are replaced with it.
    subjects: [
      '{{companyName}} federal work', // blank -> "federal work"
      'back to federal bidding',
      'the pause on federal work',
    ],
    email1: C_EMAIL_1_BODY,
    daily_limit: 60, // 3 mailboxes x 20/day
    // Halved from 20 for week 2 (2026-09-12), same reasoning as A: 348 leads
    // are still untouched and the re-engagement angle is unproven.
    daily_max_leads: 10,
  },
];

// ---- Payload ------------------------------------------------------------
// Wrap every line in a <div>; a blank entry becomes an empty spacer div. Bare
// text nodes are silently discarded by the API's sanitizer (see header note).
function bodyHtml(lines) {
  return lines.map((l) => (l === '' ? '<div><br /></div>' : `<div>${l}</div>`)).join('');
}

function payload(c) {
  return {
    name: c.name,
    campaign_schedule: SCHEDULE,
    sequences: [
      {
        steps: [
          {
            // delay is the gap to the NEXT email, not a wait before this one,
            // so email 1 goes out immediately on activation and email 2
            // follows 3 days later.
            type: 'email',
            delay: 3,
            delay_unit: 'days',
            variants: c.subjects.map((subject) => ({
              subject,
              body: bodyHtml(c.email1),
            })),
          },
          {
            type: 'email',
            delay: 4,
            delay_unit: 'days',
            variants: [{ subject: '', body: bodyHtml(EMAIL_2_BODY) }],
          },
          {
            type: 'email',
            delay: 0,
            delay_unit: 'days',
            variants: [{ subject: '', body: bodyHtml(EMAIL_3_BODY) }],
          },
        ],
      },
    ],
    email_list: MAILBOXES[c.key],
    daily_limit: c.daily_limit,
    daily_max_leads: c.daily_max_leads,
    email_gap: 12, // minutes between sends, so a mailbox never bursts
    random_wait_max: 5,
    stop_on_reply: true, // structural opt-out safety: any reply halts the sequence,
    // so no missed removal keyword can cause a post-opt-out send
    stop_on_auto_reply: false, // an out-of-office should not burn the lead
    stop_for_company: true, // one conversation per company at a time
    link_tracking: false, // would rewrite the email 3 link through a 6-day-old tracking domain
    open_tracking: false, // the pixel is a remote image from a no-reputation subdomain,
    // and it would put an image into the supposedly text-only email 1
    text_only: true,
    first_email_text_only: true,
    // RFC 8058 List-Unsubscribe. Turned OFF on request 2026-09-03; turned back
    // ON on request 2026-09-12 after the week 1 review. Recording both so the
    // reversal is not mistaken for drift.
    //
    // It is a header rather than visible text, so recipients meet it as Gmail's
    // and Outlook's own one-click "Unsubscribe" control. With it off, the only
    // exits left to someone who will not reply are ignoring the mail or Report
    // Spam, and a spam complaint is the most damaging signal available to a
    // domain this young. Week 1 also showed the six influencer campaigns
    // running with it true and taking no measurable reply-rate cost, while
    // wave 1 ran without it at four times the volume.
    //
    // This does not replace the opt-out notice in every body: CAN-SPAM 15 USC
    // 7704(a)(5)(A)(ii) wants the notice in the message, and a header is not
    // the message. Both mechanisms now stand.
    insert_unsubscribe_header: true,
    prioritize_new_leads: false, // finish sequences in flight before starting new leads
    match_lead_esp: false, // every mailbox is the same provider, so this buys nothing
    allow_risky_contacts: false,
    disable_bounce_protect: false,
    auto_variant_select: null, // never auto-promote a subject on a small sample
    is_evergreen: false,
  };
}

// ---- Guardrails ---------------------------------------------------------
const BANNED = [
  'free', 'guarantee', 'winner', 'urgent', 'act now', 'limited time',
  'click here', 'discount', 'no obligation', 'risk free', '100%',
];

// Expand every RANDOM block into every possible render.
function expand(text) {
  const m = /\{\{RANDOM\|([^{}]*)\}\}/.exec(text);
  if (!m) return [text];
  const out = [];
  for (const opt of m[1].split('|')) {
    out.push(...expand(text.slice(0, m.index) + opt + text.slice(m.index + m[0].length)));
  }
  return out;
}

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

function check() {
  let fail = 0;
  const note = (ok, label, detail) => {
    if (!ok) fail++;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? '  ' + detail : ''}`);
  };

  const steps = [];
  for (const c of CAMPAIGNS) {
    steps.push({ label: `${c.key}/email1`, lines: c.email1, max: 90, subjects: c.subjects });
  }
  steps.push({ label: 'shared/email2', lines: EMAIL_2_BODY, max: 90 });
  steps.push({ label: 'shared/email3', lines: EMAIL_3_BODY, max: 130 });

  let total = 0;
  for (const s of steps) {
    // Drop the signature variable before counting: it resolves per mailbox.
    const raw = s.lines.filter((l) => l !== '{{accountSignature}}').join('\n');
    const renders = expand(raw);
    total += renders.length;

    note(!/\{\{RANDOM\|[^{}]*\{\{/.test(raw), `${s.label} no variable nested in a RANDOM block`);
    note(
      renders.every((r) => !/\{\{RANDOM|\}\}\}\}/.test(r)) &&
        renders.every((r) => (r.match(/\{\{/g) || []).length === (r.match(/\}\}/g) || []).length),
      `${s.label} braces balanced in all ${renders.length} renders`
    );
    note(!raw.includes('—'), `${s.label} no em dash`);

    const wc = renders.map((r) => words(r.replace(/\{\{\w+\}\}/g, 'x')));
    const lo = Math.min(...wc), hi = Math.max(...wc);
    note(hi <= s.max, `${s.label} word count ${lo}-${hi}`, `(limit ${s.max})`);

    const hits = new Set();
    for (const r of renders) {
      const flat = r.toLowerCase().replace(/\s+/g, ' ');
      for (const b of BANNED) if (flat.includes(b)) hits.add(b);
    }
    note(hits.size === 0, `${s.label} banned words`, hits.size ? `HITS: ${[...hits]}` : '(none)');

    const q = new Set(renders.map((r) => (r.match(/\?/g) || []).length));
    note([...q].every((n) => n <= 1), `${s.label} questions per render`, `${[...q].sort()}`);

    const links = new Set(renders.map((r) => (r.match(/https?:\/\//g) || []).length));
    const linkMax = s.label === 'shared/email3' ? 1 : 0;
    note([...links].every((n) => n <= linkMax), `${s.label} links per render`, `${[...links]} (max ${linkMax})`);

    note(
      renders.every((r) => !/^\s*[,.?!]/.test(r)),
      `${s.label} no render opens with punctuation`
    );
    // The opt-out has to be present AND has to not sound like a mailing list.
    // Changed 2026-09-04: "remove" and "off my list" tell the reader they were
    // on a list, which is the one thing a cold email cannot afford to admit on
    // the way out. Both halves are checked, so neither the instruction nor the
    // voice can regress silently.
    note(/reply "no"/i.test(raw), `${s.label} carries an opt-out line`);
    note(
      !/\b(remove|unsubscribe|opt[- ]?out|off my list|off this list|mailing list|your list)\b/i.test(raw),
      `${s.label} opt-out reads personal, not list-managed`
    );

    // The sanitizer discards bare text nodes, so every line must be inside a div.
    const assembled = bodyHtml(s.lines);
    note(
      !/(^|>)[^<>]*[A-Za-z]{3}[^<>]*(<|$)/.test(assembled.replace(/<div>[^<]*<\/div>/g, '')),
      `${s.label} every line is wrapped in a div (no bare text nodes)`
    );

    if (s.subjects) {
      // A blank merge field must leave a subject with a real word in it.
      const blanks = s.subjects.map((x) => x.replace(/\{\{\w+\}\}/g, '').trim());
      note(
        blanks.every((b) => /[a-z]{2}/i.test(b)),
        `${s.label} subjects survive a blank merge field`,
        blanks.map((b) => `"${b}"`).join(' ')
      );
    }
  }

  const allMbx = Object.values(MAILBOXES).flat();
  note(new Set(allMbx).size === allMbx.length, 'no mailbox is shared between campaigns', `${allMbx.length} total`);
  const domains = allMbx.map((m) => m.split('@')[1]);
  note(new Set(domains).size === domains.length, 'one mailbox per domain', `${new Set(domains).size} domains`);

  console.log(`\n${total} total renders checked. ${fail === 0 ? 'All guardrails pass.' : fail + ' FAILURES.'}`);
  return fail;
}

// ---- API ----------------------------------------------------------------
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 2000)}`);
  return json;
}

const arg = process.argv[2] || '--check';

async function findByName(name) {
  const r = await api('GET', '/campaigns?limit=100');
  return (r.items || []).find((c) => c.name === name);
}

// Assert the copy actually survived the server-side sanitizer. A 200 on create
// does not mean the body was stored: bare text nodes come back stripped.
function assertStored(c, sent) {
  const problems = [];
  const steps = c.sequences?.[0]?.steps || [];
  const want = sent.sequences[0].steps;
  if (steps.length !== want.length) problems.push(`step count ${steps.length} != ${want.length}`);
  steps.forEach((s, i) => {
    if (s.delay !== want[i].delay) problems.push(`step ${i + 1} delay ${s.delay} != ${want[i].delay}`);
    s.variants.forEach((v, j) => {
      const text = v.body.replace(/<[^>]*>/g, '').trim();
      if (text.length < 80) problems.push(`step ${i + 1} variant ${j} body stripped (${text.length} chars of text)`);
      if (!v.body.includes('{{RANDOM')) problems.push(`step ${i + 1} variant ${j} lost its spintax`);
      if (!v.body.includes('{{accountSignature}}')) problems.push(`step ${i + 1} variant ${j} lost the signature`);
      if (/\}\}\}\}|\{\{RANDOM[^}]*\{\{/.test(v.body)) problems.push(`step ${i + 1} variant ${j} has a brace artifact`);
    });
  });
  const mbx = c.email_list || [];
  if (mbx.length !== sent.email_list.length) problems.push(`mailboxes ${mbx.length} != ${sent.email_list.length}`);
  if (c.status !== 0 && c.status !== 2) problems.push(`status ${c.status} is neither Draft(0) nor Paused(2)`);
  return problems;
}

if (arg === '--check') {
  process.exit(check() === 0 ? 0 : 1);
} else if (arg === '--dry-run') {
  for (const c of CAMPAIGNS) console.log(JSON.stringify(payload(c), null, 2));
} else if (arg === '--sync') {
  if (check() !== 0) { console.error('\nGuardrails failed. Nothing sent to the API.'); process.exit(1); }
  if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }
  let bad = 0;
  for (const c of CAMPAIGNS) {
    const body = payload(c);
    const existing = await findByName(c.name);
    let id;
    if (existing) {
      // PATCH takes the same shape as create, minus the read-only fields.
      await api('PATCH', `/campaigns/${existing.id}`, body);
      id = existing.id;
      console.log(`updated ${c.key}  ${id}`);
    } else {
      const r = await api('POST', '/campaigns', body);
      id = r.id;
      console.log(`created ${c.key}  ${id}  status=${r.status}`);
    }
    const stored = await api('GET', `/campaigns/${id}`);
    const problems = assertStored(stored, body);
    if (problems.length) { bad++; console.log(`  FAIL ${problems.join('; ')}`); }
    else console.log(`  ok   copy stored intact, status=${stored.status} (0=Draft), ${(stored.email_list || []).length} mailboxes`);
  }
  process.exit(bad === 0 ? 0 : 1);
} else if (arg === '--mailbox-limits') {
  // Deliberately NOT part of --sync. --sync writes campaigns and is safe to
  // run at any time; this writes shared mailbox accounts, which the influencer
  // campaigns also draw on by domain, so it stays an explicit choice.
  //
  // The campaign cap controls total volume, never its distribution. Without a
  // per-mailbox ceiling two mailboxes can absorb the whole daily allowance
  // while ten sit idle, which is the opposite of the twelve-independent-
  // readings design and the fastest way to burn a single domain.
  const wanted = MAILBOX_DAILY_LIMIT;
  const all = Object.values(MAILBOXES).flat();
  let set = 0, already = 0, failed = 0;
  for (const m of all) {
    try {
      const cur = await api('GET', `/accounts/${encodeURIComponent(m)}`);
      if (cur.daily_limit === wanted) { already++; console.log(`  ok   ${m.padEnd(34)} already ${wanted}`); continue; }
      const r = await api('PATCH', `/accounts/${encodeURIComponent(m)}`, { daily_limit: wanted });
      if (r.daily_limit !== wanted) throw new Error(`stored ${r.daily_limit}, wanted ${wanted}`);
      set++;
      console.log(`  set  ${m.padEnd(34)} ${cur.daily_limit} -> ${wanted}`);
    } catch (e) {
      failed++;
      console.log(` FAIL ${m}  ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`\n${set} changed, ${already} already correct, ${failed} failed.`);
  console.log(`${all.length} mailboxes x ${wanted}/day = ${all.length * wanted}/day of mailbox headroom.`);
  console.log('Campaign caps are what actually meter the sending; this is the ceiling under them.');
} else if (arg === '--verify') {
  let bad = 0;
  for (const c of CAMPAIGNS) {
    const existing = await findByName(c.name);
    if (!existing) { console.log(`MISSING  ${c.name}`); bad++; continue; }
    const stored = await api('GET', `/campaigns/${existing.id}`);
    const problems = assertStored(stored, payload(c));
    const steps = stored.sequences[0].steps;
    console.log(
      `${problems.length ? 'FAIL' : ' ok '}  ${stored.id}  status=${stored.status}  daily=${stored.daily_limit}` +
        `  mbx=${(stored.email_list || []).length}  steps=${steps.length}` +
        `  variants=[${steps.map((s) => s.variants.length)}]  delays=[${steps.map((s) => s.delay)}]  ${stored.name}`
    );
    if (problems.length) { bad++; problems.forEach((p) => console.log(`        ${p}`)); }
  }
  process.exit(bad === 0 ? 0 : 1);
} else {
  console.error(`unknown flag ${arg}`);
  process.exit(1);
}
