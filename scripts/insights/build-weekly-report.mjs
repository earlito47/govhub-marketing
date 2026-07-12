#!/usr/bin/env node
// Stage 5 of the weekly pipeline (spec 6.5 / 7.4): four dated, immutable report
// pages per run under src/data/insights/reports/<year>-w<week>/. Reports capture
// the trailing 7-day action-date window ("newly reported" activity) and link
// back into the evergreen agency/state/NAICS pages — the internal-link flywheel.
//
// Immutability: this only ever writes the CURRENT week's four reports. Past
// weeks (different week keys) are never touched, so the archive is an honest,
// append-only record.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { UsaSpendingClient, CONTRACT_AWARD_TYPE_CODES } from './lib/usaspending.mjs';
import { formatUsdCompact, isoWeekString } from './lib/format.mjs';
import {
  AGENCY_SLUGS,
  agencyHref,
  STATES,
  STATE_SLUGS,
  stateHref,
  PILOT_NAICS_CODES,
  naicsHref,
} from './lib/slugs.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const REPORTS_DIR = path.join(REPO_ROOT, 'src/data/insights/reports');
const SOURCES = [{ label: 'USAspending.gov award data', href: 'https://www.usaspending.gov' }];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// code (e.g. "VA") -> state slug, for linking report rows to state pages.
const STATE_CODE_TO_SLUG = Object.fromEntries(STATE_SLUGS.map((s) => [STATES[s].code, s]));

function isoDaysAgo(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function weekLabel(startIso, endIso) {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  const sm = s.getUTCMonth();
  const em = e.getUTCMonth();
  const sd = s.getUTCDate();
  const ed = e.getUTCDate();
  const ey = e.getUTCFullYear();
  return sm === em ? `${MONTHS[sm]} ${sd}–${ed}, ${ey}` : `${MONTHS[sm]} ${sd} – ${MONTHS[em]} ${ed}, ${ey}`;
}

function weekWindow(asOfDate) {
  const start = isoDaysAgo(asOfDate, 6); // inclusive 7-day window
  const key = isoWeekString(new Date(`${asOfDate}T00:00:00Z`)).toLowerCase();
  return { start, end: asOfDate, key, label: weekLabel(start, asOfDate) };
}

function weekFilter(win) {
  return {
    award_type_codes: CONTRACT_AWARD_TYPE_CODES,
    time_period: [{ start_date: win.start, end_date: win.end, date_type: 'action_date' }],
  };
}

function parseAmount(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

// Shared page assembly so every report conforms to the InsightsPage schema and
// clears the validator's number-verification (spec 6.4).
function reportPage({ win, slug, title, h1, metaDescription, chart, table, intro, sections, faq, related, headlineStat }) {
  return {
    pageType: 'report',
    slug,
    week: win.key,
    publishedDate: win.end,
    title,
    h1,
    metaDescription: metaDescription.slice(0, 158),
    updated: win.end,
    fyWindow: { label: `Week of ${win.label}`, start: win.start, end: win.end },
    stats: { totalObligations: headlineStat, awardCount: null, yoyGrowthPct: null, avgAwardSize: null, smallBusinessSharePct: null },
    charts: [chart],
    tables: [table],
    narrative: { intro, sections: sections ?? [] },
    faq: faq ?? [],
    related: related ?? [],
    sources: SOURCES,
  };
}

// ---- Report builders ------------------------------------------------------
function buildTopAgencies(win, resp) {
  const rows = (resp?.results ?? []).map((r) => ({
    name: r.name ?? 'Unknown',
    slug: AGENCY_SLUGS.includes(r.agency_slug) ? r.agency_slug : null,
    amount: parseAmount(r.amount),
  }));
  const combined = rows.reduce((a, r) => a + r.amount, 0);
  const top = rows[0];
  const chart = {
    id: `${win.key}-top-agencies`,
    type: 'bar',
    title: `Top agencies by newly reported obligations, week of ${win.label}`,
    series: [{ label: 'Obligations', points: rows.map((r) => [r.name, r.amount]) }],
    unit: 'usd',
    takeaway: top ? `${top.name} led all agencies with ${formatUsdCompact(top.amount)} in newly reported contract obligations.` : null,
  };
  const table = {
    title: `Top agencies, week of ${win.label}`,
    columns: ['Rank', 'Agency', 'Obligations'],
    rows: rows.map((r, i) => [i + 1, { text: r.name, href: r.slug ? agencyHref(r.slug) : null }, r.amount]),
  };
  const intro = top
    ? `In the week of ${win.label}, ${top.name} led all federal agencies with ${formatUsdCompact(
        top.amount
      )} in newly reported contract obligations. The ten most active agencies obligated ${formatUsdCompact(combined)} combined.`
    : `No agency obligations were reported in the week of ${win.label}.`;
  const related = rows.filter((r) => r.slug).slice(0, 6).map((r) => ({ label: r.name, href: agencyHref(r.slug) }));
  const faq = top
    ? [{ q: `Which federal agency reported the most contract obligations the week of ${win.label}?`, a: `${top.name}, with ${formatUsdCompact(top.amount)} in newly reported contract obligations.` }]
    : [];
  return reportPage({
    win,
    slug: 'top-agencies',
    title: `Top Federal Agencies This Week — ${win.label}`,
    h1: `Top agencies by newly reported contract obligations — week of ${win.label}`,
    metaDescription: `The federal agencies with the most newly reported contract obligations the week of ${win.label}, led by ${top?.name ?? 'n/a'}.`,
    chart,
    table,
    intro,
    faq,
    related,
    headlineStat: combined,
  });
}

function buildStateMovers(win, resp) {
  const rows = (resp?.results ?? []).map((r) => {
    const slug = STATE_CODE_TO_SLUG[r.code] ?? null;
    return { name: r.name ?? r.code, slug, amount: parseAmount(r.amount) };
  });
  const combined = rows.reduce((a, r) => a + r.amount, 0);
  const top = rows[0];
  const chart = {
    id: `${win.key}-state-movers`,
    type: 'bar',
    title: `Top states by newly reported obligations, week of ${win.label}`,
    series: [{ label: 'Obligations', points: rows.map((r) => [r.name, r.amount]) }],
    unit: 'usd',
    takeaway: top ? `${top.name} saw the most newly reported federal contract activity, with ${formatUsdCompact(top.amount)} obligated.` : null,
  };
  const table = {
    title: `Top states, week of ${win.label}`,
    columns: ['Rank', 'State', 'Obligations'],
    rows: rows.map((r, i) => [i + 1, { text: r.name, href: r.slug ? stateHref(r.slug) : null }, r.amount]),
  };
  const intro = top
    ? `Contractors performing work in ${top.name} saw the most newly reported federal obligations the week of ${win.label} — ${formatUsdCompact(
        top.amount
      )}. The top ten states accounted for ${formatUsdCompact(combined)} combined.`
    : `No state obligations were reported in the week of ${win.label}.`;
  const related = rows.filter((r) => r.slug).slice(0, 6).map((r) => ({ label: `${r.name} federal contracts`, href: stateHref(r.slug) }));
  const faq = top
    ? [{ q: `Which state saw the most federal contract activity the week of ${win.label}?`, a: `${top.name}, with ${formatUsdCompact(top.amount)} in newly reported obligations.` }]
    : [];
  return reportPage({
    win,
    slug: 'state-movers',
    title: `Top States This Week — ${win.label}`,
    h1: `Top states by newly reported federal obligations — week of ${win.label}`,
    metaDescription: `The states with the most newly reported federal contract obligations the week of ${win.label}, led by ${top?.name ?? 'n/a'}.`,
    chart,
    table,
    intro,
    faq,
    related,
    headlineStat: combined,
  });
}

function buildMostActiveNaics(win, resp) {
  const rows = (resp?.results ?? []).map((r) => {
    const code = r.code ?? null;
    const slug = code && PILOT_NAICS_CODES.includes(code) ? code : null;
    return { name: r.name ?? code ?? 'Unknown', code, slug, amount: parseAmount(r.amount) };
  });
  const combined = rows.reduce((a, r) => a + r.amount, 0);
  const top = rows[0];
  const chart = {
    id: `${win.key}-most-active-naics`,
    type: 'bar',
    title: `Most active industries (NAICS) by obligations, week of ${win.label}`,
    series: [{ label: 'Obligations', points: rows.map((r) => [r.name, r.amount]) }],
    unit: 'usd',
    takeaway: top ? `${top.name} was the most active market, with ${formatUsdCompact(top.amount)} in newly reported obligations.` : null,
  };
  const table = {
    title: `Most active industries, week of ${win.label}`,
    columns: ['Rank', 'Industry (NAICS)', 'Obligations'],
    rows: rows.map((r, i) => [i + 1, { text: r.code ? `${r.name} (${r.code})` : r.name, href: r.slug ? naicsHref(r.slug) : null }, r.amount]),
  };
  const intro = top
    ? `${top.name} was the most active federal contract market the week of ${win.label}, with ${formatUsdCompact(
        top.amount
      )} in newly reported obligations. The ten most active industries obligated ${formatUsdCompact(combined)} combined.`
    : `No industry obligations were reported in the week of ${win.label}.`;
  const related = rows.filter((r) => r.slug).slice(0, 6).map((r) => ({ label: `NAICS ${r.code}: ${r.name}`, href: naicsHref(r.slug) }));
  return reportPage({
    win,
    slug: 'most-active-naics',
    title: `Most Active Federal Markets This Week — ${win.label}`,
    h1: `Most active federal contract markets — week of ${win.label}`,
    metaDescription: `The most active federal contract industries (by newly reported obligations) the week of ${win.label}, led by ${top?.name ?? 'n/a'}.`,
    chart,
    table,
    intro,
    related,
    headlineStat: combined,
  });
}

function buildLargestAwards(win, resp) {
  const results = resp?.results ?? [];
  const rows = results.map((r) => ({
    recipient: r['Recipient Name'] ?? 'Unknown',
    amount: parseAmount(r['Award Amount']),
    agency: r['Awarding Agency'] ?? null,
    internalId: r.generated_internal_id ?? null,
  }));
  const top = rows[0];
  // Chart: top 10 by total award value (a bar chart of the 25-row table's head).
  const chartRows = rows.slice(0, 10);
  const chart = {
    id: `${win.key}-largest-awards`,
    type: 'bar',
    title: `Largest awards with activity this week (total award value), week of ${win.label}`,
    series: [{ label: 'Award value', points: chartRows.map((r) => [r.recipient, r.amount]) }],
    unit: 'usd',
    takeaway: top ? `${top.recipient} held the largest award with reported activity this week, valued at ${formatUsdCompact(top.amount)} in total.` : null,
  };
  const table = {
    title: `Largest awards with activity, week of ${win.label}`,
    columns: ['Rank', 'Recipient', 'Total Award Value', 'Awarding Agency'],
    rows: rows.map((r, i) => [
      i + 1,
      { text: r.recipient, href: r.internalId ? `https://www.usaspending.gov/award/${r.internalId}/` : null },
      r.amount,
      r.agency,
    ]),
  };
  const intro = top
    ? `These are the federal awards with the largest total value that had new activity reported the week of ${win.label}. ${top.recipient} tops the list at ${formatUsdCompact(
        top.amount
      )} in total award value. Total value reflects the full award, not a single week's obligation — a large figure often signals a modification to a long-running contract rather than new weekly spending.`
    : `No award activity was reported the week of ${win.label}.`;
  return reportPage({
    win,
    slug: 'largest-awards',
    title: `Largest Federal Awards This Week — ${win.label}`,
    h1: `Largest federal awards with activity — week of ${win.label}`,
    metaDescription: `The federal contract awards with the largest total value that had new activity reported the week of ${win.label}.`,
    chart,
    table,
    intro,
    headlineStat: top?.amount ?? 0,
  });
}

// ---- Orchestration --------------------------------------------------------
export async function buildWeeklyReports({ client, asOfDate }) {
  const win = weekWindow(asOfDate);
  const filters = weekFilter(win);

  const [agencies, states, naics, awards] = await Promise.all([
    client.spendingByCategory('awarding_agency', filters, { limit: 10 }),
    client.spendingByCategory('state_territory', filters, { limit: 10 }),
    client.spendingByCategory('naics', filters, { limit: 10 }),
    client.spendingByAward({
      filters,
      fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'generated_internal_id'],
      sort: 'Award Amount',
      order: 'desc',
      limit: 25,
    }),
  ]);

  const pages = [
    buildTopAgencies(win, agencies),
    buildLargestAwards(win, awards),
    buildMostActiveNaics(win, naics),
    buildStateMovers(win, states),
  ];

  const outDir = path.join(REPORTS_DIR, win.key);
  await mkdir(outDir, { recursive: true });
  for (const page of pages) {
    await writeFile(path.join(outDir, `${page.slug}.json`), JSON.stringify(page, null, 2), 'utf8');
  }
  return { week: win.key, label: win.label, count: pages.length };
}

async function main() {
  const asOfDate =
    process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : new Date().toISOString().slice(0, 10);
  const client = new UsaSpendingClient();
  console.log(`[weekly-report] Building reports for the week ending ${asOfDate} — network required`);
  const { week, label, count } = await buildWeeklyReports({ client, asOfDate });
  console.log(`[weekly-report] Wrote ${count} reports to reports/${week}/ (week of ${label}). ${client.requestCount} API requests.`);
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error('[weekly-report] FAILED — do not commit this run.');
    console.error(err);
    process.exit(1);
  });
}
