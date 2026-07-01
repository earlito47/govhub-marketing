export interface FAQ {
  question: string;
  answer: string;
  category?: string;
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
      "Proposal content is stored in {{VERIFY: hosting region and provider}}. GovHub does not train models on customer proposal data.",
  },
  {
    category: 'Pricing',
    question: 'How is GovHub priced?',
    answer:
      'See the pricing page for current plans. GovHub offers tiers for solo consultants, small-business contractors, and larger integrator teams.',
  },
];
