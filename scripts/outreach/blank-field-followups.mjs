// Corrections for the leads whose angle emails went out with blank fields.
//
// WHY THIS EXISTS. Between 10-05 and 10-08, 272 wave 1 contacts were moved
// into A1, A2 and A4 without the angle's variables, so they were emailed
// "Hi Brandon,  posted  and . It closes . ." and never learned what we meant
// (docs/incident-2026-10-blank-merge-fields.md, cause 1). This sends each of
// them one correction, in the thread they already have, from the mailbox that
// emailed them:
//
//   a2_open / a4_open  one solicitation open in their lane right now (SAM
//                      types o and k only, 7+ days left), its one-line catch,
//                      and the offer: we write it, or they do it in GovHub
//   a2_plain/a4_plain  the correction alone, when nothing in their lane is
//                      genuinely open with time left
//   a1_recompete       the recompete pitch they should have received, with
//                      the agency and month filled in
//
// Each draft is built the day it sends, because "7+ days left" is only true on
// the day it is checked. Owner approved the five variants on 2026-10-16;
// sends go out in daily batches of 30 to 40.
//
// HOW IT SENDS. Not POST /emails/reply: a reply to an email WE sent goes to
// our own mailbox (tested 10-16). POST /emails/forward with the original
// subject and include_original_body false reaches the prospect and threads
// under the earlier email in Gmail (tested 10-16 against Earl's inbox).
//
// SAFETY. Nothing sends without `send`. Before each send the thread is
// re-read: anyone who wrote back, or whom a person already answered, is
// skipped (the reply desk owns them); anyone still mid-sequence waits; bounced
// and unsubscribed leads are dropped. A send is never retried on a 5xx.
// data/blank-field-followups.json is the record: addresses, variants,
// solicitation numbers and timestamps only, never prospect text.
//
// Usage:
//   node scripts/outreach/blank-field-followups.mjs init
//   node scripts/outreach/blank-field-followups.mjs preview <email>...     build and print, send nothing
//   node scripts/outreach/blank-field-followups.mjs send --batch=35 [--dry-run] [--per-mailbox=4]
//   node scripts/outreach/blank-field-followups.mjs status
// Env: INSTANTLY_API_KEY, OPENAI_API_KEY (lane picks). Needs pdftotext.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { instantly, stamp, isInbound } from './reply-desk/instantly.mjs';
import { lint, assemble, toHtml } from './reply-desk/voice.mjs';
import { laneKeywords } from './reply-desk/playbooks.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE = join(ROOT, 'data/blank-merge-fields-2026-10.json');
const LEDGER = join(ROOT, 'data/blank-field-followups.json');
const QUEUE = join(ROOT, '.cache/blank-field-followups');
const SIGNUP = 'https://app.govhub.online/signup';

const CAMPAIGN_IDS = {
  A1: 'a4df9870-2d9d-49a1-8548-d1fa3b0599b7',
  A2: 'c977a531-a8e5-47d3-b27b-5f8aacfab33b',
  A4: '39bc9fab-a9a7-4ed6-b34c-ccabeb9e76ee',
};
// Each campaign's other step-1 subject, for a thread whose own subject
// rendered blank ("{{sol_agency_short}}" with no agency).
const FALLBACK_SUBJECT = { A1: 'recompete', A2: 'saw this', A4: 'did you see this' };
// Instantly lead status: 1 active, 2 paused, 3 completed. Negative is bounced,
// unsubscribed or skipped.
const DONE = 3;

const [cmd = 'status', ...rest] = process.argv.slice(2);
const flagValue = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? null;
const flag = (name) => rest.includes(`--${name}`) || flagValue(name) !== null;
const positional = rest.filter((a) => !a.startsWith('--'));

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { version: 1, leads: {} };
const saveLedger = () => {
  const leads = Object.fromEntries(Object.keys(ledger.leads).sort().map((k) => [k, ledger.leads[k]]));
  writeFileSync(LEDGER, JSON.stringify({ version: 1, leads }, null, 2) + '\n');
};
const keyOf = (lead, campaign) => `${campaign}:${lead.toLowerCase()}`;
const record = (k, fields) => { ledger.leads[k] = { ...ledger.leads[k], ...fields, updated_at: new Date().toISOString() }; saveLedger(); };

// ---- Timing --------------------------------------------------------------

const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false });
function inBusinessHours(d) {
  const p = Object.fromEntries(ET.formatToParts(d).map((x) => [x.type, x.value]));
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return false;
  const m = (Number(p.hour) % 24) * 60 + Number(p.minute);
  return m >= 8 * 60 + 40 && m <= 17 * 60 + 20;
}
const dayEt = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });

// ---- init ----------------------------------------------------------------
// Cause 1 only. Cause 2 leads saw their solicitation named in step 1; anyone
// who replied is the reply desk's.

function init() {
  const src = JSON.parse(readFileSync(SOURCE, 'utf8'));
  let added = 0;
  for (const l of src.leads) {
    if (l.cause !== 'moved_from_wave1_without_variables' || l.replied) continue;
    const k = keyOf(l.lead, l.campaign);
    if (ledger.leads[k]) continue;
    const dates = [...new Set(l.blank_sends.map((s) => s.sent_at))].sort();
    ledger.leads[k] = {
      lead: l.lead.toLowerCase(), campaign: l.campaign, blank_sent_at: dates,
      status: l.lead_status_now === 'bounced' ? 'skipped' : 'pending',
      ...(l.lead_status_now === 'bounced' ? { skip_reason: 'bounced' } : {}),
    };
    added++;
  }
  saveLedger();
  console.log(`${added} added; ${Object.keys(ledger.leads).length} in the ledger.`);
}

// ---- Reading a lead ------------------------------------------------------

async function readLead(ix, entry) {
  const campaignId = CAMPAIGN_IDS[entry.campaign];
  const d = await ix.api('POST', '/leads/list', { limit: 10, contacts: [entry.lead], campaign: campaignId });
  const lead = (d.items || []).find((x) => (x.email || '').toLowerCase() === entry.lead) || null;
  const thread = await ix.thread(entry.lead);
  const ours = thread.filter((e) => e.campaign_id === campaignId && Number(e.ue_type) === 1);
  return { lead, thread, ours, campaignId };
}

/** Why this lead must not get a correction now, or null. 'wait' means later. */
function holdReason({ lead, thread, ours }, entry) {
  if (!lead) return 'not in the campaign any more';
  if (Number(lead.status) < 0) return `lead status ${lead.status} (bounced or unsubscribed)`;
  if (!ours.length) return 'no campaign email found in the thread';
  const first = stamp(ours[0]);
  if (thread.some((e) => isInbound(e) && stamp(e) > first)) return 'they wrote back; the reply desk has it';
  if (thread.some((e) => !isInbound(e) && Number(e.ue_type) !== 1 && stamp(e) > first)) return 'already answered by hand';
  if (Number(lead.status) !== DONE) return 'wait';
  if (entry.sent_email_id) return 'already sent';
  return null;
}

// ---- Drafting ------------------------------------------------------------

const firstName = (lead) => String(lead.payload?.firstName || lead.first_name || '').trim();
const companyOf = (lead) => String(lead.payload?.companyName || lead.company_name || '').trim();
const hi = (lead) => (firstName(lead) ? `Hi ${firstName(lead)},` : 'Hi,');
// The award payload was title-cased upstream, which turns LLLP into "Lllp".
const entitySuffixes = (s) => String(s || '').replace(/\b(Lllp|Llp|Llc|Pllc|Lp)\b/g, (m) => m.toUpperCase());

function whenLine(entry) {
  const days = [...new Set(entry.blank_sent_at.map(dayEt))];
  if (days.length === 1) return `My email on ${days[0]} went out`;
  if (days.length === 2) return `My emails on ${days[0]} and ${days[1]} went out`;
  return 'My emails earlier this month went out';
}

const OFFER = `We can write the proposal for you, or you can do it yourself in GovHub with a free trial: ${SIGNUP}`;
const WHAT_WE_DO = 'What we do: we find open federal bids that fit your company, check each for the things that would get a bid disqualified before anyone scores it, and write the proposal itself.';
// No "I'll send the next one when it posts": nothing here watches their lane
// afterwards, so that would be a promise with no one keeping it. A reply lands
// in the reply desk, which builds the list.
const PLAIN_CLOSE = `Nothing open in your lane has enough time left on it this week. You can see what is open yourself with a free GovHub trial (${SIGNUP}), or reply with the kind of work you want and I'll send the next one that fits.`;

// A pick the reader most likely cannot bid is worse than none. The picker
// judges lane fit from titles and summaries; eligibility only shows up in the
// line built from the documents, so it is checked there. Small business and
// unrestricted are fine; existing-vehicle holders and certifications we cannot
// confirm they hold are not. (10-16 sample: a Fort Stewart job whose catch was
// "only EAGLE BOA holders can be considered".)
// "Indian" alone would match Indian Health Service, a buyer, so only the
// set-aside's own wording counts.
// The line is model-worded, so the same restriction arrives in more than one
// phrasing ("only EAGLE BOA holders", "you need an EAGLE basic ordering
// agreement"): match the thing, not one sentence.
const RESTRICTED = /\b(holders?|BOA|(basic )?ordering agreement|existing (contract|vehicle)|must already (hold|have)|8\(a\)|HUBZone|SDVOSB|service[- ]disabled|women[- ]owned|WOSB|EDWOSB|Buy Indian|ISBEE)\b|8\(a\)/i;
// A catch naming a nine-figure threshold ("four projects over $500M") is a
// notice no small firm wins, whatever its NAICS. The picker sees titles, not
// thresholds, so this is caught in the line. (10-16 sample: Architect of the
// Capitol, AOCACB26R0052.)
const BEYOND_SCALE = /\$\s?\d{3,}(,\d{3})*(\.\d+)?\s?(M\b|million)|\$\s?\d+(\.\d+)?\s?(B\b|billion)/i;
// Told to the picker up front as well, since it can skip a restricted notice
// before a line is ever written for it.
const PICK_HINT = ' Pick only what a small firm with no existing federal contract vehicle could realistically win: skip notices limited to holders of an existing contract, BOA or schedule, set-asides for a certification they are not known to hold (8(a), HUBZone, SDVOSB, WOSB), and work far beyond a small firm\'s scale.';

function draftA2(entry, lead, line) {
  const open = [
    hi(lead), '',
    `${whenLine(entry)} with the details missing, so you never saw what I was writing about. Sorry about that.`, '',
    'Here is one that is open right now in your lane:', '',
    line, '',
    OFFER, '',
    'Want us to take this one?',
  ];
  const plain = [
    hi(lead), '',
    `${whenLine(entry)} with the details missing, so you never saw what I was writing about. Sorry about that.`, '',
    `They were meant to point you at a federal solicitation in your line of work. ${WHAT_WE_DO}`, '',
    PLAIN_CLOSE,
  ];
  return (line ? open : plain).join('\n');
}

function draftA4(entry, lead, line) {
  const p = lead.payload || {};
  const award = `${entitySuffixes(p.competitor_name)} out of ${p.competitor_city} winning ${p.award_amount_short} from ${p.award_agency_short} in your NAICS code, ${p.naics_code}`;
  const head = [hi(lead), '', `${whenLine(entry)} with the details missing. They were about ${award}. Sorry about that.`, ''];
  if (line) return [...head, 'Here is one that is open right now in that lane:', '', line, '', OFFER, '', 'Want us to take this one?'].join('\n');
  return [...head, WHAT_WE_DO, '', PLAIN_CLOSE].join('\n');
}

function draftA1(entry, lead) {
  const p = lead.payload || {};
  const company = companyOf(lead);
  const whose = company && company.toLowerCase() !== 'your team' ? `${company}'s` : 'your';
  return [
    hi(lead), '',
    `${whenLine(entry)} with the details missing, so here is what it should have said.`, '',
    `Your ${p.agency_short} contract looks like it runs out in ${p.contract_end_month}. Recompetes usually post 60 to 90 days ahead, and losing your own recompete is the loss nobody plans for. It almost never comes down to price. It comes down to compliance and a proposal written like the first one.`, '',
    `We read the solicitation, find the things that would get your bid disqualified before anyone scores it, and write the proposal itself. If I put together a short rundown of what would get ${whose} recompete bid tossed before anyone reads it, want me to send it over?`,
  ].join('\n');
}

/** The one open solicitation for an A2 or A4 lead, or null. */
async function openPick(entry, lead) {
  const { nextOpen } = await import('./reply-desk/deliverables.mjs');
  const p = lead.payload || {};
  const company = companyOf(lead);
  const args = entry.campaign === 'A2'
    ? {
        naics: p.naics_code, keywords: [], companyName: company, count: 1, excludeSol: p.sol_number ? [p.sol_number] : [],
        context: `They were pitched ${p.sol_number}, "${p.sol_short}" (NAICS ${p.naics_code}). That item is the best evidence of what they do; nothing else is known about them. Company name: ${company}.${PICK_HINT}`,
      }
    : {
        naics: p.naics_code, keywords: laneKeywords(p.competitor_name, company), companyName: company, count: 1, excludeSol: [],
        context: `${p.competitor_name} (${p.competitor_city}) won a ${p.award_amount_short} ${p.award_agency_short} award in NAICS ${p.naics_code}, which is how we found them. Company name: ${company}.${PICK_HINT}`,
      };
  // Up to three, so one that turns out to be restricted can give way to the next.
  const d = await nextOpen({ ...args, count: 3 });
  if (!d.facts?.open) return null;
  const lines = d.body.split('\n\n')[0].split('\n').map((l) => l.replace(/^\d+\.\s*/, '').trim());
  const i = lines.findIndex((l, n) => n < d.facts.open && !RESTRICTED.test(l) && !BEYOND_SCALE.test(l));
  if (i === -1) return null;
  return { line: lines[i], sol: d.facts.openSol?.[i] || null, source: d.sources?.[i] || null, why: d.facts.why?.[i] || '', gaps: d.gaps || [],
    skipped_restricted: lines.slice(0, i) };
}

async function build(ix, entry, { ignoreWait = false, mailboxFull = () => false } = {}) {
  const ctx = await readLead(ix, entry);
  const hold = holdReason(ctx, entry);
  if (hold && !(ignoreWait && hold === 'wait')) return { hold, ctx };
  const { lead, ours } = ctx;
  // Checked before the lane search, which is the slow and paid part.
  if (mailboxFull(ours[ours.length - 1].eaccount)) return { hold: 'mailbox_full', ctx };
  let text, variant, pick = null;
  if (entry.campaign === 'A1') {
    const p = lead.payload || {};
    if (!p.agency_short || !p.contract_end_month) return { hold: 'A1 variables still missing on the lead', ctx };
    text = draftA1(entry, lead); variant = 'a1_recompete';
  } else {
    const p = lead.payload || {};
    if (!p.naics_code) return { hold: 'no NAICS on the lead', ctx };
    pick = await openPick(entry, lead);
    variant = `${entry.campaign.toLowerCase()}_${pick ? 'open' : 'plain'}`;
    text = entry.campaign === 'A2' ? draftA2(entry, lead, pick?.line) : draftA4(entry, lead, pick?.line);
  }
  const issues = lint(text, { allowLinks: [SIGNUP], maxWords: 520 });
  const firstSubject = String(ours[0].subject || '').replace(/^\s*(re|fwd?):\s*/i, '').trim();
  const subject = `Re: ${firstSubject || FALLBACK_SUBJECT[entry.campaign]}`;
  const last = ours[ours.length - 1];
  return {
    draft: {
      lead: entry.lead, campaign: entry.campaign, variant, text, issues, subject,
      eaccount: last.eaccount, forward_of: last.id, to: entry.lead,
      sol: pick?.sol || null, source: pick?.source || null, why: pick?.why || null, gaps: pick?.gaps || [],
      skipped_restricted: pick?.skipped_restricted || [],
      built_at: new Date().toISOString(),
    },
    ctx,
  };
}

// ---- preview -------------------------------------------------------------

async function preview(emails) {
  const ix = instantly();
  mkdirSync(QUEUE, { recursive: true });
  for (const e of emails) {
    const entry = Object.values(ledger.leads).find((l) => l.lead === e.toLowerCase());
    if (!entry) { console.log(`\n${e}: not in the ledger`); continue; }
    // --include-active lets a preview show a lead still mid-sequence; send never does.
    const { draft, hold } = await build(ix, entry, { ignoreWait: flag('include-active') });
    if (hold) { console.log(`\n${e}: hold (${hold})`); continue; }
    for (const s of draft.skipped_restricted || []) console.log(`(skipped as restricted: ${s})`);
    writeFileSync(join(QUEUE, `${entry.campaign}-${entry.lead}.json`), JSON.stringify(draft, null, 2));
    console.log(`\n===== ${draft.variant} | ${entry.campaign} | from ${draft.eaccount} | ${draft.subject}${draft.sol ? ` | ${draft.sol}` : ''}`);
    if (draft.issues.length) console.log(`LINT: ${draft.issues.map((i) => `${i.rule} (${i.detail})`).join('; ')}`);
    console.log(assemble(draft.text));
  }
}

// ---- send ----------------------------------------------------------------

async function send() {
  const ix = instantly();
  const dryRun = flag('dry-run');
  const batch = Number(flagValue('batch') || 35);
  const perMailbox = Number(flagValue('per-mailbox') || 4);
  if (!dryRun && !inBusinessHours(new Date())) { console.log('outside 8:40-17:20 ET on a weekday; nothing sent.'); return; }

  // A1 first, it needs no lane search; then the rest in ledger order.
  const pending = Object.entries(ledger.leads)
    .filter(([, l]) => l.status === 'pending' || l.status === 'waiting')
    .sort(([, a], [, b]) => (a.campaign === 'A1' ? 0 : 1) - (b.campaign === 'A1' ? 0 : 1));
  const usedBox = {};
  let sent = 0, held = 0;
  for (const [k, entry] of pending) {
    if (sent >= batch) break;
    // A batch takes an hour or more to build, so the window is checked per send.
    if (!dryRun && !inBusinessHours(new Date())) { console.log('  send window closed; the rest wait for the next run.'); break; }
    const { draft, hold } = await build(ix, entry, { mailboxFull: (box) => (usedBox[box] || 0) >= perMailbox });
    if (hold === 'mailbox_full') continue;   // its mailbox is full today; next run
    if (hold === 'wait') { if (!dryRun) record(k, { status: 'waiting' }); held++; continue; }
    if (hold) { if (!dryRun) record(k, { status: 'skipped', skip_reason: hold }); console.log(`  skip ${entry.lead}: ${hold}`); continue; }
    if (draft.issues.length) { console.log(`  lint ${entry.lead}: ${draft.issues.map((i) => i.rule).join(', ')}`); if (!dryRun) record(k, { status: 'needs_review', skip_reason: 'lint' }); continue; }
    if ((usedBox[draft.eaccount] || 0) >= perMailbox) continue;   // its mailbox is full today; next run

    const full = assemble(draft.text);
    let html = toHtml(full, null).replace(SIGNUP, `<a href="${SIGNUP}">${SIGNUP}</a>`);
    const body = {
      eaccount: draft.eaccount, reply_to_uuid: draft.forward_of, to_address_email_list: draft.to,
      subject: draft.subject, body: { text: full, html }, include_original_body: false,
    };
    if (dryRun) {
      console.log(`\n--- would send ${draft.variant} to ${draft.to} from ${draft.eaccount} | ${draft.subject}\n${full}`);
      usedBox[draft.eaccount] = (usedBox[draft.eaccount] || 0) + 1; sent++;
      continue;
    }
    // Recorded straight after the call and never retried on a 5xx: a second
    // correction to the same person is worse than a missing one.
    const res = await ix.api('POST', '/emails/forward', body, { retry5xx: false });
    record(k, { status: 'sent', variant: draft.variant, sol: draft.sol, from: draft.eaccount, sent_at: new Date().toISOString(), sent_email_id: res.id || null });
    usedBox[draft.eaccount] = (usedBox[draft.eaccount] || 0) + 1;
    sent++;
    console.log(`  sent ${draft.variant.padEnd(13)} ${entry.lead}${draft.sol ? `  (${draft.sol})` : ''}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`\n${dryRun ? 'dry run: ' : ''}${sent} sent, ${held} still mid-sequence.`);
  status();
}

function status() {
  const by = {};
  for (const l of Object.values(ledger.leads)) {
    const s = `${l.campaign} ${l.status}${l.variant ? ` ${l.variant}` : ''}`;
    by[s] = (by[s] || 0) + 1;
  }
  for (const [k, v] of Object.entries(by).sort()) console.log(`  ${k.padEnd(28)} ${v}`);
}

if (cmd === 'init') init();
else if (cmd === 'preview') await preview(positional);
else if (cmd === 'send') await send();
else status();
