#!/usr/bin/env node
// Network-free self-test for the vendor outreach email. Run:
//   node scripts/outreach/vendor-outreach.selftest.mjs
//
// Every case here is a real roster name or a real Apollo result. One email per
// vendor ever means each of these is a mistake that cannot be taken back, so
// they are pinned rather than eyeballed in a dry run.
import { companyForEmail, dueForResolve, renderEmail, sameCompany } from './vendor-outreach.mjs';

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

// ---- Apollo company match --------------------------------------------------
// Extra tokens on the end are the same company under a longer registration.
check('match: exact', sameCompany('RAYTHEON COMPANY', 'Raytheon'), true);
check('match: longer registration', sameCompany('NORTHROP GRUMMAN SYSTEMS CORP', 'Northrop Grumman Systems'), true);
check('match: suffix only differs', sameCompany('GENERAL ELECTRIC COMPANY', 'General Electric Co.'), true);
check('match: vendor is the longer name', sameCompany('BOOZ ALLEN HAMILTON INC', 'Booz Allen'), true);

// Extra tokens on the FRONT are a different company. Both of these actually
// sent: aerospace -> mpipes@fieldaero.com, general-electric -> ...@pgn.com.
check('reject: Field Aerospace', sameCompany('THE AEROSPACE CORPORATION', 'Field Aerospace'), false);
check('reject: Portland General Electric', sameCompany('GENERAL ELECTRIC COMPANY', 'Portland General Electric'), false);
check('reject: one shared word', sameCompany('SIERRA NEVADA COMPANY, LLC', 'Nevada'), false);
check('reject: unrelated', sameCompany('LEIDOS, INC.', 'Peraton'), false);
check('reject: empty org', sameCompany('LEIDOS, INC.', ''), false);
check('reject: single token, longer org', sameCompany('MITRE CORPORATION', 'Mitre Sports International'), false);
// Known and deliberate: a company Apollo files under a trading name that
// shares no token with the registered one does NOT auto-resolve, even when
// Apollo's org search returns it. Trusting the search result here is exactly
// what mailed Field Aerospace. The resolver logs the candidate it rejected
// ("no Apollo org matched ... (saw SpaceX)") so the row can be filled by hand.
check('reject: trading name, registered name', sameCompany('SPACE EXPLORATION TECHNOLOGIES CORP.', 'SpaceX'), false);

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
// "no-contact" was terminal, which stranded 75 vendors — half the roster —
// where no later fix could reach them.
const NOW = Date.parse('2026-09-01T00:00:00Z');
const days = (n) => new Date(NOW - n * 86400000).toISOString();
check('retry: no ledger row', dueForResolve(undefined, NOW), true);
check('retry: sent is final', dueForResolve({ status: 'sent' }, NOW), false);
check('retry: ready is not re-resolved', dueForResolve({ status: 'ready' }, NOW), false);
check('retry: opted-out is final', dueForResolve({ status: 'opted-out' }, NOW), false);
// A legacy row predates the counter; it counts as one attempt already spent.
check('retry: legacy no-contact row is due now', dueForResolve({ status: 'no-contact' }, NOW), true);
check('retry: tried yesterday, too soon', dueForResolve({ status: 'no-contact', resolveAttempts: 1, lastResolveAt: days(1) }, NOW), false);
check('retry: tried 20 days ago, due', dueForResolve({ status: 'no-contact', resolveAttempts: 1, lastResolveAt: days(20) }, NOW), true);
check('retry: attempts exhausted', dueForResolve({ status: 'no-contact', resolveAttempts: 5, lastResolveAt: days(400) }, NOW), false);

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
