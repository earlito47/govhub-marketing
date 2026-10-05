// Public federal data the deliverables are built from. All keyless.
//
// SAM.GOV: NOT the api.sam.gov Opportunities API. Both SAM keys on this
// account fail (A3 was dropped over it, see instantly-angles.mjs), and the
// signal pipeline only reads the bulk CSV, which has no attachments. These are
// the endpoints sam.gov's own web UI calls. They need no key but they DO need
// `Accept: application/hal+json`; with application/json the search returns a
// 406. Verified live 2026-10-04 against 57-6395-25-006.
//
// USASPENDING: the same spending_by_award search _shared/outreach.ts uses for
// the A1 and A4 signals, so the rundown reads the data the email was built on.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SAM = 'https://sam.gov/api/prod';
const HAL = { Accept: 'application/hal+json', 'User-Agent': 'Mozilla/5.0 (GovHub reply desk)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, init = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, init);
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * 2 ** attempt); continue; }
    if (!res.ok) throw new Error(`${init.method || 'GET'} ${url} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error(`${url} -> gave up after retries`);
}

// ---- SAM.gov ---------------------------------------------------------------

export const SET_ASIDES = {
  SBA: 'Total Small Business', SBP: 'Partial Small Business', '8A': '8(a)', '8AN': '8(a) Sole Source',
  HZC: 'HUBZone', HZS: 'HUBZone Sole Source', SDVOSBC: 'SDVOSB', SDVOSBS: 'SDVOSB Sole Source',
  WOSB: 'WOSB', WOSBSS: 'WOSB Sole Source', EDWOSB: 'EDWOSB', EDWOSBSS: 'EDWOSB Sole Source',
  VSA: 'VOSB (VA)', VSS: 'VOSB Sole Source (VA)', ISBEE: 'Indian Small Business Economic Enterprise',
  IEE: 'Indian Economic Enterprise', BICiv: 'Buy Indian',
};

const norm = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

// SAM deadlines come two ways: a full timestamp with an offset
// ("2026-10-12T09:00:00-05:00") or a bare date ("2026-10-02"). The search API
// also re-serialises a bare date as UTC midnight in `responseDate`, so read
// `responseDateActual` when it exists. A bare date means "by end of that day";
// parsed naively it becomes 8pm Eastern the day BEFORE, which on 2026-10-04
// had a draft telling a CEO her solicitation "closed on Oct 1" when Earl's own
// email had said Oct 2.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const deadlineMs = (d) => (!d ? NaN : DATE_ONLY.test(d) ? Date.parse(`${d}T23:59:00-05:00`) : Date.parse(d));
export const fmtDeadline = (d) => {
  if (!d) return '';
  if (DATE_ONLY.test(d)) return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
};

function searchUrl(params) {
  const q = new URLSearchParams({ index: 'opp', page: '0', mode: 'search', ...params });
  return `${SAM}/sgs/v1/search/?${q}`;
}

/** The live notice for a solicitation number, or null. */
export async function samBySolNumber(solNumber) {
  const d = await getJson(searchUrl({ size: '25', q: solNumber, is_active: 'true' }), { headers: HAL });
  const hits = (d._embedded?.results || []).filter((o) => norm(o.solicitationNumber) === norm(solNumber));
  if (!hits.length) return null;
  hits.sort((a, b) => String(b.publishDate).localeCompare(String(a.publishDate)));
  return hits[0];
}

/** Notice detail: set-aside, deadline, place of performance, contracting officer. */
export async function samDetail(noticeId) {
  const d = await getJson(`${SAM}/opps/v2/opportunities/${noticeId}`, { headers: HAL });
  const x = d.data2 || {};
  const body = (d.description || []).map((b) => b.body || '').join('\n');
  const setAsideCode = x.solicitation?.setAside || '';
  return {
    noticeId,
    solicitationNumber: x.solicitationNumber || '',
    title: x.title || '',
    type: x.type || '',
    naics: (x.naics || []).flatMap((n) => n.code || []),
    psc: x.classificationCode || '',
    setAsideCode,
    setAside: SET_ASIDES[setAsideCode] || setAsideCode || 'None (full and open)',
    responseDeadline: x.solicitation?.deadlines?.response || '',
    placeOfPerformance: [x.placeOfPerformance?.city?.name, x.placeOfPerformance?.state?.name].filter(Boolean).join(', '),
    contacts: (x.pointOfContact || []).map((p) => ({ name: p.fullName, title: p.title, email: p.email })),
    description: htmlToText(body),
    url: `https://sam.gov/opp/${noticeId}/view`,
  };
}

/** Attachment metadata for a notice. */
export async function samAttachments(noticeId) {
  const d = await getJson(`${SAM}/opps/v3/opportunities/${noticeId}/resources`, { headers: HAL });
  return (d._embedded?.opportunityAttachmentList || [])
    .flatMap((a) => a.attachments || [])
    .filter((a) => a.accessLevel === 'public' && a.deletedFlag !== '1')
    .map((a) => ({ name: a.name, size: a.size, resourceId: a.resourceId }));
}

/**
 * Text of a notice's attachments, biggest-signal files first, capped so one
 * 400-page technical exhibit cannot crowd out the RLP that actually carries
 * the disqualifiers. Returns { docs: [{name, text}], skipped: [name] }.
 */
export async function samAttachmentText(noticeId, { maxDocs = 8, maxCharsPerDoc = 60000, maxTotal = 180000 } = {}) {
  const atts = await samAttachments(noticeId);
  // Solicitation documents first: they hold instructions and gates. Wage
  // determinations and drawings are long and rarely disqualify on their own.
  const rank = (n) => {
    const s = n.toLowerCase();
    if (/(rfp|rfq|rlp|ifb|solicitation|sf ?1449|sf ?33|sf ?1442|instructions|section l|section m|provisions|combined)/.test(s)) return 0;
    if (/(sow|pws|statement of work|requirements|specification|security|clauses)/.test(s)) return 1;
    if (/(wage|wd |determination|drawing|dwg|photo|map)/.test(s)) return 3;
    return 2;
  };
  atts.sort((a, b) => rank(a.name) - rank(b.name) || (a.size || 0) - (b.size || 0));
  const docs = [];
  const skipped = [];
  let total = 0;
  const dir = mkdtempSync(join(tmpdir(), 'reply-desk-'));
  try {
    for (const a of atts) {
      if (docs.length >= maxDocs || total >= maxTotal) { skipped.push(a.name); continue; }
      const res = await fetch(`${SAM}/opps/v3/opportunities/resources/files/${a.resourceId}/download`, { headers: HAL, redirect: 'follow' });
      if (!res.ok) { skipped.push(a.name); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const text = extractText(a.name, buf, dir);
      if (!text || text.trim().length < 200) { skipped.push(a.name); continue; }
      const clipped = text.slice(0, Math.min(maxCharsPerDoc, maxTotal - total));
      docs.push({ name: a.name, text: clipped, truncated: clipped.length < text.length });
      total += clipped.length;
      await sleep(300);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { docs, skipped };
}

/**
 * Open solicitations that close at least `minDays` out, by NAICS code and/or a
 * keyword query. A NAICS code alone is not a lane: 561990 is "all other
 * support services", and on 2026-10-04 every open 561990 notice was cemetery
 * inscription work while the lead was a shredding company. Callers search both
 * ways and let the ranking step decide what is actually in the lane.
 *
 * Returns search hits (no detail); the caller decides which few deserve a
 * samDetail() call, because each one is a request against a public service.
 */
export async function samOpen({ naics, q, minDays = 7, maxDays = 60, size = 100, noticeTypes = 'o,k' } = {}) {
  const params = { size: String(size), is_active: 'true', notice_type: noticeTypes, sort: '-modifiedDate' };
  if (naics) params.naics = naics;
  if (q) params.q = q;
  const d = await getJson(searchUrl(params), { headers: HAL });
  const now = Date.now();
  return (d._embedded?.results || [])
    // Sources sought and presolicitations often carry no response date; keep
    // them when asked for (they are how a recompete shows up first).
    .filter((o) => !o.isCanceled && (o.responseDate || noticeTypes !== 'o,k'))
    .map((o) => ({
      noticeId: o._id,
      solicitationNumber: o.solicitationNumber,
      title: o.title,
      type: o.type?.value || '',
      agency: (o.organizationHierarchy || []).map((h) => h.name).filter(Boolean).slice(0, 2).join(' / '),
      responseDate: o.responseDateActual || o.responseDate,
      daysLeft: o.responseDate ? Math.floor((deadlineMs(o.responseDateActual || o.responseDate) - now) / 86400000) : null,
      summary: htmlToText((o.descriptions || []).map((x) => x.content || '').join(' ')).slice(0, 600),
    }))
    .filter((o) => (o.daysLeft === null ? noticeTypes !== 'o,k' : o.daysLeft >= minDays && o.daysLeft <= maxDays))
    // Amendments re-list the same notice under the same solicitation number.
    .filter((o, i, all) => all.findIndex((p) => norm(p.solicitationNumber) === norm(o.solicitationNumber)) === i);
}

// ---- USASpending -----------------------------------------------------------

const AWARD_FIELDS = [
  'Award ID', 'Recipient Name', 'Recipient UEI', 'Start Date', 'End Date', 'Award Amount',
  'Awarding Agency', 'Awarding Sub Agency', 'Description', 'NAICS', 'PSC', 'generated_internal_id',
];

/** Contract awards to one recipient over the last five years, most recent end date first. */
export async function recipientAwards(recipientName, { years = 5, limit = 60 } = {}) {
  const end = new Date();
  const start = new Date(end.getTime() - years * 365 * 86400000);
  const d = await getJson('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        recipient_search_text: [recipientName],
        award_type_codes: ['A', 'B', 'C', 'D'],
        time_period: [{ start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) }],
      },
      fields: AWARD_FIELDS,
      limit,
      sort: 'End Date',
      order: 'desc',
    }),
  });
  // recipient_search_text is a fuzzy match. Keep the UEI that dominates the
  // results so a similarly named firm in another state cannot leak in.
  const rows = d.results || [];
  const byUei = new Map();
  for (const r of rows) byUei.set(r['Recipient UEI'], (byUei.get(r['Recipient UEI']) || 0) + 1);
  const topUei = [...byUei.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return rows.filter((r) => r['Recipient UEI'] === topUei).map((r) => ({
    piid: r['Award ID'],
    recipient: r['Recipient Name'],
    uei: r['Recipient UEI'],
    start: r['Start Date'],
    end: r['End Date'],
    amount: r['Award Amount'],
    agency: r['Awarding Agency'],
    subAgency: r['Awarding Sub Agency'],
    description: r.Description,
    naics: typeof r.NAICS === 'object' ? r.NAICS?.code : r.NAICS,
    psc: typeof r.PSC === 'object' ? r.PSC?.code : r.PSC,
    internalId: r.generated_internal_id,
  }));
}

/** The fields of one award that decide how its follow-on will be bought. */
export async function awardDetail(internalId) {
  const a = await getJson(`https://api.usaspending.gov/api/v2/awards/${encodeURIComponent(internalId)}/`);
  const c = a.latest_transaction_contract_data || {};
  return {
    piid: a.piid,
    parentIdv: a.parent_award?.piid || '',
    type: a.type_description || '',
    description: a.description || '',
    totalObligation: a.total_obligation,
    potentialEnd: a.period_of_performance?.potential_end_date || '',
    currentEnd: a.period_of_performance?.end_date || '',
    awardingOffice: a.awarding_agency?.office_agency_name || '',
    setAside: c.type_set_aside_description || '',
    extentCompeted: c.extent_competed_description || '',
    offersReceived: c.number_of_offers_received || '',
    solicitationProcedures: c.solicitation_procedures_description || '',
    commercialItem: c.commercial_item_acquisitio_desc || c.commercial_item_acquisition_desc || '',
    naics: c.naics ? `${c.naics} ${c.naics_description || ''}`.trim() : '',
    psc: c.product_or_service_code ? `${c.product_or_service_code} ${c.product_or_service_co_desc || ''}`.trim() : '',
    placeOfPerformance: [a.place_of_performance?.city_name, a.place_of_performance?.state_code].filter(Boolean).join(', '),
  };
}

// ---- Text extraction -------------------------------------------------------

function extractText(name, buf, dir) {
  const lower = name.toLowerCase();
  const path = join(dir, `f${Math.random().toString(36).slice(2)}${lower.slice(lower.lastIndexOf('.'))}`);
  writeFileSync(path, buf);
  try {
    if (lower.endsWith('.pdf')) {
      // poppler-utils. Present on GitHub's ubuntu runners via apt in the
      // workflow; -layout keeps the RLP's two-column tables readable.
      return execFileSync('pdftotext', ['-layout', '-q', path, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
    }
    if (lower.endsWith('.docx')) {
      const xml = execFileSync('unzip', ['-p', path, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
      return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }
    if (/\.(txt|csv|htm|html)$/.test(lower)) return htmlToText(buf.toString('utf8'));
  } catch {
    return '';
  }
  return '';
}

export function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
