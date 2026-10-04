// What did they actually say?
//
// Two layers. Rules first, because most replies are an autoresponder or a bare
// "No" and neither needs a model. The autoresponder patterns are copied from
// strata-parse supabase/functions/outreach-metrics/index.ts (AUTO_BODY,
// AUTO_SUBJECT), which learned each one from a real miss: "out of THE office",
// the Lexset delegation notice, the Widescope address change. Keep the two in
// step; that file's self-test is scripts/outreach-tests/reply-classifier.test.mjs.
//
// Then the model, for anything a person wrote. It is asked for the facts a
// reply needs (did they accept the offer, what did they ask, did they point us
// at someone else), not for a sentiment score.

import { structured, S } from './llm.mjs';
import { htmlToText } from './sources.mjs';

const AUTO_BODY = new RegExp([
  'no longer (involved|with|at) ',
  'i am (currently )?(on|out on) (leave|maternity|paternity|sabbatical)',
  'on leave from',
  'in my absence',
  'has left the (company|organi[sz]ation|firm)',
  'no longer (employed|works? here)',
  'please (contact|reach out to|direct) .{0,40}(instead|in my absence|for urgent)',
  'i will be out of the office',
  '(email|e-?mail) (address|account) will (now )?be',
  'please update your (files|records|address book|contact)',
  '(is|are) (converting|migrating|moving) to a new',
].join('|'), 'i');

const AUTO_SUBJECT = new RegExp([
  'out of (the )?office',
  'automatic reply',
  'auto[- ]?reply',
  'thank you for your email',
  'expect delays',
  'verify your email',
  'trusted email community',
  'undeliverable',
  'delivery status notification',
  'mail delivery',
].join('|'), 'i');

const BARE_NO = /^(no|nope|no thanks?( you)?|no,? thank you|not interested|not at this time|pass)[\s.!,]*$/i;
const BARE_STOP = /^(stop|remove( me)?|unsubscribe|please remove( me)?|take me off( your list)?)[\s.!,]*$/i;

/** The part of an inbound email the person typed: no quoted thread, no client footer. */
export function freshText(email) {
  const raw = email.body?.text || htmlToText(email.body?.html || '');
  // The attribution line is matched ANYWHERE, not only after a newline: an
  // iPhone reply rendered from HTML puts "Sure -- Very Respectfully, Dave ...
  // On Oct 1, 2026, at 09:49, Earl Knight wrote:" on one line.
  const cut = raw.split(new RegExp([
    String.raw`\s*On (?:[A-Z][a-z]{2,8},? )?(?:[A-Z][a-z]{2,8}\.? \d{1,2}|\d{1,2} [A-Z][a-z]{2,8}),? \d{4}[\s\S]{0,200}?wrote:`,
    String.raw`\n\s*-{2,}\s*Original Message`,
    String.raw`\n\s*From: [\s\S]{3,200}?\n\s*(?:Sent|Date):`,
    String.raw`\n_{10,}`,
    String.raw`\n\s*>`,
    String.raw`\s+Sent from my `,
    String.raw`\s+Get Outlook for `,
  ].join('|')))[0];
  return cut.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Rules only. Returns a category, or null when a person wrote something that needs reading. */
export function ruleCategory(email, text = freshText(email)) {
  if (AUTO_SUBJECT.test(email.subject || '') || AUTO_BODY.test(text)) return 'auto_reply';
  const first = text.split('\n').map((l) => l.trim()).find(Boolean) || '';
  if (BARE_STOP.test(first)) return 'unsubscribe';
  if (BARE_NO.test(first)) return 'not_interested';
  return null;
}

const SCHEMA = S.obj({
  category: S.enum(['accept', 'question', 'referral', 'not_interested', 'unsubscribe', 'auto_reply', 'other'],
    'accept = yes to the thing offered (including "sure", "tell me", "send details"). question = asks what this is, how it works, or what it costs, with or without interest. referral = points us at a different person. other = anything else a person wrote.'),
  accepted_offer: S.bool('True when they said yes to the specific thing the last email offered, even if they also asked a question.'),
  questions: S.arr(S.str(), 'Each question they asked, in their words. Empty if none.'),
  wants_call: S.bool('They offered or asked for a call or meeting.'),
  referral_name: S.str('Person they pointed us to, or "".'),
  referral_email: S.str('That person\'s email if given, or "".'),
  tone: S.enum(['terse', 'neutral', 'warm', 'formal', 'skeptical']),
  summary: S.str('One line: what they want from us.'),
});

export async function classify({ email, offer }) {
  const text = freshText(email);
  const rule = ruleCategory(email, text);
  if (rule) {
    return {
      category: rule, accepted_offer: false, questions: [], wants_call: false,
      referral_name: '', referral_email: '', tone: 'terse', summary: rule.replace('_', ' '), by: 'rule', text,
    };
  }
  const out = await structured({
    schemaName: 'reply_classification',
    schema: SCHEMA,
    system: 'You read replies to B2B cold emails sent by the founder of GovHub, a federal proposal company, and report what the person wants. Be literal. Do not infer interest that is not there, and do not miss a yes that is there.',
    user: `THE EMAIL WE SENT (the offer they are replying to):\n"""\n${offer || '(unavailable)'}\n"""\n\nTHEIR REPLY (subject: ${email.subject || ''}):\n"""\n${text}\n"""`,
  });
  return { ...out, by: 'model', text };
}
