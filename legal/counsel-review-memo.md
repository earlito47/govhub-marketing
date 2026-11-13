# Counsel review memo (draft)

Prepared 2026-11-13 for review by a SaaS and privacy lawyer. This memo collects the legal questions and citations so the customer-facing documents can stay plain. It is a list of issues to decide, not a legal opinion. Every statute and threshold below should be checked against the current primary source before anything is published.

## 1. The contracting entity (confirmed)

From the Georgia Secretary of State certificate of incorporation and articles, and the IRS EIN notice, supplied by the owner on 2026-11-13:

| | |
|---|---|
| Registered name | **Linkshub Ltd.** (the drafts now use this spelling everywhere; earlier drafts said "LinksHub LTD") |
| Type | Georgia domestic profit corporation, incorporated 2025-08-05 |
| Control number | 25162414 |
| Principal office | 3060 Mercer University Dr, Ste 110, Atlanta, GA 30341 |
| Registered agent | The incorporator, at the principal office; county on file: Fulton |
| Federal tax | EIN issued 2025-08-20; Form 1120 filer (C corporation). The EIN is not published in the drafts. |

What follows from this:

- **Governing law.** Georgia law, as drafted, fits a Georgia corporation operating from Georgia. Confirm the choice.
- **Venue.** DeKalb County, Georgia (owner, 2026-11-13). The articles list the registered agent's county as Fulton; the registered office address (30341) is in DeKalb. Consider correcting the county on the Secretary of State record so the two match (corporate venue in Georgia follows the registered office, O.C.G.A. section 14-2-510). The pack did not pick arbitration and this draft does not either.
- **UK and EU law.** With no UK or EU establishment, UK and EU GDPR apply only to the extent GovHub offers services to, or monitors, people there (Art. 3(2)), and an Art. 27 representative may then be needed. No UK or EU recipients were found in the outreach data.
- **"Use at your own risk" under Georgia law.** Check how Georgia courts treat exculpatory clauses and liability caps in standard-form business contracts (they are generally enforced between businesses if explicit, prominent, clear and unambiguous) and whether the cap needs an express carve-out for gross negligence or wilful misconduct.
- **Name use.** Contracts, email footers and notices should use "Linkshub Ltd." exactly. "GovHub" is a trade name of the corporation; check whether a trade name registration with the county is required or advisable.

## 2. Liability allocation (Terms sections 16 to 18)

- **Cap.** Drafted as the greater of fees paid in the prior 12 months and US$100, covering free and trial users. Needs a commercial decision and a check that it is enforceable under the chosen law. Under US state law, including Georgia's, check rules that void exculpatory clauses for gross negligence or wilful misconduct (for example California Civil Code section 1668) and decide whether to carve those out expressly.
- **Mutual exclusion of indirect losses.** Drafted mutually, with the customer's payment obligations, indemnity and breach of the prohibited-use list carved out. Confirm that the carve-outs are commercially acceptable for larger customers.
- **Loss of contract or award.** Section 17.2 names loss of "any contract, award, task order or other opportunity" as excluded. This is the main exposure for a proposal tool. Confirm it is clear enough under the chosen law.
- **Customer indemnity.** Limited to third-party claims from unlawful or infringing Customer Content, use in breach, and false or unlawful statements in submissions. No provider IP indemnity is offered. Enterprise customers will ask for one; decide the position.
- **Privacy liability.** Data protection laws give individuals rights against controllers and processors that a contract between Linkshub and its customer cannot remove (for example GDPR Art. 82). Decide how the Terms cap interacts with the DPA and whether data protection breaches sit inside, above or outside the cap.
- **Marketing claims vs. disclaimers.** Fine print does not cure a misleading headline claim (FTC, ".com Disclosures" and Policy Statement on Deception). See section 6 below: several public claims about security features are not supported by the code, and the disclaimers do not fix that.

## 3. Formation and changes

- The current live Terms rely on "by using the Services, you agree." The app signup screen, as audited, had no notice, checkbox or record of acceptance (fact table A1), and accounts created for outreach leads never showed a form. The implementation branch adds an affirmative acceptance step with a stored version and timestamp. Confirm that the wording and placement satisfy clickwrap enforceability standards in the chosen jurisdiction (clear notice, conspicuous link, unambiguous assent).
- Section 19 gives 30 days' notice of material changes and lets prepaid customers leave with a pro-rated refund. The previous "continued use is acceptance" clause has been removed.
- Automatic renewal is disclosed in bold. Several US state automatic renewal laws are framed around consumers; the Terms state GovHub is for businesses only. Confirm that sign-up actually prevents consumer purchases, or keep consumer-grade disclosures and cancellation in place anyway (the FTC Act and ROSCA still apply to negative option features online).

## 4. Customer-directed agents (Acceptable Use Policy section 3)

- Drafted as a contractual access rule: only for identified paid subscribers or paid organizational seats, within plan limits; no trial or anonymous agent access; assistive technology and the customer's own security tools always allowed; public marketing pages governed by robots.txt.
- The draft deliberately does not say breach is a crime. Whether automated access in breach of contract terms is unauthorized access under computer misuse laws (CFAA in the US after *Van Buren v. United States*, 593 U.S. 374 (2021); Computer Misuse Act 1990 in the UK) depends on technical barriers, not contract wording alone. Enforcement should rest on contract and on server-side access controls.
- The marketing pricing page lists "API access" on the Team plan. If no customer API exists, that is a claim to fix (see fact table), and AUP section 3 should not refer to a documented integration method.
- Restrictions on scraping or reusing content are limited to the Services and content GovHub creates. They do not claim rights in public government records (no copyright in US federal government works, 17 U.S.C. section 105).

## 5. Privacy scope

- **CCPA as amended by CPRA.** Applies to for-profit businesses doing business in California that meet a threshold: annual gross revenue above the inflation-adjusted figure (verify the current CPPA figure), buying, selling or sharing personal information of 100,000 or more consumers or households, or deriving 50% or more of revenue from selling or sharing. The B2B and employee exemptions expired on 1 January 2023, so business contact data counts. If GovHub is below the thresholds, it is not a "business," but it may still have service provider or contractor obligations through customer contracts. Decide whether to give California-specific disclosures voluntarily.
- **"Sale" and "sharing."** The marketing site loads the Meta Pixel and Google Analytics. Under the CCPA, disclosing personal information to an ad platform for cross-context behavioural advertising is "sharing" whether or not money changes hands. The draft Privacy Notice does not say "we do not sell or share"; it describes the pixel and the opt-out, and honours Global Privacy Control. Confirm the position once thresholds are known.
- **Other US state laws.** Most comprehensive state privacy laws (Virginia, Colorado, Connecticut, Texas and others) exclude people acting in a commercial or employment context, so B2B contact data is often out of scope. Thresholds and exemptions vary; confirm against current text.
- **GDPR / UK GDPR roles.** Linkshub is controller for accounts, billing, website analytics, support and outreach. It is processor for personal data inside Customer Content (resumes, key personnel, references) processed on the customer's instructions. The DPA (legal/dpa.md) covers the processor role only.
- **Cold outreach.** Under GDPR or UK GDPR (if they apply), outreach to named business contacts needs a lawful basis (legitimate interests with a documented assessment) and an Art. 14 notice to people whose data was collected from other sources, no later than the first communication. PECR allows unsolicited marketing email to corporate subscribers in the UK but not to sole traders and some partnerships without consent (ICO B2B marketing guidance). US outreach is governed by CAN-SPAM: accurate headers and subject lines, identification as an advertisement, a valid postal address, a working opt-out honoured within 10 business days and usable for at least 30 days after sending (FTC CAN-SPAM Act: A Compliance Guide for Business).
- **Outreach as found.** Angle and B-line campaigns sent roughly 14,000 emails with no opt-out notice, no campaign carried an advertisement label, about 4,500 went out with no postal address, and opt-out replies were not suppressed across campaigns (fact table E2 to E5). The branch fixes the copy and suppression going forward. Counsel should advise on exposure for what was already sent.
- **AI providers.** Confirm, for each provider in the subprocessor list, the data retention period for API inputs and outputs, whether abuse monitoring retains content, the processing region, and whether a DPA and transfer mechanism are in place. The Terms promise that providers do not train on Customer Content; that must match the provider contracts.

## 6. Public claims that need substantiation or correction

The fact table lists each claim with evidence. On the branch, SAML single sign-on, the "full audit trail" and role-based access claims are corrected, and all SOC 2 and FedRAMP wording is removed from the site at the owner's direction (security page, enterprise page, blog buying guides). Disclaimers in the Terms do not cure an inaccurate marketing claim, so keep sales copy to what the product does.

## 7. AI-specific rules to keep an eye on

- **EU AI Act Art. 50** (transparency for certain AI systems, applicable from 2 August 2026) matters only if GovHub is placed on the EU market. It can require that people know they are dealing with an AI system and that synthetic content is marked. Confirm whether GovHub has EU customers.
- **US federal procurement.** Some solicitations now restrict AI use or require disclosure. The AUP puts compliance with solicitation rules on the customer.
- **FTC enforcement on AI claims.** Claims about what the AI does (for example "keeps proposals compliant") must be substantiated. The compliance page already says final decisions stay with the user; keep sales copy consistent with the human-review requirement.

## 8. Items for the lawyer to sign off

1. Governing law, venue county, and any dispute-resolution step.
3. The liability cap, its exceptions, and the treatment of free and trial users.
4. Whether to offer a provider IP indemnity, and an enterprise addendum.
5. The DPA, including the transfer mechanism (EU SCCs 2021/914 Module 2 and 3 as relevant, UK International Data Transfer Addendum), without rewriting mandatory clause text.
6. The Privacy Notice's lawful bases, the outreach legitimate interests assessment, and whether California disclosures are given.
7. Clickwrap wording at signup and the reacceptance flow for material changes.
8. The corrected security and compliance page copy.

## Sources consulted

The research pack of 2026-11-12 lists the general sources (Thomson Reuters prompting examples, Common Paper Cloud Service Agreement and DPA, Bonterms AI Addendum, Termly, CPPA FAQs, FTC disclosure guidance, GDPR, FTC CAN-SPAM guide, ICO B2B marketing guidance). No text was copied from Common Paper or Bonterms; the drafts are original. If counsel adapts Common Paper language, keep its CC BY 4.0 attribution.
