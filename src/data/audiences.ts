export interface Audience {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  problems: string[];
  solutions: Array<{ title: string; description: string }>;
  art?: string; // Gold Country hero scene (public/brand/page-graphics/)
  faqs: Array<{ question: string; answer: string }>;
}

/**
 * Adding an audience here automatically generates /for/<slug>/.
 * Frame content around the specific pain of that buyer segment.
 */
export const audiences: Audience[] = [
  {
    slug: 'small-business-contractors',
    art: '/brand/page-graphics/for-small-business-basecamp-climb.svg',
    name: 'Small business contractors',
    headline: 'Win more federal work without hiring a proposal team.',
    intro:
      'Small business contractors — SBA 8(a), WOSB, SDVOSB, HUBZone, and general small business — face the same 50-to-500-page RFPs as prime contractors, without the same overhead. GovHub compresses the drafting and review work so a two-person shop can compete on quality against firms ten times their size.',
    problems: [
      'A single federal response can eat an entire month of principal time.',
      'Hiring a dedicated proposal writer rarely pencils out until you are bidding steadily throughout the year.',
      "Missing a compliance requirement in Section L is a shortcut to a 'non-responsive' rejection.",
      'Reusing prior proposals means copy-pasting stale content and hoping nothing broke.',
    ],
    solutions: [
      {
        title: 'AI-drafted responses from your prior work',
        description:
          'GovHub reads the solicitation, checks it against your past-performance library, and drafts the technical narrative in your voice — not a generic template.',
      },
      {
        title: 'Automated compliance checking',
        description:
          "GovHub cross-references your response against Section L, Section M, and FAR clauses to flag missing elements before submission.",
      },
      {
        title: 'Form autofill for representations & certifications',
        description:
          'Reps & certs, SF-1449, SF-33, and standard cover pages autofill from your company profile.',
      },
    ],
    faqs: [
      {
        question: 'Is GovHub priced for small businesses?',
        answer:
          "Yes. Our smallest plan is designed for solo consultants and 1–5 person contracting firms. See the pricing page for current tiers.",
      },
      {
        question: 'Can GovHub handle my socioeconomic status requirements (8(a), WOSB, HUBZone)?',
        answer:
          "Yes. GovHub is aware of small-business set-aside categories and can generate the applicable certifications and narrative sections.",
      },
      {
        question: 'How much time does GovHub save on a typical response?',
        answer:
          'Time savings vary by proposal complexity, but the biggest gains come from removing the blank-page drafting and the manual compliance and formatting work.',
      },
    ],
  },

  {
    slug: 'system-integrators',
    art: '/brand/page-graphics/for-system-integrators-rail-network.svg',
    name: 'System integrators',
    headline: 'Coordinate large multi-team proposals without losing days to formatting.',
    intro:
      "System integrators run the largest, most complex government pursuits — multi-hundred-page responses with contributions from dozens of subject matter experts, subcontractors, and pricing teams. GovHub is the coordination layer that keeps a distributed team's content, compliance, and formatting in sync.",
    problems: [
      'A single response can involve dozens of SMEs across multiple subcontractors; version control breaks down fast.',
      'Compliance matrices drift out of sync with the narrative as sections get rewritten.',
      'Formatting cleanup at the end of a pursuit consumes hours of senior time across every contributing team.',
      'Past-performance and resume data lives in scattered SharePoint sites and email attachments.',
    ],
    solutions: [
      {
        title: 'Multi-contributor drafting with change tracking',
        description:
          'SMEs and subcontractors draft assigned sections in parallel. GovHub keeps compliance matrices, evaluation criteria alignment, and formatting consistent as content moves.',
      },
      {
        title: 'Centralized past-performance and personnel library',
        description:
          "Resumes, past-performance write-ups, and reference contacts live in a single searchable library and get pulled into the right sections automatically.",
      },
      {
        title: 'Enterprise SSO and audit trail',
        description:
          "SAML SSO, role-based access, and a full audit trail on every edit — built for larger organizations' compliance requirements.",
      },
    ],
    faqs: [
      {
        question: 'Does GovHub scale to 500+ page responses?',
        answer:
          'Yes. GovHub is designed for large multi-team pursuits, including responses to defense, IT modernization, and health IDIQ recompetes.',
      },
      {
        question: 'Can GovHub integrate with our existing SharePoint or content management stack?',
        answer:
          'GovHub can pull past-performance, resume, and technical content from SharePoint and comparable document stores.',
      },
      {
        question: 'Does GovHub support SSO and SOC 2 requirements?',
        answer:
          'Yes. GovHub supports SAML single sign-on, role-based access, and a full audit trail on every edit. See the security page for details on data protection and our compliance posture.',
      },
    ],
  },
];

export const getAudienceSlugs = () => audiences.map((a) => a.slug);
export const getAudience = (slug: string) => audiences.find((a) => a.slug === slug);
