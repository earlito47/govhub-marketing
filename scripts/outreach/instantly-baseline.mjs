// Instantly campaign baseline: freeze a measurement window so later copy
// changes can be compared against it on identical terms.
//
// WHY THIS EXISTS. Reply rate on its own is not comparable week to week. The
// number only means something alongside the message that produced it, the
// audience it went to, and the caps that governed volume. Wave 1's copy is
// about to change, so this captures all four together and writes them to a
// committed file. A later snapshot plus `--compare` is then an apples to
// apples read rather than two numbers remembered out of context.
//
// THE COPY FINGERPRINT IS THE POINT. Every snapshot stores a sha256 of each
// live sequence step, read back from the API rather than from this repo. That
// is what ties a reply rate to an exact message version. Two snapshots with
// the same fingerprint are the same experiment and their counts can be pooled;
// two with different fingerprints are different experiments and pooling them
// would be the error this file exists to prevent. Reading it from the API
// rather than from source also catches the case where someone edits copy here
// and never runs --sync, which has already happened once on this programme
// (see the opt-out history in instantly-influencer.mjs).
//
// DENOMINATORS ARE FIXED HERE ON PURPOSE. Reply rate is replies over CONTACTED
// (unique leads that got a first touch), never over emails_sent_count. Sends
// include follow-up steps, so as a sequence rolls out the sent count climbs
// against a fixed set of humans and a rate computed on it drifts downward for
// no reason connected to the copy. Anything reading these files should use the
// `rates` block rather than recomputing.
//
// PII: ids, addresses, statuses, counts and timestamps ONLY. Never reply
// bodies and never content_preview, matching instantly-replies.mjs. data/ is
// committed to git.
//
// Env:   INSTANTLY_API_KEY   read-scoped key
// Usage:
//   node scripts/outreach/instantly-baseline.mjs --label week1 --from 2026-09-07 --to 2026-09-11
//   node scripts/outreach/instantly-baseline.mjs --label week2 --from 2026-09-14 --to 2026-09-18
//   node scripts/outreach/instantly-baseline.mjs --compare week1 week2
//   node scripts/outreach/instantly-baseline.mjs --show week1

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

const CAMPAIGNS = {
  A: '31fc2282-4153-42f9-b8d7-94517162b47c',
  B: '61c3b5df-22b6-4f98-ae56-290a750f1833',
  C: '09189743-6310-46bd-b48f-e5ca931d7e7e',
  C1: '6f360a2e-4dee-4d75-8bd5-325162795616',
  C2: '1d2dc5a8-f7c1-4ac1-ac1a-3a382e185b4a',
  C3: 'b2ee3665-fbee-4366-b2ee-d31cc0573e8e',
  C4: 'b179df62-09f5-4045-a3e6-eb19afab4d20',
  C5: 'aceddf26-388d-45f4-be83-89eda98816a9',
  C6: '80a9659f-ba43-4411-969f-10ecfcd6b95d',
};

// Lead-level interest enum, same source of truth as instantly-replies.mjs.
// Anything >= 1 is a positive outcome; 0 is an out-of-office; negatives are
// rejections. The whole programme is judged on the >= 1 bucket.
const INTEREST = {
  '4': 'won', '3': 'meeting_completed', '2': 'meeting_booked', '1': 'interested',
  '0': 'out_of_office', '-1': 'not_interested', '-2': 'wrong_person',
  '-3': 'lost', '-4': 'no_show',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const headers = { Authorization: `Bearer ${KEY}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function allLeads(campaignId) {
  const out = [];
  let cursor = null;
  for (let i = 0; i < 40; i++) {
    const body = { limit: 100, campaign: campaignId };
    if (cursor) body.starting_after = cursor;
    const d = await api('POST', '/leads/list', body);
    const items = d.items || [];
    out.push(...items);
    cursor = d.next_starting_after;
    if (!items.length || !cursor) break;
    await sleep(400);
  }
  return out;
}

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// Fingerprint the copy AS THE SERVER HOLDS IT, not as this repo declares it.
// Whitespace is normalised so a reformat does not read as a copy change.
function fingerprintSteps(campaign) {
  const steps = campaign.sequences?.[0]?.steps || [];
  return steps.map((s, i) => ({
    step: i + 1,
    delay: s.delay,
    variants: (s.variants || []).map((v) => ({
      subject: v.subject || '',
      body_sha256: sha((v.body || '').replace(/\s+/g, ' ').trim()),
      body_words: (v.body || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length,
    })),
  }));
}

const pct = (n, d) => (d ? +((n / d) * 100).toFixed(2) : null);

async function snapshot({ label, from, to }) {
  const analytics = await api('GET', '/campaigns/analytics');
  const byId = new Map(analytics.map((a) => [a.campaign_id, a]));

  const out = {
    version: 1,
    label,
    window: { from, to },
    captured_at: new Date().toISOString(),
    // Anything reading this file should use these definitions, not its own.
    definitions: {
      contacted: 'unique leads that received a first touch (contacted_count)',
      sent: 'total emails sent including follow-up steps (emails_sent_count)',
      replies_human: 'reply_count, which excludes auto-replies',
      replies_auto: 'reply_count_automatic (out-of-office and similar)',
      positive: 'leads with lt_interest_status >= 1 (interested or better)',
      reply_rate_pct: 'replies_human / contacted, NOT over sent',
    },
    campaigns: {},
    daily: [],
    totals: {},
  };

  for (const [key, id] of Object.entries(CAMPAIGNS)) {
    const a = byId.get(id);
    const campaign = await api('GET', `/campaigns/${id}`);
    const leads = await allLeads(id);

    const interest = {};
    let positive = 0;
    for (const L of leads) {
      const s = L.lt_interest_status;
      if (s === null || s === undefined) continue;
      const bucket = INTEREST[String(s)] || `unknown_${s}`;
      interest[bucket] = (interest[bucket] || 0) + 1;
      if (Number(s) >= 1) positive++;
    }

    const contacted = a?.contacted_count ?? 0;
    out.campaigns[key] = {
      id,
      name: campaign.name,
      settings: {
        status: campaign.status,
        daily_limit: campaign.daily_limit,
        daily_max_leads: campaign.daily_max_leads,
        email_gap: campaign.email_gap,
        insert_unsubscribe_header: campaign.insert_unsubscribe_header,
        open_tracking: campaign.open_tracking,
        link_tracking: campaign.link_tracking,
        stop_on_reply: campaign.stop_on_reply,
        stop_for_company: campaign.stop_for_company,
        mailboxes: (campaign.email_list || []).length,
      },
      copy_fingerprint: fingerprintSteps(campaign),
      counts: {
        leads: a?.leads_count ?? leads.length,
        contacted,
        sent: a?.emails_sent_count ?? 0,
        bounced: a?.bounced_count ?? 0,
        replies_human: a?.reply_count ?? 0,
        replies_auto: a?.reply_count_automatic ?? 0,
        unsubscribed: a?.unsubscribed_count ?? 0,
        completed: a?.completed_count ?? 0,
        opportunities: a?.total_opportunities ?? 0,
        positive,
      },
      rates: {
        reply_rate_pct: pct(a?.reply_count ?? 0, contacted),
        positive_rate_pct: pct(positive, contacted),
        bounce_rate_pct: pct(a?.bounced_count ?? 0, contacted),
      },
      interest_distribution: interest,
    };
    await sleep(300);
  }

  const daily = await api('GET', `/campaigns/analytics/daily?start_date=${from}&end_date=${to}`);
  out.daily = daily.map((d) => ({
    date: d.date,
    sent: d.sent,
    first_touch: d.new_leads_contacted,
    follow_up: d.sent - d.new_leads_contacted,
    replies_human: d.replies - d.replies_automatic,
    replies_auto: d.replies_automatic,
  }));

  const sum = (f) => Object.values(out.campaigns).reduce((n, c) => n + f(c), 0);
  const contacted = sum((c) => c.counts.contacted);
  out.totals = {
    contacted,
    sent: sum((c) => c.counts.sent),
    bounced: sum((c) => c.counts.bounced),
    replies_human: sum((c) => c.counts.replies_human),
    replies_auto: sum((c) => c.counts.replies_auto),
    positive: sum((c) => c.counts.positive),
    unsubscribed: sum((c) => c.counts.unsubscribed),
    reply_rate_pct: pct(sum((c) => c.counts.replies_human), contacted),
    positive_rate_pct: pct(sum((c) => c.counts.positive), contacted),
    bounce_rate_pct: pct(sum((c) => c.counts.bounced), contacted),
  };
  return out;
}

const pathFor = (label) => join(ROOT, `data/instantly-baseline-${label}.json`);
const load = (label) => {
  const p = pathFor(label);
  if (!existsSync(p)) throw new Error(`no snapshot at ${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
};

function render(s) {
  console.log(`\n=== ${s.label}  (${s.window.from} .. ${s.window.to}) ===`);
  console.log('camp  contacted   sent  bounce  reply  positive  reply%  pos%   copy');
  for (const [k, c] of Object.entries(s.campaigns)) {
    const fp = (c.copy_fingerprint[0]?.variants[0]?.body_sha256 || '').slice(0, 8);
    console.log(
      `${k.padEnd(5)} ${String(c.counts.contacted).padStart(9)} ${String(c.counts.sent).padStart(6)} ` +
      `${String(c.counts.bounced).padStart(7)} ${String(c.counts.replies_human).padStart(6)} ` +
      `${String(c.counts.positive).padStart(9)} ${String(c.rates.reply_rate_pct ?? '-').padStart(6)} ` +
      `${String(c.rates.positive_rate_pct ?? '-').padStart(5)}   ${fp}`
    );
  }
  const t = s.totals;
  console.log(`TOTAL ${String(t.contacted).padStart(9)} ${String(t.sent).padStart(6)} ${String(t.bounced).padStart(7)} ` +
    `${String(t.replies_human).padStart(6)} ${String(t.positive).padStart(9)} ${String(t.reply_rate_pct).padStart(6)} ${String(t.positive_rate_pct).padStart(5)}`);
}

// Compare two snapshots. Refuses to read a delta as a copy result when the
// fingerprint did not move, and says so when the audience or caps moved too,
// because either makes the comparison something other than a copy test.
function compare(aLabel, bLabel) {
  const a = load(aLabel), b = load(bLabel);
  console.log(`\n=== ${aLabel} -> ${bLabel} ===`);
  console.log('camp  reply%           positive%        copy changed  caps changed');
  for (const k of Object.keys(a.campaigns)) {
    const ca = a.campaigns[k], cb = b.campaigns[k];
    if (!cb) continue;
    const fa = JSON.stringify(ca.copy_fingerprint.map((s) => s.variants.map((v) => v.body_sha256)));
    const fb = JSON.stringify(cb.copy_fingerprint.map((s) => s.variants.map((v) => v.body_sha256)));
    const capsA = JSON.stringify([ca.settings.daily_max_leads, ca.settings.daily_limit]);
    const capsB = JSON.stringify([cb.settings.daily_max_leads, cb.settings.daily_limit]);
    const d = (x, y) => `${String(x ?? '-').padStart(5)} -> ${String(y ?? '-').padStart(5)}`;
    console.log(
      `${k.padEnd(5)} ${d(ca.rates.reply_rate_pct, cb.rates.reply_rate_pct)}   ` +
      `${d(ca.rates.positive_rate_pct, cb.rates.positive_rate_pct)}   ` +
      `${(fa === fb ? 'NO' : 'yes').padEnd(12)}  ${capsA === capsB ? 'no' : 'YES'}`
    );
  }
  console.log('\nRead the "copy changed" column first. NO there means the delta is not a');
  console.log('copy result: same message, different week. YES under "caps changed" means');
  console.log('volume moved too, so the segments are not strictly comparable either.');
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i === -1 || i + 1 >= args.length ? fallback : args[i + 1];
};

if (args[0] === '--compare') {
  compare(args[1], args[2]);
} else if (args[0] === '--show') {
  render(load(args[1]));
} else {
  if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }
  const label = flag('--label');
  const from = flag('--from');
  const to = flag('--to');
  if (!label || !from || !to) {
    console.error('usage: --label <name> --from <YYYY-MM-DD> --to <YYYY-MM-DD>');
    process.exit(1);
  }
  const snap = await snapshot({ label, from, to });
  writeFileSync(pathFor(label), JSON.stringify(snap, null, 2) + '\n');
  render(snap);
  console.log(`\nwrote data/instantly-baseline-${label}.json`);
}
