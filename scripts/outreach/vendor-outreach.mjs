// Vendor "claim your page" outreach.
//
// Emails each vendor with a PUBLISHED profile page one plain-text note from
// Jerr inviting them to review the page and request edits by replying. Rules
// that shape everything here (user decision, 2026-07-30):
//   - Plain text only. No HTML body, no images, no links in the body — the
//     mail must read like a person wrote it, and text-only also makes Resend
//     tracking impossible (open pixel needs HTML, click tracking needs URLs).
//   - One email per vendor, ever. The committed ledger
//     (data/vendor-outreach.json) is the idempotency record and the opt-out
//     suppression list; a vendor with `sentAt` or status "opted-out" is never
//     contacted again.
//   - No SAM.gov. POC email/phone are FOUO-gated at every public key tier and
//     in the public bulk extracts alike, so contacts come from a layered
//     resolver instead: SBA certification search first (keyless, covers small
//     businesses — see scripts/leadgen/enrich_sba.py for the API's quirks),
//     then Tomba domain search (TOMBA_API_KEY; published addresses on the
//     company's own domain, see scripts/leadgen/enrich_tomba.py), then Apollo
//     people search (APOLLO_API_KEY) for named contacts at the large primes.
//   - Never the same inbox twice across vendors: Raytheon and RTX share
//     rtx.com, so every tier skips an email some other vendor already holds.
//
// Modes:
//   (no flag)            dry run: print every email that WOULD send, verbatim
//   --resolve [--limit N]  fill contacts for published vendors missing one
//   --send    [--limit N]  send ready entries via Resend (default cap 10)
//   --test <address>       send one rendered sample to your own inbox
//
// Env: RESEND_API_KEY (send/test), TOMBA_API_KEY (resolve tier 2),
//      APOLLO_API_KEY (resolve tier 3), OUTREACH_FROM, OUTREACH_REPLY_TO,
//      OUTREACH_POSTAL (postal address for the signature; required to --send,
//      CAN-SPAM).

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadRoster, rosterEntries } from '../insights/lib/vendor-roster.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LEDGER_PATH = path.join(REPO_ROOT, 'data/vendor-outreach.json');

const FROM = process.env.OUTREACH_FROM || 'Jerr at GovHub <hello@govhub.online>';
const REPLY_TO = process.env.OUTREACH_REPLY_TO || 'hello@govhub.online';
const POSTAL = process.env.OUTREACH_POSTAL || '';

// Titles Apollo is asked for, in preference order: people who own how the
// company shows up in the federal market, not generic sales.
const APOLLO_TITLES = [
  'business development',
  'capture manager',
  'proposal manager',
  'corporate communications',
  'marketing',
];

// Company website domains for the Tomba tier, keyed by roster slug. The
// roster carries no domain field, so this map is hand-extended as pages
// publish; a vendor absent here just skips the tier. Raytheon and RTX
// genuinely share a domain — the used-email guard keeps them apart.
const KNOWN_DOMAINS = {
  'amerisourcebergen-drug': 'cencora.com',
  'barnard-construction': 'barnard-inc.com',
  'boeing': 'boeing.com',
  'booz-allen-hamilton': 'boozallen.com',
  'electric-boat': 'gdeb.com',
  'fisher-sand-and-gravel': 'fisherind.com',
  'fluor-marine-propulsion': 'navalnuclearlab.energy.gov',
  'humana-government-business': 'humanamilitary.com',
  'lockheed-martin': 'lockheedmartin.com',
  'mckesson': 'mckesson.com',
  'national-technology-and-engineering-solutions-of-sandia': 'sandia.gov',
  'optum-public-sector-solutions': 'optumserve.com',
  'raytheon': 'rtx.com',
  'rtx': 'rtx.com',
  'triad-national-security': 'lanl.gov',
  'triwest-healthcare-alliance': 'triwest.com',
};

// ---- Ledger ---------------------------------------------------------------
function loadLedger() {
  if (!existsSync(LEDGER_PATH)) return { version: 1, vendors: {} };
  return JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
}

async function saveLedger(ledger) {
  const sorted = Object.fromEntries(Object.entries(ledger.vendors).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(LEDGER_PATH, `${JSON.stringify({ version: 1, vendors: sorted }, null, 2)}\n`, 'utf8');
}

// ---- Email rendering ------------------------------------------------------
function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function firstName(contactName) {
  const first = String(contactName || '').trim().split(/\s+/)[0] || '';
  // A bare initial or an all-caps token reads like a mail merge — fall back.
  if (first.length < 2 || first === first.toUpperCase()) return '';
  return first;
}

export function renderEmail({ company, contactName }) {
  const subject = `${possessive(company)} page on GovHub`;
  const hi = firstName(contactName) || 'there';
  const signature = POSTAL ? `Jerr\nGovHub, ${POSTAL}` : 'Jerr\nGovHub';
  const body = `Hi ${hi},

I run GovHub, a small site that publishes federal contracting market
data. We recently put together a profile of ${possessive(company)} federal
work from public USAspending data: contract totals, top agencies,
largest awards, that kind of thing.

Since it's your company, I wanted to offer you the chance to review
the page and take control of it. If anything is off, or you want it
to say more (or less), just reply and I'll make the edits myself.
Happy to send a link over if you'd like to look first.

If you'd rather not hear from me again, reply "no thanks" and that's
the end of it.

${signature}
`;
  return { subject, body };
}

// Hard guard: the whole point is a personal, untracked, URL-free note. Refuse
// to send anything that violates that, whatever the template evolves into.
function assertPlain({ subject, body }) {
  const text = `${subject}\n${body}`;
  if (/https?:\/\/|www\./i.test(text)) throw new Error('outreach email contains a URL — refusing');
  if (/<[a-z][\s\S]*>/i.test(text)) throw new Error('outreach email contains HTML — refusing');
}

// ---- Contact resolution ---------------------------------------------------
const SBA_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Tier 1: SBA certification search (successor to the retired DSBS directory).
// Keyless; hits only on small businesses with an SBA profile. Same endpoint
// and quirks as scripts/leadgen/enrich_sba.py: browser UA required, not-found
// surfaces as HTTP 500 "No matching", and email is honored only when the
// profile's public display flags allow.
async function resolveSba(vendor) {
  if (!vendor.uei) return null;
  const resp = await fetch(`https://search.certifications.sba.gov/_api/v2/profile/${vendor.uei}`, {
    headers: { 'User-Agent': SBA_UA, Accept: 'application/json' },
  }).catch(() => null);
  if (!resp || !resp.ok) return null;
  const raw = await resp.json().catch(() => null);
  const ent = raw && typeof raw.entity === 'object' ? raw.entity : raw;
  if (!ent) return null;
  const flag = (name) => (typeof ent[name] === 'boolean' ? ent[name] : true);
  if (!flag('public_display') || !flag('display_email')) return null;
  const email = String(ent.email || '').trim();
  if (!email.includes('@')) return null;
  return {
    email,
    contactName: String(ent.contact_person || '').trim(),
    contactTitle: '',
    source: 'sba',
  };
}

// Tier 2: Tomba domain search — published addresses on the company's own
// domain. Same endpoint and quirks as scripts/leadgen/enrich_tomba.py:
// TOMBA_API_KEY holds base64("ta_<key>:ts_<secret>") or the raw colon pair, a
// browser UA is required (Cloudflare blocks python/node defaults), and each
// domain search spends monthly quota (trial: 200/month), which the resolve
// cadence of ~15/day stays well inside.
const TOMBA_PREFERRED = /ceo|president|owner|founder|principal|partner|business dev|capture|proposal|market|communications/i;

function tombaCreds() {
  const raw = (process.env.TOMBA_API_KEY || '').trim();
  if (!raw) return null;
  let pair = raw;
  if (!pair.includes(':')) {
    try {
      pair = Buffer.from(raw + '='.repeat((4 - (raw.length % 4)) % 4), 'base64').toString('utf8').trim();
    } catch {
      return null;
    }
  }
  const [key, secret] = pair.split(':').map((s) => s.trim());
  if (!key?.startsWith('ta_') || !secret?.startsWith('ts_')) return null;
  return { key, secret };
}

async function resolveTomba(vendor, usedEmails) {
  const creds = tombaCreds();
  if (!creds) return { skipped: true };
  const domain = KNOWN_DOMAINS[vendor.slug];
  if (!domain) {
    console.log(`[resolve] ${vendor.slug}: no known domain for the Tomba tier`);
    return null;
  }
  const resp = await fetch(`https://api.tomba.io/v1/domain-search?domain=${encodeURIComponent(domain)}&limit=10`, {
    headers: {
      'X-Tomba-Key': creds.key,
      'X-Tomba-Secret': creds.secret,
      'User-Agent': SBA_UA,
      Accept: 'application/json',
    },
  }).catch(() => null);
  if (!resp || !resp.ok) {
    console.log(`[resolve] ${vendor.slug}: tomba HTTP ${resp?.status ?? 'error'}`);
    return null;
  }
  const data = (await resp.json().catch(() => ({})))?.data ?? {};
  const rank = (e) => [TOMBA_PREFERRED.test(String(e.position || '')) ? 0 : 1, -(e.score || 0)];
  const candidates = (data.emails ?? [])
    .filter((e) => String(e.email || '').includes('@') && !usedEmails.has(e.email))
    .sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1]);
  const best = candidates[0];
  if (!best) return null;
  return {
    email: best.email,
    contactName: [best.first_name, best.last_name].filter(Boolean).join(' '),
    contactTitle: best.position || '',
    source: 'tomba',
  };
}

// Tier 3: Apollo. Search people at the company by title, then a match call to
// reveal the work email. Capped at 3 reveal attempts per vendor to keep credit
// use predictable.
async function apolloPost(key, endpoint, payload) {
  const resp = await fetch(`https://api.apollo.io/api/v1/${endpoint}`, {
    method: 'POST',
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`apollo ${endpoint}: HTTP ${resp.status} ${(await resp.text()).slice(0, 150)}`);
  return resp.json();
}

function apolloCandidateRank(person) {
  const title = String(person.title || '').toLowerCase();
  const idx = APOLLO_TITLES.findIndex((t) => title.includes(t.split(' ')[0]));
  return idx === -1 ? APOLLO_TITLES.length : idx;
}

async function resolveApollo(vendor, usedEmails) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return { skipped: true };
  const search = await apolloPost(key, 'mixed_people/search', {
    q_organization_name: vendor.displayName,
    person_titles: APOLLO_TITLES,
    per_page: 10,
  });
  const people = (search?.people ?? []).sort((a, b) => apolloCandidateRank(a) - apolloCandidateRank(b));
  for (const person of people.slice(0, 3)) {
    const match = await apolloPost(key, 'people/match', { id: person.id, reveal_personal_emails: false }).catch(() => null);
    const email = String(match?.person?.email || '').trim();
    if (email.includes('@') && !email.startsWith('email_not_unlocked') && !usedEmails.has(email)) {
      return {
        email,
        contactName: [person.first_name, person.last_name].filter(Boolean).join(' '),
        contactTitle: person.title || '',
        source: 'apollo',
      };
    }
  }
  return null;
}

async function runResolve(limit) {
  const ledger = loadLedger();
  const published = rosterEntries(loadRoster())
    .filter((v) => v.status === 'published' && !ledger.vendors[v.slug])
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    .slice(0, limit);
  if (published.length === 0) {
    console.log('[resolve] nothing to do: every published vendor has a ledger entry');
    return;
  }
  const usedEmails = new Set(Object.values(ledger.vendors).map((v) => v.email).filter(Boolean));
  for (const vendor of published) {
    const company = vendor.displayName;
    let contact = await resolveSba(vendor);
    if (contact && usedEmails.has(contact.email)) contact = null;
    let anySkipped = false;
    if (!contact) {
      const tomba = await resolveTomba(vendor, usedEmails);
      if (tomba?.skipped) anySkipped = true;
      else contact = tomba;
    }
    let apolloSkipped = false;
    if (!contact) {
      const apollo = await resolveApollo(vendor, usedEmails).catch((e) => {
        console.log(`[resolve] ${vendor.slug}: ${e.message}`);
        return { skipped: true };
      });
      if (apollo?.skipped) apolloSkipped = true;
      else contact = apollo;
    }
    if (contact) {
      usedEmails.add(contact.email);
      ledger.vendors[vendor.slug] = {
        company,
        contactName: contact.contactName,
        contactTitle: contact.contactTitle,
        email: contact.email,
        source: contact.source,
        status: 'ready',
        sentAt: null,
        resendId: null,
        notes: '',
      };
      console.log(`[resolve] ${vendor.slug}: ${contact.email} (${contact.source})`);
    } else if (anySkipped || apolloSkipped) {
      // A tier had no key configured — leave unresolved so a keyed run retries.
      console.log(`[resolve] ${vendor.slug}: unresolved (a resolver tier is missing its API key)`);
    } else {
      ledger.vendors[vendor.slug] = {
        company, contactName: '', contactTitle: '', email: '', source: '',
        status: 'no-contact', sentAt: null, resendId: null, notes: '',
      };
      console.log(`[resolve] ${vendor.slug}: no contact found (both tiers exhausted)`);
    }
    await saveLedger(ledger);
    await new Promise((r) => setTimeout(r, 600));
  }
}

// ---- Sending --------------------------------------------------------------
function sendable(ledger) {
  return Object.entries(ledger.vendors)
    .filter(([, v]) => v.status === 'ready' && !v.sentAt && v.email.includes('@'))
    .map(([slug, v]) => ({ slug, ...v }));
}

async function resendSend({ to, subject, body }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    // `text` only — never add an `html` key here; see the header comment.
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, text: body }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`resend: HTTP ${resp.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data.id ?? null;
}

async function runSend(limit) {
  if (!POSTAL) throw new Error('OUTREACH_POSTAL is not set — a postal address in the signature is required to send (CAN-SPAM)');
  const ledger = loadLedger();
  const batch = sendable(ledger).slice(0, limit);
  if (batch.length === 0) {
    console.log('[send] nothing ready to send');
    return;
  }
  for (const vendor of batch) {
    const email = renderEmail(vendor);
    assertPlain(email);
    const resendId = await resendSend({ to: vendor.email, ...email });
    ledger.vendors[vendor.slug].status = 'sent';
    ledger.vendors[vendor.slug].sentAt = new Date().toISOString();
    ledger.vendors[vendor.slug].resendId = resendId;
    await saveLedger(ledger); // after every send: a crash mid-batch must not re-send
    console.log(`[send] ${vendor.slug} -> ${vendor.email} (${resendId})`);
    await new Promise((r) => setTimeout(r, 1100));
  }
}

async function runTest(address) {
  if (!address || address.startsWith('--')) throw new Error('usage: --test you@example.com');
  const sample = sendable(loadLedger())[0] ?? { company: 'Lockheed Martin', contactName: 'Jerr' };
  const email = renderEmail(sample);
  assertPlain(email);
  const resendId = await resendSend({ to: address, subject: `[test] ${email.subject}`, body: email.body });
  console.log(`[test] sent sample ("${sample.company}") to ${address} (${resendId})`);
}

function runDry() {
  const ledger = loadLedger();
  const batch = sendable(ledger);
  const counts = {};
  for (const v of Object.values(ledger.vendors)) counts[v.status] = (counts[v.status] ?? 0) + 1;
  console.log(`[dry-run] ledger: ${JSON.stringify(counts)}; ${batch.length} would send\n`);
  for (const vendor of batch) {
    const email = renderEmail(vendor);
    assertPlain(email);
    console.log('='.repeat(70));
    console.log(`To:      ${vendor.contactName} <${vendor.email}>  [${vendor.source}]`);
    console.log(`From:    ${FROM}`);
    console.log(`Subject: ${email.subject}`);
    console.log('-'.repeat(70));
    console.log(email.body);
  }
  console.log('[dry-run] no email was sent');
}

// ---- CLI ------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const valueOf = (name, fallback) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  const limit = Number(valueOf('--limit', flag('--send') ? 10 : 15));

  if (flag('--resolve')) await runResolve(limit);
  else if (flag('--send')) await runSend(limit);
  else if (flag('--test')) await runTest(valueOf('--test'));
  else runDry();
}
