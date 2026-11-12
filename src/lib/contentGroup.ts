/**
 * GA4 content group for a www page, computed at build time in BaseLayout and
 * sent with gtag('config'), so it lands on the page_view and every later event
 * on the page.
 *
 * Why: GA4's "Content group" dimension was (not set) on 100% of sessions, so the
 * Pages and Engagement reports could not say "bid pages vs insights vs blog" —
 * the question that matters on a site that is ~16,000 bid pages and a few dozen
 * of everything else. Low cardinality on purpose; KEEP THE NAMES STABLE, saved
 * GA4 reports and explorations filter on them.
 *
 * Separate from Analytics.astro's pageType(), which feeds PostHog's
 * landing_view.page_type and keeps its existing values for continuity.
 */
const GROUPS: Array<[RegExp, string]> = [
  [/^\/$/, 'Home'],
  [/^\/bids(\/|$)/, 'Bids'],
  [/^\/insights(\/|$)/, 'Insights'],
  [/^\/blog(\/|$)/, 'Blog'],
  [/^\/solutions(\/|$)/, 'Solutions'],
  [/^\/(vs|alternatives)(\/|$)/, 'Comparisons'],
  [/^\/glossary(\/|$)/, 'Glossary'],
  [/^\/faq(\/|$)/, 'FAQ'],
  [/^\/case-studies(\/|$)/, 'Case studies'],
  [/^\/for(\/|$)/, 'Audiences'],
  [/^\/templates(\/|$)/, 'Templates'],
  [/^\/pricing(\/|$)/, 'Pricing'],
  [/^\/(about|contact|security|compliance)(\/|$)/, 'Company'],
  [/^\/(privacy|terms)(\/|$)/, 'Legal'],
];

export function contentGroupFor(pathname: string): string {
  for (const [re, name] of GROUPS) if (re.test(pathname)) return name;
  return 'Other';
}
