// The "Documents posted" list on public bid pages: the names of the files an
// agency posted with a solicitation, and which of them are forms GovHub fills
// out. No imports, so the selftest can load it with plain Node
// (scripts/bids.selftest.mjs).
//
// Names come from public_bid_listings().attachment_names (strata-parse
// 20261109121000): the #name= fragment the app's adapters store, else the
// link's last path segment, percent-encoded as stored. Names only; the files
// themselves open in GovHub, which is what the free trial unlocks.
//
// Why: "Required forms" was on the Nov 8 SEO list, but the real list of
// required forms exists only after the app analyzes a solicitation, and
// analyzing all 18,700 open bids would cost too much. The file names are free
// and say a lot: on 2026-11-09, 2,977 open bids had named files, about 870 a
// statement of work, and hundreds a standard form (SF 1449, SF 30, SF 330), a
// pricing sheet, a wage determination or a certification.

export interface BidDocument {
  name: string;
  /** Short label for what the file is, when the name says ("SF 1449", "Pricing sheet"). */
  tag: string | null;
  /** A form GovHub fills out from the company profile. */
  form: boolean;
}

// Standard government forms, by number: true when the vendor fills it out (so
// GovHub does), false when the agency does (DD 254 security classification,
// DD 1423 data requirements, DD 1155 and OF 347 orders), which are still named
// but not flagged. A number outside these lists is not tagged at all, so "SF 2"
// in some file name is never a form.
const FORMS: Record<'SF' | 'DD' | 'OF', Record<string, boolean>> = {
  SF: { '18': true, '26': true, '30': true, '33': true, '44': true, '252': true, '294': true, '295': true, '328': true, '330': true, '1408': true, '1413': true, '1442': true, '1447': true, '1449': true, LLL: true },
  DD: { '254': false, '1155': false, '1423': false, '1494': false, '2345': true },
  OF: { '17': true, '336': true, '347': false },
};

/** Letters and digits split into words: "WrittenProposalTemplate_v2" -> "Written Proposal Template v2". */
function words(name: string): string {
  return name
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[_\-.,()[\]+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function standardForm(w: string): { tag: string; form: boolean } | null {
  for (const m of w.matchAll(/\b(SF|DD|OF|Standard Form)\s?(\d{2,4}|LLL)\b/gi)) {
    const series = (m[1].toUpperCase() === 'STANDARD FORM' ? 'SF' : m[1].toUpperCase()) as keyof typeof FORMS;
    const num = m[2].toUpperCase();
    // "of" is a word; only an upper-case OF is Optional Form.
    if (series === 'OF' && m[1] !== 'OF') continue;
    const vendorFills = FORMS[series][num];
    if (vendorFills !== undefined) return { tag: `${series} ${num}`, form: vendorFills };
  }
  return null;
}

// Order matters: the first rule that matches tags the file.
const RULES: { re: RegExp; tag: string; form: boolean }[] = [
  { re: /\b(pric(e|ing)|cost|bid|quote|quotation)\s?(schedule|sheet|worksheet|form|template|workbook)s?\b|\bschedule of (items|prices|supplies|services)\b|\bbid tab\b/i, tag: 'Pricing sheet', form: true },
  { re: /\brep(resentation)?s?\s?(and|&)?\s?cert(ification)?s?\b|\b52 212 3\b|\b52 204 2[46]\b/i, tag: 'Reps and certs', form: true },
  { re: /\bpast performance\s?(questionnaire|survey|form|reference)s?\b|\bPPQ\b/i, tag: 'Past performance form', form: true },
  { re: /\b(proposal|response|submission|quote|quotation|offer|rfi|rfq)\s?(template|form|cover sheet)s?\b/i, tag: 'Response form', form: true },
  { re: /\bW ?9\b|\bvendor (registration|information) form\b/i, tag: 'Vendor form', form: true },
  { re: /\b(affidavit|non ?collusion|certification form)s?\b/i, tag: 'Certification form', form: true },
  { re: /\bquestionnaire\b/i, tag: 'Questionnaire', form: true },
  { re: /\bwage determination\b|\bWD\b|\bdavis bacon\b/i, tag: 'Wage determination', form: false },
  { re: /\bstatement of (work|objectives)\b|\b(SOW|PWS|SOO)\b|\bperformance work statement\b|\bscope of (work|services)\b/i, tag: 'Statement of work', form: false },
  { re: /\bspecification(s)?\b|\bspecs\b|\btechnical (requirements|data package)\b/i, tag: 'Specifications', form: false },
  { re: /\bdrawings?\b|\bplan sheets?\b|\bblueprints?\b/i, tag: 'Drawings', form: false },
  { re: /\bamm?endment\b|\bmodification\b/i, tag: 'Amendment', form: false },
  { re: /\bquestions? (and|&) answers?\b|\bQ ?& ?A\b|\bQ and A\b/i, tag: 'Questions and answers', form: false },
];

/** What a file is, from its name: a tag and whether GovHub fills it out. */
export function classifyDocument(name: string): { tag: string | null; form: boolean } {
  const w = words(name);
  const sf = standardForm(w);
  if (sf) return sf;
  for (const r of RULES) if (r.re.test(w)) return { tag: r.tag, form: r.form };
  return { tag: null, form: false };
}

/** A stored name made readable: decoded, single-spaced, no em dashes. Null when nothing is left. */
export function cleanDocumentName(raw: string): string | null {
  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    // A stray "%" in a name: keep it as stored.
  }
  name = name
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s*—\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
  return name.length >= 3 ? name.slice(0, 160) : null;
}

/** The bid's posted files: cleaned, de-duplicated (case-insensitive), tagged, in posted order. */
export function bidDocuments(rawNames: readonly string[] | null | undefined): BidDocument[] {
  const seen = new Set<string>();
  const out: BidDocument[] = [];
  for (const raw of rawNames ?? []) {
    const name = cleanDocumentName(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, ...classifyDocument(name) });
  }
  return out;
}
