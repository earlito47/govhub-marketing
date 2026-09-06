#!/usr/bin/env node
// Network-free self-test for the vendor outreach email. Run:
//   node scripts/outreach/vendor-outreach.selftest.mjs
//
// Every case here is a real roster name. One email per vendor ever means each
// of these is a mistake that cannot be taken back, so they are pinned rather
// than eyeballed in a dry run.
import { companyForEmail, dueForResolve, renderEmail, resolveSba } from './vendor-outreach.mjs';

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n        got      ${JSON.stringify(actual)}${ok ? '' : `\n        expected ${JSON.stringify(expected)}`}`);
}

// ---- Company name in the prose --------------------------------------------
// Left column is the roster's raw USAspending `name`; right is what a person
// would type in a note. The old path ran these through the page-title
// displayName heuristic and produced the parenthesised versions.
const NAMES = [
  ['CSI AVIATION, INC', 'CSI Aviation'], // was "Csi Aviation"
  ['CGI FEDERAL INC.', 'CGI Federal'], // was "Cgi Federal"
  ['COCHRANE USA INC', 'Cochrane USA'], // was "Cochrane Usa"
  ['THE GEO GROUP, INC.', 'GEO Group'], // was "Geo Group"
  ['W S DARLEY & CO', 'W S Darley'], // was "W S Darley and"
  ['FOUR POINTS TECHNOLOGY, L.L.C.', 'Four Points Technology'], // was "... L L C"
  ['AT&T ENTERPRISES, LLC', 'AT&T Enterprises'], // was "At and T Enterprises"
  ['M1 SUPPORT SERVICES, L.P.', 'M1 Support Services'], // was "... L P"
  ['M. A. MORTENSON COMPANY', 'M. A. Mortenson'], // was "M A Mortenson"
  ['MOTOR OIL (HELLAS) CORINTH REFINERIES S.A.', 'Motor Oil Hellas Corinth Refineries'],
  ['KONGSBERG DEFENCE & AEROSPACE AS', 'Kongsberg Defence & Aerospace'],
  ['BAE SYSTEMS TECHNOLOGY SOLUTIONS & SERVICES INC.', 'BAE Systems Technology Solutions & Services'],
  ['UT-BATTELLE LLC', 'UT-Battelle'],
  // USAspending trails the article: "..., THE" hides the suffix behind it.
  ['WHITING-TURNER CONTRACTING COMPANY, THE', 'Whiting-Turner Contracting'],
  ['PHILLIPS 66 COMPANY', 'Phillips 66'],
  ['V3GATE, LLC', 'V3GATE'],
  ['FCN, INC.', 'FCN'],
  ['LOCKHEED MARTIN CORPORATION', 'Lockheed Martin'],
  ['NATIONAL TECHNOLOGY AND ENGINEERING SOLUTIONS OF SANDIA', 'National Technology and Engineering Solutions of Sandia'],
  ['HANFORD TANK WASTE OPERATIONS AND CLOSURE, LLC', 'Hanford Tank Waste Operations and Closure'],
  ['BL HARBERT INTERNATIONAL LLC', 'BL Harbert International'],
  // A short token that is an ordinary word is not an initialism.
  ['GULF COPPER & MANUFACTURING CORP', 'Gulf Copper & Manufacturing'],
  // Already clean, and idempotent under a second pass.
  ['Booz Allen Hamilton', 'Booz Allen Hamilton'],
  ['CGI Federal', 'CGI Federal'],
];
for (const [raw, want] of NAMES) check(`company: ${raw}`, companyForEmail(raw), want);

// ---- Greeting --------------------------------------------------------------
const greeting = (contactName) => renderEmail({ company: 'Acme', contactName }).body.split('\n')[0];
check('greeting: SBA all-caps', greeting('AUSTIN DEROSE'), 'Hi Austin,');
check('greeting: mixed case kept', greeting('Cam Judkins'), 'Hi Cam,');
check('greeting: hyphenated', greeting('JEAN-LUC PICARD'), 'Hi Jean-Luc,');
check('greeting: apostrophe', greeting("O'BRIEN SMITH"), "Hi O'Brien,");
check('greeting: bare initial falls back', greeting('G MATTHEW KOEHL'), 'Hi there,');
check('greeting: no name at all', greeting(''), 'Hi there,');

// ---- Subject ---------------------------------------------------------------
const subject = (company) => renderEmail({ company, contactName: '' }).subject;
check('subject: possessive', subject('CGI Federal'), "CGI Federal's page on GovHub");
check('subject: name ending in s', subject('BAE Systems'), "BAE Systems' page on GovHub");
check('subject: ampersand survives', subject('AT&T Enterprises'), "AT&T Enterprises' page on GovHub");

// ---- Retry eligibility -----------------------------------------------------
// A row is terminal once written. SBA is the only tier, it matches on UEI and
// holds small businesses only, so re-asking about a prime or an FFRDC operator
// cannot produce a different answer -- the old slow-retry cadence was waiting
// for Apollo, which is gone.
check('retry: no ledger row', dueForResolve(undefined), true);
check('retry: sent is final', dueForResolve({ status: 'sent' }), false);
check('retry: ready is not re-resolved', dueForResolve({ status: 'ready' }), false);
check('retry: opted-out is final', dueForResolve({ status: 'opted-out' }), false);
check('retry: no-contact is now final', dueForResolve({ status: 'no-contact' }), false);
// The manual reopen path is deleting the row, which is the `undefined` case
// above -- there is deliberately no status that means "try again later".
check('retry: legacy row with retry counters is still final',
  dueForResolve({ status: 'no-contact', resolveAttempts: 1, lastResolveAt: '2020-01-01T00:00:00Z' }), false);

// ---- SBA: an outage is not an empty answer -----------------------------------
// The load-bearing distinction now that SBA is the only tier. An empty answer
// RETIRES a vendor permanently; an error must not. SBA signals not-found as
// HTTP 500 with a "No matching" body -- the same status a broken service
// returns -- so the body is the only thing separating "we asked and they have
// nothing" from "we never got an answer".
const VENDOR = { uei: 'ABC123DEF456', slug: 't', name: 'Test' };
const reply = (init) => async () => init;
const res = (status, body, json) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
  json: async () => (json === undefined ? JSON.parse(body) : json),
});

const kind = async (fetchImpl) => {
  const r = await resolveSba(VENDOR, { fetchImpl });
  return r.error ? 'error' : r.contact ? 'contact' : 'empty';
};

check('sba: not-found 500 is EMPTY (retires)', await kind(reply(res(500, 'No matching entity found'))), 'empty');
check('sba: other 500 is ERROR (does not retire)', await kind(reply(res(500, 'Internal Server Error'))), 'error');
check('sba: 503 is ERROR', await kind(reply(res(503, 'Service Unavailable'))), 'error');
check('sba: network failure is ERROR', await kind(async () => { throw new Error('ECONNRESET'); }), 'error');
check('sba: non-JSON 200 is ERROR', await kind(reply({ ok: true, status: 200, text: async () => 'x', json: async () => { throw new Error('bad json'); } })), 'error');
check('sba: profile with a public email is CONTACT',
  await kind(reply(res(200, '', { entity: { email: 'a@b.com', contact_person: 'PAT LEE', public_display: true, display_email: true } }))), 'contact');
check('sba: email withheld by display flag is EMPTY',
  await kind(reply(res(200, '', { entity: { email: 'a@b.com', public_display: true, display_email: false } }))), 'empty');
check('sba: profile with no email is EMPTY',
  await kind(reply(res(200, '', { entity: { email: '', public_display: true, display_email: true } }))), 'empty');
// No UEI: there is nothing to look up, so it must answer empty WITHOUT
// reaching the network -- the throwing stub proves the call never happens.
const noUei = await resolveSba({ slug: 't', name: 'Test' }, {
  fetchImpl: async () => { throw new Error('fetch must not be called without a UEI'); },
});
check('sba: vendor with no UEI is EMPTY, no request made', Boolean(noUei.empty), true);

// ---- Body wrapping ---------------------------------------------------------
// A long company name must not leave one line jutting out past the rest.
const longest = renderEmail({
  company: 'National Technology & Engineering Solutions of Sandia',
  contactName: 'Darrick Hurst',
});
const widest = Math.max(...longest.body.split('\n').map((l) => l.length));
check('body: no line over 68 cols', widest <= 68, true);
check('body: wraps, not one long line', longest.body.split('\n').length > 10, true);
check('body: paragraph breaks kept', longest.body.includes('\n\n'), true);

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
