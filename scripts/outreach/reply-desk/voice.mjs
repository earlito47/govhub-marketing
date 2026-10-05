// Earl's voice, and the guard that holds every reply to it.
//
// The voice is not invented here. It is read off the copy these leads already
// replied to (instantly-angles.mjs, instantly-influencer.mjs): short declarative
// sentences, first person, plain about what GovHub does and does not do, one
// ask at the end, no exclamation marks, no em dashes. A reply that suddenly
// sounds like a support macro is the moment a prospect realises the first
// email was a sequence, so the reply has to sound MORE like a person than the
// sequence did, not less.
//
// The lint is deterministic on purpose. The model is told the rules in VOICE,
// and lint() checks them anyway, because a rule that lives only in a prompt is
// a rule that holds most of the time.

export const SIGNATURE = ['Earl Knight', 'Founder, GovHub', '', '3060 Mercer University Dr Ste 110, Atlanta, GA 30341'].join('\n');

export const VOICE = `You write as Earl Knight, founder of GovHub, replying by hand to someone who answered his cold email. You are a real person who has read their message and is now doing what you said you would do.

How Earl writes:
- Short declarative sentences. Contractions are fine. First person singular ("I"), "we" only for GovHub as a company.
- Plain about what GovHub does: "we read the solicitation, find the things that would get a bid disqualified before anyone scores it, and write the proposal itself." Never inflate it.
- He answers the question they actually asked, first, in their terms. If they wrote one word, he writes a short note. If they wrote a careful paragraph, he matches their care.
- He delivers the thing. The deliverable is the point of the email; the words around it are a few lines.
- He ends with at most ONE question, and it is a small, concrete next step tied to their situation, never "let me know if you have any questions".
- He is honest when something changed: a deadline passed, a fact in his first email was off, a piece is not ready. He says so in one plain sentence and moves on.

Never:
- No em dashes or en dashes. Use a comma, a colon, a period, or parentheses.
- No exclamation marks. No emoji. No markdown (no **bold**, no # headers). Plain text lists use "1." numbering.
- No support-desk or AI phrasing: "I hope this email finds you well", "great question", "happy to help", "feel free to", "don't hesitate", "I'd be delighted", "rest assured", "absolutely", "certainly", "touch base", "circle back", "leverage", "seamless", "robust", "game-changer", "delve", "furthermore", "moreover", "in conclusion", "I wanted to reach out", "just following up".
- No sales pressure words: guaranteed, guarantee, winner, urgent, act now, limited time, click here, discount, no obligation, risk free, 100%.
- No links unless the instructions for this reply say a link is allowed.
- Never invent a fact, number, deadline, price, clause, or capability. If it is not in the material you were given, do not state it.
- Never talk about your data or what you can or cannot see ("I do not have facts showing", "based on the information provided", "from what I can tell from the data"). If something about their company is uncertain, say it the way a person in the business would: "This one hinges on having space inside the Cocoa boundary, so start with item 1."
- Use the owner's words, not the regulation's. An acronym the owner would not use day to day gets a few plain words instead.
- Never mention AI writing the email, templates, sequences, or automation.
- Do not sign off. The signature is added after your text.`;

const BANNED = [
  'guaranteed', 'guarantee', 'winner', 'urgent', 'act now', 'limited time',
  'click here', 'discount', 'no obligation', 'risk free', '100%',
];

const AI_TELLS = [
  'hope this email finds you', 'hope this finds you', 'hope you are doing well', "hope you're doing well",
  'great question', 'happy to help', 'feel free', "don't hesitate", 'do not hesitate', 'delighted',
  'rest assured', 'absolutely', 'certainly', 'touch base', 'circle back', 'leverage', 'seamless',
  'robust', 'game-changer', 'game changer', 'delve', 'furthermore', 'moreover', 'in conclusion',
  'i wanted to reach out', 'just following up', 'as an ai', 'language model', 'let me know if you have any questions',
  'thank you for your interest', 'thanks for your interest', 'i appreciate your', 'excited to',
  'i do not have facts', "i don't have facts", 'based on the information', 'information provided',
  'from the data', 'one caveat', 'not going to pad', 'pad it',
];

/**
 * Check a reply against the voice rules. Returns a list of { rule, detail }.
 * `asks` is the part of the email where questions count against the
 * one-question rule (the opening and closing Earl wrote, not a deliverable
 * that legitimately lists questions to ask a contracting officer).
 */
export function lint(text, { asks = text, allowLinks = [], maxWords = 650, minWords = 15 } = {}) {
  const issues = [];
  const add = (rule, detail) => issues.push({ rule, detail });
  const lower = text.toLowerCase();

  if (text.includes('—')) add('em_dash', 'contains an em dash');
  // An en dash is correct between two numbers (2,300–2,722); anywhere else it is a dash.
  if (/(^|[^0-9])–|–([^0-9]|$)/.test(text)) add('en_dash', 'contains an en dash outside a numeric range');
  for (const w of BANNED) if (new RegExp(`(^|[^a-z])${escapeRe(w)}([^a-z]|$)`, 'i').test(text)) add('banned_word', w);
  for (const p of AI_TELLS) if (lower.includes(p)) add('ai_tell', p);
  if (/\{\{|\}\}|\bTODO\b|\bTBD\b|\[[A-Z][A-Z _/]{2,}\]|\bXX%?\b|<[a-z_]{3,}>/.test(text)) add('placeholder', 'unfilled placeholder');
  if (/\*\*|__|^#{1,6}\s/m.test(text)) add('markdown', 'markdown formatting');
  if (/^\s*[*•]\s/m.test(text)) add('markdown', 'bullet character; use 1. numbering');
  if ((text.match(/!/g) || []).length) add('exclamation', 'exclamation mark');
  if (/\p{Extended_Pictographic}/u.test(text)) add('emoji', 'emoji');
  const questions = (asks.match(/\?/g) || []).length;
  if (questions > 1) add('questions', `${questions} questions in Earl's own lines; one at most`);
  for (const url of text.match(/https?:\/\/[^\s)>\]]+|www\.[^\s)>\]]+/gi) || []) {
    if (!allowLinks.some((ok) => url.startsWith(ok))) add('link', url);
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > maxWords) add('length', `${words} words, over ${maxWords}`);
  if (words < minWords) add('length', `${words} words, under ${minWords}`);
  return issues;
}

/** The full email as sent: Earl's text, his sign-off, the mailbox signature. */
export function assemble(text) {
  return `${text.trim()}\n\nEarl\n\n--\n${SIGNATURE}`;
}

/**
 * Plain text to the HTML Instantly delivers. One <div> per line, the way Gmail
 * composes, because the Instantly sanitizer drops bare text nodes (see the
 * header of instantly-wave1.mjs) and a <br/> run renders differently per client.
 */
export function toHtml(text, quote) {
  const lines = text.split('\n').map((l) => `<div>${l.trim() ? escapeHtml(l) : '<br>'}</div>`).join('');
  if (!quote) return lines;
  const quoted = quote.body.split('\n').map((l) => `${escapeHtml(l) || '<br>'}`).join('<br>');
  return `${lines}<br><div class="gmail_quote"><div class="gmail_attr">${escapeHtml(quote.attribution)}<br></div>` +
    `<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">${quoted}</blockquote></div>`;
}

/** Plain-text version of the same quote, for the text/plain part. */
export function quoteText(quote) {
  if (!quote) return '';
  return `\n\n${quote.attribution}\n${quote.body.split('\n').map((l) => `> ${l}`).join('\n')}`;
}

/** "On Thu, Oct 1, 2026 at 10:12 AM George <g@x.com> wrote:" in the sender's own time zone is unknowable, so Eastern. */
export function attribution(iso, name, email) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  return `On ${day} at ${time} ${name ? `${name} ` : ''}<${email}> wrote:`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
