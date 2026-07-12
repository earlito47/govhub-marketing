#!/usr/bin/env node
// Stage 2 of the Insights pipeline (Section 6.2). Pure transforms only — no
// network calls here, ever. Turns the raw USAspending responses fetch-data.mjs
// produced into the page-data JSON contract every Astro template will read.
//
// Phase 1 / pilot scope: NAICS entity pages only, fallback (LLM-free)
// narratives only. generate-narratives.mjs, validate.mjs and the Astro
// templates are later steps and are intentionally not touched here.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fallbackNaicsNarrative } from './lib/fallback-narrative.mjs';
import { fiscalYearLabel, formatUsdCompact } from './lib/format.mjs';
import { naicsHref, naicsTitle, relatedNaicsLinks } from './lib/slugs.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseAmount(value) {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// spending_by_category result rows carry the metric under `amount` in every
// published example of this endpoint; recipient/agency identity is under
// `name` with an optional `id`/`code` used for outbound linking.
function categoryRows(raw) {
  return (raw?.results ?? []).map((r) => ({
    name: r.name ?? r.recipient_name ?? r.agency_name ?? 'Unknown',
    id: r.id ?? r.recipient_id ?? r.code ?? null,
    amount: parseAmount(r.amount ?? r.aggregated_amount),
  }));
}

function trendPoints(raw) {
  const rows = (raw?.results ?? [])
    .map((r) => ({
      fy: Number.parseInt(r.time_period?.fiscal_year, 10),
      amount: parseAmount(r.aggregated_amount),
    }))
    .filter((r) => Number.isFinite(r.fy))
    .sort((a, b) => a.fy - b.fy);
  return rows;
}

export function computeNaicsPage({ naicsCode, raw, updated }) {
  const title = naicsTitle(naicsCode);
  const entityLabel = `NAICS ${naicsCode}`;
  const fyLabel = `${fiscalYearLabel(raw.currentFy)} to date`;

  const trend = trendPoints(raw.trend);
  const currentPoint = trend.find((r) => r.fy === raw.currentFy) ?? trend[trend.length - 1];
  const priorPoint = trend.find((r) => r.fy === raw.currentFy - 1);

  const totalObligations = currentPoint?.amount ?? 0;
  // Confidence: HIGH the response shape is { results: { contracts, ... } };
  // MEDIUM whether "contracts" alone captures our A/B/C/D filter set exactly
  // (vs. also needing to exclude IDV-derived rows) — verify on first live run.
  const awardCount = raw.awardCount?.results?.contracts ?? null;
  const yoyGrowthPct =
    priorPoint && priorPoint.amount > 0 ? round1(((totalObligations - priorPoint.amount) / priorPoint.amount) * 100) : null;
  const avgAwardSize = awardCount ? Math.round(totalObligations / awardCount) : null;

  const vendors = categoryRows(raw.topVendors);
  const agencies = categoryRows(raw.topAgencies);
  const topVendor = vendors[0]
    ? { ...vendors[0], sharePct: totalObligations > 0 ? round1((vendors[0].amount / totalObligations) * 100) : null }
    : null;
  const topAgency = agencies[0]
    ? { ...agencies[0], sharePct: totalObligations > 0 ? round1((agencies[0].amount / totalObligations) * 100) : null }
    : null;

  const narrative = fallbackNaicsNarrative({
    entityLabel: `${entityLabel} (${title})`,
    fyLabel,
    stats: { totalObligations, awardCount, yoyGrowthPct, avgAwardSize },
    topVendor,
    topAgency,
  });

  const faq = [
    { q: `How much does the federal government spend on ${entityLabel}?`, a: narrative.faqAnswers.howMuchSpend },
    topAgency && { q: `Which agencies buy the most ${entityLabel} services?`, a: narrative.faqAnswers.whichAgencies },
    topVendor && { q: `Who are the largest ${entityLabel} government contractors?`, a: narrative.faqAnswers.largestContractors },
    // "What share of NAICS X contracts goes to small businesses?" is deferred:
    // it needs the recipient_type_names filter, which is unverified against
    // live docs in this session and is dropped per Section 4.1's own rule
    // ("anything that can't be verified gets dropped rather than guessed").
  ].filter(Boolean);

  const largestAwardRows = (raw.largestAwards?.results ?? []).map((r, i) => {
    const internalId = r.generated_internal_id ?? null;
    return [
      i + 1,
      { text: r['Recipient Name'] ?? 'Unknown', href: internalId ? `https://www.usaspending.gov/award/${internalId}/` : null },
      parseAmount(r['Award Amount']),
      r['Awarding Agency'] ?? null,
    ];
  });

  const vendorRows = vendors.map((v, i) => [
    i + 1,
    { text: v.name, href: v.id ? `https://www.usaspending.gov/recipient/${v.id}/latest/` : null },
    v.amount,
  ]);

  return {
    pageType: 'naics',
    slug: naicsCode,
    title: `NAICS ${naicsCode}: ${title} Government Contracts — FY${raw.currentFy} Market Data`,
    h1: `NAICS ${naicsCode}: ${title} — Federal Contract Market`,
    metaDescription: `Federal agencies obligated ${
      formatUsdCompact(totalObligations) ?? 'contract dollars'
    } on ${title} (NAICS ${naicsCode}) in ${fyLabel}. See top vendors, top agencies, and trends.`.slice(0, 155),
    updated,
    fyWindow: { label: fyLabel, start: raw.currentFyRange.start, end: raw.asOfDate },
    stats: { totalObligations, awardCount, yoyGrowthPct, avgAwardSize, smallBusinessSharePct: null },
    charts: [
      {
        id: `${naicsCode}-trend`,
        type: 'line',
        title: 'Obligations by fiscal year',
        series: [{ label: 'Obligations', points: trend.map((r) => [`FY${String(r.fy).slice(-2)}`, round1(r.amount / 1e9)]) }],
        unit: '$B',
      },
      {
        id: `${naicsCode}-top-vendors`,
        type: 'bar',
        title: `Top 10 vendors, ${fyLabel}`,
        series: [{ label: 'Obligations', points: vendors.map((v) => [v.name, round1(v.amount / 1e9)]) }],
        unit: '$B',
      },
      {
        id: `${naicsCode}-top-agencies`,
        type: 'bar',
        title: `Top 10 buying agencies, ${fyLabel}`,
        series: [{ label: 'Obligations', points: agencies.map((a) => [a.name, round1(a.amount / 1e9)]) }],
        unit: '$B',
      },
    ],
    tables: [
      // "Awards" count per vendor is intentionally omitted: spending_by_category
      // returns an obligation amount per recipient but no award count, and this
      // pilot doesn't make the extra per-vendor call needed to compute one.
      { title: 'Top 10 vendors', columns: ['Rank', 'Vendor', 'Obligations'], rows: vendorRows },
      { title: `Largest awards, ${fyLabel}`, columns: ['Rank', 'Recipient', 'Award Amount', 'Awarding Agency'], rows: largestAwardRows },
    ],
    narrative: { intro: narrative.intro, sections: narrative.sections },
    faq,
    related: relatedNaicsLinks(naicsCode),
    sources: [{ label: 'USAspending.gov award data', href: 'https://www.usaspending.gov' }],
  };
}

// --- Synthetic self-test fixture -------------------------------------------
// Builds one NAICS page from made-up numbers to prove the transform's shape
// is correct, WITHOUT ever presenting those numbers as real spending data.
// This is the only way to exercise this code in a sandbox with no network
// access to api.usaspending.gov. Never written to src/data/insights.
function syntheticRawFixture(naicsCode, currentFy) {
  const fys = Array.from({ length: 6 }, (_, i) => currentFy - 5 + i);
  return {
    naicsCode,
    asOfDate: `${currentFy}-07-12`,
    currentFy,
    currentFyRange: { start: `${currentFy - 1}-10-01`, end: `${currentFy}-09-30` },
    trend: { results: fys.map((fy, i) => ({ time_period: { fiscal_year: String(fy) }, aggregated_amount: String(3e10 + i * 2e9) })) },
    topVendors: {
      results: [
        { name: 'SYNTHETIC Vendor A', id: 'synthetic-a', amount: '2100000000.00' },
        { name: 'SYNTHETIC Vendor B', id: 'synthetic-b', amount: '1400000000.00' },
      ],
    },
    topAgencies: {
      results: [
        { name: 'SYNTHETIC Department of Example', id: 'synthetic-dept', amount: '9800000000.00' },
      ],
    },
    largestAwards: {
      results: [
        {
          'Recipient Name': 'SYNTHETIC Vendor A',
          'Award Amount': '210000000.00',
          'Awarding Agency': 'SYNTHETIC Department of Example',
          generated_internal_id: 'SYNTH_ID_1',
        },
      ],
    },
    awardCount: { results: { contracts: 18234 } },
  };
}

function runSelfTest() {
  const currentFy = new Date().getUTCFullYear();
  const fixture = syntheticRawFixture('541512', currentFy);
  const page = computeNaicsPage({ naicsCode: '541512', raw: fixture, updated: fixture.asOfDate });
  console.log('=== SELF-TEST: schema demo only — every number below is fabricated, not real spending data ===');
  console.log(JSON.stringify(page, null, 2));
}

async function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }

  const { readFile, writeFile, mkdir } = await import('node:fs/promises');
  const repoRoot = path.resolve(path.dirname(__filename), '../..');
  const rawDir = path.join(repoRoot, '.cache/raw/naics');
  const outDir = path.join(repoRoot, 'src/data/insights/naics');
  await mkdir(outDir, { recursive: true });

  const { PILOT_NAICS_CODES } = await import('./lib/slugs.mjs');
  const updated = new Date().toISOString().slice(0, 10);
  for (const code of PILOT_NAICS_CODES) {
    const rawPath = path.join(rawDir, `${code}.json`);
    const raw = JSON.parse(await readFile(rawPath, 'utf8'));
    const page = computeNaicsPage({ naicsCode: code, raw, updated });
    await writeFile(path.join(outDir, `${code}.json`), JSON.stringify(page, null, 2), 'utf8');
    console.log(`[compute-stats] wrote src/data/insights/naics/${code}.json`);
  }
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error('[compute-stats] FAILED');
    console.error(err);
    process.exit(1);
  });
}
