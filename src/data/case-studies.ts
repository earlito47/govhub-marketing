export interface CaseStudyMetrics {
  winRate?: string;
  timeSaved?: string;
  result?: string;
}

export interface CaseStudy {
  slug: string;
  title: string;
  customer: string; // anonymized descriptor, e.g. "A cybersecurity subcontractor"
  industry: string;
  contractValue?: string;
  timeframe?: string;
  challenge: string;
  solution: string;
  results: string[];
  quote?: string;
  author?: string; // anonymized role, e.g. "Founder & CEO"
  metrics?: CaseStudyMetrics;
  outcome: string; // one-line summary, used as the meta description
  publishDate: string; // ISO date
}

/**
 * Add case studies here to auto-generate /case-studies/<slug>/ pages.
 *
 * Content decision: anonymize the customer and author (descriptor + role, no
 * real names/companies) and only include dollar/percentage figures that are
 * verified — these pages index, so no {{VERIFY}} tokens may remain. Populated in
 * a later batch; empty here so the hub renders an empty state and no [slug]
 * pages are generated yet.
 */
export const caseStudies: CaseStudy[] = [];

export const getCaseStudySlugs = () => caseStudies.map((c) => c.slug);
export const getCaseStudy = (slug: string) =>
  caseStudies.find((c) => c.slug === slug);
