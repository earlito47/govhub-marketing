// USAspending API v2 client — no API key required.
//
// Verification status (2026-07-12): this session's outbound network policy
// blocks every external host, including api.usaspending.gov and the docs site
// itself (confirmed via the proxy status endpoint — even example.com was
// denied), so the endpoints below could NOT be checked live against
// https://api.usaspending.gov/docs/endpoints/ as the spec requires. They are
// implemented from the request/response shapes given verbatim in the build
// spec (Section 4.1) plus long-standing, stable public documentation for this
// specific API. Each function below states its confidence. Before this file
// is trusted for a real weekly run, execute it once via `workflow_dispatch`
// (GitHub Actions runners have full internet) and diff the response shapes
// against what's assumed here — treat that first run as the real
// verification step the spec asked for.

const BASE_URL = 'https://api.usaspending.gov';

const RETRY_DELAYS_MS = [1000, 4000, 15000];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// --- Concurrency limiter: max 3 in flight, 250ms minimum spacing between starts ---
class RateLimiter {
  constructor({ concurrency = 3, spacingMs = 250 } = {}) {
    this.concurrency = concurrency;
    this.spacingMs = spacingMs;
    this.active = 0;
    this.queue = [];
    this.nextStartAt = 0;
  }

  run(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._drain();
    });
  }

  _drain() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      this.active += 1;
      const now = Date.now();
      const startAt = Math.max(now, this.nextStartAt);
      this.nextStartAt = startAt + this.spacingMs;
      setTimeout(() => this._execute(item), Math.max(0, startAt - now));
    }
  }

  async _execute(item) {
    try {
      item.resolve(await item.fn());
    } catch (err) {
      item.reject(err);
    } finally {
      this.active -= 1;
      this._drain();
    }
  }
}

export class UsaSpendingClient {
  constructor({ fetchImpl = fetch, concurrency = 3, spacingMs = 250, onRequest } = {}) {
    this.fetchImpl = fetchImpl;
    this.limiter = new RateLimiter({ concurrency, spacingMs });
    this.requestCount = 0;
    this.onRequest = onRequest;
  }

  async _request(path, { method = 'POST', body } = {}) {
    return this.limiter.run(() => this._requestWithRetry(path, { method, body }));
  }

  async _requestWithRetry(path, { method, body }) {
    let lastErr;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        this.requestCount += 1;
        this.onRequest?.({ path, method, attempt });
        const res = await this.fetchImpl(`${BASE_URL}${path}`, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          if (RETRYABLE_STATUS.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
            await sleep(RETRY_DELAYS_MS[attempt]);
            continue;
          }
          const text = await safeText(res);
          throw new Error(`USAspending ${method} ${path} failed: ${res.status} ${text}`.slice(0, 500));
        }
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
      }
    }
    throw lastErr ?? new Error(`USAspending ${method} ${path} failed with no response`);
  }

  /**
   * Confidence: HIGH. Matches the spec's own worked example verbatim
   * (Section 4.1): POST /api/v2/search/spending_by_category/{category}/
   * with `category` as a URL path segment, not a body field.
   * category ∈ awarding_agency | funding_agency | recipient | naics | psc |
   *            state_territory | county | district | cfda | federal_account
   */
  async spendingByCategory(category, filters, { limit = 10, page = 1 } = {}) {
    return this._request(`/api/v2/search/spending_by_category/${category}/`, {
      body: { filters, limit, page },
    });
  }

  /**
   * Confidence: HIGH. group ∈ fiscal_year | quarter | month.
   * Response: { results: [{ time_period: { fiscal_year: "2021", ... },
   *                          aggregated_amount: number }, ...] }
   */
  async spendingOverTime({ group = 'fiscal_year', filters }) {
    return this._request('/api/v2/search/spending_over_time/', {
      body: { group, filters },
    });
  }

  /**
   * Confidence: MEDIUM-HIGH. `fields` must be chosen from USAspending's
   * allowed field list for the award-type family being queried; the contract
   * field names below (Award ID / Recipient Name / Award Amount / Start Date /
   * End Date / Awarding Agency / Awarding Sub Agency / Description /
   * generated_internal_id) match long-standing published examples. Confirm on
   * first live run — an unrecognized field name is a 422 from the API, not a
   * silent wrong value, so this fails loudly rather than corrupting data.
   */
  async spendingByAward({ filters, fields, sort, order = 'desc', limit = 25, page = 1, subawards = false }) {
    return this._request('/api/v2/search/spending_by_award/', {
      body: { filters, fields, sort, order, limit, page, subawards },
    });
  }

  /**
   * Confidence: HIGH. Response: { results: { contracts, idvs, loans, grants,
   * direct_payments, other } }. With award_type_codes restricted to A/B/C/D
   * (definitive contracts only, no IDVs), `results.contracts` is the award
   * count for our filter set.
   */
  async spendingByAwardCount(filters) {
    return this._request('/api/v2/search/spending_by_award_count/', { body: filters ? { filters } : {} });
  }

  /**
   * Confidence: HIGH. GET, not filtered by time_period — returns the current
   * canonical top-tier agency reference list (agency_name, toptier_code, ...).
   * Not needed for the NAICS pilot; included for the upcoming agency pages.
   */
  async toptierAgencies() {
    return this._request('/api/v2/references/toptier_agencies/', { method: 'GET' });
  }
}

export const CONTRACT_AWARD_TYPE_CODES = ['A', 'B', 'C', 'D'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '<no body>';
  }
}
