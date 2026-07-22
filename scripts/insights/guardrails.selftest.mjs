#!/usr/bin/env node
// Network-free self-test for the scaled-content guardrails. Run:
//   node scripts/insights/guardrails.selftest.mjs
import { classifyEntity, makeBudget, GUARDRAILS } from './lib/guardrails.mjs';

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} (got ${actual}, expected ${expected})`);
}

const page = ({ obligations, awards, trendYears = 5 }) => ({
  stats: { totalObligations: obligations, awardCount: awards },
  charts: [{ id: 'x-trend', series: [{ points: Array.from({ length: trendYears }, (_, i) => [`FY${i}`, 1]) }] }],
});
const freshBudget = () => makeBudget({ existingTotal: 110 });

// Thin hard floor -> skip
check('below hard $ -> skip', classifyEntity({ page: page({ obligations: 40e6, awards: 500 }), exists: true, budget: freshBudget() }).action, 'skip');
check('below hard awards -> skip', classifyEntity({ page: page({ obligations: 300e6, awards: 50 }), exists: true, budget: freshBudget() }).action, 'skip');
check('too few trend years -> skip', classifyEntity({ page: page({ obligations: 300e6, awards: 500, trendYears: 2 }), exists: true, budget: freshBudget() }).action, 'skip');

// Soft floor -> noindex (published for users, not indexed)
check('weak $ -> noindex', classifyEntity({ page: page({ obligations: 80e6, awards: 500 }), exists: true, budget: freshBudget() }).action, 'noindex');
check('weak awards -> noindex', classifyEntity({ page: page({ obligations: 300e6, awards: 120 }), exists: true, budget: freshBudget() }).action, 'noindex');

// Healthy -> index
check('healthy -> index', classifyEntity({ page: page({ obligations: 300e6, awards: 500 }), exists: true, budget: freshBudget() }).action, 'index');

// Throttle: a brand-new healthy page defers once the budget is spent; existing
// pages are never throttled.
const b = makeBudget({ existingTotal: 110 }); // allowance 8
for (let i = 0; i < b.allowance; i += 1) b.consumeNew();
check('new page over budget -> defer', classifyEntity({ page: page({ obligations: 300e6, awards: 500 }), exists: false, budget: b }).action, 'defer');
check('existing page never throttled', classifyEntity({ page: page({ obligations: 300e6, awards: 500 }), exists: true, budget: b }).action, 'index');

// Budget scales with site size (10% cap), capped at maxNewPagesPerRun.
check('budget on 110 pages', makeBudget({ existingTotal: 110 }).allowance, Math.min(GUARDRAILS.maxNewPagesPerRun, 11));
check('budget on 15 pages (small site)', makeBudget({ existingTotal: 15 }).allowance, 1);

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
