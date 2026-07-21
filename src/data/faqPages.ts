// FAQ-per-URL: one question per page (spec: each answer on its own URL so the
// whole slug becomes relevance for that question). These are natural-language,
// procedural federal-contracting questions, distinct from the glossary's
// term definitions and from the product FAQ on /faq/. No FAQPage schema here on
// purpose: the page IS the answer to one query. Plain voice, no em dashes.

export interface FaqLink {
  label: string;
  href: string;
}

export interface FaqPage {
  slug: string;
  question: string; // drives H1 and <title>
  short: string; // one-sentence direct answer: the lede + meta description
  body: string[]; // supporting paragraphs
  glossary?: string[]; // glossary term slugs to link (/glossary/<slug>/)
  related?: string[]; // other faqPage slugs
  solutions?: FaqLink[];
  more?: FaqLink; // a deeper resource (blog pillar, insights, etc.)
}

export const faqPages: FaqPage[] = [
  {
    slug: 'how-do-i-register-in-sam-gov',
    question: 'How do I register in SAM.gov?',
    short:
      'Create a Login.gov account, request a Unique Entity ID, then complete the free entity registration at SAM.gov. It is free and takes a few days to activate.',
    body: [
      'Start at SAM.gov with a Login.gov account, then request your Unique Entity ID (UEI) and complete the entity registration. You will enter your business details, NAICS codes, size and socioeconomic status, banking information for payment, and your reps and certs. A CAGE code is issued automatically as part of the process.',
      'Registration is free. No third party is required, and legitimate registration never costs money, so be wary of services that charge to do it for you. New registrations can take a couple of weeks to validate, so start well before a deadline. Renew every year to keep it active.',
    ],
    glossary: ['sam-registration', 'uei', 'cage-code', 'naics-code'],
    related: ['how-long-is-a-sam-registration-valid', 'how-do-i-get-a-cage-code', 'how-do-i-become-a-government-contractor'],
    solutions: [{ label: 'Autofill your federal registration data', href: '/solutions/form-autofiller/' }],
  },
  {
    slug: 'how-long-is-a-sam-registration-valid',
    question: 'How long is a SAM registration valid?',
    short: 'A SAM.gov registration is valid for one year and must be renewed annually to stay active.',
    body: [
      'Your registration in SAM.gov expires 12 months after activation or your last update. You must renew it every year, and it is smart to renew 30 to 60 days early because updates can take time to process.',
      'Letting a registration lapse is a common and costly mistake: an expired registration can stall an award or hold up a payment on a contract you already have. Set a reminder ahead of the expiration date.',
    ],
    glossary: ['sam-registration'],
    related: ['how-do-i-register-in-sam-gov'],
  },
  {
    slug: 'how-do-i-get-a-cage-code',
    question: 'How do I get a CAGE code?',
    short:
      'You do not apply for a CAGE code separately. One is assigned automatically when you complete your SAM.gov registration.',
    body: [
      'A CAGE code is issued as part of the SAM.gov entity registration, so completing that registration is how you get one. There is no separate application and no fee. Businesses located outside the United States receive an NCAGE code instead.',
      'If you already have an active SAM registration, your CAGE code is listed in your entity record. It identifies your specific business location across federal payment, shipping, and contract systems.',
    ],
    glossary: ['cage-code', 'sam-registration'],
    related: ['how-do-i-register-in-sam-gov', 'do-i-still-need-a-duns-number'],
  },
  {
    slug: 'do-i-still-need-a-duns-number',
    question: 'Do I still need a DUNS number?',
    short:
      'No. The DUNS number was retired in April 2022 and replaced by the Unique Entity ID (UEI) assigned in SAM.gov.',
    body: [
      'The federal government stopped using the Dun & Bradstreet DUNS number in April 2022. Its replacement is the Unique Entity ID (UEI), a 12-character code assigned directly in SAM.gov at no cost.',
      'If a form or portal still asks for a DUNS number, the UEI is what it now expects. You do not need to request a DUNS number to do business with the federal government.',
    ],
    glossary: ['uei', 'sam-registration'],
    related: ['how-do-i-register-in-sam-gov'],
  },
  {
    slug: 'how-do-i-respond-to-a-sources-sought-notice',
    question: 'How do I respond to a sources sought notice?',
    short:
      'Answer the specific questions the notice asks and map your past work to the described need. It is market research, not a proposal, but a strong response can shape the eventual solicitation.',
    body: [
      'A sources sought notice is the agency doing market research before it decides how to compete the work. There is no proposal and no award yet. Your response should directly answer the questions asked, state your business size and socioeconomic status for the listed NAICS code, and give a few closely relevant past-performance examples.',
      'Responding is worth the effort even though nothing is awarded. A good response can influence how the requirement is written, and whether it gets set aside for small businesses, and it puts your capabilities in front of the buyer early. Keep it concise and tailored to the specific notice.',
    ],
    glossary: ['sources-sought', 'past-performance', 'set-aside'],
    related: ['how-do-i-find-government-contract-opportunities', 'how-many-past-performance-references-do-i-need'],
    solutions: [{ label: 'Draft a capability response with AI', href: '/solutions/ai-proposal-generator/' }],
  },
  {
    slug: 'whats-the-difference-between-an-rfp-and-an-rfq',
    question: "What's the difference between an RFP and an RFQ?",
    short:
      'An RFP asks for full proposals when the award weighs factors beyond price; an RFQ asks for price quotes on a well-defined, usually lower-dollar buy.',
    body: [
      'A Request for Proposal (RFP) is used when the government will consider more than price, such as technical approach and past performance, often in a best-value tradeoff. It lays out the requirement, submission instructions (Section L), and evaluation factors (Section M), and it expects a substantial written proposal.',
      'A Request for Quotation (RFQ) is lighter weight. The requirement is well defined, often ordered against an existing vehicle like a GSA Schedule, and the emphasis is on price and delivery. In short: RFP means compete on merit and price, RFQ usually means quote a price on a clear spec.',
    ],
    glossary: ['rfp', 'rfq', 'rfi', 'lpta-vs-best-value'],
    related: ['how-do-i-become-a-government-contractor'],
    solutions: [{ label: 'Shred an RFP into a compliance matrix', href: '/solutions/rfp-shredding/' }],
  },
  {
    slug: 'how-do-i-find-government-contract-opportunities',
    question: 'How do I find government contract opportunities?',
    short:
      'Search SAM.gov for active solicitations in your NAICS codes, and watch sources sought notices to spot work before the formal RFP.',
    body: [
      'SAM.gov is the official, free place to find active federal solicitations. Filter by the NAICS codes that match your business and by set-aside type to focus on work you can win. State and local governments run their own procurement portals, which are worth tracking if you sell locally.',
      'Do not wait for the RFP. Sources sought notices and Requests for Information appear earlier and signal what is coming, giving you time to position, team, and prepare. Tracking market data on where agencies are spending also helps you aim at the right buyers.',
    ],
    glossary: ['sources-sought', 'naics-code', 'set-aside'],
    related: ['how-do-i-become-a-government-contractor', 'how-do-i-respond-to-a-sources-sought-notice'],
    more: { label: 'See where federal money is going', href: '/insights/' },
  },
  {
    slug: 'how-do-i-become-a-government-contractor',
    question: 'How do I become a government contractor?',
    short:
      'Register in SAM.gov, identify your NAICS codes and any set-aside eligibility, then find and respond to solicitations that fit.',
    body: [
      'The baseline steps are: register your business in SAM.gov (which gives you a UEI and CAGE code), determine the NAICS codes that describe your work, and check whether you qualify for any small-business set-aside programs like 8(a), WOSB, SDVOSB, or HUBZone. That combination decides which opportunities you can compete for.',
      'From there it is about finding the right solicitations and writing responses that follow the government\'s structure. Start with lower-risk entry points like sources sought notices and RFQs, and build past performance you can point to on bigger bids.',
    ],
    glossary: ['sam-registration', 'naics-code', 'set-aside', '8a'],
    related: ['how-do-i-register-in-sam-gov', 'how-do-i-find-government-contract-opportunities'],
    solutions: [{ label: 'Draft your first proposal with AI', href: '/solutions/ai-proposal-generator/' }],
    more: { label: 'How to write a government proposal', href: '/blog/how-to-write-a-government-proposal/' },
  },
  {
    slug: 'how-long-does-it-take-to-win-a-federal-contract',
    question: 'How long does it take to win a federal contract?',
    short:
      'Expect months, not weeks. From registration to first award commonly takes 6 to 18 months, because the pipeline runs from market research to solicitation to evaluation.',
    body: [
      'There is no fixed timeline, but new contractors should plan for a long runway. Setup in SAM.gov is quick, but the buying cycle is not: agencies publish sources sought notices and RFIs months before a solicitation, proposals then take weeks to prepare, and evaluation and award can take months more.',
      'You can shorten your effective timeline by getting registered now, building relationships and past performance early, and responding to pre-solicitation notices so you are ready when the RFP drops. Speed on the proposal itself is one of the few parts you control.',
    ],
    glossary: ['rfp', 'sources-sought'],
    related: ['how-do-i-find-government-contract-opportunities', 'how-do-i-become-a-government-contractor'],
  },
  {
    slug: 'how-many-past-performance-references-do-i-need',
    question: 'How many past-performance references do I need?',
    short:
      'Most solicitations ask for three to five recent, relevant references. Relevance and recency matter more than the raw number.',
    body: [
      'The exact count is set by each solicitation, but three to five is typical. What evaluators weigh is not how many you list but how closely each one matches the current work in size, scope, and complexity, and how recent it is, usually within the last three to five years.',
      'A few tightly matched references, described against the evaluation criteria and backed by CPARS ratings where available, beat a long list of loosely related jobs. If you are new, look for subcontracting or commercial work you can position as relevant.',
    ],
    glossary: ['past-performance', 'cpars'],
    related: ['how-do-i-respond-to-a-sources-sought-notice'],
    solutions: [{ label: 'Turn past work into proposal narrative', href: '/solutions/ai-proposal-generator/' }],
  },
];

export const getFaqPage = (slug: string) => faqPages.find((f) => f.slug === slug);
