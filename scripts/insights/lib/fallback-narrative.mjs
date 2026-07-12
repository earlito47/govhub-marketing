import { formatPercent, formatUsdCompact } from './format.mjs';

// Deterministic, LLM-free narrative generator. Every sentence is assembled
// directly from already-computed stats, so it can never fail the number-
// verification check in validate.mjs — this is what generate-narratives.mjs
// falls back to when the LLM stage is skipped or a generated draft can't be
// verified. It is also what the pilot pipeline uses by default (Section 15,
// Phase 1 step 1: "fallback narratives only").

export function fallbackNaicsNarrative({ entityLabel, fyLabel, stats, topVendor, topAgency }) {
  const totalStr = formatUsdCompact(stats.totalObligations);
  const countStr = stats.awardCount?.toLocaleString('en-US');

  const introParts = [
    `In ${fyLabel}, federal agencies obligated ${totalStr} across ${countStr} contract awards in ${entityLabel}.`,
  ];
  if (stats.yoyGrowthPct !== null && stats.yoyGrowthPct !== undefined) {
    const direction = stats.yoyGrowthPct >= 0 ? 'up' : 'down';
    introParts.push(
      `That is ${direction} ${formatPercent(Math.abs(stats.yoyGrowthPct))} year over year.`
    );
  }
  if (stats.avgAwardSize !== null && stats.avgAwardSize !== undefined) {
    introParts.push(`The average award size was ${formatUsdCompact(stats.avgAwardSize)}.`);
  }

  const sections = [];
  if (topAgency) {
    sections.push({
      heading: `Which agencies buy the most ${entityLabel} services?`,
      body: `${topAgency.name} was the top buyer in ${entityLabel}, obligating ${formatUsdCompact(
        topAgency.amount
      )} in ${fyLabel}${
        topAgency.sharePct !== null && topAgency.sharePct !== undefined
          ? `, or ${formatPercent(topAgency.sharePct)} of all obligations in this market`
          : ''
      }.`,
    });
  }
  if (topVendor) {
    sections.push({
      heading: `Who are the largest ${entityLabel} government contractors?`,
      body: `${topVendor.name} led all vendors with ${formatUsdCompact(
        topVendor.amount
      )} in obligated contract awards in ${entityLabel} during ${fyLabel}${
        topVendor.sharePct !== null && topVendor.sharePct !== undefined
          ? `, a ${formatPercent(topVendor.sharePct)} share of the market`
          : ''
      }.`,
    });
  }

  const faqAnswers = {
    howMuchSpend: `Federal agencies obligated ${totalStr} on ${entityLabel} contracts in ${fyLabel}, across ${countStr} awards.`,
    whichAgencies: topAgency
      ? `${topAgency.name} is the largest buyer of ${entityLabel} services, obligating ${formatUsdCompact(
          topAgency.amount
        )} in ${fyLabel}.`
      : null,
    largestContractors: topVendor
      ? `${topVendor.name} is the largest ${entityLabel} government contractor by obligated dollars in ${fyLabel}, with ${formatUsdCompact(
          topVendor.amount
        )}.`
      : null,
  };

  return { intro: introParts.join(' '), sections, faqAnswers };
}
