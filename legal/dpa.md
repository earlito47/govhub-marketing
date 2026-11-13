# Data Processing Addendum (draft for counsel)

**Status:** draft, not offered to customers yet. It covers Linkshub's role as processor (service provider) for personal data inside Customer Content. Linkshub's own controller activities (accounts, billing, analytics, outreach) are covered by the Privacy Notice instead. Text in [CONFIRM: ...] is unresolved. Do not rewrite the Standard Contractual Clauses or the UK Addendum; they are incorporated by reference, with their module and option choices made in Annex IV.

---

This Data Processing Addendum ("DPA") forms part of the GovHub Terms of Service or other agreement (the "Agreement") between Linkshub Ltd. ("Linkshub") and the customer named in it ("Customer"). It applies when Linkshub processes Customer Personal Data. Terms not defined here have the meanings in the Agreement or, where they apply, in Data Protection Laws.

## 1. Definitions

- **Data Protection Laws:** all laws on privacy and personal data that apply to the processing under the Agreement, which may include the EU GDPR, the UK GDPR and Data Protection Act 2018, the Swiss FADP, and the California Consumer Privacy Act as amended ("CCPA").
- **Customer Personal Data:** personal data in Customer Content that Linkshub processes for Customer under the Agreement.
- **Subprocessor:** a third party Linkshub engages to process Customer Personal Data.
- **Security Incident:** a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Customer Personal Data.

## 2. Roles and scope

2.1 Customer is the controller (or a processor acting for its own controller) and Linkshub is the processor (or subprocessor) of Customer Personal Data. Under the CCPA, Linkshub is Customer's service provider.

2.2 Annex I describes the processing.

## 3. Customer's instructions

3.1 Linkshub will process Customer Personal Data only on Customer's documented instructions, including with regard to transfers, unless the law requires otherwise, in which case Linkshub will inform Customer before processing unless the law forbids it. The Agreement, Customer's use and configuration of the Services, and this DPA are Customer's complete instructions.

3.2 Linkshub will tell Customer if, in its opinion, an instruction infringes Data Protection Laws.

3.3 Customer is responsible for the lawfulness of the personal data it provides and of its instructions, including having any notices and consents needed for Linkshub to process the data, for example the resumes and key personnel details of Customer's employees and teaming partners.

## 4. Confidentiality

Linkshub will ensure that people it authorizes to process Customer Personal Data are bound by confidentiality obligations.

## 5. Security

Linkshub will implement the technical and organizational measures in Annex II. Linkshub may update them, provided the overall level of protection is not reduced.

## 6. Subprocessors

6.1 Customer gives general authorization for Linkshub to engage Subprocessors. The current list is published at www.govhub.online/subprocessors/.

6.2 Linkshub will impose data protection obligations on each Subprocessor that are no less protective than this DPA, and remains responsible for its Subprocessors' performance.

6.3 Linkshub will give notice of a new Subprocessor at least [CONFIRM: notice period] before it begins processing Customer Personal Data. Customer may object on reasonable data protection grounds within that period. If the parties cannot resolve the objection, Customer may terminate the affected Services and receive a refund of prepaid fees for the unused period.

## 7. Assistance with rights requests

Linkshub will, taking into account the nature of the processing, assist Customer by appropriate technical and organizational measures to respond to requests from individuals exercising their rights. If Linkshub receives such a request directly, it will refer the individual to Customer and will not respond itself except to confirm the referral.

## 8. Security Incidents

8.1 Linkshub will notify Customer without undue delay, and in any event within [CONFIRM: number of hours], after becoming aware of a Security Incident.

8.2 The notice will describe, as far as then known, the nature of the incident, the categories and approximate number of individuals and records concerned, the likely consequences, and the measures taken or proposed. Linkshub will provide further information as it becomes available and will take reasonable steps to contain and remediate the incident.

8.3 Notifying a Security Incident is not an admission of fault.

## 9. Impact assessments

Linkshub will provide reasonable information Customer needs to carry out data protection impact assessments and prior consultations required by Data Protection Laws, to the extent Customer cannot obtain it from the Services or Linkshub's documentation.

## 10. Return and deletion

10.1 Customer can delete Customer Content in the Services at any time.

10.2 Within [CONFIRM: number] days after the Agreement ends, Linkshub will delete Customer Personal Data, unless the law requires Linkshub to keep it. Copies in backups are deleted on Linkshub's backup cycle and remain protected under this DPA until then. [CONFIRM: implement the account purge job first. As of 2026-11-13 deleted accounts are only deactivated, and files sent to Anthropic's Files API are not deleted.]

## 11. Audits

11.1 Linkshub will make available information reasonably necessary to demonstrate compliance with this DPA, in the form of written responses to a reasonable security questionnaire once a year and the documentation described in Annex II.

11.2 Where Data Protection Laws require more, Customer may conduct an audit, at its own cost, with at least 30 days' notice, during business hours, no more than once a year, under confidentiality obligations, and in a way that does not compromise other customers' data.

## 12. International transfers

12.1 Linkshub processes Customer Personal Data in the United States [CONFIRM: regions], and its Subprocessors may process it in the locations listed on the subprocessors page.

12.2 Where Customer Personal Data is transferred from the EEA, the UK or Switzerland to a country without an adequacy decision, the transfer mechanism in Annex IV applies.

## 13. California

Where Linkshub is Customer's service provider under the CCPA, Linkshub will not: sell or share Customer Personal Data; retain, use or disclose it for any purpose other than the business purposes in the Agreement, or outside the direct business relationship with Customer; or combine it with personal information it receives from others, except as the CCPA permits. Linkshub will comply with the CCPA's obligations for service providers, provide the same level of privacy protection the CCPA requires, notify Customer if it can no longer meet them, and allow Customer to take reasonable steps to stop and remediate unauthorized use.

## 14. Liability and precedence

14.1 Each party's liability under this DPA is subject to the limitations in the Agreement [CONFIRM with counsel: whether data protection breaches sit inside, above or outside the cap].

14.2 If this DPA conflicts with the Agreement on the processing of Customer Personal Data, this DPA controls. If it conflicts with the Standard Contractual Clauses or the UK Addendum, those control.

---

## Annex I: Description of processing

| | |
|---|---|
| Data exporter | Customer |
| Data importer | Linkshub Ltd., 3060 Mercer University Dr, Suite 110, Atlanta, GA 30341 [CONFIRM] |
| Categories of individuals | Customer's employees, contractors, key personnel, teaming partners, references and other people named in documents Customer uploads |
| Categories of personal data | Names, contact details, job titles, employment and education history (resumes), qualifications, past performance references, signatures (if Customer chooses), and any other personal data in Customer Content |
| Sensitive data | None intended. Customer should not upload special category data or government identification numbers. |
| Nature and purpose | Hosting, storage, AI analysis and drafting, document rendering and support, to provide the Services |
| Frequency | Continuous, for the term of the Agreement |
| Duration and retention | The term of the Agreement plus the deletion period in section 10 |
| Transfers to Subprocessors | As listed on the subprocessors page, for the purposes listed there |

## Annex II: Technical and organizational measures

Only measures confirmed in code as of 2026-11-13 are listed as facts. The others need confirming before this annex is given to a customer.

| Area | Measure | Status |
|---|---|---|
| Encryption in transit | TLS on all connections to the website, app and APIs | Confirmed |
| Encryption at rest | Database and file storage encrypted at rest by the hosting provider (Supabase) | [CONFIRM with provider documentation] |
| Access separation | Postgres row-level security restricting each account to its own rows | Confirmed for tables in migrations; [CONFIRM: v2 core tables] |
| Staff access | Administrative access limited to an allowlist of named staff; administrative actions written to an append-only audit log | Confirmed |
| Staff authentication | [CONFIRM: MFA on Supabase, Cloudflare, GitHub, Stripe and AI provider accounts] | Unverified |
| User authentication | Email verification by one-time code; hashed passwords | Confirmed |
| Backups | [CONFIRM: backup frequency, retention and restore testing] | Unverified |
| Logging and monitoring | [CONFIRM] | Unverified |
| Vulnerability management | [CONFIRM: dependency updates, testing] | Unverified |
| Incident response | Documented procedure (legal/internal-procedures.md section 3) | Draft |
| Subprocessor management | Register and contract review (internal-procedures section 4) | Draft |

## Annex III: Subprocessors

See www.govhub.online/subprocessors/.

## Annex IV: Transfer mechanism

[CONFIRM with counsel.] Proposed:

- **EEA:** the Standard Contractual Clauses adopted by Commission Implementing Decision (EU) 2021/914, Module 2 (controller to processor) where Customer is a controller, and Module 3 (processor to processor) where Customer is a processor. Clause 7 (docking) applies; Clause 9 option 2 (general authorization) with the notice period in section 6.3; Clause 11 optional language does not apply; Clause 17 option 1 with the law of [CONFIRM: an EU member state]; Clause 18 courts of the same member state.
- **UK:** the International Data Transfer Addendum to the EU Standard Contractual Clauses issued by the ICO, with the tables completed from this DPA.
- **Switzerland:** the EU Standard Contractual Clauses as adapted for the Swiss FADP.
