// The things the cold emails promised, built from the real documents.
//
// Every generator returns the same shape:
//   { kind, body, facts, sources, gaps, warnings, needsInput, needsApproval, closed? }
// `body` is plain text that goes into the email verbatim, between Earl's
// opening and closing lines. `facts` is what the composer may lean on for
// those lines. `needsInput` names business decisions only Earl can make;
// a non-empty list means the reply is drafted but never sent.
//
// THE HONESTY RULE these exist to enforce. The A2 base copy says "There are a
// couple of those in this one" about every solicitation, and no code has ever
// checked (outreach-assign/index.ts builds it as a fixed string). The A1 copy
// says "your contract runs out in December" from a single end date. When
// someone says yes, the deliverable is the first time anyone reads the
// document, so it must report what the document says, including when that
// contradicts the email. Prompts below say so in as many words.

import { structured, S } from './llm.mjs';
import {
  samBySolNumber, samDetail, samAttachmentText, samOpen, recipientAwards, awardDetail, deadlineMs, fmtDeadline,
} from './sources.mjs';
import { VOICE } from './voice.mjs';
import { DEBRIEF_ONE_PAGER, PARTNER_TERMS, CREATOR_TERMS, MATRIX_BUILDER_URL } from './content.mjs';

const fmtDate = fmtDeadline;
const cleanTitle = (t) => String(t || '').replace(/^[A-Z0-9]{3,5}\s*--\s*/, '').replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
// Models number their own lines about half the time; the list numbering is ours.
const unnumber = (line) => String(line).replace(/^\s*\d+[.)]\s+/, '').trim();
const docsBlock = (docs) => docs.map((d) => `===== DOCUMENT: ${d.name}${d.truncated ? ' (truncated)' : ''} =====\n${d.text}`).join('\n\n');

const LINE_RULES = `Each "line" is written in Earl's voice for a plain-text email a busy owner reads on a phone: one or two short sentences, at most 35 words, plain English in the owner's vocabulary (no regulation acronyms they would not use), no em dashes, no markdown. Lead with the trap itself, not a label like "First trap:". End with its source in parentheses using a short document name and section, e.g. "(RLP 2.01.A)" or "(SF 1449, block 9)".`;

// ---- A2: what would disqualify you on this one ----------------------------

const DQ_SCHEMA = S.obj({
  procurement_subject: S.str('One sentence: what is actually being bought.'),
  deadline_and_method: S.str('One plain sentence in Earl\'s voice: when and how offers are due, with its source in parentheses.'),
  items: S.arr(S.obj({
    rule: S.str('The gating rule, stated literally.'),
    why: S.str('Why missing it gets the offer rejected or the offeror ruled ineligible.'),
    action: S.str('What the bidder does about it.'),
    source: S.str('Document and section/page.'),
    line: S.str('The email line. ' + LINE_RULES),
  }), '3 to 5 gates, most consequential first. Five only if all five can each sink the offer on their own.'),
  also_watch: S.arr(S.str(), '0 to 2 short lines: costly but not fatal. Same voice rules, each with its source. Nothing that only matters after award.'),
  fit_note: S.str('If the whole bid hinges on something about this company the documents make a precondition (e.g. owning space in the area, holding the set-aside status), one plain sentence naming it the way a person in the business would. Otherwise "".'),
  confidence: S.enum(['high', 'medium', 'low']),
  gaps: S.arr(S.str(), 'Documents not read or truncated that could hide a gate. Empty if none.'),
});

export async function disqualifierList({ solNumber, companyName, naics }) {
  const notice = await samBySolNumber(solNumber);
  if (!notice) {
    return blocked('disqualifiers', `Could not find ${solNumber} on SAM.gov as an active notice. It may have been cancelled, archived, or renumbered by an amendment.`);
  }
  const detail = await samDetail(notice._id);
  const due = detail.responseDeadline || notice.responseDateActual || notice.responseDate;
  const closesAt = deadlineMs(due);
  if (closesAt && closesAt < Date.now() + 24 * 3600000) {
    return { ...empty('disqualifiers'), closed: true, facts: { notice: summary(detail), closedOn: fmtDate(due), title: cleanTitle(detail.title) } };
  }
  const { docs, skipped } = await samAttachmentText(notice._id);
  if (!docs.length && detail.description.length < 400) {
    return blocked('disqualifiers', `${solNumber} has no readable attachments and almost no description, so there is nothing to check yet.`);
  }

  const out = await structured({
    schemaName: 'disqualifier_list',
    schema: DQ_SCHEMA,
    system: `You are an adversarial compliance reviewer for U.S. government procurement. Your job is to find every way an offer could be rejected without scoring, or the offeror ruled ineligible, so a small firm deciding whether to bid sees the traps before it spends a week on the response.

Principles (from GovHub's forensic review):
- Mandatory means "shall / must / will not be considered / will be rejected / required". "Should / may / preferred" is scored, not gating. Only gating rules go in items.
- CITE EVERY CLAIM with a document and section or page. If you cannot cite it, do not assert it. Never invent a requirement, form, or date.
- Prefer gates that are easy to miss over the obvious ones (everyone knows to submit on time; fewer know the space cannot sit next to a floodplain).
- Include eligibility gates the documents impose: set-aside status, registrations, certifications, licenses, site or location constraints, experience thresholds.
- If the documents contradict each other on a gating point, that IS an item: say so and say to ask the CO.
- Write for the company named, using only the facts given about it.

Voice for the "line" fields and other email-facing strings:
${VOICE}`,
    user: `COMPANY: ${companyName} (NAICS ${naics || 'unknown'})

NOTICE: ${detail.solicitationNumber}, ${cleanTitle(detail.title)}
Type: ${notice.type?.value || detail.type}
Set-aside: ${detail.setAside}
Response deadline: ${detail.responseDeadline || notice.responseDate}
Place of performance: ${detail.placeOfPerformance || 'not stated'}
NAICS on notice: ${detail.naics.join(', ') || 'not stated'}

NOTICE DESCRIPTION:
${detail.description.slice(0, 8000) || '(none)'}

${docsBlock(docs)}

${skipped.length ? `ATTACHMENTS NOT READ: ${skipped.join('; ')}` : ''}`,
  });

  const lines = out.items.map((it, i) => `${i + 1}. ${unnumber(it.line)}`);
  let body = lines.join('\n');
  if (out.also_watch.length) body += `\n\nAlso worth a look:\n${out.also_watch.map((l) => `- ${l}`).join('\n')}`;
  body += `\n\n${out.deadline_and_method}`;
  return {
    kind: 'disqualifiers',
    body,
    facts: {
      notice: summary(detail),
      subject: out.procurement_subject,
      fit: out.fit_note,
      count: out.items.length,
      confidence: out.confidence,
    },
    sources: [detail.url, ...docs.map((d) => d.name)],
    gaps: [...out.gaps, ...skipped.map((s) => `not read: ${s}`)],
    warnings: out.confidence === 'low' ? ['model reported low confidence; read the RLP sections it cites before sending'] : [],
    needsInput: [],
    needsApproval: false,
    raw: out,
  };
}

// ---- A4 (and A2 after close): the next ones in your lane ------------------

const PICK_SCHEMA = S.obj({
  lane: S.str('One phrase: the work this company does, as evidenced by the facts.'),
  picks: S.arr(S.obj({ noticeId: S.str(), why: S.str('Why this is in their lane.') }), 'Up to the requested count, best first. Fewer if fewer genuinely fit.'),
});

const OPP_SCHEMA = S.obj({
  line: S.str('The email line for this opportunity, at most 55 words, shaped like "<Agency>, <what is being bought, in plain words>, <solicitation number>, closes <Mon D>. <Set-aside in plain words, or "Open to any business">. The catch: <the one gate most likely to sink a small firm\'s bid> (<source>)." Add the place only if it is known. Never write "not stated" or "unknown"; leave out what you do not know. Every fact must come from the notice and documents given. ' + LINE_RULES),
  gate_source: S.str('Document and section for the gate.'),
});

const PICK_SYSTEM = 'You pick federal solicitations a specific small company could realistically bid. Be strict: a shared NAICS code is not enough, the work itself must be what this company does (if all you know is the NAICS code and one item they were pitched, stay close to that item family). Returning fewer picks, or none, is correct when fewer fit. Never pick a notice whose title or summary shows work outside their lane.';

async function lanePick({ candidates, companyName, naics, context, count }) {
  if (!candidates.length) return { lane: '', picks: [] };
  const out = await structured({
    schemaName: 'lane_picks',
    schema: PICK_SCHEMA,
    system: PICK_SYSTEM,
    user: `COMPANY: ${companyName}\nNAICS: ${naics || 'unknown'}\nWHAT WE KNOW: ${context}\nPICK UP TO: ${count}\n\nCANDIDATES (noticeId | solicitation | agency | closes | title | summary):\n${candidates.map((c) => `${c.noticeId} | ${c.solicitationNumber} | ${c.agency} | ${fmtDate(c.responseDate)} | ${cleanTitle(c.title)} | ${c.summary.slice(0, 240)}`).join('\n')}`,
  });
  return { lane: out.lane, picks: out.picks.filter((p) => candidates.some((c) => c.noticeId === p.noticeId)).slice(0, count) };
}

async function laneCandidates({ naics, keywords, excludeSol, minDays, maxDays }) {
  const pools = [];
  if (naics) pools.push(...await samOpen({ naics, minDays, maxDays }));
  for (const q of keywords.slice(0, 2)) pools.push(...await samOpen({ q, minDays, maxDays, size: 60 }));
  const seen = new Set(excludeSol.map((s) => String(s).toUpperCase()));
  return pools.filter((o) => {
    const k = String(o.solicitationNumber || o.noticeId).toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 80);
}

/**
 * The next open solicitations in a firm's lane. When fewer than `count` are
 * open (shredding on 2026-10-04: none), it does not pad. It lists what closed
 * in the lane recently, as proof the work exists, and returns a `watch` so
 * the desk re-checks daily and drafts a follow-up when the next one posts,
 * which is what "the next three before they close" actually promised.
 */
export async function nextOpen({ naics, keywords = [], companyName, context = '', count = 3, excludeSol = [] }) {
  const candidates = await laneCandidates({ naics, keywords, excludeSol, minDays: 7, maxDays: 60 });
  const pick = await lanePick({ candidates, companyName, naics, context, count });
  const due = (id, pool) => deadlineMs(pool.find((c) => c.noticeId === id)?.responseDate) || Infinity;
  // Soonest deadline first: that is the order they have to act in.
  const picked = [...pick.picks].sort((a, b) => due(a.noticeId, candidates) - due(b.noticeId, candidates));

  let recent = [];
  if (picked.length < count) {
    const closed = await laneCandidates({ naics, keywords, excludeSol, minDays: -45, maxDays: -1 });
    recent = (await lanePick({ candidates: closed, companyName, naics, context, count: 3 })).picks
      .map((p) => closed.find((c) => c.noticeId === p.noticeId))
      .sort((a, b) => deadlineMs(b.responseDate) - deadlineMs(a.responseDate));
  }
  const watch = picked.length < count
    ? { naics, keywords, companyName, context, count: count - picked.length, exclude: [...excludeSol, ...picked.map((p) => candidates.find((c) => c.noticeId === p.noticeId)?.solicitationNumber)].filter(Boolean) }
    : null;

  if (!picked.length && !recent.length) {
    return { ...blocked('next_open', `Nothing open or recently closed is genuinely in ${companyName}'s lane${pick.lane ? ` (${pick.lane})` : ''}.`), watch };
  }

  const lines = [];
  const sources = [];
  const gaps = [];
  for (const [i, p] of picked.entries()) {
    const detail = await samDetail(p.noticeId);
    const { docs, skipped } = await samAttachmentText(p.noticeId, { maxDocs: 3, maxCharsPerDoc: 40000, maxTotal: 70000 });
    const o = await structured({
      schemaName: 'opportunity_line',
      schema: OPP_SCHEMA,
      system: `You summarize one open federal solicitation for a small business owner in a single email line, including the one gating rule most likely to sink a small firm's bid. Cite it. Never invent a requirement; if the documents give no gate beyond the deadline, say what has to be submitted and how.\n\n${VOICE}`,
      user: `NOTICE: ${detail.solicitationNumber}, ${cleanTitle(detail.title)}\nAgency: ${candidates.find((c) => c.noticeId === p.noticeId)?.agency}\nCloses: ${fmtDate(detail.responseDeadline)}\nSet-aside: ${detail.setAside}\n${detail.placeOfPerformance ? `Place: ${detail.placeOfPerformance}\n` : ''}\nDESCRIPTION:\n${detail.description.slice(0, 6000)}\n\n${docsBlock(docs)}`,
    });
    lines.push(`${i + 1}. ${unnumber(o.line)}`);
    sources.push(detail.url);
    if (!docs.length) gaps.push(`${detail.solicitationNumber}: no readable attachments, gate taken from the notice text`);
    for (const s of skipped) gaps.push(`${detail.solicitationNumber}: not read: ${s}`);
  }
  // Recently closed: facts straight from the search hit, no model wording,
  // because these are evidence that the lane is live, not advice.
  let body = lines.join('\n');
  if (recent.length) {
    const agencyShort = (a) => String(a || '').split(' / ').pop().replace(/,? DEPARTMENT OF( THE)?/i, '').replace(/^DEPT OF (THE )?/i, '').trim();
    const recentLines = recent.map((r) => `- ${titleCase(agencyShort(r.agency))}, ${cleanTitle(r.title)}, ${r.solicitationNumber}, closed ${fmtDate(r.responseDate)}`);
    body += `${body ? '\n\n' : ''}${picked.length ? 'Also in your lane, closed in the last few weeks:' : 'In your lane, closed in the last few weeks:'}\n${recentLines.join('\n')}`;
    for (const r of recent) sources.push(`https://sam.gov/opp/${r.noticeId}/view`);
  }
  return {
    kind: 'next_open',
    body,
    facts: {
      lane: pick.lane, open: picked.length, asked: count, recentlyClosed: recent.length, why: picked.map((p) => p.why), watching: Boolean(watch),
      openSol: picked.map((p) => candidates.find((c) => c.noticeId === p.noticeId)?.solicitationNumber).filter(Boolean),
    },
    sources,
    gaps,
    warnings: picked.length < count ? [`only ${picked.length} of ${count} open in lane; the desk will watch and draft a follow-up when the next one posts`] : [],
    needsInput: [],
    needsApproval: false,
    watch,
  };
}

const titleCase = (s) => String(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Of|And|The|For)\b/g, (m) => m.toLowerCase());

// ---- A1: what would get the recompete bid tossed ---------------------------

const RECOMPETE_SCHEMA = S.obj({
  claim_check: S.str('If the contract the cold email referred to is not really a recompete (e.g. a supply delivery order under a schedule or IDIQ, or it is not ending when claimed), one or two sentences in Earl\'s voice owning the mistake plainly and naming what it actually is. "" if the claim holds.'),
  focus: S.str('One or two sentences naming the contract worth planning the recompete around: PIID, what it is, the buying office, when it ends, and how it was bought (set-aside, procedure, number of offers). Earl\'s voice.'),
  timing: S.str('One or two sentences on when the follow-on is likely to surface and what to watch for, grounded in the dates given. If a posted notice clearly IS the follow-on, name it; otherwise say nothing about notices. Never refer to the material you were given ("the notices listed", "the awards above").'),
  items: S.arr(S.obj({
    line: S.str('One or two sentences, at most 45 words, Earl\'s voice, no em dashes, about one specific thing that would get THIS recompete bid rejected or ruled ineligible before scoring.'),
    basis: S.str('What it rests on: the award fact (set-aside, procedure, NAICS, office) and the rule.'),
  }), '4 to 6 items, most consequential first.'),
  confidence: S.enum(['high', 'medium', 'low']),
  gaps: S.arr(S.str()),
});

export async function recompeteRundown({ companyName, agencyShort, endMonth }) {
  const awards = await recipientAwards(companyName);
  if (!awards.length) return blocked('recompete', `USASpending has no contract awards for "${companyName}" in the last five years.`);

  const now = Date.now();
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const claimed = awards.filter((a) => {
    const end = new Date(a.end);
    return end.getTime() > now && months[end.getUTCMonth()] === String(endMonth || '').toLowerCase() &&
      (!agencyShort || agencyMatches(a.agency, agencyShort));
  });
  // The contracts a real recompete could be about: still running, ending within
  // two years, services before products, biggest first.
  const live = awards
    .filter((a) => Date.parse(a.end) > now && Date.parse(a.end) < now + 730 * 86400000)
    .sort((a, b) => isService(b) - isService(a) || (b.amount || 0) - (a.amount || 0));
  const focus = [...new Map([...claimed.slice(0, 2), ...live.slice(0, 4)].map((a) => [a.piid, a])).values()];
  // Detail is best-effort: an award a few days old is in the search index but
  // 404s on the detail endpoint (seen live: a Sept 30 HHS award, Oct 4).
  const details = [];
  for (const a of focus) {
    let extra = {};
    try { extra = await awardDetail(a.internalId); } catch { extra = { detailUnavailable: true }; }
    details.push({ ...a, ...extra });
  }

  // WHICH CONTRACT THE RUNDOWN IS ABOUT is decided here, not by the model. Left
  // to the model, the same inputs produced a rundown that corrected the cold
  // email ("that December order is a supply delivery order") and then planned
  // the whole recompete around that same order. A delivery order under a parent
  // vehicle, or a product buy, is not recompeted; a standalone services
  // contract is. Of those, the one ending soonest is the one to plan for.
  const claimedDetail = details.find((d) => claimed.some((c) => c.piid === d.piid)) || null;
  const claimHolds = Boolean(claimedDetail && recompetable(claimedDetail));
  // The conversation is about the agency the email named, so a contract with
  // that agency wins over a sooner one elsewhere (left alone, the rule chose
  // an SEC insurance policy for a reply about a VA recompete).
  const sameAgency = (d) => (agencyShort && agencyMatches(d.agency, agencyShort) ? 1 : 0);
  const chosen = claimHolds
    ? claimedDetail
    : details.filter(recompetable)
      .sort((a, b) => sameAgency(b) - sameAgency(a) || Date.parse(a.currentEnd || a.end) - Date.parse(b.currentEnd || b.end))[0] || null;
  const claimNote = !claimedDetail
    ? `No ${agencyShort || ''} award ending in ${endMonth || '?'} was found, so the cold email's date cannot be matched. Say so plainly in claim_check.`
    : claimHolds
      ? 'The claimed contract is a standalone services contract; the claim holds. claim_check must be "".'
      : `The claimed contract ${claimedDetail.piid} is ${claimedDetail.parentIdv ? `a delivery order under parent vehicle ${claimedDetail.parentIdv}` : 'a product buy'}${isService(claimedDetail) ? '' : ' for supplies'}, which is not recompeted the way a services contract is. claim_check must say so.`;
  const focusNote = chosen
    ? `THE CONTRACT TO PLAN AROUND (decided; focus and every item must be about this one, not any other): ${chosen.piid}, ${chosen.description}, ${chosen.awardingOffice || chosen.agency}, ends ${chosen.currentEnd || chosen.end}${chosen.potentialEnd ? ` (potential ${String(chosen.potentialEnd).slice(0, 10)})` : ''}, set-aside: ${chosen.setAside || 'unknown'}, procedure: ${chosen.solicitationProcedures || 'unknown'}, offers: ${chosen.offersReceived || 'unknown'}, NAICS ${chosen.naics || 'unknown'}.`
    : 'No standalone services contract ends in the next two years. Say plainly that nothing on their record is up for recompete soon, and make the items about what gets a bid on their kind of work tossed in general, grounded in their award history.';

  const followOn = [];
  for (const d of details.slice(0, 2)) {
    const q = String(d.description || '').split(/\s+/).slice(0, 4).join(' ');
    if (!q) continue;
    const hits = await samOpen({ q, naics: (d.naics || '').split(' ')[0], minDays: 0, maxDays: 400, size: 25, noticeTypes: 'r,p,o,k' });
    for (const h of hits.slice(0, 8)) followOn.push({ for: d.piid, ...h });
  }

  const out = await structured({
    schemaName: 'recompete_rundown',
    schema: RECOMPETE_SCHEMA,
    system: `You prepare a short recompete rundown for a small federal contractor: what would get their bid on the follow-on to their own contract rejected or ruled ineligible before anyone scores it.

Ground every item in the award facts given (set-aside type, solicitation procedure, NAICS, buying office, competition) plus well-established federal rules that follow from them, for example: a set-aside means the firm must hold that status (and any required certification, e.g. SBA VetCert for SDVOSB set-asides) when it submits; size is measured against the NAICS size standard on the new solicitation; SAM registration must be active with current reps and certs; limitations on subcontracting apply to set-aside awards; a simplified acquisition quote that leaves out a required form or misses the quote format is non-responsive. Do not cite specific clause numbers or dollar thresholds unless you are certain of them. Never invent facts about this company.

Be honest about the cold email. It said the ${agencyShort || ''} contract "runs out in ${endMonth || '?'}". Check that against the awards. A supply delivery order under a Federal Supply Schedule or IDIQ is not recompeted the way a services contract is; if that is what the date was, say so plainly in claim_check and point them at the contract that actually matters.

${VOICE}`,
    user: `COMPANY: ${companyName}
COLD EMAIL CLAIM: ${agencyShort || '?'} contract ending ${endMonth || '?'}
TODAY: ${new Date().toISOString().slice(0, 10)}

CLAIM CHECK (decided): ${claimNote}
${focusNote}

AWARDS MATCHING THE CLAIM:
${claimed.map(fmtAward).join('\n') || '(none)'}

CONTRACTS TO CONSIDER (detail):
${details.map((d) => JSON.stringify(d)).join('\n')}

ALL RECENT AWARDS (piid | agency | end | amount | description):
${awards.slice(0, 25).map(fmtAward).join('\n')}

POSSIBLY RELATED OPEN NOTICES ON SAM.GOV (may be unrelated; only mention one if it clearly is the follow-on):
${followOn.map((f) => `${f.for} -> ${f.solicitationNumber} | ${f.type} | ${f.agency} | ${f.responseDate || 'no date'} | ${cleanTitle(f.title)}`).join('\n') || '(none found)'}`,
  });

  const parts = [];
  if (out.claim_check) parts.push(out.claim_check);
  parts.push(`${out.focus} ${out.timing}`.trim());
  parts.push(`What would get that bid tossed before anyone scores it:\n${out.items.map((it, i) => `${i + 1}. ${unnumber(it.line)}`).join('\n')}`);
  return {
    kind: 'recompete',
    body: parts.join('\n\n'),
    facts: { corrected: Boolean(out.claim_check), focus: out.focus, confidence: out.confidence },
    sources: details.map((d) => `https://www.usaspending.gov/award/${d.internalId}`),
    gaps: out.gaps,
    warnings: [
      ...(out.claim_check ? ['the rundown corrects the cold email; read the correction before sending'] : []),
      ...(out.confidence === 'low' ? ['model reported low confidence'] : []),
    ],
    needsInput: [],
    needsApproval: false,
    raw: out,
  };
}

// ---- Fixed content -------------------------------------------------------

export function debriefOnePager() {
  return {
    kind: 'debrief_one_pager',
    body: DEBRIEF_ONE_PAGER.text,
    facts: { title: 'How to find out why you lost a federal bid' },
    sources: ['scripts/outreach/reply-desk/content.mjs DEBRIEF_ONE_PAGER'],
    gaps: [],
    warnings: DEBRIEF_ONE_PAGER.approved ? [] : [`one-pager not yet approved in content.mjs; verify: ${DEBRIEF_ONE_PAGER.verify.join('; ')}`],
    needsInput: [],
    needsApproval: !DEBRIEF_ONE_PAGER.approved,
  };
}

export function partnerTerms() {
  const t = PARTNER_TERMS;
  const missing = Object.entries({
    'PARTNER_TERMS.revenueSharePercent': t.revenueSharePercent,
    'PARTNER_TERMS.clientWorkspaces': t.clientWorkspaces,
    'PARTNER_TERMS.attribution': t.attribution,
    'PARTNER_TERMS.payout': t.payout,
  }).filter(([, v]) => v === null || v === '').map(([k]) => k);
  const v = (x, label) => (x === null || x === '' ? `[${label}]` : x);
  const body = [
    `1. A partner account for you at no cost, with ${v(t.clientWorkspaces, 'NUMBER OF CLIENT WORKSPACES')} client workspaces under it. Setup takes ${t.setupTime}.`,
    `2. ${v(t.revenueSharePercent, 'SHARE PERCENT')}${t.revenueSharePercent ? ' percent' : ''} of whatever a client you refer pays, every month, for as long as they stay subscribed.`,
    `3. Referrals are tracked by ${v(t.attribution, 'HOW A REFERRAL IS ATTRIBUTED')}. Paid ${v(t.payout, 'PAYOUT TIMING AND METHOD')}.`,
    '4. No exclusivity, no minimum, and no requirement that you ever mention us. You keep the client relationship and the invoice.',
  ].join('\n');
  return {
    kind: 'partner_terms', body, facts: {}, sources: ['content.mjs PARTNER_TERMS'], gaps: [],
    warnings: [], needsInput: missing, needsApproval: false,
  };
}

export function creatorTerms() {
  const t = CREATOR_TERMS;
  const missing = Object.entries({
    'CREATOR_TERMS.revenueSharePercent': t.revenueSharePercent,
    'CREATOR_TERMS.audienceRate': t.audienceRate,
    'CREATOR_TERMS.attribution': t.attribution,
  }).filter(([, v]) => v === null || v === '').map(([k]) => k);
  const v = (x, label) => (x === null || x === '' ? `[${label}]` : x);
  const body = [
    `1. ${t.account[0].toUpperCase()}${t.account.slice(1)}.`,
    `2. ${v(t.revenueSharePercent, 'SHARE PERCENT')}${t.revenueSharePercent ? ' percent' : ''} of every subscription your audience starts, paid monthly for as long as they stay.`,
    `3. ${v(t.audienceRate, 'AUDIENCE RATE')} for your audience, through ${v(t.attribution, 'CODE OR LINK')}. That is a better rate than our own site offers.`,
    '4. Send me any solicitation your audience would recognize and I will run it and send back everything it produces, yours to use however you like.',
  ].join('\n');
  return {
    kind: 'creator_terms', body, facts: {}, sources: ['content.mjs CREATOR_TERMS'], gaps: [],
    warnings: [], needsInput: missing, needsApproval: false,
  };
}

export function matrixBuilder() {
  return {
    kind: 'matrix_builder', body: MATRIX_BUILDER_URL, facts: { url: MATRIX_BUILDER_URL },
    sources: [MATRIX_BUILDER_URL], gaps: [], warnings: [], needsInput: [], needsApproval: false,
  };
}

// ---- helpers ---------------------------------------------------------------

function empty(kind) {
  return { kind, body: '', facts: {}, sources: [], gaps: [], warnings: [], needsInput: [], needsApproval: false };
}

function blocked(kind, reason) {
  return { ...empty(kind), blocked: reason, warnings: [reason] };
}

function summary(d) {
  return {
    solicitationNumber: d.solicitationNumber,
    title: cleanTitle(d.title),
    setAside: d.setAside,
    closes: fmtDate(d.responseDeadline),
    place: d.placeOfPerformance,
    url: d.url,
  };
}

function fmtAward(a) {
  return `${a.piid} | ${a.agency}${a.subAgency && a.subAgency !== a.agency ? ` / ${a.subAgency}` : ''} | ends ${a.end} | $${Math.round(a.amount || 0).toLocaleString()} | ${a.description}`;
}

// PSC codes starting with a letter are services (R706 logistics support);
// all-digit codes are products (6515 medical supplies).
export function isService(a) { return /^[A-Z]/i.test(String(a.psc || '').trim()); }
// Recompeted the normal way: a services contract that is not an order placed
// under someone's schedule or IDIQ. The parent also lives in the USASpending
// id (CONT_AWD_<piid>_<agency>_<parent piid or -NONE->_<agency>), which is all
// there is when the detail endpoint 404s on a brand-new award.
export function recompetable(d) {
  const parent = d.parentIdv || String(d.internalId || '').split('_')[4]?.replace('-NONE-', '') || '';
  return isService(d) && !parent && !/delivery order|task order|bpa call/i.test(d.type || '');
}

const AGENCY_ALIASES = {
  VA: /veterans affairs/i, DOD: /defense|army|navy|air force/i, DHS: /homeland security/i,
  USDA: /agriculture/i, DOI: /interior/i, HHS: /health and human/i, GSA: /general services/i,
  DOE: /energy/i, DOT: /transportation/i, DOJ: /justice/i, SSA: /social security/i,
};
function agencyMatches(name, short) {
  const re = AGENCY_ALIASES[String(short).toUpperCase()];
  return re ? re.test(name) : String(name).toLowerCase().includes(String(short).toLowerCase());
}
