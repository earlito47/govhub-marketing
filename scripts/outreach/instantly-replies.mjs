// Positive Instantly replies -> PostHog conversions.
//
// Polls every lead in all nine live campaigns, classifies on the lead-level
// lt_interest_status enum, and captures one PostHog event per lead per band the
// lead has newly entered. data/instantly-replies.json is the committed ledger and
// IS the idempotency record: PostHog does not deduplicate, so without it every
// scheduled run re-captures every interested lead and inflates the count.
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
// Env:   INSTANTLY_API_KEY        read-scoped key (leads:read)
//        POSTHOG_PROJECT_TOKEN    public write key, safe in CI
//        POSTHOG_HOST             optional, default https://us.i.posthog.com
// Usage: node scripts/outreach/instantly-replies.mjs --report    read-only summary
//        node scripts/outreach/instantly-replies.mjs --dry-run   show what would fire
//        node scripts/outreach/instantly-replies.mjs             capture + write ledger

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;
const PH_HOST = (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/+$/, '');
const PH_KEY = process.env.POSTHOG_PROJECT_TOKEN;
const LEDGER_PATH = join(ROOT, 'data/instantly-replies.json');

const args = process.argv.slice(2);
const reportOnly = args.includes('--report');
const dryRun = args.includes('--dry-run');

// Live campaign ids. Influencer programme: push-leads.mjs:38-45.
// Wave 1: wave1-suppress.mjs:49-53.
const CAMPAIGNS = {
  C1: '6f360a2e-4dee-4d75-8bd5-325162795616',
  C2: '1d2dc5a8-f7c1-4ac1-ac1a-3a382e185b4a',
  C3: 'b2ee3665-fbee-4366-b2ee-d31cc0573e8e',
  C4: 'b179df62-09f5-4045-a3e6-eb19afab4d20',
  C5: 'aceddf26-388d-45f4-be83-89eda98816a9',
  C6: '80a9659f-ba43-4411-969f-10ecfcd6b95d',
  A: '31fc2282-4153-42f9-b8d7-94517162b47c',
  B: '61c3b5df-22b6-4f98-ae56-290a750f1833',
  C: '09189743-6310-46bd-b48f-e5ca931d7e7e',
};

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Content-Type only when there is a body. The API is Fastify, which rejects a
// bodyless request that still declares application/json with a 400 - easy to
// misread as rate limiting. Copied from wave1-suppress.mjs:66-81, NOT from
// push-leads.mjs, which sets the header unconditionally.
async function api(method, path, body) {
  const headers = { Authorization: `Bearer ${KEY}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function allLeads(campaignId) {
  const out = [];
  let cursor = null;
  for (let i = 0; i < 40; i++) {
    const body = { limit: 100, campaign: campaignId };
    if (cursor) body.starting_after = cursor;
    const d = await api('POST', '/leads/list', body);
    const items = d.items || [];
    out.push(...items);
    cursor = d.next_starting_after;
    if (!items.length || !cursor) break;
    await sleep(600);
  }
  return out;
}

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

const distribution = {};
const pending = [];
let scanned = 0;

for (const [key, id] of Object.entries(CAMPAIGNS)) {
  let leads;
  try {
    leads = await allLeads(id);
  } catch (e) {
    console.error(`  ${key}  FAILED to list leads: ${e.message}`);
    continue;
  }
  scanned += leads.length;
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

    const rec = ledger.leads[email] || { fired: {} };
    for (const band of BANDS) {
      if (status < band.min) continue;
      if (rec.fired[band.event]) continue;
      pending.push({ event: band.event, email, campaignKey: key, campaignId: id, lead, status });
    }
  }
  await sleep(600);
}

console.log(`scanned ${scanned} leads across ${Object.keys(CAMPAIGNS).length} campaigns.`);
console.log('lt_interest_status distribution (verify against the Unibox before trusting any count):');
for (const [k, n] of Object.entries(distribution).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(LABELS[k] ?? k).padEnd(18)} ${String(n).padStart(5)}`);
}

if (!pending.length) {
  console.log('\nno new positive replies to capture.');
  process.exit(0);
}

console.log(`\n${pending.length} event(s) to capture:`);
for (const p of pending) console.log(`  ${p.event.padEnd(26)} ${p.campaignKey}  ${p.email}`);

if (reportOnly || dryRun) {
  console.log(`\n${reportOnly ? '--report' : '--dry-run'}: nothing sent, ledger unchanged.`);
  process.exit(0);
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
if (failed) process.exit(1);
