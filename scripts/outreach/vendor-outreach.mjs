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
//     contacted again. The ledger is only durable once the workflow commits
//     it, so every send also carries a per-vendor Resend Idempotency-Key: a
//     run that dies before the commit replays as a no-op instead of a second
//     email.
//     The name in the note is re-derived from the roster's raw USAspending
//     name rather than the roster displayName, which is shaped for page
//     titles and mangles the tail cases ("Csi Aviation", "W S Darley and").
//     Hand-corrected displayNames and a ledger `companyOverride` both win
//     over the derivation; the dry run prints the exact name that will send.
//   - No SAM.gov. POC email/phone are FOUO-gated at every public key tier and
//     in the public bulk extracts alike, so contacts come from a layered
//     resolver instead: SBA certification search first (keyless, covers small
//     businesses — see scripts/leadgen/enrich_sba.py for the API's quirks),
//     then Apollo (APOLLO_API_KEY) for named contacts at the large primes:
//     company name -> organization id, then people inside that organization.
//     (A Tomba domain-search tier sat between them until 2026-08-05, removed
//     by user decision — no Tomba subscription.)
//   - A vendor neither tier can resolve is retried on a slow cadence rather
//     than retired: Apollo's coverage of a company changes over months.
//   - Never the same inbox twice across vendors: Raytheon and RTX share
//     rtx.com, so every tier skips an email some other vendor already holds,
//     or that the ledger's `suppressed` list has retired.
//
// Modes:
//   (no flag)            dry run: print every email that WOULD send, verbatim
//   --resolve [--limit N]  fill contacts for published vendors missing one
//   --send    [--limit N]  send ready entries via Resend (default cap 10)
//   --test <address>       send one rendered sample to your own inbox
//
// Env: RESEND_API_KEY (send/test), APOLLO_API_KEY (resolve tier 2),
//      OUTREACH_FROM, OUTREACH_REPLY_TO, OUTREACH_POSTAL (postal address for
//      the signature; required to --send, CAN-SPAM).

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { displayNameFor, loadRoster, rosterEntries } from '../insights/lib/vendor-roster.mjs';

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

// Apollo reveal attempts per vendor: each one is a credit.
const APOLLO_REVEALS_PER_VENDOR = 3;
// A vendor both tiers failed is retried, but slowly: Apollo's coverage of a
// company changes over months, not overnight, and a daily retry of 75 dead
// vendors would just burn a credit apiece every morning.
const RETRY_AFTER_DAYS = 14;
const MAX_RESOLVE_ATTEMPTS = 5;

// ---- Ledger ---------------------------------------------------------------
function loadLedger() {
  if (!existsSync(LEDGER_PATH)) return { version: 1, vendors: {}, suppressed: [] };
  const ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
  ledger.suppressed ??= [];
  return ledger;
}

async function saveLedger(ledger) {
  const sorted = Object.fromEntries(Object.entries(ledger.vendors).sort(([a], [b]) => a.localeCompare(b)));
  // `suppressed` is written explicitly: an address that must never be mailed
  // again outlives the vendor row it came from, so it cannot live inside
  // `vendors` and must not be dropped by this rewrite.
  const out = { version: 1, vendors: sorted, suppressed: ledger.suppressed ?? [] };
  await writeFile(LEDGER_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
}

// Every address the outreach must not use again: one already spoken for by
// another vendor, and one explicitly retired (a contact resolved to the wrong
// company, an opt-out). Raytheon and RTX share rtx.com, which is why this is
// a global set rather than a per-vendor check.
function usedEmailSet(ledger) {
  return new Set([
    ...Object.values(ledger.vendors).map((v) => v.email).filter(Boolean),
    ...(ledger.suppressed ?? []).map((s) => s.email).filter(Boolean),
  ]);
}

// ---- Company name for prose -----------------------------------------------
// The roster's displayName is built for page titles by a slug-shaped
// heuristic, and it mangles exactly the names that matter most in a note that
// has to read like a person wrote it:
//   "CSI AVIATION, INC"              -> "Csi Aviation"
//   "W S DARLEY & CO"                -> "W S Darley and"
//   "FOUR POINTS TECHNOLOGY, L.L.C." -> "Four Points Technology L L C"
//   "AT&T ENTERPRISES, LLC"          -> "At and T Enterprises"
// One email per vendor ever means a mangled name is permanent damage, so
// outreach re-derives the name from the roster's raw USAspending `name` and
// preserves the source's own punctuation instead of flattening it to letters.
// A ledger entry may also carry `companyOverride` — the dry run prints the
// exact name that will send, so a tail case can be hand-fixed before it goes.

// Matched repeatedly against the trailing token, on letters only, so "INC.",
// "L.L.C." and "S.A." all match. Includes the foreign forms the roster meets
// (KONGSBERG ... AS, MOTOR OIL ... S.A.).
const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'lllp', 'llp', 'lp', 'ltd', 'limited', 'plc', 'pc',
  'corp', 'corporation', 'co', 'company', 'companies', 'jv', 'holdings',
  'as', 'sa', 'ag', 'nv', 'bv', 'gmbh', 'spa', 'pte', 'pty', 'ab', 'oy',
]);
const KEEP_LOWER = new Set(['of', 'and', 'the', 'for', 'de', 'du', 'da']);
// Short tokens that are ordinary words, not initialisms. Without this, the
// "<=3 letters stays uppercase" rule that correctly yields CSI/CGI/GEO/BAE
// would also yield "Motor OIL" and "SEA Systems".
const SHORT_WORDS = new Set([
  'air', 'oil', 'gas', 'sea', 'sun', 'sky', 'ice', 'oak', 'bay', 'box', 'car',
  'jet', 'lab', 'law', 'led', 'log', 'map', 'max', 'med', 'net', 'new', 'oak',
  'old', 'one', 'pro', 'red', 'run', 'six', 'ten', 'top', 'two', 'way', 'web',
  'win', 'arm', 'arc', 'bar', 'bio', 'cab', 'cap', 'eye', 'fan', 'far', 'fit',
  'fly', 'gap', 'gem', 'gulf', 'hub', 'ink', 'key', 'kit', 'oak', 'pen', 'pit',
  'ray', 'rim', 'sky', 'sum', 'tag', 'tin', 'tip', 'ton', 'tri', 'van', 'war',
]);

const lettersOf = (tok) => String(tok).replace(/[^A-Za-z]/g, '').toLowerCase();

function titleToken(tok) {
  // Verbatim where the source already carries structure a title-caser would
  // destroy: digits (V3GATE, M1, "Phillips 66") and ampersands (AT&T).
  if (/[0-9&]/.test(tok)) return tok;
  // Per part, so UT-BATTELLE -> UT-Battelle.
  if (tok.includes('-')) return tok.split('-').map(titleToken).join('-');
  const letters = tok.replace(/[^A-Za-z]/g, '');
  if (!letters) return tok;
  // Mixed case in the source is a human's own spelling. Leave it alone.
  if (tok !== tok.toUpperCase() && tok !== tok.toLowerCase()) return tok;
  // Short and not a word: an initialism. CSI, CGI, FCN, GEO, BAE, KBR, UT.
  if (letters.length <= 3 && !SHORT_WORDS.has(letters.toLowerCase())) return tok.toUpperCase();
  const cased = letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
  return tok.replace(letters, cased);
}

export function companyForEmail(rawName) {
  // Trailing commas and wrapping brackets go; trailing periods stay, so
  // "M. A. MORTENSON" keeps its initials while "INC." still matches below.
  let tokens = String(rawName || '')
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[("'[]+/, '').replace(/[)"'\],;:]+$/, ''))
    .filter(Boolean);
  // One loop, because each pop can expose the next: "WHITING-TURNER
  // CONTRACTING COMPANY, THE" needs THE off before COMPANY is even last, and
  // "W S DARLEY & CO" strands the ampersand that joined the suffix it drops.
  while (tokens.length > 1) {
    const last = lettersOf(tokens.at(-1));
    if (LEGAL_SUFFIXES.has(last) || last === 'the' || tokens.at(-1) === '&') tokens.pop();
    else break;
  }
  if (tokens.length > 1 && lettersOf(tokens[0]) === 'the') tokens.shift();
  const name = tokens
    .map((tok, i) => (i > 0 && KEEP_LOWER.has(lettersOf(tok)) ? lettersOf(tok) : titleToken(tok)))
    .join(' ');
  return name || String(rawName || '').trim();
}

// The company name to put in one vendor's email, in precedence order:
//   1. `companyOverride` on the ledger entry — a hand fix for this email.
//   2. A roster displayName a human already corrected. The roster invites
//      exactly that ("displayName is stored so a human can hand-fix the tail
//      cases once, permanently"), and 8 entries carry one today — McKesson,
//      CACI Federal, TriWest, PanTeXas. Deriving from the raw name instead
//      would quietly undo them.
//   3. The raw USAspending name, cleaned up for prose.
//   4. Whatever the ledger recorded, for entries with no roster row left.
function companyFor(entry, roster) {
  if (entry.companyOverride) return entry.companyOverride;
  const vendor = roster?.vendors?.[entry.slug];
  if (vendor?.name && vendor.displayName && vendor.displayName !== displayNameFor(vendor.name)) {
    return vendor.displayName;
  }
  return companyForEmail(vendor?.name || entry.company);
}

// ---- Email rendering ------------------------------------------------------
function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// "AUSTIN" -> "Austin", "O'BRIEN" -> "O'Brien", "JEAN-LUC" -> "Jean-Luc".
function properCase(word) {
  return word.toLowerCase().replace(/(^|[’'-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

function firstName(contactName) {
  const first = String(contactName || '').trim().split(/\s+/)[0] || '';
  // A bare initial ("G MATTHEW KOEHL") reads like a mail merge — fall back.
  if (first.replace(/[^A-Za-z]/g, '').length < 2) return '';
  // SBA returns every contact in caps. Casing it down is the fix; dropping the
  // name is not. Greeting Austin DeRose as "Hi there" was the old behaviour
  // for all 16 SBA-sourced contacts.
  return first === first.toUpperCase() ? properCase(first) : first;
}

// Plain text with no HTML has no reflow: the line breaks in the body are the
// line breaks the vendor sees. The paragraphs are wrapped at send time rather
// than typed with hard breaks, because a substituted company name changes the
// length of the line it lands in — "National Technology & Engineering
// Solutions of Sandia" ran a hand-wrapped line 30 characters past its
// neighbours, which is exactly the ragged look a mail merge has.
const WRAP_COLS = 68;

export function wrapBody(text, width = WRAP_COLS) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

export function renderEmail({ company, contactName }) {
  const subject = `${possessive(company)} page on GovHub`;
  const hi = firstName(contactName) || 'there';
  const signature = POSTAL ? `Jerr\nGovHub, ${POSTAL}` : 'Jerr\nGovHub';
  const paragraphs = [
    `Hi ${hi},`,
    `I run GovHub, a small site that publishes federal contracting market data. We recently put together a profile of ${possessive(company)} federal work from public USAspending data: contract totals, top agencies, largest awards, that kind of thing.`,
    "Since it's your company, I wanted to offer you the chance to review the page and take control of it. If anything is off, or you want it to say more (or less), just reply and I'll make the edits myself. Happy to send a link over if you'd like to look first.",
    `If you'd rather not hear from me again, reply "no thanks" and that's the end of it.`,
  ];
  const body = `${paragraphs.map((p) => wrapBody(p)).join('\n\n')}\n\n${signature}\n`;
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

// Tier 2: Apollo, in two steps — resolve the company to an organization id,
// then search people inside that organization by title and reveal one work
// email. Capped at APOLLO_REVEALS_PER_VENDOR reveals per vendor to keep credit
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

// Company-name match, used to confirm that the organization Apollo returned
// for a name really is the vendor, and as a backstop on each person's
// employer. Acronym-only mismatches (SAIC) stay unresolved for hand entry
// rather than risking an email to the wrong company.
//
// The match is a PREFIX of the token list, not free containment. Extra tokens
// on the end are the same company under a longer registration ("Northrop
// Grumman" / "Northrop Grumman Systems"); extra tokens on the FRONT are a
// different company that merely ends in the same words. Free containment sent
// two wrong emails before this was tightened: "Aerospace" (The Aerospace
// Corporation) matched Field Aerospace, and "General Electric" matched
// Portland General Electric. A single shared token is never enough on its
// own — one word can be an industry rather than an identity.
function nameTokens(name) {
  return companyForEmail(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter(Boolean);
}

export function sameCompany(vendorName, orgName) {
  const a = nameTokens(vendorName);
  const b = nameTokens(orgName);
  if (!a.length || !b.length) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (!short.every((tok, i) => tok === long[i])) return false;
  return a.length === b.length || short.length >= 2;
}

// Step 1: the vendor's USAspending legal name -> an Apollo organization id.
//
// This step exists because searching people by company NAME does not work.
// Apollo files companies under their trading name, and the roster carries the
// registered one, so the old q_keywords search missed the company entirely or
// surfaced somebody at a different one. Measured against the vendors this
// resolver had given up on:
//   "Carahsoft Technology"           -> 0 people;   carahsoft.com -> 332
//   "Space Exploration Technologies" -> 1 person, at Lockheed Martin;
//                                       spacex.com  -> 20
// Both companies are in Apollo in force. The query was the problem.
//
// Costs one Apollo credit per call that returns a result, so it runs once per
// vendor, after the keyless SBA tier has already had its turn, and only for
// vendors the daily --limit lets through.
async function apolloOrgId(key, vendor) {
  const name = companyForEmail(vendor.name || vendor.displayName);
  const search = await apolloPost(key, 'mixed_companies/search', {
    q_organization_name: name,
    per_page: 5,
  });
  // Two buckets, and the id to use differs: `organizations` (net new) carries
  // the organization id as `id`, while `accounts` (already saved to the
  // team) carries it as `organization_id` and uses `id` for the account.
  const candidates = [
    ...(search?.organizations ?? []).map((o) => ({ id: o.id, name: o.name })),
    ...(search?.accounts ?? []).map((a) => ({ id: a.organization_id, name: a.name })),
  ].filter((o) => o.id && o.name);
  // Name search is fuzzy, so the same guard that keeps people at the wrong
  // company out applies to the company itself.
  const hit = candidates.find((o) => sameCompany(vendor.name || vendor.displayName, o.name));
  if (!hit) {
    console.log(`[resolve] ${vendor.slug}: no Apollo org matched "${name}"${candidates.length ? ` (saw ${candidates.map((c) => c.name).join(', ')})` : ''}`);
    return null;
  }
  return hit;
}

async function resolveApollo(vendor, usedEmails) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return { skipped: true };
  const org = await apolloOrgId(key, vendor);
  if (!org) return null;
  const search = await apolloPost(key, 'mixed_people/api_search', {
    organization_ids: [org.id],
    person_titles: APOLLO_TITLES,
    person_locations: ['United States'],
    per_page: 25,
  });
  const people = (search?.people ?? [])
    // has_email is Apollo telling us, for free, whether it holds a work email
    // for this person. Revealing one it does not have still spends a credit,
    // so candidates without it go last rather than first.
    .filter((p) => p.has_email !== false)
    // The org-id filter should make this redundant. Keep it: a reveal is a
    // credit, and an email to the wrong company cannot be taken back.
    .filter((p) => !p.organization?.name || sameCompany(org.name, p.organization.name))
    .sort((a, b) => apolloCandidateRank(a) - apolloCandidateRank(b));
  if (people.length === 0) {
    console.log(`[resolve] ${vendor.slug}: Apollo org "${org.name}" has no titled contact with an email on file`);
    return null;
  }
  for (const person of people.slice(0, APOLLO_REVEALS_PER_VENDOR)) {
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

// A vendor is due for a resolution attempt if it has never had one, or if
// both tiers came up empty far enough back to be worth another look.
//
// "no-contact" used to be terminal: runResolve skipped every vendor that had
// a ledger row at all, so the 75 vendors the old keyword search failed on
// could never be reached again, no matter what got fixed afterwards. The
// digest's "retries daily" only ever described vendors with no row.
export function dueForResolve(entry, now) {
  if (!entry) return true;
  if (entry.status !== 'no-contact') return false;
  if ((entry.resolveAttempts ?? 1) >= MAX_RESOLVE_ATTEMPTS) return false;
  if (!entry.lastResolveAt) return true;
  return now - Date.parse(entry.lastResolveAt) >= RETRY_AFTER_DAYS * 86400000;
}

async function runResolve(limit) {
  const ledger = loadLedger();
  const now = Date.now();
  const published = rosterEntries(loadRoster())
    .filter((v) => v.status === 'published' && dueForResolve(ledger.vendors[v.slug], now))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    .slice(0, limit);
  if (published.length === 0) {
    console.log('[resolve] nothing to do: every published vendor is resolved or not yet due for a retry');
    return;
  }
  const usedEmails = usedEmailSet(ledger);
  for (const vendor of published) {
    // The name the email will actually say, not the page-title displayName.
    const company = companyForEmail(vendor.name || vendor.displayName);
    let contact = await resolveSba(vendor);
    if (contact && usedEmails.has(contact.email)) contact = null;
    let apolloSkipped = false;
    let apolloErrored = false;
    if (!contact) {
      const apollo = await resolveApollo(vendor, usedEmails).catch((e) => {
        console.log(`[resolve] ${vendor.slug}: ${e.message}`);
        return { skipped: true, errored: true };
      });
      if (apollo?.skipped) {
        apolloSkipped = true;
        apolloErrored = Boolean(apollo.errored);
      } else contact = apollo;
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
        sendAttempts: 0,
        notes: '',
      };
      console.log(`[resolve] ${vendor.slug}: ${contact.email} (${contact.source})`);
    } else if (apolloSkipped) {
      // Leave unresolved so a later run retries — and say WHY accurately: the
      // 2026-08-05 stall was misdiagnosed for a day because an Apollo API
      // error printed the missing-key message.
      console.log(
        `[resolve] ${vendor.slug}: unresolved (${apolloErrored ? 'Apollo errored this run' : 'APOLLO_API_KEY is not configured'})`,
      );
    } else {
      // Not terminal any more: record the attempt so this vendor comes back
      // around in RETRY_AFTER_DAYS, up to MAX_RESOLVE_ATTEMPTS.
      const attempts = (ledger.vendors[vendor.slug]?.resolveAttempts ?? 0) + 1;
      ledger.vendors[vendor.slug] = {
        company, contactName: '', contactTitle: '', email: '', source: '',
        status: 'no-contact', sentAt: null, resendId: null, notes: '',
        resolveAttempts: attempts,
        lastResolveAt: new Date().toISOString(),
      };
      console.log(
        `[resolve] ${vendor.slug}: no contact found (attempt ${attempts}/${MAX_RESOLVE_ATTEMPTS}` +
        `${attempts >= MAX_RESOLVE_ATTEMPTS ? ', giving up' : `, retrying after ${RETRY_AFTER_DAYS}d`})`,
      );
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

// How many failed attempts a vendor gets before it stops being retried daily.
const MAX_SEND_ATTEMPTS = 3;

async function resendSend({ to, subject, body, idempotencyKey = null }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  // "One email per vendor, ever" is enforced by the ledger — but the ledger
  // only becomes durable when the workflow commits it, and a run that dies
  // between the send and that commit would leave tomorrow's run believing the
  // vendor was never contacted. The key makes that replay harmless: Resend
  // collapses it into the original send and returns the original id rather
  // than mailing the vendor twice. Keys live 24h, which is exactly the gap
  // between two runs of this daily workflow.
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 256);
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    // `text` only — never add an `html` key here; see the header comment.
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, text: body }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`resend: HTTP ${resp.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data.id ?? null;
}

async function runSend(limit) {
  if (!POSTAL) throw new Error('OUTREACH_POSTAL is not set — a postal address in the signature is required to send (CAN-SPAM)');
  const roster = loadRoster();
  const ledger = loadLedger();
  const batch = sendable(ledger).slice(0, limit);
  if (batch.length === 0) {
    console.log('[send] nothing ready to send');
    return;
  }
  const failed = [];
  for (const vendor of batch) {
    const entry = ledger.vendors[vendor.slug];
    const email = renderEmail({ ...vendor, company: companyFor(vendor, roster) });
    assertPlain(email);
    try {
      // Stable per vendor and forever: this vendor is only ever mailed once,
      // so any repeat of this exact request is a replay, not a new email.
      const resendId = await resendSend({
        to: vendor.email,
        ...email,
        idempotencyKey: `vendor-outreach:${vendor.slug}`,
      });
      entry.status = 'sent';
      entry.sentAt = new Date().toISOString();
      entry.resendId = resendId;
      console.log(`[send] ${vendor.slug} -> ${vendor.email} (${resendId})`);
    } catch (e) {
      // One bad address must not abandon the rest of the batch, and must not
      // cost the ledger the sends already made in it.
      entry.sendAttempts = (entry.sendAttempts ?? 0) + 1;
      entry.notes = `send failed ${new Date().toISOString()}: ${e.message}`.slice(0, 300);
      if (entry.sendAttempts >= MAX_SEND_ATTEMPTS) {
        entry.status = 'send-failed';
        console.log(`[send] ${vendor.slug}: FAILED ${entry.sendAttempts}x, giving up — ${e.message}`);
      } else {
        console.log(`[send] ${vendor.slug}: failed (attempt ${entry.sendAttempts}), will retry — ${e.message}`);
      }
      failed.push(vendor.slug);
    }
    await saveLedger(ledger); // after every vendor: a crash mid-batch must not re-send
    await new Promise((r) => setTimeout(r, 1100));
  }
  if (failed.length) throw new Error(`${failed.length} send(s) failed: ${failed.join(', ')}`);
}

async function runTest(address) {
  if (!address || address.startsWith('--')) throw new Error('usage: --test you@example.com');
  const sample = sendable(loadLedger())[0] ?? { company: 'Lockheed Martin', contactName: 'Jerr' };
  const company = companyFor(sample, loadRoster());
  const email = renderEmail({ ...sample, company });
  assertPlain(email);
  // No idempotency key: a test send is meant to be repeatable.
  const resendId = await resendSend({ to: address, subject: `[test] ${email.subject}`, body: email.body });
  console.log(`[test] sent sample ("${company}") to ${address} (${resendId})`);
}

function runDry() {
  const roster = loadRoster();
  const ledger = loadLedger();
  const batch = sendable(ledger);
  const counts = {};
  for (const v of Object.values(ledger.vendors)) counts[v.status] = (counts[v.status] ?? 0) + 1;
  console.log(`[dry-run] ledger: ${JSON.stringify(counts)}; ${batch.length} would send\n`);
  for (const vendor of batch) {
    const company = companyFor(vendor, roster);
    const email = renderEmail({ ...vendor, company });
    assertPlain(email);
    console.log('='.repeat(70));
    console.log(`To:      ${vendor.contactName} <${vendor.email}>  [${vendor.source}]`);
    console.log(`From:    ${FROM}`);
    console.log(`Company: ${company}${company === vendor.company ? '' : `  (ledger says "${vendor.company}")`}`);
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
