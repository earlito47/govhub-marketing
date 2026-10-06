// The review email: every waiting reply as a card you can read on a phone.
//
// Earl reads these in Gmail, so this is email HTML, not web HTML: tables for
// layout, every style inline, no external CSS or images, nothing that needs
// JavaScript. Gmail on Android and iOS strips <style> blocks in some modes,
// which is why nothing below depends on one.
//
// Each card shows what they wrote, the reply exactly as it would be sent
// (lists as lists, the signature greyed, unfilled numbers highlighted), what
// the deliverable was built from, and the id to approve it with. The same
// HTML is written to .cache/reply-desk/REVIEW.html for reading locally.

import { assemble } from './voice.mjs';

const C = {
  navy: '#214B89', teal: '#12948C', ink: '#1F2937', muted: '#6B7280', line: '#E5E0D5',
  oat: '#F5F1E8', card: '#FFFFFF', quote: '#F3F4F6', amber: '#B45309', amberBg: '#FEF3C7',
  brick: '#9B2C2C', brickBg: '#FDE8E8', tealBg: '#E6F4F3', mark: '#FDE68A',
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const STATUS = {
  drafted: { label: 'Ready to send', fg: C.teal, bg: C.tealBg },
  needs_input: { label: 'Needs your numbers', fg: C.amber, bg: C.amberBg },
  needs_content: { label: 'Needs your approval', fg: C.brick, bg: C.brickBg },
  needs_human: { label: 'Needs you to reply', fg: C.brick, bg: C.brickBg },
  referral: { label: 'Pointed us to someone', fg: C.navy, bg: '#E8EEF8' },
};

// What a missing business decision means, in words.
const INPUT_LABELS = {
  'PARTNER_TERMS.revenueSharePercent': 'Partner revenue share (percent)',
  'PARTNER_TERMS.clientWorkspaces': 'How many client workspaces a partner account gets',
  'PARTNER_TERMS.attribution': 'How a referred client is tied to the partner',
  'PARTNER_TERMS.payout': 'When and how partners get paid',
  'CREATOR_TERMS.revenueSharePercent': 'Creator revenue share (percent)',
  'CREATOR_TERMS.audienceRate': 'The rate their audience gets',
  'CREATOR_TERMS.attribution': 'The code or link their audience uses',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline formatting for one already-escaped line: links and highlighted placeholders. */
function inline(escaped) {
  return escaped
    .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${C.teal};text-decoration:underline">$1</a>`)
    .replace(/\[([A-Z][A-Z0-9 _/]{2,})\]/g, `<span style="background:${C.mark};padding:0 3px;border-radius:3px;font-weight:600">[$1]</span>`);
}

/** The reply as it would read in their inbox: paragraphs, real lists, grey signature. */
export function draftToHtml(text) {
  const full = assemble(text);
  const [body, signature = ''] = full.split(/\n--\n/);
  const out = [];
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim());
    let list = null;
    const flush = () => { if (list) { out.push(`<${list.tag} style="margin:0 0 14px;padding-left:22px">${list.items.join('')}</${list.tag}>`); list = null; } };
    const para = [];
    const flushPara = () => { if (para.length) { out.push(`<p style="margin:0 0 14px">${para.join('<br>')}</p>`); para.length = 0; } };
    for (const line of lines) {
      const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
      const bul = line.match(/^\s*-\s+(.*)$/);
      if (num || bul) {
        flushPara();
        const tag = num ? 'ol' : 'ul';
        if (list && list.tag !== tag) flush();
        if (!list) list = { tag, items: [] };
        list.items.push(`<li style="margin:0 0 8px">${inline(esc((num || bul)[1]))}</li>`);
      } else {
        flush();
        const isHeading = line.length < 70 && line === line.toUpperCase() && /[A-Z]{4}/.test(line);
        para.push(isHeading ? `<strong style="letter-spacing:.02em">${inline(esc(line))}</strong>` : inline(esc(line)));
      }
    }
    flush();
    flushPara();
  }
  const sig = signature.trim()
    ? `<div style="margin-top:6px;padding-top:10px;border-top:1px solid ${C.line};color:${C.muted};font-size:13px;line-height:1.5">${signature.trim().split('\n').map((l) => esc(l) || '&nbsp;').join('<br>')}</div>`
    : '';
  return out.join('') + sig;
}

function pill(status) {
  const s = STATUS[status] || { label: status, fg: C.muted, bg: C.quote };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${s.bg};color:${s.fg};font-size:12px;font-weight:700;letter-spacing:.02em">${esc(s.label)}</span>`;
}

function callout(fg, bg, title, items) {
  if (!items.length) return '';
  return `<div style="margin:0 0 14px;padding:12px 14px;border-radius:8px;background:${bg};color:${fg};font-size:14px;line-height:1.5">
    <div style="font-weight:700;margin-bottom:4px">${esc(title)}</div>
    ${items.map((i) => `<div>&bull; ${esc(i)}</div>`).join('')}</div>`;
}

// Their words only: cut the signature block and legal footer that came with
// the reply, so the card shows "Sure", not "Sure -- Very Respectfully, ...".
export function trimQuote(text, name = '') {
  const first = name.trim().split(/\s+/)[0] || '';
  const out = [];
  for (const line of String(text).replace(/\r/g, '').split('\n')) {
    const t = line.trim();
    if (/^(--|__|\*\*\*|very respectfully|v\/r|regards|best regards|kind regards|warm regards|sincerely|cheers,|sent from)/i.test(t)) break;
    if (/confidential|privileged|intended (only )?for the/i.test(t)) break;
    if (out.length && first.length > 2 && new RegExp(`^${first}(\\s+[A-Z][\\w'-]+)?\\s*$`).test(t)) break;
    out.push(line);
  }
  const kept = out.join('\n').replace(/\s*-{2,}\s*$/, '').replace(/\n{3,}/g, '\n\n').trim();
  return kept || String(text).trim();
}

const fromName = (m) => (m.quote?.attribution || '').match(/(?:AM|PM)\s+(.*?)\s*<[^>]+>\s*wrote:/)?.[1] || '';

const label = (t) => `<div style="margin:18px 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;color:${C.muted};text-transform:uppercase">${esc(t)}</div>`;

const daysSince = (iso, now) => Math.max(0, Math.floor((now - Date.parse(iso)) / 86400000));
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : '');

function sourceLinks(sources = []) {
  const links = sources.filter((s) => /^https?:\/\//.test(s));
  const files = sources.filter((s) => !/^https?:\/\//.test(s) && !/content\.mjs/.test(s));
  const name = (u) => (u.includes('sam.gov') ? 'SAM.gov notice' : u.includes('usaspending.gov') ? `USASpending ${u.split('/').pop().split('_')[2] || 'award'}` : u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40));
  const parts = links.map((u) => `<a href="${esc(u)}" style="color:${C.teal}">${esc(name(u))}</a>`);
  if (files.length) parts.push(`${files.length} solicitation document${files.length === 1 ? '' : 's'} read`);
  return parts.join(' &middot; ');
}

function card(m, text, now) {
  const waited = m.received_at ? daysSince(m.received_at, now) : null;
  const theyWrote = trimQuote(m.cls?.text || '', fromName(m));
  const d = m.deliverable || {};
  const inputs = (d.needsInput || []).map((n) => INPUT_LABELS[n] || n);
  const blocks = [];

  blocks.push(`<div>${pill(m.status)}</div>
    <div style="margin:10px 0 2px;font-size:19px;font-weight:700;color:${C.ink};line-height:1.3">${esc(m.company || m.lead)}</div>
    <div style="font-size:13px;color:${C.muted}">${esc(m.campaign || '')}${m.playbook ? ` &middot; ${esc(m.playbook)}` : ''}${m.received_at ? ` &middot; replied ${esc(fmtDay(m.received_at))}` : ''}${waited !== null ? ` &middot; <span style="color:${waited >= 3 ? C.brick : C.muted};font-weight:${waited >= 3 ? 700 : 400}">waiting ${waited} day${waited === 1 ? '' : 's'}</span>` : ''}</div>`);

  if (theyWrote) {
    blocks.push(label('They wrote'));
    blocks.push(`<div style="padding:10px 14px;border-left:3px solid ${C.navy};background:${C.quote};border-radius:0 6px 6px 0;color:${C.ink};font-size:15px;line-height:1.5">${esc(theyWrote.slice(0, 700)).replace(/\n/g, '<br>')}</div>`);
  }

  if (inputs.length) blocks.push(`<div style="height:14px"></div>${callout(C.amber, C.amberBg, 'Fill these in before it can go (they are highlighted in the draft):', inputs)}`);
  if (m.status === 'needs_content') {
    blocks.push(`<div style="height:14px"></div>${callout(C.brick, C.brickBg, 'This uses fixed text you have not approved yet. Check these, then approve it once:', (d.warnings || []).flatMap((w) => (w.includes('verify:') ? w.split('verify:')[1].split(';').map((x) => x.trim()) : [])))}`);
  }

  if (text) {
    blocks.push(label('What we would send'));
    blocks.push(`<div style="border:1px solid ${C.line};border-radius:10px;overflow:hidden">
      <div style="padding:9px 14px;background:${C.oat};border-bottom:1px solid ${C.line};font-size:12px;color:${C.muted};line-height:1.5">
        From <strong style="color:${C.ink}">${esc(m.eaccount || '')}</strong> to ${esc(m.lead)}${m.cc ? `, cc ${esc(m.cc)}` : ''}<br>${esc(m.subject || '')}
      </div>
      <div style="padding:14px 16px;font-size:15px;line-height:1.6;color:${C.ink}">${draftToHtml(text)}</div>
    </div>`);
  }

  const notes = [
    ...(d.warnings || []).filter((w) => !w.includes('verify:')),
    ...(m.issues || []).filter((i) => i.rule !== 'placeholder').map((i) => `Style check: ${i.rule} (${i.detail})`),
    ...(m.reviewer_note ? [m.reviewer_note] : []),
  ];
  if (notes.length) blocks.push(`<div style="height:14px"></div>${callout(C.navy, '#EEF2F9', 'Worth knowing before you send', notes)}`);

  const src = sourceLinks(d.sources);
  if (src) blocks.push(`<div style="margin-top:12px;font-size:13px;color:${C.muted};line-height:1.6">Built from: ${src}</div>`);

  blocks.push(`<div style="margin-top:14px;padding-top:12px;border-top:1px dashed ${C.line};font-size:12px;color:${C.muted}">
    Reply id <span style="font-family:ui-monospace,Menlo,Consolas,monospace;color:${C.ink};background:${C.quote};padding:2px 6px;border-radius:4px">${esc(m.id)}</span></div>`);

  return `<tr><td style="padding:0 0 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-radius:12px;table-layout:fixed">
      <tr><td style="padding:18px 16px 16px;font-family:${FONT};word-break:break-word;overflow-wrap:anywhere">${blocks.join('\n')}</td></tr>
    </table></td></tr>`;
}

/**
 * metas: queue metadata (reply-desk.mjs), readText(id) -> the editable draft
 * text or null. Returns { subject, html, text }.
 */
export function renderReviewEmail(metas, { readText, runUrl, now = Date.now() } = {}) {
  const order = { drafted: 0, needs_input: 1, needs_content: 2, needs_human: 3, referral: 4 };
  const items = [...metas].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.received_at).localeCompare(String(b.received_at)));
  const count = (s) => items.filter((m) => m.status === s).length;
  const ready = count('drafted');
  const blocked = items.length - ready;

  const chips = [
    ready && `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;border-radius:999px;background:${C.tealBg};color:${C.teal};font-size:13px;font-weight:700">${ready} ready to send</span>`,
    count('needs_input') && `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;border-radius:999px;background:${C.amberBg};color:${C.amber};font-size:13px;font-weight:700">${count('needs_input')} ${count('needs_input') === 1 ? 'needs' : 'need'} your numbers</span>`,
    count('needs_content') && `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;border-radius:999px;background:${C.brickBg};color:${C.brick};font-size:13px;font-weight:700">${count('needs_content')} ${count('needs_content') === 1 ? 'needs' : 'need'} your approval</span>`,
    (count('needs_human') + count('referral')) && `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;border-radius:999px;background:#E8EEF8;color:${C.navy};font-size:13px;font-weight:700">${count('needs_human') + count('referral')} for you to handle</span>`,
  ].filter(Boolean).join('');

  const how = `<div style="padding:14px 16px;border-radius:10px;background:${C.card};border:1px solid ${C.line};font-size:14px;line-height:1.6;color:${C.ink}">
    <div style="font-weight:700;margin-bottom:4px">How to send one</div>
    Tell Claude which ones to send (e.g. "send the 310 Buncombe reply"), or copy its reply id into the reply-desk workflow:
    ${runUrl ? `<a href="${esc(runUrl)}" style="color:${C.teal};font-weight:600">open Run workflow</a>, paste the id(s) into <em>send_ids</em>.` : ''}
    Replies only go out on weekdays, 8:40 to 5:20 Eastern.
  </div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Reply desk</title></head>
<body style="margin:0;padding:0;background:${C.oat}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.oat}"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;font-family:${FONT};table-layout:fixed;word-break:break-word;overflow-wrap:anywhere">
  <tr><td style="padding:22px 22px 20px;background:${C.navy};border-radius:12px 12px 0 0">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#C7D6EE;font-weight:700">GovHub reply desk</div>
    <div style="margin-top:6px;font-size:24px;line-height:1.25;color:#FFFFFF;font-weight:700">${items.length} repl${items.length === 1 ? 'y' : 'ies'} waiting on you</div>
    <div style="margin-top:4px;font-size:14px;color:#DCE6F5">Nothing below has been sent to anyone.</div>
  </td></tr>
  <tr><td style="padding:14px 0 6px">${chips}</td></tr>
  <tr><td style="padding:0 0 18px">${how}</td></tr>
  ${items.map((m) => card(m, readText ? readText(m.id) : null, now)).join('\n')}
  <tr><td style="padding:6px 4px 24px;font-size:12px;color:${C.muted};line-height:1.5;font-family:${FONT}">
    Sent by the reply desk (scripts/outreach/reply-desk.mjs). Drafts are built from SAM.gov and USASpending and written in Earl's voice; each one is checked against the style rules before it can be sent.
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `${items.length} replies waiting on you. Nothing has been sent.`,
    `${ready} ready to send, ${blocked} waiting on something from you.`,
    '',
    ...items.flatMap((m) => [
      '='.repeat(60),
      `${(STATUS[m.status]?.label || m.status).toUpperCase()}: ${m.company || m.lead} (${m.campaign || ''})`,
      m.cls?.text ? `They wrote: "${m.cls.text.replace(/\s+/g, ' ').slice(0, 300)}"` : '',
      ...(m.deliverable?.needsInput || []).map((n) => `Needs: ${INPUT_LABELS[n] || n}`),
      `id: ${m.id}`,
      '',
      readText && readText(m.id) ? assemble(readText(m.id)) : '',
      '',
    ]),
  ].join('\n');

  const subject = ready
    ? `Reply desk: ${ready} ready to send${blocked ? `, ${blocked} waiting on you` : ''}`
    : `Reply desk: ${items.length} waiting on you`;
  return { subject, html, text };
}
