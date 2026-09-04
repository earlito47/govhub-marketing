// Act on the verification verdicts: take undeliverable addresses out of the
// wave 1 campaigns.
//
// Verifying a list and cleaning it are two jobs, and only the first one is
// interesting. A verification run that nobody applies leaves every bad address
// exactly where it was, queued to send, which is the state this found the
// campaigns in: 1,800 leads loaded, a verification done, and not one lead
// removed.
//
// Reads data/email-verification.json, the same cache verify-emails.mjs writes
// and lib_influencer_db.py reads, so a verdict is recorded once and reused
// everywhere. An address with no verdict is never touched: absence of a
// verdict is not evidence of a bad address, and silently dropping unverified
// leads would be worse than leaving them.
//
// Classes, and why the default is only the first:
//
//   invalid    the mailbox does not exist. Deleted. This is the class that
//              bounces, and bounces are what kill a young sending domain.
//   unknown    the server would not answer in time, usually greylisting.
//              Some share will deliver. Opt in with --drop-unknown.
//   catch_all  the domain accepts everything, so nothing can be proven either
//              way. Instantly holds these back on its own while
//              allow_risky_contacts is false, so deleting them here as well
//              would be doing the same job twice and losing the leads for
//              good. Opt in with --drop-catch-all if you disagree.
//
// Deleting is the right verb rather than pausing: a lead paused in a campaign
// still counts against the list you are reasoning about, and an address that
// does not exist has no reason to come back. The verdict stays in the cache,
// so a re-import would suppress it again without re-billing.
//
// Env: INSTANTLY_API_KEY
// Usage:
//   node scripts/outreach/wave1-suppress.mjs --dry-run
//   node scripts/outreach/wave1-suppress.mjs
//   node scripts/outreach/wave1-suppress.mjs --drop-unknown
//   node scripts/outreach/wave1-suppress.mjs --drop-unknown --drop-catch-all

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

const CAMPAIGNS = {
  A: '31fc2282-4153-42f9-b8d7-94517162b47c',
  B: '61c3b5df-22b6-4f98-ae56-290a750f1833',
  C: '09189743-6310-46bd-b48f-e5ca931d7e7e',
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const drop = new Set(['invalid']);
if (args.includes('--drop-unknown')) drop.add('unknown');
if (args.includes('--drop-catch-all')) drop.add('catch_all');

const cache = JSON.parse(readFileSync(join(ROOT, 'data/email-verification.json'), 'utf8'));
const verdicts = cache.results || {};

if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }

async function api(method, path, body) {
  // Content-Type only when there is actually a body. The API is Fastify, which
  // rejects a bodyless request that still declares application/json with a
  // 400 -- so DELETE /leads/{id} fails while the identical curl, which sends
  // no Content-Type, succeeds. Easy to misread as rate limiting.
  const headers = { Authorization: `Bearer ${KEY}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const leads = [];
for (const [key, id] of Object.entries(CAMPAIGNS)) {
  let cursor = null;
  for (let i = 0; i < 40; i++) {
    const body = { limit: 100, campaign: id };
    if (cursor) body.starting_after = cursor;
    const d = await api('POST', '/leads/list', body);
    for (const l of d.items || []) leads.push({ seg: key, lead: l });
    cursor = d.next_starting_after;
    if (!(d.items || []).length || !cursor) break;
  }
}

const tally = {};
const doomed = [];
let unverified = 0;
for (const { seg, lead } of leads) {
  const v = verdicts[(lead.email || '').toLowerCase()];
  if (!v) { unverified++; continue; }
  tally[v.result] = (tally[v.result] || 0) + 1;
  if (drop.has(v.result)) doomed.push({ seg, lead, result: v.result });
}

console.log(`${leads.length} leads across ${Object.keys(CAMPAIGNS).length} campaigns.`);
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(11)} ${String(n).padStart(5)}  ${((100 * n) / leads.length).toFixed(2)}%${drop.has(k) ? '   <- removing' : ''}`);
}
if (unverified) console.log(`  ${'no verdict'.padEnd(11)} ${String(unverified).padStart(5)}  left alone`);

const bounceRisk = ((tally.invalid || 0) / leads.length) * 100;
console.log(`\nInvalid addresses are ${bounceRisk.toFixed(2)}% of the list. The ramp gate is 2%.`);

if (!doomed.length) { console.log('\nNothing to remove.'); process.exit(0); }
console.log(`\n${doomed.length} to remove:`);
for (const d of doomed) console.log(`  ${d.seg}  ${d.lead.email.padEnd(42)} ${d.result}`);

if (dryRun) { console.log('\n--dry-run, nothing deleted.'); process.exit(0); }

// Paced and retried anyway. The 400 that sent me looking for a rate limit was
// the Content-Type bug above, not throttling, but a short gap between deletes
// costs nothing on a handful of leads and keeps a large suppression run polite.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let gone = 0, failed = 0;
for (const d of doomed) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await api('DELETE', `/leads/${d.lead.id}`);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      await sleep(1500 * attempt);
    }
  }
  if (lastErr) {
    failed++;
    console.log(` FAIL ${d.lead.email}  ${lastErr.message.split('\n')[0]}`);
  } else {
    gone++;
    console.log(`  gone ${d.lead.email}`);
  }
  await sleep(750);
}
console.log(`\n${gone} removed, ${failed} failed. ${leads.length - gone} leads remain.`);
