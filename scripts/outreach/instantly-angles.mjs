// Signal personalization v1: the five angle campaigns.
//
// Builds GH-A1-Recompete, GH-A2-MatchedRFP, GH-A4-CompetitorWon
// and GH-A5-DebriefPain from the copy in docs/signal-personalization-runbook.md
// Section 7, via POST /api/v2/campaigns. Created PAUSED with no leads: the push
// job (job_push) is what puts anyone in them, and it will not run before the
// dry run is signed off.
//
// Everything in instantly-wave1.mjs about this API still applies and is not
// repeated: the sanitizer discards bare text nodes so every line needs a <div>,
// the timezone enum has no America/New_York, and a 200 on create does not mean
// the body was stored. --verify re-reads and asserts.
//
// ---------------------------------------------------------------------------
// THREE DELIBERATE DEVIATIONS FROM THE RUNBOOK, all recorded rather than
// silently applied:
//
// 1. TOKEN SYNTAX. Section 7 writes {{first_name}} and {{company_name}}.
//    Instantly's built-ins on this account are camelCase: a live read of wave 1
//    campaign A shows firstName, companyName, accountSignature. Snake_case
//    would render empty, which rule 0.7 forbids. The runbook's own Phase 6 note
//    says to confirm by fetching an existing campaign and reuse what it
//    contains, so that is what these bodies use. CUSTOM variables stay
//    lowercase snake_case exactly as Section 7 defines them, because those are
//    keys we pass ourselves in the lead payload.
//
// 2. OPT-OUT AND POSTAL ADDRESS. Section 7's copy carries neither. Every other
//    campaign in this workspace carries both in every step, because CAN-SPAM
//    15 USC 7704(a)(5)(A) wants the opt-out notice (ii) and a postal address
//    (iii) in EVERY commercial message, with penalties assessed per message and
//    no "self-evidently a solicitation" defence available for (ii). The address
//    ships inside {{accountSignature}}; the notice is body copy so it cannot
//    depend on a mailbox setting. This is settled practice here (see the
//    two-round history in instantly-influencer.mjs) and is not re-litigated per
//    angle. Both are appended to all 20 steps, below the signature so they do
//    not compete with the CTA.
//
// 3. NO SPINTAX. Wave 1 varies its fingerprint with {{RANDOM|a|b}}. These
//    bodies have none, because the personalization variables already make every
//    send unique, and spintax on top would make the per-angle reply rate harder
//    to attribute. Deliberate, not an omission.
// ---------------------------------------------------------------------------
//
// Env: INSTANTLY_API_KEY
// Usage:
//   node scripts/outreach/instantly-angles.mjs --check    guardrails, no API calls
//   node scripts/outreach/instantly-angles.mjs --dry-run  print the exact payloads
//   node scripts/outreach/instantly-angles.mjs --sync     create or update in place
//   node scripts/outreach/instantly-angles.mjs --verify   re-read and assert the copy
//   node scripts/outreach/instantly-angles.mjs --config   print SQL to store campaign ids

const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

// ---- Schedule -------------------------------------------------------------
// Copied from wave 1 campaign A on 2026-09-21 so deliverability behaviour is
// identical (runbook 0.5), with one change: start_date moves forward. Wave 1's
// 2026-09-07 is in the past, which means it is a spent backstop that would
// stop nothing. A near-future date gives the dry run and the visual check room
// to happen before anything can physically send.
const SCHEDULE = {
  start_date: '2026-09-23',
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
// The twelve warmed wave 1 mailboxes, reallocated. Runbook 6 is explicit that
// total volume must not rise: this is the budget freed by cutting the dead
// variant to 1 new lead a day, not new capacity.
//
// No mailbox serves two ANGLE campaigns, so each angle gets an independent
// placement reading. They do still overlap with wave 1 A/B/C, which is
// intended and is the whole point of reallocating, but it means wave 1's
// decaying follow-up load shares these accounts' 20/day ceiling for the next
// couple of weeks. Capacity check at steady state, 4 steps per sequence:
//   A5 15 new/day x 4 =  60/day over 4 mailboxes (80 available)
//   A1 10 new/day x 4 =  40/day over 2 mailboxes (40 available)
//   A2 20 x 4         =  80/day over 4 (80)
//   A4 10 x 4         =  40/day over 2 (40)
// A3 WAS REMOVED: both SAM.gov keys failed, so it sat at 0% coverage while
// holding 10 daily slots and two mailboxes open for mail it could never
// generate. Its cap went to A2, which is the only angle whose supply exceeds
// its cap by two orders of magnitude, and its two mailboxes went with it --
// A2 at 20 new/day needs 80/day of sending room and two mailboxes only carry
// 40. Raising a cap without moving the mailboxes would have throttled it right
// back down.
// A1 and A4 are provisioned to the cap, but their cells are data-driven and
// will usually be smaller, so real load sits well under.
const MAILBOXES = {
  A1: ['earl.knight@buildwithgovhub.com', 'earl.knight@usegovhub.com'],
  A2: [
    'earl.knight@govhubcontracts.com',
    'earl.knight@govhubprocurement.com',
    'earl.knight@govhubcapture.com',   // freed by A3's removal
    'earl.knight@trygovhub.com',       // freed by A3's removal
  ],
  A4: ['earl.knight@getgovhub.com', 'earl.knight@govhubteam.com'],
  A5: [
    'earl.knight@govhubnow.com',
    'earl.knight@govhubhq.com',
    'earl.knight@govhubsubmittals.com',
    'e.knight@govhubrfp.com',
  ],
};

// ---- Shared tail ----------------------------------------------------------
// Appended to every step. See deviation 2 above.
const TAIL = ['', '{{accountSignature}}', '', 'Reply "no" and I will not reach out again.'];

// ===========================================================================
// A1  Recompete clock
// ===========================================================================
const A1 = {
  key: 'A1',
  name: 'GH-A1-Recompete',
  daily_max_leads: 10,
  required: ['agency_short', 'contract_end_month'],
  subjects: ['recompete', '{{contract_end_month}} question'],
  steps: [
    {
      delay: 3,
      lines: [
        'Hi {{firstName}}, your {{agency_short}} contract looks like it runs out in {{contract_end_month}}. Recompetes usually post 60 to 90 days ahead, and losing your own recompete is the loss nobody plans for. It almost never comes down to price, it comes down to compliance and a proposal written like the first one. If I put together a short rundown of what would get {{companyName}}\'s recompete bid tossed before anyone reads it, want me to send it over?',
      ],
    },
    { delay: 4, lines: ['{{firstName}}, want the recompete rundown? Two minutes to read, nothing to install, no call.'] },
    { delay: 5, lines: ['Should I just record a 3 minute video walking through what I\'d flag on the recompete instead? Zero prep on your end.'] },
    { delay: 0, lines: ['Want me to close this out, {{firstName}}? If {{contract_end_month}} is already handled, say the word and I\'ll stop here.'] },
  ],
};

// ===========================================================================
// A2  Matched live RFP
// ===========================================================================
// fit_line and check_line arrive as finished literal sentences, server-rendered
// by job_push. They are NOT Instantly tokens containing other tokens: the push
// job interpolates company_name / naics_code / set_aside_label / dq_count into
// them first, so what Instantly stores is one flat custom variable. Nested
// tokens would not resolve, which is why the runbook splits them out this way.
//
// Variant strings carry no trailing period; the template supplies it.
const A2 = {
  key: 'A2',
  name: 'GH-A2-MatchedRFP',
  daily_max_leads: 20,
  required: ['sol_number', 'sol_agency_short', 'sol_close_date', 'naics_code', 'fit_line', 'check_line', 'cta_line', 'followup_line'],
  // naics_code is required by the runbook and is genuinely load-bearing, but it
  // never appears as a token in these bodies: it is interpolated INTO fit_line
  // by the push job before Instantly ever sees it. It is listed here so the
  // completeness gate still demands it and the "unused variable" check does not
  // read its absence from the template as a spec error.
  renderInputs: ['naics_code'],
  subjects: ['{{sol_agency_short}}', 'saw this'],
  // THE ASK IS A TOKEN, NOT A LITERAL, and that is what makes the base-vs-speed
  // A/B possible inside one campaign. job_assign renders cta_line and
  // followup_line as finished sentences and records which set it used in
  // body_variant, so both arms share these mailboxes, this schedule and this
  // reply handling -- the only difference between them is the words, which is
  // the only way the result means anything.
  //
  // Step 3 is deliberately variant-neutral. It said "the flags on {{sol_number}}",
  // which is base-variant language and would have contradicted a speed opener
  // three days later.
  steps: [
    {
      delay: 2,
      lines: [
        'Hi {{firstName}}, {{sol_agency_short}} posted {{sol_number}} and {{fit_line}}. It closes {{sol_close_date}}. {{check_line}}. {{cta_line}}',
      ],
    },
    { delay: 2, lines: ['{{firstName}}, {{sol_number}} closes {{sol_close_date}}. {{followup_line}}'] },
    { delay: 4, lines: ['Should I record a 3 minute video on {{sol_number}} instead?'] },
    { delay: 0, lines: ['Want me to close this out, {{firstName}}?'] },
  ],
};

// ===========================================================================
// A4  Competitor just won
// ===========================================================================
// job_fetch_awards must exclude DoD: FPDS/USASpending lag DoD awards by roughly
// 90 days, so "a few weeks back" would be false for them.
const A4 = {
  key: 'A4',
  name: 'GH-A4-CompetitorWon',
  daily_max_leads: 10,
  required: ['competitor_name', 'competitor_city', 'award_amount_short', 'award_agency_short', 'naics_code'],
  subjects: ['{{award_amount_short}}', 'did you see this'],
  steps: [
    {
      delay: 3,
      lines: [
        'Hi {{firstName}}, {{award_agency_short}} awarded {{award_amount_short}} in NAICS {{naics_code}} to {{competitor_name}} out of {{competitor_city}} a few weeks back. Did you see it before it closed? Most small firms find these after award, when the only thing left to do is read about it. If I sent you the next three in your lane before they close, worth a look?',
      ],
    },
    { delay: 4, lines: ['{{firstName}}, want the next three in your lane before they close? One email, no login, no call.'] },
    { delay: 5, lines: ['Should I record a quick video showing how we spotted the {{competitor_name}} award early and what\'s coming in NAICS {{naics_code}}?'] },
    { delay: 0, lines: ['Want me to close this out, {{firstName}}?'] },
  ],
};

// ===========================================================================
// A5  Never found out why you lost (fallback + control)
// ===========================================================================
// The control arm. Also where every A2-eligible company that loses the coin
// flip lands, which is what makes the holdout a real experiment rather than a
// comparison of two different populations.
//
// Step 3 quotes the contracting officer who replied to the influencer campaign
// on 2026-09-14: 35 years awarding federal work, and her stated view was that
// the two killers are not reading the whole solicitation and never learning why
// you lost. That is a real person's real words, not a manufactured stat.
const A5 = {
  key: 'A5',
  name: 'GH-A5-DebriefPain',
  daily_max_leads: 15,
  required: [],
  subjects: ['your last bid', 'question, {{firstName}}'],
  steps: [
    {
      delay: 3,
      lines: [
        'Hi {{firstName}}, when you lost your last federal bid, did you ever find out why? Most firms never request the debrief, so they fix nothing and lose the same way twice. I wrote up the one page way to get a real answer out of the CO, including the ask that still works after the window closes. Want me to send it?',
      ],
    },
    { delay: 4, lines: ['{{firstName}}, want the debrief one pager? Two minutes to read and you keep it either way.'] },
    {
      delay: 5,
      lines: [
        'A contracting officer who spent 35 years awarding federal work told us the two killers are not reading the whole solicitation and never learning why you lost. The one pager fixes the second one. Should I send it?',
      ],
    },
    { delay: 0, lines: ['Want me to close this out, {{firstName}}?'] },
  ],
};

const ANGLES = [A1, A2, A4, A5];

// ---- Payload --------------------------------------------------------------
const bodyHtml = (lines) =>
  lines.map((l) => (l === '' ? '<div><br /></div>' : `<div>${l}</div>`)).join('');

const stepLines = (s) => [...s.lines, ...TAIL];

function payload(a) {
  return {
    name: a.name,
    campaign_schedule: SCHEDULE,
    sequences: [
      {
        steps: a.steps.map((s, i) => ({
          type: 'email',
          delay: s.delay,
          delay_unit: 'days',
          // Subject A/B on step 1 only, so body performance stays interpretable
          // (runbook Section 7 global rules). Later steps thread on an empty
          // subject, the same way wave 1 does.
          variants:
            i === 0
              ? a.subjects.map((subject) => ({ subject, body: bodyHtml(stepLines(s)) }))
              : [{ subject: '', body: bodyHtml(stepLines(s)) }],
        })),
      },
    ],
    email_list: MAILBOXES[a.key],
    // daily_limit is the campaign-wide ceiling; daily_max_leads is how many NEW
    // leads enter per day. A 4-step sequence means steady-state sends are about
    // 4x the new-lead rate, so the ceiling is set to that and the real meter is
    // daily_max_leads, which job_push also enforces independently.
    daily_limit: a.daily_max_leads * 4,
    daily_max_leads: a.daily_max_leads,
    email_gap: 12,
    random_wait_max: 5,
    stop_on_reply: true,
    stop_on_auto_reply: false,
    stop_for_company: false, // a "no" is that person's answer, not their employer's
    link_tracking: false,
    open_tracking: false,
    text_only: true,
    first_email_text_only: true,
    insert_unsubscribe_header: false, // standing decision, see instantly-wave1.mjs
    prioritize_new_leads: false,
    match_lead_esp: false,
    allow_risky_contacts: false,
    disable_bounce_protect: false,
    auto_variant_select: null, // never auto-promote a subject on a small sample
    is_evergreen: false,
  };
}

// ---- Guardrails -----------------------------------------------------------
const BANNED = [
  'guaranteed', 'guarantee', 'winner', 'urgent', 'act now', 'limited time',
  'click here', 'discount', 'no obligation', 'risk free', '100%',
];

// Every token the bodies use must be either an Instantly built-in or a custom
// variable the angle declares as required. A token that is neither renders
// empty, which rule 0.7 forbids.
const BUILTINS = new Set(['firstName', 'companyName', 'accountSignature']);

function check() {
  let fail = 0;
  const note = (ok, label, detail) => {
    if (!ok) fail++;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? '  ' + detail : ''}`);
  };

  for (const a of ANGLES) {
    const declared = new Set(a.required);
    a.steps.forEach((s, i) => {
      const label = `${a.key}/email${i + 1}`;
      const lines = stepLines(s);
      const raw = lines.join('\n');
      const text = raw.replace(/\{\{accountSignature\}\}/g, '');

      note(!raw.includes('—'), `${label} no em dash`);

      const tokens = [...raw.matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g)].map((m) => m[1]);
      const unknown = tokens.filter((t) => !BUILTINS.has(t) && !declared.has(t));
      note(unknown.length === 0, `${label} every token is a built-in or a declared variable`,
        unknown.length ? `UNKNOWN: ${[...new Set(unknown)]}` : `(${[...new Set(tokens)].length} distinct)`);

      // Rule 0.7 in reverse: a declared variable that no step uses means the
      // completeness gate would block pushes for a variable nobody needs.
      if (i === a.steps.length - 1) {
        const usedAnywhere = new Set(
          a.steps.flatMap((st) => [...stepLines(st).join('\n').matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g)].map((m) => m[1]))
        );
        const inputs = new Set(a.renderInputs || []);
        const unused = a.required.filter((r) => !usedAnywhere.has(r) && !inputs.has(r));
        note(unused.length === 0, `${a.key} every required variable is used or is a render input`,
          unused.length ? `UNUSED: ${unused}` : (inputs.size ? `(render inputs: ${[...inputs]})` : ''));
      }

      const flat = text.toLowerCase().replace(/\s+/g, ' ');
      const hits = BANNED.filter((b) => flat.includes(b));
      note(hits.length === 0, `${label} banned words`, hits.length ? `HITS: ${hits}` : '(none)');

      // Runbook Section 7: no links in email 1. Links after they reply.
      const links = (raw.match(/https?:\/\//g) || []).length;
      note(i === 0 ? links === 0 : true, `${label} no link in email 1`, `${links} link(s)`);

      note(/reply "no"/i.test(raw), `${label} carries the opt-out notice`);
      note(raw.includes('{{accountSignature}}'), `${label} carries the postal address`);

      const assembled = bodyHtml(lines);
      note(
        !/(^|>)[^<>]*[A-Za-z]{3}[^<>]*(<|$)/.test(assembled.replace(/<div>[^<]*<\/div>/g, '')),
        `${label} every line is wrapped in a div (no bare text nodes)`
      );
    });

    // Subjects. Wave 1's rule was absolute: never let a merge field be the whole
    // subject, because a blank renders "(no subject)". That rule existed because
    // wave 1 merged {{companyName}} off a messy SAM-derived list where blanks
    // were real and ungated.
    //
    // Here the runbook deliberately specifies bare-token subjects for A2 and
    // A4 ("{{sol_agency_short}}" alone reads like an internal note, which is the
    // point), and rule 0.7 gates those variables TWICE: job_assign refuses to
    // assign the angle without them and job_push asserts completeness again. So
    // the rule is relaxed to what actually protects the inbox preview: a subject
    // may collapse to empty only if every token in it is a REQUIRED variable and
    // therefore cannot be blank at send time. An optional or undeclared token in
    // a subject is still a failure.
    const subjectProblems = [];
    for (const s of a.subjects) {
      const toks = [...s.matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g)].map((m) => m[1]);
      const literal = s.replace(/\{\{\w+\}\}/g, '').trim();
      if (/[a-z]{2}/i.test(literal)) continue;            // survives a blank on its own
      const ungated = toks.filter((t) => !declared.has(t)); // built-ins are NOT gated
      if (!toks.length || ungated.length) subjectProblems.push(`"${s}" (ungated: ${ungated.join(',') || 'none'})`);
    }
    note(subjectProblems.length === 0, `${a.key} subjects cannot render empty`,
      subjectProblems.length ? `AT RISK: ${subjectProblems.join(' ')}` : a.subjects.map((s) => `"${s}"`).join(' '));
    note(a.subjects.every((s) => !/^[A-Z]{2,}/.test(s.replace(/\{\{\w+\}\}/g, '').trim())),
      `${a.key} subjects are sentence case`, a.subjects.map((s) => `"${s}"`).join(' '));
    note(a.steps.length === 4, `${a.key} has 4 steps`, `delays ${a.steps.map((s) => s.delay)}`);
  }

  const all = Object.values(MAILBOXES).flat();
  note(new Set(all).size === all.length, 'no mailbox serves two angle campaigns', `${all.length} total`);
  const domains = all.map((m) => m.split('@')[1]);
  note(new Set(domains).size === domains.length, 'one mailbox per domain', `${new Set(domains).size} domains`);
  const names = ANGLES.map((a) => a.name);
  note(new Set(names).size === names.length, 'campaign names are unique');
  // start_date WAS asserted to be in the future, which was right exactly once:
  // before launch, when a date already past would have meant the campaigns
  // began sending the moment they were activated. From the morning of the
  // launch onward that assertion fails forever, and it fails the whole --check,
  // which --sync refuses to run without. So the guard that protected the launch
  // would have blocked every copy change after it.
  //
  // What is still worth catching is a typo: a start_date far in the future
  // silently parks the campaigns and nothing sends, with no error anywhere.
  const startDate = new Date(SCHEDULE.start_date);
  const daysOut = (startDate - new Date()) / 864e5;
  note(!Number.isNaN(startDate.valueOf()) && daysOut < 30,
    'start_date is sane',
    Number.isNaN(startDate.valueOf()) ? `UNPARSEABLE: ${SCHEDULE.start_date}`
      : daysOut > 0 ? `${SCHEDULE.start_date}, ${Math.ceil(daysOut)}d out (pre-launch backstop)`
      : `${SCHEDULE.start_date}, in the past (campaigns already launched)`);

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
  const r = await api('GET', '/campaigns?limit=100');
  return (r.items || []).find((c) => c.name === name);
}

// A 200 on create does not mean the body survived the sanitizer.
function assertStored(c, sent, expectStatus) {
  const problems = [];
  const steps = c.sequences?.[0]?.steps || [];
  const want = sent.sequences[0].steps;
  if (steps.length !== want.length) problems.push(`step count ${steps.length} != ${want.length}`);
  steps.forEach((s, i) => {
    if (s.delay !== want[i].delay) problems.push(`step ${i + 1} delay ${s.delay} != ${want[i].delay}`);
    if ((s.variants || []).length !== want[i].variants.length) {
      problems.push(`step ${i + 1} variants ${(s.variants || []).length} != ${want[i].variants.length}`);
    }
    (s.variants || []).forEach((v, j) => {
      const text = (v.body || '').replace(/<[^>]*>/g, '').trim();
      if (text.length < 60) problems.push(`step ${i + 1} variant ${j} body stripped (${text.length} chars)`);
      if (!v.body.includes('{{accountSignature}}')) problems.push(`step ${i + 1} variant ${j} lost the signature`);
      if (!/reply "no"/i.test(v.body)) problems.push(`step ${i + 1} variant ${j} lost the opt-out notice`);
    });
  });
  if ((c.email_list || []).length !== sent.email_list.length) {
    problems.push(`mailboxes ${(c.email_list || []).length} != ${sent.email_list.length}`);
  }
  if (c.daily_max_leads !== sent.daily_max_leads) {
    problems.push(`daily_max_leads ${c.daily_max_leads} != ${sent.daily_max_leads}`);
  }
  if (expectStatus !== null && expectStatus !== undefined) {
    if (c.status !== expectStatus) problems.push(`status moved ${expectStatus} -> ${c.status} during sync`);
  } else if (![0, 1, 2].includes(c.status)) {
    problems.push(`unexpected status ${c.status}`);
  }
  return problems;
}

const arg = process.argv[2] || '--check';

if (arg === '--check') {
  process.exit(check() === 0 ? 0 : 1);
} else if (arg === '--dry-run') {
  for (const a of ANGLES) console.log(JSON.stringify(payload(a), null, 2));
} else if (arg === '--sync') {
  if (check() !== 0) { console.error('\nGuardrails failed. Nothing sent to the API.'); process.exit(1); }
  if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }
  let bad = 0;
  const ids = {};
  for (const a of ANGLES) {
    const body = payload(a);
    const existing = await findByName(a.name);
    let id;
    if (existing) {
      await api('PATCH', `/campaigns/${existing.id}`, body);
      id = existing.id;
      console.log(`updated ${a.key.padEnd(3)} ${id}  ${a.name}`);
    } else {
      const r = await api('POST', '/campaigns', body);
      id = r.id;
      console.log(`created ${a.key.padEnd(3)} ${id}  ${a.name}  status=${r.status}`);
    }
    ids[a.key] = id;
    const stored = await api('GET', `/campaigns/${id}`);
    const problems = assertStored(stored, body, existing ? existing.status : 0);
    if (problems.length) { bad++; console.log(`  FAIL ${problems.join('; ')}`); }
    else console.log(`  ok   copy stored intact, status ${stored.status} (0=Draft), ${(stored.email_list || []).length} mailboxes`);
  }
  console.log('\n-- store these in outreach.config (runbook 0.5) --');
  console.log(configSql(ids));
  process.exit(bad === 0 ? 0 : 1);
} else if (arg === '--verify') {
  let bad = 0;
  const ids = {};
  for (const a of ANGLES) {
    const existing = await findByName(a.name);
    if (!existing) { console.log(`MISSING  ${a.name}`); bad++; continue; }
    const stored = await api('GET', `/campaigns/${existing.id}`);
    ids[a.key] = existing.id;
    const problems = assertStored(stored, payload(a));
    const steps = stored.sequences[0].steps;
    console.log(
      `${problems.length ? 'FAIL' : ' ok '}  ${a.key.padEnd(3)} ${stored.id}  status=${stored.status}` +
      `  max_leads=${stored.daily_max_leads}  mbx=${(stored.email_list || []).length}` +
      `  steps=${steps.length}  variants=[${steps.map((s) => s.variants.length)}]  delays=[${steps.map((s) => s.delay)}]`
    );
    if (problems.length) { bad++; problems.forEach((p) => console.log(`        ${p}`)); }
  }
  process.exit(bad === 0 ? 0 : 1);
} else if (arg === '--config') {
  const ids = {};
  for (const a of ANGLES) {
    const existing = await findByName(a.name);
    if (existing) ids[a.key] = existing.id;
  }
  console.log(configSql(ids));
} else {
  console.error(`unknown argument ${arg}`);
  process.exit(1);
}

function configSql(ids) {
  const caps = Object.fromEntries(ANGLES.map((a) => [a.key, a.daily_max_leads]));
  return [
    `insert into outreach.config (key, value) values`,
    `  ('campaign_ids', '${JSON.stringify(ids)}'::jsonb),`,
    `  ('daily_caps',   '${JSON.stringify(caps)}'::jsonb)`,
    `on conflict (key) do update set value = excluded.value, updated_at = now();`,
  ].join('\n');
}
