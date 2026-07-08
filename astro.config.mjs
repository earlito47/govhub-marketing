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
    }),
  ],
});
