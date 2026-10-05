// Instantly API v2, the slice the reply desk needs.
//
// Transport rules are the ones instantly-replies.mjs and wave1-suppress.mjs
// already learned live: Content-Type only when there is a body (the API is
// Fastify and 400s a bodyless request that declares JSON, which reads like
// rate limiting), and custom variables come back under `payload`, not
// `custom_variables`.
//
// ONE RULE THAT IS NEW HERE: a send is never retried on a 5xx. A 5xx on
// POST /emails/reply does not prove the email was not sent, and a prospect who
// gets the same reply twice has learned exactly what we do not want them to
// learn. Only a 429, which is a refusal before any work, is retried.

const API = 'https://api.instantly.ai/api/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function instantly(key = process.env.INSTANTLY_API_KEY) {
  if (!key) throw new Error('INSTANTLY_API_KEY is not set');

  async function api(method, path, body, { retry5xx = true } = {}) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const headers = { Authorization: `Bearer ${key}` };
      if (body) headers['Content-Type'] = 'application/json';
      const res = await fetch(`${API}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (res.status === 429 || (retry5xx && res.status >= 500)) {
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 300)}`);
      return text ? JSON.parse(text) : {};
    }
    throw new Error(`${method} ${path} -> gave up after retries`);
  }

  async function pageEmails(params, max = 50) {
    const out = [];
    let cursor = null;
    for (let i = 0; i < max; i++) {
      const q = new URLSearchParams({ limit: '100', ...params });
      if (cursor) q.set('starting_after', cursor);
      const d = await api('GET', `/emails?${q}`);
      const items = d.items || [];
      out.push(...items);
      cursor = d.next_starting_after;
      // A short page is the last page. Instantly still returns a cursor on it,
      // and following that cursor on a lead-filtered list 5xxs (seen live on
      // 2026-10-04), which would fail an otherwise complete thread read.
      if (!items.length || !cursor || items.length < 100) break;
      await sleep(400);
    }
    return out;
  }

  return {
    api,

    async campaigns() {
      const d = await api('GET', '/campaigns?limit=100');
      return d.items || [];
    },

    /** Every inbound email created after `sinceIso`, oldest first. */
    async received(sinceIso) {
      const items = await pageEmails({ email_type: 'received', min_timestamp_created: sinceIso });
      return items.sort((a, b) => stamp(a).localeCompare(stamp(b)));
    },

    /** Every email exchanged with one lead, in both directions, oldest first. */
    async thread(leadEmail) {
      const items = await pageEmails({ lead: leadEmail }, 5);
      return items.sort((a, b) => stamp(a).localeCompare(stamp(b)));
    },

    /** The lead record (with its custom variables under `payload`) in one campaign. */
    async lead(email, campaignId) {
      const body = { limit: 10, contacts: [email] };
      if (campaignId) body.campaign = campaignId;
      const d = await api('POST', '/leads/list', body);
      const items = (d.items || []).filter((l) => (l.email || '').toLowerCase() === email.toLowerCase());
      return items.find((l) => !campaignId || l.campaign === campaignId) || items[0] || null;
    },

    /** Reply in-thread from the mailbox that received the lead's message. Never retried on 5xx. */
    async reply({ eaccount, replyToUuid, subject, text, html, bcc }) {
      const body = { eaccount, reply_to_uuid: replyToUuid, subject, body: { text, html } };
      if (bcc) body.bcc_address_email_list = bcc;
      return api('POST', '/emails/reply', body, { retry5xx: false });
    },
  };
}

export const stamp = (e) => e.timestamp_email || e.timestamp_created || '';

/** ue_type 2 is inbound; everything else (1 campaign send, 3 manual) is us. */
export const isInbound = (e) => Number(e.ue_type) === 2;
