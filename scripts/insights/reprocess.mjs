#!/usr/bin/env node
// One-off, network-free transform that brings the already-committed Insights
// JSON up to the new standards WITHOUT a full USAspending re-fetch:
//   - de-templatized <title> (interlink.entityTitle), varied by slug
//   - NAICS h1 rebuilt without the em dash
//   - crossLinks[] mined from each page's own top-agency/top-industry data
//   - em-dash sweep across every string value (voice standard)
//
// It reads only data already in each file, so it is deterministic and matches
// what compute-stats.mjs now emits. Safe to re-run (idempotent).
//
// Usage: node scripts/insights/reprocess.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatUsdCompact } from './lib/format.mjs';
import { NAICS_TITLES } from './lib/slugs.mjs';
import { entityTitle, computeCrossLinks } from './lib/interlink.mjs';

const DATA = join(fileURLToPath(new URL('../../src/data/insights', import.meta.url)));
const ENTITY_DIRS = { state: 'state', naics: 'naics', agency: 'agency', setaside: 'setaside' };

// Voice standard: no em dashes anywhere in published copy. Replace with a comma
// (the safe default for these data narratives); collapse any doubled result.
function deDash(s) {
  return s
    .replace(/\s*—\s*/g, ', ')
    .replace(/,\s*,/g, ',');
}
function sweepStrings(v) {
  if (typeof v === 'string') return v.includes('—') ? deDash(v) : v;
  if (Array.isArray(v)) return v.map(sweepStrings);
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) v[k] = sweepStrings(v[k]);
    return v;
  }
  return v;
}

// Insert crossLinks right after charts so key order matches the generator and
// the next cron rebuild produces no spurious key-reorder diff.
function withCrossLinksAfterCharts(page, crossLinks) {
  const out = {};
  for (const [k, val] of Object.entries(page)) {
    if (k === 'crossLinks') continue; // drop any stale copy; re-add in order
    out[k] = val;
    if (k === 'charts') out.crossLinks = crossLinks;
  }
  if (!('crossLinks' in out)) out.crossLinks = crossLinks; // no charts key: append
  return out;
}

let changed = 0;
let filesTouched = 0;

function processFile(file, pageType) {
  const raw = readFileSync(file, 'utf8');
  let page = JSON.parse(raw);

  if (ENTITY_DIRS[pageType]) {
    const total$ = formatUsdCompact(page.stats?.totalObligations) || 'FY Data';
    const fy = (page.fyWindow?.label?.match(/FY\d{4}/) || [])[0] || 'FY Data';
    page.title = entityTitle({ pageType, slug: page.slug, total$, fy });
    if (pageType === 'naics') {
      const t = NAICS_TITLES[page.slug] ?? page.slug;
      page.h1 = `${t} (NAICS ${page.slug}): Federal Contract Market`;
    }
    page = withCrossLinksAfterCharts(page, computeCrossLinks(page));
  }

  page = sweepStrings(page);

  const next = JSON.stringify(page, null, 2) + '\n';
  if (next !== raw) {
    writeFileSync(file, next);
    filesTouched++;
  }
}

// Entity directories (title + crossLinks + sweep).
for (const [pageType, dir] of Object.entries(ENTITY_DIRS)) {
  const d = join(DATA, dir);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((n) => n.endsWith('.json'))) {
    processFile(join(d, f), pageType);
    changed++;
  }
}
// Ranking + report JSON: em-dash sweep only (no title/crossLinks change).
for (const rel of ['rankings']) {
  const d = join(DATA, rel);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((n) => n.endsWith('.json'))) processFile(join(d, f), 'ranking');
}
const reportsRoot = join(DATA, 'reports');
if (existsSync(reportsRoot)) {
  for (const wk of readdirSync(reportsRoot)) {
    const wd = join(reportsRoot, wk);
    if (!existsSync(wd)) continue;
    for (const f of readdirSync(wd).filter((n) => n.endsWith('.json'))) processFile(join(wd, f), 'report');
  }
}

console.log(`reprocess: ${changed} entity files considered, ${filesTouched} files rewritten.`);
