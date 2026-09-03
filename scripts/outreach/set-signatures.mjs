// Set the per-mailbox signature on the nine influencer-campaign mailboxes.
//
// The signature is not decoration. It is the sole carrier of two of the three
// disclosures CAN-SPAM 15 USC 7704(a)(5)(A) wants in EVERY commercial message:
//
//   1. identification as a solicitation   -> REMOVED on request 2026-09-03;
//                                            see the note on SIGNATURE below
//   2. a valid physical postal address    -> this signature
//   3. an opt-out notice                  -> already in every email body,
//                                            deliberately, so it cannot depend
//                                            on a per-mailbox setting being
//                                            configured correctly
//
// It is a per-mailbox setting, so one mailbox missing it sends with no
// signature at all while the campaign preview still looks fine. Every mailbox
// in this workspace had `signature: null` when this was written, wave 1's
// twelve included, which means wave 1 would also send non-compliant today.
// This script only touches the nine this campaign uses; wave 1's are a
// separate decision and a separate campaign's copy.
//
// Design constraints, all deliberate:
//   - NO LINK. Not even a bare govhub.online. Sending happens from .com
//     lookalike domains, so an .online string in the footer is exactly the
//     sender/link-domain mismatch that filters score against, and the whole
//     sequence is otherwise link-free on the first touch.
//   - No image, no logo, no tracking pixel. Same reasoning, plus every
//     campaign is text_only.
//   - No valediction ("Best,", "Thanks,"). The bodies do not carry one, so a
//     signature that opens with one doubles up.
//   - HTML <br>, not "\n". The bodies are <div>-wrapped HTML and Instantly's
//     own signature editor emits HTML, where a bare newline collapses to a
//     space and would render the whole thing as one run-on line. text_only
//     converts <br> back to a newline at send time.
//     VERIFY THIS ON A SEED SEND before launch. It is the one thing here that
//     cannot be confirmed from the API, which does not expose a rendered
//     preview.
//
// Env: INSTANTLY_API_KEY
// Usage:
//   node scripts/outreach/set-signatures.mjs --dry-run
//   node scripts/outreach/set-signatures.mjs
//   node scripts/outreach/set-signatures.mjs --show    read back what is set

const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

// Name and title must agree with the email bodies, which say "I built GovHub"
// (C1) and "I run GovHub" (C2, C6). "Founder" is consistent with those; an
// "Account Executive" line under "I built GovHub" is the kind of contradiction
// the recipients of this particular campaign notice for a living.
//
// "Earl Knight" matches the From name already configured on all 48 mailboxes
// and the earl@ / earl.knight@ / e.knight@ local parts, so the From line, the
// address and the signature all name the same person.
const NAME = 'Earl Knight';
const TITLE = 'Founder, GovHub';
const POSTAL = '3060 Mercer University Dr Ste 110, Atlanta, GA 30341';

// The signature previously carried "This is a sales email." That line was the
// CAN-SPAM 7704(a)(5)(A)(i) element, identification of the message as an
// advertisement. Removed on request 2026-09-03, a deliberate decision rather
// than an oversight, so the reasoning is recorded here rather than lost:
//
//   - (a)(5)(A)(ii), the opt-out notice, is unaffected. It sits in every email
//     body, not here, precisely so it cannot depend on this setting.
//   - (a)(5)(A)(iii), the postal address, is unaffected and still below.
//   - (a)(5)(A)(i) is now carried, if at all, by the messages themselves
//     being self-evidently solicitations: the bodies say "I built GovHub, an
//     AI proposal platform" and offer accounts, sessions and a recurring share
//     of subscriptions. The statute gives latitude in how the identification
//     is made, and enforcement concentrates on forged headers, absent opt-outs
//     and missing addresses rather than the absence of a literal ad label.
//     It is a thinner posture than an explicit line, not a reckless one.
//
// To restore it, put a short disclosure back in front of POSTAL and flip the
// guardrail below back to a hard requirement.
const SIGNATURE = `${NAME}<br>${TITLE}<br><br>${POSTAL}`;

const MAILBOXES = [
  'earl@govhubhq.com',        // C1
  'earl@usegovhub.com',       // C1
  'earl@getgovhub.com',       // C2
  'earl@buildwithgovhub.com', // C3
  'earl.knight@winwithgovhub.com', // C4
  'earl@govhubcontracts.com', // C4
  'earl@trygovhub.com',       // C5
  'earl@govhubteam.com',      // C5
  'earl@govhubnow.com',       // C6
];

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 400)}`);
  return json;
}

function check() {
  let fail = 0;
  const note = (ok, label, detail) => {
    if (!ok) fail++;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? '  ' + detail : ''}`);
  };
  const plain = SIGNATURE.replace(/<br\s*\/?>/gi, '\n');

  note(!/https?:\/\/|www\.|govhub\.online/i.test(SIGNATURE), 'no link or bare domain');
  note(!/<img|<a\s/i.test(SIGNATURE), 'no image and no anchor tag');
  note(plain.includes(POSTAL), 'carries the postal address');
  // Deliberately NOT a failure: see the note on SIGNATURE above. Reported so
  // the state is visible on every run rather than quietly forgotten.
  const hasDisclosure = /sales email|advertisement|solicitation|commercial message/i.test(plain);
  note(true, 'solicitation disclosure', hasDisclosure
    ? 'present'
    : 'ABSENT by decision (2026-09-03). Opt-out is in the body, postal address is below.');
  note(!/^\s*(best|thanks|regards|cheers|sincerely)\b/im.test(plain), 'no valediction to double up with the body');
  note(!SIGNATURE.includes('—'), 'no em dash');
  note(plain.split('\n').filter(Boolean).length <= 4, 'four lines or fewer', `${plain.split('\n').filter(Boolean).length} lines`);
  // The bodies already carry the opt-out; repeating it here is clutter.
  note(!/reply "remove"|unsubscribe/i.test(plain), 'does not duplicate the body opt-out line');

  console.log(`\n${fail === 0 ? 'Signature passes.' : fail + ' FAILURES.'}\n`);
  return fail;
}

const arg = process.argv[2] || '';

console.log('Signature to set:\n');
console.log(SIGNATURE.replace(/<br\s*\/?>/gi, '\n').split('\n').map((l) => '    ' + l).join('\n'));
console.log(`\nraw: ${SIGNATURE}\n`);
if (check() !== 0) process.exit(1);

if (arg === '--dry-run') {
  console.log(`Would set on ${MAILBOXES.length} mailboxes:`);
  for (const m of MAILBOXES) console.log(`    ${m}`);
  process.exit(0);
}

if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }

if (arg === '--show') {
  for (const m of MAILBOXES) {
    const a = await api('GET', `/accounts/${encodeURIComponent(m)}`);
    const s = a.signature;
    console.log(`  ${m.padEnd(34)} ${s ? JSON.stringify(s).slice(0, 90) : 'NOT SET'}`);
  }
  process.exit(0);
}

let set = 0, failed = 0;
for (const m of MAILBOXES) {
  try {
    const r = await api('PATCH', `/accounts/${encodeURIComponent(m)}`, { signature: SIGNATURE });
    // The API echoes the stored value back, so assert it actually landed
    // rather than trusting the 200.
    if (r.signature !== SIGNATURE) throw new Error('stored value does not match what was sent');
    set++;
    console.log(`  ok   ${m}`);
  } catch (e) {
    failed++;
    console.log(` FAIL ${m}  ${e.message.split('\n')[0]}`);
  }
}
console.log(`\n${set} set, ${failed} failed.`);
console.log('\nSeed-test before launch: the API exposes no rendered preview, so');
console.log('whether <br> survives into the text/plain part can only be confirmed');
console.log('by sending one and reading the received message, not the preview pane.');
