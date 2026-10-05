// Earl's few lines around the deliverable.
//
// The model writes ONLY the opening and the closing. The deliverable body goes
// in verbatim from deliverables.mjs, so every fact a prospect can check (a
// clause, a date, a solicitation number) comes from the generator that cited
// it, never from a model improvising around it.
//
// Then lint. A lint failure in Earl's own lines is fed back for up to two
// rewrites; one in the deliverable body is scrubbed mechanically (dashes,
// stray markdown) and anything left is surfaced to the reviewer, because
// rewriting a cited line to satisfy a style rule is how a citation drifts.

import { structured, S } from './llm.mjs';
import { VOICE, lint } from './voice.mjs';

const SCHEMA = S.obj({
  opening: S.str('Greeting (or none) plus one to three sentences. Answers any question first, then hands the deliverable over.'),
  closing: S.str('One or two sentences after the deliverable, ending with at most one question. "" only if the instructions say no closing.'),
  reviewer_note: S.str('Anything Earl should check before sending, or "".'),
});

export async function compose({ playbook, plan, lead, cls, inbound, offer }) {
  const d = plan.deliverable;
  const body = scrub(d.body || '');
  const firstName = (lead.first_name || '').trim();
  const context = `PERSON: ${firstName || '(no first name; the address is a shared inbox)'}${lead.last_name ? ` ${lead.last_name}` : ''}, ${lead.company_name || ''}
THEIR TONE: ${cls.tone}

THE LAST EMAIL EARL SENT THEM:
"""
${offer || '(unavailable)'}
"""

THEIR REPLY:
"""
${cls.text}
"""

WHAT THIS CAMPAIGN PROMISED: ${playbook.promise}
DELIVERABLE (${d.kind}) FACTS: ${JSON.stringify(d.facts || {})}
${body ? `DELIVERABLE TEXT (goes in verbatim between your opening and closing; do not repeat it, but you may point at one specific detail in it):\n"""\n${body}\n"""` : 'THERE IS NO DELIVERABLE TEXT IN THIS EMAIL. Your opening and closing are the whole email.'}

INSTRUCTIONS FOR THIS REPLY: ${plan.instructions}

Length: match them. A one or two word reply gets an opening of one or two short sentences. Use their first name the way a person would (e.g. "${firstName || 'Hi there'},"), or no greeting at all if they wrote a single word; do not start with "Hi ${firstName || 'there'}," every time. If they signed their reply with a different form of their name than the record (signed "Dave", record says David), use the one they signed with. Never refer to material you were given that they have not seen.${plan.allowLinks?.length ? `\nLinks allowed in your lines: ${plan.allowLinks.join(', ')}` : '\nNo links in your lines.'}`;

  let feedback = '';
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await structured({
      schemaName: 'reply_lines',
      schema: SCHEMA,
      system: VOICE,
      user: context + feedback,
    });
    const own = `${out.opening}\n${out.closing}`;
    const ownIssues = lint(own, { asks: own, allowLinks: plan.allowLinks || [], minWords: 3, maxWords: 140 });
    last = { ...out, ownIssues };
    if (!ownIssues.length) break;
    feedback = `\n\nYOUR PREVIOUS ATTEMPT BROKE THESE RULES, FIX THEM: ${ownIssues.map((i) => `${i.rule} (${i.detail})`).join('; ')}`;
  }

  const text = [last.opening.trim(), body, last.closing.trim()].filter(Boolean).join('\n\n');
  const issues = lint(text, {
    asks: `${last.opening}\n${last.closing}`,
    allowLinks: plan.allowLinks || [],
    maxWords: d.kind === 'debrief_one_pager' ? 800 : 520,
  });
  return {
    subject: replySubject(inbound.subject),
    text,
    opening: last.opening,
    closing: last.closing,
    reviewerNote: last.reviewer_note,
    issues,
  };
}

export function replySubject(subject) {
  const s = String(subject || '').trim();
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

/** Mechanical fixes that cannot change meaning. */
export function scrub(text) {
  return String(text)
    .replace(/\s*—\s*/g, ', ')
    .replace(/([^0-9])\s*–\s*([^0-9])/g, '$1, $2')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ');
}
