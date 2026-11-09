// Google APIs for the weekly report, with no dependencies: a service-account
// JWT signed with node:crypto, exchanged for an access token, then plain fetch.
//
// Credentials: GSC_SERVICE_ACCOUNT_JSON (the same secret weekly-content uses).
// That account is a user on the Search Console property sc-domain:govhub.online
// and a viewer on GA4 property 542598881 ("GovHub.online").

import { createSign } from 'node:crypto';

export const GSC_SITE = process.env.GSC_PROPERTY || 'sc-domain:govhub.online';
export const GA4_PROPERTY = `properties/${process.env.GA4_PROPERTY_ID || '542598881'}`;

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/analytics.readonly'];
let cached = null;

async function token() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GSC_SERVICE_ACCOUNT_JSON is not set');
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: SCOPES.join(' '), aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`google token: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  cached = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

async function post(url, payload) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`${new URL(url).pathname}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
}

/** Search Console search analytics. dims: [] for totals, or e.g. ['page']. Pages through every row. */
export async function gscQuery({ start, end, dims = [], rowLimit = 25000, maxRows = Infinity, filters }) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`;
  const rows = [];
  for (let startRow = 0; ; startRow += rowLimit) {
    const body = { startDate: start, endDate: end, dimensions: dims, rowLimit, startRow, dataState: 'all' };
    if (filters) body.dimensionFilterGroups = [{ filters }];
    const r = await post(url, body);
    rows.push(...(r.rows ?? []));
    if (!dims.length || (r.rows ?? []).length < rowLimit || rows.length >= maxRows) break;
  }
  return rows.slice(0, maxRows);
}

/** URL Inspection: the page's index status as Google has it. */
export async function inspectUrl(url) {
  const r = await post('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: url, siteUrl: GSC_SITE });
  const s = r.inspectionResult?.indexStatusResult ?? {};
  return { coverage: s.coverageState ?? 'unknown', lastCrawl: s.lastCrawlTime ?? null };
}

/** GA4 Data API runReport; returns rows as { dims: [...], mets: [...] }. */
export async function ga4Report({ start, end, dims = [], mets, filter, limit = 1000 }) {
  const body = {
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: dims.map((name) => ({ name })),
    metrics: mets.map((name) => ({ name })),
    limit,
  };
  if (filter) body.dimensionFilter = filter;
  const r = await post(`https://analyticsdata.googleapis.com/v1beta/${GA4_PROPERTY}:runReport`, body);
  return (r.rows ?? []).map((row) => ({
    dims: (row.dimensionValues ?? []).map((d) => d.value),
    mets: (row.metricValues ?? []).map((m) => Number(m.value)),
  }));
}
