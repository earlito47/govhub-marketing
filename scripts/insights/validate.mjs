#!/usr/bin/env node
// The commit gate (spec 6.4). Runs after compute-stats/run-entities and before
// anything is committed. Exits non-zero — blocking the weekly commit — if any
// page fails schema validation, any chart has < 2 points, any narrative cites a
// number that can't be traced to the page's own facts (the anti-hallucination
// guard, spec 6.3), or the run regresses against the committed baseline
// (obligations collapsing to zero, or total page count dropping > 5%).
//
//   node validate.mjs                 # validate src/data/insights
//   node validate.mjs --self-test     # prove the number guard blocks a poison fixture

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { findNumberViolations, narrativeText } from './lib/verify-numbers.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const DATA_DIR = path.join(REPO_ROOT, 'src/data/insights');

const CHART_TYPES = new Set(['line', 'bar']);
const PAGE_TYPES = new Set(['naics', 'agency', 'state', 'ranking', 'report']);
// ---- Schema validation ----------------------------------------------------
function validateSchema(page, id) {
  const e = [];
  const str = (k, v, max) => {
    if (typeof v !== 'string' || v.length === 0) e.push(`${id}: ${k} must be a non-empty string`);
    else if (max && v.length > max) e.push(`${id}: ${k} is ${v.length} chars (max ${max})`);
  };
  str('title', page.title, 70);
  str('h1', page.h1);
  str('metaDescription', page.metaDescription, 170);
  str('slug', page.slug);
  str('updated', page.updated);
  if (!PAGE_TYPES.has(page.pageType)) e.push(`${id}: pageType "${page.pageType}" invalid`);
  if (!page.fyWindow?.label || !page.fyWindow?.start || !page.fyWindow?.end) e.push(`${id}: fyWindow incomplete`);

  const s = page.stats ?? {};
  if (typeof s.totalObligations !== 'number') e.push(`${id}: stats.totalObligations must be a number`);
  for (const k of ['awardCount', 'yoyGrowthPct', 'avgAwardSize', 'smallBusinessSharePct']) {
    if (s[k] !== null && typeof s[k] !== 'number') e.push(`${id}: stats.${k} must be number|null`);
  }

  if (!Array.isArray(page.charts) || page.charts.length === 0) e.push(`${id}: charts must be a non-empty array`);
  else
    for (const c of page.charts) {
      if (!CHART_TYPES.has(c.type)) e.push(`${id}: chart ${c.id} type "${c.type}" invalid`);
      const pts = c.series?.[0]?.points;
      if (!Array.isArray(pts) || pts.length < 2) e.push(`${id}: chart ${c.id} has < 2 data points`);
    }

  if (!Array.isArray(page.tables)) e.push(`${id}: tables must be an array`);
  if (typeof page.narrative?.intro !== 'string' || !page.narrative.intro) e.push(`${id}: narrative.intro missing`);
  if (!Array.isArray(page.narrative?.sections)) e.push(`${id}: narrative.sections must be an array`);
  if (!Array.isArray(page.faq)) e.push(`${id}: faq must be an array`);
  if (!Array.isArray(page.sources) || page.sources.length === 0) e.push(`${id}: sources must be a non-empty array`);
  return e;
}

// ---- Regression vs the committed baseline ---------------------------------
function gitShow(relPath) {
  try {
    return execFileSync('git', ['show', `HEAD:${relPath}`], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return null;
  }
}

function committedPageCount() {
  try {
    const out = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', 'src/data/insights'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    return out.split('\n').filter((l) => l.endsWith('.json')).length;
  } catch {
    return null;
  }
}

function checkRegression(pageFiles) {
  const errors = [];
  for (const abs of pageFiles) {
    const rel = path.relative(REPO_ROOT, abs);
    const baselineRaw = gitShow(rel);
    if (!baselineRaw) continue; // new page, no baseline
    let baseline;
    try {
      baseline = JSON.parse(baselineRaw);
    } catch {
      continue;
    }
    const cur = JSON.parse(readFileSync(abs, 'utf8'));
    if (baseline.stats?.totalObligations > 0 && !(cur.stats?.totalObligations > 0)) {
      errors.push(`${rel}: obligations dropped to ${cur.stats?.totalObligations} (was ${baseline.stats.totalObligations})`);
    }
  }
  const prev = committedPageCount();
  if (prev && prev > 0 && pageFiles.length < prev * 0.95) {
    errors.push(`page count ${pageFiles.length} is >5% below committed ${prev}`);
  }
  return errors;
}

// ---- Runner ---------------------------------------------------------------
function walkJson(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkJson(p));
    // meta.json is a pipeline metadata file, not an entity page — skip it.
    else if (name.endsWith('.json') && name !== 'meta.json') out.push(p);
  }
  return out;
}

function runSelfTest() {
  const validPage = {
    pageType: 'naics',
    slug: '000000',
    title: 'Self-test',
    h1: 'Self-test page',
    metaDescription: 'Self-test.',
    updated: '2026-07-12',
    fyWindow: { label: 'FY2026 to date', start: '2025-10-01', end: '2026-07-12' },
    stats: { totalObligations: 10_000_000_000, awardCount: 4110, yoyGrowthPct: -31, avgAwardSize: 1_726_107, smallBusinessSharePct: null },
    charts: [{ id: '000000-trend', type: 'line', unit: 'usd', series: [{ label: 'Obligations', points: [['FY25', 14_500_000_000], ['FY26', 10_000_000_000]] }] }],
    tables: [],
    narrative: {
      intro: 'Federal agencies obligated $10B across 4,110 contract awards. That is down 31.0% year over year. The average award size was $1.7M.',
      sections: [],
    },
    faq: [],
    sources: [{ label: 'x', href: 'y' }],
  };
  const clean = findNumberViolations(narrativeText(validPage), validPage);
  const poisoned = structuredClone(validPage);
  poisoned.narrative.intro = 'Federal agencies obligated $999B across 4,110 contract awards, a 250% surge.';
  const dirty = findNumberViolations(narrativeText(poisoned), poisoned);

  const okClean = clean.length === 0;
  const okPoison = dirty.length > 0;
  console.log(`[self-test] clean page violations: ${clean.length} (expect 0) — ${okClean ? 'PASS' : 'FAIL'}`);
  console.log(`[self-test] poisoned page violations: ${dirty.length} (expect > 0) — ${okPoison ? 'PASS' : 'FAIL'}`);
  if (dirty.length) console.log(`[self-test] poison correctly flagged: ${dirty.join('; ')}`);
  if (!okClean || !okPoison) {
    console.error('[self-test] FAILED — the number guard is not behaving correctly.');
    process.exit(1);
  }
  console.log('[self-test] PASS — the gate blocks fabricated numbers and passes verified ones.');
}

function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }

  const files = walkJson(DATA_DIR);
  if (files.length === 0) {
    console.error('[validate] no page JSON found under src/data/insights — nothing to validate.');
    process.exit(1);
  }

  const errors = [];
  for (const abs of files) {
    const id = path.relative(DATA_DIR, abs).replace('.json', '');
    let page;
    try {
      page = JSON.parse(readFileSync(abs, 'utf8'));
    } catch (err) {
      errors.push(`${id}: invalid JSON — ${err.message}`);
      continue;
    }
    errors.push(...validateSchema(page, id));
    errors.push(...findNumberViolations(narrativeText(page), page).map((v) => `${id}: ${v}`));
  }
  errors.push(...checkRegression(files));

  const byType = files.reduce((acc, f) => {
    const kind = path.basename(path.dirname(f));
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[validate] ${files.length} pages (${Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(', ')})`);

  if (errors.length) {
    console.error(`[validate] FAILED — ${errors.length} issue(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log('[validate] OK — schema, chart, number-verification, and regression checks all passed.');
}

main();
