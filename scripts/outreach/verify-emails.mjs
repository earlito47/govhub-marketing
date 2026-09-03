// Email deliverability verification via MillionVerifier.
//
// Structural hygiene (influencer-db.mjs) answers "should we send here?" and
// says nothing about "will this address accept mail?". Those are different
// questions and this answers the second one. Bounces are what kill a young
// sending domain, and every address in this database came off a public web
// page rather than from someone who typed it in, so a share of them are stale
// by construction: a person who left the company, a contact page that has not
// been updated since 2019, an address that was always a typo.
//
// Results land in data/email-verification.json, keyed by lowercased address,
// and the Python build (lib_influencer_db.py) reads that file to set the
// `email-undeliverable` hold. Splitting it this way keeps the build
// reproducible: rebuilding the database re-reads the cached verdicts instead
// of re-billing the API, and a rebuild months later produces the same JSON.
// Re-running this script is what refreshes them.
//
// Verifies EVERY address in the database, not just the currently-sendable
// ones. When a sendable address turns out to be dead, the org-cap or
// domain-cap runner-up at the same organization is the natural replacement,
// and that only helps if its address is verified too. At roughly one credit
// per address this is cheap insurance.
//
// Env: MILLIONVERIFIER_API_KEY
// Usage:
//   node scripts/outreach/verify-emails.mjs --dry-run   what would be checked, no API calls
//   node scripts/outreach/verify-emails.mjs             verify anything not already cached
//   node scripts/outreach/verify-emails.mjs --recheck   re-verify everything, ignoring the cache

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DB_PATH = join(ROOT, 'data/govcon-influencer-outreach.json');
const CACHE_PATH = join(ROOT, 'data/email-verification.json');
const API = 'https://api.millionverifier.com/api/v3';
const KEY = process.env.MILLIONVERIFIER_API_KEY;

// Fields worth storing. Deliberately NOT `credits` or `executiontime`: those
// describe the account and the request, not the address, and committing them
// would churn the file on every run.
const KEEP = ['result', 'resultcode', 'quality', 'subresult', 'free', 'role', 'didyoumean'];

const arg = process.argv[2] || '';
const recheck = arg === '--recheck';
const dryRun = arg === '--dry-run';

const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));
const cache = existsSync(CACHE_PATH)
  ? JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
  : { version: 1, checkedWith: 'millionverifier api v3', results: {} };

const emails = [...new Set(db.contacts.map((c) => c.email).filter(Boolean).map((e) => e.toLowerCase()))].sort();
const todo = recheck ? emails : emails.filter((e) => !cache.results[e]);

console.log(`${emails.length} unique addresses in the database, ${cache.results ? Object.keys(cache.results).length : 0} already cached`);
console.log(`${todo.length} to verify${dryRun ? ' (dry run, no API calls)' : ''}\n`);

if (dryRun) {
  for (const e of todo) console.log(`  ${e}`);
  process.exit(0);
}
if (!todo.length) {
  console.log('Nothing to do. Pass --recheck to re-verify cached addresses.');
  process.exit(0);
}
if (!KEY) {
  console.error('MILLIONVERIFIER_API_KEY is not set');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let credits = null;
let failures = 0;

for (const [i, email] of todo.entries()) {
  const url = `${API}/?api=${encodeURIComponent(KEY)}&email=${encodeURIComponent(email)}&timeout=20`;
  try {
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok || body.error) {
      // A per-address error is not a verdict. Leave it uncached so the next
      // run retries it, rather than recording a verdict the API never gave.
      console.log(` FAIL ${email}  ${body.error || res.status}`);
      failures++;
    } else {
      const row = { checkedAt: new Date().toISOString().slice(0, 10) };
      for (const k of KEEP) if (body[k] !== undefined) row[k] = body[k];
      cache.results[email] = row;
      if (typeof body.credits === 'number') credits = body.credits;
      const flag = ['invalid', 'disposable'].includes(body.result) ? ' <-- undeliverable' : '';
      console.log(`  ${String(i + 1).padStart(3)}/${todo.length}  ${body.result.padEnd(10)} ${body.quality.padEnd(7)} ${email}${flag}`);
    }
  } catch (e) {
    console.log(` FAIL ${email}  ${e.message}`);
    failures++;
  }
  // No documented rate limit, but a small list does not need to be hammered.
  if (i < todo.length - 1) await sleep(120);
}

cache.checkedWith = 'millionverifier api v3';
writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');

const tally = {};
for (const e of emails) {
  const r = cache.results[e]?.result || 'not-checked';
  tally[r] = (tally[r] || 0) + 1;
}
console.log(`\nwrote ${CACHE_PATH}`);
console.log('by result:');
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
if (failures) console.log(`\n${failures} address(es) errored and were left uncached; re-run to retry them.`);
if (credits !== null) console.log(`\n${credits} MillionVerifier credits remaining.`);
