// B-line campaigns: GH-B4-CompetitorWon and GH-B2-MatchedRFP.
//
// The two angles that earn positive replies (A4 0.66%, A2 0.61% real positive
// per person, against A1 0.31% and A5 0.18%), rebuilt for a fresh audience.
// Designed 2026-11-03/04 from the live Instantly audit and the owner's
// research pass; docs/instantly-angle-coverage.md has the evidence.
//
// WHAT THE COPY IS BUILT ON
//
//   Email 1 is one pre-rendered line, {{opener}}, 150-200 characters, no link.
//   The pipeline renders it per lead and picks the richest variant that fits
//   200 (competitor + city + agency for B4; agency + close date for B2), so a
//   long competitor or agency name can never push it over. Tested against all
//   1,089 real A4 and 2,828 real A2 leads: every render lands in range.
//
//   Emails 2 and 3 stay on the offer that got the yes. A4's positives came
//   5 of 7 on its follow-ups, and those follow-ups were 18-word offer-only
//   lines ("want the next three in your lane before they close?"). A pitch in
//   their place would replace the best performers with an untested format.
//   So the main email 2 is under 60 words with one value link (the reader's
//   own state bid page), and "send" is the only ask in every step.
//
//   The long one-stop email 2 (price, BidNet/BidPrime comparison, Calendly)
//   runs as ONE OF FOUR step-2 variants: Instantly has no variant weights,
//   only on/off, and splits evenly across enabled variants, so three identical
//   short variants plus one long one is a 25% arm. Read it as short = sum of
//   variants A-C, long = D, on positive replies per person, never opens.
//
//   Calendly lives in the accept handover, where a meeting ask belongs, and in
//   the 25% arm. The event is 30 minutes, so no copy promises 15.
//
//   Price, when it appears, is annual against annual: BidNet Direct's national
//   plan is $1,999/yr per third-party captures of its pricing page in 2026
//   (its own site refuses automated reads; re-check by hand before volume),
//   with federal bids an add-on. GovHub Solo is $1,290/yr with 3 proposals a
//   month. "Compliance checking" is a Pro feature, so no line ties it to $129.
//
// Usage (INSTANTLY_API_KEY in env):
//   node scripts/outreach/instantly-bline.mjs --check     guardrails only, no network
//   node scripts/outreach/instantly-bline.mjs --dry-run   print the payloads
//   node scripts/outreach/instantly-bline.mjs --sync      create as DRAFT, or update while still draft
//   node scripts/outreach/instantly-bline.mjs --verify    read back and compare
//
// --sync never touches a campaign that has left draft. Activation and the
// per-day caps are a separate, deliberate step (docs/bline-launch.md).

const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

const CALENDLY = 'https://calendly.com/earljknight/30min';
const BIDS = 'https://www.govhub.online/bids/{{state_slug}}/';

// Same sending window as the angle campaigns, so deliverability behaviour
// matches. start_date is the planned launch: a backstop, since a draft sends
// nothing until activated anyway.
const SCHEDULE = {
  start_date: '2026-11-10',
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

const TAIL = ['', '{{accountSignature}}'];

// ---- Mailboxes ------------------------------------------------------------
// B4 launches on A5's twelve (owner decision 2026-11-10, "option A"): A5 was
// retired for new leads on 11-04 and its ~700 in-flight leads finish around
// 11-20, so its follow-ups use a fraction of 12 x 25 = 300/day. Instantly's
// 25/day limit is per mailbox, so the two campaigns cannot overdraw a box;
// the cost is that a burned govhubnow/hq/submittals/rfp domain hits both.
// Same list as MAILBOXES.A5 in instantly-angles.mjs, which keeps them too:
// a box is never pulled from a campaign mid-sequence.
const MAILBOXES = {
  B4: [
    'earl.knight@govhubnow.com', 'earl@govhubnow.com', 'e.knight@govhubnow.com',
    'earl.knight@govhubhq.com', 'earl@govhubhq.com', 'e.knight@govhubhq.com',
    'earl.knight@govhubsubmittals.com', 'e.knight@govhubsubmittals.com', 'earl@govhubsubmittals.com',
    'e.knight@govhubrfp.com', 'earl@govhubrfp.com', 'earl.knight@govhubrfp.com',
  ],
  // B2 on A2's twenty-one (owner decision 2026-11-10): A2 has no new leads
  // left and ~460 in flight that finish within a week. Same list as
  // MAILBOXES.A2 in instantly-angles.mjs, which keeps them too.
  B2: [
    'earl.knight@govhubcontracts.com', 'e.knight@govhubcontracts.com', 'earl@govhubcontracts.com',
    'earl.knight@govhubprocurement.com', 'e.knight@govhubprocurement.com', 'earl@govhubprocurement.com',
    'earl.knight@govhubcapture.com', 'earl@govhubcapture.com', 'e.knight@govhubcapture.com',
    'earl.knight@trygovhub.com', 'e.knight@trygovhub.com', 'earl@trygovhub.com',
    'e.knight@govhubbids.com', 'earl.knight@govhubbids.com', 'earl@govhubbids.com',
    'e.knight@govhubproposal.com', 'earl.knight@govhubproposal.com', 'earl@govhubproposal.com',
    'j.knight@bidwithgovhub.com', 'j.k@bidwithgovhub.com', 'e.knight@bidwithgovhub.com',
  ],
};

// ===========================================================================
// B4  Competitor just won  (from A4)
// ===========================================================================
const B4 = {
  key: 'B4',
  name: 'GH-B4-CompetitorWon',
  // Placeholder until mailboxes are assigned at activation: 3 steps settle at
  // ~3x the new-lead rate, so daily_limit = 3 x this.
  daily_max_leads: 75,
  required: ['opener', 'naics_code', 'state_name', 'state_slug'],
  // A2/A4 subject tests were too small to call. "next 3 in 238220" is the short
  // human variant; "did you see this" is A4's own control subject.
  subjects: ['next 3 in {{naics_code}}', 'did you see this'],
  steps: [
    { delay: 3, variants: [['{{opener}}']] },
    {
      delay: 5, // email 3 on day 8: GovCon buyers move on agency time
      variants: [
        ...Array(3).fill([
          '{{firstName}}, one more thing on this.',
          '',
          'Here\'s what\'s open in {{state_name}} right now:',
          BIDS,
          '',
          'GovHub finds bids like these in your NAICS, then writes the proposal and fills out the forms. Want the next 3 in {{naics_code}} sent to you? Reply "send."',
        ]),
        [
          '{{firstName}}, quick context on GovHub.',
          '',
          'We\'re one stop from solicitation to submission: we match you to bids in your NAICS, write the proposal, fill out the forms, and check it for compliance before you submit.',
          '',
          'Our bid finder is the same kind BidNet and BidPrime sell (federal, state, local and school bids, 13,000+ open now), but they stop at the bid. GovHub is $1,290 a year nationwide with 3 proposals a month written for you. BidNet\'s national plan is $1,999 a year for search alone.',
          '',
          'What\'s open in {{state_name}} today:',
          BIDS,
          '',
          `Reply "send" and I'll email the next 3 in your lane before they close. Or grab a time: ${CALENDLY}`,
        ],
      ],
    },
    {
      delay: 0,
      variants: [[
        '{{firstName}}, last note. If bids in {{naics_code}} aren\'t a priority right now, no worries. If they are, reply "send" and I\'ll email you the next 3 open ones before they close.',
      ]],
    },
  ],
};

// ===========================================================================
// B2  Matched open solicitation  (from A2, base arm: the disqualifier list)
// ===========================================================================
const B2 = {
  key: 'B2',
  name: 'GH-B2-MatchedRFP',
  daily_max_leads: 100,
  required: ['opener', 'sol_subject', 'sol_agency_short', 'sol_close_date', 'naics_code', 'state_name', 'state_slug'],
  // A timeline hook in the subject ("VA bid, closes Nov 24") against the title.
  subjects: ['{{sol_agency_short}} bid, closes {{sol_close_date}}', '{{sol_subject}}'],
  steps: [
    { delay: 2, variants: [['{{opener}}']] },
    {
      delay: 3, // tight on purpose: the close date drives this one
      variants: [
        ...Array(3).fill([
          // "I can have it to you", not "it's ready": the list is built on accept.
          '{{firstName}}, on the {{sol_agency_short}} bid: I can have the disqualifier list to you before {{sol_close_date}}, no charge.',
          '',
          'If you\'d rather hand off the whole bid, we write the proposal and fill out the forms too. More like it in {{state_name}}:',
          BIDS,
          '',
          'Reply "send" for the list.',
        ]),
        [
          '{{firstName}}, on the {{sol_agency_short}} one: I can send you the disqualifier list, free, before {{sol_close_date}}.',
          '',
          'Or we can take the whole bid off your plate. GovHub is one stop from solicitation to submission: we match you to bids in your NAICS, write the proposal, fill out the forms, and check it for compliance. Same kind of bid finder BidNet and BidPrime sell, but they stop at the bid. $1,290 a year nationwide, 3 proposals a month included.',
          '',
          'Open in {{state_name}} right now:',
          BIDS,
          '',
          `Reply "send" for the list, or grab a time: ${CALENDLY}`,
        ],
      ],
    },
    {
      delay: 0,
      variants: [[
        '{{firstName}}, last one from me. If the {{sol_agency_short}} bid is too tight, more like it post in {{state_name}} every week. Want the next 3 in NAICS {{naics_code}}? Reply "send."',
      ]],
    },
  ],
};

const LINES = [B4, B2];

// ---- Payload --------------------------------------------------------------
const bodyHtml = (lines) =>
  lines.map((l) => (l === '' ? '<div><br /></div>' : `<div>${l}</div>`)).join('');
const withTail = (lines) => [...lines, ...TAIL];

function payload(a) {
  return {
    name: a.name,
    campaign_schedule: SCHEDULE,
    sequences: [{
      steps: a.steps.map((s, i) => ({
        type: 'email',
        delay: s.delay,
        delay_unit: 'days',
        variants: i === 0
          ? a.subjects.map((subject) => ({ subject, body: bodyHtml(withTail(s.variants[0])) }))
          : s.variants.map((v) => ({ subject: '', body: bodyHtml(withTail(v)) })),
      })),
    }],
    email_list: MAILBOXES[a.key],
    daily_limit: a.daily_max_leads * 3,
    daily_max_leads: a.daily_max_leads,
    email_gap: 12,
    random_wait_max: 5,
    stop_on_reply: true,
    stop_on_auto_reply: false,
    stop_for_company: false,
    link_tracking: false,
    open_tracking: false,
    text_only: true,
    first_email_text_only: true,
    insert_unsubscribe_header: false, // standing decision, see instantly-wave1.mjs
    prioritize_new_leads: false,
    match_lead_esp: false,
    allow_risky_contacts: false,
    disable_bounce_protect: false,
    auto_variant_select: null, // it would pick on raw replies; we judge on positives
    is_evergreen: false,
  };
}

// ---- Guardrails -----------------------------------------------------------
const BANNED = ['guaranteed', 'guarantee', 'winner', 'urgent', 'act now', 'limited time',
  'click here', 'discount', 'no obligation', 'risk free', '100%'];
const BUILTINS = new Set(['firstName', 'companyName', 'accountSignature']);
const TOKEN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

function words(lines) {
  return lines.join(' ').replace(/https?:\/\/\S+/g, '').replace(TOKEN, 'X').split(/\s+/).filter(Boolean).length;
}

function check() {
  let fail = 0;
  const note = (ok, label, detail) => {
    if (!ok) fail++;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? '  ' + detail : ''}`);
  };
  for (const a of LINES) {
    const declared = new Set(a.required);
    const used = new Set();
    note(a.steps.length === 3, `${a.key} has 3 steps`, `delays ${a.steps.map((s) => s.delay)}`);
    note(a.steps[0].variants.length === 1 && a.steps[0].variants[0].join('') === '{{opener}}',
      `${a.key}/email1 is the pre-rendered {{opener}} only`);
    a.steps.forEach((s, i) => {
      s.variants.forEach((v, j) => {
        const label = `${a.key}/email${i + 1}${s.variants.length > 1 ? String.fromCharCode(65 + j) : ''}`;
        const raw = withTail(v).join('\n');
        const toks = [...raw.matchAll(TOKEN)].map((m) => m[1]);
        toks.forEach((t) => used.add(t));
        const unknown = toks.filter((t) => !BUILTINS.has(t) && !declared.has(t));
        note(!unknown.length, `${label} tokens declared`, unknown.length ? `UNKNOWN: ${unknown}` : '');
        note(!raw.includes('—'), `${label} no em dash`);
        const flat = raw.toLowerCase();
        const hits = BANNED.filter((b) => flat.includes(b));
        note(!hits.length, `${label} banned words`, hits.length ? `HITS: ${hits}` : '');
        note(raw.includes('{{accountSignature}}'), `${label} carries the postal address`);
        note(!/unsubscribe|opt out|opt-out|remove me|reply "no"/i.test(raw), `${label} no unsubscribe language`);
        const links = raw.match(/https?:\/\/\S+/g) || [];
        const isLong = s.variants.length > 1 && j === s.variants.length - 1;
        const maxLinks = i === 0 ? 0 : i === 2 ? 0 : isLong ? 2 : 1;
        note(links.length <= maxLinks, `${label} links <= ${maxLinks}`, `${links.length}`);
        note(links.every((l) => l === BIDS || l === CALENDLY), `${label} links are the state bid page or Calendly only`);
        if (i > 0 && !isLong) note(words(v) <= 60, `${label} under 60 words`, `${words(v)}`);
        note(/reply "send/i.test(raw) || i === 0, `${label} asks for "send"`);
        note(!/15[ -]minute/i.test(raw), `${label} promises no 15 minutes on a 30-minute event`);
        note(!/\$129\b[^.]*compliance|compliance[^.]*\$129\b/i.test(raw), `${label} does not tie compliance to $129`);
      });
    });
    const unused = a.required.filter((r) => !used.has(r) && !a.subjects.some((s) => s.includes(`{{${r}}}`)));
    note(!unused.length, `${a.key} every required variable is used`, unused.length ? `UNUSED: ${unused}` : '');
    for (const s of a.subjects) {
      const toks = [...s.matchAll(TOKEN)].map((m) => m[1]);
      note(toks.every((t) => declared.has(t)), `${a.key} subject "${s}" uses only gated variables`);
    }
  }
  const start = new Date(SCHEDULE.start_date);
  note(!Number.isNaN(start.valueOf()), 'start_date parses', SCHEDULE.start_date);
  console.log(`\n${fail === 0 ? 'All guardrails pass.' : fail + ' FAILURES.'}`);
  return fail;
}

// ---- API ------------------------------------------------------------------
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 1200)}`);
  return json;
}

async function findByName(name) {
  let cursor = null;
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('starting_after', cursor);
    const r = await api('GET', `/campaigns?${q}`);
    const hit = (r.items || []).find((c) => c.name === name);
    if (hit) return hit;
    cursor = r.next_starting_after;
    if (!cursor || !(r.items || []).length) return null;
  }
  return null;
}

function compare(stored, sent) {
  const problems = [];
  const got = stored.sequences?.[0]?.steps || [];
  const want = sent.sequences[0].steps;
  if (got.length !== want.length) problems.push(`steps ${got.length} != ${want.length}`);
  want.forEach((w, i) => {
    const g = got[i] || {};
    if (g.delay !== w.delay) problems.push(`step ${i + 1} delay ${g.delay} != ${w.delay}`);
    const gv = g.variants || [];
    if (gv.length !== w.variants.length) problems.push(`step ${i + 1} variants ${gv.length} != ${w.variants.length}`);
    w.variants.forEach((wv, j) => {
      const a = (gv[j]?.body || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const b = wv.body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (a !== b) problems.push(`step ${i + 1} variant ${j + 1} body differs`);
      if (i === 0 && (gv[j]?.subject || '') !== wv.subject) problems.push(`step 1 subject ${j + 1} differs`);
    });
  });
  if ((stored.email_list || []).length !== sent.email_list.length) problems.push(`mailboxes ${(stored.email_list || []).length} != ${sent.email_list.length}`);
  if (stored.link_tracking || stored.open_tracking) problems.push('tracking is on');
  if (stored.auto_variant_select) problems.push('auto_variant_select is on');
  return problems;
}

const arg = process.argv[2] || '--check';
if (arg === '--check') {
  process.exit(check() ? 1 : 0);
} else if (arg === '--dry-run') {
  for (const a of LINES) console.log(JSON.stringify(payload(a), null, 2));
} else if (arg === '--sync' || arg === '--verify') {
  if (check()) { console.error('\nGuardrails failed. Nothing sent to the API.'); process.exit(1); }
  if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }
  let bad = 0;
  for (const a of LINES) {
    const body = payload(a);
    let c = await findByName(a.name);
    if (arg === '--sync') {
      if (!c) {
        const r = await api('POST', '/campaigns', body);
        console.log(`created ${a.key} ${r.id}  ${a.name}  status=${r.status}`);
        c = r;
      } else if (c.status === 0) {
        await api('PATCH', `/campaigns/${c.id}`, body);
        console.log(`updated ${a.key} ${c.id}  ${a.name}  (still draft)`);
      } else {
        console.log(`SKIP    ${a.key} ${c.id}  status=${c.status}: no longer a draft, --sync will not touch it`);
        continue;
      }
    }
    if (!c) { console.log(`MISSING ${a.name}`); bad++; continue; }
    const stored = await api('GET', `/campaigns/${c.id}`);
    const problems = compare(stored, body);
    if (problems.length) { bad++; console.log(`  FAIL ${problems.join('; ')}`); }
    else console.log(`  ok   ${a.key} stored intact, status ${stored.status} (0 = draft), ${(stored.email_list || []).length} mailboxes`);
  }
  process.exit(bad ? 1 : 0);
} else {
  console.error(`unknown argument ${arg}`);
  process.exit(1);
}
