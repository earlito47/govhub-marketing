// src/data/competitors.ts
// Seed data driving /vs/[competitor].astro and /alternatives/[competitor].astro
// Sourced from verified 2026 reviews (G2, Capterra, Vendr, ITQlick, SoftwareAdvice)
// as of research date. Pricing figures are third-party estimates since none of
// these vendors publish list pricing — flagged as "estimated" in copy, not stated
// as fact, to stay accurate and defensible.

export interface Competitor {
  slug: string;
  name: string;
  /** Compact name for <title> tags (SERP budget is ~60 chars); falls back to name. */
  shortName?: string;
  // 'response-platform': writes responses (Loopio, Responsive).
  // 'opportunity-intelligence': forecasts and researches contracts before they
  //   are posted (GovWin IQ).
  // 'bid-search': finds open bids (BidPrime, BidNet Direct, PlanetBids). Since
  //   2026-10 GovHub does this too, then writes the proposal, so these pages
  //   compare like with like on finding and then show the rest.
  category: 'response-platform' | 'opportunity-intelligence' | 'bid-search';
  tagline: string; // one-line description of what the competitor actually does
  pricingEstimate: string; // phrase as "estimated" unless publishedPricing is set (some bid services publish)
  bestFor: string; // who the competitor genuinely serves well — stay honest here
  strengths: string[]; // real strengths, not strawmanned
  weaknesses: string[]; // sourced from actual reviews, not invented
  comparisonPoints: {
    label: string;
    govhub: string;
    competitor: string;
  }[];
  faqs: { question: string; answer: string }[];
  /**
   * The long-form post that goes deepest on this competitor. Both /vs/ and
   * /alternatives/ link to it, and it links back, so the three pages for a
   * competitor form a closed triangle instead of three orphans.
   *
   * This matters because the deep-dive post is often the strongest ranker of
   * the three and the least linked. GSC 2026-08: the GovWin pricing post sat
   * at position 5.8 for "govwin iq pricing" with a single inbound internal
   * link, while /vs/govwin-iq/ took most of the impressions at position 17.5.
   * Google was splitting one query across four of our URLs and mostly showing
   * the weaker one.
   */
  deepDive?: { href: string; label: string };
  /**
   * Where this competitor's "<name> pricing" queries should land.
   *
   * Set this only when a dedicated page already outranks /vs/ and
   * /alternatives/ for the pricing cluster. When set, PriceComparison drops
   * its exact-match "<name>: pricing" heading and the detailed estimate on the
   * comparison pages and points at the canonical page instead, so the three
   * pages stop bidding against each other for one query.
   *
   * GSC 2026-08 for "govwin iq pricing": the post ranked 5.8, /vs/govwin-iq/
   * ranked 17.5 but took 28 of the 38 impressions, /alternatives/govwin-iq/
   * ranked 38.6, and /pricing/ ranked 67.2. Google had four candidates and
   * mostly served the second-best one.
   *
   * Leave unset for competitors with no dedicated pricing page: there the
   * comparison pages are the best answer we publish, and the pricing table is
   * what makes them rank at all.
   */
  pricingCanonical?: { href: string; label: string };
  /**
   * Other tools a searcher should weigh, besides GovHub.
   *
   * "<competitor> alternatives" is a list intent. A page that answers it with
   * one name, ours, is not the page they came for, and the SERP reflected
   * that: /alternatives/loopio/ took 706 impressions at position 17.6 over the
   * 90 days to 2026-09-14 and was never clicked, sitting under
   * review-aggregator listicles that do name the field.
   *
   * Naming real competitors, including ones that beat us for a given job, is
   * what makes the page worth ranking. Each entry stays honest about who the
   * tool actually suits; `fit` is the one-line "pick this when".
   */
  alternativesRoster?: { name: string; fit: string; note: string }[];
  /**
   * Very short price statement for meta descriptions, e.g. "starts around
   * $15,000/year". Must stay consistent with pricingEstimate above; it is the
   * same claim compressed to fit a ~160-char SERP budget.
   *
   * A number is the most clickable thing we can put in a description, and it
   * is the one thing the pages ranking above us cannot copy: these vendors do
   * not publish list pricing, so review-aggregator listicles say "contact
   * sales". GSC 2026-08: these pages drew 479 impressions and zero clicks at
   * positions 18-21 behind descriptions that named no number.
   */
  priceHook: string;
  /**
   * For a competitor that DOES publish prices (several bid services do), the
   * real figures from its own site, so PriceComparison shows them instead of
   * "no public price". `source` is the page they came from and `checked` the
   * date, both shown on the page.
   */
  publishedPricing?: { starting: string; plans: string; trial: string; source: string; checked: string };
}

export const competitors: Competitor[] = [
  // ── Bid services (category 'bid-search'), added 2026-10-31 ──────────────
  // Researched 2026-10-31 from each company's own pages: BidNet Direct via
  // SOVRA (bidnetdirect.com refused automated reads), PlanetBids via
  // vendor.planetbids.com. bidprime.com blocks automated readers, so BidPrime
  // facts come from its April 2026 press release, its search-indexed pages and
  // third-party listings, and every BidPrime price is labeled an estimate.
  // Only claims with a source; competitor prices are dated where shown.
  {
    slug: 'bidnet-direct',
    priceHook: 'charges $100 to $330 a month by state',
    name: 'BidNet Direct',
    category: 'bid-search',
    tagline:
      'A government bid network, now part of SOVRA, where suppliers search and get alerts for public sector bids, free for bids from its member agencies.',
    publishedPricing: {
      starting: 'Free for member agency bids; $100/month for one state',
      plans: 'Basic free (member agencies only), Local $100/mo (1 state), Regional $200/mo (3 states), National $330/mo',
      trial: 'Not stated; free Basic plan',
      source: 'https://www.sovra.com/pricing-suppliers/',
      checked: 'Oct 31, 2026',
    },
    pricingEstimate:
      'Published by SOVRA: Basic is free for member agency bids; Local is $100/month for one state, Regional $200/month for three states, National $330/month (checked October 31, 2026).',
    bestFor:
      'Suppliers who mainly bid with BidNet Direct member agencies, or who want low-cost bid alerts in one state and already write their own responses.',
    strengths: [
      'A large supplier network: SOVRA cites 1 million suppliers and bids from over 90,000 government agencies',
      'Free access to bids from its member agencies, with electronic bid submission',
      'Plan holder lists and over 20 years of historical solicitation data',
      'Clear published pricing by state',
    ],
    weaknesses: [
      'Stops at the bid: no proposal writing, proposal scoring or form filling',
      'Paid plans are priced by state, so national coverage is the $330/month tier',
      'The free plan covers member agency bids only',
      'No AI summaries of bids; its AI is a support chat assistant',
    ],
    comparisonPoints: [
      { label: 'Finding bids', govhub: 'Federal, state and local bids read daily, with an AI summary of each', competitor: 'Search 25,000+ open bids from 90,000+ agencies, per SOVRA' },
      { label: 'Matching', govhub: 'Ranked against your NAICS codes, states, set-asides and keywords, with the reason for each match', competitor: 'Saved searches and NIGP-code matching, with a daily match summary on paid plans' },
      { label: 'Bid summaries', govhub: 'A plain-English AI summary of every bid', competitor: 'Not offered' },
      { label: 'Proposal writing and scoring', govhub: 'A full draft, scored against the evaluation criteria', competitor: 'Not offered' },
      { label: 'Form filling', govhub: 'SF-33, SF-1449, reps and certs from your company profile', competitor: 'Not offered' },
      { label: 'Pricing', govhub: 'Published tiers, the same price nationwide, 14-day free trial', competitor: 'Free for member agencies; $100 to $330/month by state coverage' },
    ],
    faqs: [
      {
        question: 'Is BidNet Direct free?',
        answer:
          "Its Basic plan is free for bids from BidNet Direct member agencies. Seeing bids beyond member agencies costs $100 a month for one state, $200 for three states or $330 nationwide, per SOVRA's supplier pricing page (checked October 31, 2026).",
      },
      {
        question: 'Does BidNet Direct write proposals?',
        answer:
          'No. BidNet Direct finds bids, sends alerts and handles electronic submission for its member agencies. GovHub finds and matches bids too, then drafts the proposal, scores it and fills out the forms.',
      },
    ],
    alternativesRoster: [
      { name: 'BidPrime', fit: 'Pick it for document retrieval across many small agencies', note: 'Broad local coverage and Docs on Demand; its AI drafts outlines and checklists, not full proposals; annual plans by quote.' },
      { name: 'PlanetBids VendorLine', fit: 'Pick it if your agencies run on PlanetBids', note: 'Free to bid with PlanetBids agencies; VendorLine is $547 to $897 a year with AI bid briefs; no proposal writing.' },
      { name: 'DemandStar (now Euna OpenBids)', fit: 'Pick it for cheap single-county alerts', note: 'Free for one agency, $60 a year per county, up to $2,699 a year nationwide; no AI and no proposal tools.' },
      { name: 'Periscope S2G', fit: 'Pick it for state contract and catalog work', note: 'A free tier covering about 2% of bids; paid plans by state or region, billed upfront; no proposal tools.' },
      { name: 'GovTribe', fit: 'Pick it for federal capture with AI drafting in Office files', note: 'Federal, state and local search with profile matching, and AI that fills Word, Excel and PowerPoint templates; $1,900 a seat a year, billed annually, 7-day trial.' },
      { name: 'HigherGov', fit: 'Pick it for low-cost market research and award data', note: 'Search, alerts, award data and pipelines from $500 a year for one user, 2-week trial; proposal help is a pricing-page mention, not a product.' },
    ],
  },
  {
    slug: 'bidprime',
    priceHook: 'sells annual plans by quote',
    name: 'BidPrime',
    category: 'bid-search',
    tagline:
      'A government bid-finding service that alerts you to federal, state and local bids and retrieves bid documents, with an AI assistant for qualifying them.',
    pricingEstimate:
      'BidPrime does not post a price list; plans are annual subscriptions quoted after a trial or sales call. Third-party listings put entry plans at roughly $99 to $250 a month, and a G2 reviewer reported paying $749 for a year. Treat every figure as an estimate. Directory listings describe a 30-day free trial with no credit card.',
    bestFor:
      'Contractors who want broad bid alerts across many local agencies, including documents that are not posted online, and who already have a way to write the response.',
    strengths: [
      'Broad coverage claim: bids from over 110,000 government agencies, federal through school districts',
      'Docs on Demand: its team retrieves bid documents that are not posted online',
      'An AI assistant that summarizes scope and deadlines, extracts requirements like bonding and insurance, and drafts outlines, compliance checklists and cover letters (BidPrime press release, April 2026)',
      'A human configuration team that tunes your matching',
    ],
    weaknesses: [
      'Stops short of the proposal: its AI produces outlines, checklists and cover letters, not a full draft scored against the evaluation criteria',
      'No form filling for SF-33, SF-1449 or reps and certs',
      'No published price list, so cost is a sales conversation',
    ],
    comparisonPoints: [
      { label: 'Finding bids', govhub: 'Federal, state and local bids read daily, with an AI summary of each', competitor: 'Federal, state and local bids from 110,000+ agencies, with document retrieval' },
      { label: 'Matching', govhub: 'Ranked against your NAICS codes, states, set-asides and keywords, with the reason for each match', competitor: 'Profile matching plus a configuration team' },
      { label: 'Proposal writing', govhub: 'A full draft against the solicitation, in your firm’s voice', competitor: 'Outlines, compliance checklists and cover letters' },
      { label: 'Proposal scoring', govhub: 'Scored against the evaluation criteria before you submit', competitor: 'Not offered' },
      { label: 'Form filling', govhub: 'SF-33, SF-1449, reps and certs from your company profile', competitor: 'Not offered' },
      { label: 'Pricing', govhub: 'Published tiers, 14-day free trial', competitor: 'Annual plans by quote; a free trial per directory listings' },
    ],
    faqs: [
      {
        question: 'Does BidPrime write proposals?',
        answer:
          "Not in full. BidPrime's AI assistant summarizes bids and drafts outlines, compliance checklists and cover letters. GovHub drafts the full proposal against the solicitation, scores it against the evaluation criteria and fills out the forms.",
      },
      {
        question: 'How much does BidPrime cost?',
        answer:
          'BidPrime does not post a price list; it sells annual subscriptions by quote. Third-party listings suggest roughly $99 to $250 a month for entry plans, so treat any figure as an estimate. GovHub publishes its prices, and they include the proposal writing and form filling.',
      },
    ],
    alternativesRoster: [
      { name: 'BidNet Direct', fit: 'Pick it if your buyers are BidNet member agencies', note: 'Free for member agency bids; $100 to $330 a month by state for the rest; no proposal tools.' },
      { name: 'PlanetBids VendorLine', fit: 'Pick it if your agencies run on PlanetBids', note: 'Free to bid with PlanetBids agencies; VendorLine is $547 to $897 a year with AI bid briefs; no proposal writing.' },
      { name: 'DemandStar (now Euna OpenBids)', fit: 'Pick it for cheap single-county alerts', note: 'Free for one agency, $60 a year per county, up to $2,699 a year nationwide; no AI and no proposal tools.' },
      { name: 'Periscope S2G', fit: 'Pick it for state contract and catalog work', note: 'A free tier covering about 2% of bids; paid plans by state or region, billed upfront; no proposal tools.' },
      { name: 'GovTribe', fit: 'Pick it for federal capture with AI drafting in Office files', note: 'Federal, state and local search with profile matching, and AI that fills Word, Excel and PowerPoint templates; $1,900 a seat a year, billed annually, 7-day trial.' },
      { name: 'HigherGov', fit: 'Pick it for low-cost market research and award data', note: 'Search, alerts, award data and pipelines from $500 a year for one user, 2-week trial; proposal help is a pricing-page mention, not a product.' },
    ],
  },
  {
    slug: 'planetbids',
    priceHook: 'charges $547 to $897 a year for VendorLine',
    name: 'PlanetBids',
    category: 'bid-search',
    tagline:
      'A procurement platform that public agencies use to post and run their bids, with a paid vendor product, VendorLine, for finding bids across agencies.',
    publishedPricing: {
      starting: 'Free to bid on PlanetBids agency projects; VendorLine Pro $547/year',
      plans: 'VendorLine Pro $547/yr; Pro Plus AI $897/yr (100 AI-analyzed bids a year)',
      trial: 'Not stated',
      source: 'https://vendor.planetbids.com/pricing',
      checked: 'Oct 31, 2026',
    },
    pricingEstimate:
      'Published: bidding on PlanetBids agency projects is free; VendorLine Pro is $547/year and Pro Plus AI $897/year (vendor.planetbids.com, checked October 31, 2026).',
    bestFor:
      'Vendors who mainly bid with agencies that run their procurement on PlanetBids, and who want low-cost bid matching with AI briefs.',
    strengths: [
      'Bidding on projects posted by PlanetBids agencies is free, and it says more than 500 public agencies use it',
      'VendorLine adds AI bid briefs, matching, a bid/no-bid suggestion and chat about a bid’s requirements',
      'Pipeline tracking, competitor views and sub-bid teaming tools',
      'A low published annual price',
    ],
    weaknesses: [
      'No proposal writing, proposal scoring or government form filling',
      'AI analysis on Pro Plus AI is capped at 100 bids a year',
      'Coverage is about 10,000 active bids, by its own count',
    ],
    comparisonPoints: [
      { label: 'What it is', govhub: 'A contractor platform: find, match, write, score and fill out forms', competitor: 'An agency procurement portal, with VendorLine for vendors' },
      { label: 'Finding bids', govhub: 'Federal, state and local bids read daily, with an AI summary of each', competitor: '10,000+ active bids across 50 states, with federal bids from SAM.gov (VendorLine)' },
      { label: 'Matching and bid briefs', govhub: 'Ranked against your NAICS codes, states and set-asides, with a summary of each bid', competitor: 'AI matching, AI bid briefs and a bid/no-bid suggestion (100 AI-analyzed bids a year on Pro Plus AI)' },
      { label: 'Proposal writing and scoring', govhub: 'A full draft, scored against the evaluation criteria', competitor: 'Not offered' },
      { label: 'Form filling', govhub: 'SF-33, SF-1449, reps and certs from your company profile', competitor: 'Not offered' },
      { label: 'Pricing', govhub: 'Published monthly tiers, 14-day free trial', competitor: '$547 or $897 a year; bidding on PlanetBids agency projects is free' },
    ],
    faqs: [
      {
        question: 'Do I need PlanetBids to bid with an agency that uses it?',
        answer:
          "You register on that agency's PlanetBids portal to download documents and submit, and PlanetBids says it never charges vendors to bid on a project. VendorLine, its paid vendor product, is for finding bids across agencies. GovHub reads bids from SAM.gov and state and local portals across the country, then writes the response.",
      },
      {
        question: 'Does PlanetBids write proposals?',
        answer:
          'No. VendorLine summarizes bids and suggests whether to bid. GovHub also drafts the proposal, scores it and fills out the forms.',
      },
    ],
    alternativesRoster: [
      { name: 'BidNet Direct', fit: 'Pick it if your buyers are BidNet member agencies', note: 'Free for member agency bids; $100 to $330 a month by state for the rest; no proposal tools.' },
      { name: 'BidPrime', fit: 'Pick it for document retrieval across many small agencies', note: 'Broad local coverage and Docs on Demand; its AI drafts outlines and checklists, not full proposals; annual plans by quote.' },
      { name: 'DemandStar (now Euna OpenBids)', fit: 'Pick it for cheap single-county alerts', note: 'Free for one agency, $60 a year per county, up to $2,699 a year nationwide; no AI and no proposal tools.' },
      { name: 'Periscope S2G', fit: 'Pick it for state contract and catalog work', note: 'A free tier covering about 2% of bids; paid plans by state or region, billed upfront; no proposal tools.' },
      { name: 'GovTribe', fit: 'Pick it for federal capture with AI drafting in Office files', note: 'Federal, state and local search with profile matching, and AI that fills Word, Excel and PowerPoint templates; $1,900 a seat a year, billed annually, 7-day trial.' },
      { name: 'HigherGov', fit: 'Pick it for low-cost market research and award data', note: 'Search, alerts, award data and pipelines from $500 a year for one user, 2-week trial; proposal help is a pricing-page mention, not a product.' },
    ],
  },
  {
    slug: 'loopio',
    priceHook: 'starts around $15,000/year',
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
      'Clean, intuitive interface, commonly rated easier to onboard than Responsive',
      'Deep Salesforce integration and established enterprise support model',
      'Trusted by large organizations (IBM, Citrix, Thomson Reuters among reported customers)',
    ],
    weaknesses: [
      'Seat-based pricing, occasional or non-critical contributors still require a full paid license, which discourages broad team adoption',
      'Minimum annual commitment typically starts around $15,000, regardless of team size, pricing out most small govcon shops',
      'The "Magic" AI autofill feature is library-dependent, output quality degrades quickly if the content library isn\'t actively maintained, and multiple reviewers describe it as inconsistent',
      'SSO and Salesforce integration are priced as add-ons beyond the base subscription',
      'Export formatting issues are a recurring complaint in verified reviews',
      'Not built for the federal compliance structure (Section L/M, FAR/DFARS) that small govcon proposals require',
    ],
    comparisonPoints: [
      {
        label: 'Built for government compliance (Section L/M, FAR/DFARS)',
        govhub: 'Yes, purpose-built for federal proposal structure',
        competitor: 'No, general-purpose RFP/RFI/security questionnaire tool',
      },
      {
        label: 'Pricing model',
        govhub: 'Flat tiered pricing, accessible to solo and small teams',
        competitor: 'Seat-based, ~$15K/year minimum commitment',
      },
      {
        label: 'AI drafting approach',
        govhub: 'Generates full proposal drafts from your inputs',
        competitor: 'Suggests answers from a pre-built content library, requires ongoing library maintenance',
      },
      {
        label: 'Built for small business / solo contractors',
        govhub: 'Yes, core design target',
        competitor: 'No, explicitly enterprise-tiered, per multiple reviewer reports',
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
    deepDive: {
      href: '/blog/loopio-competitors-federal-proposals/',
      label: 'Loopio competitors for federal proposals',
    },
    // Set preemptively, which is a deliberate departure from the rule above.
    // The dedicated post shipped on 2026-09-14 and has no ranking history yet,
    // so it cannot yet be shown to outrank /vs/ and /alternatives/.
    //
    // Waiting for that proof means reproducing a split we have now watched
    // twice. Over the 90 days to 2026-09-14 "loopio pricing" was already
    // divided between /alternatives/loopio/ at 20.8 and /vs/loopio/ at 25.0,
    // with no clicks on either, and both GovWin IQ and RFPIO ended with the
    // dedicated post ranking far ahead of the comparison pages once one
    // existed. A third candidate carrying its own price table is what turns
    // that into a three-way split, so the deferral goes in now rather than
    // after the damage. If the post has not overtaken both pages by the end of
    // 2026, remove this and the pages take their pricing detail back.
    pricingCanonical: {
      href: '/blog/loopio-pricing-real-ranges-addons-roi/',
      label: 'Loopio pricing: real ranges, add-ons, ROI math',
    },
    alternativesRoster: [
      {
        name: 'Privia',
        fit: 'Federal teams that live in Word and run color team cycles',
        note: 'A longtime federal staple for proposal collaboration, with strong document control, versioning, and review workflows. Handles hard page limits and Word-based authoring well.',
      },
      {
        name: 'Expedience Software',
        fit: 'Firms that must hit an exact format, font, and page count',
        note: 'A Microsoft Word add-in for templates, styles, boilerplate, and compliance outlines, rather than a separate platform to move your work into.',
      },
      {
        name: 'Responsive (formerly RFPIO)',
        fit: 'Enterprise teams with a dedicated proposal desk',
        note: 'Scales further than Loopio on governance, SSO, and audit trails. Like Loopio, it is a general enterprise RFx tool, so Section L/M structure is not built in.',
      },
      {
        name: 'SiftHub',
        fit: 'Teams whose pain is answering recurring questionnaires',
        note: 'AI-first knowledge base that auto-answers RFP and security questionnaires. Strong at Q&A, still maturing on strict compliance packaging and page-count control.',
      },
      {
        name: 'XaitPorter',
        fit: 'Large teams needing strict change control',
        note: 'Structured document authoring with heavyweight workflow and auditability. Worth the weight only if your process genuinely requires it.',
      },
      {
        name: 'RocketDocs',
        fit: 'Regulated industries with mature content governance',
        note: 'Content library and proposal automation, enterprise leaning, with ISO-style controls.',
      },
      {
        name: 'Qvidian (Upland)',
        fit: 'Large content operations, mostly commercial',
        note: 'Deep search and business rules over a big answer library. Little federal-specific guidance.',
      },
      {
        name: 'Zbizlink',
        fit: 'Small firms building a first formal process',
        note: 'SMB-friendly proposal management covering pipeline, teaming, templates, and content library at a lower entry price.',
      },
    ],
  },
  {
    slug: 'responsive',
    priceHook: 'averages about $14,000/year',
    name: 'Responsive (formerly RFPIO)',
    shortName: 'Responsive',
    category: 'response-platform',
    tagline:
      'Enterprise Strategic Response Management platform for high-volume RFPs, RFIs, DDQs, and security questionnaires.',
    pricingEstimate:
      'Estimated $7,000–$28,000/year, averaging around $13,955/year based on third-party transaction data. No public pricing or self-serve trial, sales-led custom quote only.',
    bestFor:
      'Mid-to-large enterprise proposal and presales teams with an established content library, dedicated proposal operations staff, and complex CRM integration needs.',
    strengths: [
      '24 consecutive quarters as a G2 category leader, strong track record',
      'Sophisticated workflow orchestration: task assignment, approval gates, multi-stakeholder routing',
      'AI Writing Agent generates first-draft responses from prior successful answers',
      'Broad document format support across RFPs, RFIs, DDQs, and security questionnaires',
    ],
    weaknesses: [
      'No published pricing and no self-serve trial, every evaluation requires a sales conversation',
      'GovCloud and dedicated cloud hosting for regulated/government use are not included in lower tiers and cost extra',
      'Standard data migration is a paid add-on, which can be significant for teams with large legacy libraries',
      'UI inconsistency between the legacy and redesigned interface is a recurring complaint in verified reviews',
      'Does not natively track proposal win rates or connect submitted answers to deal outcomes',
      'AI output quality is directly tied to library maintenance, same structural limitation as Loopio',
      'Not built specifically for federal compliance workflows (Section L/M, FAR/DFARS, compliance matrices)',
    ],
    comparisonPoints: [
      {
        label: 'Built for government compliance (Section L/M, FAR/DFARS)',
        govhub: 'Yes, purpose-built for federal proposal structure',
        competitor: 'No, general enterprise RFx platform, not government-specific',
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
        competitor: 'No, demo and sales quote required',
      },
    ],
    faqs: [
      {
        question: 'Does Responsive work for federal government proposals?',
        answer:
          'Responsive is a general-purpose enterprise response management platform used across many industries, it is not purpose-built for federal compliance requirements like Section L/M structuring or FAR/DFARS proposal formatting. Teams in regulated or government contracting work may also need to pay extra for GovCloud hosting, which is not included in lower tiers.',
      },
      {
        question: 'Can I try Responsive for free?',
        answer:
          'No. Responsive does not offer a self-serve free trial, access requires a sales conversation and custom quote.',
      },
    ],
    deepDive: {
      href: '/blog/rfpio-alternative-federal-contractors/',
      label: 'RFPIO alternatives for federal contractors',
    },
    // Same split GovWin IQ had, same fix. GSC over the 90 days to 2026-09-14
    // for the "rfpio pricing" cluster: the post ranked 7.2 on 25 impressions,
    // /alternatives/responsive/ ranked 17.6 on 352, and /vs/responsive/ 17.8
    // on 105. Google was handed three candidates and served the two weaker
    // ones to 95% of searchers. Nothing in the cluster has ever been clicked.
    pricingCanonical: {
      href: '/blog/rfpio-pricing-real-ranges/',
      label: 'RFPIO pricing: real ranges, addons, and ROI math',
    },
  },
  {
    slug: 'govwin-iq',
    priceHook: 'starts around $6,000/year, most teams pay far more',
    name: 'Deltek GovWin IQ',
    shortName: 'GovWin IQ',
    category: 'opportunity-intelligence',
    tagline:
      'Government contract opportunity intelligence and market research platform, not a proposal writing tool.',
    // Re-verified 2026-08-17 against public sources, because the figures here
    // and in the pricing post had drifted apart and neither matched what is
    // published. What the sources actually say:
    //   ITQlick      ~$200/user/month; ~$21,600/yr for 10 users; $10k+/mo enterprise
    //   Fed-Spend    $12,000-$15,000 starter, $12,000-$42,000 overall, 5-8% renewal uplift
    //   widely cited $13,000-$119,000, avg $29,000, attributed to Vendr buyer data
    //   Vendr itself $9,099-$39,500, avg $19,990, across ALL Deltek products
    //                from 32 purchases, with no GovWin IQ breakout published
    // The previous "$4,500-$7,500 single federal seat" claim matched none of
    // them and understated the entry point; nothing public supports it. The
    // widely-repeated $13k-$119k figure could not be confirmed on Vendr's own
    // page, so it is no longer attributed to them by name.
    // Sources disagree by a wide margin and Deltek publishes no list price, so
    // copy must keep saying "reported" and "estimated" rather than stating a
    // figure as fact.
    pricingEstimate:
      'Estimated $6,000–$15,000/year for an entry-level single federal seat, rising to $20,000–$42,000/year for the multi-seat, multi-module setup most teams need. Large primes are reported far higher, up to $119,000/year, with reported averages of $20,000–$29,000 across all deal sizes. Deltek publishes no list price and third-party sources disagree by a wide margin, so treat every figure as an estimate. The entry tier typically excludes the analyst-access features that are GovWin\'s core value.',
    bestFor:
      'Large federal prime contractors chasing $50M+ contracts who need analyst-verified opportunity intelligence 3–5 years ahead of RFP release, and who have budget for a dedicated business development research tool.',
    strengths: [
      '150+ industry analysts producing pre-solicitation opportunity intelligence, a genuinely unique capability no proposal-writing tool replicates',
      'Deep integration with the Deltek ecosystem (Costpoint, Vantagepoint) for contractors already on that stack',
      'Comprehensive federal and SLED (state/local/education) procurement data',
      '4.5/5 rating on G2 from verified reviews',
    ],
    weaknesses: [
      'Not a proposal-writing or content generation platform at all, it finds opportunities, it does not help you write the response',
      'Pricing is high relative to team size, multiple small business reviewers describe it as "a financial strain" and "cost prohibitive"',
      'Dated, click-heavy user interface is a consistent complaint across verified reviews',
      'Information overload, reviewers report too much unfiltered data without enough curation',
      'No mobile app, desktop/browser only',
      'Aggressive auto-renewal clauses requiring 60 days written notice to cancel',
    ],
    comparisonPoints: [
      {
        label: 'What it actually does',
        govhub: 'Finds and matches open bids, then writes the proposal',
        competitor: 'Researches and tracks opportunities, does not write proposals',
      },
      {
        // Added 2026-10-31 when GovHub shipped bid search; the old rows said
        // GovHub only worked on a solicitation you already had.
        label: 'Finding open bids',
        govhub: 'Federal, state and local bids, matched to your NAICS codes, states and set-asides',
        competitor: 'Yes, plus analyst forecasts of contracts before they are posted',
      },
      {
        label: 'Proposal drafting / AI writing',
        govhub: 'Yes, core feature',
        competitor: 'No, GovWin IQ has no proposal generation capability',
      },
      {
        label: 'Built for small business budgets',
        govhub: 'Yes',
        competitor: 'Entry packages reported from ~$6K/yr but exclude core analyst features',
      },
      {
        label: 'Use case',
        govhub: 'Find open bids that fit and respond to them',
        competitor: 'Track an opportunity before it\'s publicly posted',
      },
    ],
    faqs: [
      {
        question: 'Is GovWin IQ the same kind of tool as GovHub?',
        answer:
          'Not quite. GovWin IQ is an opportunity intelligence platform: its analysts track government contracts, often years before they are formally posted, but it does not write or manage proposal responses. GovHub finds open federal, state and local bids, matches them to your company, and then writes, scores and formats the proposal. Teams pursuing large recompetes years out often use both.',
      },
      {
        question: 'Is GovWin IQ worth it for a small business?',
        answer:
          'Multiple verified small-business reviewers describe GovWin IQ\'s pricing as a financial strain, and Deltek\'s own entry-level tier typically excludes the analyst-access features that are the platform\'s main value. Entry-level packages are reported at $6,000–$15,000/year, but a setup with the modules that make the platform useful is reported at $20,000–$42,000, which is where the strain comes from. It tends to make the most sense for larger contractors pursuing $50M+ opportunities.',
      },
    ],
    deepDive: {
      href: '/blog/govwin-iq-pricing-real-ranges-terms-roi/',
      label: 'What GovWin IQ actually costs: ranges, terms, and ROI math',
    },
    pricingCanonical: {
      href: '/blog/govwin-iq-pricing-real-ranges-terms-roi/',
      label: 'GovWin IQ pricing: real ranges, terms, and ROI math',
    },
  },
];

export const getCompetitorSlugs = () => competitors.map((c) => c.slug);
export const getCompetitor = (slug: string) =>
  competitors.find((c) => c.slug === slug);
