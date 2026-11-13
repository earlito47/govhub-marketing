// The disclosure line every GovHub cold email carries, single-sourced.
//
// CAN-SPAM (15 U.S.C. 7704(a)(5)(A)) requires every commercial email to carry
// (i) clear identification that it is an advertisement or solicitation,
// (ii) a clear notice of how to opt out, and (iii) a valid postal address.
// The postal address is in {{accountSignature}} (set-signatures.mjs). This
// line carries (i) and (ii), and names the company behind GovHub.
//
// HISTORY. The angle campaigns (A1/A2/A4/A5) and the B-line (B2/B4) dropped
// their opt-out line on 2026-09-29, and the signature's "This is a sales
// email." was removed on 2026-09-03, both at the owner's instruction. The
// 2026-11-12 legal drafting pack asks for the opposite: advertising
// identification, a simple opt-out and the LinksHub LTD name in every
// commercial email. This module restores both on the legal-drafting branch.
// Nothing changes in Instantly until someone runs each script's --sync.
//
// The reply wording stays 'reply "no"' because that is what the influencer and
// wave 1 campaigns already say, and the reply desk's classifier treats a bare
// "No" as an opt-out and blocklists the address (reply-desk/suppress.mjs).
//
// [CONFIRM: "LinksHub LTD" is the owner's spelling. The app's retired legal
// pages say "Linkshub Ltd." Use the registered spelling.]

export const COMPANY_LINE = 'GovHub is a product of LinksHub LTD.';
export const OPT_OUT_LINE = 'This is a marketing email. Reply "no" and I will not email you again.';
export const DISCLOSURE = `${COMPANY_LINE} ${OPT_OUT_LINE}`;

/** True when a rendered body carries the disclosure exactly once. */
export function hasDisclosure(raw) {
  return raw.split(OPT_OUT_LINE).length === 2 && raw.includes(COMPANY_LINE);
}
