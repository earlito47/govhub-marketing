// Reply desk: answer positive Instantly replies with the thing the email promised.
//
// WHY THIS EXISTS. On 2026-10-04 the angle and influencer campaigns had seven
// people who said yes ("Yes, please", "Sure", "Send details", "Tell me") and
// not one had been answered; the oldest had waited eleven days and one had
// asked about a solicitation that closed while it waited. The deliverables the
// copy promised (a disqualifier list, a recompete rundown, the next three open
// solicitations, a debrief one-pager, partner terms) did not exist anywhere.
// See docs/reply-desk.md for the campaign-by-campaign review.
//
// WHAT IT DOES, per new inbound reply:
//   1. classify   rules first (autoresponders, bare "No"), the model for the rest
//   2. route      campaign -> playbook (reply-desk/playbooks.mjs)
//   3. build      the deliverable from the real documents: SAM.gov notice and
//                 attachments, USASpending awards (reply-desk/deliverables.mjs)
//   4. compose    Earl's opening and closing around it, linted against his
//                 voice rules (reply-desk/voice.mjs, compose.mjs)
//   5. queue      .cache/reply-desk/<email id>.txt is the editable email,
//                 .json the metadata; REVIEW.md lists everything waiting
//   6. send       only on `send <id>` (a human approved it), or `auto` for a
//                 playbook explicitly trusted with autoSend AND the
//                 REPLY_DESK_AUTOSEND=true gate
//
// NOTHING SENDS BY DEFAULT. A reply to someone who said yes is the most
// valuable email in the programme and the easiest one to get wrong in a way
// that cannot be taken back.
//
// PII: data/reply-desk.json is committed and holds ids, addresses, statuses
// and timestamps only, the same rule as instantly-replies.mjs. Reply text,
// drafts and deliverables live in .cache/ (gitignored) and in Instantly.
//
// Env:   INSTANTLY_API_KEY     read + send (emails:read, emails:write, leads:read)
//        OPENAI_API_KEY        classification, deliverables, composition
//        REPLY_DESK_MODEL      optional, default gpt-5.5
//        REPLY_DESK_BCC        optional, BCC every send (recommended for the first ones)
//        REPLY_DESK_AUTOSEND   "true" lets `auto` send playbooks marked autoSend
//        REPLY_DESK_QUOTE      "0" to stop quoting their message under the reply
// Needs: pdftotext (poppler-utils) for solicitation PDFs, unzip for .docx.
//
// Usage: node scripts/outreach/reply-desk.mjs scan [--since=2026-09-01] [--lead=a@b.com] [--redo]
//        node scripts/outreach/reply-desk.mjs show [<id>...]
//        node scripts/outreach/reply-desk.mjs send <id>... [--dry-run] [--now]
//        node scripts/outreach/reply-desk.mjs write <id> <file> [--cc=a@b.com]   a reply written by hand
//        node scripts/outreach/reply-desk.mjs dismiss <id>...        decide not to send
//        node scripts/outreach/reply-desk.mjs auto
//        node scripts/outreach/reply-desk.mjs notify [--dry-run] [--all] [--to=a@b.com]   email the review
//        node scripts/outreach/reply-desk.mjs status

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { instantly, stamp, isInbound } from './reply-desk/instantly.mjs';
import { classify, freshText } from './reply-desk/classify.mjs';
import { PLAYBOOKS, CAMPAIGNS } from './reply-desk/playbooks.mjs';
import { compose, replySubject } from './reply-desk/compose.mjs';
import { lint, assemble, toHtml, quoteText, attribution } from './reply-desk/voice.mjs';
import { DEBRIEF_ONE_PAGER, PARTNER_TERMS, CREATOR_TERMS } from './reply-desk/content.mjs';
import { renderReviewEmail } from './reply-desk/review-email.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// The committed ledger is the scheduled workflow's. A hand run that is trying
// things out points REPLY_DESK_LEDGER at a gitignored file instead, so its
// "drafted" rows never reach git and strand the workflow (which would skip
// ids whose drafts only exist on someone's laptop). That is safe because the
// workflow re-reads every thread: a reply sent by hand shows up as a manual
// send after theirs and is recorded as answered.
const LEDGER_PATH = process.env.REPLY_DESK_LEDGER || join(ROOT, 'data/reply-desk.json');
const QUEUE = join(ROOT, '.cache/reply-desk');

const [cmd = 'status', ...rest] = process.argv.slice(2);
const flag = (name) => rest.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name) => flag(name)?.split('=').slice(1).join('=') || null;
const positional = rest.filter((a) => !a.startsWith('--'));

// Statuses a queued reply can be in. Only `drafted` can send as-is.
//   drafted        ready; a human approves with `send`
//   needs_input    a business decision is missing (named in the review); edit
//                  the .txt to fill it, then `send` re-lints and allows it
//   needs_content  a fixed deliverable is not approved yet (content.mjs)
//   needs_human    no playbook, or the deliverable could not be built
//   sent | answered | no_action | referral | superseded | failed | dismissed
const SENDABLE = new Set(['drafted', 'needs_input']);

// ---------------------------------------------------------------------------

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { version: 1, cursor: null, emails: {} };

function record(id, fields) {
  ledger.emails[id] = { ...(ledger.emails[id] || {}), ...fields, updated_at: new Date().toISOString() };
  writeLedger();
}

function writeLedger() {
  const emails = {};
  for (const k of Object.keys(ledger.emails).sort()) emails[k] = ledger.emails[k];
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify({ version: 1, cursor: ledger.cursor, emails }, null, 2) + '\n');
}

const metaPath = (id) => join(QUEUE, `${id}.json`);
const textPath = (id) => join(QUEUE, `${id}.txt`);
const loadMeta = (id) => JSON.parse(readFileSync(metaPath(id), 'utf8'));
const saveMeta = (m) => { mkdirSync(QUEUE, { recursive: true }); writeFileSync(metaPath(m.id), JSON.stringify(m, null, 2) + '\n'); };

// Draft files are named by Instantly email id (a uuid). Anything else in the
// directory (REVIEW.md, a hand-run ledger pointed here by REPLY_DESK_LEDGER)
// is not a draft and must never be read as one.
const DRAFT_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;
const draftIds = () => (existsSync(QUEUE) ? readdirSync(QUEUE).filter((f) => DRAFT_FILE.test(f)).map((f) => f.slice(0, -5)) : []);
const queueMetas = () => draftIds().map(loadMeta);

// ---- Timing ---------------------------------------------------------------
// A reply that lands ninety seconds after "Yes, please" at 11pm reads as a
// bot. Earl's real cadence: within a couple of hours, during the working day.

const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false });
export function inBusinessHours(date) {
  const parts = Object.fromEntries(ET.formatToParts(date).map((p) => [p.type, p.value]));
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return false;
  const mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  return mins >= 8 * 60 + 40 && mins <= 17 * 60 + 20;
}

export function sendAfter(receivedIso, now = Date.now(), rand = Math.random) {
  let t = Math.max(now, Date.parse(receivedIso) + (25 + Math.floor(rand() * 70)) * 60000);
  let moved = false;
  for (let i = 0; i < 4 * 24 * 4 && !inBusinessHours(new Date(t)); i++) { t += 15 * 60000; moved = true; }
  if (moved) t += Math.floor(rand() * 50) * 60000;
  return new Date(t).toISOString();
}

// ---- scan -----------------------------------------------------------------

async function scan() {
  const ix = instantly();
  const since = flagValue('since') || ledger.cursor || new Date(Date.now() - 30 * 86400000).toISOString();
  const onlyLead = flagValue('lead') ? new Set(flagValue('lead').toLowerCase().split(',').map((s) => s.trim())) : null;
  const redo = Boolean(flag('redo'));

  const received = await ix.received(since);
  console.log(`${received.length} inbound since ${since.slice(0, 10)}`);

  // One reply per person: the newest message is the one to answer; anything
  // earlier from the same lead is superseded by it.
  const byLead = new Map();
  for (const e of received) {
    const lead = String(e.lead || e.from_address_email || '').toLowerCase();
    if (!lead || !e.campaign_id) continue;
    if (onlyLead && !onlyLead.has(lead)) continue;
    if (!byLead.has(lead)) byLead.set(lead, []);
    byLead.get(lead).push(e);
  }

  let oldestFailure = null;
  for (const [leadEmail, emails] of byLead) {
    const latest = emails[emails.length - 1];
    for (const e of emails.slice(0, -1)) if (!ledger.emails[e.id]) record(e.id, { lead: leadEmail, status: 'superseded', by: latest.id });
    const prior = ledger.emails[latest.id];
    if (prior && !redo && prior.status !== 'failed') continue;

    try {
      await handle(ix, leadEmail, latest);
    } catch (err) {
      console.error(`  FAIL ${leadEmail}: ${err.message.split('\n')[0]}`);
      record(latest.id, { lead: leadEmail, status: 'failed', error: err.message.slice(0, 300) });
      if (!oldestFailure || stamp(latest) < oldestFailure) oldestFailure = stamp(latest);
    }
  }

  // Never move the cursor past a failure, and overlap two days so a reply
  // Instantly indexes late is still seen. The ledger makes the overlap free.
  const newest = received.length ? received[received.length - 1].timestamp_created : since;
  const anchor = oldestFailure && oldestFailure < newest ? oldestFailure : newest;
  ledger.cursor = new Date(Date.parse(anchor) - 2 * 86400000).toISOString();
  writeLedger();
  if (!onlyLead) await checkWatches(ix);
  writeReview();
}

// ---- lane watches ---------------------------------------------------------
// "If I sent you the next three before they close" is a promise over time.
// When a sent reply had fewer open than promised, its ledger row carries a
// watch; once a day this re-runs the lane search and, when something new is
// open, drafts the follow-up into the same thread for approval. A watch only
// arms after the first reply has actually been SENT, stops after 45 days or
// once the promised count is met, and stands down the moment they write back
// (a live conversation is a human's).

async function checkWatches(ix) {
  const now = Date.now();
  for (const [id, r] of Object.entries(ledger.emails)) {
    const w = r.watch;
    if (!w || r.status !== 'sent' || w.done) continue;
    if (Date.parse(w.until) < now) { record(id, { watch: { ...w, done: 'expired' } }); continue; }
    if (w.last_checked && now - Date.parse(w.last_checked) < 20 * 3600000) continue;
    if (w.pending) continue; // a follow-up draft is already waiting on Earl

    const thread = await ix.thread(r.lead);
    const last = thread[thread.length - 1];
    if (last && isInbound(last) && stamp(last) > r.sent_at) {
      record(id, { watch: { ...w, done: 'they replied; conversation is with a human' } });
      continue;
    }
    record(id, { watch: { ...w, last_checked: new Date().toISOString() } });
    const { nextOpen } = await import('./reply-desk/deliverables.mjs');
    const d = await nextOpen({ naics: w.naics, keywords: w.keywords, companyName: w.companyName, context: w.context, count: w.count, excludeSol: w.exclude });
    if (!d.facts?.open) continue;

    const playbook = PLAYBOOKS[r.campaign];
    const cls = {
      category: 'accept', accepted_offer: true, questions: [], wants_call: false, tone: 'neutral',
      text: '(No new message from them. This is the follow-up Earl promised in his last reply: the next open one in their lane, sent the week it posted.)',
    };
    const plan = {
      deliverable: { ...d, body: d.body.split('\n\n')[0] }, // only the open ones; the closed list was last time
      allowLinks: [],
      instructions: 'This is a short follow-up in an existing thread. Earl promised to send the next open solicitations in their lane as they posted; this is that. No greeting beyond their first name, one line handing it over (e.g. "One just posted in your lane."), and close with ONE question offering the disqualifier check or the proposal on it.',
    };
    const draft = await compose({
      playbook, plan, lead: { first_name: w.firstName || '', company_name: w.companyName }, cls,
      inbound: { subject: w.subject }, offer: '(Earl\'s last reply listed the open solicitations in their lane and promised to send the next ones as they posted.)',
    });
    const fid = randomUUID();
    const sentSol = d.facts.openSol || [];
    saveMeta({
      id: fid, status: 'drafted', lead: r.lead, company: w.companyName, campaign: r.campaign, campaign_id: w.campaign_id,
      playbook: `${playbook?.name || r.campaign} follow-up`, auto_send_eligible: Boolean(playbook?.autoSend),
      eaccount: w.eaccount, reply_to_uuid: id, subject: w.subject,
      // Staleness baseline is the newest email in the thread NOW, so Earl's own
      // first reply does not read as "someone already answered".
      received_at: stamp(last), send_after: sendAfter(new Date().toISOString()),
      allow_links: [], quote: null, cls,
      deliverable: { kind: d.kind, sources: d.sources, gaps: d.gaps, warnings: d.warnings, needsInput: [], needsApproval: false, facts: d.facts },
      issues: draft.issues, reviewer_note: draft.reviewerNote, asks: `${draft.opening}\n${draft.closing}`,
      inbound: { id, subject: w.subject, at: r.received_at }, drafted_at: new Date().toISOString(), follow_up_of: id,
    });
    writeFileSync(textPath(fid), draft.text + '\n');
    record(fid, { lead: r.lead, campaign: r.campaign, status: 'drafted', follow_up_of: id, deliverable: d.kind });
    const sent = d.facts.open;
    record(id, { watch: { ...w, pending: fid, count: Math.max(0, w.count - sent), exclude: [...w.exclude, ...sentSol], done: w.count - sent <= 0 ? 'promise met' : undefined } });
    console.log(`  follow-up   ${r.campaign}  ${r.lead}  (${sent} newly open)`);
  }
}

async function handle(ix, leadEmail, inbound) {
  const key = CAMPAIGNS[inbound.campaign_id] || null;
  const thread = await ix.thread(leadEmail);

  // Already answered by a person (a manual Unibox send): never step on it. A
  // CAMPAIGN step that went out after their message is not an answer. It is
  // what happens after an autoresponder, which does not stop the sequence,
  // and it is a race that could otherwise make the desk skip a real "yes".
  const answered = thread.find((e) => !isInbound(e) && Number(e.ue_type) !== 1 && stamp(e) > stamp(inbound));
  if (answered) {
    record(inbound.id, { lead: leadEmail, campaign: key, status: 'answered', answered_at: stamp(answered) });
    console.log(`  answered    ${key || '?'}  ${leadEmail}`);
    return;
  }

  const lastOut = [...thread].reverse().find((e) => !isInbound(e) && stamp(e) < stamp(inbound));
  const offer = lastOut ? freshText(lastOut) : '';
  const cls = await classify({ email: inbound, offer });
  const base = {
    lead: leadEmail, campaign: key, received_at: stamp(inbound),
    category: cls.category, classified_by: cls.by,
  };

  if (cls.category === 'referral') {
    record(inbound.id, { ...base, status: 'referral', referral: cls.referral_email || cls.referral_name || null });
    saveMeta({ id: inbound.id, status: 'referral', lead: leadEmail, campaign: key, cls, inbound: slim(inbound) });
    console.log(`  referral    ${key || '?'}  ${leadEmail} -> ${cls.referral_email || cls.referral_name}`);
    return;
  }
  if (!['accept', 'question'].includes(cls.category)) {
    // auto_reply, not_interested, unsubscribe: Instantly already stopped the
    // sequence on reply, and the programme rule is that a bare "no" is read by
    // a human, never auto-suppressed (instantly-wave1.md). Record and move on.
    // "other" is a person saying something we cannot route; show it to Earl.
    const status = cls.category === 'other' ? 'needs_human' : 'no_action';
    record(inbound.id, { ...base, status });
    if (status === 'needs_human') saveMeta({ id: inbound.id, status, lead: leadEmail, campaign: key, cls, inbound: slim(inbound) });
    const redirect = cls.category === 'auto_reply' ? redirectIn(cls.text, leadEmail) : null;
    if (redirect) record(inbound.id, { redirect });
    console.log(`  ${status.padEnd(11)} ${key || '?'}  ${leadEmail}  (${cls.category}${redirect ? `, redirect ${redirect}` : ''})`);
    return;
  }

  const playbook = key && PLAYBOOKS[key];
  const lead = (await ix.lead(leadEmail, inbound.campaign_id)) || { email: leadEmail, payload: {} };
  if (!playbook) {
    record(inbound.id, { ...base, status: 'needs_human', reason: 'no playbook for this campaign' });
    saveMeta({ id: inbound.id, status: 'needs_human', lead: leadEmail, campaign: key, cls, inbound: slim(inbound) });
    console.log(`  needs_human ${key || inbound.campaign_id}  ${leadEmail}  (no playbook)`);
    return;
  }

  console.log(`  building    ${key}  ${leadEmail}  (${cls.category}: ${cls.summary})`);
  const plan = await playbook.build({ lead, cls });
  const draft = await compose({ playbook, plan, lead, cls, inbound, offer });
  const d = plan.deliverable;

  let status = 'drafted';
  if (d.blocked && !d.body) status = 'needs_human';
  else if (d.needsApproval) status = 'needs_content';
  else if (d.needsInput.length || draft.issues.some((i) => i.rule === 'placeholder')) status = 'needs_input';
  // Any other lint failure still drafts; it is listed in the review and
  // `send` refuses until the .txt is fixed.

  const fromName = inbound.from_address_json?.[0]?.name || [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  const meta = {
    id: inbound.id,
    status,
    lead: leadEmail,
    company: lead.company_name || '',
    campaign: key,
    campaign_id: inbound.campaign_id,
    playbook: playbook.name,
    auto_send_eligible: Boolean(playbook.autoSend),
    eaccount: inbound.eaccount,
    reply_to_uuid: inbound.id,
    subject: draft.subject,
    received_at: stamp(inbound),
    send_after: sendAfter(stamp(inbound)),
    allow_links: plan.allowLinks || [],
    quote: { attribution: attribution(stamp(inbound), fromName, inbound.from_address_email || leadEmail), body: cls.text },
    cls,
    deliverable: {
      kind: d.kind, sources: d.sources, gaps: d.gaps, warnings: d.warnings,
      needsInput: d.needsInput, needsApproval: d.needsApproval, blocked: d.blocked || null, facts: d.facts,
    },
    issues: draft.issues,
    reviewer_note: draft.reviewerNote,
    asks: `${draft.opening}\n${draft.closing}`,
    inbound: slim(inbound),
    drafted_at: new Date().toISOString(),
  };
  saveMeta(meta);
  writeFileSync(textPath(inbound.id), draft.text + '\n');
  record(inbound.id, { ...base, status, playbook: key, deliverable: d.kind });
  // The lane watch rides in the committed ledger (business names and search
  // terms, no prospect text) so it survives the Actions cache expiring. It
  // only arms once this reply is actually sent; see checkWatches().
  if (d.watch) {
    record(inbound.id, {
      watch: {
        ...d.watch,
        until: new Date(Date.now() + 45 * 86400000).toISOString(),
        eaccount: inbound.eaccount, subject: draft.subject, campaign_id: inbound.campaign_id,
        firstName: lead.first_name || '',
      },
    });
  }
  console.log(`  ${status.padEnd(11)} ${key}  ${leadEmail}  -> ${textPath(inbound.id).replace(ROOT, '')}`);
}

const slim = (e) => ({ id: e.id, subject: e.subject, from: e.from_address_email, at: stamp(e), eaccount: e.eaccount, campaign_id: e.campaign_id });

/** An autoresponder that names someone else to talk to ("contact Logan Schrodi for government contracting"). */
function redirectIn(text, leadEmail) {
  const domain = leadEmail.split('@')[1];
  const emails = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
    .map((x) => x.toLowerCase())
    .filter((x) => x !== leadEmail && !/^(info|support|sales|accounting|invoicing|billing|finance|contracts|services|help|admin)@/.test(x));
  const same = emails.find((x) => x.endsWith(`@${domain}`));
  return same || emails[0] || null;
}

// ---- review file ------------------------------------------------------------

function writeReview() {
  if (!existsSync(QUEUE)) return;
  const metas = queueMetas();
  const waiting = metas.filter((m) => !['sent', 'dismissed', 'answered'].includes(ledger.emails[m.id]?.status || m.status));
  const order = { drafted: 0, needs_input: 1, needs_content: 2, needs_human: 3, referral: 4 };
  waiting.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.received_at).localeCompare(String(b.received_at)));

  const out = [`# Reply desk review`, '', `Generated ${new Date().toISOString()}. Approve with \`node scripts/outreach/reply-desk.mjs send <id>\`. Edit the .txt first if you want to change anything; send re-checks it.`, ''];
  for (const m of waiting) {
    out.push(`## ${m.status.toUpperCase()}: ${m.company || m.lead} (${m.campaign || '?'}, ${m.playbook || ''})`, '');
    out.push(`- id: \`${m.id}\``, `- lead: ${m.lead}`, `- they wrote (${String(m.inbound?.at || '').slice(0, 10)}): "${(m.cls?.text || '').replace(/\s+/g, ' ').slice(0, 300)}"`);
    if (m.cls) out.push(`- read as: ${m.cls.category}${m.cls.questions?.length ? `, asked: ${m.cls.questions.join(' / ')}` : ''}${m.cls.wants_call ? ', open to a call' : ''}`);
    if (m.deliverable) {
      out.push(`- deliverable: ${m.deliverable.kind}`);
      for (const s of m.deliverable.sources || []) out.push(`  - source: ${s}`);
      for (const w of m.deliverable.warnings || []) out.push(`  - WARNING: ${w}`);
      for (const g of m.deliverable.gaps || []) out.push(`  - gap: ${g}`);
      for (const n of m.deliverable.needsInput || []) out.push(`  - NEEDS YOUR INPUT: ${n}`);
    }
    for (const i of m.issues || []) out.push(`- lint: ${i.rule} (${i.detail})`);
    if (m.reviewer_note) out.push(`- note: ${m.reviewer_note}`);
    if (m.send_after) out.push(`- from: ${m.eaccount}${m.cc ? `, cc ${m.cc}` : ''}, earliest send ${m.send_after}`);
    if (existsSync(textPath(m.id))) {
      out.push('', '```', `Subject: ${m.subject}`, '', assemble(readFileSync(textPath(m.id), 'utf8')), '```');
    }
    out.push('');
  }
  const redirects = Object.entries(ledger.emails).filter(([, r]) => r.redirect);
  if (redirects.length) {
    out.push('## Autoresponders that named someone else', '', 'Not emailed. Worth a manual look; each is a warm-ish intro to the right person.', '');
    for (const [, r] of redirects) out.push(`- ${r.lead} (${r.campaign || '?'}) -> ${r.redirect}`);
    out.push('');
  }
  mkdirSync(QUEUE, { recursive: true });
  writeFileSync(join(QUEUE, 'REVIEW.md'), out.join('\n'));
  // The same cards as the email, for reading in a browser.
  const html = renderReviewEmail(waiting.map((m) => ({ ...m, status: ledger.emails[m.id]?.status || m.status })), {
    readText: (id) => (existsSync(textPath(id)) ? readFileSync(textPath(id), 'utf8') : null),
  }).html;
  writeFileSync(join(QUEUE, 'REVIEW.html'), html);
  console.log(`\nreview: ${join(QUEUE, 'REVIEW.html').replace(ROOT, '')}  (${waiting.length} waiting)`);
}

// ---- send -----------------------------------------------------------------

async function send(ids, { auto = false } = {}) {
  const ix = instantly();
  const dryRun = Boolean(flag('dry-run'));
  const now = Boolean(flag('now'));
  let sent = 0;
  let refused = 0;
  for (const id of ids) {
    const refuse = (why) => { console.log(`  refuse ${id}: ${why}`); refused++; };
    if (!existsSync(metaPath(id)) || !existsSync(textPath(id))) { refuse('not in the queue (run scan first)'); continue; }
    const m = loadMeta(id);
    const status = ledger.emails[id]?.status || m.status;
    if (status === 'sent') { refuse('already sent'); continue; }
    // Fixed text and business terms are approved once, in content.mjs, by a
    // reviewed commit. Until then a draft built on them cannot go.
    const contentApproved = { debrief_one_pager: DEBRIEF_ONE_PAGER.approved, partner_terms: PARTNER_TERMS.approved, creator_terms: CREATOR_TERMS.approved };
    if (status === 'needs_content' && !contentApproved[m.deliverable?.kind]) {
      refuse(`the ${m.deliverable?.kind || 'fixed'} content is not approved yet (content.mjs)`); continue;
    }
    if (!SENDABLE.has(status) && status !== 'needs_content') { refuse(`status is ${status}`); continue; }

    const text = readFileSync(textPath(id), 'utf8').trim();
    const issues = lint(text, { asks: m.asks, allowLinks: m.allow_links, maxWords: m.deliverable?.kind === 'debrief_one_pager' ? 800 : 520 });
    if (issues.length) { refuse(`lint: ${issues.map((i) => `${i.rule} (${i.detail})`).join('; ')}`); continue; }

    if (!now && !inBusinessHours(new Date())) { refuse('outside 8:40-17:20 ET on a weekday (use --now to override)'); continue; }
    if (auto && Date.parse(m.send_after) > Date.now()) { console.log(`  wait   ${id}: not before ${m.send_after}`); continue; }

    // Re-read the thread: if they wrote again, or anyone answered, the draft
    // is stale and must not go.
    const thread = await ix.thread(m.lead);
    const newer = thread.filter((e) => stamp(e) > m.received_at);
    if (newer.some((e) => !isInbound(e) && Number(e.ue_type) !== 1)) { record(id, { status: 'answered' }); refuse('someone already answered this thread'); continue; }
    if (newer.some(isInbound)) { refuse('they wrote again since the draft; re-run scan --redo --lead=' + m.lead); continue; }

    const quote = process.env.REPLY_DESK_QUOTE === '0' ? null : m.quote;
    const full = assemble(text);
    const payload = {
      eaccount: m.eaccount,
      replyToUuid: m.reply_to_uuid,
      subject: m.subject,
      text: full + quoteText(quote),
      html: toHtml(full, quote),
      cc: m.cc || undefined,
      bcc: process.env.REPLY_DESK_BCC || undefined,
    };
    if (dryRun) {
      console.log(`\n--- would send ${id} from ${m.eaccount} to ${m.lead}${m.cc ? `, cc ${m.cc}` : ''}\nSubject: ${m.subject}\n\n${payload.text}\n`);
      continue;
    }
    // Record BEFORE reporting success and never retry a 5xx (instantly.mjs):
    // a duplicate reply to a yes is worse than a missing one.
    const res = await ix.reply(payload);
    record(id, { status: 'sent', sent_at: new Date().toISOString(), sent_email_id: res.id || null, sent_by: auto ? 'auto' : 'approved' });
    saveMeta({ ...m, status: 'sent' });
    if (m.follow_up_of && ledger.emails[m.follow_up_of]?.watch) {
      record(m.follow_up_of, { watch: { ...ledger.emails[m.follow_up_of].watch, pending: null } });
    }
    console.log(`  sent   ${id}  ${m.lead}  (${m.campaign})`);
    sent++;
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`\n${dryRun ? 'dry run: ' : ''}${sent} sent, ${refused} refused.`);
  writeReview();
  return refused;
}

// ---- notify ---------------------------------------------------------------
// Email Earl what is new in the queue, once per item. Same sender and default
// recipients as the marketing digest (scripts/digest/marketing-digest.mjs).
// The email carries the full draft, so approving is reading it and pasting an
// id into the workflow's "Run workflow" box (or running `send` locally).

async function notify() {
  if (!existsSync(QUEUE)) { console.log('queue empty.'); return 0; }
  // Default: only what Earl has not been emailed about yet. --all re-sends
  // everything still waiting (e.g. after changing the recipient).
  const waiting = queueMetas()
    .map((m) => ({ ...m, status: ledger.emails[m.id]?.status || m.status }))
    .filter((m) => ['drafted', 'needs_input', 'needs_content', 'needs_human', 'referral'].includes(m.status));
  const fresh = flag('all') ? waiting : waiting.filter((m) => !ledger.emails[m.id]?.notified_at);
  if (!fresh.length) { console.log('nothing new to notify.'); return 0; }

  const repo = process.env.GITHUB_REPOSITORY || 'earlito47/govhub-marketing';
  const email = renderReviewEmail(fresh, {
    readText: (id) => (existsSync(textPath(id)) ? readFileSync(textPath(id), 'utf8') : null),
    runUrl: `https://github.com/${repo}/actions/workflows/reply-desk.yml`,
  });
  const to = (flagValue('to') || process.env.REPLY_DESK_NOTIFY_TO || process.env.DIGEST_TO || 'earljknight@gmail.com,earl@govhub.online')
    .split(',').map((s) => s.trim()).filter(Boolean);

  if (flag('dry-run')) {
    const out = join(QUEUE, 'NOTIFY-PREVIEW.html');
    writeFileSync(out, email.html);
    console.log(`would email ${to.join(', ')}\nSubject: ${email.subject}\npreview: ${out.replace(ROOT, '')}`);
    return 0;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: 'GovHub Reply Desk <hello@govhub.online>', to, subject: email.subject, html: email.html, text: email.text }),
  });
  if (!res.ok) throw new Error(`resend: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  for (const m of fresh) record(m.id, { notified_at: new Date().toISOString() });
  console.log(`emailed ${to.join(', ')} about ${fresh.length} item(s): "${email.subject}"`);
  return 0;
}

// ---- show / status / auto -------------------------------------------------------

function show(ids) {
  const list = ids.length ? ids : draftIds().filter((id) => existsSync(textPath(id)));
  for (const id of list) {
    const m = loadMeta(id);
    console.log(`\n=== ${id}  ${m.status}  ${m.campaign}  ${m.lead}${m.company ? ` (${m.company})` : ''}${m.cc ? `  cc ${m.cc}` : ''}`);
    for (const w of m.deliverable?.warnings || []) console.log(`  WARNING ${w}`);
    for (const n of m.deliverable?.needsInput || []) console.log(`  NEEDS INPUT ${n}`);
    for (const i of m.issues || []) console.log(`  lint ${i.rule}: ${i.detail}`);
    console.log(`\nSubject: ${m.subject}\n\n${assemble(readFileSync(textPath(id), 'utf8'))}`);
  }
}

/**
 * A reply a person wrote, for a message the desk could not route (needs_human,
 * referral): `write <id> <file>`. It becomes an ordinary draft with the same
 * sending details as any other (the receiving mailbox, the thread, a Gmail
 * quote of their message) and goes through the same lint and `send` checks.
 * `--cc=` copies someone in, for a referral that should go in the same thread.
 *
 * A message the desk closed as no_action can be answered too ("I'm getting
 * close to retiring" deserves two lines back): it has no queue file, so the
 * email is read from Instantly and queued first.
 */
async function write(id, file) {
  if (!id || !file) { console.error('usage: write <id> <file with the reply text> [--cc=a@b.com]'); return 1; }
  const cc = flagValue('cc');
  const ccList = cc ? cc.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) : [];
  if (cc && (!ccList.length || ccList.some((x) => !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x)))) { console.error(`--cc is not a list of addresses: ${cc}`); return 1; }
  if (!existsSync(metaPath(id))) {
    const row = ledger.emails[id];
    if (!row) { console.error(`not in the queue or the ledger: ${id}`); return 1; }
    const e = await instantly().api('GET', `/emails/${id}`);
    if (!isInbound(e)) { console.error(`${id} is not a message from them`); return 1; }
    const lead = row.lead || e.lead || e.from_address_email;
    saveMeta({ id, status: row.status, lead, campaign: row.campaign || CAMPAIGNS[e.campaign_id] || null, cls: { text: freshText(e) }, inbound: slim(e) });
  }
  const m = loadMeta(id);
  const text = readFileSync(file, 'utf8').trim();
  // A person writing the reply may link our own site on purpose; anything
  // else still trips the lint. The prospect already replied, so this is not
  // the "no links in email 1" case instantly-angles.mjs guards.
  const allowLinks = [...new Set([...(m.allow_links || []), 'https://www.govhub.online/', 'https://govhub.online/'])];
  const issues = lint(text, { asks: text, allowLinks });
  const inbound = m.inbound || {};
  saveMeta({
    ...m,
    status: issues.length ? 'needs_input' : 'drafted',
    eaccount: m.eaccount || inbound.eaccount,
    reply_to_uuid: m.reply_to_uuid || id,
    subject: m.subject || replySubject(inbound.subject),
    received_at: m.received_at || inbound.at,
    send_after: m.send_after || sendAfter(inbound.at),
    allow_links: allowLinks,
    quote: m.quote || { attribution: attribution(inbound.at, '', inbound.from || m.lead), body: m.cls?.text || '' },
    deliverable: m.deliverable?.kind ? m.deliverable : { kind: 'written', sources: [], gaps: [], warnings: [], needsInput: [], needsApproval: false, facts: {} },
    issues,
    asks: text,
    written_by_hand: true,
    ...(ccList.length ? { cc: ccList.join(',') } : {}),
  });
  writeFileSync(textPath(id), text + '\n');
  record(id, { status: issues.length ? 'needs_input' : 'drafted', deliverable: 'written' });
  console.log(issues.length ? `lint: ${issues.map((i) => `${i.rule} (${i.detail})`).join('; ')}` : `drafted ${id}`);
  writeReview();
  return issues.length ? 1 : 0;
}

/** Decide not to send a draft. Frees a lane watch that was waiting on it. */
function dismiss(ids) {
  for (const id of ids) {
    if (!ledger.emails[id]) { console.log(`  unknown ${id}`); continue; }
    record(id, { status: 'dismissed' });
    if (existsSync(metaPath(id))) {
      const m = loadMeta(id);
      saveMeta({ ...m, status: 'dismissed' });
      if (m.follow_up_of && ledger.emails[m.follow_up_of]?.watch) {
        record(m.follow_up_of, { watch: { ...ledger.emails[m.follow_up_of].watch, pending: null } });
      }
    }
    console.log(`  dismissed ${id}`);
  }
  writeReview();
}

function status() {
  const counts = {};
  for (const r of Object.values(ledger.emails)) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(`cursor ${ledger.cursor || '(none)'}`);
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${n}`);
}

async function auto() {
  await scan();
  if (process.env.REPLY_DESK_AUTOSEND !== 'true') {
    console.log('REPLY_DESK_AUTOSEND is not "true": drafted only, nothing sent.');
    return 0;
  }
  const eligible = queueMetas()
    .filter((m) => m.status === 'drafted' && m.campaign && PLAYBOOKS[m.campaign]?.autoSend && ledger.emails[m.id]?.status === 'drafted')
    .map((m) => m.id);
  if (!eligible.length) { console.log('nothing eligible for auto-send.'); return 0; }
  return send(eligible, { auto: true });
}

// ---------------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const run = {
    scan, auto, status, notify,
    show: () => show(positional),
    dismiss: () => dismiss(positional),
    write: () => write(positional[0], positional[1]),
    send: () => (positional.length ? send(positional) : (console.error('send needs at least one id'), 1)),
  }[cmd];
  if (!run) { console.error(`unknown command "${cmd}". Use scan | show | send | write | dismiss | auto | notify | status.`); process.exit(2); }
  const code = await run();
  if (typeof code === 'number' && code > 0 && cmd === 'send') process.exit(1);
}
