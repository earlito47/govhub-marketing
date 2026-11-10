// Link guard for the built site: every <a href> on every page in dist/.
//
// FAILS the build on
//   wrong_domain        links to govhub.com, which is not our site (an AI-written
//                       post sent four links there; caught by Ahrefs 2026-11-03)
//   own_host            our own pages linked via the apex or http://, which redirect
//   links_to_redirect   an internal link whose path is a rule in _redirects
//   broken_internal     an internal link to a page or file that is not built
//   missing_fragment    a #fragment with no matching id on the target page
//   orphan              a sitemap URL that no other page links to
//   unreachable         a sitemap URL that cannot be reached by following links
//                       from the homepage
//
// Orphans are the reason this exists: on 2026-11-03, 2,099 indexable bid pages
// had no internal link at all, because hubs listed only their first 200 bids.
// A page Google finds only in the sitemap tends to sit at "Discovered,
// currently not indexed".
//
// Run after `astro build` (npm run verify does). Pages served by Cloudflare
// Pages Functions (functions/) are not in dist/ and count as existing.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SITE = 'https://www.govhub.online';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const toUrlPath = (file) => '/' + relative(DIST, file).split(sep).join('/');

const files = new Set();
const pages = new Map(); // path -> { ids, hrefs, follow }
for (const file of walk(DIST)) {
  const urlPath = toUrlPath(file);
  files.add(urlPath);
  if (!file.endsWith('index.html')) continue;
  const path = urlPath.slice(0, -'index.html'.length);
  const html = readFileSync(file, 'utf8');
  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] || '';
  pages.set(path, {
    ids: new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])),
    hrefs: [...new Set([...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))],
    follow: !/nofollow/.test(robots),
  });
}

// Routes served by Pages Functions: functions/a/b.js -> /a/b
const functionRoutes = new Set();
const FN = join(ROOT, 'functions');
if (existsSync(FN)) {
  for (const f of walk(FN)) {
    const route = '/' + relative(FN, f).split(sep).join('/').replace(/\.(js|ts|mjs)$/, '').replace(/\/index$/, '/');
    functionRoutes.add(route);
  }
}

const redirects = new Map();
const redirectsFile = existsSync(join(DIST, '_redirects')) ? join(DIST, '_redirects') : join(ROOT, 'public', '_redirects');
if (existsSync(redirectsFile)) {
  for (const line of readFileSync(redirectsFile, 'utf8').split('\n')) {
    const [from, to] = line.trim().split(/\s+/);
    if (from && to && !from.startsWith('#') && !from.includes('*') && !from.includes(':')) redirects.set(from, to);
  }
}

const exists = (p) => pages.has(p) || files.has(p) || files.has(`${p}index.html`) || functionRoutes.has(p);

const problems = {};
const add = (kind, key, src) => ((problems[kind] ??= new Map()).get(key)?.add(src) ?? problems[kind].set(key, new Set([src])));
const inbound = new Map(); // target path -> Set(source path)
const edges = new Map(); // source path -> Set(target path), followed links only

for (const [src, page] of pages) {
  const out = new Set();
  for (let href of page.hrefs) {
    if (/^(mailto:|tel:|javascript:)/.test(href)) continue;
    if (href.startsWith('#')) {
      if (href.length > 1 && !page.ids.has(decodeURIComponent(href.slice(1)))) add('missing_fragment', `${src}${href}`, src);
      continue;
    }
    const abs = href.match(/^https?:\/\/([^/?#]+)/i);
    if (abs) {
      const host = abs[1].toLowerCase();
      if (host === 'govhub.com' || host === 'www.govhub.com') { add('wrong_domain', href, src); continue; }
      if (host !== 'govhub.online' && host !== 'www.govhub.online') continue; // external
      if (!href.startsWith(SITE)) add('own_host', href, src);
      href = href.replace(/^https?:\/\/(www\.)?govhub\.online/i, '') || '/';
    }
    if (!href.startsWith('/')) continue;
    const [beforeHash, frag = ''] = href.split('#');
    const path = beforeHash.split('?')[0] || '/';
    if (redirects.has(path)) { add('links_to_redirect', `${path} -> ${redirects.get(path)}`, src); continue; }
    if (!exists(path)) {
      add('broken_internal', exists(`${path}/`) ? `${path} (missing trailing slash)` : path, src);
      continue;
    }
    if (frag && pages.has(path) && !pages.get(path).ids.has(decodeURIComponent(frag))) add('missing_fragment', `${path}#${frag}`, src);
    if (path !== src) {
      (inbound.get(path) ?? inbound.set(path, new Set()).get(path)).add(src);
      out.add(path);
    }
  }
  if (page.follow) edges.set(src, out);
}

// Sitemap URLs: the indexable pages.
// The sitemap is in parts (astro.config.mjs chunks): read every part the index
// lists that was built here. A URL can be in two parts (bids-new and bids).
const locs = (file) => [...readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const parts = locs(join(DIST, 'sitemap-index.xml'))
  .filter((u) => u.startsWith(SITE))
  .map((u) => join(DIST, u.slice(SITE.length)))
  .filter((f) => f.endsWith('.xml') && existsSync(f) && /\/sitemap-[^/]+\.xml$/.test(f));
if (!parts.length) throw new Error('link guard: no sitemap parts found from dist/sitemap-index.xml');
const sitemap = [...new Set(parts.flatMap(locs))].map((u) => u.replace(SITE, '') || '/');
for (const p of sitemap) if (p !== '/' && !inbound.get(p)?.size) add('orphan', p, '(sitemap)');

const seen = new Set(['/']);
const queue = ['/'];
while (queue.length) {
  for (const next of edges.get(queue.shift()) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
}
for (const p of sitemap) if (!seen.has(p)) add('unreachable', p, '(from /)');

const kinds = Object.keys(problems);
let total = 0;
for (const kind of kinds) {
  const items = [...problems[kind]];
  total += items.length;
  console.error(`✗ ${kind}: ${items.length}`);
  for (const [key, srcs] of items.slice(0, 10)) console.error(`    ${key}  <- ${[...srcs].slice(0, 2).join(', ')}${srcs.size > 2 ? ` (+${srcs.size - 2})` : ''}`);
}
// Not a failure, but worth watching: Ahrefs flags these too. LINKS_VERBOSE=1 lists them.
const oneLink = sitemap.filter((p) => inbound.get(p)?.size === 1);
if (process.env.LINKS_VERBOSE) console.log(oneLink.join('\n'));
console.log(`link guard: ${pages.size} pages, ${sitemap.length} in the sitemap, ${total} problems; ${oneLink.length} sitemap pages have exactly one incoming link`);
process.exit(total ? 1 : 0);
