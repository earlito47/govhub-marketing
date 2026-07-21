// Shared helpers for (a) de-templatized entity <title>s and (b) cross-cluster
// internal links, used by both the live generator (compute-stats.mjs) and the
// one-off reprocess.mjs transform so the two never drift.
//
// Why this exists: an audit found every programmatic Insights page shared one
// of a few identical title shapes (34 state pages read "<State> Federal
// Contracts: $#B in FY####"), and related[] only ever linked within a cluster
// (state->state), leaving agency/NAICS pages with no contextual inbound link.
// Both are scaled-content signals. These helpers vary the title by slug and
// mine each page's own top-agency / top-industry data for real cross-links.
import {
  AGENCIES,
  AGENCY_ABBR,
  NAICS_TITLES,
  agencyHref,
  agencyName,
  naicsHref,
  stateName,
  stateHref,
  SET_ASIDES,
} from './slugs.mjs';
import { formatUsdCompact } from './format.mjs';

// Deterministic (no RNG) variant index from a slug, stable across rebuilds.
function hashIndex(slug, n) {
  let h = 0;
  for (const ch of String(slug)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}

// Three constructions per type; all stay <=60 chars for the longest real
// name/number so the check-meta guard (fails >70, ideal <=60) is safe.
const TITLE_VARIANTS = {
  state: [
    ({ name, t, fy }) => `${name} Federal Contracts: ${t} in ${fy}`,
    ({ name, t, fy }) => `${name}: ${t} in Federal Contracts, ${fy}`,
    ({ name, t, fy }) => `Federal Contracts in ${name}: ${t} (${fy})`,
  ],
  agency: [
    ({ abbr, t, fy }) => `${abbr} Federal Contracts: ${t} in ${fy}`,
    ({ abbr, t, fy }) => `${abbr} Contract Spending: ${t} in ${fy}`,
    ({ abbr, t, fy }) => `What ${abbr} Buys: ${t} in Contracts, ${fy}`,
  ],
  naics: [
    ({ code, t, fy }) => `NAICS ${code} Government Contracts: ${t} in ${fy}`,
    ({ code, t, fy }) => `NAICS ${code}: ${t} in Federal Contracts, ${fy}`,
    ({ code, t, fy }) => `Federal Contracts in NAICS ${code}: ${t} (${fy})`,
  ],
  setaside: [
    ({ abbr, t, fy }) => `${abbr} Set-Aside Contracts: ${t} in ${fy}`,
    ({ abbr, t, fy }) => `Federal ${abbr} Set-Aside Spending: ${t}, ${fy}`,
    ({ abbr, t, fy }) => `${abbr} Set-Asides: ${t} in Contracts (${fy})`,
  ],
};

/**
 * De-templatized <title>. Same inputs the generator already has; the transform
 * derives `total$`/`fy` from the stored JSON so both produce identical output.
 */
export function entityTitle({ pageType, slug, total$, fy }) {
  const variants = TITLE_VARIANTS[pageType];
  if (!variants) return null;
  const t = total$ || 'FY Data';
  const parts = {
    t,
    fy,
    name: stateName(slug),
    code: slug,
    abbr: AGENCY_ABBR[slug] ?? SET_ASIDES[slug]?.abbr ?? slug,
  };
  return variants[hashIndex(slug, variants.length)](parts);
}

// ---- Cross-cluster links --------------------------------------------------
// Reverse maps from the exact display names the pipeline writes into charts.
const AGENCY_NAME_TO_SLUG = Object.fromEntries(Object.entries(AGENCIES).map(([slug, name]) => [name, slug]));
const normNaics = (s) => String(s).split(' (')[0].trim().toLowerCase();
const NAICS_NORM_TO_CODE = Object.fromEntries(Object.entries(NAICS_TITLES).map(([code, title]) => [normNaics(title), code]));

function chartPoints(page, suffix) {
  const c = (page.charts || []).find((ch) => ch.id?.endsWith(suffix));
  return c?.series?.[0]?.points ?? [];
}

/**
 * Cross-cluster related links mined from a page's own top-agency / top-industry
 * data. Only links to pages that actually exist (i.e. slugs we publish), so
 * the block is real and relevant, never a blanket templated list. Cross-type
 * by construction, so it never overlaps the same-type related[] siblings.
 */
export function computeCrossLinks(page, perDim = 4) {
  const self = selfHref(page);
  const seen = new Set();
  const take = (points, mapper) => {
    const out = [];
    for (const [name] of points) {
      const link = mapper(name);
      if (!link || link.href === self || seen.has(link.href)) continue;
      seen.add(link.href);
      out.push(link);
      if (out.length >= perDim) break;
    }
    return out;
  };

  // Buying agencies -> agency pages (states + NAICS pages carry this dim).
  const agencies = take(chartPoints(page, '-top-agencies'), (name) => {
    const slug = AGENCY_NAME_TO_SLUG[name];
    return slug ? { label: `${agencyName(slug)} contracts`, href: agencyHref(slug) } : null;
  });
  // Top industries -> NAICS pages (states + agency pages carry this dim).
  const industries = take(chartPoints(page, '-top-naics'), (name) => {
    const code = NAICS_NORM_TO_CODE[normNaics(name)];
    return code ? { label: `NAICS ${code}: ${NAICS_TITLES[code]}`, href: naicsHref(code) } : null;
  });
  // Both dimensions get slots so a state page spreads equity to agency AND
  // NAICS clusters, not just whichever appears first.
  return [...agencies, ...industries];
}

function selfHref(page) {
  switch (page.pageType) {
    case 'state':
      return stateHref(page.slug);
    case 'agency':
      return agencyHref(page.slug);
    case 'naics':
      return naicsHref(page.slug);
    default:
      return null;
  }
}

export const CROSS_LINK_HEADING = 'Related agencies and industries';
