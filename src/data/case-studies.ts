export interface CaseStudy {
  slug: string;
  title: string;
  customer: string;
  industry: string;
  outcome: string;
  body: string;
  publishDate: string;
}

/**
 * Add case studies here to auto-generate /case-studies/<slug>/ pages.
 * Left empty until we have real customer results to publish.
 */
export const caseStudies: CaseStudy[] = [];

export const getCaseStudySlugs = () => caseStudies.map((c) => c.slug);
export const getCaseStudy = (slug: string) =>
  caseStudies.find((c) => c.slug === slug);
