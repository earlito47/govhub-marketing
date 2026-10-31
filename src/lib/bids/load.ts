// Public bid listings, read once per build from the app's database.
//
// The rows come from public_bid_listings() in the app's Supabase project
// (strata-parse supabase/migrations/20261031120000_public_bid_listings.sql),
// which returns only what a public page may show: federal bids and state or
// local portal bids that have GovHub's own summary, open or closed within the
// last 90 days, never the source's description text, never CivicPlus city
// sites. This module turns them into pages, hubs and "similar bids" lists.
//
// FAILS THE BUILD rather than shipping a thin /bids/: a fetch error, or far
// fewer rows than the site normally carries, throws. Cloudflare Pages then
// keeps the previous deploy live, which is the right outcome for a database
// hiccup at build time.
//
// BIDS_SNAPSHOT=<path to a JSON array in the function's row shape> builds from
// a file instead, for offline work and for tests.

import { readFileSync } from 'node:fs';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../config';
import { STATES } from '../../../scripts/insights/lib/slugs.mjs';
import NAICS_TITLES from '../../data/bids/naics-2022.json';
import { CATEGORIES, CATEGORY_BY_SLUG, categorize } from './categories';
import { cleanTitle, noEmDash, slugify } from './text';

/** One row of public_bid_listings(). */
export interface BidRow {
  id: string;
  title: string;
  agency: string | null;
  state: string | null;
  jurisdiction_type: string | null;
  notice_type: string | null;
  external_id: string | null;
  set_aside: string | null;
  estimated_value: number | null;
  posted_at: string | null;
  due_at: string | null;
  time_zone: string | null;
  summary: string;
  url: string | null;
  source_name: string;
  source_tier: string;
  naics: string[] | null;
  status: string;
  closed_at: string | null;
  /** Whether a full description exists; the text itself never leaves the app. */
  has_description: boolean;
  attachment_count: number;
}

export interface Bid {
  id: string;
  title: string;
  rawTitle: string;
  agency: string | null;
  /** USPS code, or null for federal bids with no place of performance. */
  stateCode: string | null;
  stateSlug: string | null;
  stateName: string | null;
  /** First URL segment: the state slug, or "federal" when there is no state. */
  segment: string;
  slug: string;
  path: string;
  level: string;
  federal: boolean;
  noticeType: string | null;
  externalId: string | null;
  setAside: string | null;
  estimatedValue: number | null;
  postedAt: string | null;
  dueAt: string | null;
  timeZone: string;
  summary: string;
  url: string | null;
  sourceName: string;
  naics: { code: string; title: string | null }[];
  categories: string[];
  closed: boolean;
  /** What the free-trial gate can truthfully say the app has for this bid. */
  hasDescription: boolean;
  attachmentCount: number;
}

export interface Hub {
  path: string;
  /** Open bids, soonest due first; no-due-date bids last. */
  open: Bid[];
  /** Up to 10 most recently closed, for internal links to closed pages. */
  recentlyClosed: Bid[];
}

export interface BidIndex {
  builtAt: Date;
  bids: Bid[];
  byPath: Map<string, Bid>;
  stateHubs: Map<string, Hub>;
  categoryHubs: Map<string, Hub>;
  /** Key: `${category}/${stateSlug}`. */
  categoryStateHubs: Map<string, Hub>;
  sourceCount: number;
}

/** A hub page is generated only with at least this many open bids. */
export const HUB_MIN_OPEN = 5;
/** Below this many rows the live fetch is treated as broken, not as data. */
const MIN_LIVE_ROWS = 1000;
export const FEDERAL_SEGMENT = 'federal';

// Territories the database carries that the Insights state list does not.
// AA/AE (military mail) stay unmapped: those bids file under federal.
const PLACES: Record<string, { slug: string; name: string }> = {
  ...Object.fromEntries(Object.entries(STATES as Record<string, { name: string; code: string }>).map(([slug, s]) => [s.code, { slug, name: s.name }])),
  PR: { slug: 'puerto-rico', name: 'Puerto Rico' },
  GU: { slug: 'guam', name: 'Guam' },
  VI: { slug: 'us-virgin-islands', name: 'U.S. Virgin Islands' },
  AS: { slug: 'american-samoa', name: 'American Samoa' },
  MP: { slug: 'northern-mariana-islands', name: 'Northern Mariana Islands' },
};
export const PLACE_BY_SLUG = new Map(Object.entries(PLACES).map(([code, p]) => [p.slug, { code, ...p }]));
/** States with an /insights/state/ page (territories have none). */
export const INSIGHTS_STATE_SLUGS = new Set(Object.keys(STATES as Record<string, unknown>));

const LEVELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  county: 'County',
  municipal: 'City',
  school_district: 'School district',
  special_district: 'Special district',
  tribal: 'Tribal',
};

function baseSlug(row: BidRow, title: string): string {
  const words = slugify(title).slice(0, 60).replace(/-[^-]*$/, '') || slugify(title).slice(0, 60) || 'bid';
  const ref = slugify(row.external_id ?? '').slice(0, 30);
  return `${words}-${ref || row.id.slice(0, 8)}`;
}

function toBid(row: BidRow, now: number): Omit<Bid, 'slug' | 'path'> {
  const place = row.state ? PLACES[row.state.toUpperCase()] : undefined;
  const federal = row.source_tier === 'federal';
  const title = noEmDash(cleanTitle(row.title));
  const naics = (row.naics ?? []).map((code) => ({ code, title: (NAICS_TITLES as Record<string, string>)[code] ?? null }));
  const due = row.due_at ? Date.parse(row.due_at) : NaN;
  return {
    id: row.id,
    title,
    rawTitle: noEmDash(row.title.trim()),
    agency: row.agency ? noEmDash(cleanTitle(row.agency)) : null,
    stateCode: place ? row.state!.toUpperCase() : null,
    stateSlug: place?.slug ?? null,
    stateName: place?.name ?? null,
    segment: place?.slug ?? FEDERAL_SEGMENT,
    level: LEVELS[row.jurisdiction_type ?? ''] ?? (federal ? 'Federal' : row.source_tier === 'state' ? 'State' : 'Local'),
    federal,
    noticeType: noEmDash(row.notice_type),
    externalId: row.external_id,
    setAside: noEmDash(row.set_aside),
    estimatedValue: row.estimated_value,
    postedAt: row.posted_at,
    dueAt: row.due_at,
    timeZone: row.time_zone || 'America/New_York',
    summary: noEmDash(row.summary.trim()),
    url: row.url,
    sourceName: noEmDash(row.source_name),
    naics,
    categories: categorize(title, row.naics ?? []),
    hasDescription: !!row.has_description,
    attachmentCount: row.attachment_count ?? 0,
    closed: row.status !== 'open' || (Number.isFinite(due) && due < now),
  };
}

async function fetchRows(): Promise<BidRow[]> {
  const file = process.env.BIDS_SNAPSHOT;
  if (file) return JSON.parse(readFileSync(file, 'utf8')) as BidRow[];

  const rows: BidRow[] = [];
  let after: string | null = null;
  for (let page = 0; page < 100; page++) {
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_bid_listings`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_after: after, p_limit: 1000 }),
        });
        if (res.ok) break;
      } catch (e) {
        if (attempt === 3) throw new Error(`public_bid_listings unreachable: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
    if (!res || !res.ok) throw new Error(`public_bid_listings HTTP ${res?.status}: ${(await res?.text())?.slice(0, 300)}`);
    const batch = (await res.json()) as BidRow[];
    rows.push(...batch);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].id;
  }
  if (rows.length < MIN_LIVE_ROWS) {
    throw new Error(`public_bid_listings returned ${rows.length} rows (expected ${MIN_LIVE_ROWS}+); refusing to build a near-empty /bids/`);
  }
  return rows;
}

function byDue(a: Bid, b: Bid): number {
  const da = a.dueAt ? Date.parse(a.dueAt) : Infinity;
  const db = b.dueAt ? Date.parse(b.dueAt) : Infinity;
  return da - db || a.title.localeCompare(b.title);
}

function hubFrom(path: string, bids: Bid[]): Hub {
  return {
    path,
    open: bids.filter((b) => !b.closed).sort(byDue),
    recentlyClosed: bids
      .filter((b) => b.closed)
      .sort((a, b) => Date.parse(b.dueAt ?? '0') - Date.parse(a.dueAt ?? '0'))
      .slice(0, 10),
  };
}

function group(bids: Bid[], key: (b: Bid) => string[]): Map<string, Bid[]> {
  const m = new Map<string, Bid[]>();
  for (const b of bids) for (const k of key(b)) (m.get(k) ?? m.set(k, []).get(k)!).push(b);
  return m;
}

async function build(): Promise<BidIndex> {
  const builtAt = new Date();
  const now = builtAt.getTime();

  // Category, state and the federal segment share /bids/{segment}/.
  const segments = new Set([FEDERAL_SEGMENT, ...[...PLACE_BY_SLUG.keys()]]);
  for (const c of CATEGORIES) {
    if (segments.has(c.slug)) throw new Error(`bid category slug "${c.slug}" collides with a state or the federal segment`);
  }

  const rows = (await fetchRows()).sort((a, b) => a.id.localeCompare(b.id));
  const taken = new Set<string>();
  const bids: Bid[] = rows.map((row) => {
    const b = toBid(row, now);
    let slug = baseSlug(row, b.title);
    if (taken.has(`${b.segment}/${slug}`)) slug = `${slug}-${row.id.slice(0, 6)}`;
    taken.add(`${b.segment}/${slug}`);
    return { ...b, slug, path: `/bids/${b.segment}/${slug}/` };
  });

  const keep = (m: Map<string, Hub>) => new Map([...m].filter(([, h]) => h.open.length >= HUB_MIN_OPEN));
  const toHubs = (m: Map<string, Bid[]>, path: (k: string) => string) =>
    keep(new Map([...m].map(([k, list]) => [k, hubFrom(path(k), list)])));

  return {
    builtAt,
    bids,
    byPath: new Map(bids.map((b) => [b.path, b])),
    stateHubs: toHubs(group(bids, (b) => [b.segment]), (s) => `/bids/${s}/`),
    categoryHubs: toHubs(group(bids, (b) => b.categories), (c) => `/bids/${c}/`),
    categoryStateHubs: toHubs(
      group(bids, (b) => (b.stateSlug ? b.categories.map((c) => `${c}/${b.stateSlug}`) : [])),
      (k) => `/bids/${k}/`,
    ),
    sourceCount: new Set(rows.map((r) => r.source_name)).size,
  };
}

let cached: Promise<BidIndex> | undefined;

/** The whole bid index, built once per process. */
export function getBidIndex(): Promise<BidIndex> {
  cached ??= build();
  return cached;
}

/**
 * Up to `n` open bids to show next to `bid`: same primary category in the same
 * place, then the same category anywhere, then anything open in the same place.
 */
export function similarBids(index: BidIndex, bid: Bid, n = 6): Bid[] {
  const out: Bid[] = [];
  const add = (list: Bid[] | undefined) => {
    for (const b of list ?? []) {
      if (out.length >= n) return;
      if (b.id !== bid.id && !out.includes(b)) out.push(b);
    }
  };
  const primary = bid.categories[0];
  if (primary && bid.stateSlug) add(index.categoryStateHubs.get(`${primary}/${bid.stateSlug}`)?.open);
  if (primary) add(index.categoryHubs.get(primary)?.open);
  add(index.stateHubs.get(bid.segment)?.open);
  return out;
}

export function categoryName(slug: string): string {
  return CATEGORY_BY_SLUG.get(slug)?.name ?? slug;
}

export function placeName(segment: string): string {
  return segment === FEDERAL_SEGMENT ? 'Federal' : (PLACE_BY_SLUG.get(segment)?.name ?? segment);
}

const dateFmt = (tz: string, withTime: boolean) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: withTime ? 'long' : undefined,
    month: withTime ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } : {}),
  });

/** "Monday, November 17, 2026 at 9:00 AM EST", in the bid's own time zone. */
export function formatDue(iso: string, tz: string): string {
  return dateFmt(tz, true).format(new Date(iso)).replace(/, (\d{1,2}:\d{2})/, ' at $1');
}

/** "Nov 17, 2026". */
export function formatShortDate(iso: string, tz = 'America/New_York'): string {
  return dateFmt(tz, false).format(new Date(iso));
}
