// Network-free self-test for the reply desk: the parts that decide whether a
// reply is safe to send, tested on the real shapes of mail this programme gets.
// Run before any send, in CI and by hand:  node scripts/outreach/reply-desk.selftest.mjs

import assert from 'node:assert/strict';
import { lint, assemble, toHtml, quoteText } from './reply-desk/voice.mjs';
import { freshText, ruleCategory } from './reply-desk/classify.mjs';
import { scrub, replySubject } from './reply-desk/compose.mjs';
import { CAMPAIGNS, PLAYBOOKS, laneKeywords } from './reply-desk/playbooks.mjs';
import { partnerTerms, creatorTerms, debriefOnePager } from './reply-desk/deliverables.mjs';
import { DEBRIEF_ONE_PAGER } from './reply-desk/content.mjs';
import { inBusinessHours, sendAfter } from './reply-desk.mjs';
import { deadlineMs, fmtDeadline } from './reply-desk/sources.mjs';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
const rules = (text, opts) => lint(text, opts).map((i) => i.rule);
const mail = (subject, text) => ({ subject, body: { text } });

console.log('voice lint');
test('clean reply passes', () => assert.deepEqual(rules('George, here is the list. It closes Oct 12, so start with item 1. Want me to write the offer itself?'), []));
test('em dash fails', () => assert.ok(rules('Here it is — the list you asked for, all of it ready for you today.').includes('em_dash')));
test('en dash allowed in a numeric range', () => assert.ok(!rules('USDA wants 2,300–2,722 square feet in Cocoa, inside the delineated area, ground floor only.').includes('en_dash')));
test('en dash as a dash fails', () => assert.ok(rules('Here it is – the list you asked for, all of it ready for you today.').includes('en_dash')));
test('banned word fails', () => assert.ok(rules('This is urgent because the solicitation closes very soon for everyone involved here.').includes('banned_word')));
test('AI tell fails', () => assert.ok(rules('Great question. I hope this email finds you well and the list below helps you out.').includes('ai_tell')));
test('placeholder fails', () => assert.ok(rules('You get [SHARE PERCENT] of whatever a referred client pays, every month they stay.').includes('placeholder')));
test('lowercase template brackets are not placeholders', () => assert.ok(!rules('Subject: Debriefing request, [solicitation number]. Send it the day the award notice lands.').includes('placeholder')));
test('two questions in Earl\'s lines fail', () => assert.ok(rules('Want the list? Or should I write it? Either works for me this week.').includes('questions')));
test('questions inside a deliverable do not count', () => {
  const t = 'Here it is.\n\nAsk: "Which part cost us the most?" and "Was anything found not to meet a requirement?"\n\nWant me to look at your last one?';
  assert.ok(!rules(t, { asks: 'Here it is.\nWant me to look at your last one?' }).includes('questions'));
});
test('links blocked unless allowed', () => {
  assert.ok(rules('The builder is at https://www.govhub.online/solutions/compliance-matrix-generator/ and needs no account.').includes('link'));
  assert.ok(!rules('The builder is at https://www.govhub.online/solutions/compliance-matrix-generator/ and needs no account.', { allowLinks: ['https://www.govhub.online/'] }).includes('link'));
});
test('exclamation and markdown fail', () => {
  assert.ok(rules('Here it is! The whole list is below for you to read today.').includes('exclamation'));
  assert.ok(rules('**Item one** is the floodplain rule, and it decides the whole offer.').includes('markdown'));
});
test('signature carries the postal address', () => assert.match(assemble('Here it is.'), /3060 Mercer University Dr Ste 110, Atlanta, GA 30341/));
test('html is one div per line and escapes', () => {
  const h = toHtml('a < b\n\nc', { attribution: 'On Thu, Oct 1, 2026 at 10:12 AM George <g@x.com> wrote:', body: 'Yes, please' });
  assert.match(h, /^<div>a &lt; b<\/div><div><br><\/div><div>c<\/div>/);
  assert.match(h, /gmail_quote/);
  assert.match(h, /&lt;g@x.com&gt;/);
  assert.match(quoteText({ attribution: 'On x wrote:', body: 'Yes' }), /> Yes/);
});

console.log('reading replies');
test('Dave: one-line iPhone reply keeps only "Sure"', () => {
  const t = freshText(mail('Re: December question', 'Sure     --     Very Respectfully,        Dave Henderson         President & CEO        On Oct 1, 2026, at 09:49, Earl Knight   wrote:      ﻿ Hi David, your VA contract looks like it runs out in December.'));
  assert.ok(t.startsWith('Sure'));
  assert.ok(!t.includes('your VA contract'));
});
test('Gmail quote is cut', () => {
  const t = freshText(mail('Re: USDA', 'Yes, please\n\n> On Oct 1, 2026, at 10:04 AM, Earl Knight <earl@govhubproposal.com> wrote:\n> Hi George'));
  assert.equal(t, 'Yes, please');
});
test('Outlook header block is cut', () => {
  const t = freshText(mail('Re: did you see this', 'What solution do you provide?\nSent from my T-Mobile 5G Device\nGet Outlook for Android\n________________________________\nFrom: Earl Knight <earl.knight@getgovhub.com>\nSent: Monday'));
  assert.equal(t, 'What solution do you provide?');
});
test('out of office subject -> auto_reply', () => assert.equal(ruleCategory(mail('Automatic reply: your last bid', 'I will be out of the office until Monday.')), 'auto_reply'));
test('"Out of THE office" -> auto_reply', () => assert.equal(ruleCategory(mail('Out of the office Re: proposal workload', 'I am on vacation.')), 'auto_reply'));
test('address change notice -> auto_reply', () => assert.equal(ruleCategory(mail('Re: Social Security Administration', 'Widescope is converting to a new Microsoft Platform and as a result my email account will now be Hayes.Fountain@widescope.com.')), 'auto_reply'));
test('delegation notice -> auto_reply', () => assert.equal(ruleCategory(mail('Re: DoD', 'I am no longer involved in day-to-day operations at Lexset.')), 'auto_reply'));
test('challenge-response gate -> auto_reply', () => assert.equal(ruleCategory(mail('Please verify your email address to join my trusted email community', 'Click the link below.')), 'auto_reply'));
test('bare "No" -> not_interested', () => assert.equal(ruleCategory(mail('Re: federal bids', 'No\nThanks,\nJohn')), 'not_interested'));
test('"Stop" -> unsubscribe', () => assert.equal(ruleCategory(mail('Re: $408K', 'Stop')), 'unsubscribe'));
test('"Yes, please" needs the model', () => assert.equal(ruleCategory(mail('Re: USDA', 'Yes, please')), null));
test('"No thanks, we do this as part of our process" needs the model', () => assert.equal(ruleCategory(mail('Re: a partner account', 'No thanks, we do this as part of our process. I wish you good luck!')), null));

console.log('routing and deliverables');
test('every live campaign has a playbook', () => { for (const k of Object.values(CAMPAIGNS)) assert.ok(PLAYBOOKS[k], `missing playbook ${k}`); });
test('no playbook auto-sends without a reviewed commit', () => { for (const [k, p] of Object.entries(PLAYBOOKS)) assert.equal(p.autoSend, false, `${k} has autoSend on`); });
test('lane keywords come from the work, not the legal name', () => assert.deepEqual(laneKeywords('A1 Shredding And Recycling, Incorporated', 'Dependable On-Site Scan & Shred, Inc.'), ['shredding', 'recycling']));
test('partner terms with no numbers hold for input', () => {
  const d = partnerTerms();
  assert.ok(d.needsInput.length > 0);
  assert.ok(rules(d.body).includes('placeholder'));
});
test('creator terms with no numbers hold for input', () => assert.ok(creatorTerms().needsInput.length > 0));
test('debrief one-pager passes the voice lint', () => assert.deepEqual(rules(DEBRIEF_ONE_PAGER.text, { asks: '', maxWords: 700 }), []));
test('unapproved one-pager cannot send', () => assert.equal(debriefOnePager().needsApproval, !DEBRIEF_ONE_PAGER.approved));
test('scrub removes dashes and bold without touching ranges', () => {
  assert.equal(scrub('a — b **c** 2,300–2,722'), 'a, b c 2,300–2,722');
});
test('a fixed list does not reuse the one-pager numbering inside sections', () => {
  assert.ok(!/^\d+\.\s+\d+\./m.test(DEBRIEF_ONE_PAGER.text));
});
test('reply subject keeps one Re:', () => { assert.equal(replySubject('Re: USDA'), 'Re: USDA'); assert.equal(replySubject('USDA'), 'Re: USDA'); });

console.log('deadlines');
test('a bare-date deadline is that day, not the evening before', () => {
  assert.equal(fmtDeadline('2026-10-02'), 'Oct 2');
  assert.ok(deadlineMs('2026-10-02') > Date.parse('2026-10-02T20:00:00Z'));
});
test('a timestamped deadline keeps its day in Eastern', () => assert.equal(fmtDeadline('2026-10-12T09:00:00-05:00'), 'Oct 12'));

console.log('timing');
test('Saturday is not business hours', () => assert.equal(inBusinessHours(new Date('2026-10-03T15:00:00Z')), false));
test('Monday 11:00 ET is business hours', () => assert.equal(inBusinessHours(new Date('2026-10-05T15:00:00Z')), true));
test('Monday 07:00 ET is not', () => assert.equal(inBusinessHours(new Date('2026-10-05T11:00:00Z')), false));
test('a Friday-night yes is answered Monday morning, not at once', () => {
  const at = sendAfter('2026-10-02T23:30:00Z', Date.parse('2026-10-02T23:31:00Z'), () => 0.5);
  assert.ok(inBusinessHours(new Date(at)), at);
  assert.ok(at.startsWith('2026-10-05'), at);
});
test('a weekday-morning yes waits 25 to 95 minutes', () => {
  const recv = Date.parse('2026-10-05T14:00:00Z');
  for (const r of [0, 0.5, 0.999]) {
    const wait = (Date.parse(sendAfter(new Date(recv).toISOString(), recv, () => r)) - recv) / 60000;
    assert.ok(wait >= 25 && wait <= 95, `${wait} minutes`);
  }
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
