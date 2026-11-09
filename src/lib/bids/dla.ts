// Display helpers for /bids/dla-parts/, the one page that lists every open
// Defense Logistics Agency parts buy (they get no page each; see NoindexReason
// in load.ts). No imports, so the selftest can load it with plain Node
// (scripts/bids.selftest.mjs).

/**
 * The National Stock Number, 4-2-3-4, when the notice names one. SAM.gov puts
 * it in the summary about half the time ("NSN 1560004897584") and sometimes in
 * the title ("1630-01-087-0430 (27-R-A942)").
 */
export function nsnOf(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const m = (t ?? '').match(/(?<![\d-])(\d{4})-?(\d{2})-?(\d{3})-?(\d{4})(?![\d-])/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
  }
  return null;
}

// The office is the third part of SAM.gov's agency path
// ("Dept of Defense / Defense Logistics Agency / DLA Aviation / DLA AV Richmond").
// About 30 spellings on 2026-11-09 ("DLA AVIATION AT PHILADELPHIA, PA",
// "TROOP SUPPORT CONSTRUCTION & EQUIPMENT"); grouped into the DLA commands.
const OFFICES: [RegExp, string][] = [
  [/land and maritime/i, 'DLA Land and Maritime'],
  [/aviation/i, 'DLA Aviation'],
  [/maritime/i, 'DLA Maritime'],
  [/\bland\b/i, 'DLA Land'],
  [/troop support/i, 'DLA Troop Support'],
  [/weapons support/i, 'DLA Weapons Support'],
  [/energy/i, 'DLA Energy'],
  [/disposition/i, 'DLA Disposition Services'],
  [/distribution/i, 'DLA Distribution'],
];

export function dlaOffice(agency: string | null | undefined): string {
  const office = (agency ?? '').split(/\s*\/\s*/)[2] ?? '';
  for (const [re, name] of OFFICES) if (re.test(office)) return name;
  return 'Other DLA offices';
}

/** A short set-aside label, or '' when the buy is open to all (or only "may be" set aside). */
export function setAsideShort(s: string | null | undefined): string {
  if (!s || /^(no set|not set|not expected|this acquisition will not|may be set)|price evaluation preference/i.test(s)) return '';
  if (/service.?disabled|sdvosb/i.test(s)) return 'SDVOSB';
  if (/hubzone/i.test(s)) return 'HUBZone';
  if (/women|wosb/i.test(s)) return 'WOSB';
  if (/\b8\(a\)/i.test(s)) return '8(a)';
  if (/small.?business/i.test(s)) return /partial/i.test(s) ? 'Small business (partial)' : 'Small business';
  return '';
}
