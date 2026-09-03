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

// The trailing delays are deliberate cool-downs, not ordinary retries.
//
// The earlier read of this — a "~3.5 minute sustained-rate cutoff" — did not
// survive more runs. USAspending's edge drops connections (UND_ERR_SOCKET,
// "other side closed") at an unpredictable point, not a fixed elapsed time:
// 2026-08-17 died 3.8 minutes in, but 2026-08-10 queried happily for 22
// minutes (all NAICS, agencies, states, ~130 vendors) before hitting the same
// wall, and the two clean runs before that queried for 14 and 22 minutes.
// Rate isn't the variable either — the drop happens at 2.5 req/s just as it
// did at 12 req/s.
//
// What IS consistent: both August failures died exactly 260s after their last
// success — the full old ladder (1+4+15+60+180), every attempt burnt. So the
// outages outlast 4.3 minutes. The ladder now spans ~9.3 minutes — over twice
// the only outage length we can actually measure — before giving up.
//
// It deliberately stops there rather than growing to cover every conceivable
// outage: a retry sleep holds its concurrency slot, so a longer ladder stalls
// the whole run. Anything that outlasts 9.3 minutes is handled a level up, by
// the workflow re-running the pipeline against the on-disk response cache
// (see weekly-insights.yml) — restarting is cheap because the cache makes it
// resume, so the ladder covers short outages and the retry loop covers long
// ones.
const RETRY_DELAYS_MS = [1000, 4000, 15000, 60000, 180000, 300000];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// A status the API will answer identically however many times we ask — a
// malformed filter, a missing record, a rejected field. Retrying one is pure
// dead time, and the ladder above makes it 9.3 minutes of it.
//
// This distinction existed before but did not work: the throw for a
// non-retryable status sat inside the same `try` as the fetch, so the `catch`
// below swallowed it and retried anyway. RETRYABLE_STATUS never actually
// prevented a retry. That is what made daily-vendor-publish spend ~10 minutes
// a day, for eight days, re-asking USAspending about a vendor whose
// recipient_id was null and getting the same 400 seven times.
class PermanentHttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'PermanentHttpError';
    this.status = status;
    this.permanent = true;
  }
}
export { PermanentHttpError };

// --- Concurrency limiter: max in-flight + minimum spacing between starts.
// Defaults keep sustained load ~2.5 req/s (the 3/250ms of the first weeks
// peaked near 12 req/s, which is what tripped the edge's cutoff). Raise via
// env only if USAspending demonstrably tolerates it.
class RateLimiter {
  constructor({ concurrency = 2, spacingMs = 400 } = {}) {
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
  constructor({
    fetchImpl = fetch,
    concurrency = Number(process.env.INSIGHTS_HTTP_CONCURRENCY ?? 2),
    spacingMs = Number(process.env.INSIGHTS_HTTP_SPACING_MS ?? 400),
    onRequest,
  } = {}) {
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
          const text = await safeText(res);
          const message = `USAspending ${method} ${path} failed: ${res.status} ${text}`.slice(0, 500);
          if (!RETRYABLE_STATUS.has(res.status)) throw new PermanentHttpError(message, res.status);
          throw new Error(message);
        }
        return await res.json();
      } catch (err) {
        // Rethrown, not retried: asking again cannot change the answer.
        if (err instanceof PermanentHttpError) throw err;
        lastErr = err;
        if (attempt < RETRY_DELAYS_MS.length) {
          const delayMs = RETRY_DELAYS_MS[attempt];
          // Say what is being waited on. Retries used to be silent, which is
          // why a permanent 400 read as an unexplained multi-minute stall in
          // the logs for weeks instead of as an error.
          console.warn(
            `[usaspending] ${method} ${path} — attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1} failed ` +
              `(${String(err.message).slice(0, 140)}); retrying in ${delayMs / 1000}s`
          );
          await sleep(delayMs);
          continue;
        }
      }
    }
    // Name the request in the failure: both 2026-08 weekly crashes logged a
    // bare "fetch failed" that hid WHICH call died, slowing diagnosis.
    throw new Error(`USAspending ${method} ${path} failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastErr?.message ?? 'no response'}`, {
      cause: lastErr,
    });
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

  /**
   * Verified live (2026-07-30): GET /api/v2/recipient/duns/{recipient_id}/
   * returns { name, alternate_names, uei, duns, recipient_level, parents,
   * business_types, location, ... }. Despite the legacy "duns" path segment,
   * the id is the recipient hash (uuid-C/-P/-R) that spending_by_category
   * recipient_duns rows carry as `recipient_id`.
   */
  async recipientProfile(recipientId) {
    return this._request(`/api/v2/recipient/duns/${encodeURIComponent(recipientId)}/`, { method: 'GET' });
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
