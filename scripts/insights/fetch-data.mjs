#!/usr/bin/env node
// Stage 1 of the Insights pipeline (Section 6.1). Every network call lives
// here; compute-stats.mjs never touches the network. On any unrecoverable
// failure this throws — the caller (run-pilot.mjs, and later run-weekly.mjs)
// must catch that and exit non-zero *without* writing anything to
// src/data/insights, so a bad week never overwrites last week's published data.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACT_AWARD_TYPE_CODES, UsaSpendingClient } from './lib/usaspending.mjs';
import { cacheKey, readCache, writeCache } from './lib/cache.mjs';
import { fiscalYearOf, fiscalYearRange, isoWeekString } from './lib/format.mjs';
import { PILOT_NAICS_CODES, NAICS_CODES } from './lib/slugs.mjs';

const __filename = fileURLToPath(import.meta.url);
const CACHE_DIR = path.resolve(path.dirname(__filename), '../../.cache/raw');

// CACHE WARNING: cachedCall keys on the endpoint LABEL + ISO week only, not
// the payload. Never change an existing label's request shape (fields, filters)
// mid-week — reruns would silently serve the old shape from .cache/raw. New
// fetchers get their own field constants and their own labels instead.
const AWARD_FIELDS = [
  'Award ID',
  'Recipient Name',
  'Award Amount',
  'Start Date',
  'End Date',
  'Awarding Agency',
  'Description',
  'generated_internal_id',
];

// Vendor + recompete award rows. Adds to AWARD_FIELDS: 'Recipient UEI' and
// 'recipient_id' (both verified live and in scripts/leadgen/usaspending.py)
// for roster matching, and 'NAICS' for market labels on recompete tables.
const VENDOR_AWARD_FIELDS = [
  'Award ID',
  'Recipient Name',
  'Recipient UEI',
  'recipient_id',
  'Award Amount',
  'Start Date',
  'End Date',
  'Awarding Agency',
  'NAICS',
  'Description',
  'generated_internal_id',
];

// ---- Recompete knobs ------------------------------------------------------
// Awards whose period-of-performance End Date falls within this window count
// as upcoming recompetes. The API cannot filter on end dates (time_period
// filters ACTION dates — verified live 2026-07-30: an FY25-26 window returned
// awards ending in 2021), so fetch pulls top awards by value over a wide
// action-date window and compute does the End Date windowing client-side.
export const RECOMPETE_WINDOW_MONTHS = 12;
// Pages of 100 pulled per tracked NAICS (top 300 by award value per market).
export const RECOMPETE_PAGES_PER_NAICS = 3;
// Action-date lookback for award-level pulls that window on End Date: wide
// (10 FYs) because a contract ending next year may have been signed a decade
// ago and only its mods appear in recent action-date windows.
const AWARD_LOOKBACK_FYS = 10;

function contractFilters({ naicsCode, ...extra }) {
  return { award_type_codes: CONTRACT_AWARD_TYPE_CODES, naics_codes: { require: [naicsCode] }, ...extra };
}

async function cachedCall(client, isoWeek, endpointLabel, fn) {
  const key = cacheKey(endpointLabel, null, isoWeek);
  const cached = await readCache(CACHE_DIR, key);
  if (cached !== undefined) return cached;
  const result = await fn();
  await writeCache(CACHE_DIR, key, result);
  return result;
}

/**
 * Fetches the raw (unnormalized) API responses a NAICS entity page needs:
 * a 6-fiscal-year obligation trend, top-10 vendors, top-10 buying agencies,
 * the 25 largest FY-to-date awards, and a FY-to-date award count.
 */
export async function fetchNaicsRaw(client, { naicsCode, asOfDate, trendYears = 6 }) {
  const currentFy = fiscalYearOf(asOfDate);
  const currentFyRange = fiscalYearRange(currentFy);
  const trendRange = { start: fiscalYearRange(currentFy - trendYears + 1).start, end: currentFyRange.end };
  const isoWeek = isoWeekString(new Date(`${asOfDate}T00:00:00Z`));

  const label = (name) => `naics/${naicsCode}/${name}/${isoWeek}`;

  const [trend, topVendors, topAgencies, largestAwards, awardCount] = await Promise.all([
    cachedCall(client, isoWeek, label('trend'), () =>
      client.spendingOverTime({
        group: 'fiscal_year',
        filters: contractFilters({
          naicsCode,
          time_period: [{ start_date: trendRange.start, end_date: trendRange.end }],
        }),
      })
    ),
    cachedCall(client, isoWeek, label('top-vendors'), () =>
      client.spendingByCategory(
        'recipient_duns',
        contractFilters({
          naicsCode,
          time_period: [{ start_date: currentFyRange.start, end_date: currentFyRange.end }],
        }),
        { limit: 10 }
      )
    ),
    cachedCall(client, isoWeek, label('top-agencies'), () =>
      client.spendingByCategory(
        'awarding_agency',
        contractFilters({
          naicsCode,
          time_period: [{ start_date: currentFyRange.start, end_date: currentFyRange.end }],
        }),
        { limit: 10 }
      )
    ),
    cachedCall(client, isoWeek, label('largest-awards'), () =>
      client.spendingByAward({
        filters: contractFilters({
          naicsCode,
          time_period: [{ start_date: currentFyRange.start, end_date: currentFyRange.end }],
        }),
        fields: AWARD_FIELDS,
        sort: 'Award Amount',
        order: 'desc',
        limit: 25,
      })
    ),
    cachedCall(client, isoWeek, label('award-count'), () =>
      client.spendingByAwardCount(
        contractFilters({
          naicsCode,
          time_period: [{ start_date: currentFyRange.start, end_date: currentFyRange.end }],
        })
      )
    ),
  ]);

  return { naicsCode, asOfDate, currentFy, currentFyRange, trend, topVendors, topAgencies, largestAwards, awardCount };
}

export async function fetchPilotRawData({ asOfDate, client } = {}) {
  const activeClient = client ?? new UsaSpendingClient();
  const raw = {};
  for (const naicsCode of PILOT_NAICS_CODES) {
    raw[naicsCode] = await fetchNaicsRaw(activeClient, { naicsCode, asOfDate });
  }
  return { raw, requestCount: activeClient.requestCount };
}

// ---- Generic entity fetch (agency, state, and any future dimension) --------
// `baseFilter` is the dimension filter (e.g. { agencies: [...] } or
// { place_of_performance_locations: [...] }); `categoryDims` is the ordered
// list of spending_by_category dimensions to pull as ranking charts.
function withContract(baseFilter, timePeriod) {
  return {
    award_type_codes: CONTRACT_AWARD_TYPE_CODES,
    ...baseFilter,
    time_period: [timePeriod],
  };
}

export async function fetchEntityRaw(client, { kind, slug, name, baseFilter, categoryDims, asOfDate, trendYears = 6 }) {
  const currentFy = fiscalYearOf(asOfDate);
  const currentFyRange = fiscalYearRange(currentFy);
  const fyTp = { start_date: currentFyRange.start, end_date: currentFyRange.end };
  const trendTp = { start_date: fiscalYearRange(currentFy - trendYears + 1).start, end_date: currentFyRange.end };
  const isoWeek = isoWeekString(new Date(`${asOfDate}T00:00:00Z`));
  const label = (n) => `${kind}/${slug}/${n}/${isoWeek}`;

  const trend = await cachedCall(client, isoWeek, label('trend'), () =>
    client.spendingOverTime({ group: 'fiscal_year', filters: withContract(baseFilter, trendTp) })
  );

  const cats = {};
  for (const cat of categoryDims) {
    cats[cat] = await cachedCall(client, isoWeek, label(`cat-${cat}`), () =>
      client.spendingByCategory(cat, withContract(baseFilter, fyTp), { limit: 10 })
    );
  }

  const largestAwards = await cachedCall(client, isoWeek, label('largest-awards'), () =>
    client.spendingByAward({
      filters: withContract(baseFilter, fyTp),
      fields: AWARD_FIELDS,
      sort: 'Award Amount',
      order: 'desc',
      limit: 25,
    })
  );

  const awardCount = await cachedCall(client, isoWeek, label('award-count'), () =>
    client.spendingByAwardCount(withContract(baseFilter, fyTp))
  );

  return { kind, slug, name, asOfDate, currentFy, currentFyRange, trend, cats, largestAwards, awardCount };
}

const CATEGORY_DIMS = {
  agency: ['naics', 'recipient_duns'],
  state: ['awarding_agency', 'recipient_duns', 'naics'],
  setaside: ['awarding_agency', 'recipient_duns', 'naics'],
};

export function agencyBaseFilter(name) {
  return { agencies: [{ type: 'awarding', tier: 'toptier', name }] };
}

export function stateBaseFilter(code) {
  return { place_of_performance_locations: [{ country: 'USA', state: code }] };
}

export function setasideBaseFilter(codes) {
  return { set_aside_type_codes: codes };
}

export async function fetchAgencyRaw(client, { slug, name, asOfDate }) {
  return fetchEntityRaw(client, { kind: 'agency', slug, name, baseFilter: agencyBaseFilter(name), categoryDims: CATEGORY_DIMS.agency, asOfDate });
}

export async function fetchStateRaw(client, { slug, name, code, asOfDate }) {
  return fetchEntityRaw(client, { kind: 'state', slug, name, baseFilter: stateBaseFilter(code), categoryDims: CATEGORY_DIMS.state, asOfDate });
}

export async function fetchSetasideRaw(client, { slug, name, codes, asOfDate }) {
  return fetchEntityRaw(client, { kind: 'setaside', slug, name, baseFilter: setasideBaseFilter(codes), categoryDims: CATEGORY_DIMS.setaside, asOfDate });
}

// ---- Vendor profiles (roster-driven) ---------------------------------------
// One page of the overall FY-to-date contractor ranking — the roster source.
// lib/vendor-roster.mjs walks these pages to append new vendors (append-only,
// stable slugs); cached per ISO week like everything else.
export async function fetchTopRecipients(client, { asOfDate, page = 1, limit = 100 }) {
  const currentFy = fiscalYearOf(asOfDate);
  const fyRange = fiscalYearRange(currentFy);
  const isoWeek = isoWeekString(new Date(`${asOfDate}T00:00:00Z`));
  return cachedCall(client, isoWeek, `vendors/roster/p${page}/${isoWeek}`, () =>
    client.spendingByCategory(
      'recipient_duns',
      {
        award_type_codes: CONTRACT_AWARD_TYPE_CODES,
        time_period: [{ start_date: fyRange.start, end_date: fyRange.end }],
      },
      { limit, page }
    )
  );
}

/**
 * Raw data for one vendor profile page. Two different recipient filters are
 * used, deliberately (both verified live 2026-07-30):
 *   - Aggregate endpoints (spending_over_time, spending_by_category) honor
 *     `recipient_id` (the recipient hash).
 *   - spending_by_award SILENTLY IGNORES `recipient_id` — it returns other
 *     vendors' awards with no error. Award-level queries must use
 *     `recipient_search_text: [uei]` (same as scripts/leadgen/usaspending.py).
 */
export async function fetchVendorRaw(client, { slug, vendor, asOfDate, trendYears = 6 }) {
  const currentFy = fiscalYearOf(asOfDate);
  const currentFyRange = fiscalYearRange(currentFy);
  const fyTp = { start_date: currentFyRange.start, end_date: currentFyRange.end };
  const trendTp = { start_date: fiscalYearRange(currentFy - trendYears + 1).start, end_date: currentFyRange.end };
  const wideTp = { start_date: fiscalYearRange(currentFy - AWARD_LOOKBACK_FYS + 1).start, end_date: currentFyRange.end };
  const isoWeek = isoWeekString(new Date(`${asOfDate}T00:00:00Z`));
  const label = (n) => `vendor/${slug}/${n}/${isoWeek}`;

  const aggFilter = (tp) => ({ award_type_codes: CONTRACT_AWARD_TYPE_CODES, recipient_id: vendor.recipientId, time_period: [tp] });
  const awardFilter = (tp) => ({ award_type_codes: CONTRACT_AWARD_TYPE_CODES, recipient_search_text: [vendor.uei], time_period: [tp] });

  const trend = await cachedCall(client, isoWeek, label('trend'), () =>
    client.spendingOverTime({ group: 'fiscal_year', filters: aggFilter(trendTp) })
  );

  const cats = {};
  for (const cat of ['awarding_agency', 'naics']) {
    cats[cat] = await cachedCall(client, isoWeek, label(`cat-${cat}`), () =>
      client.spendingByCategory(cat, aggFilter(fyTp), { limit: 10 })
    );
  }

  const largestAwards = await cachedCall(client, isoWeek, label('largest-awards'), () =>
    client.spendingByAward({ filters: awardFilter(fyTp), fields: VENDOR_AWARD_FIELDS, sort: 'Award Amount', order: 'desc', limit: 25 })
  );

  // Wide action-date window, windowed on End Date client-side in compute:
  // the vendor's "contracts expiring soon" table (recompete tie-in).
  const expiringAwards = await cachedCall(client, isoWeek, label('expiring-awards'), () =>
    client.spendingByAward({ filters: awardFilter(wideTp), fields: VENDOR_AWARD_FIELDS, sort: 'Award Amount', order: 'desc', limit: 100 })
  );

  const awardCount = await cachedCall(client, isoWeek, label('award-count'), () =>
    client.spendingByAwardCount(awardFilter(fyTp))
  );

  // Registration facts (UEI, HQ, parent, business types). Non-critical: on any
  // failure the page ships without the registration table rather than failing
  // the run.
  let profile = null;
  try {
    profile = await cachedCall(client, isoWeek, label('profile'), () => client.recipientProfile(vendor.recipientId));
  } catch (err) {
    console.warn(`[fetch-data] vendor/${slug}: recipient profile unavailable (${String(err.message).slice(0, 120)})`);
  }

  return { kind: 'vendor', slug, name: vendor.name, asOfDate, currentFy, currentFyRange, trend, cats, largestAwards, expiringAwards, awardCount, profile };
}

// ---- Recompete watch --------------------------------------------------------
/**
 * Top awards by total value across every tracked NAICS market, tagged with
 * their source market and deduped by generated_internal_id. Raw rows only —
 * build-rankings windows them on End Date (client-side, see RECOMPETE_*
 * knobs above). ~NAICS_CODES.length * RECOMPETE_PAGES_PER_NAICS calls, cached
 * per ISO week. Stops paging on a short page: the API's hasNext lies past the
 * Elasticsearch 10k window (documented in scripts/leadgen/usaspending.py).
 */
export async function fetchRecompeteRaw(client, { asOfDate }) {
  const currentFy = fiscalYearOf(asOfDate);
  const currentFyRange = fiscalYearRange(currentFy);
  const wideTp = { start_date: fiscalYearRange(currentFy - AWARD_LOOKBACK_FYS + 1).start, end_date: currentFyRange.end };
  const isoWeek = isoWeekString(new Date(`${asOfDate}T00:00:00Z`));

  const rows = [];
  const seen = new Set();
  for (const naicsCode of NAICS_CODES) {
    for (let page = 1; page <= RECOMPETE_PAGES_PER_NAICS; page += 1) {
      const resp = await cachedCall(client, isoWeek, `recompete/${naicsCode}/p${page}/${isoWeek}`, () =>
        client.spendingByAward({
          filters: contractFilters({ naicsCode, time_period: [wideTp] }),
          fields: VENDOR_AWARD_FIELDS,
          sort: 'Award Amount',
          order: 'desc',
          limit: 100,
          page,
        })
      );
      const results = resp?.results ?? [];
      for (const r of results) {
        const id = r.generated_internal_id ?? null;
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        rows.push({ ...r, sourceNaics: naicsCode });
      }
      if (results.length < 100) break;
    }
  }
  return { asOfDate, rows };
}

async function main() {
  const asOfDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  console.log(`[fetch-data] Fetching pilot NAICS raw data as of ${asOfDate} (network required)...`);
  const { raw, requestCount } = await fetchPilotRawData({ asOfDate });
  const { writeFile, mkdir } = await import('node:fs/promises');
  const outDir = path.resolve(path.dirname(__filename), '../../.cache/raw/naics');
  await mkdir(outDir, { recursive: true });
  for (const [code, data] of Object.entries(raw)) {
    await writeFile(path.join(outDir, `${code}.json`), JSON.stringify(data, null, 2), 'utf8');
  }
  console.log(`[fetch-data] Done. ${requestCount} API requests made for ${PILOT_NAICS_CODES.length} pilot NAICS codes.`);
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error('[fetch-data] FAILED — no data written, upstream commit must not proceed.');
    console.error(err);
    process.exit(1);
  });
}
