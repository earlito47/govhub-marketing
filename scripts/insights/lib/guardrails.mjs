// Scaled-content guardrails for the Insights pipeline. The incoming search
// update targets scaled content by MECHANISM (publishing velocity, % page
// growth, templated sameness), not by quality, so good data does not exempt
// us. These guardrails strip the detectable signature while keeping the
// automation:
//
//   1. Throttle velocity  — cap brand-new entity pages published per run.
//   2. Cap % growth       — that cap also scales with the current page count,
//                            so a handful of new pages onto a small site is a
//                            small percentage, not a spike.
//   3. noindex low-value  — pages that clear the hard floor but are weak for
//                            searchers are published for users and noindex'd,
//                            rather than bloating the indexable footprint.
//   4. No silent caps      — every skip / defer / noindex is logged.
//
// All thresholds live here so they are easy to tune in one place. Values are
// deliberately conservative; raise the soft floor to keep more pages indexed.
export const GUARDRAILS = {
  // Throttle: at most this many BRAND-NEW entity pages per run. Existing pages
  // are always refreshed and never counted here (they are already indexed).
  maxNewPagesPerRun: 8,
  // ...and never more than this share of the current published count, so the
  // increment stays small on a young/small site (10 onto 15 pages is a spike).
  maxGrowthPct: 10,
  thin: {
    // Hard floor: too thin to publish at all (existing behavior, spec 9.6).
    hardObligations: 50e6,
    hardAwards: 100,
    hardTrendYears: 3,
    // Soft floor: publishable and useful, but weak for searchers -> noindex.
    softObligations: 100e6,
    softAwards: 150,
  },
};

function trendYearsOf(page) {
  return page.charts?.find((c) => c.id.endsWith('-trend'))?.series?.[0]?.points?.length ?? 0;
}

/**
 * Decide what to do with a freshly computed entity page.
 * @returns {{action: 'index'|'noindex'|'skip'|'defer', reason: string|null}}
 */
export function classifyEntity({ page, exists, budget }) {
  const { totalObligations, awardCount } = page.stats;
  const t = GUARDRAILS.thin;

  // 1. Hard floor: skip entirely.
  if (totalObligations < t.hardObligations) return { action: 'skip', reason: `below $${t.hardObligations / 1e6}M obligations` };
  if (awardCount !== null && awardCount < t.hardAwards) return { action: 'skip', reason: `below ${t.hardAwards} awards (${awardCount})` };
  if (trendYearsOf(page) < t.hardTrendYears) return { action: 'skip', reason: `under ${t.hardTrendYears} years of trend` };

  // 2. Throttle: a brand-new page beyond this run's budget waits for a later
  //    run. Existing pages are exempt (already published/indexed).
  if (!exists && budget && !budget.canPublishNew()) {
    return { action: 'defer', reason: `throttled: ${budget.allowance} new-page budget spent this run` };
  }

  // 3. Soft floor: publish for users, but noindex so it does not bloat the index.
  if (totalObligations < t.softObligations || (awardCount !== null && awardCount < t.softAwards)) {
    return { action: 'noindex', reason: `weak for search (< $${t.softObligations / 1e6}M or < ${t.softAwards} awards)` };
  }

  return { action: 'index', reason: null };
}

/**
 * Per-run budget for brand-new pages. Allowance is the smaller of the fixed cap
 * and the percentage-of-current-size cap, so it scales down on a small site.
 */
export function makeBudget({ existingTotal }) {
  const pctCap = Math.floor((existingTotal * GUARDRAILS.maxGrowthPct) / 100);
  const allowance = Math.max(1, Math.min(GUARDRAILS.maxNewPagesPerRun, pctCap || GUARDRAILS.maxNewPagesPerRun));
  let used = 0;
  return {
    allowance,
    get used() {
      return used;
    },
    canPublishNew() {
      return used < allowance;
    },
    consumeNew() {
      used += 1;
    },
  };
}
