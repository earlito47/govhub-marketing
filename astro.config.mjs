import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

// Any other page that ships <meta name="robots" content="noindex..."> (bid
// pages held out of search, see src/lib/bids/load.ts NoindexReason) is found
// by reading the built HTML: the sitemap is written in astro:build:done, after
// every page is on disk, so the page itself is the source of truth and no
// second list has to be kept in step. The tag sits in the first few hundred
// bytes of <head>; 8 KB is ample.
const DIST_DIR = fileURLToPath(new URL('./dist/', import.meta.url));
function builtPageIsNoindex(pathname) {
  let fd;
  try {
    fd = openSync(`${DIST_DIR}${pathname.replace(/^\//, '')}index.html`, 'r');
    const buf = Buffer.alloc(8192);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return /<meta name="robots" content="noindex/.test(buf.toString('utf8', 0, n));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      // No lastmod: stamping every URL with the build date is a fake
      // freshness signal that teaches crawlers to distrust it.
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
          return !NOINDEX_PATHS.has(pathname) && !builtPageIsNoindex(pathname);
        } catch {
          return true;
        }
      },
    }),
  ],
});
