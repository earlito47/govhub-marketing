#!/usr/bin/env node
// Phase 1, step 1 entry point (build spec Section 15): fetch + compute for
// the three pilot NAICS pages only, fallback narratives only. No LLM stage,
// no validate.mjs, no weekly-report stage, no Astro templates — those are
// later steps. Mirrors the eventual run-weekly.mjs orchestrator shape:
// any stage failure aborts before anything is written to src/data/insights.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchPilotRawData } from './fetch-data.mjs';
import { computeNaicsPage } from './compute-stats.mjs';
import { PILOT_NAICS_CODES } from './lib/slugs.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../..');

async function main() {
  const asOfDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  console.log(`[run-pilot] Stage 1/2: fetch-data (asOf ${asOfDate})`);
  const { raw, requestCount } = await fetchPilotRawData({ asOfDate });
  console.log(`[run-pilot] fetch-data done — ${requestCount} API requests.`);

  console.log('[run-pilot] Stage 2/2: compute-stats');
  const outDir = path.join(repoRoot, 'src/data/insights/naics');
  await mkdir(outDir, { recursive: true });
  const pages = {};
  for (const code of PILOT_NAICS_CODES) {
    const page = computeNaicsPage({ naicsCode: code, raw: raw[code], updated: asOfDate });
    pages[code] = page;
    await writeFile(path.join(outDir, `${code}.json`), JSON.stringify(page, null, 2), 'utf8');
    console.log(`[run-pilot] wrote src/data/insights/naics/${code}.json`);
  }

  console.log('\n[run-pilot] === 541512 page JSON ===');
  console.log(JSON.stringify(pages['541512'], null, 2));
}

main().catch((err) => {
  console.error('[run-pilot] FAILED — src/data/insights left untouched for any file not already written above.');
  console.error(err);
  process.exit(1);
});
