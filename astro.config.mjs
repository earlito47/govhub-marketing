import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATES } from './scripts/insights/lib/slugs.mjs';

const SITE_URL = 'https://www.govhub.online';

// Pipeline guardrails can mark an Insights entity `noindex` (published for
// users, weak for searchers). Those pages set <meta robots noindex>, so they
// must also be kept out of the sitemap, just like the /embed/ iframes. Collect
// their pathnames at build time by reading the page JSON.
function noindexInsightPaths() {
  const dataDir = fileURLToPath(new URL('./src/data/insights', import.meta.url));
  const kindPrefix = {
    naics: '/insights/naics/',
    agency: '/insights/agency/',
    state: '/insights/state/',
    setaside: '/insights/set-aside/',
    vendor: '/insights/vendor/',
    ranking: '/insights/',
  };
  const paths = new Set();
  for (const kind of ['naics', 'agency', 'state', 'setaside', 'vendor', 'rankings']) {
    const dir = `${dataDir}/${kind}`;
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const page = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
        if (page.noindex) paths.add(`${kindPrefix[page.pageType] ?? '/insights/'}${page.slug}/`);
      } catch {
        // ignore unreadable/partial files; the validator gates real runs
      }
    }
  }
  return paths;
}

const NOINDEX_PATHS = noindexInsightPaths();

// Three facts the sitemap needs come from the built HTML itself: the sitemap
// is written in astro:build:done, after every page is on disk, so the page is
// the source of truth and no second list has to be kept in step. All three
// tags sit in the first few hundred bytes of <head> (BaseLayout); 8 KB is ample.
//   <meta name="robots" content="noindex...">  keep it out (bid pages held out
//                                                of search, overflow list pages)
//   <meta name="gh:lastmod" content="...">       the page's <lastmod>: when its
//                                                content really changed
//   <meta name="gh:fresh" content="1">           a newly posted bid: also in the
//                                                "bids-new" sitemap
// See "Freshness" in src/lib/bids/load.ts.
const DIST_DIR = fileURLToPath(new URL('./dist/', import.meta.url));
const metaCache = new Map();
function builtPageMeta(pathname) {
  if (metaCache.has(pathname)) return metaCache.get(pathname);
  let fd;
  let meta = { noindex: false, lastmod: null, fresh: false };
  try {
    fd = openSync(`${DIST_DIR}${pathname.replace(/^\//, '')}index.html`, 'r');
    const buf = Buffer.alloc(8192);
    const head = buf.toString('utf8', 0, readSync(fd, buf, 0, buf.length, 0));
    meta = {
      noindex: /<meta name="robots" content="noindex/.test(head),
      lastmod: head.match(/<meta name="gh:lastmod" content="([^"]+)"/)?.[1] ?? null,
      fresh: /<meta name="gh:fresh" content="1"/.test(head),
    };
  } catch {
    // not a built page (or unreadable): no extra facts
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  metaCache.set(pathname, meta);
  return meta;
}
const pathOf = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

// The sitemap in parts, so Search Console's Pages report can be filtered by
// part and Google can re-read the small, changing ones cheaply:
//   sitemap-bids-new-0.xml   bids posted in the last 3 days (also in bids)
//   sitemap-bids-0.xml       one page per bid
//   sitemap-bid-lists-0.xml  /bids/, state, category and category-in-state lists
//   sitemap-pages-0.xml      everything else
// A bid page is /bids/{place}/{slug}/; /bids/{category}/{place}/ is a list.
// Readers of the sitemap go through sitemap-index.xml (check-links.mjs,
// submit-indexnow.mjs, the weekly report).
const PLACE_SLUGS = new Set([
  ...Object.keys(STATES),
  'puerto-rico', 'guam', 'us-virgin-islands', 'american-samoa', 'northern-mariana-islands', 'federal',
]);
function bidPathKind(pathname) {
  const seg = pathname.split('/').filter(Boolean);
  if (seg[0] !== 'bids') return null;
  if (seg.length === 3 && !PLACE_SLUGS.has(seg[2]) && seg[1] !== 'dla-parts') return 'bid';
  return 'list';
}

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      // lastmod only where the page carries a real date (gh:lastmod: bid pages
      // and bid lists); never the build date, a fake freshness signal that
      // teaches crawlers to distrust the field. Google ignores changefreq and
      // priority.
      serialize: (item) => {
        const { lastmod } = builtPageMeta(pathOf(item.url));
        return lastmod ? { ...item, lastmod } : item;
      },
      chunks: {
        'bids-new': (item) => (builtPageMeta(pathOf(item.url)).fresh ? item : undefined),
        bids: (item) => (bidPathKind(pathOf(item.url)) === 'bid' ? item : undefined),
        'bid-lists': (item) => (bidPathKind(pathOf(item.url)) === 'list' ? item : undefined),
      },
      //
      // Every indexable page Astro builds is auto-included — the Insights hub,
      // methodology, all NAICS/agency/state dashboards, the flagship rankings,
      // and each week's report pages (which the Monday cron adds on every
      // rebuild). Excluded: the /embed/ chart iframes (noindex; the parent page
      // is the canonical target), and any entity page the guardrails marked
      // noindex, and any built page carrying a noindex tag (bid pages held out
      // of search) — listing any of them would submit noindex URLs to search
      // engines, and IndexNow (scripts/submit-indexnow.mjs) reads this sitemap.
      filter: (page) => {
        if (page.includes('/embed/')) return false;
        try {
          const { pathname } = new URL(page);
          return !NOINDEX_PATHS.has(pathname) && !builtPageMeta(pathname).noindex;
        } catch {
          return true;
        }
      },
    }),
  ],
});
