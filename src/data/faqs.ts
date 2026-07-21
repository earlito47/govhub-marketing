export interface FAQ {
  question: string;
  answer: string;
  category?: string;
  /**
   * Pathnames whose FAQ block should surface this question (for on-page FAQPage
   * schema). The /faq page shows every FAQ regardless. Use `faqsForPage(path)`.
   */
  pages?: string[];
}

export const faqs: FAQ[] = [
  {
    category: 'Product',
    question: 'What is GovHub?',
    answer:
      'GovHub is an AI proposal writing platform built specifically for government contractors. It helps small businesses, system integrators, and consulting firms draft, review, and submit responses to federal, state, and local RFPs, RFIs, and RFQs faster.',
  },
  {
    category: 'Product',
    question: 'Which types of government solicitations does GovHub support?',
    answer:
      'Federal RFPs (SAM.gov, GSA schedules), state and local solicitations, RFIs, RFQs, sources sought notices, and unsolicited proposals. GovHub is designed around the structural conventions of government responses (Sections L and M, evaluation criteria, compliance matrices).',
  },
  {
    category: 'Product',
    question: 'Does GovHub replace my proposal manager?',
    answer:
      "No. GovHub speeds up the drafting, review, and formatting work that eats most of a proposal manager's time. The human still owns strategy, teaming decisions, and final quality control.",
  },
  {
    category: 'Compliance',
    question: 'How does GovHub handle FAR and DFARS requirements?',
    answer:
      'GovHub is aware of common Federal Acquisition Regulation (FAR) and Defense Federal Acquisition Regulation Supplement (DFARS) clauses and can flag compliance-relevant sections during drafting and review.',
  },
  {
    category: 'Compliance',
    question: 'Is GovHub Section 508 accessibility aware?',
    answer:
      'Yes. GovHub can generate Section 508 conformance statements and review proposal deliverables against accessibility criteria commonly required by federal agencies.',
  },
  {
    category: 'Security',
    question: 'Where is my proposal data stored?',
    answer:
      'Your proposal content is stored on secure cloud infrastructure with encryption in transit and at rest, and GovHub does not train AI models on your proposal data. See the security page for details on data handling and hosting.',
  },
  {
    category: 'Pricing',
    question: 'How is GovHub priced?',
    answer:
      'See the pricing page for current plans. GovHub offers tiers for solo consultants, small-business contractors, and larger integrator teams.',
  },

  // ── AEO/GEO questions (from keyword research) — answered in 40–60 words,
  // truthful and confident, so pages are eligible for AI-engine citation. ──
  {
    category: 'Product',
    question: 'What is the best AI software for writing government proposals?',
    answer:
      'The best fit depends on your work. GovHub is purpose-built for government contractors, it drafts federal, state, and local RFP responses with Section L/M structure, FAR/DFARS awareness, and compliance matrices built in, rather than being a general-purpose sales-RFP tool adapted to government use.',
    pages: ['/'],
  },
  {
    category: 'Pricing',
    question: 'How much does government proposal software cost?',
    answer:
      'GovHub plans run from $129/month (Solo) to $699/month (Team), with a $349/month Pro plan for teams responding regularly. Every plan includes a 14-day free trial, no credit card required. Many general-purpose RFP platforms are enterprise-priced with seat minimums.',
    pages: ['/', '/pricing/'],
  },
  {
    category: 'Product',
    question: 'Is there software that writes RFP responses automatically?',
    answer:
      "Yes. GovHub's AI proposal generator drafts full narrative sections (technical approach, management approach, past performance) from the solicitation and your knowledge base. It produces a first draft your team reviews and finalizes: it removes the blank page and the mechanical work, not the human judgment.",
    pages: ['/', '/solutions/ai-proposal-generator/'],
  },
  {
    category: 'Compliance',
    question: 'How do I create a compliance matrix for a government RFP?',
    answer:
      "Extract every requirement and instruction from Section L and every evaluation factor from Section M, then map each to a response location and owner. GovHub's free compliance matrix generator does this automatically, paste the solicitation and export a structured matrix in seconds.",
    pages: ['/solutions/compliance-matrix-generator/'],
  },
  {
    category: 'Product',
    question: 'What is RFP shredding and how does it work?',
    answer:
      "RFP shredding breaks a solicitation into every discrete requirement ('shall,' 'must,' and 'will' statements, submission instructions, and evaluation factors) so nothing is missed. GovHub shreds the document automatically and turns it into a compliance matrix you build your response around.",
    pages: ['/solutions/rfp-shredding/'],
  },
  {
    category: 'Compliance',
    question: 'What are Section L and Section M in a government RFP?',
    answer:
      'Section L contains the instructions for preparing and submitting your proposal; Section M defines the factors the government uses to evaluate it. Together they dictate how you must structure your response and what actually wins, read both before writing anything.',
    pages: ['/faq/'],
  },
  {
    category: 'Compliance',
    question: 'Can AI write a federal proposal that is compliant?',
    answer:
      'AI can draft compliant content when it is built around government requirements and paired with human review. GovHub is Section L/M- and FAR/DFARS-aware and flags compliance-relevant gaps, but a person still owns final compliance and quality control, the honest, defensible way to use AI on federal work.',
    pages: ['/', '/solutions/ai-proposal-generator/'],
  },
  {
    category: 'Comparison',
    question: 'What is the difference between Loopio and government-specific proposal tools?',
    answer:
      'Loopio is a general-purpose enterprise RFP platform, strong at content libraries and Q&A reuse. Government-specific tools like GovHub are built around the structure of federal responses (Section L/M, compliance matrices, FAR/DFARS, set-aside representations) instead of leaving that configuration to each customer.',
    pages: ['/vs/loopio/'],
  },
  {
    category: 'Comparison',
    question: 'Is GovWin IQ a proposal writing tool?',
    answer:
      'No. Deltek GovWin IQ is a market-intelligence and opportunity-discovery platform, it helps you find and qualify opportunities but does not write proposals. GovHub handles drafting, review, and formatting after you decide to pursue an opportunity. Many contractors use both together.',
    pages: ['/vs/govwin-iq/'],
  },
  {
    category: 'Product',
    question: 'What software helps small businesses win government contracts?',
    answer:
      'Small businesses need to compress proposal work without a large team. GovHub drafts responses, checks compliance, and autofills forms so an 8(a), WOSB, SDVOSB, or HUBZone firm can compete on quality against larger contractors, starting at a solo-consultant price point.',
    pages: ['/for/small-business-contractors/'],
  },
  {
    category: 'Product',
    question: 'How do I fill out an SF330 form?',
    answer:
      'The SF330 has two parts: Part I (contract-specific qualifications, including project examples and resumes) and Part II (general firm qualifications). GovHub autofills both from your company profile and past-performance library, so you assemble the form instead of retyping the same data each time.',
    pages: ['/solutions/sf330/'],
  },
  {
    category: 'Compliance',
    question: 'Why do government proposals get rejected?',
    answer:
      "The most common reason is non-compliance: missing a Section L instruction, exceeding page limits, or failing to address a Section M factor makes a proposal 'non-responsive' before its merits are judged. Compliance-aware drafting and review catch these gaps before submission.",
    pages: ['/faq/'],
  },
  {
    category: 'Education',
    question: 'What is a bid/no-bid decision in government contracting?',
    answer:
      'A bid/no-bid decision is the go/no-go call on whether to pursue an opportunity. It weighs fit, competition, incumbency, resources, and win probability against the cost of responding. Reading Section L and Section M early is a fast first-pass signal for that decision.',
    pages: ['/faq/'],
  },
  {
    category: 'Education',
    question: 'How long does it take to write a government proposal?',
    answer:
      'A federal proposal commonly takes 40 to 100-plus hours depending on complexity, page count, and team size, spread across drafting, reviews, and production under a deadline. Automating drafting, compliance checks, and formatting is where most of that time is recovered.',
    pages: ['/faq/'],
  },
  {
    category: 'Education',
    question: "What's the difference between an RFP, RFI, and RFQ?",
    answer:
      'An RFI (request for information) gathers market information with no award. An RFQ (request for quotation) seeks pricing for defined requirements, usually simpler buys. An RFP (request for proposal) asks for a full technical and price proposal evaluated on stated criteria, the most involved to respond to.',
    pages: ['/faq/'],
  },
];

/** FAQs whose `pages` tag includes the given pathname (for on-page FAQ blocks). */
export const faqsForPage = (path: string): FAQ[] =>
  faqs.filter((f) => f.pages?.includes(path));
