// Company identity and the legal document set, single-sourced.
//
// Every legal page, the footer, the About page and the Organization schema
// read from here, so the facts that still need confirming are filled in once.
//
// PUBLICATION GATE. Anything still marked [CONFIRM: ...] renders into the
// built page, and `npm run guard` (part of `npm run verify`, which runs on
// every pull request into main) fails while any [CONFIRM appears in dist/.
// That is deliberate: these pages must not ship with unresolved facts. Fill
// in the value, or delete the clause, and the guard clears.
//
// The owner states that GovHub is owned and operated by LinksHub LTD. The
// rest of the entity details are not in this repo and have not been verified.
// See legal/README.md for the full blocker list.

export const COMPANY = {
  /** Contracting entity. Owner-confirmed 2026-11-12. */
  legalName: 'LinksHub LTD',
  product: 'GovHub',
  jurisdiction: '[CONFIRM: country or state of incorporation]',
  registrationNumber: '[CONFIRM: company registration number, or remove]',
  postalAddress: '[CONFIRM: business postal address]',
  legalEmail: '[CONFIRM: monitored legal notices address]',
  privacyEmail: '[CONFIRM: monitored privacy address]',
} as const;

/** One line used by the footer and email footers. */
export const OWNERSHIP_LINE = `GovHub is a product of ${COMPANY.legalName}.`;

export interface LegalDoc {
  /** H1 on the page. */
  name: string;
  path: string;
  /** <title>, kept to the SERP budget check:meta enforces. */
  metaTitle: string;
  /** Meta description, 120 to 160 characters. */
  description: string;
  /**
   * Version recorded when someone accepts the document in the app. Bump it
   * (and LEGAL_VERSIONS in strata-parse/src/lib/legal.ts) on every material
   * change, so the acceptance record says which text was agreed to.
   */
  version: string;
  /** Shown as the effective date. */
  effective: string;
}

export const LEGAL_DOCS = {
  terms: {
    name: 'Terms of Service',
    path: '/terms/',
    metaTitle: 'Terms of Service | GovHub by LinksHub LTD',
    description:
      'The agreement between you and LinksHub LTD for GovHub: accounts, subscriptions, AI output, agent access, liability and how disputes are handled.',
    version: '2026-11-13',
    effective: '[CONFIRM: effective date]',
  },
  acceptableUse: {
    name: 'AI and Acceptable Use Policy',
    path: '/acceptable-use/',
    metaTitle: 'AI and Acceptable Use Policy | GovHub',
    description:
      'How to use GovHub output responsibly, what the service may not be used for, and the rules for AI agents and other automated access.',
    version: '2026-11-13',
    effective: '[CONFIRM: effective date]',
  },
  privacy: {
    name: 'Privacy Notice',
    path: '/privacy/',
    metaTitle: 'Privacy Notice | GovHub by LinksHub LTD',
    description:
      'How LinksHub LTD collects, uses, shares and protects personal data across the GovHub website, the GovHub app, support and our outreach.',
    version: '2026-11-13',
    effective: '[CONFIRM: effective date]',
  },
  cookies: {
    name: 'Cookie Notice',
    path: '/cookies/',
    metaTitle: 'Cookie Notice and Analytics Settings | GovHub',
    description:
      'The cookies and tracking GovHub uses on www.govhub.online and app.govhub.online, what each one does, and how to turn analytics off.',
    version: '2026-11-13',
    effective: '[CONFIRM: effective date]',
  },
  subprocessors: {
    name: 'Subprocessors',
    path: '/subprocessors/',
    metaTitle: 'Subprocessors and Service Providers | GovHub',
    description:
      'The service providers that process data for GovHub, what each one does, the data involved and where it is processed.',
    version: '2026-11-13',
    effective: '[CONFIRM: effective date]',
  },
  company: {
    name: 'Company and Domains',
    path: '/legal/',
    metaTitle: 'Company Information and Official Domains | GovHub',
    description:
      'Who owns and operates GovHub, how to reach us, the official GovHub domains, and the domains we send email from.',
    version: '2026-11-13',
    effective: '[CONFIRM: effective date]',
  },
} as const satisfies Record<string, LegalDoc>;

export type LegalDocKey = keyof typeof LEGAL_DOCS;
