// /bids/posted.json: every indexable bid page and the date the agency posted
// it, for the weekly report's "new bids shown in Google within 7 days" line
// (scripts/report/weekly-report.mjs). The same facts are on the pages; this is
// them in one file. Kept out of crawling (public/robots.txt).
import type { APIRoute } from 'astro';
import { getBidIndex } from '../../lib/bids/load';

export const GET: APIRoute = async () => {
  const index = await getBidIndex();
  const rows = index.bids
    .filter((b) => b.indexable && b.postedAt && Number.isFinite(Date.parse(b.postedAt)))
    .map((b) => ({ p: b.path, d: new Date(b.postedAt!).toISOString().slice(0, 10) }));
  return new Response(JSON.stringify({ builtAt: index.builtAt.toISOString(), bids: rows }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
