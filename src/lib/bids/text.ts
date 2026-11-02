// Text cleanup for public bid pages. No imports, so the selftest can load it
// with plain Node (scripts/bids.selftest.mjs).

// Kept upper case when an all-caps title is recased.
const ACRONYMS = new Set([
  'ADA', 'AV', 'CCTV', 'DLA', 'DOD', 'DOT', 'EMS', 'EUCOM', 'FAA', 'GIS', 'HVAC', 'IDIQ', 'IFB', 'IT', 'LED', 'MATOC',
  'MRO', 'NASA', 'NAVSEA', 'NSN', 'OEM', 'PPE', 'RF', 'RFI', 'RFP', 'RFQ', 'SATOC', 'UPS', 'US', 'USA', 'VA', 'VAMC',
]);

// Lower case inside a recased title ("Department of the Navy").
const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Readable H1 from a source title. SAM.gov titles carry a product/service code
 * prefix ("53--BRACKET,MOUNTING") and are often all caps; the prefix goes, an
 * all-caps title is recased with known acronyms kept, and "A,B" gets its space.
 */
export function cleanTitle(raw: string): string {
  let t = raw.replace(/^[A-Z0-9]{1,4}--\s*/, '').replace(/,(?=\S)/g, ', ').replace(/\s+/g, ' ').trim();
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 6 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.8) {
    t = t
      .split(' ')
      .map((w, i) => {
        const bare = w.replace(/[^A-Za-z]/g, '');
        if (ACRONYMS.has(bare) || (bare.length <= 3 && !/[AEIOUY]/.test(bare))) return w;
        if (i > 0 && SMALL_WORDS.has(bare.toLowerCase())) return w.toLowerCase();
        return w.toLowerCase().replace(/(^|[-/(])([a-z])/g, (_, p, c) => p + c.toUpperCase());
      })
      .join(' ');
  }
  // School districts as USAC spells them ("Lubbock Isd").
  t = t.replace(/\b(Isd|Cisd|Usd|Ufsd|Csd)\b/g, (m) => m.toUpperCase());
  return t.replace(/[\s.,;:-]+$/, '') || raw.trim();
}

/**
 * The site's voice standard bans em dashes in visible copy (check-emdash.mjs
 * fails the build on one), and model-written summaries use them. Same rule as
 * strip_dashes() in scripts/content/generate_post.py.
 */
export function noEmDash(text: string): string;
export function noEmDash(text: string | null): string | null;
export function noEmDash(text: string | null): string | null {
  if (text === null) return null;
  return text.replace(/\s*\u2014\s*/g, ', ').replace(/\s*,\s*,/g, ',').replace(/ {2,}/g, ' ');
}
