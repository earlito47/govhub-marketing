// Official federal forms mirrored under public/forms/.
//
// A federal form is a US government work, so redistributing it is free and
// safe. The risk is staleness, not copyright: an agency rejects a superseded
// revision. So every entry carries the revision, the OMB control number, and
// the expiration date, all rendered on the page next to the download, plus a
// link to the issuing agency as the authority. A visitor can see at a glance
// whether our copy is current, and check it in one click if not.
//
// When GSA publishes a new revision: replace the PDF under public/forms/ with
// a new dated filename, update `revision`, `pages` and `ombExpiration` here,
// and 301 the old filename to the new one in public/_redirects.

export interface FederalForm {
  /** Path under public/, served from the site root. */
  href: string;
  /** Form designation as agencies refer to it. */
  number: string;
  name: string;
  /** Revision as printed on the form itself, e.g. "7/2021". */
  revision: string;
  pages: number;
  /** Regulation that prescribes the form. */
  authority: string;
  ombControlNumber: string;
  ombExpiration: string;
  /** The issuing agency's page for this form. It, not us, is the authority. */
  officialSource: string;
}

export const SF330_FORM: FederalForm = {
  href: '/forms/sf330-rev-2021-07.pdf',
  number: 'SF330',
  name: 'Architect-Engineer Qualifications',
  revision: '7/2021',
  pages: 14,
  authority: 'FAR (48 CFR) 53.236-2(b)',
  ombControlNumber: '9000-0157',
  ombExpiration: '1/31/2027',
  officialSource: 'https://www.gsa.gov/forms-library/architect-engineer-qualifications',
};
