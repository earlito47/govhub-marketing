import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE_URL = 'https://www.govhub.online';

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
      // rebuild). Exclude only the /embed/ chart pages: they are noindex
      // iframes (the parent page is the canonical target), so listing them
      // would submit noindex URLs to search engines.
      filter: (page) => !page.includes('/embed/'),
    }),
  ],
});
