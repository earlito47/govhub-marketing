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
import { fiscalYearLabel, formatPercent, formatUsdCompact, addMonths, formatMonthYear } from './lib/format.mjs';
import { relatedVendorLinks } from './lib/vendor-roster.mjs';
import {
  naicsHref,
  naicsTitle,
  relatedNaicsLinks,
  agencyName,
  agencyShort,
  agencyAbbr,
  relatedAgencyLinks,
  stateName,
  relatedStateLinks,
  setaside,
  relatedSetasideLinks,
} from './lib/slugs.mjs';
import { entityTitle, computeCrossLinks } from './lib/interlink.mjs';

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

export function computeNaicsPage({ naicsCode, raw, updated, recompeteRows = null }) {
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

  // One plain-text takeaway per chart (AEO requirement, spec Section 9.3):
  // AI crawlers can't read the SVG, so the citable fact lives in this sentence.
  const trendTakeaway =
    priorPoint && priorPoint.amount > 0 && yoyGrowthPct !== null
      ? `Obligations ${yoyGrowthPct >= 0 ? 'grew' : 'fell'} ${formatPercent(Math.abs(yoyGrowthPct))} year over year, from ${formatUsdCompact(
          priorPoint.amount
        )} in ${fiscalYearLabel(raw.currentFy - 1)} to ${formatUsdCompact(totalObligations)} in ${fyLabel}.`
      : totalObligations > 0
        ? `Federal agencies obligated ${formatUsdCompact(totalObligations)} on ${entityLabel} contracts in ${fyLabel}.`
        : null;
  const vendorTakeaway = topVendor
    ? `${topVendor.name} led all vendors with ${formatUsdCompact(topVendor.amount)} in obligations${
        topVendor.sharePct ? `, ${formatPercent(topVendor.sharePct)} of the market` : ''
      }.`
    : null;
  const agencyTakeaway = topAgency
    ? `${topAgency.name} was the top buyer, obligating ${formatUsdCompact(topAgency.amount)}${
        topAgency.sharePct ? ` (${formatPercent(topAgency.sharePct)} of all obligations)` : ''
      }.`
    : null;

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

  // Recompete table rows come pre-windowed on End Date from the caller
  // (run-weekly shares one recompete fetch across all markets); callers
  // without them — the selftest fixture, standalone reruns — just get the
  // page without this table.
  const expiringRows = (recompeteRows ?? []).map((r, i) => {
    const internalId = r.generated_internal_id ?? null;
    const recipientId = r.recipient_id ?? null;
    return [
      i + 1,
      { text: r['Award ID'] ?? 'View award', href: internalId ? `https://www.usaspending.gov/award/${internalId}/` : null },
      { text: r['Recipient Name'] ?? 'Unknown', href: recipientId ? `https://www.usaspending.gov/recipient/${recipientId}/latest/` : null },
      parseAmount(r['Award Amount']),
      r['Awarding Agency'] ?? null,
      r['End Date'] ?? null,
    ];
  });

  const charts = [
    {
      id: `${naicsCode}-trend`,
      type: 'line',
      title: 'Obligations by fiscal year',
      // points carry raw dollars; templates format via lib/format.mjs.
      series: [{ label: 'Obligations', points: trend.map((r) => [`FY${String(r.fy).slice(-2)}`, r.amount]) }],
      unit: 'usd',
      takeaway: trendTakeaway,
    },
    // Agencies before vendors so charts[1..] align 1:1 with the narrative
    // sections ([agencies, vendors]) the shared EntityDashboard interleaves.
    {
      id: `${naicsCode}-top-agencies`,
      type: 'bar',
      title: `Top 10 buying agencies, ${fyLabel}`,
      series: [{ label: 'Obligations', points: agencies.map((a) => [a.name, a.amount]) }],
      unit: 'usd',
      takeaway: agencyTakeaway,
    },
    {
      id: `${naicsCode}-top-vendors`,
      type: 'bar',
      title: `Top 10 vendors, ${fyLabel}`,
      series: [{ label: 'Obligations', points: vendors.map((v) => [v.name, v.amount]) }],
      unit: 'usd',
      takeaway: vendorTakeaway,
    },
  ];

  return {
    pageType: 'naics',
    slug: naicsCode,
    // Title varied by slug (see interlink.mjs) so the 25 NAICS pages don't all
    // share one shape; kept ≤60 chars with the headline number as a CTR asset.
    // The check-meta guard fails any <title> over 70 chars.
    title: entityTitle({ pageType: 'naics', slug: naicsCode, total$: formatUsdCompact(totalObligations) ?? 'FY Data', fy: fiscalYearLabel(raw.currentFy) }),
    h1: `${title} (NAICS ${naicsCode}): Federal Contract Market`,
    metaDescription: `Federal agencies obligated ${
      formatUsdCompact(totalObligations) ?? 'contract dollars'
    } on ${title} (NAICS ${naicsCode}) in ${fyLabel}. See top vendors, top agencies, and trends.`.slice(0, 155),
    updated,
    fyWindow: { label: fyLabel, start: raw.currentFyRange.start, end: raw.asOfDate },
    stats: { totalObligations, awardCount, yoyGrowthPct, avgAwardSize, smallBusinessSharePct: null },
    charts,
    crossLinks: computeCrossLinks({ pageType: 'naics', slug: naicsCode, charts }),
    tables: [
      // "Awards" count per vendor is intentionally omitted: spending_by_category
      // returns an obligation amount per recipient but no award count, and this
      // pilot doesn't make the extra per-vendor call needed to compute one.
      { title: 'Top 10 vendors', columns: ['Rank', 'Vendor', 'Obligations'], rows: vendorRows },
      { title: `Largest awards, ${fyLabel}`, columns: ['Rank', 'Recipient', 'Award Amount', 'Awarding Agency'], rows: largestAwardRows },
      ...(expiringRows.length
        ? [{
            title: 'Contracts expiring in the next 12 months',
            columns: ['Rank', 'Contract', 'Incumbent', 'Award Value', 'Awarding Agency', 'Ends'],
            rows: expiringRows,
          }]
        : []),
    ],
    narrative: { intro: narrative.intro, sections: narrative.sections },
    faq,
    related: [
      ...(expiringRows.length
        ? [{ label: 'Recompete watch: expiring federal contracts', href: '/insights/expiring-federal-contracts/' }]
        : []),
      ...relatedNaicsLinks(naicsCode),
    ],
    sources: [{ label: 'USAspending.gov award data', href: 'https://www.usaspending.gov' }],
  };
}

// --- Generic entity pages (agency, state) ----------------------------------
// Agency and state dashboards share Template A's shape but differ in dimension
// and copy. Everything below is built from the generic raw object fetch-data's
// fetchEntityRaw produces: { kind, slug, name, currentFy, currentFyRange,
// asOfDate, trend, cats:{<category>:resp}, largestAwards, awardCount }.
const SOURCES = [{ label: 'USAspending.gov award data', href: 'https://www.usaspending.gov' }];

function entityStats(raw) {
  const fyLabel = `${fiscalYearLabel(raw.currentFy)} to date`;
  const trend = trendPoints(raw.trend);
  const currentPoint = trend.find((r) => r.fy === raw.currentFy) ?? trend[trend.length - 1];
  const priorPoint = trend.find((r) => r.fy === raw.currentFy - 1);
  const totalObligations = currentPoint?.amount ?? 0;
  const awardCount = raw.awardCount?.results?.contracts ?? null;
  const yoyGrowthPct =
    priorPoint && priorPoint.amount > 0 ? round1(((totalObligations - priorPoint.amount) / priorPoint.amount) * 100) : null;
  const avgAwardSize = awardCount ? Math.round(totalObligations / awardCount) : null;
  return { fyLabel, trend, currentPoint, priorPoint, totalObligations, awardCount, yoyGrowthPct, avgAwardSize, currentFy: raw.currentFy };
}

// One dimension (a spending_by_category response) → rows + the top row's share.
function dimOf(raw, catKey, totalObligations) {
  const rows = categoryRows(raw.cats?.[catKey]);
  const top = rows[0]
    ? { ...rows[0], sharePct: totalObligations > 0 ? round1((rows[0].amount / totalObligations) * 100) : null }
    : null;
  return { rows, top };
}

function trendChart(slug, ctx, fallbackLead) {
  const takeaway =
    ctx.priorPoint && ctx.priorPoint.amount > 0 && ctx.yoyGrowthPct !== null
      ? `Obligations ${ctx.yoyGrowthPct >= 0 ? 'grew' : 'fell'} ${formatPercent(Math.abs(ctx.yoyGrowthPct))} year over year, from ${formatUsdCompact(
          ctx.priorPoint.amount
        )} in ${fiscalYearLabel(ctx.currentFy - 1)} to ${formatUsdCompact(ctx.totalObligations)} in ${ctx.fyLabel}.`
      : ctx.totalObligations > 0
        ? `${fallbackLead} ${formatUsdCompact(ctx.totalObligations)} in ${ctx.fyLabel}.`
        : null;
  return {
    id: `${slug}-trend`,
    type: 'line',
    title: 'Obligations by fiscal year',
    series: [{ label: 'Obligations', points: ctx.trend.map((r) => [`FY${String(r.fy).slice(-2)}`, r.amount]) }],
    unit: 'usd',
    takeaway,
  };
}

function barChart(id, title, dim, takeaway) {
  return {
    id,
    type: 'bar',
    title,
    series: [{ label: 'Obligations', points: dim.rows.map((r) => [r.name, r.amount]) }],
    unit: 'usd',
    takeaway,
  };
}

function vendorTable(dim) {
  const rows = dim.rows.map((v, i) => [
    i + 1,
    { text: v.name, href: v.id ? `https://www.usaspending.gov/recipient/${v.id}/latest/` : null },
    v.amount,
  ]);
  return { title: 'Top 10 vendors', columns: ['Rank', 'Vendor', 'Obligations'], rows };
}

function largestAwardsTable(raw, fyLabel, includeAgencyCol) {
  const rows = (raw.largestAwards?.results ?? []).map((r, i) => {
    const internalId = r.generated_internal_id ?? null;
    const row = [
      i + 1,
      { text: r['Recipient Name'] ?? 'Unknown', href: internalId ? `https://www.usaspending.gov/award/${internalId}/` : null },
      parseAmount(r['Award Amount']),
    ];
    if (includeAgencyCol) row.push(r['Awarding Agency'] ?? null);
    return row;
  });
  const columns = includeAgencyCol
    ? ['Rank', 'Recipient', 'Award Amount', 'Awarding Agency']
    : ['Rank', 'Recipient', 'Award Amount'];
  return { title: `Largest awards, ${fyLabel}`, columns, rows };
}

function buildIntro(lead, ctx) {
  const parts = [
    ctx.awardCount
      ? `${lead} ${formatUsdCompact(ctx.totalObligations)} across ${ctx.awardCount.toLocaleString('en-US')} contract awards.`
      : `${lead} ${formatUsdCompact(ctx.totalObligations)}.`,
  ];
  if (ctx.yoyGrowthPct !== null && ctx.yoyGrowthPct !== undefined) {
    parts.push(`That is ${ctx.yoyGrowthPct >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(ctx.yoyGrowthPct))} year over year.`);
  }
  if (ctx.avgAwardSize !== null && ctx.avgAwardSize !== undefined) {
    parts.push(`The average award size was ${formatUsdCompact(ctx.avgAwardSize)}.`);
  }
  return parts.join(' ');
}

export function computeAgencyPage({ slug, raw, updated }) {
  const name = agencyName(slug);
  const short = agencyShort(slug);
  const abbr = agencyAbbr(slug);
  const ctx = entityStats(raw);
  const total$ = formatUsdCompact(ctx.totalObligations);
  const naics = dimOf(raw, 'naics', ctx.totalObligations);
  const vendors = dimOf(raw, 'recipient_duns', ctx.totalObligations);

  const charts = [
    trendChart(slug, ctx, `${name} obligated`),
    barChart(
      `${slug}-top-naics`,
      `Top 10 categories (NAICS), ${ctx.fyLabel}`,
      naics,
      naics.top
        ? `${naics.top.name} was ${short}'s largest contract category, with ${formatUsdCompact(naics.top.amount)} obligated${
            naics.top.sharePct ? ` (${formatPercent(naics.top.sharePct)} of contract spending)` : ''
          }.`
        : null
    ),
    barChart(
      `${slug}-top-vendors`,
      `Top 10 vendors, ${ctx.fyLabel}`,
      vendors,
      vendors.top
        ? `${vendors.top.name} led all ${short} contractors with ${formatUsdCompact(vendors.top.amount)}${
            vendors.top.sharePct ? `, ${formatPercent(vendors.top.sharePct)} of obligations` : ''
          }.`
        : null
    ),
  ];

  const sections = [];
  if (naics.top) {
    sections.push({
      heading: `What does ${short} buy?`,
      body: `${naics.top.name} was ${name}'s largest contract category in ${ctx.fyLabel}, with ${formatUsdCompact(
        naics.top.amount
      )} obligated${naics.top.sharePct ? `, or ${formatPercent(naics.top.sharePct)} of its contract spending` : ''}.`,
    });
  }
  if (vendors.top) {
    sections.push({
      heading: `Who are ${short}'s largest contractors?`,
      body: `${vendors.top.name} led all ${name} contractors with ${formatUsdCompact(
        vendors.top.amount
      )} in obligations during ${ctx.fyLabel}${vendors.top.sharePct ? `, a ${formatPercent(vendors.top.sharePct)} share` : ''}.`,
    });
  }

  const awardsClause = ctx.awardCount ? `, across ${ctx.awardCount.toLocaleString('en-US')} awards` : '';
  const faq = [
    { q: `How much does ${name} spend on contracts?`, a: `${name} obligated ${total$} on federal contracts in ${ctx.fyLabel}${awardsClause}.` },
    naics.top && {
      q: `What does ${short} buy?`,
      a: `${short}'s largest contract category is ${naics.top.name}, with ${formatUsdCompact(naics.top.amount)} obligated in ${ctx.fyLabel}.`,
    },
    vendors.top && {
      q: `Who are ${short}'s largest contractors?`,
      a: `${vendors.top.name} is ${short}'s largest contractor by obligated dollars in ${ctx.fyLabel}, with ${formatUsdCompact(vendors.top.amount)}.`,
    },
  ].filter(Boolean);

  return {
    pageType: 'agency',
    slug,
    title: entityTitle({ pageType: 'agency', slug, total$: total$ ?? 'FY Data', fy: fiscalYearLabel(ctx.currentFy) }),
    h1: `${name}: Federal Contract Spending & Top Vendors`,
    metaDescription: `${name} obligated ${
      total$ ?? 'contract dollars'
    } in federal contracts in ${ctx.fyLabel}. See what it buys, its top vendors, and multi-year trend.`.slice(0, 158),
    updated,
    fyWindow: { label: ctx.fyLabel, start: raw.currentFyRange.start, end: raw.asOfDate },
    stats: {
      totalObligations: ctx.totalObligations,
      awardCount: ctx.awardCount,
      yoyGrowthPct: ctx.yoyGrowthPct,
      avgAwardSize: ctx.avgAwardSize,
      smallBusinessSharePct: null,
    },
    charts,
    crossLinks: computeCrossLinks({ pageType: 'agency', slug, charts }),
    tables: [vendorTable(vendors), largestAwardsTable(raw, ctx.fyLabel, false)],
    narrative: { intro: buildIntro(`In ${ctx.fyLabel}, ${name} obligated`, ctx), sections },
    faq,
    related: relatedAgencyLinks(slug),
    sources: SOURCES,
  };
}

export function computeStatePage({ slug, raw, updated }) {
  const name = stateName(slug);
  const ctx = entityStats(raw);
  const total$ = formatUsdCompact(ctx.totalObligations);
  const agencies = dimOf(raw, 'awarding_agency', ctx.totalObligations);
  const vendors = dimOf(raw, 'recipient_duns', ctx.totalObligations);
  const naics = dimOf(raw, 'naics', ctx.totalObligations);

  const charts = [
    trendChart(slug, ctx, `Federal agencies obligated`),
    barChart(
      `${slug}-top-agencies`,
      `Top 10 buying agencies, ${ctx.fyLabel}`,
      agencies,
      agencies.top
        ? `${agencies.top.name} was the top federal buyer in ${name}, obligating ${formatUsdCompact(agencies.top.amount)}${
            agencies.top.sharePct ? ` (${formatPercent(agencies.top.sharePct)} of the state total)` : ''
          }.`
        : null
    ),
    barChart(
      `${slug}-top-vendors`,
      `Top 10 vendors, ${ctx.fyLabel}`,
      vendors,
      vendors.top
        ? `${vendors.top.name} led all contractors in ${name} with ${formatUsdCompact(vendors.top.amount)}${
            vendors.top.sharePct ? `, ${formatPercent(vendors.top.sharePct)} of the state total` : ''
          }.`
        : null
    ),
    barChart(
      `${slug}-top-naics`,
      `Top 10 industries (NAICS), ${ctx.fyLabel}`,
      naics,
      naics.top ? `${naics.top.name} was the largest industry in ${name}, with ${formatUsdCompact(naics.top.amount)} obligated.` : null
    ),
  ];

  const sections = [];
  if (agencies.top) {
    sections.push({
      heading: `Which agencies award the most contracts in ${name}?`,
      body: `${agencies.top.name} was the largest federal buyer in ${name}, obligating ${formatUsdCompact(
        agencies.top.amount
      )} in ${ctx.fyLabel}${agencies.top.sharePct ? `, or ${formatPercent(agencies.top.sharePct)} of the state total` : ''}.`,
    });
  }
  if (vendors.top) {
    sections.push({
      heading: `Who are the top federal contractors in ${name}?`,
      body: `${vendors.top.name} led all contractors performing work in ${name} with ${formatUsdCompact(
        vendors.top.amount
      )} in obligations during ${ctx.fyLabel}.`,
    });
  }

  const awardsClause = ctx.awardCount ? `, across ${ctx.awardCount.toLocaleString('en-US')} awards` : '';
  const faq = [
    {
      q: `How much federal contract money goes to ${name}?`,
      a: `Federal agencies obligated ${total$} to contractors performing work in ${name} in ${ctx.fyLabel}${awardsClause}.`,
    },
    agencies.top && {
      q: `Which agencies award the most contracts in ${name}?`,
      a: `${agencies.top.name} is the largest federal buyer in ${name}, with ${formatUsdCompact(agencies.top.amount)} obligated in ${ctx.fyLabel}.`,
    },
    vendors.top && {
      q: `Who are the largest federal contractors in ${name}?`,
      a: `${vendors.top.name} is the largest federal contractor performing work in ${name} by obligated dollars in ${ctx.fyLabel}, with ${formatUsdCompact(
        vendors.top.amount
      )}.`,
    },
  ].filter(Boolean);

  return {
    pageType: 'state',
    slug,
    title: entityTitle({ pageType: 'state', slug, total$: total$ ?? 'FY Data', fy: fiscalYearLabel(ctx.currentFy) }),
    h1: `Federal Contracts in ${name}: Spending, Agencies & Vendors`,
    metaDescription: `Federal agencies obligated ${
      total$ ?? 'contract dollars'
    } to contractors in ${name} in ${ctx.fyLabel}. See top buying agencies, top vendors, and industries.`.slice(0, 158),
    updated,
    fyWindow: { label: ctx.fyLabel, start: raw.currentFyRange.start, end: raw.asOfDate },
    stats: {
      totalObligations: ctx.totalObligations,
      awardCount: ctx.awardCount,
      yoyGrowthPct: ctx.yoyGrowthPct,
      avgAwardSize: ctx.avgAwardSize,
      smallBusinessSharePct: null,
    },
    charts,
    crossLinks: computeCrossLinks({ pageType: 'state', slug, charts }),
    tables: [vendorTable(vendors), largestAwardsTable(raw, ctx.fyLabel, true)],
    narrative: { intro: buildIntro(`In ${ctx.fyLabel}, federal agencies obligated`, ctx), sections },
    faq,
    related: relatedStateLinks(slug),
    sources: SOURCES,
  };
}

export function computeSetasidePage({ slug, raw, updated }) {
  const meta = setaside(slug);
  const name = meta?.name ?? slug;
  const abbr = meta?.abbr ?? slug;
  const blurb = meta?.blurb ?? 'set-aside contracts';
  // Avoid redundant "HUBZone (HUBZone)" / "8(a) Business Development (8(a))".
  const fullName = abbr && abbr !== name && !name.includes(abbr) ? `${name} (${abbr})` : name;
  const ctx = entityStats(raw);
  const total$ = formatUsdCompact(ctx.totalObligations);
  const agencies = dimOf(raw, 'awarding_agency', ctx.totalObligations);
  const vendors = dimOf(raw, 'recipient_duns', ctx.totalObligations);
  const naics = dimOf(raw, 'naics', ctx.totalObligations);

  const charts = [
    trendChart(slug, ctx, `Federal agencies obligated`),
    barChart(
      `${slug}-top-agencies`,
      `Top 10 buying agencies, ${ctx.fyLabel}`,
      agencies,
      agencies.top
        ? `${agencies.top.name} awarded the most ${abbr} set-aside dollars, obligating ${formatUsdCompact(agencies.top.amount)}${
            agencies.top.sharePct ? ` (${formatPercent(agencies.top.sharePct)} of the program total)` : ''
          }.`
        : null
    ),
    barChart(
      `${slug}-top-vendors`,
      `Top 10 vendors, ${ctx.fyLabel}`,
      vendors,
      vendors.top
        ? `${vendors.top.name} led all ${abbr} set-aside contractors with ${formatUsdCompact(vendors.top.amount)}${
            vendors.top.sharePct ? `, ${formatPercent(vendors.top.sharePct)} of the program total` : ''
          }.`
        : null
    ),
    barChart(
      `${slug}-top-naics`,
      `Top 10 industries (NAICS), ${ctx.fyLabel}`,
      naics,
      naics.top ? `${naics.top.name} was the largest ${abbr} set-aside industry, with ${formatUsdCompact(naics.top.amount)} obligated.` : null
    ),
  ];

  const sections = [];
  if (agencies.top) {
    sections.push({
      heading: `Which agencies award the most ${abbr} set-aside contracts?`,
      body: `${agencies.top.name} awarded the most dollars through ${name} set-asides in ${ctx.fyLabel}, obligating ${formatUsdCompact(
        agencies.top.amount
      )}${agencies.top.sharePct ? `, or ${formatPercent(agencies.top.sharePct)} of the program total` : ''}.`,
    });
  }
  if (vendors.top) {
    sections.push({
      heading: `Who are the top ${abbr} set-aside contractors?`,
      body: `${vendors.top.name} led all ${name} set-aside contractors with ${formatUsdCompact(
        vendors.top.amount
      )} in obligations during ${ctx.fyLabel}${vendors.top.sharePct ? `, a ${formatPercent(vendors.top.sharePct)} share` : ''}.`,
    });
  }
  if (naics.top) {
    sections.push({
      heading: `What is bought through ${abbr} set-asides?`,
      body: `${naics.top.name} was the largest industry awarded under ${name} set-asides in ${ctx.fyLabel}, with ${formatUsdCompact(
        naics.top.amount
      )} obligated${naics.top.sharePct ? `, or ${formatPercent(naics.top.sharePct)} of the program total` : ''}.`,
    });
  }

  const awardsClause = ctx.awardCount ? `, across ${ctx.awardCount.toLocaleString('en-US')} awards` : '';
  const faq = [
    {
      q: `How much does the federal government award through ${abbr} set-asides?`,
      a: `Federal agencies obligated ${total$} through ${fullName} set-aside contracts in ${ctx.fyLabel}${awardsClause}.`,
    },
    agencies.top && {
      q: `Which agencies use ${abbr} set-asides the most?`,
      a: `${agencies.top.name} awarded the most ${abbr} set-aside dollars in ${ctx.fyLabel}, with ${formatUsdCompact(agencies.top.amount)} obligated.`,
    },
    vendors.top && {
      q: `Who are the largest ${abbr} set-aside contractors?`,
      a: `${vendors.top.name} is the largest ${name} set-aside contractor by obligated dollars in ${ctx.fyLabel}, with ${formatUsdCompact(
        vendors.top.amount
      )}.`,
    },
  ].filter(Boolean);

  return {
    pageType: 'setaside',
    slug,
    title: entityTitle({ pageType: 'setaside', slug, total$: total$ ?? 'FY Data', fy: fiscalYearLabel(ctx.currentFy) }),
    h1: `${name} Set-Aside Federal Contracts`,
    metaDescription: `Federal agencies obligated ${
      total$ ?? 'contract dollars'
    } through ${fullName} set-aside contracts in ${ctx.fyLabel} (${blurb}). See top agencies, vendors, and industries.`.slice(0, 158),
    updated,
    fyWindow: { label: ctx.fyLabel, start: raw.currentFyRange.start, end: raw.asOfDate },
    stats: {
      totalObligations: ctx.totalObligations,
      awardCount: ctx.awardCount,
      yoyGrowthPct: ctx.yoyGrowthPct,
      avgAwardSize: ctx.avgAwardSize,
      smallBusinessSharePct: null,
    },
    charts,
    crossLinks: computeCrossLinks({ pageType: 'setaside', slug, charts }),
    tables: [vendorTable(vendors), largestAwardsTable(raw, ctx.fyLabel, true)],
    narrative: { intro: buildIntro(`In ${ctx.fyLabel}, federal agencies obligated`, ctx), sections },
    faq,
    related: relatedSetasideLinks(slug),
    sources: SOURCES,
  };
}

// --- Vendor profile pages (spec Phase 3) ------------------------------------
// Same Template A dashboard as agency/state, plus two vendor-specific tables:
// contracts expiring in the next 12 months (the recompete tie-in) and
// registration details from the recipient profile endpoint. Raw shape comes
// from fetch-data's fetchVendorRaw.

// "corporate_entity_not_tax_exempt" -> "Corporate entity not tax exempt".
function humanizeBusinessType(code) {
  const s = String(code).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCaseCity(s) {
  return String(s)
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function computeVendorPage({ slug, vendor, roster, raw, updated }) {
  const display = vendor.displayName || vendor.name;
  const ctx = entityStats(raw);
  const total$ = formatUsdCompact(ctx.totalObligations);
  const agencies = dimOf(raw, 'awarding_agency', ctx.totalObligations);
  const naics = dimOf(raw, 'naics', ctx.totalObligations);

  // Category charts only render with >= 2 rows (the validator's per-chart
  // floor): a defense-prime registration often has literally ONE buying agency
  // or one market. The single-dominant-customer fact still ships — in the
  // narrative section, FAQ, and takeaway-free prose — just not as a 1-bar chart.
  const charts = [trendChart(slug, ctx, `${display} won`)];
  if (agencies.rows.length >= 2) {
    charts.push(
      barChart(
        `${slug}-top-agencies`,
        `Top 10 buying agencies, ${ctx.fyLabel}`,
        agencies,
        agencies.top
          ? `${agencies.top.name} is ${display}'s largest federal customer, with ${formatUsdCompact(agencies.top.amount)} obligated${
              agencies.top.sharePct ? ` (${formatPercent(agencies.top.sharePct)} of the company's federal obligations)` : ''
            }.`
          : null
      )
    );
  }
  if (naics.rows.length >= 2) {
    charts.push(
      barChart(
        `${slug}-top-naics`,
        `Top 10 markets (NAICS), ${ctx.fyLabel}`,
        naics,
        naics.top ? `${naics.top.name} is ${display}'s largest federal market, with ${formatUsdCompact(naics.top.amount)} in obligations.` : null
      )
    );
  }

  // Largest awards: link text is the award id (every recipient here is the
  // vendor itself), and the End Date fetch-data always requested is finally
  // surfaced. "Ends" (a date string column) never feeds number verification.
  const largestRows = (raw.largestAwards?.results ?? []).map((r, i) => {
    const internalId = r.generated_internal_id ?? null;
    return [
      i + 1,
      { text: r['Award ID'] ?? 'View award', href: internalId ? `https://www.usaspending.gov/award/${internalId}/` : null },
      parseAmount(r['Award Amount']),
      r['Awarding Agency'] ?? null,
      r['End Date'] ?? null,
    ];
  });

  // Recompete tie-in: End Date within the next 12 months, windowed here
  // client-side (the API cannot filter on end dates), largest first.
  const windowEnd = addMonths(raw.asOfDate, 12);
  const expiring = (raw.expiringAwards?.results ?? [])
    .map((r) => ({
      awardId: r['Award ID'] ?? null,
      amount: parseAmount(r['Award Amount']),
      agency: r['Awarding Agency'] ?? null,
      end: r['End Date'] ?? null,
      internalId: r.generated_internal_id ?? null,
    }))
    .filter((r) => r.end && r.end >= raw.asOfDate && r.end <= windowEnd && r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  const topExpiring = expiring[0] ?? null;

  const tables = [
    {
      title: `Largest awards, ${ctx.fyLabel}`,
      columns: ['Rank', 'Award', 'Award Amount', 'Awarding Agency', 'Ends'],
      rows: largestRows,
    },
  ];
  if (expiring.length) {
    tables.push({
      title: 'Contracts expiring in the next 12 months',
      columns: ['Award', 'Awarding Agency', 'Award Value', 'Ends'],
      rows: expiring.map((r) => [
        { text: r.awardId ?? 'View award', href: r.internalId ? `https://www.usaspending.gov/award/${r.internalId}/` : null },
        r.agency,
        r.amount,
        r.end,
      ]),
    });
  }

  // Registration facts from the recipient profile endpoint (may be null: the
  // page then simply ships without this table). Column names avoid the money
  // words so no cell is ever treated as a citable dollar figure.
  const p = raw.profile;
  if (p) {
    const hq = [p.location?.city_name ? titleCaseCity(p.location.city_name) : null, p.location?.state_code ?? null]
      .filter(Boolean)
      .join(', ');
    const regRows = [
      p.uei ? ['Unique Entity ID (UEI)', p.uei] : null,
      hq ? ['Headquarters', hq] : null,
      p.parent_name && p.parent_name !== p.name ? ['Parent company', p.parent_name] : null,
      Array.isArray(p.business_types) && p.business_types.length
        ? ['Business types', p.business_types.slice(0, 6).map(humanizeBusinessType).join('; ')]
        : null,
    ].filter(Boolean);
    if (regRows.length) tables.push({ title: 'Registration details', columns: ['Detail', 'Registration'], rows: regRows });
  }

  const sections = [];
  if (agencies.top) {
    sections.push({
      heading: `Which agencies buy from ${display}?`,
      body: `${agencies.top.name} accounted for ${formatUsdCompact(agencies.top.amount)} of ${display}'s federal contract obligations in ${
        ctx.fyLabel
      }${agencies.top.sharePct ? `, or ${formatPercent(agencies.top.sharePct)} of the company's federal work` : ''}.`,
    });
  }
  if (naics.top) {
    sections.push({
      heading: `What does ${display} sell to the government?`,
      body: `${naics.top.name} is ${display}'s largest federal market by obligations, at ${formatUsdCompact(naics.top.amount)} in ${ctx.fyLabel}${
        naics.top.sharePct ? `, a ${formatPercent(naics.top.sharePct)} share of its federal business` : ''
      }.`,
    });
  }

  const awardsClause = ctx.awardCount ? `, across ${ctx.awardCount.toLocaleString('en-US')} awards` : '';
  const faq = [
    {
      q: `How much does ${display} make from federal contracts?`,
      a: `${display} won ${total$} in federal contract obligations in ${ctx.fyLabel}${awardsClause}.`,
    },
    agencies.top && {
      q: `Which agencies buy from ${display}?`,
      a: `${agencies.top.name} is ${display}'s largest federal customer, with ${formatUsdCompact(agencies.top.amount)} obligated in ${ctx.fyLabel}.`,
    },
    naics.top && {
      q: `What does ${display} sell to the government?`,
      a: `${display}'s largest federal market is ${naics.top.name}, with ${formatUsdCompact(naics.top.amount)} in obligations in ${ctx.fyLabel}.`,
    },
    topExpiring
      ? {
          q: `Which ${display} contracts are expiring soon?`,
          a: `${display}'s largest contract expiring in the next 12 months is a ${formatUsdCompact(topExpiring.amount)} award from ${
            topExpiring.agency ?? 'a federal agency'
          }, with a period of performance ending in ${formatMonthYear(topExpiring.end)}.`,
        }
      : {
          q: `Which ${display} contracts are expiring soon?`,
          a: `None of ${display}'s largest federal contracts have a period of performance ending in the next 12 months, based on currently reported end dates.`,
        },
  ].filter(Boolean);

  // Title cascade: varied shape first, then progressively shorter forms so a
  // long company name can never push past the 70-char build guard.
  const fy = fiscalYearLabel(ctx.currentFy);
  let title = entityTitle({ pageType: 'vendor', slug, name: display, total$: total$ ?? 'FY Data', fy });
  if (!title || title.length > 68) title = `${display}: Federal Contracts ${fy}`;
  if (title.length > 70) {
    // Trim the name at a word boundary and drop a dangling connector so the
    // shortest form never reads "…Solutions of : Federal Contracts".
    const trimmed = display.slice(0, 50).replace(/\s+\S*$/, '').replace(/[\s,&-]+(of|and|the|for)$/i, '');
    title = `${trimmed}: Federal Contracts`;
  }

  return {
    pageType: 'vendor',
    slug,
    title,
    h1: `${display}: Federal Contracts, Agencies & Awards`,
    metaDescription: `${display} won ${
      total$ ?? 'federal contract dollars'
    } in federal contract obligations in ${ctx.fyLabel}. See its top agencies, markets, largest awards, and expiring contracts.`.slice(0, 158),
    updated,
    fyWindow: { label: ctx.fyLabel, start: raw.currentFyRange.start, end: raw.asOfDate },
    stats: {
      totalObligations: ctx.totalObligations,
      awardCount: ctx.awardCount,
      yoyGrowthPct: ctx.yoyGrowthPct,
      avgAwardSize: ctx.avgAwardSize,
      smallBusinessSharePct: null,
    },
    charts,
    crossLinks: computeCrossLinks({ pageType: 'vendor', slug, charts }),
    tables,
    narrative: { intro: buildIntro(`In ${ctx.fyLabel}, ${display} won`, ctx), sections },
    faq,
    related: [
      { label: 'Expiring federal contracts: recompete watch', href: '/insights/expiring-federal-contracts/' },
      ...relatedVendorLinks(roster, slug),
    ],
    sources: SOURCES,
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
