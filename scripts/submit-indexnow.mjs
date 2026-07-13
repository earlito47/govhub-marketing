// Submits every URL in the built sitemap to IndexNow (api.indexnow.org), which
// fans out to Bing, Yandex, and other participating search engines so they
// crawl changes faster than waiting for a routine sitemap re-fetch. Google
// does not participate in IndexNow — GSC sitemap submission covers Google.
//
// Verification key lives at public/<key>.txt (served at https://<host>/<key>.txt)
// so IndexNow can confirm we own the host. Regenerating the key means deleting
// the old .txt file and updating KEY/KEY_LOCATION below together.
//
// Runs automatically on every push to main via .github/workflows/indexnow.yml.
// Can also be run manually after a deploy: node scripts/submit-indexnow.mjs
import { readFileSync } from 'node:fs';

const HOST = 'www.govhub.online';
const KEY = 'ee8d6b02d6564ed095a46c902816d279';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP_PATH = new URL('../dist/sitemap-0.xml', import.meta.url).pathname;

const xml = readFileSync(SITEMAP_PATH, 'utf8');
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (urlList.length === 0) {
  console.error('No URLs found in sitemap-0.xml — did you run `npm run build` first?');
  process.exit(1);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
});

console.log(`IndexNow: submitted ${urlList.length} URLs — ${res.status} ${res.statusText}`);
if (!res.ok) process.exit(1);
