// Guards SERP metadata lengths across the built site so title/description
// bloat never regresses (SEOptimer/SERP budgets: title ~50–60, description
// ~120–160 chars). Warns inside a small grace band; fails the build beyond it.
//
// Run after `astro build`: node scripts/check-meta.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;

const TITLE_FAIL = 70; // > this fails; 61–70 warns
const TITLE_WARN = 60;
const DESC_FAIL = 170; // > this fails; 161–170 warns
const DESC_WARN = 160;

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const htmlFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) htmlFiles.push(p);
  }
})(DIST);

let warnings = 0;
let failures = 0;

for (const file of htmlFiles) {
  const page = '/' + relative(DIST, file).replace(/index\.html$/, '');
  if (page === '/404.html') continue; // noindex error page — exempt

  const html = readFileSync(file, 'utf8');
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');

  const problems = [];
  if (!title) problems.push(['FAIL', 'missing <title>']);
  else if (title.length > TITLE_FAIL) problems.push(['FAIL', `title ${title.length} chars (max ${TITLE_FAIL}): ${title}`]);
  else if (title.length > TITLE_WARN) problems.push(['warn', `title ${title.length} chars (ideal ≤${TITLE_WARN}): ${title}`]);

  if (!desc) problems.push(['FAIL', 'missing meta description']);
  else if (desc.length > DESC_FAIL) problems.push(['FAIL', `description ${desc.length} chars (max ${DESC_FAIL})`]);
  else if (desc.length > DESC_WARN) problems.push(['warn', `description ${desc.length} chars (ideal ≤${DESC_WARN})`]);

  for (const [level, msg] of problems) {
    console.log(`${level === 'FAIL' ? '✗' : '⚠'} ${page} — ${msg}`);
    if (level === 'FAIL') failures++;
    else warnings++;
  }
}

console.log(`meta guard: ${htmlFiles.length} pages, ${failures} failures, ${warnings} warnings`);
if (failures > 0) process.exit(1);
