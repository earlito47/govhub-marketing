export interface ComparisonPoint {
  category: string;
  govhub: string;
  competitor: string;
}

export interface Competitor {
  slug: string;
  name: string;
  tagline: string;
  targetMarket: string;
  founded?: number;
  comparisonPoints: ComparisonPoint[];
  strengths: string[];
  weaknesses: string[];
  faqs: Array<{ question: string; answer: string }>;
}

/**
 * Adding a competitor here automatically generates:
 *   - /vs/<slug>/          (head-to-head comparison)
 *   - /alternatives/<slug>/ (alternative-search intent)
 *
 * Framing rule: state verifiable facts about the competitor and clear
 * positioning claims about GovHub. Do not make defamatory claims about
 * competitors — differentiate on GovHub's angle instead of putting the
 * other product down.
 */
export const competitors: Competitor[] = [
  {
    slug: 'loopio',
    name: 'Loopio',
    tagline: 'Response management platform for enterprise RFP teams.',
    targetMarket:
      'Enterprise sales and proposal teams responding to broad B2B RFPs across industries.',
    founded: 2014,
    comparisonPoints: [
      {
        category: 'Government focus',
        govhub:
          'Purpose-built for federal, state, and local government proposals. Understands Section L/M structure, evaluation criteria, and compliance matrices out of the box.',
        competitor:
          'General-purpose B2B RFP platform. Teams responding to government work configure it manually.',
      },
      {
        category: 'AI drafting',
        govhub:
          'AI drafting trained on the structural conventions of government responses, not just Q&A libraries.',
        competitor:
          'Content-library-first: strong for reusing pre-approved answers, less oriented around drafting long-form technical narratives.',
      },
      {
        category: 'Pricing model',
        govhub:
          'Tiered for solo consultants and small-business contractors up through integrator teams.',
        competitor:
          'Priced for enterprise sales organizations. {{VERIFY: pricing tier and seat minimums}}.',
      },
      {
        category: 'Compliance awareness',
        govhub:
          'FAR/DFARS clause-aware; flags Section 508, cybersecurity, and small-business set-aside criteria during review.',
        competitor: 'Compliance handling depends on how each customer configures their content library.',
      },
    ],
    strengths: [
      'Mature content library and Q&A workflow.',
      'Well-established integrations with Salesforce and Microsoft 365.',
      'Broad customer base across industries.',
    ],
    weaknesses: [
      'Not government-specific: FAR/DFARS/Section 508 handling is left to the customer.',
      'Enterprise pricing is a poor fit for solo consultants and small-business contractors.',
    ],
    faqs: [
      {
        question: 'Is GovHub a Loopio alternative for government contractors?',
        answer:
          "Yes. GovHub is a government-specific alternative to Loopio, purpose-built for federal, state, and local RFP responses. Where Loopio serves broad enterprise sales teams, GovHub is designed around the structural conventions and compliance requirements of government proposals.",
      },
      {
        question: 'Can I import my Loopio content library into GovHub?',
        answer:
          "Yes — GovHub supports importing existing proposal content and knowledge bases from Loopio and other platforms. Contact us for a migration walkthrough.",
      },
      {
        question: 'How does pricing compare between GovHub and Loopio?',
        answer:
          "GovHub offers plans starting at a per-seat rate designed for small teams; Loopio is priced primarily for enterprise sales organizations. See the pricing page for current tiers.",
      },
    ],
  },

  {
    slug: 'responsive',
    name: 'Responsive',
    tagline: 'AI-powered response management platform (formerly RFPIO).',
    targetMarket:
      'Cross-industry sales and proposal teams handling RFPs, RFIs, security questionnaires, and DDQs.',
    founded: 2015,
    comparisonPoints: [
      {
        category: 'Government focus',
        govhub:
          'Native handling of Section L, Section M, evaluation factors, and compliance matrices — the structure of a government response is built in.',
        competitor:
          'Broad B2B focus spanning sales RFPs and security questionnaires; government use is possible but the platform is not shaped around it.',
      },
      {
        category: 'Content workflow',
        govhub:
          'Drafts full narrative sections against agency requirements, not just Q&A lookups.',
        competitor:
          'Strong AI-assisted Q&A workflows and content library management (its historical core competency).',
      },
      {
        category: 'Team scale',
        govhub:
          'Optimized for teams of 1–50 responding to a few dozen opportunities per year.',
        competitor:
          "Optimized for larger sales orgs with high-volume questionnaire workflows.",
      },
    ],
    strengths: [
      'Mature AI-assisted Q&A and content library.',
      'Broad integrations across CRM, cloud storage, and collaboration tools.',
      'Strong for security-questionnaire-heavy sales cycles.',
    ],
    weaknesses: [
      'Not shaped around the structural conventions of government proposals.',
      'Compliance clause handling (FAR/DFARS/Section 508) requires manual setup.',
    ],
    faqs: [
      {
        question: 'Is GovHub a Responsive.io alternative?',
        answer:
          "Yes. GovHub is a government-specific alternative to Responsive (formerly RFPIO), purpose-built for federal, state, and local proposal responses.",
      },
      {
        question: 'How does GovHub differ from Responsive for security questionnaires?',
        answer:
          "Responsive is strong for high-volume vendor security questionnaires. GovHub is focused on government solicitation responses — RFPs, RFIs, RFQs, and sources sought — where the structure and evaluation criteria are the primary drivers.",
      },
    ],
  },

  {
    slug: 'deltek-govwin-iq',
    name: 'Deltek GovWin IQ',
    tagline: 'Government market intelligence and opportunity identification platform.',
    targetMarket:
      'Government contractors identifying, qualifying, and forecasting federal, state, and local opportunities.',
    comparisonPoints: [
      {
        category: 'What each tool does',
        govhub:
          'GovHub writes the proposal — drafts, reviews, and formats your response once you have a solicitation to pursue.',
        competitor:
          'GovWin IQ finds and forecasts opportunities — it helps you identify which RFPs to pursue but is not a proposal writing tool.',
      },
      {
        category: 'Where they fit in the pipeline',
        govhub: 'Post-decision: capture is done, now write and submit.',
        competitor: 'Pre-decision: market intelligence, capture planning, and opportunity forecasting.',
      },
      {
        category: 'Do you need both?',
        govhub:
          'Many GovHub customers pair it with a market intelligence tool. GovHub replaces the drafting and review workflow, not the opportunity-discovery workflow.',
        competitor:
          "GovWin IQ complements — not competes with — a proposal writing platform.",
      },
    ],
    strengths: [
      'Deep dataset of federal, state, and local government opportunities.',
      'Strong forecasting and market-intelligence features.',
      'Established brand across large government contractors.',
    ],
    weaknesses: [
      'Not a proposal writing tool — you still need something to draft, review, and format responses.',
      'Priced for enterprise contractors; smaller firms often outgrow their subscription before their pipeline justifies it.',
    ],
    faqs: [
      {
        question: 'Is GovHub a replacement for Deltek GovWin IQ?',
        answer:
          "No — the two tools solve different problems. GovWin IQ helps you find and qualify opportunities. GovHub helps you write the proposal after you decide to pursue one. Many contractors use both.",
      },
      {
        question: 'Does GovHub integrate with GovWin IQ?',
        answer:
          "GovHub can import opportunity details from GovWin IQ exports so you don't retype requirements when moving from capture to drafting. {{VERIFY: current integration state — API vs manual export}}.",
      },
    ],
  },
];

export const getCompetitorSlugs = () => competitors.map((c) => c.slug);
export const getCompetitor = (slug: string) =>
  competitors.find((c) => c.slug === slug);
