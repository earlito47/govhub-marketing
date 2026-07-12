// Single source of truth for number/date formatting used across the Insights pipeline.
// Templates must never format raw numbers themselves — always call through here.

export function formatUsdCompact(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1e9) return `${sign}$${trimZero((abs / 1e9).toFixed(abs / 1e9 >= 100 ? 0 : 1))}B`;
  if (abs >= 1e6) return `${sign}$${trimZero((abs / 1e6).toFixed(abs / 1e6 >= 100 ? 0 : 1))}M`;
  if (abs >= 1e3) return `${sign}$${trimZero((abs / 1e3).toFixed(abs / 1e3 >= 100 ? 0 : 1))}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function trimZero(str) {
  return str.endsWith('.0') ? str.slice(0, -2) : str;
}

export function formatPercent(value, { signed = false, digits = 1 } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatInt(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value).toLocaleString('en-US');
}

// Federal fiscal year: FY{n} runs Oct 1 (n-1) through Sep 30 (n).
export function fiscalYearOf(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  return month >= 10 ? year + 1 : year;
}

export function fiscalYearRange(fy) {
  return { start: `${fy - 1}-10-01`, end: `${fy}-09-30` };
}

export function fiscalYearLabel(fy) {
  return `FY${fy}`;
}

export function isoWeekString(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
