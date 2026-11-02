// Which people we emailed came to the site, and came back.
//
// Links we email to one person carry gh_lid=<Instantly lead id> (the reply
// desk stamps them: scripts/outreach/reply-desk/links.mjs). The site keeps the
// id in a first-party cookie and attaches it to that browser's PostHog events
// (src/components/LeadLink.astro, src/components/Analytics.astro). This reads
// those events back and turns each id into the lead's name and company.
//
// Output goes to the terminal only. It names people, so do not commit it or
// paste it anywhere shared (same rule as data/reply-desk.json, which holds ids
// and statuses only).
//
// Env:   POSTHOG_PERSONAL_API_KEY   query:read on the GovHub project
//        INSTANTLY_API_KEY          leads:read, campaigns:read
//        POSTHOG_PROJECT_ID         optional; default: the key's first project
//
// Usage: node scripts/outreach/lead-visits.mjs [--days=90]

const PH_HOST = 'https://us.posthog.com';
const IX = 'https://api.instantly.ai/api/v2';
const days = Number((process.argv.find((a) => a.startsWith('--days=')) || '--days=90').split('=')[1]) || 90;

for (const k of ['POSTHOG_PERSONAL_API_KEY', 'INSTANTLY_API_KEY']) {
  if (!process.env[k]) { console.error(`${k} is not set`); process.exit(1); }
}

async function ph(path, body) {
  const res = await fetch(`${PH_HOST}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PostHog ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function ix(path) {
  const res = await fetch(`${IX}${path}`, { headers: { Authorization: `Bearer ${process.env.INSTANTLY_API_KEY}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Instantly ${path}: HTTP ${res.status}`);
  return res.json();
}

const projectId = process.env.POSTHOG_PROJECT_ID || (await ph('/api/projects/')).results?.[0]?.id;
if (!projectId) { console.error('no PostHog project visible to this key'); process.exit(1); }

// One row per lead id: visits are distinct sessions, so a return visit is
// sessions > 1. "reached the app" means this browser also loaded
// app.govhub.online (signup, sign-in), joined on PostHog's anonymous id.
const query = `
  with lead_events as (
    select properties.gh_lid as lid, distinct_id, timestamp, properties.$session_id as sid,
           properties.$pathname as path, event
      from events
     where timestamp > now() - interval ${days} day
       and properties.gh_lid is not null and properties.gh_lid != ''
  ),
  app_ids as (
    select distinct distinct_id from events
     where timestamp > now() - interval ${days} day and properties.$host = 'app.govhub.online'
  )
  select lid,
         count(distinct sid) as visits,
         countIf(event = '$pageview') as pageviews,
         min(timestamp) as first_seen,
         max(timestamp) as last_seen,
         groupUniqArray(10)(path) as pages,
         max(distinct_id in (select distinct_id from app_ids)) as reached_app
    from lead_events
   group by lid
   order by last_seen desc`;

const result = await ph(`/api/projects/${projectId}/query/`, { query: { kind: 'HogQLQuery', query } });
const rows = (result.results || []).map((r) => Object.fromEntries(result.columns.map((c, i) => [c, r[i]])));

if (!rows.length) {
  console.log(`No visits from per-recipient links in the last ${days} days.`);
  process.exit(0);
}

const campaigns = new Map(((await ix('/campaigns?limit=100'))?.items || []).map((c) => [c.id, c.name]));

console.log(`Visits from per-recipient email links, last ${days} days (${rows.length} leads)\n`);
for (const r of rows) {
  const lead = /^[A-Za-z0-9-]{36}$/.test(r.lid) ? await ix(`/leads/${r.lid}`) : null;
  const who = lead
    ? `${[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '(no name)'} <${lead.email}>, ${lead.company_name || '(no company)'}, ${campaigns.get(lead.campaign) || 'no campaign'}`
    : `${r.lid} (not an Instantly lead id, or the lead was deleted)`;
  const back = r.visits > 1 ? `came back: ${r.visits} visits` : '1 visit';
  console.log(`- ${who}`);
  console.log(`  ${back}, ${r.pageviews} pages, first ${String(r.first_seen).slice(0, 10)}, last ${String(r.last_seen).slice(0, 10)}${r.reached_app ? ', reached the app' : ''}`);
  console.log(`  pages: ${(r.pages || []).filter(Boolean).join(', ')}`);
}
