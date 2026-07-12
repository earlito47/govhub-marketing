// USAspending API v2 client — no API key required.
//
// Verification status (2026-07-12): checked against both the canonical API
// contracts in fedspendingtransparency/usaspending-api
// (usaspending_api/api_contracts/contracts/v2/) and live curl calls to
// api.usaspending.gov. Endpoint paths, spending_over_time/spending_by_award/
// spending_by_award_count/toptier_agencies shapes, and spending_by_award
// field names all matched the contracts verbatim and returned real data live.
//
// Two things the first (offline) draft guessed were adjusted to match the
// documented contract, even though live testing showed the deployed API
// currently accepts both forms (it's more lenient than the docs — the old
// forms return identical results to the new ones):
//   - `spending_by_category`'s `category` path segment doc'd enum has no
//     plain "recipient" (it's `recipient_duns` / `recipient_parent_duns`);
//     "recipient" happens to work today as an undocumented alias but isn't
//     something to depend on.
//   - `naics_codes` in AdvancedFilterObject is documented as a NAICSCodeObject
//     ({ require: [...], exclude: [...] }); a bare array of code strings also
//     works today but isn't the contract shape.
// Using the documented forms here since undocumented aliases are the kind of
// thing that gets removed without notice.

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
   * Verified against the API contract: POST
   * /api/v2/search/spending_by_category/{category}/ with `category` as a URL
   * path segment, not a body field.
   * category ∈ awarding_agency | awarding_subagency | cfda | country | county |
   *            defc | district | federal_account | funding_agency |
   *            funding_subagency | naics | object_class | program_activity |
   *            psc | recipient_duns | recipient_parent_duns |
   *            state_territory | tas
   * (there is no plain "recipient" category — use recipient_duns.)
   */
  async spendingByCategory(category, filters, { limit = 10, page = 1 } = {}) {
    return this._request(`/api/v2/search/spending_by_category/${category}/`, {
      body: { filters, limit, page },
    });
  }

  /**
   * Verified. group ∈ calendar_year | fiscal_year | quarter | month.
   * Response: { results: [{ time_period: { fiscal_year: "2021", ... },
   *                          aggregated_amount: number, ... }, ...] }
   */
  async spendingOverTime({ group = 'fiscal_year', filters }) {
    return this._request('/api/v2/search/spending_over_time/', {
      body: { group, filters },
    });
  }

  /**
   * Verified against the contract's own worked example body. `fields` must be
   * chosen from USAspending's allowed field list for the award-type family
   * being queried (base fields: Award ID, Recipient Name, Awarding Agency,
   * Awarding Sub Agency, Description, generated_internal_id, etc.; contract-
   * specific: Start Date, End Date, Award Amount, NAICS, PSC, ...). An
   * unrecognized field name is a 422 from the API, not a silent wrong value.
   */
  async spendingByAward({ filters, fields, sort, order = 'desc', limit = 25, page = 1, subawards = false }) {
    return this._request('/api/v2/search/spending_by_award/', {
      body: { filters, fields, sort, order, limit, page, subawards },
    });
  }

  /**
   * Verified. Response: { results: { grants, loans, contracts,
   * direct_payments, other, idvs } }. With award_type_codes restricted to
   * A/B/C/D (definitive contracts only, no IDVs), `results.contracts` is the
   * award count for our filter set.
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
