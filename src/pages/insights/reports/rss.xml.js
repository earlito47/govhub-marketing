// RSS feed of weekly reports (spec 5). Hand-rolled to avoid a new dependency.
import { SITE_URL } from '../../../config';

const files = import.meta.glob('../../../data/insights/reports/*/*.json', { eager: true });

const SHORT = {
  'top-agencies': 'Top agencies',
  'largest-awards': 'Largest awards',
  'most-active-naics': 'Most active markets',
  'state-movers': 'Top states',
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export async function GET() {
  const items = Object.values(files)
    .map((m) => m.default)
    .sort((a, b) => (b.publishedDate ?? b.updated).localeCompare(a.publishedDate ?? a.updated))
    .map((p) => {
      const link = `${SITE_URL}/insights/reports/${p.week}/${p.slug}/`;
      const pubDate = new Date(`${p.publishedDate ?? p.updated}T09:00:00Z`).toUTCString();
      const title = `${SHORT[p.slug] ?? p.slug} — ${p.fyWindow.label.replace('Week of ', 'week of ')}`;
      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${esc(p.metaDescription)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>GovHub Insights — Weekly Federal Contracting Reports</title>
    <link>${SITE_URL}/insights/reports/</link>
    <description>Dated weekly snapshots of federal contract activity from USAspending.gov data.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
