// Positive Instantly replies -> PostHog conversions.
//
// Polls every lead in every campaign in instantly-campaigns.mjs (all 13 live
// GovHub campaigns: angles A1-A5, influencer C1-C6, wave 1 W1A-W1C), classifies
// on the lead-level lt_interest_status enum, and captures one PostHog event per
// lead per band the lead has newly entered. data/instantly-replies.json is the
// committed ledger and IS the idempotency record: PostHog does not deduplicate,
// so without it every scheduled run re-captures every interested lead and
// inflates the count.
//
// WHY NO SERVER-SIDE FILTER. The FILTER_LEAD_* enum strings are not verified
// against this account. A wrong filter string does not error - it returns an
// empty page, and the conversion count reads a confident permanent zero. So we
// page ALL leads with the exact {limit, campaign, starting_after} shape already
// proven live in push-leads.mjs and wave1-suppress.mjs, and classify locally.
//
// WHY EMAIL-NAMESPACED IDENTITY. distinct_id is 'instantly:<email>', never the
// bare email and never aliased onto a signed-up person. posthog.alias() merges
// are irreversible and would fuse two humans behind a shared inbox (info@,
// press@) - exactly the addresses cold outreach hits. Positive replies are a
// CHANNEL-HEALTH METRIC, not a funnel step. Signup attribution is carried by the
// utm chain into user_profiles, which is the join that actually matters.
//
// PII: ids, addresses, statuses and timestamps ONLY. Never reply bodies, never
// content_preview - data/ is committed to git.
//
// Read-only toward Instantly: every call goes through readOnlyApi, which
// refuses anything but a GET or the leads/list read.
//
// A full scan is about 80 pages at 3.2 s (Instantly's 20-a-minute limit), so
// it takes around five minutes. A campaign that cannot be listed fails the run
// (exit 1) after the others are reported or captured, rather than quietly
// shrinking the count.
//
// Env:   INSTANTLY_API_KEY        read-scoped key (leads:read; campaigns:read for
//                                 the coverage checks, which are skipped without it)
//        POSTHOG_PROJECT_TOKEN    public write key, safe in CI
//        POSTHOG_HOST             optional, default https://us.i.posthog.com
// Usage: node scripts/outreach/instantly-replies.mjs --report    read-only summary
//        node scripts/outreach/instantly-replies.mjs --dry-run   show what would fire
//        node scripts/outreach/instantly-replies.mjs             capture + write ledger

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { CAMPAIGNS, PACE_MS, sleep, readOnlyApi, allLeads, untrackedCampaigns } from './instantly-campaigns.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const KEY = process.env.INSTANTLY_API_KEY;
const PH_HOST = (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/+$/, '');
const PH_KEY = process.env.POSTHOG_PROJECT_TOKEN;
const LEDGER_PATH = join(ROOT, 'data/instantly-replies.json');

const args = process.argv.slice(2);
const reportOnly = args.includes('--report');
const dryRun = args.includes('--dry-run');

// Lead-level interest enum. The email-level i_status and ai_interest_value are
// effectively undocumented (i_status query param says 1|2|3, the response example
// says 0; ai_interest_value is 0..1 with no stated scale) - do not build the
// positive/negative boundary on them.
const LABELS = {
  '4': 'won',
  '3': 'meeting_completed',
  '2': 'meeting_booked',
  '1': 'interested',
  '0': 'out_of_office',
  '-1': 'not_interested',
  '-2': 'wrong_person',
  '-3': 'lost',
  '-4': 'no_show',
};

// Cumulative bands. A lead labelled straight to Won fires all three, so the
// three counts stay internally consistent no matter how a human labelled it.
// Each event fires at most once per lead, ever.
const BANDS = [
  { event: 'outreach_reply_positive', min: 1 },
  { event: 'outreach_meeting_booked', min: 2 },
  { event: 'outreach_deal_won', min: 4 },
];

// Second dedupe layer at ingestion if the ledger is ever lost. Only works
// because the timestamp below is derived from Instantly data, not from now().
function stableUuid(key) {
  const h = createHash('sha256').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Segment / partner type from the outreach database, matched lowercased, the
// same way wave1-suppress.mjs:97 and push-leads.mjs:170 do it.
const enrichment = (() => {
  const map = new Map();
  const p = join(ROOT, 'data/govcon-influencer-outreach.json');
  if (!existsSync(p)) return map;
  const db = JSON.parse(readFileSync(p, 'utf8'));
  for (const c of db.contacts || []) {
    if (c.email) map.set(c.email.toLowerCase(), { segment: c.segment ?? null, partnerType: c.partnerType ?? null });
  }
  return map;
})();

async function capture({ event, email, campaignKey, campaignId, lead, ts }) {
  const distinctId = `instantly:${email}`;
  const extra = enrichment.get(email) || {};
  const res = await fetch(`${PH_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: PH_KEY,
      event,
      distinct_id: distinctId,
      timestamp: ts,
      uuid: stableUuid(`${event}:${email}`),
      properties: {
        source: 'instantly',
        campaign: campaignKey,
        campaign_id: campaignId,
        lt_interest_status: lead.lt_interest_status,
        interest_label: LABELS[String(lead.lt_interest_status)] ?? 'unknown',
        email_reply_count: lead.email_reply_count ?? null,
        company_domain: lead.company_domain ?? null,
        segment: extra.segment ?? null,
        partner_type: extra.partnerType ?? null,
        $lib: 'govhub-instantly-replies',
        // Label only. This person is deliberately NOT merged with any app user.
        $set: { email, outreach_campaign: campaignKey, outreach_status: LABELS[String(lead.lt_interest_status)] ?? 'unknown' },
        $set_once: { first_outreach_reply_at: ts },
      },
    }),
  });
  if (!res.ok) throw new Error(`PostHog ${event} -> ${res.status} ${await res.text()}`);
}

// ---------------------------------------------------------------------------

if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }
if (!reportOnly && !dryRun && !PH_KEY) { console.error('POSTHOG_PROJECT_TOKEN is not set'); process.exit(1); }

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { version: 1, leads: {} };

const api = readOnlyApi(KEY);

// Coverage checks. Both need campaigns:read, which a leads-only key may not
// have, so a failure here is reported and skipped rather than ending the run.
let untracked = null;
try { untracked = await untrackedCampaigns(api); } catch (e) { console.error(`  could not check for untracked campaigns: ${e.message.split('\n')[0]}`); }
await sleep(PACE_MS);
// Instantly's own lead count per campaign, so a short listing is visible on
// the line it belongs to instead of hiding inside the total.
const leadsCount = new Map();
try {
  for (const a of await api('GET', '/campaigns/analytics')) leadsCount.set(a.campaign_id, a.leads_count);
} catch (e) { console.error(`  could not read campaign lead counts: ${e.message.split('\n')[0]}`); }
await sleep(PACE_MS);

const distribution = {};
const pending = [];
// One event per lead per band, even when the same address sits in two
// campaigns. Without this a lead positive in both would be captured twice in
// one run (the ledger is only written after a send), and PostHog does not
// deduplicate two events whose timestamps differ. The first campaign in
// CAMPAIGNS order gets the credit.
const queued = new Set();
let crossCampaign = 0;
const perCampaign = [];
const failedCampaigns = [];
let scanned = 0;

for (const [key, id] of Object.entries(CAMPAIGNS)) {
  let leads;
  try {
    leads = await allLeads(api, id);
  } catch (e) {
    console.error(`  ${key}  FAILED to list leads: ${e.message}`);
    failedCampaigns.push(key);
    perCampaign.push({ key, listed: null, expected: leadsCount.get(id) ?? null, positive: null });
    continue;
  }
  scanned += leads.length;
  let positive = 0;
  for (const lead of leads) {
    const status = Number(lead.lt_interest_status);
    const bucket = Number.isFinite(status) ? String(status) : 'null';
    distribution[bucket] = (distribution[bucket] || 0) + 1;
    if (!Number.isFinite(status) || status < 1) continue;
    // Refuse to fire for a status the enum does not cover, rather than guess.
    if (!LABELS[bucket]) {
      console.error(`  WARNING unknown lt_interest_status ${bucket} on ${lead.email} - not captured`);
      continue;
    }
    const email = (lead.email || '').toLowerCase();
    if (!email) continue;
    positive++;

    const rec = ledger.leads[email] || { fired: {} };
    for (const band of BANDS) {
      if (status < band.min) continue;
      if (rec.fired[band.event]) continue;
      if (queued.has(`${band.event}:${email}`)) { crossCampaign++; continue; }
      queued.add(`${band.event}:${email}`);
      pending.push({ event: band.event, email, campaignKey: key, campaignId: id, lead, status });
    }
  }
  perCampaign.push({ key, listed: leads.length, expected: leadsCount.get(id) ?? null, positive });
  await sleep(PACE_MS);
}

console.log(`scanned ${scanned} leads across ${Object.keys(CAMPAIGNS).length} campaigns.`);
console.log('\ncampaign   listed  in Instantly  positive');
for (const c of perCampaign) {
  const short = c.listed !== null && c.expected !== null && c.listed !== c.expected ? '  <- listed != Instantly count' : '';
  console.log(
    `  ${c.key.padEnd(6)} ${String(c.listed ?? 'FAILED').padStart(7)} ${String(c.expected ?? '?').padStart(13)} ` +
    `${String(c.positive ?? '-').padStart(9)}${short}`,
  );
}
if (untracked?.length) {
  console.log('\nWARNING live GovHub campaign(s) not in instantly-campaigns.mjs, so NOT read:');
  for (const c of untracked) console.log(`  ${c.id}  status ${c.status}  ${c.name}`);
}

console.log('\nlt_interest_status distribution (verify against the Unibox before trusting any count):');
for (const [k, n] of Object.entries(distribution).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(LABELS[k] ?? k).padEnd(18)} ${String(n).padStart(5)}`);
}
if (crossCampaign) console.log(`\n${crossCampaign} event(s) skipped: same lead already queued from an earlier campaign.`);

// Runs after the report and after any capture, so one unreadable campaign
// never blocks the others, but the run still ends red.
function finish(code = 0) {
  if (failedCampaigns.length) {
    console.error(`\n${failedCampaigns.length} campaign(s) could not be listed: ${failedCampaigns.join(', ')}. Counts above exclude them.`);
    process.exit(1);
  }
  process.exit(code);
}

if (!pending.length) {
  console.log('\nno new positive replies to capture.');
  finish();
}

console.log(`\n${pending.length} event(s) to capture:`);
for (const p of pending) console.log(`  ${p.event.padEnd(26)} ${p.campaignKey}  ${p.email}`);

if (reportOnly || dryRun) {
  console.log(`\n${reportOnly ? '--report' : '--dry-run'}: nothing sent, ledger unchanged.`);
  finish();
}

let sent = 0, failed = 0;
for (const p of pending) {
  // Instantly's own timestamps, so a replay produces the same uuid. Falling back
  // to now() is safe here because it is written to the ledger on success and
  // never recomputed.
  const ts = p.lead.timestamp_last_interest_change || p.lead.timestamp_last_reply || new Date().toISOString();
  try {
    await capture({ ...p, ts });
    const rec = ledger.leads[p.email] || { fired: {} };
    rec.campaign = p.campaignKey;
    rec.campaign_id = p.campaignId;
    rec.lt_interest_status = p.status;
    rec.timestamp_last_reply = p.lead.timestamp_last_reply ?? null;
    rec.timestamp_last_interest_change = p.lead.timestamp_last_interest_change ?? null;
    rec.distinct_id = `instantly:${p.email}`;
    rec.fired[p.event] = new Date().toISOString();
    ledger.leads[p.email] = rec;
    sent++;
    // Record each success immediately: a crash mid-run must not re-fire the
    // events that already landed.
    writeLedger();
  } catch (e) {
    console.error(`  FAIL ${p.event} ${p.email}: ${e.message}`);
    failed++;
  }
  await sleep(150);
}

function writeLedger() {
  const sortedLeads = {};
  for (const k of Object.keys(ledger.leads).sort()) sortedLeads[k] = ledger.leads[k];
  writeFileSync(LEDGER_PATH, JSON.stringify({ version: 1, leads: sortedLeads }, null, 2) + '\n');
}

writeLedger();
console.log(`\ncaptured ${sent} event(s), ${failed} failed. wrote ${LEDGER_PATH}`);
finish(failed ? 1 : 0);
