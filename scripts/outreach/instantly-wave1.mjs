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
//     solicitation, opt-out notice, and a postal address. The postal address and
//     the solicitation line ship in the per-mailbox {{accountSignature}}; the
//     opt-out notice is in the body so it cannot depend on a mailbox setting.
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
  // Hard floor on the first send. Every mailbox and domain in this workspace was
  // created 2026-08-06, so they are 6 days old. Instantly's own guidance is a
  // 2-week minimum before campaign sends; 3 weeks is the defensible number.
  // Even if someone activates early, nothing goes out before this date.
  start_date: '2026-08-27',
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
  '{{RANDOM|Want me to send a short example on a live solicitation?|Worth putting together a quick example on a real solicitation?}}',
  '',
  '{{RANDOM|If I am barking up the wrong tree, just say so and I will close this out.|If this is not relevant, tell me and I will leave you be.}} Reply "remove" and you are off my list.',
  '',
  '{{accountSignature}}',
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
  '{{RANDOM|If the timing is off, no problem at all.|If now is not the time, all good.}} {{RANDOM|Reply "remove" and you will not hear from me again.|Say "remove" and I will take you off my list.}}',
  '',
  '{{accountSignature}}',
];

// ---- Campaign A: serial_bidder -------------------------------------------
// They bid constantly. The pain is throughput, review nights, and compliance
// slips on bids they should have won.
const A_EMAIL_1_BODY = [
  '{{RANDOM|Hey|Hi}} {{firstName}}, {{RANDOM|noticed|saw}} {{companyName}} {{RANDOM|has been bidding|keeps showing up on}} federal work {{RANDOM|lately|this year}}.',
  '',
  '{{RANDOM|Most|A lot of}} small primes {{RANDOM|we work with|I talk to}} {{RANDOM|lose winnable bids|walk away from good bids}} on compliance technicalities, not price. {{RANDOM|Someone|A proposal lead}} misses a Section L instruction at 11pm and {{RANDOM|the whole thing gets tossed|the bid is dead on arrival}}.',
  '',
  'We built GovHub so a small team can {{RANDOM|hand it the RFP|upload the RFP}} and get {{RANDOM|a compliance matrix and a working draft back|a compliance matrix plus a first draft}} {{RANDOM|the same day|in hours, not days}}.',
  '',
  '{{RANDOM|Worth a quick look?|Open to a look on a live RFP?|Want me to send a 2-minute example?}}',
  '',
  'Reply "remove" and I will stop.',
  '',
  '{{accountSignature}}',
];

// ---- Campaign B: new_prime ----------------------------------------------
// They broke through. The next wins are harder because agencies expect more
// polish and the founder is still writing proposals at night.
//
// The doc's opener nested {{companyName}} inside a RANDOM block and fed a
// singular subject ("the founder") into plural verbs ("still write"), which
// broke half of this campaign's renders. Both are restructured here.
const B_EMAIL_1_BODY = [
  '{{RANDOM|Hey|Hi}} {{firstName}}, saw {{companyName}} {{RANDOM|recently landed federal work|picked up federal work recently}}.',
  '',
  '{{RANDOM|The pattern we see|What we keep seeing}}: the first award comes on hustle, then {{RANDOM|bid volume has to go up|the volume has to climb}} while {{RANDOM|the same one or two people are|the founder is}} still {{RANDOM|writing every proposal by hand|doing all the writing at night}}.',
  '',
  'GovHub {{RANDOM|reads the RFP, builds the compliance matrix, and drafts the sections|turns an RFP into a compliance matrix and a working draft}} so you can {{RANDOM|chase more of the right bids|bid more without burning out}}.',
  '',
  '{{RANDOM|Open to a look?|Want a 2-minute example on a solicitation you are watching?}}',
  '',
  'Reply "remove" and I will stop.',
  '',
  '{{accountSignature}}',
];

// ---- Campaign C: registered_no_awards -----------------------------------
// Colder intent, expect lower reply rates. Run only if you need volume beyond
// A and B. The doc's opener told the prospect the research turned up nothing
// they had won, which is a status dig on the first line; reframed forward.
const C_EMAIL_1_BODY = [
  '{{RANDOM|Hey|Hi}} {{firstName}}, {{RANDOM|saw|noticed}} {{companyName}} is registered in SAM and {{RANDOM|looks set up to bid|looks ready to go after prime work}}.',
  '',
  '{{RANDOM|The honest blocker for most first-time primes|What stops most firms from their first win}} is not capability. It is {{RANDOM|the proposal itself|getting a compliant proposal out the door}}. {{RANDOM|Miss one instruction and the bid is tossed unread.|One missed requirement and it never gets scored.}}',
  '',
  'GovHub reads the RFP, builds the compliance matrix, and drafts the sections, so {{RANDOM|a small team can submit like a big one|you can get a clean bid in on time without a proposal shop}}.',
  '',
  '{{RANDOM|Want to see it on a live solicitation?|Want me to walk it through your first bid?}}',
  '',
  'Reply "remove" and I will stop.',
  '',
  '{{accountSignature}}',
];

// Subject variants are real A/B variants, not spintax, so Instantly reports
// per-variant reply rate. Every one keeps a real word so a blank merge field
// degrades to a shorter valid subject instead of "(no subject)" or "?".
// CTA and subject vocabulary are disjoint across campaigns: identical closing
// lines across all three would undo the point of varying the fingerprint.
const CAMPAIGNS = [
  {
    key: 'A',
    name: 'GovHub Wave 1 - A serial_bidder',
    subjects: [
      '{{companyName}} proposals', // blank -> "proposals"
      'federal bids',
      'Section L compliance',
    ],
    email1: A_EMAIL_1_BODY,
    daily_limit: 30, // 6 mailboxes x 5/day
    daily_max_leads: 12,
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
    daily_limit: 15, // 3 mailboxes x 5/day
    daily_max_leads: 6,
  },
  {
    key: 'C',
    name: 'GovHub Wave 1 - C registered_no_awards',
    subjects: [
      '{{companyName}} bids', // blank -> "bids"
      'first federal bid',
      'getting the first bid out',
    ],
    email1: C_EMAIL_1_BODY,
    daily_limit: 15, // 3 mailboxes x 5/day
    daily_max_leads: 6,
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
    // RFC 8058 List-Unsubscribe. Turned OFF on request 2026-09-03. This is a
    // header rather than visible text, so recipients meet it as Gmail's and
    // Outlook's one-click "Unsubscribe" control; with it off, the only exits
    // left to someone who will not reply are ignoring the mail or Report Spam,
    // and a spam complaint is the most damaging signal available to a domain
    // this young. The trade was put to the account holder with that stated and
    // this is the answer. The opt-out notice in every body is unaffected.
    insert_unsubscribe_header: false,
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
    note(/remove/i.test(raw), `${s.label} carries an opt-out line`);

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
