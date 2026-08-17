// Federal contracting glossary. One term per URL (spec: the glossary is a
// discovery path — someone Googles a term they just hit in a meeting and lands
// on us). Each entry stays short and plain-voiced (no em dashes), leads with a
// one-sentence answer, and interlinks to related terms plus the feature or
// data page a reader would reach for next.

export interface GlossaryLink {
  label: string;
  href: string;
}

export interface GlossaryTerm {
  slug: string;
  term: string; // display form, drives H1 and <title>
  aka?: string[]; // alternate names / expansions, shown under the H1
  category: 'Registration & IDs' | 'Contract vehicles' | 'Solicitations' | 'Set-asides' | 'Evaluation' | 'Proposal artifacts';
  short: string; // one-sentence answer: the TL;DR and meta description
  body: string[]; // 1-3 short paragraphs
  related?: string[]; // other glossary slugs
  solutions?: GlossaryLink[]; // relevant feature pages (glossary -> money page)
  insight?: GlossaryLink; // relevant Insights page
  /**
   * Too basic to define for this audience, so kept out of the automatic
   * "terms used in this post" block. A federal proposal manager reading us
   * does not need RFP explained, and linking it from all 13 posts pointed the
   * most internal equity on the site at our weakest page: /glossary/rfp/ sits
   * at position 77 against Wikipedia and Investopedia for a generic business
   * term, drawing queries like "rfp meaning in construction" that are not
   * govcon buyers at all (GSC 2026-08).
   *
   * The page stays live and indexed. It is a definition a visitor may still
   * want; it just should not collect links meant for real federal jargon.
   */
  foundational?: boolean;
  /**
   * A stronger page of ours owns this topic, so the automatic "terms used in
   * this post" block links there instead of at the glossary entry.
   *
   * Use it when the glossary page loses to our own pages on every shared
   * query. GSC 2026-08 for the compliance matrix cluster: on "compliance
   * matrix development" the glossary sat at 88.3, the blog post at 79.0 and
   * the solutions page at 41.2; on "proposal compliance matrix" the glossary
   * was at 82.5 against the solutions page at 52.2. Even "what is a compliance
   * matrix" put the glossary at 86.7. Pointing a dozen internal links at the
   * weakest of three pages on one topic just splits the signal further.
   *
   * The glossary page stays live and indexed and keeps its place in the hub;
   * it simply stops collecting links that belong to the page that ranks.
   */
  defersTo?: GlossaryLink;
}

export const glossary: GlossaryTerm[] = [
  {
    slug: 'naics-code',
    term: 'NAICS code',
    aka: ['North American Industry Classification System code'],
    category: 'Registration & IDs',
    short:
      'A six-digit code that classifies the kind of work a contract covers, and the industry your business competes in.',
    body: [
      'Every federal solicitation carries a NAICS code that says what industry the work falls under, from 541511 (custom computer programming) to 236220 (commercial building construction). The code the contracting officer assigns also sets the small-business size standard for that opportunity, measured in either annual revenue or employee count.',
      'You pick the NAICS codes that describe your business when you register in SAM, and they decide which set-aside opportunities you qualify for. Choosing the right primary code matters: it is the first filter buyers and matching tools use to find you.',
    ],
    related: ['sam-registration', 'set-aside', 'cage-code'],
    insight: { label: 'Federal contracts by NAICS code', href: '/insights/government-contracts-by-naics/' },
  },
  {
    slug: 'cage-code',
    term: 'CAGE code',
    aka: ['Commercial and Government Entity code'],
    category: 'Registration & IDs',
    short:
      'A five-character code that uniquely identifies your business location to the federal government.',
    body: [
      'The CAGE code is a five-character identifier the Defense Logistics Agency assigns to each physical location a contractor operates from. It ties your company to its records across federal systems, including payment, shipping, and reps and certs.',
      'You do not apply for one separately: a CAGE code is issued automatically when you complete your SAM registration. Businesses outside the United States get an NCAGE code instead.',
    ],
    related: ['uei', 'sam-registration'],
    solutions: [{ label: 'Autofill your reps and certs', href: '/solutions/form-autofiller/' }],
  },
  {
    slug: 'uei',
    term: 'UEI',
    aka: ['Unique Entity ID', 'replaced the DUNS number'],
    category: 'Registration & IDs',
    short:
      'The 12-character Unique Entity ID that identifies your business in SAM.gov, now used everywhere the DUNS number used to be.',
    body: [
      'The Unique Entity ID is a 12-character alphanumeric code that identifies your business across federal award systems. It is assigned in SAM.gov and, since April 2022, has fully replaced the older DUNS number that Dun & Bradstreet used to issue.',
      'Your UEI follows you through registration, proposals, awards, and payment. If a form or portal still asks for a DUNS number, the UEI is what it now wants.',
    ],
    related: ['sam-registration', 'cage-code'],
    solutions: [{ label: 'Autofill your company profile', href: '/solutions/form-autofiller/' }],
  },
  {
    slug: 'sam-registration',
    term: 'SAM registration',
    aka: ['System for Award Management'],
    category: 'Registration & IDs',
    short:
      'The free System for Award Management registration every business needs before it can be awarded a federal contract.',
    body: [
      'SAM.gov is the federal government\'s central registration system. You cannot be awarded a prime federal contract, or receive payment on one, without an active SAM registration. It is free: no third party is required, and no one should charge you to do it.',
      'Registration captures your UEI, CAGE code, NAICS codes, size and socioeconomic status, banking details, and reps and certs. It must be renewed every year, and letting it lapse can stall an award or a payment, so track the expiration date.',
    ],
    related: ['uei', 'cage-code', 'naics-code'],
    solutions: [{ label: 'Autofill federal registration data', href: '/solutions/form-autofiller/' }],
  },
  {
    slug: 'idiq',
    term: 'IDIQ contract',
    aka: ['Indefinite Delivery, Indefinite Quantity'],
    category: 'Contract vehicles',
    short:
      'A contract that sets terms and a ceiling up front, then buys the actual work later through individual task or delivery orders.',
    body: [
      'An IDIQ (Indefinite Delivery, Indefinite Quantity) contract does not commit the government to a fixed amount of work on day one. Instead it establishes pricing, terms, and a ceiling value, and the agency orders against it over time with task orders (for services) or delivery orders (for supplies).',
      'Winning a spot on an IDIQ, often one of several awardees, gets you onto the vehicle. The real competition then happens at the task-order level, where holders compete for the specific work.',
    ],
    related: ['gwac', 'bpa', 'sole-source'],
    solutions: [{ label: 'Draft task-order responses with AI', href: '/solutions/ai-proposal-generator/' }],
  },
  {
    slug: 'gwac',
    term: 'GWAC',
    aka: ['Governmentwide Acquisition Contract'],
    category: 'Contract vehicles',
    short:
      'A pre-competed IDIQ for IT products and services that any federal agency can order from.',
    body: [
      'A Governmentwide Acquisition Contract is an IDIQ vehicle for information technology that agencies across the government can use, rather than one tied to a single department. GSA runs several well-known GWACs, including Alliant and the small-business vehicle 8(a) STARS.',
      'Because the vehicle is already competed, agencies can order faster. For contractors, a GWAC seat is a multi-year channel to sell IT work governmentwide, with task-order competition limited to the holders.',
    ],
    related: ['idiq', 'bpa'],
  },
  {
    slug: 'bpa',
    term: 'BPA',
    aka: ['Blanket Purchase Agreement'],
    category: 'Contract vehicles',
    short:
      'A standing arrangement that streamlines repeat purchases of similar goods or services against agreed terms.',
    body: [
      'A Blanket Purchase Agreement is a simplified way for an agency to fill recurring needs without writing a new contract every time. Terms and often pricing are set in advance, and the agency places calls against the BPA as the need arises.',
      'BPAs are frequently established against GSA Schedule contracts. For a contractor, holding one means an agency can come back to you repeatedly with minimal paperwork.',
    ],
    related: ['idiq', 'gwac'],
  },
  {
    slug: 'set-aside',
    term: 'Set-aside',
    category: 'Set-asides',
    short:
      'A contract, or part of one, reserved so that only small businesses in a given category may compete for it.',
    body: [
      'When an opportunity is set aside, the contracting officer limits competition to a defined group of small businesses, keeping large firms out. Common categories include 8(a), women-owned (WOSB), service-disabled veteran-owned (SDVOSB), and HUBZone.',
      'Set-asides are how the government meets its small-business contracting goals. Your eligibility depends on your size standard for the opportunity\'s NAICS code and any socioeconomic certifications you hold.',
    ],
    related: ['8a', 'naics-code', 'sole-source'],
    solutions: [{ label: 'Draft a set-aside proposal', href: '/solutions/ai-proposal-generator/' }],
    insight: { label: '8(a) set-aside contract data', href: '/insights/set-aside/8a/' },
  },
  {
    slug: '8a',
    term: '8(a) program',
    aka: ['8(a) Business Development program'],
    category: 'Set-asides',
    short:
      'An SBA program that helps small businesses owned by socially and economically disadvantaged individuals win federal work.',
    body: [
      'The 8(a) Business Development program, run by the Small Business Administration, gives certified firms access to set-aside and sole-source contracts plus mentoring and other development support. Participation lasts up to nine years.',
      'To qualify, a business must be at least 51 percent owned and controlled by one or more individuals who are socially and economically disadvantaged, meet SBA size standards, and show potential for success. Agencies can award 8(a) contracts sole-source under certain dollar thresholds, which makes the certification valuable.',
    ],
    related: ['set-aside', 'sole-source'],
    insight: { label: '8(a) set-aside contract data', href: '/insights/set-aside/8a/' },
  },
  {
    slug: 'sources-sought',
    term: 'Sources sought notice',
    category: 'Solicitations',
    short:
      'A market-research notice where an agency asks whether capable businesses exist, before it decides how to compete the work.',
    body: [
      'A sources sought notice is not a solicitation. The agency is doing market research: it wants to learn which companies can do the work, and often whether enough small businesses exist to justify a set-aside. There is no proposal and no award at this stage.',
      'Responding still matters. A strong response can shape how the requirement is written and whether it gets set aside, and it puts your capabilities in front of the buyer early. Answer the specific questions asked and map your past work to the described need.',
    ],
    related: ['rfi', 'rfp', 'past-performance'],
    solutions: [{ label: 'Draft a capability response', href: '/solutions/ai-proposal-generator/' }],
  },
  {
    slug: 'lpta-vs-best-value',
    term: 'LPTA vs. best value',
    aka: ['Lowest Price Technically Acceptable', 'best-value tradeoff'],
    category: 'Evaluation',
    short:
      'Two ways the government picks a winner: cheapest acceptable bid (LPTA), or the best mix of price and merit (best value).',
    body: [
      'Under Lowest Price Technically Acceptable, the government scores each proposal pass or fail against stated requirements, then awards to the lowest-priced offer that passes. Extra quality earns you nothing, so the game is to be compliant and competitive on price.',
      'Under a best-value tradeoff, the government can pay more for a stronger proposal, weighing factors like technical approach and past performance against price. Read Section M to learn which method applies, because it changes how you should write and price the bid.',
    ],
    related: ['rfp', 'compliance-matrix', 'past-performance'],
    solutions: [{ label: 'Review your proposal against Section M', href: '/solutions/technical-writer-review/' }],
  },
  {
    slug: 'cpars',
    term: 'CPARS',
    aka: ['Contractor Performance Assessment Reporting System'],
    category: 'Evaluation',
    short:
      'The federal system where agencies grade your performance on completed contracts, which future evaluators can read.',
    body: [
      'The Contractor Performance Assessment Reporting System is where contracting officers record how well you performed on a contract, across areas like quality, schedule, and management. Ratings run from exceptional to unsatisfactory.',
      'These records feed past-performance evaluations on your next bids, so a CPARS rating is a durable asset or liability. You can comment on a rating you disagree with before it is finalized.',
    ],
    related: ['past-performance'],
  },
  {
    slug: 'past-performance',
    term: 'Past performance',
    category: 'Evaluation',
    short:
      'Your track record on similar prior work, which the government weighs as evidence you can deliver.',
    body: [
      'Past performance is the evaluator\'s way of predicting future results from proven ones. Proposals typically ask for recent, relevant contracts of similar size and scope, with references the government can check, often through CPARS.',
      'Relevance and recency matter more than volume. A few closely matched projects, described against the evaluation criteria, beat a long list of loosely related work.',
    ],
    related: ['cpars', 'sources-sought'],
    solutions: [{ label: 'Turn past work into proposal narrative', href: '/solutions/ai-proposal-generator/' }],
  },
  {
    slug: 'sole-source',
    term: 'Sole-source contract',
    category: 'Set-asides',
    short:
      'A contract awarded to one company without full competition, when the rules allow it.',
    body: [
      'A sole-source award goes to a single contractor without a full and open competition, which is permitted only in specific circumstances, such as when just one firm can meet the need or when a set-aside program authorizes it.',
      'The 8(a) program, for example, lets agencies award sole-source contracts under certain dollar thresholds. Sole-source is faster for the agency, but it must be justified and documented.',
    ],
    related: ['set-aside', '8a', 'idiq'],
  },
  {
    slug: 'rfi',
    foundational: true,
    term: 'RFI',
    aka: ['Request for Information'],
    category: 'Solicitations',
    short:
      'A request the government uses to gather information from industry, with no contract awarded.',
    body: [
      'A Request for Information is a market-research tool. The agency asks industry for details about capabilities, pricing ranges, or approaches to shape a future solicitation. Like a sources sought notice, it does not lead directly to an award.',
      'Responding is a chance to educate the buyer and influence the eventual requirement. Treat it as relationship-building and positioning, not as a proposal.',
    ],
    related: ['rfp', 'rfq', 'sources-sought'],
  },
  {
    slug: 'rfp',
    foundational: true,
    term: 'RFP',
    aka: ['Request for Proposal'],
    category: 'Solicitations',
    short:
      'The solicitation that asks for full proposals when the government will weigh factors beyond price.',
    body: [
      'A Request for Proposal is used when award will consider more than price alone. It lays out the requirement in Section C, tells you how to respond in Section L, and tells you how you will be scored in Section M. Your job is to answer all three consistently.',
      'RFPs support best-value tradeoffs, so a strong technical approach and past performance can win over a lower price. Building a compliance matrix from the RFP is the standard first step to make sure nothing is missed.',
    ],
    related: ['rfi', 'rfq', 'compliance-matrix', 'lpta-vs-best-value'],
    solutions: [
      { label: 'Shred an RFP into a compliance matrix', href: '/solutions/rfp-shredding/' },
      { label: 'Draft the proposal with AI', href: '/solutions/ai-proposal-generator/' },
    ],
  },
  {
    slug: 'rfq',
    foundational: true,
    term: 'RFQ',
    aka: ['Request for Quotation'],
    category: 'Solicitations',
    short:
      'A request for price quotes, used for simpler or lower-dollar buys, often against an existing vehicle.',
    body: [
      'A Request for Quotation asks vendors to quote a price for defined goods or services. It is common for simplified acquisitions and for orders placed against GSA Schedules or other vehicles, where terms are already set.',
      'An RFQ is generally lighter weight than an RFP: the requirement is better defined and the emphasis is on price and delivery rather than an elaborate technical proposal.',
    ],
    related: ['rfi', 'rfp'],
  },
  {
    slug: 'compliance-matrix',
    defersTo: {
      label: 'Compliance matrix generator',
      href: '/solutions/compliance-matrix-generator/',
    },
    term: 'Compliance matrix',
    aka: ['requirements traceability matrix', 'compliance crosswalk'],
    category: 'Proposal artifacts',
    short:
      'A table that maps every requirement in a solicitation to where your proposal answers it.',
    body: [
      'A compliance matrix lists each requirement from the solicitation, its source (a Section L instruction, a Section M factor, or a Section C requirement), and where you address it in your response. It is how you prove, to yourself and the evaluator, that nothing was missed.',
      'Building it early turns a dense RFP into a checklist that drives your outline and page budget. A missed "shall" is one of the fastest ways to be ruled non-responsive, and the matrix is the guard against that.',
    ],
    related: ['rfp', 'lpta-vs-best-value'],
    solutions: [
      { label: 'Generate a compliance matrix free', href: '/solutions/compliance-matrix-generator/' },
      { label: 'Shred an RFP automatically', href: '/solutions/rfp-shredding/' },
    ],
  },
];

export const getTerm = (slug: string) => glossary.find((t) => t.slug === slug);

/**
 * Pillar pages, each covering the terms that are genuinely used together.
 *
 * The glossary shipped as 18 one-term URLs averaging 125 words. None of them
 * ranked: positions 53 to 87, 1,280 impressions and zero clicks over 28 days
 * (GSC 2026-08). A 125-word page does not win "sole source procurement"
 * against acquisition.gov, and splitting one subject across four URLs means
 * none of them accumulates anything.
 *
 * Grouping follows the category each term already carried, so the structure is
 * the one the content was written to. Every old term URL 301s to its anchor
 * here (see public/_redirects); nothing is orphaned or dropped.
 *
 * compliance-matrix is deliberately absent. It was the only term in its
 * category and it lost to two of our own pages on every shared query, so it
 * redirects to the post that answers the same question instead of anchoring a
 * one-term pillar. See its defersTo field.
 */
export interface GlossaryPillar {
  slug: string;
  h1: string;
  metaTitle: string; // <=60 chars, see scripts/check-meta.mjs
  metaDescription: string; // <=160 chars
  /** Framing paragraphs: how these terms relate, which the term entries cannot say alone. */
  intro: string[];
  termSlugs: string[];
}

export const pillars: GlossaryPillar[] = [
  {
    slug: 'registration-and-ids',
    h1: 'Federal contractor registration and IDs',
    metaTitle: 'Federal contractor registration: SAM, UEI, CAGE, NAICS',
    metaDescription:
      'What SAM registration, your UEI, CAGE code, and NAICS codes each do, how they connect, and the order to get them in before you can win federal work.',
    intro: [
      'Before a federal agency can award you a contract or pay you for one, your business has to exist in the government\'s systems. That means one registration and three identifiers, and they are issued together rather than separately.',
      'The order matters. You register in SAM.gov, which assigns your UEI and triggers your CAGE code, and during that registration you choose the NAICS codes that describe your business. Those codes then decide which set-aside opportunities you are eligible for, which is why picking the right primary code is not a formality.',
    ],
    termSlugs: ['sam-registration', 'uei', 'cage-code', 'naics-code'],
  },
  {
    slug: 'contract-vehicles',
    h1: 'Federal contract vehicles: IDIQ, GWAC, and BPA',
    metaTitle: 'Federal contract vehicles: IDIQ, GWAC, and BPA',
    metaDescription:
      'How IDIQ, GWAC, and BPA vehicles work, what winning a seat actually gets you, and why the real competition happens at the task-order level.',
    intro: [
      'A contract vehicle is a pre-established arrangement an agency buys through, rather than running a full competition for every purchase. Getting onto one is a separate event from winning the work that flows through it.',
      'That distinction catches new contractors out. A seat on an IDIQ or GWAC is permission to compete, not revenue. The money is awarded later, in task orders competed among the holders, which is where your proposal capacity actually gets tested.',
    ],
    termSlugs: ['idiq', 'gwac', 'bpa'],
  },
  {
    slug: 'solicitation-types',
    h1: 'Federal solicitation types: sources sought, RFI, RFP, and RFQ',
    metaTitle: 'Solicitation types: sources sought, RFI, RFP, RFQ',
    metaDescription:
      'The difference between a sources sought notice, an RFI, an RFP, and an RFQ, what each one commits you to, and which ones are worth answering.',
    intro: [
      'Not every government notice is a request to bid. Agencies publish several kinds of document at different points in an acquisition, and answering the wrong one the wrong way wastes real time.',
      'Roughly, the sequence runs from market research to award: sources sought notices and RFIs help the agency shape what it is going to buy and who can supply it, while RFQs and RFPs are the actual solicitations you respond to with pricing and a proposal. The early ones carry no award, but they are where a requirement can still be influenced.',
    ],
    termSlugs: ['sources-sought', 'rfi', 'rfp', 'rfq'],
  },
  {
    slug: 'set-asides',
    h1: 'Set-asides, the 8(a) program, and sole source awards',
    metaTitle: 'Federal set-asides, the 8(a) program, and sole source',
    metaDescription:
      'How federal set-asides reserve contracts for small businesses, what the SBA 8(a) program adds, and when an agency can award sole source without competition.',
    intro: [
      'A large share of federal contract dollars is reserved, by statute, for small businesses and for specific socioeconomic categories within them. Set-asides are the mechanism, and they are the single biggest structural advantage a small contractor has.',
      'The categories stack with the certifications you hold and the NAICS code on the opportunity, which is what determines whether you count as small for that particular contract. In some cases, including inside the 8(a) program, an agency can skip competition altogether and award sole source.',
    ],
    termSlugs: ['set-aside', '8a', 'sole-source'],
  },
  {
    slug: 'evaluation-criteria',
    h1: 'How federal proposals are evaluated',
    metaTitle: 'Federal proposal evaluation: LPTA, CPARS, past performance',
    metaDescription:
      'How agencies score proposals: LPTA versus best value tradeoff, what past performance counts for, and how CPARS ratings follow you into the next bid.',
    intro: [
      'Two proposals can be equally compliant and still be scored completely differently, because the evaluation method is chosen before the solicitation goes out. Reading which one you are in is the first thing to do with a new RFP.',
      'The method decides where effort pays. Under LPTA, past the technical threshold, only price moves the outcome. Under best value tradeoff, the government can pay more for a stronger offer, which makes your record on prior work worth writing carefully about, and that record is not only what you claim: agencies read your CPARS ratings directly.',
    ],
    termSlugs: ['lpta-vs-best-value', 'past-performance', 'cpars'],
  },
];

export const pillarForTerm = (slug: string) => pillars.find((p) => p.termSlugs.includes(slug));

/**
 * Canonical on-site URL for a term. Terms in a pillar resolve to their anchor
 * there; a term deliberately kept out of the pillars resolves to whatever page
 * owns its topic instead.
 */
export const hrefForTerm = (slug: string): string => {
  const pillar = pillarForTerm(slug);
  if (pillar) return `/glossary/${pillar.slug}/#${slug}`;
  return getTerm(slug)?.defersTo?.href ?? '/glossary/';
};

// Alphabetical by display term, for the hub listing.
export const glossaryAlphabetical = () => [...glossary].sort((a, b) => a.term.localeCompare(b.term));

/**
 * Glossary terms a body of text actually mentions, so a post can link the
 * jargon it uses without anyone maintaining the list by hand.
 *
 * The glossary was written as a discovery path but nothing pointed at it:
 * 14 of the 18 term pages had zero inbound internal links and the other four
 * had one each, which is why they sit at positions 53-87 (GSC 2026-08, 1,280
 * impressions and no clicks). Posts are where the terms are already used, so
 * that is where the links belong.
 *
 * Matching is deliberately conservative. Multi-word terms and expansions match
 * case-insensitively; bare acronyms must match uppercase, so prose about "a
 * bpa machine" or a stray "sam" cannot pull in a definition. Fenced code,
 * inline code, existing link targets, and headings are stripped first so a
 * match never comes from markup rather than prose.
 */
export function termsMentionedIn(markdown: string, { exclude = [], limit = 6 } = {}): GlossaryTerm[] {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/\]\([^)]*\)/g, '] ') // link targets, keep the anchor text
    .replace(/^#{1,6}\s.*$/gm, ' ') // headings
    .replace(/^---[\s\S]*?^---/m, ' '); // frontmatter

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const matches = glossary.filter((t) => {
    if (t.foundational) return false;
    if (exclude.includes(t.slug)) return false;
    return [t.term, ...(t.aka ?? [])].some((name) => {
      const isAcronym = /^[A-Z0-9()]{2,6}$/.test(name);
      const re = new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`, isAcronym ? '' : 'i');
      return re.test(prose);
    });
  });

  // Densest mentions first, so the most relevant terms survive the cap.
  const density = (t: GlossaryTerm) =>
    [t.term, ...(t.aka ?? [])].reduce((n, name) => {
      const re = new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`, 'gi');
      return n + (prose.match(re)?.length ?? 0);
    }, 0);

  return matches.sort((a, b) => density(b) - density(a)).slice(0, limit);
}
