#!/usr/bin/env node
// Flagship ranking pages (Template B, spec 7.2 / Section 8). Evergreen, refreshed
// weekly: a ranked bar (top 10) + a full table (top 25–50) + narrative + FAQ, for
// the whole federal contract market. Rows deep-link into the evergreen
// agency/state/NAICS dashboards; flagships cross-link each other.
//
// fastest-growing-federal-markets is intentionally deferred: an honest YoY
// growth ranking needs a same-period (not partial-vs-full-year) comparison,
// which is a larger data change — see the roadmap.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { UsaSpendingClient, CONTRACT_AWARD_TYPE_CODES } from './lib/usaspending.mjs';
import { fiscalYearOf, fiscalYearRange, fiscalYearLabel, formatUsdCompact, formatPercent } from './lib/format.mjs';
import {
  AGENCY_SLUGS,
  agencyHref,
  STATES,
  STATE_SLUGS,
  stateHref,
  PILOT_NAICS_CODES,
  naicsHref,
  naicsTitle,
} from './lib/slugs.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const OUT_DIR = path.join(REPO_ROOT, 'src/data/insights/rankings');
const SOURCES = [{ label: 'USAspending.gov award data', href: 'https://www.usaspending.gov' }];
const STATE_CODE_TO_SLUG = Object.fromEntries(STATE_SLUGS.map((s) => [STATES[s].code, s]));

// The flagship cluster — used for cross-linking (related) on every flagship.
const FLAGSHIPS = [
  { slug: 'top-government-contractors', label: 'Top government contractors' },
  { slug: 'top-small-business-government-contractors', label: 'Top small-business contractors' },
  { slug: 'federal-spending-by-agency', label: 'Federal spending by agency' },
  { slug: 'federal-spending-by-state', label: 'Federal spending by state' },
  { slug: 'government-contracts-by-naics', label: 'Government contracts by NAICS' },
  { slug: 'largest-federal-contracts-fy2026', label: 'Largest federal contracts this year' },
  { slug: 'fastest-growing-federal-markets', label: 'Fastest-growing federal markets' },
];
const relatedFlagships = (self) => FLAGSHIPS.filter((f) => f.slug !== self).map((f) => ({ label: f.label, href: `/insights/${f.slug}/` }));

function parseAmount(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// The same calendar window one year earlier — Oct 1 (prior FY) through the same
// month/day as `asOfDate`, so growth is measured apples-to-apples rather than
// partial-year vs. full-year.
function priorSamePeriod(asOfDate, currentFy) {
  const start = fiscalYearRange(currentFy - 1).start;
  const d = new Date(`${asOfDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return { start, end: d.toISOString().slice(0, 10) };
}

function fyContext(asOfDate) {
  const currentFy = fiscalYearOf(asOfDate);
  const range = fiscalYearRange(currentFy);
  return {
    currentFy,
    fyLabel: `${fiscalYearLabel(currentFy)} to date`,
    filters: (extra = {}) => ({
      award_type_codes: CONTRACT_AWARD_TYPE_CODES,
      ...extra,
      time_period: [{ start_date: range.start, end_date: asOfDate }],
    }),
    window: { start: range.start, end: asOfDate },
  };
}

// Shared assembler so every flagship conforms to the InsightsPage schema and
// clears the validator's number-verification (spec 6.4). stats.totalObligations
// is the combined value of the shown rows, so an intro may cite that sum.
function rankingPage({ ctx, slug, title, h1, metaDescription, chart, table, intro, sections, faq, related, crossLinks, combined }) {
  return {
    pageType: 'ranking',
    slug,
    title,
    h1,
    metaDescription: metaDescription.slice(0, 158),
    updated: ctx.window.end,
    fyWindow: { label: ctx.fyLabel, start: ctx.window.start, end: ctx.window.end },
    stats: { totalObligations: combined, awardCount: null, yoyGrowthPct: null, avgAwardSize: null, smallBusinessSharePct: null },
    charts: [chart],
    tables: [table],
    narrative: { intro, sections: sections ?? [] },
    faq: faq ?? [],
    related: related ?? relatedFlagships(slug),
    // Optional "browse every entity" block: the ranking table only links the
    // rows that happen to be published pages, so a flagship can otherwise fail
    // to link most of its own cluster (the by-NAICS table linked 3 of 25).
    ...(crossLinks && crossLinks.length ? { crossLinks } : {}),
    sources: SOURCES,
  };
}

// Turn a spending_by_category response into {name, amount, href} rows.
function categoryRanking(resp, hrefFor) {
  return (resp?.results ?? []).map((r) => {
    const name = r.name ?? r.code ?? 'Unknown';
    return { name, code: r.code ?? null, recipientId: r.recipient_id ?? null, agencySlug: r.agency_slug ?? null, amount: parseAmount(r.amount), href: hrefFor(r) };
  });
}

function barFromRows(id, chartTitle, rows, takeaway, seriesLabel = 'Obligations') {
  return {
    id,
    type: 'bar',
    title: chartTitle,
    series: [{ label: seriesLabel, points: rows.slice(0, 10).map((r) => [r.name, r.amount]) }],
    unit: 'usd',
    takeaway,
  };
}

// ---- Builders -------------------------------------------------------------
function buildTopContractors(ctx, resp, { smallBiz }) {
  const slug = smallBiz ? 'top-small-business-government-contractors' : 'top-government-contractors';
  const noun = smallBiz ? 'small-business federal contractor' : 'federal contractor';
  const rows = categoryRanking(resp, (r) => (r.recipient_id ? `https://www.usaspending.gov/recipient/${r.recipient_id}/latest/` : null));
  const combined = rows.reduce((a, r) => a + r.amount, 0);
  const top = rows[0];
  const label = smallBiz ? 'Top small-business government contractors' : 'Top government contractors';
  const chart = barFromRows(
    `${slug}-bar`,
    `${label} by obligations, ${ctx.fyLabel}`,
    rows,
    top ? `${top.name} is the largest ${noun} in ${ctx.fyLabel}, with ${formatUsdCompact(top.amount)} in obligations.` : null
  );
  const table = {
    title: `${label}, ${ctx.fyLabel}`,
    columns: ['Rank', 'Contractor', 'Obligations'],
    rows: rows.map((r, i) => [i + 1, { text: r.name, href: r.href }, r.amount]),
  };
  const intro = top
    ? `${top.name} is the largest ${noun} by obligated dollars in ${ctx.fyLabel}, winning ${formatUsdCompact(
        top.amount
      )}. The ${rows.length} largest ${smallBiz ? 'small-business ' : ''}contractors were awarded ${formatUsdCompact(combined)} combined.`
    : `No ${noun} data is available for ${ctx.fyLabel}.`;
  const faq = top
    ? [
        { q: `Who is the largest ${noun} in ${fiscalYearLabel(ctx.currentFy)}?`, a: `${top.name}, with ${formatUsdCompact(top.amount)} in federal contract obligations in ${ctx.fyLabel}.` },
        { q: `How are these ${smallBiz ? 'small-business ' : ''}contractor rankings calculated?`, a: `By total federal contract obligations (award types A–D) in ${ctx.fyLabel}, from USAspending.gov${smallBiz ? ', filtered to recipients flagged as small businesses' : ''}. Vendor names use USAspending's recipient aggregation.` },
      ]
    : [];
  const meta = `The largest ${smallBiz ? 'small-business ' : ''}federal contractors by obligations in ${ctx.fyLabel}, led by ${top?.name ?? 'n/a'}. Ranked from USAspending.gov data.`;
  return rankingPage({
    ctx,
    slug,
    title: `${label}: ${fiscalYearLabel(ctx.currentFy)} Rankings`,
    h1: `${label}, ${ctx.fyLabel}`,
    metaDescription: meta,
    chart,
    table,
    intro,
    faq,
    combined,
  });
}

function buildByAgency(ctx, resp) {
  const rows = categoryRanking(resp, (r) => (AGENCY_SLUGS.includes(r.agency_slug) ? agencyHref(r.agency_slug) : null));
  const combined = rows.reduce((a, r) => a + r.amount, 0);
  const top = rows[0];
  const chart = barFromRows(
    'federal-spending-by-agency-bar',
    `Federal contract obligations by agency, ${ctx.fyLabel}`,
    rows,
    top ? `${top.name} obligated the most on contracts in ${ctx.fyLabel}, with ${formatUsdCompact(top.amount)}.` : null
  );
  const table = {
    title: `Federal contract spending by agency, ${ctx.fyLabel}`,
    columns: ['Rank', 'Agency', 'Obligations'],
    rows: rows.map((r, i) => [i + 1, { text: r.name, href: r.href }, r.amount]),
  };
  const intro = top
    ? `${top.name} obligated more on federal contracts than any other agency in ${ctx.fyLabel}, ${formatUsdCompact(
        top.amount
      )}. Across the top ${rows.length} agencies, ${formatUsdCompact(combined)} was obligated.`
    : `No agency spending data is available for ${ctx.fyLabel}.`;
  const faq = top
    ? [{ q: `Which federal agency spends the most on contracts?`, a: `${top.name}, with ${formatUsdCompact(top.amount)} in contract obligations in ${ctx.fyLabel}.` }]
    : [];
  return rankingPage({
    ctx,
    slug: 'federal-spending-by-agency',
    title: `Federal Spending by Agency, ${fiscalYearLabel(ctx.currentFy)}`,
    h1: `Federal contract spending by agency, ${ctx.fyLabel}`,
    metaDescription: `Which federal agencies spend the most on contracts in ${ctx.fyLabel}. Ranked by obligations from USAspending.gov, led by ${top?.name ?? 'n/a'}.`,
    chart,
    table,
    intro,
    faq,
    combined,
  });
}

function buildByState(ctx, resp) {
  const rows = categoryRanking(resp, (r) => {
    const s = STATE_CODE_TO_SLUG[r.code];
    return s ? stateHref(s) : null;
  });
  const combined = rows.reduce((a, r) => a + r.amount, 0);
  const top = rows[0];
  const chart = barFromRows(
    'federal-spending-by-state-bar',
    `Federal contract obligations by state, ${ctx.fyLabel}`,
    rows,
    top ? `${top.name} led all states with ${formatUsdCompact(top.amount)} in federal contract obligations.` : null
  );
  const table = {
    title: `Federal contract spending by state, ${ctx.fyLabel}`,
    columns: ['Rank', 'State', 'Obligations'],
    rows: rows.map((r, i) => [i + 1, { text: r.name, href: r.href }, r.amount]),
  };
  const intro = top
    ? `Contractors in ${top.name} were awarded more federal contract dollars than any other state in ${ctx.fyLabel}, ${formatUsdCompact(
        top.amount
      )}. The top ${rows.length} states accounted for ${formatUsdCompact(combined)} combined.`
    : `No state spending data is available for ${ctx.fyLabel}.`;
  const faq = top
    ? [{ q: `Which state gets the most federal contract money?`, a: `${top.name}, with ${formatUsdCompact(top.amount)} in federal contract obligations in ${ctx.fyLabel}.` }]
    : [];
  const page = rankingPage({
    ctx,
    slug: 'federal-spending-by-state',
    title: `Federal Spending by State, ${fiscalYearLabel(ctx.currentFy)}`,
    h1: `Federal contract spending by state, ${ctx.fyLabel}`,
    metaDescription: `Which states receive the most federal contract dollars in ${ctx.fyLabel}. Ranked by obligations from USAspending.gov, led by ${top?.name ?? 'n/a'}.`,
    chart,
    table,
    intro,
    faq,
    combined,
  });
  // Full state list (code + name + value) drives the choropleth map.
  page.mapData = (resp?.results ?? [])
    .filter((r) => r.code)
    .map((r) => ({ code: r.code, name: r.name ?? r.code, value: parseAmount(r.amount) }));
  return page;
}

function buildByNaics(ctx, resp) {
  const rows = categoryRanking(resp, (r) => (r.code && PILOT_NAICS_CODES.includes(r.code) ? naicsHref(r.code) : null));
  const combined = rows.reduce((a, r) => a + r.amount, 0);
  const top = rows[0];
  const chart = barFromRows(
    'government-contracts-by-naics-bar',
    `Largest federal contract markets by NAICS, ${ctx.fyLabel}`,
    rows,
    top ? `${top.name} was the largest federal contract market in ${ctx.fyLabel}, with ${formatUsdCompact(top.amount)} obligated.` : null
  );
  const table = {
    title: `Federal contract obligations by NAICS, ${ctx.fyLabel}`,
    columns: ['Rank', 'Industry (NAICS)', 'Obligations'],
    rows: rows.map((r, i) => [i + 1, { text: r.code ? `${r.name} (${r.code})` : r.name, href: r.href }, r.amount]),
  };
  const intro = top
    ? `The largest federal contract markets by industry (NAICS) in ${ctx.fyLabel}, led by ${top.name} at ${formatUsdCompact(
        top.amount
      )}. The top ${rows.length} industries account for ${formatUsdCompact(combined)} in obligations. Explore any market for its top vendors, buying agencies, and multi-year trend.`
    : `No NAICS data is available for ${ctx.fyLabel}.`;
  const faq = top
    ? [{ q: `What are the biggest federal contracting industries?`, a: `By obligations in ${ctx.fyLabel}, ${top.name} leads with ${formatUsdCompact(top.amount)}. Rankings use NAICS industry codes from USAspending.gov.` }]
    : [];
  // Deep-link every NAICS dashboard that exists as a "browse all" block: the
  // ranking table only links the top rows that are published pages, so without
  // this most of the 25 industry pages get no link from their own flagship.
  const naicsLinks = PILOT_NAICS_CODES.map((c) => ({ label: `NAICS ${c}: ${naicsTitle(c)}`, href: naicsHref(c) }));
  return rankingPage({
    ctx,
    slug: 'government-contracts-by-naics',
    title: `Government Contracts by NAICS, ${fiscalYearLabel(ctx.currentFy)}`,
    h1: `Government contracts by NAICS code, ${ctx.fyLabel}`,
    metaDescription: `The largest federal contract markets by NAICS industry code in ${ctx.fyLabel}, from USAspending.gov. Led by ${top?.name ?? 'n/a'}.`,
    chart,
    table,
    intro,
    faq,
    combined,
    related: relatedFlagships('government-contracts-by-naics'),
    crossLinks: naicsLinks,
  });
}

function buildLargestContracts(ctx, resp) {
  const rows = (resp?.results ?? []).map((r) => ({
    recipient: r['Recipient Name'] ?? 'Unknown',
    amount: parseAmount(r['Award Amount']),
    agency: r['Awarding Agency'] ?? null,
    internalId: r.generated_internal_id ?? null,
  }));
  const top = rows[0];
  const chart = barFromRows(
    'largest-federal-contracts-fy2026-bar',
    `Largest federal contracts by total value, ${ctx.fyLabel}`,
    rows.map((r) => ({ name: r.recipient, amount: r.amount })),
    top ? `${top.recipient} holds the largest federal contract by total value active in ${ctx.fyLabel}, at ${formatUsdCompact(top.amount)}.` : null,
    'Award value'
  );
  const table = {
    title: `Largest federal contracts, ${ctx.fyLabel}`,
    columns: ['Rank', 'Recipient', 'Total Award Value', 'Awarding Agency'],
    rows: rows.map((r, i) => [
      i + 1,
      { text: r.recipient, href: r.internalId ? `https://www.usaspending.gov/award/${r.internalId}/` : null },
      r.amount,
      r.agency,
    ]),
  };
  const intro = top
    ? `The federal contracts with the largest total value active in ${ctx.fyLabel}, led by ${top.recipient} at ${formatUsdCompact(
        top.amount
      )}. Total award value reflects the full contract, not a single year's obligation, the largest awards are typically long-running, multi-year vehicles.`
    : `No award data is available for ${ctx.fyLabel}.`;
  const faq = top
    ? [{ q: `What is the largest federal contract in ${fiscalYearLabel(ctx.currentFy)}?`, a: `By total award value, ${top.recipient}'s award (${formatUsdCompact(top.amount)}) awarded by ${top.agency ?? 'a federal agency'}.` }]
    : [];
  return rankingPage({
    ctx,
    slug: 'largest-federal-contracts-fy2026',
    title: `Largest Federal Contracts, ${fiscalYearLabel(ctx.currentFy)}`,
    h1: `Largest federal contracts by total value, ${ctx.fyLabel}`,
    metaDescription: `The federal contracts with the largest total award value active in ${ctx.fyLabel}, from USAspending.gov. Led by ${top?.recipient ?? 'n/a'}.`,
    chart,
    table,
    intro,
    faq,
    combined: top?.amount ?? 0,
  });
}

function buildFastestGrowing(ctx, currentResp, priorResp) {
  const MIN = 100e6; // floor in BOTH periods so a small base can't distort growth
  const priorMap = new Map((priorResp?.results ?? []).map((r) => [r.code, parseAmount(r.amount)]));
  const rows = (currentResp?.results ?? [])
    .map((r) => {
      const cur = parseAmount(r.amount);
      const prior = priorMap.get(r.code) ?? 0;
      return {
        name: r.name ?? r.code ?? 'Unknown',
        code: r.code ?? null,
        cur,
        prior,
        growth: prior > 0 ? round1(((cur - prior) / prior) * 100) : null,
        href: r.code && PILOT_NAICS_CODES.includes(r.code) ? naicsHref(r.code) : null,
      };
    })
    .filter((r) => r.growth !== null && r.cur >= MIN && r.prior >= MIN)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 25);
  const top = rows[0];
  const combined = rows.reduce((a, r) => a + r.cur, 0);

  const chart = {
    id: 'fastest-growing-federal-markets-bar',
    type: 'bar',
    title: `Fastest-growing federal markets (year-over-year, same period), ${ctx.fyLabel}`,
    series: [{ label: 'Year-over-year growth', points: rows.slice(0, 10).map((r) => [r.name, r.growth]) }],
    unit: 'pct',
    takeaway: top
      ? `${top.name} was the fastest-growing established federal market, up ${formatPercent(top.growth)} versus the same period a year earlier.`
      : null,
  };
  const table = {
    title: `Fastest-growing federal markets, ${ctx.fyLabel}`,
    columns: ['Rank', 'Industry (NAICS)', 'FY2026 obligations', 'Prior-year obligations', 'Growth'],
    rows: rows.map((r, i) => [
      i + 1,
      { text: r.code ? `${r.name} (${r.code})` : r.name, href: r.href },
      r.cur,
      r.prior,
      formatPercent(r.growth, { signed: true }),
    ]),
  };
  const intro = top
    ? `These are the fastest-growing established federal contract markets, comparing ${ctx.fyLabel} against the same calendar window a year earlier, an apples-to-apples measure that avoids the partial-vs-full-year distortion. ${top.name} leads, up ${formatPercent(
        top.growth
      )} year over year, from ${formatUsdCompact(top.prior)} to ${formatUsdCompact(
        top.cur
      )}. Rankings cover established industries with at least 100 million dollars of obligations in both periods, so a small base can't inflate the growth rate.`
    : `Not enough same-period data is available to rank market growth for ${ctx.fyLabel}.`;
  const faq = top
    ? [
        {
          q: `What are the fastest-growing federal contract markets?`,
          a: `By same-period year-over-year growth, ${top.name} leads, up ${formatPercent(top.growth)} versus a year earlier, from ${formatUsdCompact(
            top.prior
          )} to ${formatUsdCompact(top.cur)}.`,
        },
        {
          q: `How is market growth measured here?`,
          a: `Each market's ${ctx.fyLabel} obligations are compared to the same calendar window one fiscal year earlier, not the full prior year, among industries with at least 100 million dollars of obligations in both periods.`,
        },
      ]
    : [];
  return rankingPage({
    ctx,
    slug: 'fastest-growing-federal-markets',
    title: `Fastest-Growing Federal Markets, ${fiscalYearLabel(ctx.currentFy)}`,
    h1: `Fastest-growing federal contract markets, ${ctx.fyLabel}`,
    metaDescription: `The fastest-growing federal contract markets by same-period year-over-year growth in ${ctx.fyLabel}, from USAspending.gov. Led by ${
      top?.name ?? 'n/a'
    }.`,
    chart,
    table,
    intro,
    faq,
    combined,
  });
}

// ---- Orchestration --------------------------------------------------------
export async function buildRankings({ client, asOfDate }) {
  const ctx = fyContext(asOfDate);
  const AWARD_FIELDS = ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'generated_internal_id'];
  const prior = priorSamePeriod(asOfDate, ctx.currentFy);
  const priorFilters = { award_type_codes: CONTRACT_AWARD_TYPE_CODES, time_period: [{ start_date: prior.start, end_date: prior.end }] };

  const [contractors, smallBiz, agencies, states, naics, awards, growthCurrent, growthPrior] = await Promise.all([
    client.spendingByCategory('recipient_duns', ctx.filters(), { limit: 50 }),
    client.spendingByCategory('recipient_duns', ctx.filters({ recipient_type_names: ['small_business'] }), { limit: 50 }),
    client.spendingByCategory('awarding_agency', ctx.filters(), { limit: 25 }),
    client.spendingByCategory('state_territory', ctx.filters(), { limit: 51 }),
    client.spendingByCategory('naics', ctx.filters(), { limit: 30 }),
    client.spendingByAward({ filters: ctx.filters(), fields: AWARD_FIELDS, sort: 'Award Amount', order: 'desc', limit: 50 }),
    // Growth ranking: current top-75 NAICS vs. the same period a year earlier
    // (100 is the API's max page size, wide enough to match most current codes).
    client.spendingByCategory('naics', ctx.filters(), { limit: 75 }),
    client.spendingByCategory('naics', priorFilters, { limit: 100 }),
  ]);

  const pages = [
    buildTopContractors(ctx, contractors, { smallBiz: false }),
    buildTopContractors(ctx, smallBiz, { smallBiz: true }),
    buildByAgency(ctx, agencies),
    buildByState(ctx, states),
    buildByNaics(ctx, naics),
    buildLargestContracts(ctx, awards),
    buildFastestGrowing(ctx, growthCurrent, growthPrior),
  ];

  await mkdir(OUT_DIR, { recursive: true });
  for (const page of pages) await writeFile(path.join(OUT_DIR, `${page.slug}.json`), JSON.stringify(page, null, 2), 'utf8');
  return { count: pages.length, slugs: pages.map((p) => p.slug) };
}

async function main() {
  const asOfDate =
    process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : new Date().toISOString().slice(0, 10);
  const client = new UsaSpendingClient();
  console.log(`[rankings] Building flagship rankings as of ${asOfDate} — network required`);
  const { count, slugs } = await buildRankings({ client, asOfDate });
  console.log(`[rankings] Wrote ${count} flagship pages (${slugs.join(', ')}). ${client.requestCount} API requests.`);
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error('[rankings] FAILED — do not commit this run.');
    console.error(err);
    process.exit(1);
  });
}
