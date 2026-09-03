// GovCon influencer, media and partner outreach: six Instantly campaigns.
//
// Segments the 254-record outreach database (data/govcon-influencer-outreach.json)
// into six campaigns and builds them via POST /api/v2/campaigns. Campaigns are
// created and LEFT PAUSED with no leads. Nothing sends until a human runs
// influencer-db.mjs --export, uploads the CSVs and hits start.
//
// Six campaigns, not one. A creator, a podcast host, a proposal consultant and
// an APEX counselor want four different things, and averaging them into one
// number hides which segment is actually working. Six campaigns is also six
// independent reply-rate readings for the same product.
//
// Everything in scripts/outreach/instantly-wave1.mjs applies here and is not
// re-derived: spintax is {{RANDOM|a|b}} and RANDOM is mandatory (without it
// Instantly reads {{a|b}} as variable-with-fallback and silently renders "b"
// every time); no merge variable is nested inside a RANDOM block; every
// paragraph is wrapped in a <div> because the server-side sanitizer discards
// bare text nodes at the root of the body and returns 200 while doing it; no
// em dashes (scripts/check-emdash.mjs, and readers read them as an AI tell);
// every step carries a plain-text opt-out line because CAN-SPAM 15 USC
// 7704(a)(5)(A) wants the solicitation notice, the opt-out and a postal
// address in EVERY commercial message, and the address ships in the
// per-mailbox {{accountSignature}}.
//
// What is different here, and why:
//
//   1. NO MERGE VARIABLE CARRIES RESEARCH. The brief asks for {{recentContent}}.
//      There is no recent-content field in the database and there never will be
//      one that is current, so a body referencing it renders blank or stale on
//      a real send. Researched detail rides in {{opener}} instead: one complete
//      sentence, written per contact, exported in the lead CSV, and the export
//      refuses to emit a lead without it. A variable that cannot be blank is
//      the only kind that is safe to build a first line on.
//   2. GREETINGS ARE PRECOMPUTED. Only 60 of the 116 sendable contacts have a
//      usable first name; the rest are shared inboxes at a publication or an
//      accelerator. "Hi {{firstName}}," would render "Hi ," for a third of the
//      list. {{greeting}} is written per lead ("Hi Eric", "Hi GovCon Wire
//      team") so no body ever has to guess.
//   3. SUBJECTS CARRY NO VARIABLES. In wave 1 a bare {{companyName}} subject
//      sent as "(no subject)". Personalization here is in the opener, where a
//      blank is impossible, so the subjects are plain text and cannot fail.
//   4. NO AFFILIATE OR COMMISSION LANGUAGE IN C5. APEX Accelerators run on DoD
//      Office of Small Business Programs cooperative agreements and counsel at
//      no cost to the contractor. Vendor neutrality is the basis of that
//      relationship. A referral-commission pitch is not merely unwelcome, it is
//      the one message that could get GovHub named across a 117-contact network
//      that all talks to each other. C5 offers a counselor account and a
//      training session, and asks for nothing back. The guardrail below fails
//      the build if commission vocabulary appears in it.
//   5. CADENCE IS SLOWER. Day 0, 4, 8, 14 rather than wave 1's 0, 3, 7. These
//      are partnership asks to people with audiences, not bid-cycle sales.
//
// Env: INSTANTLY_API_KEY
// Usage:
//   node instantly-influencer.mjs --check      expand all spintax, run guardrails, no API calls
//   node instantly-influencer.mjs --dry-run    print the exact payloads that would POST
//   node instantly-influencer.mjs --sync       create the campaigns, or update them in place
//                                              if they already exist (matched by name).
//                                              Idempotent, and never activates anything.
//   node instantly-influencer.mjs --verify     re-read the campaigns and assert the copy
//                                              survived the sanitizer

const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

// ---- Sending window -------------------------------------------------------
// Same reasoning as wave 1: recipients work US Eastern, and the timezone field
// is a closed enum of 102 IANA strings that does not contain America/New_York.
// America/Detroit is the Eastern slot.
//
// The window is narrower than wave 1's 09:00-16:00. A podcast host or an editor
// reads pitches in the morning; nothing here benefits from an afternoon send,
// and a tighter window on a small list means every send lands in the same part
// of the day, which is one fewer variable when comparing segments.
const SCHEDULE = {
  start_date: '2026-09-08',
  end_date: null,
  schedules: [
    {
      name: 'Weekday mornings',
      timing: { from: '08:30', to: '12:00' },
      // Keys are "0".."6". Instantly's own AI SDR wrote {0:false,1..5:true,6:false}
      // on a schedule it named "Weekdays" in this workspace, so 0 = Sunday. The
      // API reference never states the mapping; confirm the picker shows Mon-Fri.
      days: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
      timezone: 'America/Detroit',
    },
  ],
};

// ---- Mailboxes ------------------------------------------------------------
// This list is 104 sendable contacts and 416 total sends spread over a month.
// That is roughly 25 sends a day across all six campaigns, which is one
// mailbox's worth of work, so the wave 1 problem (spreading volume thin enough
// that no single mailbox looks like a spammer) does not exist here.
//
// The problem that does exist is credibility. Every one of these recipients
// will look GovHub up before replying, and several will look up the sending
// domain. The original design here sent the four relationship segments from
// govhub.online for exactly that reason. That domain has no mailbox connected
// to this Instantly workspace: `GET /accounts` returns 48 addresses across
// 16 domains (checked 2026-09-04) and every one of them is a wave-1-style
// lookalike (buildwithgovhub.com, govhubbids.com, and so on), the same
// domains the wave-1 doc built and aged for cold sales. There is no
// govhub.online account to send this from.
//
// Given that constraint, the four relationship segments (C1, C2, C3, C6)
// share ONE mailbox on the least sales-coded of the sixteen: govhubhq.com.
// "HQ" reads as a company's own site; "govhubbids.com" or
// "govhubprocurement.com" read as what they are, a lead-gen domain, which is
// the exact tell a journalist or podcast host who vets pitches all day would
// recognize. It is still a compromise, not the fix: connecting a real
// govhub.online mailbox to this workspace before these four campaigns start
// sending is the actual right answer, and worth doing before the P1 rewrite
// pass rather than after. One address for all four is unchanged from the
// original design and still the point: a creator who gets the creator pitch
// and later the podcast pitch should see the same sender both times.
//
// Never bidwithgovhub.com, whose j.knight@ and j.k@ do not match the account
// name on file (the wave-1 doc's finding still holds; the domain carries a
// third, clean address today, e.knight@bidwithgovhub.com, but the call was to
// resolve the domain before ANY of it sends, not to cherry-pick around the two
// bad addresses). Never govhubbids.com or govhubproposal.com either: the
// wave-1 doc recorded that warmup never started on them.
//
// Point MAILBOXES.C1-C6 at govhub.online addresses the moment that domain has
// connected mailboxes; nothing else in this file has to change. The guardrails
// below fail on a placeholder, on any overlap with wave 1 or a held-out
// domain, and on any mailbox whose campaigns would exceed its account cap.

// Wave 1 claims exactly one address per domain and its doc reserves "two
// untouched mailboxes per domain as wave 2 capacity". This is wave 2. Every
// address below is one of those spares: warmup score 100, status active, and
// NOT in wave 1's own email_list, so the two programmes can run at the same
// time without two campaigns quietly drawing on one mailbox's 15/day account
// cap. (An earlier revision of this file did exactly that: it put C5 on
// earl.knight@govhubteam.com and C1/C2/C3/C6 on earl.knight@govhubhq.com,
// both of which wave 1 already uses.)
//
// One dedicated mailbox per campaign, two for the two largest, nine in all
// across nine separate domains. Spreading matters more than the shared-sender
// continuity the earlier revision optimised for: the guardrails already
// guarantee no contact and no sending domain appears in two campaigns, so no
// single recipient ever sees two of these sequences, and the continuity that
// reasoning protected does not arise in practice.
const MAILBOXES = {
  // Relationship segments, on the least sales-coded domains available: a
  // journalist or podcast host who vets pitches will read govhubbids.com or
  // govhubprocurement.com as what it is.
  C1: ['earl@govhubhq.com', 'earl@usegovhub.com'],
  C2: ['earl@getgovhub.com'],
  C3: ['earl@buildwithgovhub.com'],
  C6: ['earl@govhubnow.com'],
  // Referral segments. winwithgovhub.com was the documented wave 1 spare.
  // Never bidwithgovhub.com, whose j.knight@ and j.k@ do not match the account
  // name on file, and never govhubbids.com or govhubproposal.com, which the
  // wave 1 doc flagged as never having started warmup.
  C4: ['earl.knight@winwithgovhub.com', 'earl@govhubcontracts.com'],
  C5: ['earl@trygovhub.com', 'earl@govhubteam.com'],
};

// ---- Shared closers -------------------------------------------------------
// The opt-out line. Present in every step of every campaign, because two thirds
// of wave 1's original sends would have carried no opt-out notice at all.
const OPTOUT = '{{RANDOM|Reply "remove" and I will take you off this list.|If you would rather not hear from me, reply "remove" and that is the end of it.}}';

// ===========================================================================
// C1  Creators and influencers
// ===========================================================================
// Goal: a creator tries the product on a real solicitation, on camera.
// The offer is the demonstration, not the software. A creator does not need a
// license, they need something that films well, so email 1 offers to do the
// work and hand over the output whether or not they ever mention GovHub.
// Commission is deliberately absent from email 1 and appears in email 3, after
// the product has had a chance to be interesting on its own.
const C1_EMAIL_1 = [
  '{{greeting}},',
  '',
  '{{opener}}',
  '',
  'I built GovHub, an AI proposal platform for small federal contractors. It reads a solicitation, pulls the requirements out of Sections L and M, builds a compliance matrix from them, and drafts answers a human then edits.',
  '',
  '{{RANDOM|Rather than describe it, I would rather show you.|Describing it is less useful than showing you.}} Send me a solicitation your audience would recognize and I will run it through and send back everything it produces, yours to use on {{channel}} however you like. The account is on me either way.',
  '',
  '{{RANDOM|Open to that?|Worth a look?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// Email 2, day 4, same thread. A different reason to answer: the specific thing
// other creators found watchable, which is not the drafting.
const C1_EMAIL_2 = [
  '{{RANDOM|One thing I left out of the first note.|Something I should have led with.}}',
  '',
  'The part creators actually use is not the writing. It is the compliance matrix: every Section L instruction lined up against the Section M evaluation factors, on screen, in about two minutes. It teaches something real and it films well.',
  '',
  '{{RANDOM|Want me to build one on a solicitation you pick?|Happy to build one on any solicitation you name.}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// Email 3, day 8. Now the economics, as options rather than a pitch.
const C1_EMAIL_3 = [
  '{{RANDOM|Three ways this can work, then I will leave it alone.|Laying out the options, then I will stop.}}',
  '',
  '1. An account with no cap on solicitations, yours to keep whether or not GovHub ever comes up on {{channel}}.',
  '',
  '2. A recurring share of every subscription your audience starts, paid monthly for as long as they stay.',
  '',
  '3. A code that gets your audience a better rate than our own site offers.',
  '',
  '{{RANDOM|Take one, take all three, or take none.|Any combination, including none.}} Which is closest?',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// Email 4, day 14. Breakup that leaves the door open and asks nothing.
const C1_EMAIL_4 = [
  '{{RANDOM|I will stop here.|Last one from me.}}',
  '',
  'If the timing is wrong, that is a fine answer. The account offer has no expiry on it, so if you ever want a solicitation run through, reply on this thread and I will set it up that week.',
  '',
  '{{RANDOM|Good luck with the rest of the year.|Either way, good luck out there.}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// ===========================================================================
// C2  Podcasts and newsletters
// ===========================================================================
// Goal: an interview, a newsletter mention, a contributed piece.
// Nobody books a guest because the guest has a product. They book a guest
// because the guest has an episode. So email 1 pitches the episode and puts
// GovHub in one clause, as the reason the founder can speak to it.
const C2_EMAIL_1 = [
  '{{greeting}},',
  '',
  '{{opener}}',
  '',
  '{{RANDOM|Here is a topic I think would land with them:|One idea, if it is useful:}} where AI actually helps on a federal proposal and where it very much does not. The honest version. It is good at reading a solicitation and terrible at knowing what a customer wants, and most contractors are finding that out the expensive way.',
  '',
  'I run GovHub, an AI proposal platform for small federal contractors, so I have watched that line get crossed more than once.',
  '',
  '{{RANDOM|Useful for your audience?|Is that something your audience would want?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// One topic, not the menu from the brief. A guest pitch that lists three
// backup ideas reads as a template with slots; naming one and moving on reads
// as someone who already thought about the show.
const C2_EMAIL_2 = [
  '{{RANDOM|A different angle, in case the first one was not it.|One more idea, if the first one did not land.}}',
  '',
  'Why so many contractors lose a bid before anyone writes a word of the proposal, with the redacted solicitations and compliance matrices to make it a working walkthrough instead of opinion.',
  '',
  '{{RANDOM|Land better with your audience?|Closer to what you cover?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// Email 3: give something with no strings, which is the step that most often
// turns a non-answer into a reply.
const C2_EMAIL_3 = [
  '{{RANDOM|Offering this either way.|This stands whether or not we ever record anything.}}',
  '',
  'Send me a solicitation and I will send back the requirements breakdown and the compliance matrix in writing, yours to publish, quote or ignore. No attribution needed.',
  '',
  'If it turns out to be useful to your audience, we can talk about a longer conversation then.',
  '',
  '{{RANDOM|Want one?|Shall I put one together?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C2_EMAIL_4 = [
  '{{RANDOM|Closing this out.|Last note on this.}}',
  '',
  'If a guest on AI and federal proposals is ever useful to you, I am happy to be that guest, this month or next year. Reply on this thread whenever.',
  '',
  '{{RANDOM|Enjoyed the work regardless.|Good luck with the rest of the season.}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// ===========================================================================
// C3  GovCon media and blogs
// ===========================================================================
// Goal: contributed articles, data citations, resource-page inclusion, and the
// links that come with them.
// The one thing not to do is ask for a link. An editor gets that request daily
// and it is the request that identifies the sender as someone with nothing to
// offer. GovHub already publishes original federal spending analysis built from
// USAspending, so the offer is a cut of that data for their beat: real work, and
// a citation is the natural consequence rather than the request.
const C3_EMAIL_1 = [
  '{{greeting}},',
  '',
  '{{opener}}',
  '',
  'We pull federal award data from USAspending every week and publish original analysis most of the market never sees. Some of what we have found is squarely on your beat.',
  '',
  '{{RANDOM|Happy to cut a slice of it for you.|I can cut it any way that is useful to you.}} Name an agency, a NAICS code or a set-aside program and I will send the numbers and the methodology, yours to write up with or without our name on it.',
  '',
  '{{RANDOM|Any of that useful?|Would that be worth having?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C3_EMAIL_2 = [
  '{{RANDOM|A more concrete version of the last note.|Being more specific than I was.}}',
  '',
  'Two that surprised us: how much of the small-business award total sits in a handful of NAICS codes, and how differently agencies treat set-aside dollars once you control for contract size. Write-up is at govhub.online/insights.',
  '',
  'Both hold up to checking, and I will send the query and raw rows so your team can verify rather than take my word.',
  '',
  '{{RANDOM|Want the data?|Worth sending over?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// Email 3: the contributed piece, offered as labour rather than as promotion.
const C3_EMAIL_3 = [
  '{{RANDOM|One more option and then I will stop.|A different way in, then I am done.}}',
  '',
  'I can write the piece instead of pitching it: how a small contractor turns a solicitation into a compliance matrix and a submission plan, with a worked example on a real solicitation. Practical, no product in the body, and your editors keep the last word on every line.',
  '',
  '{{RANDOM|Should I send an outline?|Want to see an outline first?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C3_EMAIL_4 = [
  '{{RANDOM|I will leave it here.|Wrapping this up.}}',
  '',
  'The data offer stands with no deadline on it. If a story ever needs federal award numbers checked or cut a particular way, reply on this thread and I will turn it around the same week.',
  '',
  '{{RANDOM|Good luck with the coverage.|Thanks for reading this far.}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// ===========================================================================
// C4  Proposal and capture consultants
// ===========================================================================
// Goal: referral and channel partnerships.
// The reflex in this segment is that software is coming for the billable hours,
// and it is a reasonable reflex. So email 1 says the boundary out loud before
// anything else: the tool does intake and compliance mechanics, the consultant
// does strategy, positioning, pricing and colour teams. Naming the split first
// is what makes the rest of the email readable.
const C4_EMAIL_1 = [
  '{{greeting}},',
  '',
  '{{opener}}',
  '',
  'GovHub is an AI proposal platform, and I want to be straight about where it stops. It does solicitation intake, requirements extraction, the compliance matrix and a first pass at the boilerplate answers. It has no opinion on bid or no-bid, pricing, positioning, or whether a capture plan is any good. That is still you.',
  '',
  '{{RANDOM|What it changes is the hours.|The difference it makes is in the hours.}} The mechanical part of {{companyName}} work stops eating the week that should go to strategy.',
  '',
  '{{RANDOM|Worth fifteen minutes to see the workflow?|Worth a short look at the workflow?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C4_EMAIL_2 = [
  '{{RANDOM|Following up on the proposal workflow note.|Circling back on this.}}',
  '',
  'The consultants using it mostly point clients at it for the intake, so the first working session starts from an extracted requirements list rather than a PDF nobody has read yet.',
  '',
  'Clients pay for judgment either way. They just stop paying for the reading.',
  '',
  '{{RANDOM|Want to see what that looks like?|Shall I walk you through it?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// Email 3: the partner terms, stated plainly. This segment is commercial and
// will read vagueness as a hidden catch.
const C4_EMAIL_3 = [
  '{{RANDOM|The partner terms, in plain language.|Here is the actual arrangement, plainly.}}',
  '',
  'A partner account for {{companyName}} at no cost, with room for client workspaces under it. A recurring share of anything a referred client subscribes to, paid monthly for as long as they stay. No exclusivity, no minimum, no requirement that you ever mention us.',
  '',
  'You keep the client relationship and the invoice. We are the software underneath it.',
  '',
  '{{RANDOM|Want the details?|Should I send the terms?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C4_EMAIL_4 = [
  '{{RANDOM|Last note from me.|I will stop here.}}',
  '',
  'If it is not a fit, no problem at all. If a client ever turns up with more solicitations than proposal hours, the partner account is there and takes about a day to set up.',
  '',
  '{{RANDOM|Good luck with the pipeline.|Either way, good luck this quarter.}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// ===========================================================================
// C5  APEX Accelerator advisors and GovCon education
// ===========================================================================
// Goal: be a resource a counselor is comfortable naming. Nothing more.
//
// APEX Accelerators are funded through DoD Office of Small Business Programs
// cooperative agreements and counsel contractors at no cost. Vendor neutrality
// is the whole basis of that relationship, and a counselor who forwards a
// commission offer to their program office has ended the conversation for every
// other accelerator in the network, all of which talk to each other. This is
// the segment where the wrong email is not a wasted send, it is a burned
// channel.
//
// So: no commission, no referral share, no affiliate anything, no discount, no
// audience offer. A counselor account for demonstrations and a session for their
// clients, delivered by us at no cost, tool-neutral. The guardrail below fails
// the build if commission vocabulary appears anywhere in this campaign.
const C5_EMAIL_1 = [
  '{{greeting}},',
  '',
  '{{opener}}',
  '',
  '{{RANDOM|The question I keep hearing from counselors is the same one.|Counselors keep asking the same question.}} A client brings in a two hundred page solicitation and asks where to start, and there is no good answer that fits in a counseling session.',
  '',
  'GovHub is an AI proposal platform that takes that solicitation apart: the requirements, the compliance matrix, what has to be submitted and in what order. I am not asking {{companyName}} to recommend it. I am offering a counselor account so you can see whether it holds up, and a session for your clients on reading a solicitation properly, which works with or without any software.',
  '',
  '{{RANDOM|Worth a conversation?|Any interest?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// A worked artifact beats restated session logistics: it costs the counselor
// nothing to open, needs no account and no scheduling, and is the same
// "show, don't pitch" instinct behind C1's on-camera RFP teardown. Session
// detail moved to email 3, alongside the standalone account offer, since both
// are "here is more to opt into" asks and belong together.
const C5_EMAIL_2 = [
  '{{RANDOM|Something concrete, since the last note was all description.|A real example, since I only described it before.}}',
  '',
  'I ran a recent small-business set-aside solicitation through GovHub and it produced a two-page compliance matrix: every Section L requirement lined up against the Section M factors. Happy to send it over as workshop material, no account needed and nothing to set up.',
  '',
  '{{RANDOM|Want the PDF?|Should I send it over?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C5_EMAIL_3 = [
  '{{RANDOM|Two more things, both no cost, take either or neither.|Two offers, take either, both stand on their own.}}',
  '',
  'A counselor account: full access, no expiry, nothing you have to say about it. And a forty five minute session for your clients on turning a solicitation into a compliance and submission plan, tool-neutral, doable in a spreadsheet either way.',
  '',
  'If neither is useful you have lost nothing, and I will not ask about it again.',
  '',
  '{{RANDOM|Want either set up?|Interested in one of those?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C5_EMAIL_4 = [
  '{{RANDOM|I will leave you to it.|Last note, then I am out of your inbox.}}',
  '',
  'If a client ever gets stuck inside a solicitation, the account offer and the session offer both stand with no deadline. Reply on this thread and I will sort it out.',
  '',
  '{{RANDOM|Thanks for the work you do for these firms.|Good luck with your client load.}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// ===========================================================================
// C6  Associations and communities
// ===========================================================================
// Goal: member education, webinars, resource listings, sponsorships.
// An association buys one thing, which is value delivered to members without
// the association having to produce it. So email 1 offers a finished session
// rather than a partnership discussion.
const C6_EMAIL_1 = [
  '{{greeting}},',
  '',
  '{{opener}}',
  '',
  '{{RANDOM|I would like to run a session for your members, at no cost to you.|I can deliver a session for your members, no cost to the association.}} Forty five minutes on turning a federal solicitation into a compliance and submission plan: Sections L and M, building a compliance matrix, and the mistakes that get a bid rejected before anyone evaluates it.',
  '',
  'I run GovHub, an AI proposal platform for small federal contractors. The session teaches the method, not the product, and your members can do every step of it in a spreadsheet.',
  '',
  '{{RANDOM|Worth putting in front of your members?|Is that something your members would want?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C6_EMAIL_2 = [
  '{{RANDOM|Following up on the member session.|Circling back on the session idea.}}',
  '',
  'It also works as a written piece for your newsletter if a live event is harder to schedule, or as a recorded walkthrough your members can watch on their own time.',
  '',
  'Whichever is least work for your team.',
  '',
  '{{RANDOM|Any of those a fit?|Which of those is easiest?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C6_EMAIL_3 = [
  '{{RANDOM|One more thing I can offer members directly.|Something for the members themselves.}}',
  '',
  'An extended trial for anyone who comes through {{companyName}}, longer than our public one, and a standing rate for members that we do not publish anywhere else.',
  '',
  'It costs the association nothing and it is a real member benefit rather than a logo swap.',
  '',
  '{{RANDOM|Want the details?|Should I send terms?}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

const C6_EMAIL_4 = [
  '{{RANDOM|Closing the loop.|Last note on this.}}',
  '',
  'If member education on federal proposals is ever on the calendar, the session offer stands and I can deliver it on two weeks notice. Reply on this thread whenever it comes up.',
  '',
  '{{RANDOM|Good luck with the programme year.|Thanks for the time either way.}}',
  '',
  OPTOUT,
  '{{accountSignature}}',
];

// ---- Campaigns ------------------------------------------------------------
// Subjects carry no merge variables on purpose: wave 1 shipped a bare
// {{companyName}} subject that sent as "(no subject)" on a blank. Three
// variants each so a subject line is the one thing being A/B tested per
// segment, and the vocabulary is disjoint across campaigns so six campaigns
// from related domains do not share one fingerprint.
const CAMPAIGNS = [
  {
    key: 'C1',
    name: 'GovHub Influencer - C1 creators',
    subjects: [
      'run one of your RFPs through this',
      'an RFP teardown for your audience',
      'idea for your GovCon audience',
    ],
    emails: [C1_EMAIL_1, C1_EMAIL_2, C1_EMAIL_3, C1_EMAIL_4],
    daily_limit: 8,
    daily_max_leads: 4,
  },
  {
    key: 'C2',
    name: 'GovHub Influencer - C2 podcasts and newsletters',
    subjects: [
      'where AI fails on proposals',
      'a topic for your audience',
      'guest idea on AI and federal proposals',
    ],
    emails: [C2_EMAIL_1, C2_EMAIL_2, C2_EMAIL_3, C2_EMAIL_4],
    daily_limit: 4,
    daily_max_leads: 2,
  },
  {
    key: 'C3',
    name: 'GovHub Influencer - C3 media and blogs',
    subjects: [
      'federal award data, cut for your beat',
      'some numbers you might want',
      'USAspending analysis, yours to use',
    ],
    emails: [C3_EMAIL_1, C3_EMAIL_2, C3_EMAIL_3, C3_EMAIL_4],
    daily_limit: 5,
    daily_max_leads: 3,
  },
  {
    key: 'C4',
    name: 'GovHub Influencer - C4 consultants',
    subjects: [
      'software that stops where you start',
      'the mechanical half of proposal work',
      'a partner account, not a replacement',
    ],
    emails: [C4_EMAIL_1, C4_EMAIL_2, C4_EMAIL_3, C4_EMAIL_4],
    daily_limit: 10,
    daily_max_leads: 5,
  },
  {
    key: 'C5',
    name: 'GovHub Influencer - C5 APEX advisors',
    subjects: [
      'a session for the firms you counsel',
      'the 200 page solicitation problem',
      'counselor account, no strings',
    ],
    emails: [C5_EMAIL_1, C5_EMAIL_2, C5_EMAIL_3, C5_EMAIL_4],
    daily_limit: 10,
    daily_max_leads: 5,
  },
  {
    key: 'C6',
    name: 'GovHub Influencer - C6 associations',
    subjects: [
      'a member session on federal solicitations',
      'member education, delivered by us',
      'something for your members',
    ],
    emails: [C6_EMAIL_1, C6_EMAIL_2, C6_EMAIL_3, C6_EMAIL_4],
    daily_limit: 4,
    daily_max_leads: 2,
  },
];

// Gap in days to the NEXT email. delay is the wait AFTER this step, not before
// it, so email 1 goes out on activation and the last step's delay is inert.
// 0, 4, 8, 14.
const DELAYS = [4, 4, 6, 0];

// ---- Payload --------------------------------------------------------------
// Wrap every line in a <div>; a blank entry becomes an empty spacer div. Bare
// text nodes are silently discarded by the API's sanitizer on a 200 response.
function bodyHtml(lines) {
  return lines.map((l) => (l === '' ? '<div><br /></div>' : `<div>${l}</div>`)).join('');
}

function payload(c) {
  return {
    name: c.name,
    campaign_schedule: SCHEDULE,
    sequences: [
      {
        steps: c.emails.map((lines, i) => ({
          type: 'email',
          delay: DELAYS[i],
          delay_unit: 'days',
          variants:
            i === 0
              ? c.subjects.map((subject) => ({ subject, body: bodyHtml(lines) }))
              : // Empty subject threads the follow-up into the original conversation.
                [{ subject: '', body: bodyHtml(lines) }],
        })),
      },
    ],
    email_list: MAILBOXES[c.key],
    daily_limit: c.daily_limit,
    daily_max_leads: c.daily_max_leads,
    email_gap: 20, // minutes. Larger than wave 1's 12: the daily volume is tiny,
    // so there is no reason for a mailbox to ever send two in a row.
    random_wait_max: 5,
    stop_on_reply: true, // structural opt-out safety: any reply halts the sequence
    stop_on_auto_reply: false, // an out-of-office should not burn a relationship lead
    stop_for_company: true, // one conversation per organization at a time. This is
    // the backstop for the eight separate people at one association; the export
    // caps at one contact per org, and this catches what the cap misses.
    link_tracking: false,
    open_tracking: false, // Apple MPP and Microsoft prefetch fabricate opens, and
    // a tracking pixel is a remote image in a supposedly text-only email
    text_only: true,
    first_email_text_only: true,
    insert_unsubscribe_header: true, // RFC 8058. A non-destructive exit instead
    // of the Report Spam button
    prioritize_new_leads: false,
    match_lead_esp: false,
    allow_risky_contacts: false,
    disable_bounce_protect: false,
    auto_variant_select: null, // 20 leads is never a big enough sample to promote
    // a subject line on
    is_evergreen: false,
  };
}

// ---- Guardrails -----------------------------------------------------------
const BANNED = [
  'free', 'guarantee', 'winner', 'urgent', 'act now', 'limited time',
  'click here', 'discount', 'no obligation', 'risk free', '100%',
];

// The brief's own banned list: the phrases that identify a mass cold email.
const CORPORATE = [
  'hope this email finds you', 'synergy', 'revolutionary', 'game-changing',
  'game changing', 'cutting-edge', 'cutting edge', 'wanted to reach out',
  'touch base', 'circle back', 'best-in-class', 'best in class',
  'seamless', 'robust solution', 'unlock', 'empower', 'thought leader',
];

// C5 must never carry commercial-relationship vocabulary. See the C5 header.
// Matched on word boundaries: an earlier substring match flagged "separate".
const C5_FORBIDDEN = [
  'affiliate', 'affiliates', 'commission', 'commissions', 'referral', 'referrals',
  'revenue share', 'recurring share', 'partner account', 'rate', 'rates',
  'sponsor', 'sponsorship', 'exclusive', 'discount', 'trial', 'upgrade',
];

// The variables the lead export is contractually required to populate. Any
// other {{name}} in a body is a variable nothing fills, so it renders blank.
const ALLOWED_VARS = new Set(['greeting', 'opener', 'companyName', 'channel', 'accountSignature']);

function expand(text) {
  const m = /\{\{RANDOM\|([^{}]*)\}\}/.exec(text);
  if (!m) return [text];
  const out = [];
  for (const opt of m[1].split('|')) {
    out.push(...expand(text.slice(0, m.index) + opt + text.slice(m.index + m[0].length)));
  }
  return out;
}

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

function check() {
  let fail = 0;
  const note = (ok, label, detail) => {
    if (!ok) fail++;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? '  ' + detail : ''}`);
  };

  let total = 0;
  for (const c of CAMPAIGNS) {
    // Email 1 is the 60-120 word brief. Follow-ups are shorter by design; the
    // ceiling is a ceiling, not a target.
    const maxes = [130, 90, 110, 90];
    c.emails.forEach((lines, i) => {
      const label = `${c.key}/email${i + 1}`;
      const raw = lines.filter((l) => l !== '{{accountSignature}}').join('\n');
      const renders = expand(raw);
      total += renders.length;

      note(!/\{\{RANDOM\|[^{}]*\{\{/.test(raw), `${label} no variable nested in a RANDOM block`);
      note(
        renders.every((r) => !/\{\{RANDOM|\}\}\}\}/.test(r)) &&
          renders.every((r) => (r.match(/\{\{/g) || []).length === (r.match(/\}\}/g) || []).length),
        `${label} braces balanced in all ${renders.length} renders`
      );
      note(!raw.includes('—'), `${label} no em dash`);

      // Every variable used must be one the export guarantees a value for.
      const vars = [...new Set([...raw.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
      const unknown = vars.filter((v) => !ALLOWED_VARS.has(v));
      note(unknown.length === 0, `${label} only uses exported variables`, unknown.length ? `UNKNOWN: ${unknown}` : `(${vars.join(', ') || 'none'})`);

      const wc = renders.map((r) => words(r.replace(/\{\{\w+\}\}/g, 'x')));
      const lo = Math.min(...wc), hi = Math.max(...wc);
      note(hi <= maxes[i], `${label} word count ${lo}-${hi}`, `(limit ${maxes[i]})`);

      const hits = new Set();
      for (const r of renders) {
        const flat = r.toLowerCase().replace(/\s+/g, ' ');
        for (const b of BANNED) if (flat.includes(b)) hits.add(b);
        for (const b of CORPORATE) if (flat.includes(b)) hits.add(b);
      }
      note(hits.size === 0, `${label} banned and corporate phrases`, hits.size ? `HITS: ${[...hits]}` : '(none)');

      if (c.key === 'C5') {
        const bad = new Set();
        for (const r of renders) {
          const flat = r.toLowerCase().replace(/\s+/g, ' ');
          for (const b of C5_FORBIDDEN) if (new RegExp(`\\b${b}\\b`).test(flat)) bad.add(b);
        }
        note(bad.size === 0, `${label} no commercial-relationship vocabulary (APEX neutrality)`, bad.size ? `HITS: ${[...bad]}` : '(none)');
      }

      // More than one question mark in a short email reads as a survey.
      const q = new Set(renders.map((r) => (r.match(/\?/g) || []).length));
      note([...q].every((n) => n <= 1), `${label} questions per render`, `${[...q].sort()}`);

      // No campaign links its first cold touch: a bare domain in a first email
      // to a young .online site is a spam-signal double hit, and it reads as a
      // pitch before there is a conversation to justify one. C3 email 2 is the
      // one exception, once the thread already exists, because the insights
      // page is the thing being offered rather than a bolt-on CTA.
      const links = new Set(renders.map((r) => (r.match(/govhub\.online|https?:\/\//g) || []).length));
      const linkMax = c.key === 'C3' && i === 1 ? 1 : 0;
      if (i === 0) note(!renders.some((r) => /govhub\.online|https?:\/\//.test(r)), `${label} zero links in the first cold touch`);
      note([...links].every((n) => n <= linkMax), `${label} links per render`, `${[...links]} (max ${linkMax})`);

      note(renders.every((r) => !/^\s*[,.?!]/.test(r)), `${label} no render opens with punctuation`);
      note(/remove/i.test(raw), `${label} carries an opt-out line`);

      // The sanitizer discards bare text nodes, so every line must sit in a div.
      const assembled = bodyHtml(lines);
      note(
        !/(^|>)[^<>]*[A-Za-z]{3}[^<>]*(<|$)/.test(assembled.replace(/<div>[^<]*<\/div>/g, '')),
        `${label} every line is wrapped in a div (no bare text nodes)`
      );
    });

    note(
      c.subjects.every((s) => !/\{\{/.test(s)) && c.subjects.every((s) => s.trim().length > 8),
      `${c.key} subjects cannot render blank`,
      c.subjects.map((s) => `"${s}"`).join(' ')
    );
    note(c.emails.length === DELAYS.length, `${c.key} has ${c.emails.length} steps`, `delays ${DELAYS.join(',')}`);
  }

  // Subject vocabulary must be disjoint across campaigns: six campaigns sharing
  // a subject line share a fingerprint, which is the opposite of the point.
  const allSubjects = CAMPAIGNS.flatMap((c) => c.subjects);
  note(new Set(allSubjects).size === allSubjects.length, 'no subject line is reused across campaigns', `${allSubjects.length} total`);

  const allMbx = Object.values(MAILBOXES).flat();
  // No mailbox may serve two campaigns: each campaign's daily_limit is set
  // against the mailboxes it owns, so a shared box would be double-counted.
  note(
    new Set(allMbx).size === allMbx.length,
    'no mailbox serves two campaigns',
    `${allMbx.length} assignments, ${new Set(allMbx).size} unique addresses`
  );
  note(!allMbx.some((m) => m.startsWith('REPLACE_ME')), 'mailboxes are set to real addresses', allMbx.some((m) => m.startsWith('REPLACE_ME')) ? 'EDIT MAILBOXES BEFORE --sync' : '');
  // Wave 1's own email_list, from scripts/outreach/instantly-wave1.mjs. Two
  // campaigns drawing on one mailbox share its 15/day account cap without
  // either one knowing, so these two programmes must not overlap at all.
  const WAVE1_MAILBOXES = new Set([
    'earl.knight@buildwithgovhub.com', 'earl.knight@usegovhub.com', 'earl.knight@govhubcontracts.com',
    'earl.knight@govhubprocurement.com', 'earl.knight@govhubcapture.com', 'earl.knight@trygovhub.com',
    'earl.knight@getgovhub.com', 'earl.knight@govhubteam.com', 'earl.knight@govhubnow.com',
    'earl.knight@govhubhq.com', 'earl.knight@govhubsubmittals.com', 'e.knight@govhubrfp.com',
  ]);
  const clash = allMbx.filter((m) => WAVE1_MAILBOXES.has(m));
  note(clash.length === 0, 'no mailbox is shared with wave 1', clash.join(' '));

  // Domains the wave 1 doc held out: warmup never started on two of them, and
  // bidwithgovhub.com's addresses do not match the account name on file.
  const HELD_OUT_DOMAINS = ['govhubbids.com', 'govhubproposal.com', 'bidwithgovhub.com'];
  const heldOut = allMbx.filter((m) => HELD_OUT_DOMAINS.some((d) => m.endsWith('@' + d)));
  note(heldOut.length === 0, 'no held-out domain is used', heldOut.join(' '));

  const mbxDomains = allMbx.map((m) => m.split('@')[1]);
  note(
    new Set(mbxDomains).size === mbxDomains.length,
    'every mailbox is on its own domain',
    `${new Set(mbxDomains).size} domains across ${allMbx.length} mailboxes`
  );
  note(
    !allMbx.some((m) => m.includes('bidwithgovhub.com')),
    'bidwithgovhub.com is not used',
    '(its addresses do not match the account name on file)'
  );

  // A shared mailbox has its own account-level daily_limit in Instantly (15
  // on every account in this workspace, confirmed via GET /accounts on
  // 2026-09-04), separate from and outside each campaign's own daily_limit.
  // If several campaigns share one mailbox, the SUM of their campaign-level
  // daily_limit can ask that mailbox for more sends in a day than the account
  // itself allows. Checked by address rather than hardcoded to the C1/C2/C3/C6
  // group, so this still catches it if a future edit adds a fifth campaign to
  // the shared mailbox, or moves C4/C5 onto one.
  const MAILBOX_ACCOUNT_DAILY_LIMIT = 15;
  const byMailbox = new Map();
  for (const c of CAMPAIGNS) {
    for (const m of MAILBOXES[c.key] || []) {
      byMailbox.set(m, (byMailbox.get(m) || 0) + c.daily_limit);
    }
  }
  const overCap = [...byMailbox].filter(([, sum]) => sum > MAILBOX_ACCOUNT_DAILY_LIMIT);
  note(
    overCap.length === 0,
    `no mailbox's campaigns sum past its ${MAILBOX_ACCOUNT_DAILY_LIMIT}/day account limit`,
    overCap.length ? overCap.map(([m, sum]) => `${m}: ${sum}`).join(', ') : ''
  );

  console.log(`\n${total} total renders checked. ${fail === 0 ? 'All guardrails pass.' : fail + ' FAILURES.'}`);
  return fail;
}

// ---- API ------------------------------------------------------------------
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 2000)}`);
  return json;
}

async function findByName(name) {
  const r = await api('GET', '/campaigns?limit=100');
  return (r.items || []).find((c) => c.name === name);
}

// A 200 on create does not mean the body was stored: bare text nodes come back
// stripped. Re-read and assert.
function assertStored(c, sent) {
  const problems = [];
  const steps = c.sequences?.[0]?.steps || [];
  const want = sent.sequences[0].steps;
  if (steps.length !== want.length) problems.push(`step count ${steps.length} != ${want.length}`);
  steps.forEach((s, i) => {
    if (s.delay !== want[i].delay) problems.push(`step ${i + 1} delay ${s.delay} != ${want[i].delay}`);
    s.variants.forEach((v, j) => {
      const text = v.body.replace(/<[^>]*>/g, '').trim();
      if (text.length < 80) problems.push(`step ${i + 1} variant ${j} body stripped (${text.length} chars of text)`);
      if (!v.body.includes('{{RANDOM')) problems.push(`step ${i + 1} variant ${j} lost its spintax`);
      if (!v.body.includes('{{opener}}') && i === 0) problems.push(`step ${i + 1} variant ${j} lost {{opener}}`);
      if (!v.body.includes('{{accountSignature}}')) problems.push(`step ${i + 1} variant ${j} lost the signature`);
      if (/\}\}\}\}|\{\{RANDOM[^}]*\{\{/.test(v.body)) problems.push(`step ${i + 1} variant ${j} has a brace artifact`);
    });
  });
  const mbx = c.email_list || [];
  if (mbx.length !== sent.email_list.length) problems.push(`mailboxes ${mbx.length} != ${sent.email_list.length}`);
  if (c.status !== 0 && c.status !== 2) problems.push(`status ${c.status} is neither Draft(0) nor Paused(2)`);
  return problems;
}

const arg = process.argv[2] || '--check';

if (arg === '--check') {
  process.exit(check() === 0 ? 0 : 1);
} else if (arg === '--dry-run') {
  for (const c of CAMPAIGNS) console.log(JSON.stringify(payload(c), null, 2));
} else if (arg === '--sync') {
  if (check() !== 0) { console.error('\nGuardrails failed. Nothing sent to the API.'); process.exit(1); }
  if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }
  for (const c of CAMPAIGNS) {
    const body = payload(c);
    const existing = await findByName(c.name);
    if (existing) {
      await api('PATCH', `/campaigns/${existing.id}`, body);
      console.log(`updated ${c.key}  ${existing.id}`);
    } else {
      const r = await api('POST', '/campaigns', body);
      console.log(`created ${c.key}  ${r.id}`);
    }
  }
  console.log('\nAll six campaigns are in Draft with no leads. Nothing sends until leads are uploaded and a human starts them.');
} else if (arg === '--verify') {
  if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }
  let bad = 0;
  for (const c of CAMPAIGNS) {
    const live = await findByName(c.name);
    if (!live) { console.log(` MISSING ${c.key}  ${c.name}`); bad++; continue; }
    const full = await api('GET', `/campaigns/${live.id}`);
    const problems = assertStored(full, payload(c));
    if (problems.length) { bad++; console.log(` FAIL ${c.key}`); for (const p of problems) console.log(`        ${p}`); }
    else console.log(`  ok  ${c.key}  ${live.id}`);
  }
  process.exit(bad === 0 ? 0 : 1);
} else {
  console.error(`unknown argument ${arg}`);
  process.exit(1);
}
