// GovHub weekly report: the Monday email on search, indexing, trials and AI cost.
//
// One email, last week against the week before:
//   1. Headline numbers: Google clicks and impressions, organic sessions, new
//      trials, AI spend, auto-started analyses, 404s Google knows about.
//   2. Trials: every new trial (no names or emails) with its source, first
//      page, profile state, projects and AI cost, plus AI spend by account kind
//      and the 30-day cost per trial. From the app database's report_trials()
//      (strata-parse 20261109200000), called with the service-role key.
//   3. Product: GA4 counts of the app's own events (signups, analyses,
//      proposals, demo clicks).
//   4. Search: Search Console clicks by site section, top pages and queries,
//      pages shown often but never clicked, pages Google showed for the first
//      time.
//   5. Indexing: a URL Inspection sample by section (the Pages report has no
//      API), every page Google showed in the last four weeks checked for 404,
//      the share of new bids Google showed within 7 days of posting, and the
//      sitemap size.
//
// Every section degrades on its own: one that cannot be gathered says so and
// the email still goes, like scripts/digest/marketing-digest.mjs.
//
// Usage:  node scripts/report/weekly-report.mjs [--dry-run] [--end YYYY-MM-DD]
//           [--sample N] [--no-inspect] [--no-404] [--html file]
//   The week is the 7 days ending --end (default yesterday, UTC): run on a
//   Monday, that is Monday to Sunday.
// Env:    GSC_SERVICE_ACCOUNT_JSON   Search Console + GA4 (required for those)
//         SUPABASE_SERVICE_ROLE_KEY  trials and AI cost (section says so if absent)
//         RESEND_API_KEY             to send (not needed with --dry-run)
//         WEEKLY_REPORT_TO           recipients, comma-separated; else DIGEST_TO;
//                                    else the digest's defaults

import { writeFileSync } from 'node:fs';
import { STATES } from '../insights/lib/slugs.mjs';
import { ga4Report, gscQuery, inspectUrl } from './google.mjs';

const SITE = 'https://www.govhub.online';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iqekrwearenblsmhvdjn.supabase.co';
const TO = (process.env.WEEKLY_REPORT_TO || process.env.DIGEST_TO || 'earljknight@gmail.com,earl@govhub.online')
  .split(',').map((s) => s.trim()).filter(Boolean);
const FROM = 'GovHub Reports <hello@govhub.online>';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const DRY = args.includes('--dry-run');
// URL Inspection allows 2,000 calls a day per property; a week's sample is ~130.
const SAMPLE = Number(arg('--sample') ?? 130);

// ---- The week ----------------------------------------------------------------
const DAY = 864e5;
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
const endT = arg('--end') ? Date.parse(`${arg('--end')}T00:00:00Z`) : today - DAY;
const W = { start: isoDay(endT - 6 * DAY), end: isoDay(endT) };
const P = { start: isoDay(endT - 13 * DAY), end: isoDay(endT - 7 * DAY) };
const short = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const RANGE = `${short(W.start)} to ${short(W.end)}`;

// ---- Site sections -----------------------------------------------------------
const PLACES = new Set([...Object.keys(STATES), 'puerto-rico', 'guam', 'us-virgin-islands', 'american-samoa', 'northern-mariana-islands', 'federal']);
const SECTIONS = ['Bid pages', 'Bid lists', 'DLA parts list', 'Insights', 'Blog', 'Comparisons', 'Solutions', 'Home', 'Other'];
function sectionOf(url) {
  let p;
  try { p = new URL(url).pathname; } catch { return 'Other'; }
  const seg = p.split('/').filter(Boolean);
  if (!seg.length) return 'Home';
  switch (seg[0]) {
    case 'bids':
      if (seg[1] === 'dla-parts') return 'DLA parts list';
      if (seg.length <= 2 || seg.includes('page')) return 'Bid lists';
      // /bids/{category}/{state}/ is a list; /bids/{state}/{slug}/ is one bid.
      return PLACES.has(seg[2]) ? 'Bid lists' : 'Bid pages';
    case 'insights': return 'Insights';
    case 'blog': return 'Blog';
    case 'vs': case 'alternatives': return 'Comparisons';
    case 'solutions': return 'Solutions';
    default: return 'Other';
  }
}
const pathOf = (url) => { try { return new URL(url).pathname; } catch { return url; } };

// ---- Small helpers -----------------------------------------------------------
const n0 = (x) => Math.round(x ?? 0).toLocaleString('en-US');
const usd = (x) => `$${(x ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (a, b) => (!b ? (a ? 'new' : '') : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`);
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// Deterministic shuffle, so a week's sample is reproducible.
function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 2 ** 32;
}

// ---- 1. Search Console ---------------------------------------------------------
async function gatherSearch() {
  const [[tot], [totPrev], pages, pagesPrev, queries, prior] = await Promise.all([
    gscQuery(W),
    gscQuery(P),
    gscQuery({ ...W, dims: ['page'] }),
    gscQuery({ ...P, dims: ['page'] }),
    gscQuery({ ...W, dims: ['query'], rowLimit: 1000, maxRows: 1000 }),
    gscQuery({ start: isoDay(endT - 34 * DAY), end: isoDay(endT - 7 * DAY), dims: ['page'] }),
  ]);
  const bySection = Object.fromEntries(SECTIONS.map((s) => [s, { clicks: 0, imps: 0, clicksPrev: 0, impsPrev: 0, pages: 0 }]));
  for (const r of pages) { const s = bySection[sectionOf(r.keys[0])]; s.clicks += r.clicks; s.imps += r.impressions; s.pages++; }
  for (const r of pagesPrev) { const s = bySection[sectionOf(r.keys[0])]; s.clicksPrev += r.clicks; s.impsPrev += r.impressions; }
  const prevClicks = new Map(pagesPrev.map((r) => [r.keys[0], r.clicks]));
  const seen = new Set(prior.map((r) => r.keys[0]));
  const fresh = pages.filter((r) => !seen.has(r.keys[0]));
  const freshBySection = {};
  for (const r of fresh) freshBySection[sectionOf(r.keys[0])] = (freshBySection[sectionOf(r.keys[0])] ?? 0) + 1;
  return {
    totals: { clicks: tot?.clicks ?? 0, imps: tot?.impressions ?? 0, ctr: tot?.ctr ?? 0, position: tot?.position ?? 0 },
    totalsPrev: { clicks: totPrev?.clicks ?? 0, imps: totPrev?.impressions ?? 0, ctr: totPrev?.ctr ?? 0, position: totPrev?.position ?? 0 },
    bySection,
    pagesShown: pages.length,
    topPages: [...pages].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 10)
      .map((r) => ({ url: r.keys[0], clicks: r.clicks, clicksPrev: prevClicks.get(r.keys[0]) ?? 0, imps: r.impressions, position: r.position })),
    topQueries: queries.filter((r) => r.clicks > 0).slice(0, 10).map((r) => ({ query: r.keys[0], clicks: r.clicks, imps: r.impressions, position: r.position })),
    zeroClick: pages.filter((r) => r.clicks === 0 && r.impressions >= 30 && r.position <= 10)
      .sort((a, b) => b.impressions - a.impressions).slice(0, 8)
      .map((r) => ({ url: r.keys[0], imps: r.impressions, position: r.position })),
    fresh: { count: fresh.length, bySection: freshBySection, top: [...fresh].sort((a, b) => b.impressions - a.impressions).slice(0, 5).map((r) => ({ url: r.keys[0], imps: r.impressions, clicks: r.clicks })) },
    recentPages: [...new Set([...pages, ...prior].map((r) => r.keys[0]))],
    impsByUrl: new Map([...prior, ...pages].map((r) => [r.keys[0], r.impressions])),
  };
}

// ---- 2. GA4 -------------------------------------------------------------------
const EVENTS = [
  ['signup_completed', 'Signups'],
  ['login', 'Logins'],
  ['feed_viewed', 'Bid inbox views'],
  ['opportunity_auto_analyze', 'Analyses started automatically (from a bid page)'],
  ['opportunity_analyzed', 'Bids analyzed from the inbox'],
  ['rfp_analyzed', 'RFPs analyzed (all)'],
  ['brief_generated', 'Briefs generated'],
  ['proposal_created', 'Proposals created'],
  ['proposal_exported', 'Proposals exported'],
  ['book_demo_clicked', 'Demo clicks in the app'],
  ['checkout_started', 'Checkouts started'],
];
async function gatherGa4() {
  const inList = { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS.map(([e]) => e) } } };
  const [chan, chanPrev, ev, evPrev] = await Promise.all([
    ga4Report({ ...W, dims: ['sessionDefaultChannelGroup'], mets: ['sessions', 'engagedSessions'] }),
    ga4Report({ ...P, dims: ['sessionDefaultChannelGroup'], mets: ['sessions', 'engagedSessions'] }),
    ga4Report({ ...W, dims: ['eventName'], mets: ['eventCount'], filter: inList }),
    ga4Report({ ...P, dims: ['eventName'], mets: ['eventCount'], filter: inList }),
  ]);
  const toMap = (rows) => new Map(rows.map((r) => [r.dims[0], r.mets]));
  return { channels: toMap(chan), channelsPrev: toMap(chanPrev), events: toMap(ev), eventsPrev: toMap(evPrev) };
}

// ---- 3. Trials and AI cost (app database) ---------------------------------------
async function trialsFor(from, to) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in the repository secrets');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/report_trials`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_from: `${from}T00:00:00Z`, p_to: new Date(Date.parse(`${to}T00:00:00Z`) + DAY).toISOString() }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`report_trials: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}
async function gatherTrials() {
  const [now, prev] = await Promise.all([trialsFor(W.start, W.end), trialsFor(P.start, P.end)]);
  return { now, prev };
}
const spendOutside = (t) => Object.entries(t?.ai_spend ?? {}).filter(([k]) => k !== 'internal').reduce((s, [, v]) => s + v.usd, 0);
const KIND = { trial_self_serve: 'Self-serve', trial_outreach: 'Outreach handover', paying: 'Paying', internal: 'Internal', 'no user (system)': 'No user (system jobs)' };

// ---- 4. Indexing ----------------------------------------------------------------
// The sitemap is in parts (astro.config.mjs): read every part the index lists.
async function gatherSitemap() {
  const get = async (u) => {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`${pathOf(u)}: HTTP ${res.status}`);
    return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  };
  const parts = (await get(`${SITE}/sitemap-index.xml`)).filter((u) => /\/sitemap-[^/]+\.xml$/.test(u));
  const urls = [...new Set((await Promise.all(parts.map(get))).flat())];
  const bySection = {};
  for (const u of urls) bySection[sectionOf(u)] = (bySection[sectionOf(u)] ?? 0) + 1;
  return { urls, bySection };
}

// New bids shown in Google within 7 days of posting. The cohort is the bids
// posted in the week ending 7 days before this report's week ends, so every
// one has had 7 full days; the week before that is the comparison. Bid paths
// and posted dates come from /bids/posted.json (src/pages/bids/posted.json.ts),
// impressions from Search Console by date and page. Measured 2026-11-09 before
// the freshness work (sitemap dates, the new-bids sitemap and feed, twice-daily
// rebuilds): 7% of bids posted Nov 1 to 5 had appeared in Google by Nov 9.
async function gatherNewBidVisibility() {
  const res = await fetch(`${SITE}/bids/posted.json`);
  if (!res.ok) throw new Error(`/bids/posted.json: HTTP ${res.status}`);
  const { bids } = await res.json();
  const plus = (d, n) => isoDay(Date.parse(`${d}T00:00:00Z`) + n * DAY);
  const cohort = (end) => ({ start: plus(end, -6), end });
  const now = cohort(plus(W.end, -7));
  const prev = cohort(plus(W.end, -14));
  const rows = await gscQuery({
    start: prev.start,
    end: W.end,
    dims: ['date', 'page'],
    filters: [{ dimension: 'page', operator: 'contains', expression: '/bids/' }],
  });
  const firstShown = new Map();
  for (const r of rows) {
    if (!r.impressions) continue;
    const [date, page] = r.keys;
    const p = pathOf(page);
    if (!firstShown.has(p) || date < firstShown.get(p)) firstShown.set(p, date);
  }
  const measure = (c) => {
    const list = bids.filter((b) => b.d >= c.start && b.d <= c.end);
    const shown = list.filter((b) => { const f = firstShown.get(b.p); return f && f >= b.d && f <= plus(b.d, 7); }).length;
    return { ...c, n: list.length, shown };
  };
  return { now: measure(now), prev: measure(prev) };
}
const sharePct = (x) => (x?.n ? `${Math.round((x.shown / x.n) * 100)}%` : 'n/a');

// Per section: how many to inspect. Comparisons and Solutions are small and
// commercial, so all of them every week; the rest is a sample.
const QUOTA = { 'Bid pages': 40, 'Bid lists': 15, 'DLA parts list': 1, Insights: 15, Blog: 8, Comparisons: 30, Solutions: 15, Home: 1, Other: 10 };
const ALWAYS = new Set(['Comparisons', 'Solutions', 'DLA parts list', 'Home']);
async function gatherInspection(sitemap) {
  const rand = seeded(W.start);
  const groups = {};
  for (const u of sitemap.urls) (groups[sectionOf(u)] ??= []).push(u);
  const always = [];
  let rest = [];
  for (const [s, list] of Object.entries(groups)) {
    const shuffled = [...list].sort(() => rand() - 0.5);
    (ALWAYS.has(s) ? always : rest).push(...shuffled.slice(0, QUOTA[s] ?? 5).map((u) => [s, u]));
  }
  // The commercial pages are always checked; the sample trims the rest.
  rest = rest.sort(() => rand() - 0.5).slice(0, Math.max(0, SAMPLE - always.length));
  const pick = [...always, ...rest];
  const results = await pool(pick, 4, async ([s, u]) => {
    try { return { s, u, ...(await inspectUrl(u)) }; } catch (e) { return { s, u, coverage: `error: ${e.message.slice(0, 60)}` }; }
  });
  const table = {};
  for (const r of results) {
    const t = (table[r.s] ??= { n: 0, indexed: 0, states: {} });
    t.n++;
    if (/indexed/i.test(r.coverage) && !/not indexed/i.test(r.coverage)) t.indexed++;
    t.states[r.coverage] = (t.states[r.coverage] ?? 0) + 1;
  }
  return { n: results.length, table, notIndexedCommercial: results.filter((r) => ['Comparisons', 'Solutions', 'DLA parts list'].includes(r.s) && !(/indexed/i.test(r.coverage) && !/not indexed/i.test(r.coverage))).map((r) => ({ u: r.u, coverage: r.coverage })) };
}

async function gather404(search) {
  const urls = search.recentPages.filter((u) => u.startsWith(SITE));
  const status = await pool(urls, 16, async (u) => {
    try {
      const res = await fetch(u, { redirect: 'manual', headers: { 'user-agent': 'GovHubWeeklyReport/1.0 (+https://www.govhub.online)' }, signal: AbortSignal.timeout(15000) });
      await res.arrayBuffer().catch(() => null);
      return res.status;
    } catch { return 0; }
  });
  const notFound = urls.map((u, i) => ({ u, st: status[i] })).filter((x) => x.st === 404);
  const bySection = {};
  for (const x of notFound) bySection[sectionOf(x.u)] = (bySection[sectionOf(x.u)] ?? 0) + 1;
  return {
    checked: urls.length,
    notFound: notFound.length,
    errors: status.filter((s) => s === 0 || s >= 500).length,
    bySection,
    top: notFound.sort((a, b) => (search.impsByUrl.get(b.u) ?? 0) - (search.impsByUrl.get(a.u) ?? 0)).slice(0, 10)
      .map((x) => ({ u: x.u, imps: search.impsByUrl.get(x.u) ?? 0 })),
  };
}

// ---- Render ---------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TD = 'padding:4px 10px 4px 0;border-bottom:1px solid #e6e2da;vertical-align:top;text-align:left';
const TH = `${TD};color:#6b665c;font-weight:600;font-size:12px`;

function render(d) {
  const text = [];
  const html = [];
  const h = (t) => { text.push(`\n== ${t} ==`); html.push(`<h3 style="margin:22px 0 6px;font-size:16px">${esc(t)}</h3>`); };
  const p = (t) => { text.push(t); html.push(`<p style="margin:4px 0">${esc(t)}</p>`); };
  const note = (t) => { text.push(`(${t})`); html.push(`<p style="margin:4px 0;color:#6b665c;font-size:13px">${esc(t)}</p>`); };
  const table = (head, rows) => {
    text.push(head.join(' | '));
    for (const r of rows) text.push(r.map((c) => (typeof c === 'object' && c ? c.text : c)).join(' | '));
    html.push(`<table style="border-collapse:collapse;font-size:13px;margin:4px 0 8px;width:100%"><tr>${head.map((x) => `<th style="${TH}">${esc(x)}</th>`).join('')}</tr>${rows
      .map((r) => `<tr>${r.map((c) => `<td style="${TD}">${typeof c === 'object' && c ? (c.href ? `<a href="${esc(c.href)}" style="color:#0f6b5c">${esc(c.text)}</a>` : esc(c.text)) : esc(c)}</td>`).join('')}</tr>`).join('')}</table>`);
  };
  const link = (u, n = 70) => ({ text: clip(pathOf(u), n), href: u });
  const fail = (label, e) => note(`${label} unavailable this week: ${e}`);

  const { search, ga4, trials, sitemap, inspection, nf, fresh, errors } = d;
  text.push(`GovHub weekly report, ${RANGE} (UTC), against ${short(P.start)} to ${short(P.end)}`);
  html.push(`<h2 style="margin:0 0 4px;font-size:20px">GovHub weekly report</h2><div style="color:#6b665c">${esc(RANGE)} (UTC), against ${esc(short(P.start))} to ${esc(short(P.end))}</div>`);

  // Headline
  h('Headline');
  const rows = [];
  if (search.ok) {
    rows.push(['Google clicks', n0(search.v.totals.clicks), n0(search.v.totalsPrev.clicks), pct(search.v.totals.clicks, search.v.totalsPrev.clicks)]);
    rows.push(['Google impressions', n0(search.v.totals.imps), n0(search.v.totalsPrev.imps), pct(search.v.totals.imps, search.v.totalsPrev.imps)]);
  }
  if (ga4.ok) {
    const org = ga4.v.channels.get('Organic Search') ?? [0, 0];
    const orgPrev = ga4.v.channelsPrev.get('Organic Search') ?? [0, 0];
    rows.push(['Organic search sessions (GA4)', n0(org[0]), n0(orgPrev[0]), pct(org[0], orgPrev[0])]);
    const auto = ga4.v.events.get('opportunity_auto_analyze')?.[0] ?? 0;
    rows.push(['Analyses started automatically', n0(auto), n0(ga4.v.eventsPrev.get('opportunity_auto_analyze')?.[0] ?? 0), '']);
  }
  if (trials.ok) {
    const k = (t, kind) => t.new_trials.filter((x) => x.kind === kind).length;
    const a = trials.v.now, b = trials.v.prev;
    rows.push(['New trials, self-serve', n0(k(a, 'trial_self_serve')), n0(k(b, 'trial_self_serve')), '']);
    rows.push(['New trials, outreach handover', n0(k(a, 'trial_outreach')), n0(k(b, 'trial_outreach')), '']);
    rows.push(['AI spend, excluding internal', usd(spendOutside(a)), usd(spendOutside(b)), pct(spendOutside(a), spendOutside(b))]);
  }
  if (fresh.ok) rows.push(['New bids shown in Google within 7 days', sharePct(fresh.v.now), sharePct(fresh.v.prev), '']);
  if (nf.ok) rows.push(['Pages Google showed that now 404', n0(nf.v.notFound), '', '']);
  if (sitemap.ok) rows.push(['Pages in the sitemap', n0(sitemap.v.urls.length), '', '']);
  table(['', 'This week', 'Last week', 'Change'], rows);
  if (!search.ok) fail('Search Console', search.e);
  if (!ga4.ok) fail('GA4', ga4.e);

  // Trials
  h('Trials and AI cost');
  if (!trials.ok) fail('Trials', trials.e);
  else {
    const a = trials.v.now;
    if (!a.new_trials.length) p('No new trials this week.');
    else table(['Signed up', 'Kind', 'Source', 'First page', 'Profile', 'Projects', 'AI cost', 'Trial ends'], a.new_trials.map((t) => [
      new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      KIND[t.kind] ?? t.kind,
      [t.source, t.medium].filter(Boolean).join(' / '),
      t.landing_path ? (t.landing_path.startsWith('/') && !/^\/(open-proposal|signup|v2)/.test(t.landing_path) ? link(`${SITE}${t.landing_path}`, 48) : clip(t.landing_path, 48)) : '',
      `${t.onboarding_completed ? 'onboarded' : 'not onboarded'}, ${t.has_naics ? 'NAICS set' : 'no NAICS'}`,
      `${t.projects} (${t.analyzed} analyzed)`,
      usd(t.ai_cost_usd),
      t.trial_end_date ? new Date(t.trial_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '',
    ]));
    const spend = Object.entries(a.ai_spend ?? {}).sort((x, y) => y[1].usd - x[1].usd);
    if (spend.length) table(['AI spend this week by account', 'Cost', 'AI calls'], spend.map(([k, v]) => [KIND[k] ?? k, usd(v.usd), n0(v.calls)]));
    const c = a.cohort_30d ?? {};
    p(`Last 30 days: ${n0(c.users)} trials (${n0(c.self_serve)} self-serve, ${n0(c.outreach)} outreach), ${n0(c.used_ai)} used the AI, ${usd(c.ai_cost_usd)} in total. ` +
      `Average per trial that used it: ${usd(c.avg_cost_per_ai_user)} (self-serve ${usd(c.self_serve_avg_cost_per_ai_user)}, outreach ${usd(c.outreach_avg_cost_per_ai_user)}). Paying accounts: ${n0(a.paying_accounts)}.`);
    note('AI cost is estimated from each call\'s token counts (v2_token_usage); hosting and email are not included. Internal and test accounts are excluded.');
  }

  // Product
  h('In the app (GA4 events)');
  if (!ga4.ok) fail('GA4', ga4.e);
  else table(['Event', 'This week', 'Last week'], EVENTS.map(([e, label]) => [label, n0(ga4.v.events.get(e)?.[0] ?? 0), n0(ga4.v.eventsPrev.get(e)?.[0] ?? 0)]));

  // Search
  h('Search (Google Search Console)');
  if (!search.ok) fail('Search Console', search.e);
  else {
    const s = search.v;
    table(['Section', 'Clicks', 'Last week', 'Impressions', 'Last week', 'Pages shown'],
      SECTIONS.filter((k) => s.bySection[k].imps || s.bySection[k].impsPrev).map((k) => {
        const x = s.bySection[k];
        return [k, n0(x.clicks), n0(x.clicksPrev), n0(x.imps), n0(x.impsPrev), n0(x.pages)];
      }));
    if (s.topPages.length) table(['Top pages by clicks', 'Clicks', 'Last week', 'Impressions', 'Position'], s.topPages.map((r) => [link(r.url), n0(r.clicks), n0(r.clicksPrev), n0(r.imps), r.position.toFixed(1)]));
    if (s.topQueries.length) table(['Top queries Google reports', 'Clicks', 'Impressions', 'Position'], s.topQueries.map((r) => [clip(r.query, 60), n0(r.clicks), n0(r.imps), r.position.toFixed(1)]));
    note('Google hides most queries (rare searches), so the query table covers only part of the clicks.');
    if (s.zeroClick.length) table(['Shown often on page 1, never clicked', 'Impressions', 'Position'], s.zeroClick.map((r) => [link(r.url), n0(r.imps), r.position.toFixed(1)]));
    const fs = Object.entries(s.fresh.bySection).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${n0(v)}`).join(', ');
    p(`Pages Google showed for the first time this week: ${n0(s.fresh.count)}${fs ? ` (${fs})` : ''}.`);
  }

  // Indexing
  h('Indexing');
  if (!inspection.ok) fail('URL Inspection sample', inspection.e);
  else {
    table(['Sampled pages, by section', 'Checked', 'Indexed', 'Share', 'Other states'],
      SECTIONS.filter((k) => inspection.v.table[k]).map((k) => {
        const t = inspection.v.table[k];
        const other = Object.entries(t.states).filter(([st]) => !(/indexed/i.test(st) && !/not indexed/i.test(st))).map(([st, n]) => `${st} ${n}`).join('; ');
        return [k, n0(t.n), n0(t.indexed), `${Math.round((t.indexed / t.n) * 100)}%`, other];
      }));
    if (inspection.v.notIndexedCommercial.length) {
      note(`Not indexed yet, worth "Request indexing" in Search Console: ${inspection.v.notIndexedCommercial.map((x) => pathOf(x.u)).join(', ')}`);
    }
  }
  if (!fresh.ok) fail('New-bid visibility', fresh.e);
  else {
    const f = (x) => `${n0(x.shown)} of ${n0(x.n)} (${sharePct(x)}) posted ${short(x.start)} to ${short(x.end)}`;
    p(`New bids shown in Google within 7 days of posting: ${f(fresh.v.now)}; the week before, ${f(fresh.v.prev)}. Indexable bid pages only.`);
  }
  if (!nf.ok) fail('404 check', nf.e);
  else {
    p(`Checked every page Google showed in the last four weeks (${n0(nf.v.checked)}): ${n0(nf.v.notFound)} return 404${nf.v.errors ? `, ${n0(nf.v.errors)} did not answer` : ''}.`);
    if (nf.v.top.length) table(['404 pages Google showed', 'Impressions (5 weeks)'], nf.v.top.map((x) => [link(x.u), n0(x.imps)]));
  }
  if (sitemap.ok) p(`Sitemap: ${n0(sitemap.v.urls.length)} pages (${Object.entries(sitemap.v.bySection).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${n0(v)}`).join(', ')}).`);
  else fail('Sitemap', sitemap.e);

  for (const e of errors) note(`report warning: ${e}`);
  text.push('', 'Sent by weekly-report.yml (Mondays). Search Console data for the last two days is preliminary.');
  html.push(`<p style="margin-top:22px;color:#8a857a;font-size:12px">Sent by weekly-report.yml (Mondays). Search Console data for the last two days is preliminary.</p>`);

  const subj = [
    search.ok && `${n0(search.v.totals.clicks)} Google clicks (${pct(search.v.totals.clicks, search.v.totalsPrev.clicks) || 'flat'})`,
    trials.ok && `${trials.v.now.new_trials.length} trials`,
    trials.ok && `${usd(spendOutside(trials.v.now))} AI`,
    nf.ok && `${n0(nf.v.notFound)} 404s`,
  ].filter(Boolean).join(', ');
  return {
    subject: `GovHub weekly, ${RANGE}: ${subj || 'see the report'}`,
    text: text.join('\n'),
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:760px;line-height:1.45;color:#2b2925">${html.join('\n')}</div>`,
  };
}

// ---- Main -------------------------------------------------------------------------
const errors = [];
const settle = async (fn) => { try { return { ok: true, v: await fn() }; } catch (e) { return { ok: false, e: e.message }; } };

const [search, ga4, trials, sitemap, fresh] = await Promise.all([settle(gatherSearch), settle(gatherGa4), settle(gatherTrials), settle(gatherSitemap), settle(gatherNewBidVisibility)]);
const inspection = args.includes('--no-inspect') ? { ok: false, e: 'skipped (--no-inspect)' }
  : sitemap.ok ? await settle(() => gatherInspection(sitemap.v)) : { ok: false, e: 'no sitemap' };
const nf = args.includes('--no-404') ? { ok: false, e: 'skipped (--no-404)' }
  : search.ok ? await settle(() => gather404(search.v)) : { ok: false, e: 'needs Search Console' };

const email = render({ search, ga4, trials, sitemap, inspection, nf, fresh, errors });
if (arg('--html')) writeFileSync(arg('--html'), email.html);

if (DRY) {
  console.log(`[dry-run] would send to: ${TO.join(', ')}`);
  console.log(`[dry-run] subject: ${email.subject}\n`);
  console.log(email.text);
} else {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, subject: email.subject, html: email.html, text: email.text }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`resend: HTTP ${resp.status} ${JSON.stringify(data).slice(0, 200)}`);
  console.log(`[weekly-report] sent "${email.subject}" (${data.id ?? 'no id'})`);
}
