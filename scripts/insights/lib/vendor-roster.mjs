// Stable-slug roster for vendor profile pages (spec Phase 3).
//
// The roster is the source of truth for WHICH vendors get profile pages and
// WHAT their URLs are. Rules that keep vendor URLs SEO-safe forever:
//   - Append-only: entries are never deleted or renamed. A vendor that falls
//     out of the top rankings keeps its page (and keeps getting refreshed).
//   - A slug is computed once, when the vendor first enters the roster, and
//     never recomputed — even if USAspending later reports a changed name.
//   - Dedupe is by UEI (recipient_duns rows are child-level "-C" ids, so the
//     UEI collapses recipient levels of the same registration).
//
// The roster file lives at src/data/insights/vendor-roster.json — at the data
// dir ROOT, deliberately: (a) the weekly/daily workflows `git add
// src/data/insights`, so roster changes are committed; (b) the embed route
// globs data/insights/*/*.json, and a chartless roster file inside vendor/
// would crash that build; (c) validate.mjs skips it by name, like meta.json.
//
// Growth model (user decision, 2026-07-30): launch with the top VENDOR_TOP_N
// contractors, then walk the rankings down by VENDOR_WEEKLY_ADDS per weekly
// run. Expansion self-throttles: it pauses while the pending backlog is deep,
// and rows below the thin-content hard floor ($50M FY-to-date) never enter the
// roster at all, so growth stops naturally where page quality would.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { vendorHref } from './slugs.mjs';
import { GUARDRAILS } from './guardrails.mjs';
import { isoWeekString } from './format.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const ROSTER_PATH = path.join(REPO_ROOT, 'src/data/insights/vendor-roster.json');
const VENDOR_PAGE_DIR = path.join(REPO_ROOT, 'src/data/insights/vendor');

// ---- Knobs ----------------------------------------------------------------
// Launch roster size (top N contractors by FY-to-date obligations).
export const VENDOR_TOP_N = Number(process.env.INSIGHTS_VENDOR_TOP_N ?? 50);
// How many new vendors each WEEKLY run appends (walking down the rankings).
export const VENDOR_WEEKLY_ADDS = Number(process.env.INSIGHTS_VENDOR_WEEKLY_ADDS ?? 50);
// Refresh cadence: ranks <= this refresh every weekly run; deeper vendors
// rotate so each is refreshed at least every VENDOR_ROTATION_WEEKS weeks.
export const VENDOR_REFRESH_TOP = Number(process.env.INSIGHTS_VENDOR_REFRESH_TOP ?? 100);
export const VENDOR_ROTATION_WEEKS = Number(process.env.INSIGHTS_VENDOR_ROTATION_WEEKS ?? 4);

// ---- Load / save ----------------------------------------------------------
export function loadRoster() {
  if (!existsSync(ROSTER_PATH)) return { version: 1, vendors: {} };
  return JSON.parse(readFileSync(ROSTER_PATH, 'utf8'));
}

export function rosterExists() {
  return existsSync(ROSTER_PATH);
}

export async function saveRoster(roster) {
  const sorted = Object.fromEntries(Object.entries(roster.vendors).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(ROSTER_PATH, JSON.stringify({ version: roster.version ?? 1, vendors: sorted }, null, 2), 'utf8');
}

export function rosterEntries(roster) {
  return Object.entries(roster.vendors).map(([slug, vendor]) => ({ slug, ...vendor }));
}

export function vendorPageExists(slug) {
  return existsSync(path.join(VENDOR_PAGE_DIR, `${slug}.json`));
}

// ---- Name handling --------------------------------------------------------
// Trailing legal-suffix tokens stripped from slugs and display names. Matched
// repeatedly, so "X HOLDINGS CORP LLC" strips both.
const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'lllp', 'llp', 'lp', 'ltd', 'limited', 'plc', 'pc',
  'corp', 'corporation', 'co', 'company', 'companies', 'jv',
]);
const SMALL_WORDS = new Set(['of', 'and', 'the', 'for', 'de', 'du', 'da']);

function coreTokens(name) {
  let tokens = String(name)
    .replace(/&/g, ' and ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1].toLowerCase())) tokens.pop();
  if (tokens.length > 1 && tokens[0].toLowerCase() === 'the') tokens.shift();
  return tokens.length ? tokens : String(name).trim().split(/\s+/);
}

export function slugifyVendor(name) {
  const slug = coreTokens(name).join('-').toLowerCase().replace(/-+/g, '-');
  return slug || 'vendor';
}

// "LOCKHEED MARTIN CORPORATION" -> "Lockheed Martin". Heuristic title-case:
// digit-bearing tokens (L3HARRIS) and short vowel-less tokens (KBR, BWX) stay
// verbatim; small words lowercase. displayName is stored in the roster so a
// human can hand-fix the tail cases once, permanently.
export function displayNameFor(name) {
  const words = coreTokens(name).map((tok, i) => {
    if (/\d/.test(tok)) return tok;
    if (tok.length <= 3 && !/[aeiouy]/i.test(tok)) return tok.toUpperCase();
    const lower = tok.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
  return words.join(' ') || String(name);
}

const normName = (name) => coreTokens(name).join(' ').toUpperCase();

// ---- Roster expansion -----------------------------------------------------
/**
 * Ensure the roster covers the current top of the contractor rankings.
 * `fetchPage(page)` returns one spending_by_category recipient_duns response
 * (100 rows/page, cached per ISO week) — injected by the caller so this module
 * stays network-free. Append-only; existing entries only get their `rank` and
 * `recipientId` refreshed (never name/displayName/slug).
 */
export async function ensureRoster({ fetchPage, asOfDate, targetSize = null, log = console.log }) {
  const roster = loadRoster();
  const vendors = roster.vendors;
  const size = () => Object.keys(vendors).length;
  const pending = rosterEntries(roster).filter((e) => e.status === 'pending').length;

  let target = targetSize;
  if (target === null) {
    // Weekly growth, self-throttled: while the pending backlog is still deep
    // (the daily publisher hasn't caught up), don't add more.
    target = size() === 0 ? VENDOR_TOP_N : pending >= VENDOR_WEEKLY_ADDS ? size() : size() + VENDOR_WEEKLY_ADDS;
  }

  const byUei = new Map(rosterEntries(roster).filter((e) => e.uei).map((e) => [e.uei, e.slug]));
  const maxPages = Math.ceil(target / 100) + 5;
  let rank = 0;
  let added = 0;

  for (let page = 1; page <= maxPages && size() < target; page += 1) {
    const resp = await fetchPage(page);
    const rows = resp?.results ?? [];
    if (rows.length === 0) break;
    for (const r of rows) {
      rank += 1;
      const uei = r.uei ?? null;
      if (!uei) continue;
      const amount = Number.parseFloat(r.amount) || 0;
      const existingSlug = byUei.get(uei);
      if (existingSlug) {
        vendors[existingSlug].rank = rank;
        if (r.recipient_id) vendors[existingSlug].recipientId = r.recipient_id;
        continue;
      }
      // Below the thin-content hard floor already at the ranking row: this
      // vendor's page would be skipped anyway — never let it into the roster.
      // This is also the natural stop for the weekly walk down the rankings.
      if (amount < GUARDRAILS.thin.hardObligations) continue;
      if (size() >= target) continue;
      const slug = slugifyVendor(r.name ?? uei);
      // Same company, different registration (large primes carry several UEIs
      // under one corporate name — Lockheed, Boeing, Raytheon all do). One
      // page per company name: the highest-ranked registration represents it;
      // later same-name registrations are skipped, never suffixed into
      // near-duplicate pages. Logged for hand review.
      if (vendors[slug]) {
        log(`[roster] duplicate name at rank ${rank}: "${r.name}" (${uei}) — already covered by "${slug}", skipping`);
        continue;
      }
      vendors[slug] = {
        name: r.name ?? uei,
        displayName: displayNameFor(r.name ?? uei),
        recipientId: r.recipient_id ?? null,
        uei,
        duns: r.code ?? null,
        rank,
        status: 'pending',
        addedOn: asOfDate,
      };
      byUei.set(uei, slug);
      added += 1;
    }
    if (rows.length < 100) break;
  }

  await saveRoster(roster);
  log(`[roster] ${size()} vendors (${added} added, ${rosterEntries(roster).filter((e) => e.status === 'pending').length} pending)`);
  return roster;
}

// ---- Refresh rotation -----------------------------------------------------
// Which roster entries the WEEKLY run should process. Unpublished pending
// entries are always due (they consume the new-page budget); published pages
// refresh weekly in the top ranks and on a rotation below that, so the weekly
// run's wall-clock stays bounded as the roster grows. Skipped entries retry on
// the same rotation (their data can grow past the floor).
function slugHash(slug) {
  let h = 0;
  for (const ch of String(slug)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function vendorDueForRefresh({ slug, vendor, asOfDate }) {
  const published = vendorPageExists(slug);
  const weekNum = Number.parseInt(isoWeekString(new Date(`${asOfDate}T00:00:00Z`)).slice(-2), 10) || 0;
  const onRotation = slugHash(slug) % VENDOR_ROTATION_WEEKS === weekNum % VENDOR_ROTATION_WEEKS;
  if (!published) return vendor.status === 'skipped' ? onRotation : true;
  if ((vendor.rank ?? Infinity) <= VENDOR_REFRESH_TOP) return true;
  return onRotation;
}

// ---- Cross-link resolution ------------------------------------------------
/**
 * Internal vendor-profile href for a recipient seen anywhere in the data
 * (ranking rows, award rows). Match precedence: UEI, then recipient hash id
 * (exact, then base uuid ignoring the -C/-P/-R level suffix), then normalized
 * name. Only links vendors whose page has actually been PUBLISHED — a roster
 * entry alone may still be waiting in the daily backlog, and linking it would
 * 404. Callers fall back to the external usaspending.gov recipient link.
 */
export function vendorEntryForRecipient(roster, { uei = null, recipientId = null, name = null } = {}) {
  const entries = rosterEntries(roster).filter((e) => e.status === 'published');
  if (entries.length === 0) return null;
  if (uei) {
    const hit = entries.find((e) => e.uei === uei);
    if (hit) return hit;
  }
  if (recipientId) {
    const exact = entries.find((e) => e.recipientId === recipientId);
    if (exact) return exact;
    const base = String(recipientId).replace(/-[CPR]$/, '');
    const level = entries.find((e) => e.recipientId && e.recipientId.replace(/-[CPR]$/, '') === base);
    if (level) return level;
  }
  if (name) {
    const norm = normName(name);
    const hit = entries.find((e) => normName(e.name) === norm);
    if (hit) return hit;
  }
  return null;
}

export function vendorHrefForRecipient(roster, recipient) {
  const entry = vendorEntryForRecipient(roster, recipient);
  return entry ? vendorHref(entry.slug) : null;
}

// Same-cluster related links: rank neighbors around this vendor, so #1 links
// #2-#7 and #30 links its own weight class, not always the same six giants.
export function relatedVendorLinks(roster, slug, limit = 6) {
  const entries = rosterEntries(roster)
    .filter((e) => e.status === 'published' && e.slug !== slug)
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  const selfRank = roster.vendors[slug]?.rank ?? Infinity;
  const idx = entries.findIndex((e) => (e.rank ?? Infinity) >= selfRank);
  const anchor = idx === -1 ? Math.max(0, entries.length - limit) : Math.max(0, Math.min(idx - Math.floor(limit / 2), entries.length - limit));
  return entries.slice(anchor, anchor + limit).map((e) => ({
    label: `${e.displayName} federal contracts`,
    href: vendorHref(e.slug),
  }));
}
