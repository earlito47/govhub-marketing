// Shape of the page-data JSON the Insights pipeline writes to
// src/data/insights/**/*.json (spec Section 6.2). Templates read only this —
// they contain no logic beyond formatting. Kept in sync with the objects
// produced by scripts/insights/compute-stats.mjs.

export type ChartType = 'line' | 'bar';

/** A single [label, value] datum. Values are raw dollars unless noted. */
export type ChartPoint = [string, number];

export interface ChartSeries {
  label: string;
  points: ChartPoint[];
}

export interface Chart {
  id: string;
  type: ChartType;
  title: string;
  series: ChartSeries[];
  /** 'usd' → value labels formatted as compact dollars. */
  unit?: string;
  /** Plain-text, citable one-sentence summary shown under the chart (AEO). */
  takeaway?: string | null;
}

/** A table cell is either a scalar or a link object. */
export type TableCell = string | number | null | { text: string; href: string | null };

export interface DataTableSpec {
  title: string;
  columns: string[];
  rows: TableCell[][];
}

export interface InsightsStats {
  totalObligations: number;
  awardCount: number | null;
  yoyGrowthPct: number | null;
  avgAwardSize: number | null;
  smallBusinessSharePct: number | null;
}

export interface NarrativeSection {
  heading: string;
  body: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface RelatedLink {
  label: string;
  href: string;
}

export interface SourceLink {
  label: string;
  href: string;
}

export interface InsightsPage {
  pageType: 'naics' | 'agency' | 'state' | 'ranking' | 'report';
  slug: string;
  title: string;
  h1: string;
  metaDescription: string;
  updated: string;
  /** Reports only: ISO week key (e.g. "2026-w28") and publish date. */
  week?: string;
  publishedDate?: string;
  /** by-state ranking only: full state list for the choropleth map. */
  mapData?: { code: string; name: string; value: number }[];
  fyWindow: { label: string; start: string; end: string };
  stats: InsightsStats;
  charts: Chart[];
  tables: DataTableSpec[];
  narrative: { intro: string; sections: NarrativeSection[] };
  faq: FaqItem[];
  related: RelatedLink[];
  sources: SourceLink[];
}
