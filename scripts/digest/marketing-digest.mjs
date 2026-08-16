// Marketing automation digest — the twice-weekly ops email.
//
// GovHub's marketing runs itself: weekly-content drafts blog posts (via PR),
// publish-social and daily-linkedin post LinkedIn copy, weekly-insights and
// daily-vendor-publish grow the data site, vendor-outreach emails vendors.
// This script is the single rear-view mirror: everything those streams
// produced in the reporting window, whether the workflow runs behind them
// succeeded, and — most importantly — what needs a human hand (a content PR
// waiting for merge, a failed run, a disabled gate).
//
// Design rules:
//   - Every data source degrades independently: a section that cannot be
//     gathered renders as "unavailable" instead of sinking the whole email.
//     A digest that always arrives is the point — a MISSING digest is itself
//     the signal that automation broke.
//   - Windowing is day-of-week aware: the Monday digest covers since Thursday
//     20:00 UTC (4 days), the Thursday digest since Monday (3 days). Manual
//     runs default to 4 days; override with --days N.
//   - Git history is the source of truth for "what went live and when": every
//     stream lands as a commit to main, so added/modified paths map to pages
//     and the commit time is the go-live time.
//
// Usage:  node scripts/digest/marketing-digest.mjs [--dry-run] [--days N]
// Env:    RESEND_API_KEY  required to send (dry-run works without)
//         DIGEST_TO       comma-separated recipients
//         GITHUB_TOKEN, GITHUB_REPOSITORY   for run/PR/variable checks (the
//                         workflow provides both; absent locally -> sections
//                         degrade)

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'https://www.govhub.online';
const REPO = process.env.GITHUB_REPOSITORY || 'earlito47/govhub-marketing';
const TO = (process.env.DIGEST_TO || 'earljknight@gmail.com,earl@govhub.online').split(',').map((s) => s.trim()).filter(Boolean);
const FROM = 'GovHub Ops <hello@govhub.online>';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const daysArg = args.indexOf('--days');
const now = new Date();
const days = daysArg !== -1 ? Number(args[daysArg + 1]) : now.getUTCDay() === 1 ? 4 : 3;
const since = new Date(now.getTime() - days * 864e5);
const sinceIso = since.toISOString();

const fmtWhen = (iso) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const git = (...a) => execFileSync('git', a, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---- Stream 1: content that went live (git history of main) ---------------
// path pattern -> { type, url builder }. Deletions are ignored; modifications
// only matter for the rankings (weekly refresh of standing pages).
const CONTENT_RULES = [
  { re: /^src\/pages\/blog\/(?!index|\[)([^/.]+)\.(astro|md|mdx)$/, type: 'Blog post', url: (m) => `${SITE}/blog/${m[1]}/` },
  { re: /^src\/pages\/glossary\/(?!index|\[)([^/.]+)\.(astro|md|mdx)$/, type: 'Glossary page', url: (m) => `${SITE}/glossary/${m[1]}/` },
  { re: /^src\/data\/insights\/vendor\/([^/]+)\.json$/, type: 'Vendor profile', url: (m) => `${SITE}/insights/vendor/${m[1]}/` },
  { re: /^src\/data\/insights\/reports\/([^/]+)\/([^/]+)\.json$/, type: 'Weekly report', name: (m) => `${m[2]} (${m[1]})`, url: (m) => `${SITE}/insights/reports/${m[1]}/${m[2]}/` },
  { re: /^src\/data\/insights\/naics\/([^/]+)\.json$/, type: 'NAICS market page', url: (m) => `${SITE}/insights/naics/${m[1]}/` },
  { re: /^src\/data\/insights\/agency\/([^/]+)\.json$/, type: 'Agency page', url: (m) => `${SITE}/insights/agency/${m[1]}/` },
  { re: /^src\/data\/insights\/state\/([^/]+)\.json$/, type: 'State page', url: (m) => `${SITE}/insights/state/${m[1]}/` },
  { re: /^social\/posted\/([^/]+)\.linkedin\.txt$/, type: 'LinkedIn post published', url: () => null },
  { re: /^social\/([^/]+)\.linkedin\.txt$/, type: 'LinkedIn copy drafted (posts after blog goes live)', url: () => null },
];
const RANKINGS_RE = /^src\/data\/insights\/rankings\/([^/]+)\.json$/;

function gatherContent() {
  const created = [];
  const refreshed = new Map();
  const log = git('log', `--since=${sinceIso}`, '--pretty=format:>>%cI', '--name-status', '--no-renames', 'HEAD');
  let when = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('>>')) { when = line.slice(2).trim(); continue; }
    const m = line.match(/^([AM])\t(.+)$/);
    if (!m || !when) continue;
    const [, status, file] = m;
    const rank = file.match(RANKINGS_RE);
    if (rank) { if (!refreshed.has(rank[1]) || refreshed.get(rank[1]) < when) refreshed.set(rank[1], when); continue; }
    if (status !== 'A') continue;
    for (const rule of CONTENT_RULES) {
      const hit = file.match(rule.re);
      if (hit) { created.push({ type: rule.type, name: rule.name ? rule.name(hit) : hit[1], url: rule.url(hit), when }); break; }
    }
  }
  created.sort((a, b) => (a.when < b.when ? 1 : -1));
  return { created, refreshed: [...refreshed.entries()].map(([slug, when]) => ({ slug, when })) };
}

// ---- Stream 2: outreach sends (ledger diff) --------------------------------
function gatherOutreach() {
  const ledgerPath = 'data/vendor-outreach.json';
  const cur = JSON.parse(readFileSync(path.join(REPO_ROOT, ledgerPath), 'utf8')).vendors;
  let old = {};
  try {
    const sha = git('rev-list', '-1', `--before=${sinceIso}`, 'HEAD').trim();
    if (sha) old = JSON.parse(git('show', `${sha}:${ledgerPath}`)).vendors;
  } catch { /* ledger did not exist at window start */ }
  const sent = [];
  const resolved = [];
  for (const [slug, v] of Object.entries(cur)) {
    const was = old[slug];
    if (v.status === 'sent' && was?.status !== 'sent') sent.push({ slug, company: v.company, contact: v.contactName, email: v.email, when: v.sentAt });
    else if (v.status === 'ready' && !was) resolved.push({ company: v.company, email: v.email });
  }
  // Backlog: published roster vendors with no ledger entry yet.
  let backlog = null;
  const rosterPath = path.join(REPO_ROOT, 'src/data/insights/vendor-roster.json');
  if (existsSync(rosterPath)) {
    const roster = JSON.parse(readFileSync(rosterPath, 'utf8')).vendors;
    backlog = Object.entries(roster).filter(([slug, v]) => v.status === 'published' && !cur[slug]).length;
  }
  // Retired after MAX_SEND_ATTEMPTS. Nothing retries these, so they only ever
  // surface here.
  const sendFailed = Object.entries(cur)
    .filter(([, v]) => v.status === 'send-failed')
    .map(([slug, v]) => ({ slug, email: v.email, notes: v.notes }));
  return { sent, resolved, backlog, sendFailed, totalSent: Object.values(cur).filter((v) => v.status === 'sent').length };
}

// ---- Stream 3: workflow health + action items (GitHub API) -----------------
async function gh(pathname) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');
  const resp = await fetch(`https://api.github.com/repos/${REPO}${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!resp.ok) throw new Error(`GitHub ${pathname}: HTTP ${resp.status}`);
  return resp.json();
}

async function gatherRuns() {
  const data = await gh(`/actions/runs?created=%3E%3D${sinceIso.slice(0, 10)}&per_page=100`);
  const byWorkflow = new Map();
  for (const r of data.workflow_runs ?? []) {
    if (new Date(r.run_started_at) < since) continue;
    const entry = byWorkflow.get(r.name) ?? { runs: 0, failures: [] };
    entry.runs += 1;
    if (r.conclusion && r.conclusion !== 'success') entry.failures.push({ when: r.run_started_at, conclusion: r.conclusion, url: r.html_url });
    byWorkflow.set(r.name, entry);
  }
  return [...byWorkflow.entries()].map(([name, e]) => ({ name, ...e }));
}

async function gatherActions(outreach) {
  const items = [];
  try {
    const prs = await gh('/pulls?state=open&per_page=50');
    for (const pr of prs) {
      const isContent = pr.head?.ref?.startsWith('content/');
      items.push({
        text: isContent
          ? `Blog draft waiting on your merge: "${pr.title}" — the post (and its LinkedIn copy) publishes when you merge`
          : `Open PR: "${pr.title}"`,
        url: pr.html_url,
      });
    }
  } catch (e) { items.push({ text: `(could not list open PRs: ${e.message})`, url: null }); }
  try {
    const vars = await gh('/actions/variables?per_page=30');
    const byName = Object.fromEntries((vars.variables ?? []).map((v) => [v.name, v.value]));
    const provider = byName.SOCIAL_PROVIDER ?? '';
    if (!provider || provider === 'dry_run') {
      items.push({ text: 'LinkedIn copy is drafting but NOT posting — set the SOCIAL_PROVIDER repo variable (postiz/blotato/linkedin_direct) to go live', url: null });
    }
    if ((byName.OUTREACH_ENABLED ?? '') !== 'true') {
      items.push({ text: 'Vendor outreach sends are paused — OUTREACH_ENABLED is not "true"', url: null });
    }
  } catch { /* variables API unavailable — skip the gate checks */ }
  if (outreach?.backlog > 0) {
    items.push({ text: `${outreach.backlog} published vendor page(s) still need a contact resolved before they can be emailed (retries daily)`, url: null });
  }
  for (const v of outreach?.sendFailed ?? []) {
    items.push({ text: `Outreach to ${v.slug} <${v.email}> gave up after repeated failures — ${v.notes || 'no detail recorded'}`, url: null });
  }
  return items;
}

// ---- Render ----------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render({ content, outreach, runs, actionItems, errors }) {
  const range = `${fmtWhen(sinceIso).slice(0, 10)} → ${fmtWhen(now.toISOString()).slice(0, 10)}`;
  const counts = {};
  for (const c of content.created) counts[c.type] = (counts[c.type] ?? 0) + 1;
  const failures = runs?.flatMap((w) => w.failures.map((f) => ({ ...f, name: w.name }))) ?? [];

  const text = [];
  const html = [];
  const section = (title) => { text.push(`\n== ${title} ==`); html.push(`<h3 style="margin:1.2em 0 .4em">${esc(title)}</h3>`); };
  const line = (t, url) => {
    text.push(`- ${t}${url ? ` (${url})` : ''}`);
    html.push(`<div style="margin:.15em 0">• ${esc(t)}${url ? ` — <a href="${esc(url)}">link</a>` : ''}</div>`);
  };

  text.push(`GovHub automation digest, ${range}`);
  html.push(`<h2 style="margin:0 0 .3em">GovHub automation digest</h2><div style="color:#555">${esc(range)} · window ${days} days</div>`);

  section('Action needed');
  if (actionItems === null) line('unavailable (GitHub API not reachable this run)');
  else if (actionItems.length === 0) line('Nothing — everything ran clean and nothing is waiting on you.');
  else for (const a of actionItems) line(a.text, a.url);
  for (const f of failures) line(`FAILED run: ${f.name} (${f.conclusion}) at ${fmtWhen(f.when)} — open it and hit Re-run`, f.url);

  section(`Published to the site (${content.created.length})`);
  if (content.created.length === 0) line('No new pages this window.');
  for (const c of content.created) line(`${c.type}: ${c.name} — live ${fmtWhen(c.when)}`, c.url);
  if (content.refreshed.length) {
    line(`Standing rankings refreshed with new data (${content.refreshed.length}): ${content.refreshed.map((r) => r.slug).join(', ')}`);
  }

  section(`Vendor outreach emails (${outreach ? outreach.sent.length : '?'} sent this window)`);
  if (!outreach) line('unavailable (ledger read failed)');
  else {
    for (const s of outreach.sent) line(`${s.company} — ${s.contact} <${s.email}> at ${fmtWhen(s.when)}`, `${SITE}/insights/vendor/${s.slug}/`);
    if (outreach.sent.length === 0) line('None sent this window.');
    if (outreach.resolved.length) line(`Contacts resolved and queued to send: ${outreach.resolved.map((r) => r.company).join(', ')}`);
    line(`Running total: ${outreach.totalSent} vendors emailed, one email per vendor ever.`);
  }

  section('Workflow runs this window');
  if (!runs) line('unavailable (GitHub API not reachable this run)');
  else if (runs.length === 0) line('No runs recorded.');
  else for (const w of runs) line(`${w.name}: ${w.runs} run(s), ${w.failures.length === 0 ? 'all green' : `${w.failures.length} FAILED`}`);

  for (const e of errors) line(`digest warning: ${e}`);
  text.push('', 'Sent by marketing-digest.yml (Mon+Thu 20:00 UTC).');
  html.push(`<div style="margin-top:1.5em;color:#888;font-size:.85em">Sent by marketing-digest.yml (Mon+Thu 20:00 UTC).</div>`);

  return {
    subject: `GovHub automation digest — ${content.created.length} items live, ${outreach?.sent.length ?? 0} outreach emails, ${failures.length ? `${failures.length} FAILED runs` : 'all green'}`,
    text: text.join('\n'),
    html: `<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.45">${html.join('\n')}</div>`,
  };
}

// ---- Main ------------------------------------------------------------------
const errors = [];
const tryOr = async (fn, label, fallback = null) => {
  try { return await fn(); } catch (e) { errors.push(`${label}: ${e.message}`); return fallback; }
};

const content = (await tryOr(() => gatherContent(), 'content')) ?? { created: [], refreshed: [] };
const outreach = await tryOr(() => gatherOutreach(), 'outreach');
const runs = await tryOr(() => gatherRuns(), 'workflow runs');
const actionItems = await tryOr(() => gatherActions(outreach), 'action items');

const email = render({ content, outreach, runs, actionItems, errors });

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
  console.log(`[digest] sent to ${TO.join(', ')} (${data.id ?? 'no id'})`);
}
