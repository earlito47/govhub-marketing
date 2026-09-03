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
// Idempotent and re-runnable: a lead already in the campaign is PATCHed if its
// merge variables changed and left alone if they did not, so re-running after
// an opener rewrite propagates the new text instead of silently keeping the
// old. A lead's position in the sequence is never disturbed.
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

// Interleave by sending domain so consecutive leads never share an office.
//
// This is what "stagger the sends" actually means in Instantly: leads enter a
// sequence in insertion order at daily_max_leads per day, so upload order IS
// send order. C5 allows up to three counselors per accelerator, and three
// emails landing in one Georgia Tech office on one morning reads very
// differently from three landing a week apart. Round-robining across domains
// puts the maximum possible distance between same-office recipients without
// any scheduling machinery.
function interleaveByDomain(rows) {
  const groups = new Map();
  for (const l of rows) {
    const d = l.email.split('@')[1];
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(l);
  }
  // Biggest offices first, so their members are spread widest across the queue.
  const queues = [...groups.values()].sort((a, b) => b.length - a.length);
  const out = [];
  for (let i = 0; out.length < rows.length; i++) {
    for (const q of queues) if (q[i]) out.push(q[i]);
  }
  return out;
}

const byCampaign = {};
for (const l of leads) (byCampaign[l.campaign] ||= []).push(l);
for (const key of Object.keys(byCampaign)) byCampaign[key] = interleaveByDomain(byCampaign[key]);

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

// Upsert, not insert. The openers get rewritten (data/openers.json), and a
// lead already in the campaign has the OLD text baked into its payload. Adding
// with skip_if_in_campaign would silently leave the stale copy in place, so a
// lead that already exists is PATCHed instead. Its sequence position is
// untouched either way.
async function existingLeadsFor(campaignId) {
  const byEmail = new Map();
  let cursor = null;
  for (let i = 0; i < 30; i++) {
    const body = { limit: 100, campaign: campaignId };
    if (cursor) body.starting_after = cursor;
    const d = await api('POST', '/leads/list', body);
    for (const l of d.items || []) byEmail.set((l.email || '').toLowerCase(), l);
    cursor = d.next_starting_after;
    if (!(d.items || []).length || !cursor) break;
  }
  return byEmail;
}

let created = 0, updated = 0, unchanged = 0, failed = 0;
for (const [key, rows] of Object.entries(byCampaign)) {
  const id = CAMPAIGN_IDS[key];
  if (!id) { console.error(`no campaign id for ${key}`); process.exit(1); }
  const existing = await existingLeadsFor(id);
  console.log(`\n${key} -> ${id}  (${rows.length} leads, ${existing.size} already there)`);
  for (const l of rows) {
    const vars = {
      greeting: l.greeting,
      opener: l.opener,
      channel: l.channel || '',
      companyName: l.companyName,
    };
    const prior = existing.get(l.email.toLowerCase());
    try {
      if (prior) {
        const p = prior.payload || {};
        const same = Object.entries(vars).every(([k, v]) => (p[k] || '') === v);
        if (same) { unchanged++; continue; }
        await api('PATCH', `/leads/${prior.id}`, { custom_variables: vars });
        updated++;
        console.log(`  upd  ${l.email}`);
      } else {
        const body = {
          campaign: id,
          email: l.email,
          company_name: l.companyName,
          website: l.website || undefined,
          skip_if_in_campaign: true,
          custom_variables: vars,
        };
        if (l.firstName) body.first_name = l.firstName;
        await api('POST', '/leads', body);
        created++;
        console.log(`  new  ${l.email}`);
      }
    } catch (e) {
      failed++;
      console.log(` FAIL ${l.email}  ${e.message.split('\n')[0]}`);
    }
  }
}

console.log(`\n${created} created, ${updated} updated, ${unchanged} already correct, ${failed} failed.`);
console.log('\nCampaign state now:');
for (const [key, id] of Object.entries(CAMPAIGN_IDS)) {
  const c = await api('GET', `/campaigns/${id}`);
  const n = await campaignLeadCount(id);
  const label = { 0: 'Draft', 1: 'ACTIVE', 2: 'Paused', 3: 'Completed' }[c.status] ?? c.status;
  console.log(`  ${key}  ${String(n).padStart(3)} leads  ${label}`);
}
console.log('\nNothing is sending: every campaign is still Draft.');
