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
import { PILOT_NAICS_CODES } from './lib/slugs.mjs';

const __filename = fileURLToPath(import.meta.url);
const CACHE_DIR = path.resolve(path.dirname(__filename), '../../.cache/raw');

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

function contractFilters(extra) {
  return { award_type_codes: CONTRACT_AWARD_TYPE_CODES, ...extra };
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
          naics_codes: [naicsCode],
          time_period: [{ start_date: trendRange.start, end_date: trendRange.end }],
        }),
      })
    ),
    cachedCall(client, isoWeek, label('top-vendors'), () =>
      client.spendingByCategory(
        'recipient',
        contractFilters({
          naics_codes: [naicsCode],
          time_period: [{ start_date: currentFyRange.start, end_date: currentFyRange.end }],
        }),
        { limit: 10 }
      )
    ),
    cachedCall(client, isoWeek, label('top-agencies'), () =>
      client.spendingByCategory(
        'awarding_agency',
        contractFilters({
          naics_codes: [naicsCode],
          time_period: [{ start_date: currentFyRange.start, end_date: currentFyRange.end }],
        }),
        { limit: 10 }
      )
    ),
    cachedCall(client, isoWeek, label('largest-awards'), () =>
      client.spendingByAward({
        filters: contractFilters({
          naics_codes: [naicsCode],
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
          naics_codes: [naicsCode],
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
