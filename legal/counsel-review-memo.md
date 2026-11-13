# Counsel review memo (draft)

Prepared 2026-11-13 for review by a SaaS and privacy lawyer. This memo collects the legal questions and citations so the customer-facing documents can stay plain. It is a list of issues to decide, not a legal opinion. Every statute and threshold below should be checked against the current primary source before anything is published.

## 1. The question that decides most of the others: where is LinksHub LTD?

"LTD" alone does not settle it. The evidence in the repositories points to the United States: the app's retired 2025 Terms name "Linkshub Ltd." at 3060 Mercer University Dr, Suite 110, Atlanta, GA 30341, choose Georgia law, and print an EIN, and every outreach signature carries the same address. Georgia permits "Ltd." as a corporate designator. None of this is confirmation. The answer changes several documents at once:

| If LinksHub LTD is... | What changes |
|---|---|
| A Georgia (or other US) entity, with no UK or EU establishment (most likely on the evidence) | The drafts' Georgia governing law and Fulton County venue fit. UK and EU GDPR apply only to the extent GovHub targets or monitors people there (Art. 3(2)); no UK or EU recipients were found in the outreach data. US federal and state law govern the rest. |
| Registered in England and Wales (or elsewhere in the UK) | UK GDPR and the Data Protection Act 2018 apply to **all** of LinksHub's processing carried out in the context of that UK establishment, including data about US prospects and US customers (UK GDPR Art. 3(1)). The company must state its registered name, number, place of registration and registered office on its websites and in business emails (Companies Act 2006 and the Company, Limited Liability Partnership and Business (Names and Trading Disclosures) Regulations 2015). An ICO data protection fee is likely due unless an exemption applies. Liability exclusions in standard business terms are tested for reasonableness under the Unfair Contract Terms Act 1977, and liability for death or personal injury from negligence cannot be excluded at all. PECR applies to electronic marketing to UK recipients. |
| Registered outside the UK and EU, with no establishment there | UK and EU GDPR apply only to the extent GovHub offers services to, or monitors the behaviour of, people in the UK or EU (Art. 3(2)). Representative obligations under Art. 27 may arise if that targeting happens. |
| Registered in the EU | EU GDPR applies to all processing in the context of the establishment, and the ePrivacy rules of that member state govern cookies and email marketing. |

**Decision needed:** registration details, registered office, and where the people running GovHub are based. Then confirm governing law and venue for the Terms (section 20), drafted as Georgia and Fulton County from the retired Terms. The pack did not pick arbitration and this draft does not either.

## 2. Liability allocation (Terms sections 16 to 18)

- **Cap.** Drafted as the greater of fees paid in the prior 12 months and US$100, covering free and trial users. Needs a commercial decision and a check that it is enforceable under the chosen law. Under English law the cap must pass the UCTA reasonableness test; a cap tied to fees paid is commonly upheld between businesses but is not guaranteed. Under US state law, check rules that void exculpatory clauses for gross negligence or wilful misconduct (for example California Civil Code section 1668) and decide whether to carve those out expressly.
- **Mutual exclusion of indirect losses.** Drafted mutually, with the customer's payment obligations, indemnity and breach of the prohibited-use list carved out. Confirm that the carve-outs are commercially acceptable for larger customers.
- **Loss of contract or award.** Section 17.2 names loss of "any contract, award, task order or other opportunity" as excluded. This is the main exposure for a proposal tool. Confirm it is clear enough under the chosen law.
- **Customer indemnity.** Limited to third-party claims from unlawful or infringing Customer Content, use in breach, and false or unlawful statements in submissions. No provider IP indemnity is offered. Enterprise customers will ask for one; decide the position.
- **Privacy liability.** Data protection laws give individuals rights against controllers and processors that a contract between LinksHub and its customer cannot remove (for example GDPR Art. 82). Decide how the Terms cap interacts with the DPA and whether data protection breaches sit inside, above or outside the cap.
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
- **GDPR / UK GDPR roles.** LinksHub is controller for accounts, billing, website analytics, support and outreach. It is processor for personal data inside Customer Content (resumes, key personnel, references) processed on the customer's instructions. The DPA (legal/dpa.md) covers the processor role only.
- **Cold outreach.** Under GDPR or UK GDPR (if they apply), outreach to named business contacts needs a lawful basis (legitimate interests with a documented assessment) and an Art. 14 notice to people whose data was collected from other sources, no later than the first communication. PECR allows unsolicited marketing email to corporate subscribers in the UK but not to sole traders and some partnerships without consent (ICO B2B marketing guidance). US outreach is governed by CAN-SPAM: accurate headers and subject lines, identification as an advertisement, a valid postal address, a working opt-out honoured within 10 business days and usable for at least 30 days after sending (FTC CAN-SPAM Act: A Compliance Guide for Business).
- **Outreach as found.** Angle and B-line campaigns sent roughly 14,000 emails with no opt-out notice, no campaign carried an advertisement label, about 4,500 went out with no postal address, and opt-out replies were not suppressed across campaigns (fact table E2 to E5). The branch fixes the copy and suppression going forward. Counsel should advise on exposure for what was already sent.
- **AI providers.** Confirm, for each provider in the subprocessor list, the data retention period for API inputs and outputs, whether abuse monitoring retains content, the processing region, and whether a DPA and transfer mechanism are in place. The Terms promise that providers do not train on Customer Content; that must match the provider contracts.

## 6. Public claims that need substantiation or correction

The fact table lists each claim with evidence. In short, any claim on /security/ or /compliance/ that is not supported by the code or a third-party report should be removed or reworded before the new Terms go live, because the Terms' disclaimers do not cure an inaccurate claim. Pay particular attention to SAML single sign-on, audit logging, "built to align with SOC 2," and "architected for FedRAMP-ready deployment." Do not describe GovHub as SOC 2 compliant, FedRAMP authorized, CMMC certified or GDPR certified without the report or authorization to back it.

## 7. AI-specific rules to keep an eye on

- **EU AI Act Art. 50** (transparency for certain AI systems, applicable from 2 August 2026) matters only if GovHub is placed on the EU market. It can require that people know they are dealing with an AI system and that synthetic content is marked. Confirm whether GovHub has EU customers.
- **US federal procurement.** Some solicitations now restrict AI use or require disclosure. The AUP puts compliance with solicitation rules on the customer.
- **FTC enforcement on AI claims.** Claims about what the AI does (for example "keeps proposals compliant") must be substantiated. The compliance page already says final decisions stay with the user; keep sales copy consistent with the human-review requirement.

## 8. Items for the lawyer to sign off

1. Entity details and the trading-disclosure requirements that follow from them.
2. Governing law, venue, and any dispute-resolution step.
3. The liability cap, its exceptions, and the treatment of free and trial users.
4. Whether to offer a provider IP indemnity, and an enterprise addendum.
5. The DPA, including the transfer mechanism (EU SCCs 2021/914 Module 2 and 3 as relevant, UK International Data Transfer Addendum), without rewriting mandatory clause text.
6. The Privacy Notice's lawful bases, the outreach legitimate interests assessment, and whether California disclosures are given.
7. Clickwrap wording at signup and the reacceptance flow for material changes.
8. The corrected security and compliance page copy.

## Sources consulted

The research pack of 2026-11-12 lists the general sources (Thomson Reuters prompting examples, Common Paper Cloud Service Agreement and DPA, Bonterms AI Addendum, Termly, CPPA FAQs, FTC disclosure guidance, GDPR, FTC CAN-SPAM guide, ICO B2B marketing guidance). No text was copied from Common Paper or Bonterms; the drafts are original. If counsel adapts Common Paper language, keep its CC BY 4.0 attribution.
