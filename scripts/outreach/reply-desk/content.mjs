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
  approved: false,
  verify: [
    'FAR 15.506(a)(1): written request within 3 days of the award notice',
    'FAR 15.506(a)(4): untimely requests may be accommodated',
    'FAR 15.506(d): what the debriefing must include',
    'FAR 13.106-3(d): brief explanation on request for non-price-only simplified awards',
    'GAO 4 CFR 21.2(a)(2) 10 days after debriefing; FAR 33.104(c) 5 days for the stay',
  ],
  text: `HOW TO FIND OUT WHY YOU LOST A FEDERAL BID

First, check how it was bought. That decides what you are owed.
- Sealed bid (an IFB, FAR Part 14): there is no debriefing. Bids are opened in public, so ask the contracting officer for the bid abstract, which shows every bidder's price. If you were low and still lost, ask in writing whether your bid was found nonresponsive or your firm nonresponsible, and why.
- Simplified quote (an RFQ, FAR Part 13): no formal debriefing, but if the award was not on price alone, the CO has to give you a brief explanation of the basis for the award when you ask (FAR 13.106-3(d)). No 3-day clock on this one.
- Negotiated proposal (an RFP, FAR Part 15): you are entitled to a debriefing if you ask in writing within 3 days of receiving the award notice (FAR 15.506(a)(1)). Send it the day the notice lands.

The request. Email the CO named on the solicitation:
Subject: Debriefing request, [solicitation number]
"Per FAR 15.506, [company] requests a debriefing on [solicitation number]. We received the award notice on [date]. We can take it by phone or in writing, whichever is easier for you."

Ask for everything you are owed (FAR 15.506(d)):
1. The significant weaknesses and deficiencies in your proposal
2. Your evaluated price and technical rating, and those of the firm that got the award
3. Your past performance evaluation
4. The overall ranking, if they ranked offerors
5. The rationale for the award
Then the two questions that get useful answers: "Which part of our proposal cost us the most?" and "Was anything in it found not to meet a requirement?"

Missed the window? The ask that still works.
A late request is not a dead request. FAR 15.506(a)(4) lets the agency accommodate one, it just does not have to. So ask for something smaller and take the protest off the table:
"I know the debriefing window has passed and we are not contesting the award. Would you have 15 minutes to tell me the two or three things that would have made our proposal stronger? We plan to bid your next one."
COs say yes to this more often than you would expect, because it carries no protest risk and it improves their next competition. If they still say no, a FOIA request to the agency gets you the awarded contract, usually including the winning prices.

On the call: listen, do not argue, take notes, and end with "If you were us, what would you fix first?" Then send a two-line thank you.

One timing note: a debriefing starts the protest clocks (10 days at GAO, 5 days if you want the award stayed). If a protest is even possible, talk to counsel before the debriefing, not after.`,
};

// ---- C4 consultants: "the partner terms" ---------------------------------
// Promised in GovHub Influencer C4 step 3 ("Want the details?"). The copy
// already committed to: a free partner account with client workspaces, a
// recurring share of referred subscriptions paid monthly for as long as the
// client stays, no exclusivity, no minimum, no obligation to mention GovHub,
// and the consultant keeps the client relationship and the invoice.
//
// The details a "send details" reply is asking for are the numbers, and no
// numbers exist anywhere in either repo (there is no partner data model in
// the app). null = not decided. Any reply that needs a null field is held as
// needs_input with the field named; nothing is ever sent with a guess.
export const PARTNER_TERMS = {
  revenueSharePercent: null,  // the recurring share, e.g. 20
  clientWorkspaces: null,     // workspaces under the free partner account, e.g. 'up to 10'
  attribution: null,          // how a referred client is tied to the partner, e.g. 'a partner link, or the client names you at signup'
  payout: null,               // e.g. 'monthly by ACH, starting with the client's first paid month'
  setupTime: 'about a day',   // already promised in C4 step 4
};

// ---- C1 creators: "the account, the share, the code" ----------------------
// Promised in GovHub Influencer C1 step 3. "discount" is a banned word in this
// programme's copy; the offer is phrased as a better rate than the site's.
export const CREATOR_TERMS = {
  account: 'an account with no cap on solicitations, yours to keep whether or not GovHub ever comes up on your channel',
  revenueSharePercent: null,  // recurring share of subscriptions the audience starts
  audienceRate: null,         // e.g. '20 percent off the first three months', phrased as a rate
  attribution: null,          // e.g. 'a code your audience enters at signup'
};

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
