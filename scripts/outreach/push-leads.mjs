// Upload the verified lead lists into their Instantly campaigns.
//
// Reads the same source of truth everything else does
// (data/govcon-influencer-outreach.json), applies the same hygiene gate as
// influencer-db.mjs --export, and pushes each campaign's leads with the
// custom variables its copy actually references.
//
// The custom variables are the whole point. {{greeting}} and {{opener}} are
// written per lead precisely because a blank merge field is invisible in
// Instantly's preview (it substitutes a populated sample lead) and only shows
// up on the first real send. So this refuses to upload a lead missing either,
// rather than letting "Hi ," reach a journalist.
//
// Uploading does NOT start anything. The campaigns stay in whatever status
// they are already in, and every one of them is Draft.
//
// Idempotent: skip_if_in_campaign means re-running adds only what is missing,
// so this is safe to run again after the list changes.
//
// Env: INSTANTLY_API_KEY
// Usage:
//   node scripts/outreach/push-leads.mjs --dry-run   what would upload, no API calls
//   node scripts/outreach/push-leads.mjs             upload
//   node scripts/outreach/push-leads.mjs --status    what is in each campaign now

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

// Live campaign ids, created by instantly-influencer.mjs --sync.
const CAMPAIGN_IDS = {
  C1: '6f360a2e-4dee-4d75-8bd5-325162795616',
  C2: '1d2dc5a8-f7c1-4ac1-ac1a-3a382e185b4a',
  C3: 'b2ee3665-fbee-4366-b2ee-d31cc0573e8e',
  C4: 'b179df62-09f5-4045-a3e6-eb19afab4d20',
  C5: 'aceddf26-388d-45f4-be83-89eda98816a9',
  C6: '80a9659f-ba43-4411-969f-10ecfcd6b95d',
};

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 500)}`);
  return json;
}

async function campaignLeadCount(id) {
  let total = 0, cursor = null;
  for (let i = 0; i < 30; i++) {
    const body = { limit: 100, campaign: id };
    if (cursor) body.starting_after = cursor;
    const d = await api('POST', '/leads/list', body);
    const items = d.items || [];
    total += items.length;
    cursor = d.next_starting_after;
    if (!items.length || !cursor) break;
  }
  return total;
}

const arg = process.argv[2] || '';

if (arg === '--status') {
  if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }
  for (const [key, id] of Object.entries(CAMPAIGN_IDS)) {
    const c = await api('GET', `/campaigns/${id}`);
    const n = await campaignLeadCount(id);
    // status 0 Draft, 1 Active, 2 Paused, 3 Completed
    const label = { 0: 'Draft', 1: 'ACTIVE', 2: 'Paused', 3: 'Completed' }[c.status] ?? c.status;
    console.log(`  ${key}  ${String(n).padStart(3)} leads  ${label.padEnd(9)} ${c.name}`);
  }
  process.exit(0);
}

// The export gate is the same one --export uses; run it rather than
// reimplementing it, so the two can never disagree about what is sendable.
console.log('running list hygiene checks first...\n');
try {
  execFileSync('node', [join(ROOT, 'scripts/outreach/influencer-db.mjs'), '--check'], { stdio: 'pipe' });
} catch (e) {
  console.error(e.stdout?.toString() || e.message);
  console.error('\nHygiene checks failed. Nothing uploaded.');
  process.exit(1);
}

const db = JSON.parse(readFileSync(join(ROOT, 'data/govcon-influencer-outreach.json'), 'utf8'));

// Rebuild the exact lead rows --export writes, from the same module, so the
// uploaded custom variables match the exported CSV byte for byte.
const { buildLeads } = await import(join(ROOT, 'scripts/outreach/influencer-db.mjs'));
const leads = buildLeads();

const byCampaign = {};
for (const l of leads) (byCampaign[l.campaign] ||= []).push(l);

let planned = 0;
for (const key of Object.keys(CAMPAIGN_IDS)) planned += (byCampaign[key] || []).length;
console.log(`${planned} leads to upload across ${Object.keys(CAMPAIGN_IDS).length} campaigns\n`);

for (const [key, rows] of Object.entries(byCampaign)) {
  for (const l of rows) {
    if (!l.greeting || !l.opener) {
      console.error(`FAIL ${key} ${l.email}: missing greeting or opener`);
      process.exit(1);
    }
  }
}

if (arg === '--dry-run') {
  for (const [key, rows] of Object.entries(byCampaign)) {
    console.log(`${key}  ${rows.length} leads -> ${CAMPAIGN_IDS[key]}`);
    for (const l of rows) console.log(`    ${l.email.padEnd(38)} ${l.greeting}`);
  }
  process.exit(0);
}

if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }

let uploaded = 0, failed = 0;
for (const [key, rows] of Object.entries(byCampaign)) {
  const id = CAMPAIGN_IDS[key];
  if (!id) { console.error(`no campaign id for ${key}`); process.exit(1); }
  console.log(`\n${key} -> ${id}  (${rows.length} leads)`);
  for (const l of rows) {
    const body = {
      campaign: id,
      email: l.email,
      company_name: l.companyName,
      website: l.website || undefined,
      // Re-running must not duplicate a lead or reset its sequence position.
      skip_if_in_campaign: true,
      custom_variables: {
        greeting: l.greeting,
        opener: l.opener,
        channel: l.channel || '',
        companyName: l.companyName,
      },
    };
    if (l.firstName) body.first_name = l.firstName;
    try {
      await api('POST', '/leads', body);
      uploaded++;
      console.log(`  ok   ${l.email}`);
    } catch (e) {
      failed++;
      console.log(` FAIL ${l.email}  ${e.message.split('\n')[0]}`);
    }
  }
}

console.log(`\n${uploaded} uploaded, ${failed} failed.`);
console.log('\nCampaign state now:');
for (const [key, id] of Object.entries(CAMPAIGN_IDS)) {
  const c = await api('GET', `/campaigns/${id}`);
  const n = await campaignLeadCount(id);
  const label = { 0: 'Draft', 1: 'ACTIVE', 2: 'Paused', 3: 'Completed' }[c.status] ?? c.status;
  console.log(`  ${key}  ${String(n).padStart(3)} leads  ${label}`);
}
console.log('\nNothing is sending: every campaign is still Draft.');
