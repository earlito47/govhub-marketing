// Selftest for the public bid pages' text and category rules.
//
//   node --experimental-strip-types scripts/bids.selftest.mjs   (Node 22+)
//
// Pins src/lib/bids/text.ts (titles, slugs, the em-dash rule) and
// src/lib/bids/categories.ts (which hub a bid lands in) against cases seen in
// the real data on 2026-10-31.
import { cleanTitle, noEmDash, slugify } from '../src/lib/bids/text.ts';
import { CATEGORIES, categorize } from '../src/lib/bids/categories.ts';
import { bidDocuments, classifyDocument, cleanDocumentName } from '../src/lib/bids/documents.ts';
import { dlaOffice, nsnOf, setAsideShort } from '../src/lib/bids/dla.ts';

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

// ── documents ────────────────────────────────────────────────────────────
// Real file names from public_bid_listings().attachment_names, 2026-11-09.
const tagOf = (n) => classifyDocument(n);
eq(cleanDocumentName('Solicitation%20-%20N6893627Q0023.pdf'), 'Solicitation - N6893627Q0023.pdf', 'names are percent-decoded');
eq(cleanDocumentName('100%25 Design.pdf'), '100% Design.pdf', 'an encoded % decodes');
eq(cleanDocumentName('Budget 100% final.pdf'), 'Budget 100% final.pdf', 'a stray % is kept as stored');
eq(cleanDocumentName('Scope — Phase 2.pdf'), 'Scope - Phase 2.pdf', 'no em dash reaches the page');
eq(tagOf('SF30_SPE60827R02010001.PDF'), { tag: 'SF 30', form: true }, 'SF 30 run into the number');
eq(tagOf('C04 SF1442 - 1240LT27Q0025 - Combined SS.pdf'), { tag: 'SF 1442', form: true }, 'SF 1442');
eq(tagOf('A0003 Attachment 12_ SFLLL.pdf'), { tag: 'SF LLL', form: true }, 'SF LLL, the lobbying disclosure');
eq(tagOf('Attachment 4 - Draft DD254.pdf'), { tag: 'DD 254', form: false }, 'DD 254 is the agency\'s form: named, not flagged');
eq(tagOf('Notice of 30 day extension.pdf'), { tag: null, form: false }, 'lower-case "of 30" is not Optional Form 30');
eq(tagOf('2.02c Attachment III - Pricing Worksheet.xlsx'), { tag: 'Pricing sheet', form: true }, 'pricing worksheet');
eq(tagOf('Attachment 1_ScheduleOfServices_HAMMER_DD_FY27.xls'), { tag: 'Pricing sheet', form: true }, 'camel-case schedule of services');
eq(tagOf('Attachment 3 - Past Performance Questionnaire .docx'), { tag: 'Past performance form', form: true }, 'past performance questionnaire');
eq(tagOf('3B.J(2026.11.05)FAR 52.204-24 Representation (Nov. 2021)-4UT0216.pdf'), { tag: 'Reps and certs', form: true }, 'FAR 52.204-24 representation');
eq(tagOf('NSF-XLabsOTASO-AttachmentA-WrittenProposalTemplate.pdf'), { tag: 'Response form', form: true }, 'camel-case proposal template');
eq(tagOf('C04 Attachment 5 WD NM20260028.pdf'), { tag: 'Wage determination', form: false }, 'WD with a state code');
eq(tagOf('PWS Refinishing Floor Services.pdf'), { tag: 'Statement of work', form: false }, 'PWS');
eq(tagOf('1.06 QASP_Microchip IDIQ.pdf'), { tag: null, form: false }, 'a quality assurance plan is not specifications');
eq(tagOf('RPP_Scanner Ultrasonic Ocular_17Oct26 Ammendment 1.pdf'), { tag: 'Amendment', form: false }, 'misspelt amendment');
eq(tagOf('22794379-USAC_FCC_FORM_470_APPLICATION_270000738_CERTIFIED.pdf'), { tag: null, form: false }, 'an E-Rate FCC Form 470 is the applicant\'s, not a vendor form');
eq(bidDocuments(['A.pdf%', 'Wage%20Determination.pdf', 'wage determination.pdf', '']).map((d) => d.name), ['A.pdf%', 'Wage Determination.pdf'], 'decoded duplicates and empty names go');

// ── DLA parts page ───────────────────────────────────────────────────────
eq(nsnOf('The Defense Logistics Agency seeks three cowling units, NSN 1560004897584, for delivery.'), '1560-00-489-7584', 'a 13-digit NSN in the summary is formatted 4-2-3-4');
eq(nsnOf('1630-01-087-0430 (27-R-A942)', 'no NSN here'), '1630-01-087-0430', 'an NSN as the title');
eq(nsnOf('Solicitation SPE7M127Q0182, phone 804-279-3765.'), null, 'a solicitation or phone number is not an NSN');
eq(dlaOffice('Dept of Defense / Defense Logistics Agency / DLA Aviation at Philadelphia, PA / DLA Aviation'), 'DLA Aviation', 'aviation sites group under DLA Aviation');
eq(dlaOffice('Dept of Defense / Defense Logistics Agency / Troop Support Construction & Equipment / DLA Troop Support'), 'DLA Troop Support', 'troop support divisions group');
eq(dlaOffice('Dept of Defense / Defense Logistics Agency / DLA Land and Maritime / x'), 'DLA Land and Maritime', 'land and maritime is not land or maritime');
eq(dlaOffice('Dept of Defense / Defense Logistics Agency / SPRMM1 DLA Mechanicsburg / x'), 'Other DLA offices', 'unknown offices are grouped');
eq(setAsideShort('Small Business Set Aside - Total'), 'Small business', 'total small business');
eq(setAsideShort('Service-Disabled Veteran-Owned Small Business (SDVOSB) Set-Aside (FAR 19.14)'), 'SDVOSB', 'SDVOSB before small business');
eq(setAsideShort('May be set aside for small businesses'), '', '"may be" is not a set-aside');
eq(setAsideShort('No Set aside used'), '', 'none');

if (fails.length) {
  console.error(`bids selftest: ${fails.length} failed, ${pass} passed\n  - ${fails.join('\n  - ')}`);
  process.exit(1);
}
console.log(`bids selftest: ${pass} passed`);
