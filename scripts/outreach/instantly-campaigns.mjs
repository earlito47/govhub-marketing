// Every live GovHub Instantly campaign, and a read-only way to list every lead
// in one.
//
// ONE MAP, NOT THREE. instantly-replies.mjs, instantly-baseline.mjs and
// reply-desk/playbooks.mjs each used to carry their own copy, and only the
// reply desk's knew about the four angle campaigns. Until 2026-11-04 the
// conversion job and the weekly baseline never read A1-A5, which held 6,625 of
// the programme's 7,413 leads on 2026-11-04 and 28 of the workspace's 32 leads
// with lt_interest_status >= 1 on 2026-11-03. A campaign added here is picked up by
// all three.
//
// KEYS. A1 A2 A4 A5 are the angle campaigns (there is no A3), C1-C6 the
// influencer programme, W1A W1B W1C wave 1. Wave 1 was keyed A, B, C until
// 2026-11-04, one character away from the angle names. Snapshots written before
// then still say A/B/C, so anything reading one back matches on campaign id
// (CAMPAIGN_KEY_BY_ID), never on the stored key.
//
// Scripts that work on one programme (push-leads.mjs, wave1-suppress.mjs,
// wave1-display-names.mjs, blank-field-followups.mjs) still carry their own
// subset maps.

const API = 'https://api.instantly.ai/api/v2';

export const CAMPAIGNS = Object.freeze({
  // Angle campaigns, built by instantly-angles.mjs.
  A1: 'a4df9870-2d9d-49a1-8548-d1fa3b0599b7', // GH-A1-Recompete
  A2: 'c977a531-a8e5-47d3-b27b-5f8aacfab33b', // GH-A2-MatchedRFP
  A4: '39bc9fab-a9a7-4ed6-b34c-ccabeb9e76ee', // GH-A4-CompetitorWon
  A5: '9d7ca37a-cfba-4519-a9df-88d6ca0f448a', // GH-A5-DebriefPain
  // Influencer programme, built by instantly-influencer.mjs --sync.
  C1: '6f360a2e-4dee-4d75-8bd5-325162795616', // GovHub Influencer - C1 creators
  C2: '1d2dc5a8-f7c1-4ac1-ac1a-3a382e185b4a', // GovHub Influencer - C2 podcasts and newsletters
  C3: 'b2ee3665-fbee-4366-b2ee-d31cc0573e8e', // GovHub Influencer - C3 media and blogs
  C4: 'b179df62-09f5-4045-a3e6-eb19afab4d20', // GovHub Influencer - C4 consultants
  C5: 'aceddf26-388d-45f4-be83-89eda98816a9', // GovHub Influencer - C5 APEX advisors
  C6: '80a9659f-ba43-4411-969f-10ecfcd6b95d', // GovHub Influencer - C6 associations
  // Wave 1, built by instantly-wave1.mjs. Keyed A/B/C before 2026-11-04.
  W1A: '31fc2282-4153-42f9-b8d7-94517162b47c', // GovHub Wave 1 - A serial_bidder
  W1B: '61c3b5df-22b6-4f98-ae56-290a750f1833', // GovHub Wave 1 - B new_prime
  W1C: '09189743-6310-46bd-b48f-e5ca931d7e7e', // GovHub Wave 1 - C registered_no_awards
});

/** id -> key, for anything that starts from a campaign id (an inbound email, a stored snapshot). */
export const CAMPAIGN_KEY_BY_ID = Object.freeze(
  Object.fromEntries(Object.entries(CAMPAIGNS).map(([key, id]) => [id, key])),
);

// Instantly allows 20 requests a minute. 3.2 s apart is 18.75 a minute, the
// figure strata-parse outreach-metrics settled on. instantly-replies.mjs used
// to page at 600 ms with no retry, which only held while it read 788 leads;
// 7,413 is about 80 pages, and a 429 there dropped a whole campaign from the
// count with one line on stderr.
export const PACE_MS = 3200;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// leads/list is a read that takes its filter as a POST body, and it is the only
// POST these jobs make. Everything else that is not a GET is refused, so
// "read-only toward Instantly" is a property of the client, not a convention
// each caller has to remember.
const READ_POSTS = new Set(['/leads/list']);

/** A read-only Instantly API v2 caller. Retries 429 and 5xx, which is safe because nothing it sends changes anything. */
export function readOnlyApi(key) {
  return async function api(method, path, body) {
    if (method !== 'GET' && !(method === 'POST' && READ_POSTS.has(path))) {
      throw new Error(`read-only Instantly client: refusing ${method} ${path}`);
    }
    // Content-Type only when there is a body. The API is Fastify, which 400s a
    // bodyless request that declares JSON, and that 400 reads like rate limiting.
    const headers = { Authorization: `Bearer ${key}` };
    if (body) headers['Content-Type'] = 'application/json';
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${API}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (res.ok) return text ? JSON.parse(text) : {};
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= 4) {
        throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 300)}`);
      }
      // The limit is per minute, so a short wait only spends another request
      // proving the same point. Honour Retry-After when the server sends one.
      const ra = Number(res.headers.get('retry-after') ?? '');
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 30_000) : Math.max(PACE_MS, 4000 * (attempt + 1)));
    }
  };
}

// NO PAGE CAP. Both callers used to stop after 40 pages (4,000 leads) and
// return what they had, so a campaign past that would have been read as if its
// tail did not exist. A2 held 2,828 leads on 2026-11-04 and A5 1,830, both
// still filling. The loop now ends only when Instantly says the list ended.
// What it still guards against is the API looping: a repeated cursor, or a page
// count no campaign here could reach, throws rather than returning a partial
// list that would be counted as complete.
const PAGE = 100;
const RUNAWAY_PAGES = 1000; // 100,000 leads

/** Every lead in one campaign, paged with the {limit, campaign, starting_after} shape proven live. */
export async function allLeads(api, campaignId, { pauseMs = PACE_MS } = {}) {
  const out = [];
  const seen = new Set();
  let cursor = null;
  for (let page = 1; ; page++) {
    if (page > RUNAWAY_PAGES) {
      throw new Error(`leads/list ${campaignId}: still paging after ${RUNAWAY_PAGES} pages, refusing to go on`);
    }
    const body = { limit: PAGE, campaign: campaignId };
    if (cursor) body.starting_after = cursor;
    const d = await api('POST', '/leads/list', body);
    const items = d.items || [];
    out.push(...items);
    cursor = d.next_starting_after;
    if (!items.length || !cursor) return out;
    if (seen.has(cursor)) throw new Error(`leads/list ${campaignId}: cursor repeated on page ${page}`);
    seen.add(cursor);
    await sleep(pauseMs);
  }
}

// Status 1 is active, 2 paused. A completed or draft campaign that is not in
// the map is left alone; an active one is how the angle campaigns went unread.
const LIVE_STATUSES = new Set([1, 2]);
const LOOKS_GOVHUB = /^(GH-|GovHub\b)/i;

/** Active or paused workspace campaigns that look like GovHub's but are not in CAMPAIGNS. */
export async function untrackedCampaigns(api) {
  const out = [];
  let cursor = null;
  for (let page = 1; page <= 20; page++) {
    const q = new URLSearchParams({ limit: String(PAGE) });
    if (cursor) q.set('starting_after', cursor);
    const d = await api('GET', `/campaigns?${q}`);
    const items = d.items || [];
    for (const c of items) {
      if (LOOKS_GOVHUB.test(c.name || '') && LIVE_STATUSES.has(Number(c.status)) && !CAMPAIGN_KEY_BY_ID[c.id]) {
        out.push({ id: c.id, name: c.name, status: c.status });
      }
    }
    cursor = d.next_starting_after;
    // A short page is the last one. Instantly still returns a cursor on it.
    if (items.length < PAGE || !cursor) break;
    await sleep(PACE_MS);
  }
  return out;
}
