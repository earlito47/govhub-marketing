#!/usr/bin/env node
// Daily vendor-profile publisher — drains the roster's pending backlog a few
// pages at a time so vendor pages spread across the week instead of landing in
// one burst (user decision, 2026-07-30: ~50 new vendor profiles per week,
// published throughout the week).
//
// Division of labor with the weekly run:
//   - The WEEKLY run (Mondays) expands the roster down the contractor
//     rankings, refreshes published pages, retries skipped entries on
//     rotation, and publishes Monday's batch of new pages.
//   - THIS script (daily, Tue-Sun via daily-vendor-publish.yml) only
//     publishes NEW pages from the pending backlog, up to the normal per-run
//     velocity budget (guardrails: max 8). It never refreshes existing pages
//     and never retries skips, so a quiet day is a no-op commit-wise.
//
// Cadence math: 7 batches/week x <=8 pages = up to 56/week, comfortably
// covering the +50/week roster expansion.
//
// Usage: node run-vendor-daily.mjs [asOfDate]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { UsaSpendingClient } from './lib/usaspending.mjs';
import { publishVendor, countExistingEntities, newSummary, reportSummary } from './run-entities.mjs';
import { makeBudget } from './lib/guardrails.mjs';
import { loadRoster, saveRoster, rosterEntries, vendorPageExists } from './lib/vendor-roster.mjs';
import { enrichAll } from './generate-narratives.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const DATA_DIR = path.join(REPO_ROOT, 'src/data/insights');

function countPages(kind) {
  const dir = path.join(DATA_DIR, kind);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0;
}

// Refresh meta.json page counts only. lastSuccessfulRun / fyWindow stay the
// weekly run's marker — a daily publish is additive, not a full data refresh.
async function updateMetaCounts() {
  const metaPath = path.join(DATA_DIR, 'meta.json');
  if (!existsSync(metaPath)) return;
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const counts = {
    naics: countPages('naics'),
    agency: countPages('agency'),
    state: countPages('state'),
    setaside: countPages('setaside'),
    vendor: countPages('vendor'),
    rankings: countPages('rankings'),
  };
  meta.counts = { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

async function main() {
  const asOfDate =
    process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : new Date().toISOString().slice(0, 10);
  const roster = loadRoster();
  const backlog = rosterEntries(roster)
    .filter((e) => e.status === 'pending' && !vendorPageExists(e.slug))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

  if (backlog.length === 0) {
    console.log('[run-vendor-daily] backlog empty — nothing to publish today.');
    return;
  }

  const client = new UsaSpendingClient();
  const summary = newSummary();
  const budget = makeBudget({ existingTotal: countExistingEntities() });
  console.log(`[run-vendor-daily] ${backlog.length} pending vendors, budget ${budget.allowance} — as of ${asOfDate}`);

  const publishedFiles = [];
  for (const entry of backlog) {
    if (!budget.canPublishNew()) break;
    const action = await publishVendor({ client, roster, slug: entry.slug, asOfDate, budget, summary });
    if (action === 'index' || action === 'noindex') {
      publishedFiles.push(path.join(DATA_DIR, 'vendor', `${entry.slug}.json`));
    }
  }
  await saveRoster(roster);

  // Enrich ONLY today's new pages — never rewrite narratives on pages whose
  // data did not change. Number-verified or discarded, same as the weekly run.
  if (publishedFiles.length) await enrichAll({ files: publishedFiles });

  await updateMetaCounts();
  reportSummary('run-vendor-daily', summary, budget, client);
}

main().catch((err) => {
  console.error('[run-vendor-daily] FAILED — do not commit this run.');
  console.error(err);
  process.exit(1);
});
