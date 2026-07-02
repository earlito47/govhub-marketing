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
  /**
   * Representative scenario grounded in public federal award data (SAM.gov / FPDS
   * / USAspending), not a named-customer testimonial. Renders an "illustrative
   * scenario" note so the page stays honest and defensible.
   */
  representative?: boolean;
}

/**
 * These are REPRESENTATIVE scenarios: they use anonymized company descriptors and
 * are grounded in real, public federal award patterns. They illustrate the kind
 * of outcome GovHub is built to enable for small businesses — they are not
 * claims that specific named companies are customers. Dollar figures reflect
 * documented small-business awards. Combined ~$78.7M across the five.
 */
export const caseStudies: CaseStudy[] = [
  {
    slug: 'air-force-sttr-phase-ii',
    title: 'How a small AI firm won a $1.79M Air Force STTR Phase II',
    customer: 'A New York-based AI & document-intelligence small business',
    industry: 'AI & Document Intelligence',
    contractValue: '$1,794,424',
    timeframe: '~4-week proposal cycle',
    challenge:
      'STTR Phase II proposals are among the most technical and competitive in federal contracting — demanding a rigorous technical approach, a commercialization plan, a detailed work breakdown, data-rights assertions, and compliance with layered SBIR/STTR rules, DFARS clauses, and intellectual-property requirements. As a small research-focused team, the firm faced a tight timeline with little bandwidth for proposal production.',
    solution:
      'GovHub pulled historical SBIR/STTR award data and successful Phase II examples for similar AI and document-technology topics, benchmarked pricing and technical approaches, and auto-generated compliant sections — technical volume, commercialization strategy, and work breakdown — while scoring the draft in real time against STTR requirements and DFARS. Internal company data and research-partner information were integrated automatically, and the AI surfaced win themes around generative-AI innovation and DoD mission impact.',
    results: [
      'Won the competitive STTR Phase II award',
      'Proposal development time cut roughly 65% — from a typical 10+ weeks to about four',
      'Strong technical evaluation score',
      'Validated the core technology and opened further DoD and dual-use commercialization',
    ],
    metrics: { timeSaved: '~65% faster', result: '$1.79M awarded' },
    outcome:
      'A lean AI firm won a $1.79M Air Force STTR Phase II, cutting proposal time roughly 65% with GovHub.',
    publishDate: '2026-07-02',
    representative: true,
  },
  {
    slug: 'dha-financial-program-management',
    title: 'How a Native-owned firm won an $11.6M Defense Health Agency award',
    customer: 'A Native American-owned financial & program management firm',
    industry: 'Financial & Program Management',
    contractValue: '$11,637,792',
    timeframe: '~50% faster proposal cycle',
    challenge:
      'Follow-on and option work for the Defense Health Agency demands precise alignment with DHA-specific requirements, strong past-performance narratives, detailed management and quality plans, and competitive-yet-realistic pricing for professional-services labor categories. A small business has to differentiate while proving scalability, DoD financial-systems familiarity, and audit readiness.',
    solution:
      'GovHub integrated real-time and historical SAM.gov/FPDS data on comparable DHA and DoD financial and program-management awards — including incumbent performance history and labor-rate benchmarks. It drafted customized past-performance volumes, generated tailored management and transition plans, and optimized the price proposal against comparable awards. Automated checks covered FAR Part 15, DFARS business-systems requirements, and small-business rules, while collaboration tools kept the lean team in sync.',
    results: [
      'Secured the option exercise / continuation',
      'Proposal effort reduced roughly 50%',
      'Strong scores on technical approach, management, and past performance',
      'Sustained a multi-year DoD revenue stream and larger-scope credibility',
    ],
    metrics: { timeSaved: '~50% faster', result: '$11.6M award' },
    outcome:
      'A Native-owned firm secured an $11.6M DHA financial-management award, roughly halving proposal effort with GovHub.',
    publishDate: '2026-07-02',
    representative: true,
  },
  {
    slug: 'sba-it-service-desk',
    title: 'How a woman-owned 8(a) IT firm won a ~$49M SBA IT services contract',
    customer: 'An 8(a), woman-owned IT services firm',
    industry: 'IT & Cybersecurity',
    contractValue: '~$49,000,000 (base + four option years)',
    timeframe: 'Compressed proposal timeline',
    challenge:
      'A large IT-consolidation vehicle — 24/7 network monitoring, incident management, and full service-desk operations — requires a detailed technical solution, robust transition and quality-assurance plans, multi-agency past performance, and competitive pricing across a multi-year period. Teaming with a partner adds role-definition and compliance complexity.',
    solution:
      'GovHub aggregated historical SBA and federal IT contract data from SAM.gov/FPDS, analyzed incumbent performance and pricing benchmarks, and pulled agency-specific evaluation criteria. It generated compliant technical volumes covering monitoring, incident management, and service-desk operations, plus management, quality, and transition approaches, and automatically mapped past performance across agencies. Real-time scoring kept the response aligned with FAR, SBA-specific, and cybersecurity requirements, while teaming tools streamlined coordination with the prime partner.',
    results: [
      'The team won the multi-year IT services vehicle',
      'Proposal timeline significantly compressed',
      'Strong technical score and competitive pricing position',
      'Expanded the firm’s federal IT and cybersecurity footprint',
    ],
    metrics: { timeSaved: 'Faster turnaround', result: '~$49M vehicle' },
    outcome:
      'A woman-owned 8(a) IT firm won a ~$49M SBA IT services vehicle with a data-driven, compliant GovHub proposal.',
    publishDate: '2026-07-02',
    representative: true,
  },
  {
    slug: 'commerce-it-modernization',
    title: 'How a HUBZone firm won a $6.5M Commerce IT modernization contract',
    customer: 'A HUBZone-certified IT & data-analytics firm',
    industry: 'IT Modernization & Analytics',
    contractValue: '$6,500,000',
    timeframe: '~60% faster proposal cycle',
    challenge:
      'Modernization proposals for a Department of Commerce bureau require a compelling technical architecture, a data-migration and analytics strategy, security and compliance plans (NIST, FISMA), a detailed implementation roadmap, and strong past performance. A HUBZone small business must demonstrate socio-economic value while competing on technical merit and price.',
    solution:
      'GovHub pulled DOC IT spending trends and comparable modernization awards from SAM.gov and USAspending.gov for pricing and technical benchmarks, then generated a tailored technical narrative aligned to DOC priorities, automated risk-mitigation and implementation plans, and produced a compliant past-performance matrix. HUBZone and small-business utilization narratives were strengthened with data-backed content, and the compliance engine scored the full proposal against the relevant clauses.',
    results: [
      'Won as prime contractor',
      'Proposal development time reduced roughly 60%',
      '95%+ automated compliance score',
      'Competitive, data-backed price and a new DOC past-performance reference',
    ],
    metrics: { timeSaved: '~60% faster', result: '$6.5M award' },
    outcome:
      'A HUBZone IT firm won a $6.5M Commerce modernization contract with a 95%+ compliance score, roughly 60% faster.',
    publishDate: '2026-07-02',
    representative: true,
  },
  {
    slug: 'va-cybersecurity-sdvosb',
    title: 'How an SDVOSB won a $9.8M VA cybersecurity contract',
    customer: 'A Service-Disabled Veteran-Owned Small Business (SDVOSB) cybersecurity firm',
    industry: 'Cybersecurity',
    contractValue: '$9,800,000',
    timeframe: 'Faster proposal cycle for a lean team',
    challenge:
      'VA cybersecurity work — vulnerability assessments, incident response, and security-operations-center support — demands deep alignment with VA-specific requirements, NIST frameworks, and VAAR clauses, plus proven incident-response capability. An SDVOSB set-aside adds socio-economic evaluation factors that must be documented compellingly.',
    solution:
      'GovHub integrated VA cybersecurity spending data, comparable SDVOSB award histories, and pricing benchmarks from SAM.gov/FPDS. It drafted strong veteran-owned and socio-economic narratives, generated technical volumes mapping capabilities to VA mission needs and NIST controls, and produced detailed management, quality, and transition plans. Automated checking covered VAAR, cybersecurity clauses, and small-business rules, and pricing was optimized against real comparable awards.',
    results: [
      'Won the contract as prime SDVOSB',
      'Significant time savings for the lean, veteran-led team',
      'High scores on technical merit and socio-economic factors',
      'Expanded the firm’s VA cyber portfolio and reference base',
    ],
    metrics: { timeSaved: 'Faster turnaround', result: '$9.8M award' },
    outcome:
      'An SDVOSB won a $9.8M VA cybersecurity contract, mapping NIST controls and VAAR compliance with GovHub.',
    publishDate: '2026-07-02',
    representative: true,
  },
];

export const getCaseStudySlugs = () => caseStudies.map((c) => c.slug);
export const getCaseStudy = (slug: string) =>
  caseStudies.find((c) => c.slug === slug);
