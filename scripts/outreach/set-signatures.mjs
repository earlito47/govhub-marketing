// Set the per-mailbox signature on every mailbox that sends campaign mail:
// the nine influencer mailboxes and wave 1's twelve.
//
// The signature is not decoration. It is the sole carrier of two of the three
// disclosures CAN-SPAM 15 USC 7704(a)(5)(A) wants in EVERY commercial message:
//
//   1. identification as a solicitation   -> REMOVED on request 2026-09-03 and
//                                            barred since 2026-09-04;
//                                            see the note on SIGNATURE below
//   2. a valid physical postal address    -> this signature
//   3. an opt-out notice                  -> already in every email body,
//                                            deliberately, so it cannot depend
//                                            on a per-mailbox setting being
//                                            configured correctly
//
// It is a per-mailbox setting, so one mailbox missing it sends with no
// signature at all while the campaign preview still looks fine. Every mailbox
// in this workspace had `signature: null` when this was first written. The
// nine influencer mailboxes were set then; wave 1's twelve were left as a
// separate decision and stayed null, which an API audit on 2026-09-03 caught
// before launch: all three wave 1 campaigns end every email on
// {{accountSignature}}, so activating them would have sent 5,400 messages
// with no postal address. Both sets are covered here now.
//
// The 27 mailboxes in the workspace that are in no campaign are deliberately
// not listed. Two of them, j.knight@ and j.k@bidwithgovhub.com, name a
// different person, so a blanket "Earl Knight" across all 48 would be wrong
// on exactly the addresses where an inaccurate From line matters most.
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
// advertisement. Removed on request 2026-09-03 and now actively barred by the
// guardrail below, on request 2026-09-04. A deliberate decision rather than an
// oversight, so the reasoning is recorded here rather than lost:
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
// To restore it, put a short disclosure back in front of POSTAL and invert the
// guardrail below, which now rejects that wording rather than reporting on it.
const SIGNATURE = `${NAME}<br>${TITLE}<br><br>${POSTAL}`;

// One mailbox per domain per programme. Eight domains carry both an
// influencer mailbox and a wave 1 mailbox; the local parts differ, the
// signature does not, and it names the same person either way.
const MAILBOXES = [
  // Influencer campaigns C1-C6, live since 2026-09-03.
  'earl@govhubhq.com',        // C1
  'earl@usegovhub.com',       // C1
  'earl@getgovhub.com',       // C2
  'earl@buildwithgovhub.com', // C3
  'earl.knight@winwithgovhub.com', // C4
  'earl@govhubcontracts.com', // C4
  'earl@trygovhub.com',       // C5
  'earl@govhubteam.com',      // C5
  'earl@govhubnow.com',       // C6

  // Wave 1 campaigns A/B/C, draft. Read from each campaign's email_list on
  // 2026-09-03 rather than transcribed from the plan, because campaign C uses
  // e.knight@govhubrfp.com where every other wave 1 address is earl.knight@.
  'earl.knight@buildwithgovhub.com',   // A serial_bidder
  'earl.knight@usegovhub.com',         // A
  'earl.knight@govhubcontracts.com',   // A
  'earl.knight@govhubprocurement.com', // A
  'earl.knight@govhubcapture.com',     // A
  'earl.knight@trygovhub.com',         // A
  'earl.knight@getgovhub.com',         // B new_prime
  'earl.knight@govhubteam.com',        // B
  'earl.knight@govhubnow.com',         // B
  'earl.knight@govhubhq.com',          // C registered_no_awards
  'earl.knight@govhubsubmittals.com',  // C
  'e.knight@govhubrfp.com',            // C
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
  // Was a report-only line while the absence was merely a decision. Made a
  // hard failure 2026-09-04, when keeping sales and solicitation wording out
  // became the standing requirement rather than one call on one day: a check
  // that only prints cannot stop the line coming back.
  note(!/sales email|advertis|solicitation|commercial message|promotional|this is an ad\b/i.test(plain),
    'no sales or solicitation disclosure language');
  note(!/^\s*(best|thanks|regards|cheers|sincerely)\b/im.test(plain), 'no valediction to double up with the body');
  note(!SIGNATURE.includes('—'), 'no em dash');
  note(plain.split('\n').filter(Boolean).length <= 4, 'four lines or fewer', `${plain.split('\n').filter(Boolean).length} lines`);
  // The bodies already carry the opt-out; repeating it here is clutter, and
  // as of 2026-09-03 keeping the signature clear of opt-out and unsubscribe
  // wording is an explicit requirement rather than a style preference. Match
  // the whole family of phrasings, not just the two the bodies happen to use.
  note(!/\b(unsubscribe|opt[- ]?out|opt me out|remove me|take me off|reply "remove"|stop receiving|no longer wish|do not wish to receive)\b/i.test(plain),
    'no opt-out or unsubscribe language');

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
