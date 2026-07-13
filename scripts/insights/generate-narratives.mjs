#!/usr/bin/env node
// LLM narrative enrichment (spec 6.3). Optional stage: rewrites the intro,
// sections, and FAQ answers of each evergreen page with an LLM, but ONLY keeps
// the result if every number in it traces to the page's own facts (the same
// guard the commit gate enforces). Anything unverifiable after one retry is
// discarded and the deterministic fallback narrative already in the JSON is
// kept — so this stage can never publish an unverifiable number, and an OpenAI
// outage or a missing key can never block the pipeline.
//
//   OPENAI_API_KEY=... node generate-narratives.mjs           # enrich all
//   node generate-narratives.mjs --skip-llm                   # no-op (fallback)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { formatUsdCompact, formatInt, formatPercent } from './lib/format.mjs';
import { findNumberViolations, narrativeText } from './lib/verify-numbers.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const DATA_DIR = path.join(REPO_ROOT, 'src/data/insights');
// Reports are deterministic + immutable; only enrich the evergreen page types.
// INSIGHTS_KINDS can narrow the set (comma-separated) for testing.
const KINDS = process.env.INSIGHTS_KINDS ? process.env.INSIGHTS_KINDS.split(',') : ['naics', 'agency', 'state', 'rankings'];
const MODEL = process.env.INSIGHTS_LLM_MODEL || 'gpt-5-mini';
const CONCURRENCY = 4;

const SYSTEM_PROMPT = `You write factual, plain-English federal-market analysis for government contractors.
Rules you must follow exactly:
- Use ONLY the figures given in FACTS. Never invent, compute, estimate, or reword a number, percentage, or total.
- Copy every dollar figure EXACTLY as written in FACTS (e.g. "$7.1B", "$117K") — never spell out ("7.1 billion") and never change the unit.
- No predictions, forecasts, or superlatives the FACTS do not support.
- State figures directly as facts. Do NOT quote them, hedge them, or attribute them to "the dataset", "FACTS", or "labeled/noted as" — write "obligations fell 31.0% year over year", never "labeled 'down 31.0%'".
- Professional, concrete, and readable. No filler, no meta-commentary about the data source in the body.
Return a JSON object with exactly these keys:
  "intro": a 150-250 word overview paragraph.
  "sections": an array of exactly 2 objects, each { "heading": a question-style H2, "body": 2-4 sentences }.
  "faqAnswers": an array of strings, one per question in FACTS.faqQuestions, in the same order. Each answer must OPEN with a direct, self-contained answer sentence.`;

// ---- Facts block ----------------------------------------------------------
function factsFor(page) {
  const s = page.stats ?? {};
  const figures = {};
  const m = formatUsdCompact(s.totalObligations);
  if (m) figures.totalObligations = m;
  const ac = formatInt(s.awardCount);
  if (ac) figures.awardCount = ac;
  const avg = formatUsdCompact(s.avgAwardSize);
  if (avg) figures.averageAwardSize = avg;
  if (typeof s.yoyGrowthPct === 'number') {
    figures.yearOverYearChange = `${s.yoyGrowthPct >= 0 ? 'up ' : 'down '}${formatPercent(Math.abs(s.yoyGrowthPct))}`;
  }
  const rankings = (page.charts ?? [])
    .filter((c) => c.unit === 'usd' || c.unit === 'pct')
    .map((c) => ({
      title: c.title,
      items: (c.series?.[0]?.points ?? [])
        .slice(0, 10)
        .map(([name, amount]) => ({ name, value: c.unit === 'pct' ? formatPercent(amount) : formatUsdCompact(amount) })),
    }));
  return {
    page: page.h1,
    pageType: page.pageType,
    period: page.fyWindow?.label,
    note:
      page.slug === 'largest-federal-contracts-fy2026'
        ? 'Total award value figures are full contract values, not single-year obligations.'
        : 'All figures are contract obligations; current-year totals are partial (fiscal year to date).',
    figures,
    rankings,
    faqQuestions: (page.faq ?? []).map((f) => f.q),
  };
}

// ---- OpenAI call ----------------------------------------------------------
async function callOpenAI(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      max_completion_tokens: 3000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  return JSON.parse(content);
}

// Build a candidate page with the LLM narrative applied, without mutating input.
function applyNarrative(page, llm) {
  const sections = Array.isArray(llm.sections) ? llm.sections.filter((x) => x && x.heading && x.body) : [];
  const answers = Array.isArray(llm.faqAnswers) ? llm.faqAnswers : [];
  const faq = (page.faq ?? []).map((f, i) => ({ ...f, a: typeof answers[i] === 'string' && answers[i].trim() ? answers[i].trim() : f.a }));
  return { ...page, narrative: { intro: typeof llm.intro === 'string' ? llm.intro : page.narrative.intro, sections }, faq };
}

async function enrichPage(page) {
  const facts = factsFor(page);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `FACTS:\n${JSON.stringify(facts, null, 2)}` },
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let llm;
    try {
      llm = await callOpenAI(messages);
    } catch (err) {
      return { page, status: `api-error (${err.message.slice(0, 60)})` };
    }
    if (!llm.intro || !Array.isArray(llm.sections) || llm.sections.length === 0) {
      return { page, status: 'bad-shape' };
    }
    const candidate = applyNarrative(page, llm);
    const violations = findNumberViolations(narrativeText(candidate), candidate);
    if (violations.length === 0) return { page: candidate, status: attempt === 0 ? 'llm' : 'llm-retry' };
    // Retry once with the specific violations fed back.
    messages.push({ role: 'assistant', content: JSON.stringify(llm) });
    messages.push({
      role: 'user',
      content: `These figures are NOT in FACTS and must not appear: ${violations.join('; ')}. Rewrite using only figures present in FACTS, copied verbatim.`,
    });
  }
  return { page, status: 'fallback (unverifiable numbers)' };
}

// ---- Runner ---------------------------------------------------------------
function pageFiles() {
  const out = [];
  for (const kind of KINDS) {
    const dir = path.join(DATA_DIR, kind);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.json')) out.push(path.join(dir, f));
  }
  return out;
}

async function pMap(items, fn, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function enrichAll({ skip = false } = {}) {
  if (skip || process.argv.includes('--skip-llm')) {
    console.log('[narratives] --skip-llm: keeping deterministic fallback narratives.');
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    console.log('[narratives] OPENAI_API_KEY not set — skipping LLM stage; deterministic fallbacks stand.');
    return;
  }

  const files = pageFiles();
  console.log(`[narratives] Enriching ${files.length} pages with ${MODEL} (fallback on any unverifiable output)...`);
  const tally = {};
  await pMap(
    files,
    async (file) => {
      const page = JSON.parse(readFileSync(file, 'utf8'));
      const { page: result, status } = await enrichPage(page);
      const key = status.split(' ')[0];
      tally[key] = (tally[key] ?? 0) + 1;
      if (status.startsWith('llm')) writeFileSync(file, JSON.stringify(result, null, 2), 'utf8');
      console.log(`  ${status.startsWith('llm') ? '✓' : '·'} ${path.relative(DATA_DIR, file)} — ${status}`);
    },
    CONCURRENCY
  );
  console.log(`[narratives] Done. ${JSON.stringify(tally)}`);
}

// Never fail the pipeline for an LLM problem — fallbacks are already in place.
const onError = (err) => console.error(`[narratives] non-fatal error: ${err.message}. Deterministic fallbacks stand.`);

if (process.argv[1] === __filename) {
  enrichAll().catch(onError);
}
