// Frontend number/label formatting for GovHub Insights templates.
//
// Deliberately a faithful, typed mirror of the pipeline's single source of
// truth at `scripts/insights/lib/format.mjs` — the pipeline is plain ESM
// consumed by Node, this is TypeScript consumed by Astro's type-checked
// build. Keep the two in sync: any rounding-rule change here must land in
// format.mjs too. Templates must never hand-format raw numbers; always call
// through here (spec Section 6.2).

export function formatUsdCompact(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1e9) return `${sign}$${trimZero((abs / 1e9).toFixed(abs / 1e9 >= 100 ? 0 : 1))}B`;
  if (abs >= 1e6) return `${sign}$${trimZero((abs / 1e6).toFixed(abs / 1e6 >= 100 ? 0 : 1))}M`;
  if (abs >= 1e3) return `${sign}$${trimZero((abs / 1e3).toFixed(abs / 1e3 >= 100 ? 0 : 1))}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function trimZero(str: string): string {
  return str.endsWith('.0') ? str.slice(0, -2) : str;
}

export function formatPercent(
  value: number | null | undefined,
  { signed = false, digits = 1 }: { signed?: boolean; digits?: number } = {}
): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatInt(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value).toLocaleString('en-US');
}
