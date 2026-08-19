---
title: "How to find the total awarded amount on a federal contract"
description: "How to read the total awarded amount in USAspending and FPDS, which field to trust for past performance, and the traps that inflate or deflate it."
publishDate: 2026-08-17
updatedDate: 2026-08-19
author: GovHub team
pillarSlug: how-to-respond-to-a-government-rfp
cover: "/brand/page-graphics/solutions-index-toolkit.svg"
coverAlt: "A simple illustration of tools laid out to analyze and assemble information."
draft: false
---

## How to find the total awarded amount, fast

If you need the total awarded amount for a federal contract, check two places first. In USAspending.gov on the Award Summary, read three fields: Current Total Value of Award, Potential Total Value of Award, and Total Obligations. In FPDS, use Base and Exercised Options Value for current total, and Base and All Options Value for the potential total. For a single definitive contract, the number you usually need for past performance is the Current Total Value, not the Potential. For IDIQs and BPAs, the parent award’s Potential Total is a ceiling. Real money shows up as obligations on orders.

If your notes include a short cryptic code, check it is actually a contract number before you search on it. Codes copied out of a USAspending or SAM.gov link are usually share or download tokens, and searching one in FPDS returns nothing. You need the PIID, Task Order number, or UEI/CAGE.

Below is the exact process, pitfalls that inflate or deflate your total, and a worked example.

<img class="post-figure" src="/brand/page-graphics/solution-rfp-shredding-strata.svg" alt="" aria-hidden="true" width="720" height="480" loading="lazy" decoding="async" />

## Total awarded vs obligated vs ceiling, mapped to the fields you will see

Different systems use different labels for the same concepts. Here is the one-to-one mapping you will see on public data sites.

- FPDS fields you can trust for totals
 - Base and Exercised Options Value. This is the current total award value. It reflects all executed options and priced scope after mods.
 - Base and All Options Value. This is the potential total. It assumes every option is exercised, and every priced option or quantity is taken.
 - Action Obligation. Shows funding obligated on each action. Summed across the award, it is the Total Obligations to date.

- USAspending fields, which map to FPDS
 - Current Total Value of Award = FPDS Base and Exercised Options Value.
 - Potential Total Value of Award = FPDS Base and All Options Value.
 - Total Obligations = sum of FPDS Action Obligations across all actions on the award.

- What to use when
 - For a firm fixed price, single award, cite Current Total Value for actual award size. If you need the full contract ceiling, cite Potential Total Value.
 - For IDIQs, GWACs, and BPAs, the parent award’s Potential Total is a ceiling, not revenue. Use obligations on task or delivery orders for booked revenue. See FAR 16.504(a)(4)(ii) on stating a maximum, and FAR 16.505 on ordering under IDIQs. For BPAs under FAR 13, see FAR 13.303-3(a)(2). For Schedule BPAs, see FAR 8.405-3.
 - For cost reimbursement with incremental funding, Current Total Value can be higher than Total Obligations. Funding lags scope by design under FAR 52.232-22.

## Where to find the number in USAspending

- Go to USAspending.gov and search Awards by Award ID or by the vendor’s UEI or CAGE.
- Open the Award Summary. Read three boxes near the top: Current Total Value of Award, Potential Total Value of Award, and Total Obligations. These are pulled from FPDS and rolled up through the latest modification.
- Click the Transactions or Modifications tab to confirm which mod set the current total. You will often see a base award action, option exercise actions under FAR 52.217-9, and bilateral scope changes.

Tip: If you only have a solicitation reference, search the agency and NAICS in USAspending’s Advanced Search, then filter to the period of performance start you expect. Tie it back to a PIID before you quote a number.

## Where to find the number in FPDS

- In FPDS, search by PIID or vendor name. Open the Award view for the base action.
- Read these two values on the award header: Base and Exercised Options Value, and Base and All Options Value.
- Open the Modifications list. Confirm later mods did not change the total. The latest mod that changed the total controls the Current Total.

FPDS will also show the CLIN structure. For the source of truth on line item totals, read the award document itself, usually an SF 1449 or a Section B price schedule. FAR 4.1005 defines the required data elements for line items. On SF 1449, Box 26 shows Total Award Amount for many awards. Always reconcile that with the CLIN rollup.

## What to do when the award is an IDIQ, GWAC, or a BPA

- Parent IDIQ or GWAC. The parent award shows a ceiling. That is the Base and All Options Value. It is the maximum, per FAR 16.504(a)(4)(ii). The Base and Exercised Options Value may be the same at award, but revenue is on orders. Do not claim the parent ceiling as booked past performance.
- Task or delivery orders. Each order has its own Current Total and Potential Total. Use those for order-level past performance and for capture sizing. Ordering is under FAR 16.505.
- BPAs under FAR Part 8 or 13. The BPA itself does not obligate funds, per FAR 13.303-3(a)(2). GSA Schedule BPAs under FAR 8.405-3 often state an estimated value or a not to exceed value. Real dollars show on BPA Calls.

If the parent IDV shows $0 for Base and Exercised Options Value, that is not an error. Many agencies award an IDV with zero base funding, then place all value on orders.

For more on these vehicle types, see our plain-language glossaries for [IDIQ](/glossary/contract-vehicles/#idiq), [GWAC](/glossary/contract-vehicles/#gwac), and [BPA](/glossary/contract-vehicles/#bpa).

## When you only have the solicitation

- Check Section B or the pricing attachment for the CLIN build. If the RFP includes estimated quantities or a price schedule, you can compute a notional total. Section B is often the only place with a real number.
- Read Section H and the options clause. If FAR 52.217-9 is present, the period may include option years. Sum the base and all option periods for a ceiling estimate.
- The solicitation might cite a program ceiling for a multiple award IDIQ. This is a maximum, not a guaranteed spend.

If you need help structuring the pricing section when you propose, see our guides on [how to read Section L and M](/blog/read-federal-rfp-section-l-m/) and [how to respond to a government RFP](/blog/how-to-respond-to-a-government-rfp/).

## That cryptic code you copied is probably not a contract number

If you see a short lowercase alphanumeric code in a link you copied, it is almost always a system token from a public site rather than an award identifier. Two common cases:

- USAspending Advanced Search share links include a short hash for your saved filters. It is not an Award ID, PIID, or FAIN.
- SAM.gov download center and data services sometimes append a short ID for a file job.

You cannot look up an award in FPDS or USAspending by pasting one of these tokens. Instead, find the real identifier in the award documents. Look for the PIID on SF 1449 Block 2 or the order number in Block 4. You can also use the vendor’s UEI or CAGE to narrow the search. Our glossaries for [UEI](/glossary/registration-and-ids/#uei) and [CAGE](/glossary/registration-and-ids/#cage-code) explain where to find those.

## Worked example, with numbers you can sanity check

Scenario: Single award, firm fixed price contract for facility O&M. Base year plus four option years. Options are exercised annually under FAR 52.217-9.

- At base award, the SF 1449 shows:
 - CLIN 0001, Base Year services, $4,800,000
 - CLIN 1001, Option Year 1 services, $4,950,000
 - CLIN 2001, Option Year 2 services, $5,100,000
 - CLIN 3001, Option Year 3 services, $5,250,000
 - CLIN 4001, Option Year 4 services, $5,400,000

- FPDS at base award:
 - Base and Exercised Options Value = $4,800,000
 - Base and All Options Value = $25,500,000

- End of Year 1, the government exercises the first option with a bilateral mod:
 - FPDS now shows Base and Exercised Options Value = $9,750,000
 - Base and All Options Value stays $25,500,000
 - Total Obligations to date might be $9,200,000 if funding lagged performance by a quarter.

- End of Year 2, a scope addition adds $300,000 to Option Year 2 via mod:
 - Current Total Value becomes $15,150,000
 - Potential Total changes to $25,800,000 if the change carries to the option CLINs
 - Total Obligations climb as funds are added, but can still trail by a few months

What to quote where:

- Past performance narrative. “Current total award value $15.15M, potential total $25.8M, total obligations to date $14.6M.” These numbers tie to USAspending fields any evaluator can verify.
- Capture sizing. Use the remaining potential value to judge pursuit worth. For this example, $10.65M potential remains before all options are exhausted.

## Common traps that will bite you

- Quoting the parent IDIQ ceiling as revenue. Do not do it. Use task order totals and obligations. See FAR 16.504 and 16.505.
- Double counting modifications. Only the latest mod that changes totals should be used for the Current Total. Do not sum every mod’s increase. FPDS already carries forward the total.
- Confusing funding with price. Obligations are not the award price. On incremental funding, FAR 52.232-22 limits funds below contract value.
- Citing Potential Total when the customer asked for “total awarded.” Most evaluators read “total awarded” as Current Total Value, not the Potential.
- Forgetting options you lost. If the government did not exercise an option, it does not belong in Current Total. If the potential was reduced via descoping mod, that also changes the Potential Total.
- Summing parent and order totals together. If you add an IDV ceiling and all the orders, you will inflate the number. Pick one layer for the story, usually the order.

If you routinely compile past performance, see our glossary on [past performance](/glossary/evaluation-criteria/#past-performance) for what evaluators check, and how they match your claims against CPARS and USAspending.

## Quick checklist to get the right number every time

- Identify the correct award layer
 - Is it a definitive contract, an IDIQ or GWAC parent, a task order, or a BPA Call?
- Pull the identifiers from the document
 - PIID on SF 1449 Block 2, Order number on Block 4, or the Vendor UEI or CAGE.
- Get the numbers from public data
 - USAspending Award Summary: Current Total Value, Potential Total Value, Total Obligations.
 - Or FPDS: Base and Exercised Options Value, Base and All Options Value, and Action Obligations rollup.
- Reconcile with the document
 - SF 1449 Box 26 Total Award Amount must tie to the CLIN rollup and FPDS at base award.
 - Review all modifications for scope and option exercises under FAR 52.217-9.
- Adjust for vehicle type
 - For IDIQs and BPAs, use order-level numbers for real spend. Treat parent totals as ceilings.
- Document the source and date
 - Screenshot the Award Summary or FPDS mod history. Note the date you pulled it.

## Why this matters in your proposal

Section M often scores credibility on past performance. If you overstate a “total awarded amount,” evaluators can and will cross check it with FPDS, USAspending, and CPARS, then dock you. Build a short appendix that shows the Current Total Value, Potential Total Value, and Total Obligations with dates and links. Train your volume leads to use the same definitions.

If you need to go from a messy RFP package to a clean, traceable set of numbers and compliance items, GovHub can extract CLINs, options, and Section L and M asks automatically so your team spends time on pricing and narrative, not scavenger hunts.

For more on qualifying pursuits before you sink hours into math, see our writeup on the [Bid or No-Bid decision](/blog/bid-no-bid-decision/). If you lean on third party intel tools to size deals, we also broke down real [GovWin IQ pricing, terms, and ROI math](/blog/govwin-iq-pricing-real-ranges-terms-roi/).

## Bottom line

- USAspending Current Total Value equals FPDS Base and Exercised Options Value. That is usually the “total awarded.”
- USAspending Potential Total Value equals FPDS Base and All Options Value. That is a ceiling.
- Total Obligations show money on the street.
- For IDIQs and BPAs, quote order-level totals for real performance. Treat parent totals as maximums.
- Ignore share and download tokens. Find the PIID, then pull the numbers above.
