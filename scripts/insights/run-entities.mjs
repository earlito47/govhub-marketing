#!/usr/bin/env node
// Fetch + compute + write agency and state entity pages (spec 7.1). Network
// lives in fetch-data.mjs; this only orchestrates and applies the thin-content
// thresholds (spec 9.6) so low-signal entities get listed but not published.
//
// Usage:
//   node run-entities.mjs [asOfDate] [only]
//     asOfDate  YYYY-MM-DD (default: today)
//     only      comma list of kind or kind:slug to restrict, e.g.
//               "agency:department-of-defense,state:virginia" or "state"

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { UsaSpendingClient } from './lib/usaspending.mjs';
import { fetchAgencyRaw, fetchStateRaw, fetchSetasideRaw, fetchVendorRaw, fetchTopRecipients } from './fetch-data.mjs';
import { computeAgencyPage, computeStatePage, computeSetasidePage, computeVendorPage } from './compute-stats.mjs';
import { formatUsdCompact } from './lib/format.mjs';
import { classifyEntity, makeBudget } from './lib/guardrails.mjs';
import { ensureRoster, loadRoster, rosterExists, saveRoster, vendorDueForRefresh, vendorPageExists } from './lib/vendor-roster.mjs';
import {
  AGENCY_SLUGS,
  agencyName,
  STATE_SLUGS,
  stateName,
  stateCode,
  SET_ASIDE_SLUGS,
  setaside,
} from './lib/slugs.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const ENTITY_KINDS = ['naics', 'agency', 'state', 'setaside', 'vendor'];

// Count entity pages already on disk, so the throttle budget scales with the
// current footprint and only brand-new slugs count against it.
export function countExistingEntities() {
  return ENTITY_KINDS.reduce((total, kind) => {
    const dir = path.join(REPO_ROOT, 'src/data/insights', kind);
    return total + (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0);
  }, 0);
}

// A summary with the guardrail buckets, so nothing is capped silently.
export function newSummary() {
  return { written: 0, skipped: [], deferred: [], noindexed: [], failed: [] };
}

// Shared publish step used by every entity type (agency/state/setaside here,
// NAICS in run-weekly): apply the scaled-content guardrails, then write.
// Returns the guardrail action taken ('index' | 'noindex' | 'skip' | 'defer')
// so roster-driven callers (vendor) can record the outcome.
export async function publishEntity({ kind, slug, page, budget, summary }) {
  const outDir = path.join(REPO_ROOT, 'src/data/insights', kind);
  const outFile = path.join(outDir, `${slug}.json`);
  const exists = existsSync(outFile);
  const { action, reason } = classifyEntity({ page, exists, budget, kind });

  if (action === 'skip') {
    summary.skipped.push(`${kind}/${slug} — ${reason}`);
    console.log(`[skip]  ${kind}/${slug} — ${reason}`);
    return action;
  }
  if (action === 'defer') {
    summary.deferred.push(`${kind}/${slug} — ${reason}`);
    console.log(`[defer] ${kind}/${slug} — ${reason}`);
    return action;
  }
  if (action === 'noindex') {
    page.noindex = true;
    summary.noindexed.push(`${kind}/${slug} — ${reason}`);
  }
  if (!exists && budget) budget.consumeNew();

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, JSON.stringify(page, null, 2), 'utf8');
  summary.written += 1;
  const tag = action === 'noindex' ? ' (noindex)' : exists ? '' : ' (new)';
  console.log(`[ok]    ${kind}/${slug} — ${formatUsdCompact(page.stats.totalObligations)}, ${page.stats.awardCount ?? '?'} awards${tag}`);
  return action;
}

// Publish one vendor from the roster and record the outcome on its entry.
// Shared by the weekly run (via generateEntities) and the daily publisher.
export async function publishVendor({ client, roster, slug, asOfDate, budget, summary }) {
  const vendor = roster.vendors[slug];
  try {
    const raw = await fetchVendorRaw(client, { slug, vendor, asOfDate });
    const page = computeVendorPage({ slug, vendor, roster, raw, updated: asOfDate });
    const action = await publishEntity({ kind: 'vendor', slug, page, budget, summary });
    if (action === 'index' || action === 'noindex') vendor.status = 'published';
    else if (action === 'skip') vendor.status = 'skipped';
    // 'defer' leaves the entry pending for the next (daily) run.
    return action;
  } catch (err) {
    // One unbuildable vendor must not take the batch down with it. Until now a
    // single failure threw all the way out of the runner, so the pages already
    // built earlier in the same run were discarded too, and a permanently
    // broken entry at the head of the queue blocked every subsequent day.
    const permanent = err?.permanent === true;
    const message = String(err?.message ?? err).slice(0, 300);
    if (permanent) {
      // Take it out of the pending queue: retrying tomorrow cannot help, and
      // leaving it pending is what made this a standing outage rather than a
      // one-day blip. `failed` entries need a human, not another attempt.
      vendor.status = 'failed';
      vendor.failedReason = message;
      vendor.failedOn = asOfDate;
    }
    // Transient failures keep `pending`, so the next run retries them.
    summary.failed.push({ slug, permanent, message });
    console.warn(
      `::warning::vendor/${slug} ${permanent ? 'cannot be built (permanent)' : 'failed (transient, will retry)'} — ${message}`
    );
    return 'failed';
  }
}

function parseOnly(arg) {
  if (!arg) return null;
  const kinds = new Set();
  const slugs = new Set();
  for (const tok of arg.split(',')) {
    const [kind, slug] = tok.split(':');
    if (slug) slugs.add(`${kind}:${slug}`);
    else kinds.add(kind);
  }
  return { kinds, slugs };
}

function wanted(only, kind, slug) {
  if (!only) return true;
  if (only.slugs.size > 0 && only.slugs.has(`${kind}:${slug}`)) return true;
  if (only.kinds.has(kind)) return true;
  return only.slugs.size === 0 && only.kinds.size === 0;
}

async function generate({ kind, slug, fetchFn, computeFn, asOfDate, budget, summary }) {
  const raw = await fetchFn();
  const page = computeFn({ slug, raw, updated: asOfDate });
  await publishEntity({ kind, slug, page, budget, summary });
}

// Generate agency + state pages with a shared (rate-limited) client. Reused by
// run-weekly.mjs so the whole weekly run stays under one politeness budget.
// `budget` throttles brand-new pages across the run (guardrails); when omitted
// (standalone filtered runs) new pages are not throttled.
export async function generateEntities({ client, asOfDate, only = null, budget = null, summary }) {
  for (const slug of AGENCY_SLUGS) {
    if (!wanted(only, 'agency', slug)) continue;
    await generate({
      kind: 'agency',
      slug,
      fetchFn: () => fetchAgencyRaw(client, { slug, name: agencyName(slug), asOfDate }),
      computeFn: computeAgencyPage,
      asOfDate,
      budget,
      summary,
    });
  }

  for (const slug of STATE_SLUGS) {
    if (!wanted(only, 'state', slug)) continue;
    await generate({
      kind: 'state',
      slug,
      fetchFn: () => fetchStateRaw(client, { slug, name: stateName(slug), code: stateCode(slug), asOfDate }),
      computeFn: computeStatePage,
      asOfDate,
      budget,
      summary,
    });
  }

  for (const slug of SET_ASIDE_SLUGS) {
    if (!wanted(only, 'setaside', slug)) continue;
    const meta = setaside(slug);
    await generate({
      kind: 'setaside',
      slug,
      fetchFn: () => fetchSetasideRaw(client, { slug, name: meta.name, codes: meta.codes, asOfDate }),
      computeFn: computeSetasidePage,
      asOfDate,
      budget,
      summary,
    });
  }

  // Vendor profiles: roster-driven (no static registry). The weekly run
  // expands the roster down the contractor rankings, publishes what the shared
  // budget allows (the daily workflow drains the rest of the backlog), and
  // refreshes published pages on the top-rank/rotation schedule so wall-clock
  // stays bounded as the roster grows.
  const vendorInScope = !only || only.kinds.has('vendor') || [...(only?.slugs ?? [])].some((s) => s.startsWith('vendor:'));
  if (vendorInScope) {
    // Roster expansion (walking down the rankings) happens only on the FULL
    // weekly run — or as a bootstrap when no roster exists yet. Filtered
    // ad-hoc runs must not grow the roster as a side effect.
    const roster =
      !only || !rosterExists()
        ? await ensureRoster({ fetchPage: (page) => fetchTopRecipients(client, { asOfDate, page }), asOfDate })
        : loadRoster();
    const bySlugRank = Object.entries(roster.vendors).sort(([, a], [, b]) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
    for (const [slug, vendor] of bySlugRank) {
      if (!wanted(only, 'vendor', slug)) continue;
      if (!vendorDueForRefresh({ slug, vendor, asOfDate })) continue;
      // Once the new-page budget is spent, a not-yet-published vendor would be
      // deferred anyway — record the defer WITHOUT spending ~7 API calls on it.
      // The daily publisher drains these through the week.
      if (!vendorPageExists(slug) && budget && !budget.canPublishNew()) {
        summary.deferred.push(`vendor/${slug} — throttled: new-page budget spent this run`);
        console.log(`[defer] vendor/${slug} — throttled: new-page budget spent this run`);
        continue;
      }
      await publishVendor({ client, roster, slug, asOfDate, budget, summary });
    }
    await saveRoster(roster);
  }
  return summary;
}

async function main() {
  const asOfDate = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : new Date().toISOString().slice(0, 10);
  const only = parseOnly(process.argv[3]);
  const client = new UsaSpendingClient();
  const summary = newSummary();
  const budget = makeBudget({ existingTotal: countExistingEntities() });

  console.log(`[run-entities] as of ${asOfDate}${only ? ` (filtered)` : ''} — network required (new-page budget: ${budget.allowance})`);
  await generateEntities({ client, asOfDate, only, budget, summary });

  reportSummary('run-entities', summary, budget, client);
}

// Print the guardrail buckets so a throttle/noindex is never silent.
export function reportSummary(label, summary, budget, client) {
  console.log(
    `\n[${label}] Done. ${summary.written} written, ${summary.noindexed.length} noindex, ${summary.deferred.length} deferred (throttle), ${summary.skipped.length} skipped (thin). ${client.requestCount} API requests.`
  );
  if (summary.noindexed.length) console.log(`[${label}] noindex (weak for search):\n  ${summary.noindexed.join('\n  ')}`);
  if (summary.deferred.length)
    console.log(`[${label}] deferred to a later run (velocity throttle, budget ${budget?.allowance ?? 'n/a'}):\n  ${summary.deferred.join('\n  ')}`);
  if (summary.skipped.length) console.log(`[${label}] skipped (below hard floor):\n  ${summary.skipped.join('\n  ')}`);
  if (summary.failed?.length) {
    const perm = summary.failed.filter((f) => f.permanent);
    const tmp = summary.failed.filter((f) => !f.permanent);
    if (perm.length)
      console.log(
        `[${label}] FAILED permanently (marked 'failed' in the roster, will not be retried — needs a human):\n  ${perm
          .map((f) => `vendor/${f.slug} — ${f.message}`)
          .join('\n  ')}`
      );
    if (tmp.length)
      console.log(
        `[${label}] failed transiently (left pending, next run retries):\n  ${tmp
          .map((f) => `vendor/${f.slug} — ${f.message}`)
          .join('\n  ')}`
      );
  }
}

// A batch where every single attempt failed transiently is an outage, not a
// set of bad vendors: committing a run like that would publish nothing while
// reporting success. Permanent failures are isolated bad data and do NOT trip
// this — the rest of the batch is still good.
export function assertBatchViable(label, { attempted, published, summary }) {
  if (attempted === 0) return;
  const transient = (summary.failed ?? []).filter((f) => !f.permanent).length;
  if (published === 0 && transient > 0) {
    throw new Error(
      `[${label}] all ${attempted} vendor(s) failed and ${transient} were transient — treating this as a USAspending outage rather than committing an empty run.`
    );
  }
}

// Only run as a CLI when invoked directly (not when imported by run-weekly).
if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error('[run-entities] FAILED — partial data may exist; do not commit a failed run.');
    console.error(err);
    process.exit(1);
  });
}
