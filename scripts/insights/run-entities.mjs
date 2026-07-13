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
import { UsaSpendingClient } from './lib/usaspending.mjs';
import { fetchAgencyRaw, fetchStateRaw, fetchSetasideRaw } from './fetch-data.mjs';
import { computeAgencyPage, computeStatePage, computeSetasidePage } from './compute-stats.mjs';
import { formatUsdCompact } from './lib/format.mjs';
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

// Thin-content thresholds (spec 9.6): a dedicated page needs real volume.
function thresholdSkipReason(page) {
  const { totalObligations, awardCount } = page.stats;
  const trendPoints = page.charts.find((c) => c.id.endsWith('-trend'))?.series[0]?.points.length ?? 0;
  if (totalObligations < 50e6) return `below $50M (${formatUsdCompact(totalObligations)})`;
  if (awardCount !== null && awardCount < 100) return `below 100 awards (${awardCount})`;
  if (trendPoints < 3) return `under 3 years of trend (${trendPoints})`;
  return null;
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

async function generate({ kind, slug, fetchFn, computeFn, asOfDate, summary }) {
  const raw = await fetchFn();
  const page = computeFn({ slug, raw, updated: asOfDate });
  const skip = thresholdSkipReason(page);
  if (skip) {
    summary.skipped.push(`${kind}/${slug} — ${skip}`);
    console.log(`[skip] ${kind}/${slug} — ${skip}`);
    return;
  }
  const outDir = path.join(REPO_ROOT, 'src/data/insights', kind);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${slug}.json`), JSON.stringify(page, null, 2), 'utf8');
  summary.written += 1;
  console.log(`[ok]   ${kind}/${slug} — ${formatUsdCompact(page.stats.totalObligations)}, ${page.stats.awardCount ?? '?'} awards`);
}

// Generate agency + state pages with a shared (rate-limited) client. Reused by
// run-weekly.mjs so the whole weekly run stays under one politeness budget.
export async function generateEntities({ client, asOfDate, only = null, summary }) {
  for (const slug of AGENCY_SLUGS) {
    if (!wanted(only, 'agency', slug)) continue;
    await generate({
      kind: 'agency',
      slug,
      fetchFn: () => fetchAgencyRaw(client, { slug, name: agencyName(slug), asOfDate }),
      computeFn: computeAgencyPage,
      asOfDate,
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
      summary,
    });
  }
  return summary;
}

async function main() {
  const asOfDate = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : new Date().toISOString().slice(0, 10);
  const only = parseOnly(process.argv[3]);
  const client = new UsaSpendingClient();
  const summary = { written: 0, skipped: [] };

  console.log(`[run-entities] as of ${asOfDate}${only ? ` (filtered)` : ''} — network required`);
  await generateEntities({ client, asOfDate, only, summary });

  console.log(
    `\n[run-entities] Done. ${summary.written} pages written, ${summary.skipped.length} skipped, ${client.requestCount} API requests.`
  );
  if (summary.skipped.length) console.log(`[run-entities] Skipped:\n  ${summary.skipped.join('\n  ')}`);
}

// Only run as a CLI when invoked directly (not when imported by run-weekly).
if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error('[run-entities] FAILED — partial data may exist; do not commit a failed run.');
    console.error(err);
    process.exit(1);
  });
}
