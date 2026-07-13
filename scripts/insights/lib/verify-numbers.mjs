// Shared number-verification (spec 6.3 / 6.4). Builds the set of number strings
// a page's own facts can justify, then flags any $/%/comma-grouped figure in a
// block of text that isn't one of them. Used by validate.mjs (the commit gate)
// and generate-narratives.mjs (to accept or reject LLM prose before it lands).

import { formatUsdCompact, formatPercent, formatInt } from './format.mjs';

const MONEY_COL = /obligation|amount|value|dollar|spend|ceiling/i;

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function allowedNumberStrings(page) {
  const money = new Set();
  const pct = new Set();
  const ints = new Set();
  const total = page.stats?.totalObligations ?? 0;

  const addMoney = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      const f = formatUsdCompact(v);
      if (f) money.add(f);
      if (total > 0) {
        const p = formatPercent(round1((Math.abs(v) / total) * 100));
        if (p) pct.add(p);
      }
    }
  };

  addMoney(page.stats?.totalObligations);
  addMoney(page.stats?.avgAwardSize);
  for (const c of page.charts ?? []) {
    if (c.unit === 'usd') for (const [, v] of c.series?.[0]?.points ?? []) addMoney(v);
    // Percent-unit charts (e.g. growth rankings) contribute their values to the
    // allowed percentage set so a narrative may cite them.
    if (c.unit === 'pct')
      for (const [, v] of c.series?.[0]?.points ?? []) {
        if (typeof v === 'number') { const p = formatPercent(v); if (p) pct.add(p); }
      }
  }
  for (const t of page.tables ?? []) {
    const moneyCols = t.columns.map((c) => MONEY_COL.test(c));
    for (const row of t.rows) row.forEach((cell, i) => { if (moneyCols[i] && typeof cell === 'number') addMoney(cell); });
  }

  for (const k of ['yoyGrowthPct', 'smallBusinessSharePct']) {
    const v = page.stats?.[k];
    if (typeof v === 'number') { const p = formatPercent(Math.abs(v)); if (p) pct.add(p); }
  }
  const ac = formatInt(page.stats?.awardCount);
  if (ac) ints.add(ac);

  return { money, pct, ints };
}

// Return the list of number tokens in `text` that the page's facts can't justify.
export function findNumberViolations(text, page) {
  const { money, pct, ints } = allowedNumberStrings(page);
  const violations = [];
  const norm = (s) => s.replace(/\s/g, '').toUpperCase();
  const moneyAllowed = new Set([...money].map(norm));

  for (const tok of text.match(/\$\s?\d[\d,]*(?:\.\d+)?\s?[BMK]?/g) ?? []) {
    if (!moneyAllowed.has(norm(tok))) violations.push(`unverifiable dollar figure "${tok.trim()}"`);
  }
  for (const tok of text.match(/\d+(?:\.\d+)?%/g) ?? []) {
    if (!pct.has(tok)) violations.push(`unverifiable percentage "${tok}"`);
  }
  for (const tok of text.match(/\b\d{1,3}(?:,\d{3})+\b/g) ?? []) {
    if (!ints.has(tok)) violations.push(`unverifiable figure "${tok}"`);
  }
  return violations;
}

// The narrative + FAQ text of a page, as one string for verification.
export function narrativeText(page) {
  const parts = [page.narrative?.intro ?? ''];
  for (const s of page.narrative?.sections ?? []) parts.push(s.heading, s.body);
  for (const f of page.faq ?? []) parts.push(f.q, f.a);
  for (const c of page.charts ?? []) if (c.takeaway) parts.push(c.takeaway);
  return parts.join('  ');
}
