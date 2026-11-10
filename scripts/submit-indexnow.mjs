// Submits sitemap URLs to IndexNow (api.indexnow.org), which forwards to Bing,
// Yandex, Seznam and the other participating engines, so they learn about new
// and changed pages and crawl changes faster than waiting for a routine sitemap
// re-fetch. Google does not participate in IndexNow; the sitemap (with
// <lastmod>) and the /bids/new.xml feed cover Google.
//
//   node scripts/submit-indexnow.mjs
//       every URL in the built sitemap (dist/sitemap-index.xml and its parts);
//       run after `npm run build` (the indexnow workflow, on every push)
//   node scripts/submit-indexnow.mjs --live https://www.govhub.online/sitemap-bids-new-0.xml
//       the URLs in one live sitemap (rebuild-bids: the bids posted in the last
//       3 days, after a scheduled rebuild that has no push behind it)
//
// The key is public by design: public/<KEY>.txt, served at
// https://www.govhub.online/<KEY>.txt, lets IndexNow confirm we own the host.
// Regenerating the key means deleting the old .txt file and updating
// KEY/KEY_LOCATION below together.

import { existsSync, readFileSync } from 'node:fs';

const HOST = 'www.govhub.online';
const SITE = `https://${HOST}`;
const KEY = 'ee8d6b02d6564ed095a46c902816d279';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const DIST = new URL('../dist/', import.meta.url).pathname;

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

async function urlsToSubmit() {
  const i = process.argv.indexOf('--live');
  if (i !== -1) {
    const res = await fetch(process.argv[i + 1]);
    if (res.status === 404) return []; // no part: nothing new in the window
    if (!res.ok) throw new Error(`${process.argv[i + 1]}: HTTP ${res.status}`);
    return locs(await res.text());
  }
  const index = `${DIST}sitemap-index.xml`;
  if (!existsSync(index)) throw new Error('No dist/sitemap-index.xml: did you run `npm run build` first?');
  const parts = locs(readFileSync(index, 'utf8'))
    .filter((u) => u.startsWith(SITE))
    .map((u) => `${DIST}${u.slice(SITE.length + 1)}`)
    .filter((f) => existsSync(f));
  return [...new Set(parts.flatMap((f) => locs(readFileSync(f, 'utf8'))))];
}

const live = process.argv.includes('--live');
const urlList = await urlsToSubmit();
if (urlList.length === 0) {
  // A built sitemap with no URLs means a broken build; a live new-bids part
  // with none just means nothing was posted in the window.
  if (live) {
    console.log('IndexNow: no new URLs to submit.');
    process.exit(0);
  }
  console.error('No URLs found in dist/sitemap-index.xml and its parts: did you run `npm run build` first?');
  process.exit(1);
}

// IndexNow takes at most 10,000 URLs per request, and /bids/ alone puts the
// site past that, so submit in batches.
const BATCH = 10000;
let failed = false;
for (let i = 0; i < urlList.length; i += BATCH) {
  const batch = urlList.slice(i, i + BATCH);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: batch }),
  });
  console.log(`IndexNow: submitted URLs ${i + 1}-${i + batch.length} of ${urlList.length}: ${res.status} ${res.statusText}`);
  if (!res.ok) failed = true;
}
if (failed) process.exit(1);
