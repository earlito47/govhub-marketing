import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
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
    ranking: '/insights/',
  };
  const paths = new Set();
  for (const kind of ['naics', 'agency', 'state', 'setaside', 'rankings']) {
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
      // noindex — listing either would submit noindex URLs to search engines.
      filter: (page) => {
        if (page.includes('/embed/')) return false;
        try {
          return !NOINDEX_PATHS.has(new URL(page).pathname);
        } catch {
          return true;
        }
      },
    }),
  ],
});
