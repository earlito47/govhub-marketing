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
// GovHub is owned and operated by Linkshub Ltd. The name, jurisdiction,
// control number and address below are from the Georgia Secretary of State
// certificate of incorporation and articles (filed 2025-08-05), supplied by
// the owner on 2026-11-13. "Linkshub Ltd." is the registered spelling: use it
// exactly in anything legal. See legal/README.md for what is still open.

export const COMPANY = {
  /** Contracting entity, exactly as registered. Ends in a period. */
  legalName: 'Linkshub Ltd.',
  product: 'GovHub',
  jurisdiction: 'Georgia, USA (domestic profit corporation, incorporated 2025-08-05)',
  registrationNumber: 'Georgia Secretary of State control number 25162414',
  postalAddress: '3060 Mercer University Dr, Suite 110, Atlanta, GA 30341',
  legalEmail: 'support@govhub.online',
  privacyEmail: 'support@govhub.online',
  generalEmail: 'contact@govhub.online',
} as const;

/** One line used by the footer and email footers. */
export const OWNERSHIP_LINE = `GovHub is a product of ${COMPANY.legalName}`;

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
    metaTitle: 'Terms of Service | GovHub by Linkshub Ltd.',
    description:
      'The agreement between you and Linkshub Ltd. for GovHub: accounts, subscriptions, AI output, agent access, liability and how disputes are handled.',
    version: '2026-11-16',
    effective: 'November 16, 2026',
  },
  acceptableUse: {
    name: 'AI and Acceptable Use Policy',
    path: '/acceptable-use/',
    metaTitle: 'AI and Acceptable Use Policy | GovHub',
    description:
      'How to use GovHub output responsibly, what the service may not be used for, and the rules for AI agents and other automated access.',
    version: '2026-11-16',
    effective: 'November 16, 2026',
  },
  privacy: {
    name: 'Privacy Notice',
    path: '/privacy/',
    metaTitle: 'Privacy Notice | GovHub by Linkshub Ltd.',
    description:
      'How Linkshub Ltd. collects, uses, shares and protects personal data across the GovHub website, the GovHub app, support and our outreach.',
    version: '2026-11-16',
    effective: 'November 16, 2026',
  },
  cookies: {
    name: 'Cookie Notice',
    path: '/cookies/',
    metaTitle: 'Cookie Notice and Analytics Settings | GovHub',
    description:
      'The cookies and tracking GovHub uses on www.govhub.online and app.govhub.online, what each one does, and how to turn analytics off.',
    version: '2026-11-16',
    effective: 'November 16, 2026',
  },
  subprocessors: {
    name: 'Subprocessors',
    path: '/subprocessors/',
    metaTitle: 'Subprocessors and Service Providers | GovHub',
    description:
      'The service providers that process data for GovHub, what each one does, the data involved and where it is processed.',
    version: '2026-11-16',
    effective: 'November 16, 2026',
  },
  company: {
    name: 'Company and Domains',
    path: '/legal/',
    metaTitle: 'Company Information and Official Domains | GovHub',
    description:
      'Who owns and operates GovHub, how to reach us, the official GovHub domains, and the domains we send email from.',
    version: '2026-11-16',
    effective: 'November 16, 2026',
  },
} as const satisfies Record<string, LegalDoc>;

export type LegalDocKey = keyof typeof LEGAL_DOCS;
