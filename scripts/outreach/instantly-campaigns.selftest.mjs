// Network-free self-test for instantly-campaigns.mjs: the campaign map the
// conversion job, the baseline and the reply desk share, and the pager and
// read-only client both Instantly jobs read through.
// Run: node scripts/outreach/instantly-campaigns.selftest.mjs

import assert from 'node:assert/strict';
import { CAMPAIGNS, CAMPAIGN_KEY_BY_ID, readOnlyApi, allLeads, untrackedCampaigns } from './instantly-campaigns.mjs';
import { PLAYBOOKS } from './reply-desk/playbooks.mjs';

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

console.log('campaign map');

// The reply desk's routing table as it stood before the maps were merged.
// Every inbound reply is routed through this, so a changed id or key here
// sends someone's yes to the wrong playbook.
const ROUTING = {
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
await test('all 13 GovHub campaigns, routed exactly as the reply desk routed them', () => assert.deepEqual({ ...CAMPAIGN_KEY_BY_ID }, ROUTING));
await test('ids are unique, so the inverse map loses nothing', () => assert.equal(new Set(Object.values(CAMPAIGNS)).size, Object.keys(CAMPAIGNS).length));
await test('no bare A/B/C key to confuse wave 1 with the angles', () => { for (const k of ['A', 'B', 'C']) assert.ok(!(k in CAMPAIGNS), `key ${k}`); });
await test('every campaign has a reply-desk playbook', () => { for (const k of Object.keys(CAMPAIGNS)) assert.ok(PLAYBOOKS[k], `missing playbook ${k}`); });
await test('the map is frozen', () => assert.ok(Object.isFrozen(CAMPAIGNS) && Object.isFrozen(CAMPAIGN_KEY_BY_ID)));

console.log('allLeads');

/** A fake leads/list: `total` leads in pages of 100, cursor on every non-empty page like the real one. */
function pagedApi(total, { cursorFor = (n) => `c${n}` } = {}) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    const start = body.starting_after ? Number(body.starting_after.slice(1)) : 0;
    const items = Array.from({ length: Math.max(0, Math.min(100, total - start)) }, (_, i) => ({ email: `l${start + i}@x.test` }));
    return { items, next_starting_after: items.length ? cursorFor(start + items.length) : undefined };
  };
  return { api, calls };
}

await test('reads past the old 40-page cap (4,500 leads)', async () => {
  const { api } = pagedApi(4500);
  const leads = await allLeads(api, 'camp', { pauseMs: 0 });
  assert.equal(leads.length, 4500);
  assert.equal(new Set(leads.map((l) => l.email)).size, 4500);
});
await test('A2-sized campaign (2,828) comes back whole', async () => {
  const { api } = pagedApi(2828);
  assert.equal((await allLeads(api, 'camp', { pauseMs: 0 })).length, 2828);
});
await test('sends {limit, campaign, starting_after} and nothing else', async () => {
  const { api, calls } = pagedApi(150);
  await allLeads(api, 'camp-1', { pauseMs: 0 });
  assert.deepEqual(calls.map((c) => [c.method, c.path]), [['POST', '/leads/list'], ['POST', '/leads/list'], ['POST', '/leads/list']]);
  assert.deepEqual(calls[0].body, { limit: 100, campaign: 'camp-1' });
  assert.deepEqual(calls[1].body, { limit: 100, campaign: 'camp-1', starting_after: 'c100' });
});
await test('stops when no cursor comes back', async () => {
  const api = async () => ({ items: [{ email: 'a@x.test' }] });
  assert.equal((await allLeads(api, 'camp', { pauseMs: 0 })).length, 1);
});
await test('a repeated cursor throws instead of looping or returning a partial list', async () => {
  const { api } = pagedApi(1000, { cursorFor: () => 'c100' });
  await assert.rejects(allLeads(api, 'camp', { pauseMs: 0 }), /cursor repeated/);
});

console.log('readOnlyApi');

const realFetch = globalThis.fetch;
try {
  await test('refuses every write before any request is made', async () => {
    globalThis.fetch = async () => { throw new Error('fetch must not be called'); };
    const api = readOnlyApi('k');
    for (const [m, p] of [['POST', '/leads'], ['POST', '/leads/move'], ['PATCH', '/leads/x'], ['DELETE', '/leads/x'],
      ['POST', '/campaigns/x/activate'], ['POST', '/campaigns/x/pause'], ['PATCH', '/campaigns/x'], ['POST', '/emails/reply']]) {
      await assert.rejects(api(m, p, {}), /read-only Instantly client: refusing/, `${m} ${p}`);
    }
  });
  await test('GET has no Content-Type, leads/list does', async () => {
    const seen = [];
    globalThis.fetch = async (url, init) => { seen.push(init.headers); return new Response('{}', { status: 200 }); };
    const api = readOnlyApi('k');
    await api('GET', '/campaigns/analytics');
    await api('POST', '/leads/list', { limit: 1 });
    assert.equal(seen[0]['Content-Type'], undefined);
    assert.equal(seen[1]['Content-Type'], 'application/json');
  });
  await test('a 429 is waited out and retried, honouring Retry-After', async () => {
    let n = 0;
    globalThis.fetch = async () => (++n < 3
      ? new Response('slow down', { status: 429, headers: { 'retry-after': '0.01' } })
      : new Response('{"items":[]}', { status: 200 }));
    assert.deepEqual(await readOnlyApi('k')('POST', '/leads/list', {}), { items: [] });
    assert.equal(n, 3);
  });
  await test('a 401 fails at once', async () => {
    let n = 0;
    globalThis.fetch = async () => { n++; return new Response('no', { status: 401 }); };
    await assert.rejects(readOnlyApi('k')('GET', '/campaigns'), /-> 401/);
    assert.equal(n, 1);
  });
} finally {
  globalThis.fetch = realFetch;
}

console.log('untrackedCampaigns');

await test('flags a live GovHub campaign missing from the map, and nothing else', async () => {
  const api = async () => ({
    items: [
      { id: CAMPAIGNS.A2, name: 'GH-A2-MatchedRFP', status: 1 },
      { id: 'new-1', name: 'GH-A6-Something', status: 1 },
      { id: 'new-2', name: 'GovHub Wave 2 - A', status: 2 },
      { id: 'old-1', name: 'GovHub New Users', status: 3 },
      { id: 'draft', name: 'GH-A7-Draft', status: 0 },
      { id: 'ek-1', name: 'EK-B1-FounderProductHire', status: 1 },
    ],
    next_starting_after: 'cursor-on-a-short-page',
  });
  assert.deepEqual((await untrackedCampaigns(api)).map((c) => c.id), ['new-1', 'new-2']);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
