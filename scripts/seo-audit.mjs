#!/usr/bin/env node
// One-off SEO / indexability audit. Read-only. Answers the roadmap's
// data-driven Phase 1 questions from repo state (no external APIs):
//   1. Indexable footprint by type (scaled-content % concern)
//   2. Which pages get NO contextual inbound link (nav/footer + same-cluster
//      siblings excluded) — the real "crawled/discovered - not indexed" risk
//   3. Do programmatic entity pages link OUT to a money/feature page?
//   4. Title templating sameness + brand-in-title (Phase 1 title audit)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const p = (...a) => join(ROOT, ...a);
const read = (f) => readFileSync(f, 'utf8');
const jsonDir = (d) => (existsSync(p(d)) ? readdirSync(p(d)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(read(p(d, f)))) : []);

// ---- 1. Route inventory -----------------------------------------------
const states = jsonDir('src/data/insights/state');
const naics = jsonDir('src/data/insights/naics');
const agency = jsonDir('src/data/insights/agency');
const setaside = jsonDir('src/data/insights/setaside');
const rankings = jsonDir('src/data/insights/rankings');
const reports = existsSync(p('src/data/insights/reports'))
  ? readdirSync(p('src/data/insights/reports')).flatMap((wk) => {
      const dir = p('src/data/insights/reports', wk);
      if (!existsSync(dir) || !readdirSync(dir)) return [];
      return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ ...JSON.parse(read(join(dir, f))), _week: wk, _slug: f.replace('.json', '') }));
    })
  : [];

const url = {
  state: (s) => `/insights/state/${s.slug}/`,
  naics: (s) => `/insights/naics/${s.slug}/`,
  agency: (s) => `/insights/agency/${s.slug}/`,
  setaside: (s) => `/insights/set-aside/${s.slug}/`,
  ranking: (s) => `/insights/${s.slug}/`,
  report: (s) => `/insights/reports/${s._week}/${s._slug}/`,
};

const mk = (type, u, s) => ({ type, u, title: s.title, related: s.related || [], crossLinks: s.crossLinks || [], raw: s });
const entities = [
  ...states.map((s) => mk('state', url.state(s), s)),
  ...naics.map((s) => mk('naics', url.naics(s), s)),
  ...agency.map((s) => mk('agency', url.agency(s), s)),
  ...setaside.map((s) => mk('setaside', url.setaside(s), s)),
  ...rankings.map((s) => mk('ranking', url.ranking(s), s)),
  ...reports.map((s) => mk('report', url.report(s), s)),
];

console.log('=== 1. INDEXABLE FOOTPRINT ===');
const byType = {};
for (const e of entities) byType[e.type] = (byType[e.type] || 0) + 1;
const marketing = { blog: 9, solutions: 9, vs: 4, alternatives: 4, for: 3, 'case-studies': 6, templates: 1, other_static: 12 };
const progTotal = entities.length;
console.log('programmatic insights:', byType, '=> total', progTotal);
console.log('marketing/static (approx):', marketing);
const grand = progTotal + Object.values(marketing).reduce((a, b) => a + b, 0);
console.log(`GRAND TOTAL indexable ~${grand}; programmatic share ~${Math.round((progTotal / grand) * 100)}%`);

// ---- 2. Contextual inbound links --------------------------------------
// Global nav/footer reach every page; we EXCLUDE them (they don't signal
// topical relevance). We also mark same-cluster related links separately.
const hubLinksAll = true; // insights/index links to every entity via cards
const inbound = new Map(entities.map((e) => [e.u, { hub: hubLinksAll ? 1 : 0, sibling: 0, crossType: 0, marketing: 0 }]));

// related[] (same-cluster siblings) + crossLinks[] (cross-cluster) between entities
for (const e of entities) {
  for (const r of e.related) {
    if (!inbound.has(r.href)) continue;
    const target = entities.find((x) => x.u === r.href);
    if (target && target.type === e.type) inbound.get(r.href).sibling++;
    else inbound.get(r.href).crossType++;
  }
  for (const r of e.crossLinks) {
    if (!inbound.has(r.href)) continue;
    inbound.get(r.href).crossType++;
  }
  // Table-cell links are real links Google follows — the by-state ranking table
  // links every state, the agency ranking links every agency, etc. Count them.
  for (const t of e.raw.tables || []) {
    for (const row of t.rows || []) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        const href = cell && typeof cell === 'object' ? cell.href : null;
        if (href && inbound.has(href)) inbound.get(href).crossType++;
      }
    }
  }
}

// Any link into an entity URL from a MARKETING page (blog/solutions/home/etc.)?
const marketingFiles = [
  ...globSync(p('src/pages/**/*.astro')),
  ...globSync(p('src/content/blog/*.md')),
  ...globSync(p('src/data/*.ts')),
].filter((f) => !f.includes('/insights/') && !f.includes('/data/insights/'));
const marketingText = marketingFiles.map(read).join('\n');
for (const e of entities) {
  if (marketingText.includes(e.u)) inbound.get(e.u).marketing++;
}

const noContextual = entities.filter((e) => {
  const i = inbound.get(e.u);
  return i.marketing === 0 && i.crossType === 0; // only hub + templated siblings
});
console.log('\n=== 2. WEAK-INLINK PAGES (only hub + same-cluster siblings; 0 marketing, 0 cross-type) ===');
console.log(`${noContextual.length} / ${entities.length} entity pages have NO contextual link from a marketing page or a different cluster.`);
const weakByType = {};
for (const e of noContextual) weakByType[e.type] = (weakByType[e.type] || 0) + 1;
console.log('by type:', weakByType);
console.log('=> These rely on the single Insights hub + templated sibling links = the "discovered/crawled - not indexed" risk.');

// ---- 3. Do entity pages link OUT to a money/feature page? --------------
console.log('\n=== 3. ENTITY -> MONEY-PAGE OUTBOUND ===');
// Every state/agency/naics/setaside page renders the EntityDashboard tool-link
// block (contextual links to /solutions/ + /pricing/), so entity types get a
// money-page link from the template regardless of JSON. Rankings/reports use
// their own layout. Count entity types as covered by the template.
const templateCovered = entities.filter((e) => ['state', 'agency', 'naics', 'setaside'].includes(e.type)).length;
console.log(`${templateCovered}/${entities.length} entities render the EntityDashboard tool-link block (-> /solutions/ + /pricing/).`);
const withCross = entities.filter((e) => e.crossLinks.length > 0).length;
console.log(`${withCross}/${entities.length} entities also carry data-mined crossLinks[] to other clusters.`);

// ---- 4. Title templating + brand-in-title -----------------------------
console.log('\n=== 4. TITLE TEMPLATING & BRAND-IN-TITLE ===');
const titles = entities.map((e) => e.title || '');
const brandInTitle = titles.filter((t) => /govhub/i.test(t)).length;
console.log(`entity titles containing "GovHub": ${brandInTitle}/${titles.length}`);
// normalize: replace digits/$ and known slugs to expose the template
const norm = (t) => t.replace(/[\d.,$]+/g, '#').replace(/\b[A-Z][a-z]+\b/g, 'X');
const patterns = {};
for (const e of entities) {
  const key = `${e.type}: ${norm(e.title)}`;
  patterns[key] = (patterns[key] || 0) + 1;
}
const bigClusters = Object.entries(patterns).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]);
console.log('identical title-shape clusters (>=5 pages share one template):');
for (const [k, n] of bigClusters) console.log(`  ${n}x  ${k}`);
