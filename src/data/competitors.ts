// src/data/competitors.ts
// Seed data driving /vs/[competitor].astro and /alternatives/[competitor].astro
// Sourced from verified 2026 reviews (G2, Capterra, Vendr, ITQlick, SoftwareAdvice)
// as of research date. Pricing figures are third-party estimates since none of
// these vendors publish list pricing — flagged as "estimated" in copy, not stated
// as fact, to stay accurate and defensible.

export interface Competitor {
  slug: string;
  name: string;
  category: 'response-platform' | 'opportunity-intelligence'; // GovWin IQ is a different category — see note below
  tagline: string; // one-line description of what the competitor actually does
  pricingEstimate: string; // always phrase as "estimated" — none publish list pricing
  bestFor: string; // who the competitor genuinely serves well — stay honest here
  strengths: string[]; // real strengths, not strawmanned
  weaknesses: string[]; // sourced from actual reviews, not invented
  comparisonPoints: {
    label: string;
    govhub: string;
    competitor: string;
  }[];
  faqs: { question: string; answer: string }[];
}

export const competitors: Competitor[] = [
  {
    slug: 'loopio',
    name: 'Loopio',
    category: 'response-platform',
    tagline:
      'Enterprise RFP response and content library platform, trusted by large teams managing high-volume questionnaires.',
    pricingEstimate:
      'Estimated $15,000–$40,000+/year for small-to-mid teams, scaling to $80,000–$150,000+ for enterprise deployments. Loopio does not publish pricing; buyers go through a custom sales quote.',
    bestFor:
      'Large enterprise teams managing 50+ RFPs a year with a dedicated proposal desk and the headcount to maintain a content library.',
    strengths: [
      'Mature, well-regarded content library with strong search and reuse tooling',
      'Clean, intuitive interface — commonly rated easier to onboard than Responsive',
      'Deep Salesforce integration and established enterprise support model',
      'Trusted by large organizations (IBM, Citrix, Thomson Reuters among reported customers)',
    ],
    weaknesses: [
      'Seat-based pricing — occasional or non-critical contributors still require a full paid license, which discourages broad team adoption',
      'Minimum annual commitment typically starts around $15,000, regardless of team size, pricing out most small govcon shops',
      'The "Magic" AI autofill feature is library-dependent — output quality degrades quickly if the content library isn\'t actively maintained, and multiple reviewers describe it as inconsistent',
      'SSO and Salesforce integration are priced as add-ons beyond the base subscription',
      'Export formatting issues are a recurring complaint in verified reviews',
      'Not built for the federal compliance structure (Section L/M, FAR/DFARS) that small govcon proposals require',
    ],
    comparisonPoints: [
      {
        label: 'Built for government compliance (Section L/M, FAR/DFARS)',
        govhub: 'Yes — purpose-built for federal proposal structure',
        competitor: 'No — general-purpose RFP/RFI/security questionnaire tool',
      },
      {
        label: 'Pricing model',
        govhub: 'Flat tiered pricing, accessible to solo and small teams',
        competitor: 'Seat-based, ~$15K/year minimum commitment',
      },
      {
        label: 'AI drafting approach',
        govhub: 'Generates full proposal drafts from your inputs',
        competitor: 'Suggests answers from a pre-built content library — requires ongoing library maintenance',
      },
      {
        label: 'Built for small business / solo contractors',
        govhub: 'Yes — core design target',
        competitor: 'No — explicitly enterprise-tiered, per multiple reviewer reports',
      },
    ],
    faqs: [
      {
        question: 'Is Loopio good for small government contractors?',
        answer:
          'Loopio is built primarily for large enterprise teams with dedicated proposal staff. Its seat-based pricing and roughly $15,000/year minimum commitment make it a difficult fit for small or solo government contractors, and it is not purpose-built for federal compliance requirements like Section L/M structuring.',
      },
      {
        question: 'How is GovHub different from Loopio?',
        answer:
          "GovHub is built specifically for government proposal compliance and small govcon teams, with AI that drafts full proposal content rather than just suggesting answers from a library you have to maintain yourself. Loopio is a broader enterprise RFP response tool used across industries, not government-specific.",
      },
    ],
  },
  {
    slug: 'responsive',
    name: 'Responsive (formerly RFPIO)',
    category: 'response-platform',
    tagline:
      'Enterprise Strategic Response Management platform for high-volume RFPs, RFIs, DDQs, and security questionnaires.',
    pricingEstimate:
      'Estimated $7,000–$28,000/year, averaging around $13,955/year based on third-party transaction data. No public pricing or self-serve trial — sales-led custom quote only.',
    bestFor:
      'Mid-to-large enterprise proposal and presales teams with an established content library, dedicated proposal operations staff, and complex CRM integration needs.',
    strengths: [
      '24 consecutive quarters as a G2 category leader — strong track record',
      'Sophisticated workflow orchestration: task assignment, approval gates, multi-stakeholder routing',
      'AI Writing Agent generates first-draft responses from prior successful answers',
      'Broad document format support across RFPs, RFIs, DDQs, and security questionnaires',
    ],
    weaknesses: [
      'No published pricing and no self-serve trial — every evaluation requires a sales conversation',
      'GovCloud and dedicated cloud hosting for regulated/government use are not included in lower tiers and cost extra',
      'Standard data migration is a paid add-on, which can be significant for teams with large legacy libraries',
      'UI inconsistency between the legacy and redesigned interface is a recurring complaint in verified reviews',
      'Does not natively track proposal win rates or connect submitted answers to deal outcomes',
      'AI output quality is directly tied to library maintenance — same structural limitation as Loopio',
      'Not built specifically for federal compliance workflows (Section L/M, FAR/DFARS, compliance matrices)',
    ],
    comparisonPoints: [
      {
        label: 'Built for government compliance (Section L/M, FAR/DFARS)',
        govhub: 'Yes — purpose-built for federal proposal structure',
        competitor: 'No — general enterprise RFx platform, not government-specific',
      },
      {
        label: 'Pricing transparency',
        govhub: 'Published tiered pricing',
        competitor: 'Custom quote only, no public pricing',
      },
      {
        label: 'GovCloud / regulated hosting',
        govhub: 'Included',
        competitor: 'Paid add-on on lower tiers',
      },
      {
        label: 'Free trial available',
        govhub: 'Yes',
        competitor: 'No — demo and sales quote required',
      },
    ],
    faqs: [
      {
        question: 'Does Responsive work for federal government proposals?',
        answer:
          'Responsive is a general-purpose enterprise response management platform used across many industries — it is not purpose-built for federal compliance requirements like Section L/M structuring or FAR/DFARS proposal formatting. Teams in regulated or government contracting work may also need to pay extra for GovCloud hosting, which is not included in lower tiers.',
      },
      {
        question: 'Can I try Responsive for free?',
        answer:
          'No. Responsive does not offer a self-serve free trial — access requires a sales conversation and custom quote.',
      },
    ],
  },
  {
    slug: 'govwin-iq',
    name: 'Deltek GovWin IQ',
    category: 'opportunity-intelligence',
    tagline:
      'Government contract opportunity intelligence and market research platform — not a proposal writing tool.',
    pricingEstimate:
      'Estimated $13,000–$119,000/year, averaging around $29,000/year, based on third-party deal benchmark data. Entry-level packages exist around $6,000/year but typically exclude the analyst-access features that are GovWin\'s core value.',
    bestFor:
      'Large federal prime contractors chasing $50M+ contracts who need analyst-verified opportunity intelligence 3–5 years ahead of RFP release, and who have budget for a dedicated business development research tool.',
    strengths: [
      '150+ industry analysts producing pre-solicitation opportunity intelligence — a genuinely unique capability no proposal-writing tool replicates',
      'Deep integration with the Deltek ecosystem (Costpoint, Vantagepoint) for contractors already on that stack',
      'Comprehensive federal and SLED (state/local/education) procurement data',
      '4.5/5 rating on G2 from verified reviews',
    ],
    weaknesses: [
      'Not a proposal-writing or content generation platform at all — it finds opportunities, it does not help you write the response',
      'Pricing is high relative to team size — multiple small business reviewers describe it as "a financial strain" and "cost prohibitive"',
      'Dated, click-heavy user interface is a consistent complaint across verified reviews',
      'Information overload — reviewers report too much unfiltered data without enough curation',
      'No mobile app — desktop/browser only',
      'Aggressive auto-renewal clauses requiring 60 days written notice to cancel',
    ],
    comparisonPoints: [
      {
        label: 'What it actually does',
        govhub: 'Writes and manages your proposal response',
        competitor: 'Finds and tracks opportunities — does not write proposals',
      },
      {
        label: 'Proposal drafting / AI writing',
        govhub: 'Yes — core feature',
        competitor: 'No — GovWin IQ has no proposal generation capability',
      },
      {
        label: 'Built for small business budgets',
        govhub: 'Yes',
        competitor: 'Entry packages exist (~$6K/yr) but exclude core analyst features',
      },
      {
        label: 'Use case',
        govhub: 'Respond to an RFP you\'ve already found',
        competitor: 'Find an RFP before it\'s publicly posted',
      },
    ],
    faqs: [
      {
        question: 'Is GovWin IQ the same kind of tool as GovHub?',
        answer:
          'No — this is an important distinction. GovWin IQ is an opportunity intelligence platform that helps you find and track government contracts, often years before they are formally posted. It does not write or manage proposal responses. GovHub is a proposal writing and compliance platform used once you already have an RFP to respond to. Many govcon teams use a discovery tool and a response tool together rather than choosing one over the other.',
      },
      {
        question: 'Is GovWin IQ worth it for a small business?',
        answer:
          'Multiple verified small-business reviewers describe GovWin IQ\'s pricing as a financial strain, and Deltek\'s own entry-level tier typically excludes the analyst-access features that are the platform\'s main value. It tends to make the most sense for larger contractors pursuing $50M+ opportunities who can absorb the estimated $13,000–$119,000/year cost.',
      },
    ],
  },
];

export const getCompetitorSlugs = () => competitors.map((c) => c.slug);
export const getCompetitor = (slug: string) =>
  competitors.find((c) => c.slug === slug);
