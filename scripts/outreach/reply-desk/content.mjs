// Fixed deliverables and the business terms only Earl can set.
//
// Anything here is sent exactly as written, so each piece carries `approved`.
// An unapproved piece can still be DRAFTED (the reply desk shows Earl what it
// would send) but it can never be sent, by hand or automatically, until he
// flips the flag in a reviewed commit. That is the whole review step for
// static content: once, here, not once per prospect.

// ---- A5: "the one page way to get a real answer out of the CO" ------------
// Promised in GH-A5-DebriefPain step 1 (instantly-angles.mjs). Written to be
// pasted inline: it is the body of a reply, not an attachment, because the
// Instantly reply endpoint takes no attachments and a link from a .com
// mailbox to govhub.online is the domain-mismatch risk instantly-wave1.md
// warns about.
//
// VERIFY BEFORE APPROVING: the citations are to the FAR as numbered before the
// 2025 FAR overhaul. If the agencies these leads bid with have adopted the
// overhaul's Part 15 deviation, check that 15.506(a)(1), 15.506(a)(4) and
// 15.506(d) still carry the same rules under the same numbers.
export const DEBRIEF_ONE_PAGER = {
  approved: true, // approved by the owner 2026-10-05
  // Checked against primary sources on 2026-10-05: acquisition.gov FAR (FAC
  // 2026-01), eCFR current to 2026-10-01, the FAR overhaul (RFO) deviation
  // text for Parts 12-15 and 33, 4 CFR 21.2, 31 USC 3553. Every citation is
  // valid in the official FAR. The RFO is still a proposed rule (Parts 12-15
  // proposed 2026-09-18), but most agencies already work under its class
  // deviations, which renumber these sections; the guide says so in one line.
  // Recheck when the RFO final rules publish.
  verified: '2026-10-05',
  verify: [
    'FAR 15.506(a)(1) (RFO 15.301-1(a)(1)): written request within 3 days of the award notice',
    'FAR 15.506(a)(4) (RFO 15.301-1(a)(3)): untimely requests may be accommodated; protest deadlines are not extended',
    'FAR 15.506(d) (RFO 15.301-1(c)): what the debriefing must include',
    'FAR 13.106-3(d) (RFO 12.301(b), 13.301): brief explanation on request',
    'FAR 14.403, 14.409-1, 9.104-3(d): bid abstract, reason for rejection, SBA referral',
    'FAR 15.503(b)(1)(iv): awardee unit prices public on request',
    '4 CFR 21.2(a)(2) 10 days; FAR 33.104(c) 5-day stay window; DFARS 215.506-70',
  ],
  text: `HOW TO FIND OUT WHY YOU LOST A FEDERAL BID

First, check how it was bought. That decides what you are owed.
- Sealed bid (an IFB, FAR Part 14): there is no debriefing. Bids are opened in public, so ask the contracting officer for the bid abstract, which shows every bidder's price. If you were low and still lost, your notice should say why (FAR 14.409-1). If a small business is found nonresponsible, the CO has to refer that to SBA for a Certificate of Competency (FAR 9.104-3(d)), so ask whether that happened.
- Simplified quote (an RFQ, FAR Part 13 or 12): no formal debriefing, but ask the CO for a brief explanation of the award. It is required when the award was not on price alone (FAR 13.106-3(d)), and most agencies give one either way. No 3-day clock on this one.
- Negotiated proposal (an RFP, FAR Part 15): you are entitled to a debriefing if you ask in writing within 3 days of receiving the award notice (FAR 15.506(a)(1)). Send it the day the notice lands. If you were cut from the competitive range earlier, the 3 days ran from that notice.
- Task order under a multiple-award contract: a formal debriefing only applies to large orders (over $7.5M), but the feedback ask below still works.
Many agencies now work under the FAR overhaul deviation, which renumbers some of these sections (15.506 becomes 15.301-1). The rules above are the same.

The request. Email the CO named on the solicitation:
Subject: Debriefing request, [solicitation number]
"Per FAR Part 15, [company] requests a postaward debriefing on [solicitation number]. We received the award notice on [date]. We can take it by phone or in writing, whichever is easier for you."

Ask for everything you are owed (FAR 15.506(d)):
1. The significant weaknesses and deficiencies in your proposal
2. Your evaluated price and technical rating, and those of the firm that got the award
3. Your past performance evaluation
4. The overall ranking, if they ranked offerors
5. The rationale for the award
6. Answers to reasonable questions about whether the evaluation followed the solicitation
Then the two questions that get useful answers: "Which part of our proposal cost us the most?" and "Was anything in it found not to meet a requirement?"

Missed the window? The ask that still works.
A late request is not a dead request. FAR 15.506(a)(4) lets the agency accommodate one; it just does not have to, and a late debriefing does not extend any protest deadline. So ask for something smaller and take the protest off the table:
"I know the debriefing window has passed and we are not contesting the award. Would you have 15 minutes to tell me the two or three things that would have made our proposal stronger? We plan to bid your next one."
COs say yes to this more often than you would expect, because it carries no protest risk and it improves their next competition. If they still say no, ask for the winning firm's items, quantities and unit prices, which must be made public on request (FAR 15.503(b)(1)(iv)). A FOIA request can get you the contract itself, though some prices may be blacked out and it can take months.

On the call: listen, do not argue, take notes, and end with "If you were us, what would you fix first?" Then send a two-line thank you.

One timing note: if you asked for the debriefing on time, a GAO protest is due within 10 days after it. To stop work on the award while a protest is decided, GAO has to notify the agency within 5 days after the debriefing date offered (or 10 days after award, if later), so file early. At DoD, follow-up questions sent within 2 business days of the debriefing move those dates until they are answered. If a protest is even possible, talk to counsel before the debriefing, not after.

This is general information, not legal advice.`,
};

// ---- C4 consultants: "the partner terms" ---------------------------------
// Promised in GovHub Influencer C4 step 3 ("Want the details?"): a free
// partner account with room for client workspaces, a recurring share of
// referred subscriptions paid monthly for as long as the client stays, no
// exclusivity, no minimum, no obligation to mention GovHub, and the
// consultant keeps the client relationship and the invoice.
//
// APPROVED 2026-10-05 as recommended (docs/reply-desk.md section 5):
// - 20 percent: with the share paid for as long as the client stays, LTV:CAC
//   is gross margin / share, so ~80 percent margin -> 4:1. 25 percent is the
//   ceiling for 3:1. HubSpot Solutions Partners and Gusto sit at 20.
// - A free Pro account, comped with a single-use 100 percent Stripe code, is
//   the only way to give a real active subscription without new code (the
//   admin plan override does not change what the product does).
// - Attribution by a per-partner Stripe promotion code: Stripe records it on
//   the subscription for email AND Google signups, unlike the UTM capture,
//   which misses OAuth. The client rate is what makes the code worth typing.
// - Client workspaces do not exist in the product yet (accounts and
//   memberships tables, no UI), so the reply says so instead of promising them.
// - The referral share must be disclosed to clients; APEX and SBDC counselors
//   cannot take it at all (13 CFR 130.470), which is why C5 never offers it.
export const PARTNER_TERMS = {
  approved: true, // approved by the owner 2026-10-05
  account: 'a GovHub Pro account for your own team at no cost, for as long as you are a partner',
  revenueSharePercent: 20,
  clientRate: '10 percent off their first 3 months',
  payout: 'monthly by ACH, 30 days after each month closes, once you are owed $50 or more',
  workspacesNote: 'One thing that is not ready yet: separate client workspaces inside your account. Until that ships, each client works in their own account, set up with your code.',
  setupTime: 'about a day',
};

// ---- C1 creators: "the account, the share, the code" ----------------------
// Promised in GovHub Influencer C1 step 3. "discount" is a banned word in this
// programme's copy; the offer is phrased as a better rate than the site's.
//
// APPROVED 2026-10-05 as recommended: 30 percent of the first year,
// then 20 percent for as long as they stay (about 24 percent blended; beats
// the B2B SaaS median of 20 for a creator with ~80k YouTube subscribers and a
// 15k-member group, while the long tail stays at the sustainable 20). The
// audience gets 20 percent off the first 3 months on top of the 14-day trial
// (Stripe coupon percent_off 20, duration repeating, duration_in_months 3).
// The creator must disclose the relationship in the video (FTC 16 CFR 255).
export const CREATOR_TERMS = {
  approved: true, // approved by the owner 2026-10-05
  account: 'an account with no cap on solicitations, yours to keep whether or not GovHub ever comes up on your channel',
  shareFirstYearPercent: 30,
  shareAfterPercent: 20,
  audienceRate: '20 percent off their first 3 months',
};

/** A promotion code from a name: "Aadvik Solutions" -> AADVIK, "Kizzy" -> KIZZY. */
export function promoCode(name) {
  const word = String(name || '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).find((w) => w.length >= 3) || 'PARTNER';
  return word.toUpperCase();
}

// ---- Wave 1: "a matrix builder on our site that runs without an account" ---
// The one promised asset that already exists. It is a link from a .com
// mailbox to govhub.online, which instantly-wave1.md flags as a placement
// risk; acceptable here only because the person asked for it by name.
export const MATRIX_BUILDER_URL = 'https://www.govhub.online/solutions/compliance-matrix-generator/';

// ---- Plain facts the composer may state when asked ----------------------
// From src/data/pricing.ts. The A2 draft offer is free, as the email said.
export const FACTS = {
  whatWeDo: 'we read the solicitation, find the things that would get a bid disqualified before anyone scores it, and write the proposal itself',
  // One sentence, the way a founder answers "what does it cost" in an email:
  // the free thing is free, and the product's entry price. Tiers only if asked again.
  pricing: 'Whatever the cold email offered as free is free, no strings. If they want GovHub itself, it starts at $129 a month with a 14-day trial and no card.',
  booking: 'https://calendly.com/earljknight/30min',
};
