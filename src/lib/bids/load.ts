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
import { bidDocuments, type BidDocument } from './documents';

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
  /** The posted files' names, percent-encoded as stored; never their links. Older snapshots lack it. */
  attachment_names?: string[] | null;
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
  /** The posted files by name, tagged when the name says what they are (lib/bids/documents.ts). */
  documents: BidDocument[];
  /**
   * Whether search engines should index this page. Every bid keeps its page
   * (visitors, hubs and the trial button all use it); a weak one carries
   * noindex,follow and stays out of the sitemap. See `noindexReason`.
   */
  indexable: boolean;
  noindexReason: NoindexReason | null;
  /**
   * The page's <title>, unique across all bid pages (markIndexable). Carries
   * what people search a bid by: its name, solicitation number, agency and due
   * date (Search Console, 2026-11: queries like "darpa-ps-26-115" and names with
   * a due date). See titleTagFor().
   */
  titleTag: string;
}

/**
 * Why a bid page is kept out of the index (Google's scaled-content policy,
 * reviewed 2026-11-01). One summary of a few words on a templated page, many
 * times over, is the pattern that policy describes; the hubs carry these
 * searches instead.
 *  - 'dla-parts': Defense Logistics Agency parts buys (gaskets, valves, cards):
 *    thousands of near-identical small purchases nobody searches for by name.
 *  - 'shared-title': another bid has the same title, so the pages compete.
 *  - 'short-summary': GovHub's summary is under MIN_SUMMARY_WORDS words.
 */
export type NoindexReason = 'dla-parts' | 'shared-title' | 'short-summary';
export const MIN_SUMMARY_WORDS = 15;

export interface Hub {
  path: string;
  /** Open bids, soonest due first; no-due-date bids last. */
  open: Bid[];
  /** Up to RECENT_CLOSED most recently closed, for internal links to closed pages. */
  recentlyClosed: Bid[];
  /**
   * Every bid in the hub: open soonest first, then closed most recent first.
   * A place hub lists the first HUB_PAGE_SIZE open and RECENT_CLOSED closed on
   * its own page and the rest on /bids/{place}/page/{n}/ (hubOverflowPages), so
   * every bid page has a link from a hub. Before that, 2,099 indexable bid
   * pages had none (Ahrefs site audit and our own link graph, 2026-11-03).
   */
  all: Bid[];
}

export interface BidIndex {
  builtAt: Date;
  bids: Bid[];
  byPath: Map<string, Bid>;
  stateHubs: Map<string, Hub>;
  categoryHubs: Map<string, Hub>;
  /** Key: `${category}/${stateSlug}`. */
  categoryStateHubs: Map<string, Hub>;
  /** Every place's bids in hub order (Hub.all), including places too small for a hub. */
  segmentAll: Map<string, Bid[]>;
  sourceCount: number;
}

/** A hub page is generated only with at least this many open bids. */
export const HUB_MIN_OPEN = 5;
/** Open bids listed on a hub's first page, and bids per overflow page. */
export const HUB_PAGE_SIZE = 200;
/** Closed bids listed on a hub's first page. */
export const RECENT_CLOSED = 10;
/**
 * Cloudflare Pages takes 20,000 files per deploy on the free plan, and a deploy
 * over the limit fails outright, blog posts and all. The rest of the site is
 * about 2,000 files, and bids grow by the thousand when sources are added, so
 * bid pages are capped: every open bid first (soonest deadline first, no date
 * last), then closed ones, most recently closed first. A bid over the cap gets
 * no page and is left out of the hubs.
 */
export const MAX_BID_PAGES = 14000;
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
/** NAICS codes with an indexable /insights/naics/{code}/ page, for links from bid pages. */
const NAICS_INSIGHTS = import.meta.glob<{ slug: string; noindex?: boolean }>('../../data/insights/naics/*.json', { eager: true, import: 'default' });
export const INSIGHTS_NAICS_CODES = new Set(Object.values(NAICS_INSIGHTS).filter((p) => !p.noindex).map((p) => p.slug));

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

// slug/path need the whole set (collisions); the index fields are set by markIndexable().
function toBid(row: BidRow, now: number): Omit<Bid, 'slug' | 'path' | 'indexable' | 'noindexReason' | 'titleTag'> {
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
    documents: bidDocuments(row.attachment_names),
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

const titleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** "Dept of Defense / Dept of the Navy / Navsup ..." -> "Navy". */
function agencyShort(b: Bid): string | null {
  if (!b.agency) return null;
  const parts = b.agency.split(' / ');
  const name = (parts[1] ?? parts[0]).replace(/^(dept|department) of (the )?/i, '').trim();
  if (/^defense logistics agency$/i.test(name)) return 'DLA';
  return name.length <= 28 ? name : null;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The solicitation number, when it is short enough to title and not already in the name. */
function titleRef(b: Bid): string | null {
  const ref = b.externalId?.trim();
  if (!ref || ref.length > 24 || alnum(b.title).includes(alnum(ref))) return null;
  return ref;
}

// 70, not the site's usual 60: Google shows about 60 characters but matches the
// whole title, and the solicitation number and due date at the end are what
// people search a bid by. check-meta.mjs allows bid pages up to 70 without a
// warning, and fails anything past 70.
const TITLE_MAX = 70;

/**
 * "Freedom 250 Reception and Fireworks (19JA7027Q0002), Army, Due Jan 12":
 * name, solicitation number, agency, due date. The agency is dropped first
 * when it does not fit, then the name is shortened; the number and the date
 * are what people search a bid by, so they stay. `extra` breaks the rare tie
 * between two bids that would otherwise share a title.
 */
function titleTagFor(b: Bid, extra = ''): string {
  const ref = titleRef(b);
  const agency = agencyShort(b);
  const date = b.dueAt ? `${b.closed ? 'Closed' : 'Due'} ${formatMonthDay(b.dueAt, b.timeZone)}` : null;
  const tail = extra ? ` #${extra}` : '';
  const fmt = (name: string, withAgency: boolean, withDate = true) =>
    `${name}${ref ? ` (${ref})` : ''}${withAgency && agency ? `, ${agency}` : ''}${withDate && date ? `, ${date}` : ''}${tail}`;
  for (const t of [fmt(b.title, true), fmt(b.title, false)]) if (t.length <= TITLE_MAX) return t;
  const room = TITLE_MAX - fmt('', false).length;
  if (room >= 18) return fmt(clip(b.title, room), false);
  return fmt(clip(b.title, Math.max(12, TITLE_MAX - fmt('', false, false).length)), false, false);
}

/** The page's <title>; see titleTagFor() and markIndexable(). */
export function bidTitleTag(b: Bid): string {
  return b.titleTag;
}

/** Sets indexable, noindexReason and titleTag on the pages being built. */
function markIndexable(bids: Bid[]): void {
  const count = new Map<string, number>();
  for (const b of bids) count.set(titleKey(b.title), (count.get(titleKey(b.title)) ?? 0) + 1);
  for (const b of bids) {
    const shared = count.get(titleKey(b.title))! > 1;
    b.noindexReason = /defense logistics agency/i.test(b.agency ?? '')
      ? 'dla-parts'
      : shared
        ? 'shared-title'
        : words(b.summary) < MIN_SUMMARY_WORDS
          ? 'short-summary'
          : null;
    b.indexable = b.noindexReason === null;
    b.titleTag = titleTagFor(b);
  }
  // Same name, number and date (a notice posted twice): the bid id breaks the tie.
  const byTag = new Map<string, Bid[]>();
  for (const b of bids) (byTag.get(b.titleTag.toLowerCase()) ?? byTag.set(b.titleTag.toLowerCase(), []).get(b.titleTag.toLowerCase())!).push(b);
  for (const group of byTag.values()) if (group.length > 1) for (const b of group) b.titleTag = titleTagFor(b, b.id.slice(0, 6));
}

function byDue(a: Bid, b: Bid): number {
  const da = a.dueAt ? Date.parse(a.dueAt) : Infinity;
  const db = b.dueAt ? Date.parse(b.dueAt) : Infinity;
  return da - db || a.title.localeCompare(b.title);
}

function hubFrom(path: string, bids: Bid[]): Hub {
  const open = bids.filter((b) => !b.closed).sort(byDue);
  const closed = bids
    .filter((b) => b.closed)
    .sort((a, b) => Date.parse(b.dueAt ?? '0') - Date.parse(a.dueAt ?? '0') || a.id.localeCompare(b.id));
  return { path, open, recentlyClosed: closed.slice(0, RECENT_CLOSED), all: [...open, ...closed] };
}

/**
 * The bids a place hub's first page does not list, in pages of HUB_PAGE_SIZE:
 * page 2 is element 0. Open bids past the first HUB_PAGE_SIZE come first, then
 * closed bids past the first RECENT_CLOSED.
 */
export function hubOverflowPages(hub: Hub): Bid[][] {
  const rest = [...hub.open.slice(HUB_PAGE_SIZE), ...hub.all.filter((b) => b.closed).slice(RECENT_CLOSED)];
  const pages: Bid[][] = [];
  for (let i = 0; i < rest.length; i += HUB_PAGE_SIZE) pages.push(rest.slice(i, i + HUB_PAGE_SIZE));
  return pages;
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
  const all: Bid[] = rows.map((row) => {
    const b = toBid(row, now);
    let slug = baseSlug(row, b.title);
    if (taken.has(`${b.segment}/${slug}`)) slug = `${slug}-${row.id.slice(0, 6)}`;
    taken.add(`${b.segment}/${slug}`);
    return { ...b, slug, path: `/bids/${b.segment}/${slug}/`, indexable: true, noindexReason: null, titleTag: '' };
  });
  const open = all.filter((b) => !b.closed).sort(byDue);
  const closed = all.filter((b) => b.closed).sort((a, b) => Date.parse(b.dueAt ?? '0') - Date.parse(a.dueAt ?? '0'));
  const bids = [...open, ...closed].slice(0, MAX_BID_PAGES);
  markIndexable(bids);
  const held = bids.filter((b) => !b.indexable);
  const byReason = new Map<string, number>();
  for (const h of held) byReason.set(h.noindexReason!, (byReason.get(h.noindexReason!) ?? 0) + 1);
  const reasons = [...byReason].map(([r, n]) => `${r} ${n}`);
  console.log(`[bids] ${all.length} listings (${open.length} open), ${bids.length} pages (cap ${MAX_BID_PAGES}), ${bids.length - held.length} indexable; noindex: ${reasons.join(', ') || 'none'}`);

  const keep = (m: Map<string, Hub>) => new Map([...m].filter(([, h]) => h.open.length >= HUB_MIN_OPEN));
  const toHubs = (m: Map<string, Bid[]>, path: (k: string) => string) =>
    keep(new Map([...m].map(([k, list]) => [k, hubFrom(path(k), list)])));

  const segmentAll = new Map([...group(bids, (b) => [b.segment])].map(([k, list]) => [k, hubFrom(`/bids/${k}/`, list).all]));

  return {
    builtAt,
    bids,
    segmentAll,
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

/**
 * The bids just before and after this one in its place's list (Hub.all order):
 * up to `n` each side. Every bid page links its neighbours, so each bid gets
 * links from the pages around it as well as from its hub page, and no bid is
 * left with none.
 */
const positions = new WeakMap<Bid[], Map<string, number>>();
export function neighbourBids(index: BidIndex, bid: Bid, n = 2): Bid[] {
  const list = index.segmentAll.get(bid.segment) ?? [];
  let pos = positions.get(list);
  if (!pos) positions.set(list, (pos = new Map(list.map((b, i) => [b.id, i]))));
  const i = pos.get(bid.id) ?? -1;
  if (i < 0) return [];
  return [...list.slice(Math.max(0, i - n), i), ...list.slice(i + 1, i + 1 + n)];
}

export function categoryName(slug: string): string {
  return CATEGORY_BY_SLUG.get(slug)?.name ?? slug;
}

/** The category name mid-sentence: "janitorial and cleaning", but "IT and
 *  software", "HVAC" and "E-Rate" keep their capitals. */
export function categoryPhrase(slug: string): string {
  return categoryName(slug).replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase());
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

/** "Nov 17", in the bid's own time zone. */
export function formatMonthDay(iso: string, tz = 'America/New_York'): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** "Nov 2026", for hub titles. */
export function formatMonthYear(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', year: 'numeric' }).format(d);
}
