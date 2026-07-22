#!/usr/bin/env node
// Weekly pipeline orchestrator (spec Section 3). Regenerates every published
// entity dashboard — NAICS, agencies, states — through a single shared,
// rate-limited client, then writes meta.json. Validation (the commit gate) and
// the Astro build run as separate workflow steps, so a run that throws here —
// or fails validation/build downstream — never reaches `git commit`, and the
// site keeps serving last week's committed data.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { UsaSpendingClient } from './lib/usaspending.mjs';
import { fetchNaicsRaw } from './fetch-data.mjs';
import { computeNaicsPage } from './compute-stats.mjs';
import { generateEntities, publishEntity, countExistingEntities, newSummary, reportSummary } from './run-entities.mjs';
import { makeBudget } from './lib/guardrails.mjs';
import { buildRankings } from './build-rankings.mjs';
import { buildWeeklyReports } from './build-weekly-report.mjs';
import { enrichAll } from './generate-narratives.mjs';
import { PILOT_NAICS_CODES } from './lib/slugs.mjs';
import { fiscalYearOf, fiscalYearRange, fiscalYearLabel } from './lib/format.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const DATA_DIR = path.join(REPO_ROOT, 'src/data/insights');
const PIPELINE_VERSION = 1;

async function generateNaics({ client, asOfDate, budget, summary }) {
  for (const naicsCode of PILOT_NAICS_CODES) {
    const raw = await fetchNaicsRaw(client, { naicsCode, asOfDate });
    const page = computeNaicsPage({ naicsCode, raw, updated: asOfDate });
    // NAICS now runs through the same guardrails as agency/state/setaside
    // (thin skip, noindex, and the shared velocity throttle) instead of an
    // unconditional write.
    await publishEntity({ kind: 'naics', slug: naicsCode, page, budget, summary });
  }
}

function countPages(kind) {
  const dir = path.join(DATA_DIR, kind);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0;
}

async function main() {
  const asOfDate =
    process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : new Date().toISOString().slice(0, 10);
  const client = new UsaSpendingClient();
  const summary = newSummary();
  // One shared velocity budget for the whole run, so brand-new NAICS, agency,
  // state, and set-aside pages together stay under the per-run / %-growth cap.
  const budget = makeBudget({ existingTotal: countExistingEntities() });

  console.log(`[run-weekly] Refreshing all Insights data as of ${asOfDate} — network required (new-page budget: ${budget.allowance})`);
  await generateNaics({ client, asOfDate, budget, summary });
  await generateEntities({ client, asOfDate, budget, summary });

  // Flagship rankings — evergreen top-N pages, refreshed each week (spec 7.2).
  const rankings = await buildRankings({ client, asOfDate });
  console.log(`[ok]   rankings — ${rankings.count} flagship pages`);

  // Weekly reports — 4 dated, immutable pages for the current week (spec 6.5).
  const report = await buildWeeklyReports({ client, asOfDate });
  console.log(`[ok]   reports/${report.week} — ${report.count} reports (week of ${report.label})`);

  // LLM narrative enrichment (spec 6.3). No-op without OPENAI_API_KEY; every
  // result is number-verified or discarded, so validate.mjs stays authoritative.
  await enrichAll();

  // meta.json powers the audit trail and the honest "data through {date}" line
  // even on a skipped week (spec Sections 5, 14). Lives at the data-dir root, so
  // it is not picked up by the per-type page globs or the validator.
  const currentFy = fiscalYearOf(asOfDate);
  const fyRange = fiscalYearRange(currentFy);
  const counts = {
    naics: countPages('naics'),
    agency: countPages('agency'),
    state: countPages('state'),
    setaside: countPages('setaside'),
    rankings: countPages('rankings'),
  };
  const meta = {
    lastSuccessfulRun: asOfDate,
    fyWindow: { label: `${fiscalYearLabel(currentFy)} to date`, start: fyRange.start, end: asOfDate },
    pipelineVersion: PIPELINE_VERSION,
    counts: { ...counts, total: counts.naics + counts.agency + counts.state + counts.setaside + counts.rankings },
  };
  await writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  reportSummary('run-weekly', summary, budget, client);
}

main().catch((err) => {
  console.error("[run-weekly] FAILED — do not commit this run; the site keeps last week's data.");
  console.error(err);
  process.exit(1);
});
