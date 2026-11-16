// /bids/new.xml: RSS feed of bids posted in the last FRESH_DAYS days, newest
// first; a bid whose agency gives no posted date counts from the day GovHub
// first listed it (appearedAt). Submit it in Search Console (Sitemaps, add
// "bids/new.xml"): Google reads RSS as a sitemap and re-fetches small feeds
// often, which is its own advice for fresh content (XML sitemap for every
// URL, a feed for the recent ones). The same bids are in the sitemap's "bids-new" part (astro.config.mjs).
// See "Freshness" in src/lib/bids/load.ts. Hand-rolled like
// src/pages/insights/reports/rss.xml.js, no dependency.
import type { APIRoute } from 'astro';
import { SITE_URL } from '../../config';
import { FRESH_DAYS, appearedAt, formatShortDate, getBidIndex, isFresh } from '../../lib/bids/load';

/** Google reads up to 50,000 URLs from a feed; a few days of bids is under 3,000. */
const MAX_ITEMS = 5000;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const index = await getBidIndex();
  const now = index.builtAt.getTime();
  // isFresh() guarantees appearedAt() is a date.
  const fresh = index.bids
    .filter((b) => isFresh(b, index.builtAt))
    .map((b) => ({ b, t: appearedAt(b, now)! }))
    .sort((x, y) => y.t - x.t || x.b.path.localeCompare(y.b.path))
    .slice(0, MAX_ITEMS);

  const items = fresh
    .map(({ b, t }) => {
      const link = `${SITE_URL}${b.path}`;
      const due = b.dueAt ? ` Due ${formatShortDate(b.dueAt, b.timeZone)}.` : '';
      const where = b.stateName ?? (b.federal ? 'Federal' : '');
      return `    <item>
      <title>${esc(b.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${new Date(t).toUTCString()}</pubDate>
      <description>${esc(`${b.summary}${due}${b.agency ? ` ${b.agency}.` : ''}${where ? ` ${where}.` : ''}`)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>New government bids | GovHub</title>
    <link>${SITE_URL}/bids/</link>
    <atom:link href="${SITE_URL}/bids/new.xml" rel="self" type="application/rss+xml" />
    <description>Federal, state and local government bids posted or newly listed in the last ${FRESH_DAYS} days, newest first, each with a plain-English summary and its deadline.</description>
    <language>en-us</language>
    <lastBuildDate>${index.builtAt.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
