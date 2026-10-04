// One playbook per live campaign: what its emails promised, how to build it,
// and what Earl's few lines around it should do.
//
// Campaign ids are the ones in instantly-replies.mjs, instantly-angles.mjs and
// strata-parse scripts/outreach-tests/verify-live-leads.mjs. A reply from a
// campaign not listed here is drafted as a plain acknowledgement and held for
// a human, never guessed at.
//
// autoSend is false everywhere on purpose. Turning one on is a reviewed commit
// after Earl has approved enough of that playbook's drafts unchanged to trust
// it (docs/reply-desk.md, "Turning on auto-send"), AND it still needs the
// REPLY_DESK_AUTOSEND gate.

import {
  disqualifierList, nextOpen, recompeteRundown, debriefOnePager, partnerTerms, creatorTerms, matrixBuilder,
} from './deliverables.mjs';
import { FACTS, MATRIX_BUILDER_URL } from './content.mjs';

export const CAMPAIGNS = {
  'a4df9870-2d9d-49a1-8548-d1fa3b0599b7': 'A1',
  'c977a531-a8e5-47d3-b27b-5f8aacfab33b': 'A2',
  '39bc9fab-a9a7-4ed6-b34c-ccabeb9e76ee': 'A4',
  '9d7ca37a-cfba-4519-a9df-88d6ca0f448a': 'A5',
  '6f360a2e-4dee-4d75-8bd5-325162795616': 'C1',
  '1d2dc5a8-f7c1-4ac1-ac1a-3a382e185b4a': 'C2',
  'b2ee3665-fbee-4366-b2ee-d31cc0573e8e': 'C3',
  'b179df62-09f5-4045-a3e6-eb19afab4d20': 'C4',
  'aceddf26-388d-45f4-be83-89eda98816a9': 'C5',
  '80a9659f-ba43-4411-969f-10ecfcd6b95d': 'C6',
  '31fc2282-4153-42f9-b8d7-94517162b47c': 'W1A',
  '61c3b5df-22b6-4f98-ae56-290a750f1833': 'W1B',
  '09189743-6310-46bd-b48f-e5ca931d7e7e': 'W1C',
};

const CALL = (cls) => (cls.wants_call
  ? ` They mentioned a call. Say a call is fine and give the booking link ${FACTS.booking} in a sentence, but the email must still deliver the thing on its own.`
  : '');
const ANSWER = (cls) => (cls.questions.length
  ? ` They asked: ${cls.questions.map((q) => `"${q}"`).join(' and ')}. Answer that FIRST, in one or two plain sentences, before handing anything over. What GovHub does: ${FACTS.whatWeDo}. If (and only if) they asked about cost: ${FACTS.pricing}`
  : '');
// When the lane has fewer open than promised, nextOpen() lists what closed
// recently and returns a watch; the desk re-checks daily and drafts the
// follow-up. So the promise below is one the system keeps.
const SHORTFALL = (what) => ` If the deliverable facts show fewer open than ${what} (facts.open < facts.asked), say so plainly in one sentence (e.g. "Nothing in your lane is open this week."), point at the recently closed ones as proof the work is out there, and say Earl will send the next ones the week they post. Never describe what you are not doing ("not going to pad it"); just say what is true.`;
const links = (cls) => (cls.wants_call ? [FACTS.booking] : []);

export const PLAYBOOKS = {
  A1: {
    name: 'Recompete rundown',
    promise: 'a short rundown of what would get their recompete bid tossed before anyone reads it',
    autoSend: false,
    async build({ lead, cls }) {
      const p = lead.payload || {};
      const deliverable = await recompeteRundown({ companyName: lead.company_name, agencyShort: p.agency_short, endMonth: p.contract_end_month });
      return {
        deliverable,
        allowLinks: links(cls),
        instructions: `They said yes to the recompete rundown.${ANSWER(cls)} Open with one short line handing it over. If the rundown opens by correcting the cold email, do not repeat the correction yourself. Close with ONE question offering the next step: when the follow-on posts, Earl reads it the day it lands, flags anything that would get them tossed, and writes the proposal if they want it.${CALL(cls)}`,
      };
    },
  },

  A2: {
    name: 'Matched solicitation',
    promise: 'either the list of what would disqualify them on the named solicitation, or a free first draft of the response',
    autoSend: false,
    async build({ lead, cls }) {
      const p = lead.payload || {};
      const offeredDraft = /draft/i.test(p.cta_line || '');
      let deliverable = await disqualifierList({ solNumber: p.sol_number, companyName: lead.company_name, naics: p.naics_code });
      let instructions;
      if (deliverable.closed) {
        const { closedOn, title } = deliverable.facts;
        deliverable = await nextOpen({
          naics: p.naics_code, companyName: lead.company_name, count: 2, excludeSol: [p.sol_number],
          context: `They were pitched ${p.sol_number}, "${title}" (${p.sol_agency_short}, NAICS ${p.naics_code}), which closed ${closedOn} before we answered. That item is the best evidence of what they make or do; nothing else is known about them.`,
        });
        instructions = `${p.sol_number} closed on ${closedOn}, before Earl got back to them. Say so plainly in one sentence, no grovelling, and hand over the next open one(s) in their lane below instead.${SHORTFALL('two')}${ANSWER(cls)} Close with ONE question: ${offeredDraft ? 'whether they want Earl to draft one of these, free, filed with or without us' : 'whether they want the full disqualifier list on one of these'}.${CALL(cls)}`;
      } else if (offeredDraft) {
        instructions = `The cold email offered a free first draft of ${p.sol_number}, closing ${p.sol_close_date}.${ANSWER(cls)} ${cls.accepted_offer ? 'They said yes.' : ''} The draft needs a little from them, so hand over the disqualifier check below as the first step (it is what Earl would check before writing anyway) and close with ONE question asking them to send their capability statement or a short company overview plus two or three similar past jobs, so Earl can turn the draft around.${CALL(cls)}`;
      } else {
        instructions = `They said yes to the list of what would disqualify them on ${p.sol_number}, closing ${p.sol_close_date}.${ANSWER(cls)} Hand it over in one short line. If the deliverable facts carry a fit note, work it into the opening as one plain sentence, the way a person who knows the business would say it. Close with ONE question offering to write the response itself before it closes, free to file with or without us.${CALL(cls)}`;
      }
      return { deliverable, instructions, allowLinks: links(cls) };
    },
  },

  A4: {
    name: 'Next three in your lane',
    promise: 'the next three open solicitations in their lane, each checked for what would get the bid disqualified',
    autoSend: false,
    async build({ lead, cls }) {
      const p = lead.payload || {};
      const deliverable = await nextOpen({
        naics: p.naics_code,
        keywords: laneKeywords(p.competitor_name, lead.company_name),
        companyName: lead.company_name,
        count: 3,
        context: `${p.competitor_name} (${p.competitor_city}) won a ${p.award_amount_short} ${p.award_agency_short} award in NAICS ${p.naics_code}, which is how we found them. Company name: ${lead.company_name}.`,
      });
      return {
        deliverable,
        allowLinks: links(cls),
        instructions: `The cold email offered "the next three in your lane before they close".${ANSWER(cls)} Hand them over.${SHORTFALL('three')} Close with ONE question: if any are open, offer the full disqualifier check or the proposal itself on whichever one they want to bid; if none are open, ask whether there is a particular agency or area they want Earl to watch for them.${CALL(cls)}`,
      };
    },
  },

  A5: {
    name: 'Debrief one-pager',
    promise: 'the one-page way to get a real answer out of the CO, including the ask that still works after the window closes',
    autoSend: false,
    async build({ cls }) {
      return {
        deliverable: debriefOnePager(),
        allowLinks: links(cls),
        instructions: `They said yes to the debrief one-pager, which is below.${ANSWER(cls)} Hand it over in one short line. Close with ONE low-key question: if they have a solicitation open right now, or the number of the one they lost, Earl will look at it and tell them what he would have flagged.${CALL(cls)}`,
      };
    },
  },

  C1: {
    name: 'Creator offer',
    promise: 'an account with no cap, a recurring share of subscriptions their audience starts, and a better rate for their audience',
    autoSend: false,
    async build({ cls }) {
      return {
        deliverable: creatorTerms(),
        allowLinks: links(cls),
        instructions: `They are a GovCon content creator and answered the creator outreach.${ANSWER(cls)} Lay out the offer below plainly. Close with ONE question asking which solicitation they would like run first, so they have something to film.${CALL(cls)}`,
      };
    },
  },

  C4: {
    name: 'Consultant partner terms',
    promise: 'the partner terms: free partner account with client workspaces, recurring share of referred subscriptions',
    autoSend: false,
    async build({ cls }) {
      return {
        deliverable: partnerTerms(),
        allowLinks: links(cls),
        instructions: `They are a proposal consultancy and asked for the partner details.${ANSWER(cls)} Hand over the terms below in one short line. Close with ONE question: whether Earl should set up their partner account this week.${CALL(cls)}`,
      };
    },
  },

  W1A: matrixPlaybook('Wave 1 serial bidders'),
  W1B: matrixPlaybook('Wave 1 new primes'),
  W1C: matrixPlaybook('Wave 1 registered, no awards'),

  C2: manual('Podcasts and newsletters', 'a guest spot, or a written requirements breakdown and compliance matrix on a solicitation they send'),
  C3: manual('Media and blogs', 'federal award numbers cut by the agency, NAICS code or set-aside they name, with methodology'),
  C5: manual('APEX advisors', 'a counselor account, a two-page sample compliance matrix, and a 45-minute client session'),
  C6: manual('Associations', 'a 45-minute member session, a newsletter piece, or a recorded walkthrough, plus member terms'),
};

function matrixPlaybook(name) {
  return {
    name,
    promise: 'a link to the compliance matrix builder on the GovHub site that runs without an account',
    autoSend: false,
    async build({ cls }) {
      return {
        deliverable: matrixBuilder(),
        allowLinks: [MATRIX_BUILDER_URL, ...links(cls)],
        instructions: `The follow-up offered to point them at the free compliance matrix builder. The deliverable is the link; put it on its own line. One sentence on what it does: paste in the solicitation's instructions and evaluation sections and it builds the matrix, no account, exports to CSV.${ANSWER(cls)} Close with ONE question offering to run a live solicitation for them instead if they would rather see the whole thing done.${CALL(cls)}`,
      };
    },
  };
}

function manual(name, promise) {
  return {
    name,
    promise,
    autoSend: false,
    async build({ cls }) {
      return {
        deliverable: {
          kind: 'manual', body: '', facts: {}, sources: [], gaps: [], warnings: [],
          needsInput: [`no deliverable generator for this campaign yet: ${promise}`], needsApproval: false,
        },
        allowLinks: links(cls),
        instructions: `This campaign's deliverable is not automated, so write a short, warm holding reply: thank them in a few words for coming back, answer any question you can from the facts given${ANSWER(cls)}, and close with ONE question that moves toward ${promise}. Do not promise a date.`,
      };
    },
  };
}

// The words that say what a firm does, from the competitor that won in its
// lane and from its own name. "A1 Shredding And Recycling" -> shredding,
// recycling. Generic company words are useless as SAM queries.
const GENERIC = new Set([
  'and', 'the', 'of', 'inc', 'llc', 'corp', 'corporation', 'incorporated', 'company', 'co', 'group',
  'services', 'service', 'solutions', 'systems', 'technologies', 'technology', 'international', 'enterprises',
  'consulting', 'global', 'associates', 'partners', 'dependable', 'professional', 'american', 'national',
  'united', 'federal', 'government', 'management', 'general', 'site', 'on-site', 'onsite',
]);
export function laneKeywords(...names) {
  const out = [];
  for (const n of names) {
    for (const w of String(n || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/)) {
      if (w.length >= 4 && !GENERIC.has(w) && !out.includes(w)) out.push(w);
    }
  }
  return out.slice(0, 2);
}
