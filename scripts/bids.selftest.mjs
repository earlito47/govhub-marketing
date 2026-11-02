// Selftest for the public bid pages' text and category rules.
//
//   node --experimental-strip-types scripts/bids.selftest.mjs   (Node 22+)
//
// Pins src/lib/bids/text.ts (titles, slugs, the em-dash rule) and
// src/lib/bids/categories.ts (which hub a bid lands in) against cases seen in
// the real data on 2026-10-31.
import { cleanTitle, noEmDash, slugify } from '../src/lib/bids/text.ts';
import { CATEGORIES, categorize } from '../src/lib/bids/categories.ts';

let pass = 0;
const fails = [];
const eq = (got, want, msg) =>
  JSON.stringify(got) === JSON.stringify(want) ? pass++ : fails.push(`${msg}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);

// ── cleanTitle ───────────────────────────────────────────────────────────
eq(cleanTitle('53--BRACKET,MOUNTING'), 'Bracket, Mounting', 'SAM.gov PSC prefix goes, all caps is recased, comma gets its space');
eq(cleanTitle('6515--Anesthesia Units Amendment 4'), 'Anesthesia Units Amendment 4', 'a four-digit PSC prefix goes too');
eq(cleanTitle('NAVSEA RF AMPLIFIER REPAIR'), 'NAVSEA RF Amplifier Repair', 'known acronyms stay upper case');
eq(cleanTitle('VETERANS AFFAIRS, DEPARTMENT OF / DEPT OF THE NAVY'), 'Veterans Affairs, Department of / Dept of the Navy', 'small words stay lower case inside a recased title');
eq(cleanTitle('Microwave RF Amplifiers'), 'Microwave RF Amplifiers', 'a mixed-case title is left alone');
eq(cleanTitle('Lubbock Isd: E-Rate services requested'), 'Lubbock ISD: E-Rate services requested', 'school district abbreviations are fixed');
eq(cleanTitle('SH 16, Palo Pinto County: Seal Coat'), 'SH 16, Palo Pinto County: Seal Coat', 'a normal state title is untouched');
eq(cleanTitle('Paving project -'), 'Paving project', 'trailing punctuation goes');

// ── slugify ──────────────────────────────────────────────────────────────
eq(slugify('Hays Street Bridge Connections & Eastside (2022 Bond)'), 'hays-street-bridge-connections-and-eastside-2022-bond', 'ampersand becomes "and", punctuation collapses');
eq(slugify('Café Équipement'), 'cafe-equipement', 'accents are folded');

// ── noEmDash ─────────────────────────────────────────────────────────────
eq(noEmDash('systems—one medium-scale'), 'systems, one medium-scale', 'an em dash becomes a comma (check-emdash.mjs fails the build on one)');
eq(noEmDash('dates 2026–2027'), 'dates 2026–2027', 'en dashes in ranges are allowed');
eq(noEmDash(null), null, 'null passes through');

// ── categorize ───────────────────────────────────────────────────────────
eq(categorize('Lubbock ISD: E-Rate services requested (FCC Form 470 no. 270000990)', ['238210', '517111']), ['telecom'], 'E-Rate is telecom whatever its codes say');
eq(categorize('Janitorial Services for City Hall', []), ['janitorial'], 'a title keyword alone places a bid');
eq(categorize('Roof Replacement at Fire Station 3', ['238160']), ['roofing', 'construction'], 'a roofing code is roofing first, then construction');
eq(categorize('Mini split install', ['238220']), ['hvac', 'plumbing', 'construction'], '238220 is both HVAC and plumbing');
eq(categorize('Consulting services', ['541611', '237310']), ['consulting'], 'only the primary code counts; a runner-up guess does not add construction');
eq(categorize('Snowmobile purchase', []), [], '"snow" needs a word boundary');
eq(categorize('Bracket, Mounting', ['332510']), ['metal-products'], 'federal parts land in their manufacturing category');

// ── category slugs ───────────────────────────────────────────────────────
eq(new Set(CATEGORIES.map((c) => c.slug)).size, CATEGORIES.length, 'category slugs are unique');
eq(CATEGORIES.filter((c) => !/^[a-z]+(-[a-z]+)*$/.test(c.slug)).map((c) => c.slug), [], 'category slugs are lowercase-hyphen');

if (fails.length) {
  console.error(`bids selftest: ${fails.length} failed, ${pass} passed\n  - ${fails.join('\n  - ')}`);
  process.exit(1);
}
console.log(`bids selftest: ${pass} passed`);
