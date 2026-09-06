// Site-wide configuration constants.
//
// Kept in one place so cross-cutting values (canonical host, the app boundary,
// contact address, and the homepage primary keyword) are single-sourced rather
// than scattered across pages.

/** Canonical marketing host. The Astro site owns marketing at www.govhub.online. */
export const SITE_URL = 'https://www.govhub.online';

/**
 * The product app lives on its own subdomain, separate from this marketing site.
 * All "Start free trial" / "Sign in" CTAs route through APP_URL so the app
 * boundary can move without touching page markup.
 * Confirmed app routes: signup = /signup, sign-in = /auth (there is no /login).
 */
export const APP_URL = 'https://app.govhub.online';
export const SIGNUP_URL = `${APP_URL}/signup`;
export const SIGNIN_URL = `${APP_URL}/auth`;

/** Primary contact address. {{VERIFY: real inbound address}} */
export const CONTACT_EMAIL = 'hello@govhub.online';

/** Calendly booking page — powers the site-wide "Book a Demo" badge widget. */
export const CALENDLY_URL = 'https://calendly.com/earljknight/30min';

/**
 * Homepage H1 / primary keyword — the #1 term on the "VALIDATE IN AHREFS" list.
 * Volume/KD are unconfirmed (keyword APIs are plan-gated), so this is isolated
 * as a ONE-LINE swap: the homepage <h1>, its <title>/description primary term,
 * and its SoftwareApplication schema all resolve through PRIMARY_KEYWORD — the
 * primary string is never hand-typed elsewhere on the homepage.
 *
 * POST-VALIDATION SWAP: if Ahrefs shows the difficulty of `primary` is
 * prohibitive (KD > ~40 with entrenched enterprise domains owning the SERP),
 * change `h1` and `primary` to the `fallback` value below. That is the only
 * edit required — no template or layout changes.
 */
export const PRIMARY_KEYWORD = {
  // h1 leads with the exact primary phrase but reads as a pitch, not a label.
  // title stays pure exact-match — the two are deliberately decoupled.
  h1: 'Government proposal software that wins you more contracts',
  // 50–60 chars incl. spaces — the SERP-title sweet spot SEO tools check for.
  title: 'AI-powered government proposal software & RFP tools | GovHub',
  primary: 'government proposal software',
  fallback: 'government proposal software for small business',
};

export const TRIAL_DAYS = 14;

/**
 * Social profile URLs — rendered in the Footer and emitted as Organization
 * `sameAs` schema. Empty until real profiles exist: nothing renders and no
 * schema entry is emitted, so this is safe to ship blank. Add entries like
 * { label: 'LinkedIn', href: 'https://www.linkedin.com/company/…' }.
 */
export const SOCIAL_LINKS: { label: string; href: string }[] = [];

/**
 * PostHog project token. Hardcoded for exactly the reason GA_MEASUREMENT_ID is
 * (see BaseLayout.astro): this Pages project has a wrangler.jsonc, which makes
 * the Wrangler file the source of truth and stops Cloudflare passing dashboard
 * plain-text variables into `astro build`. A PUBLIC_ env var here would resolve
 * to undefined at build time and ship a site with no PostHog, silently, exactly
 * as happened to GA4 for 64 days.
 *
 * The token is a PUBLIC write key: it already ships in app.govhub.online's
 * client bundle. It must stay byte-identical to VITE_POSTHOG_PROJECT_TOKEN in
 * the strata-parse repo. PostHog derives its persistence cookie name from the
 * token, so a single changed character silently splits the cookie jar and the
 * www -> app identity hop stops working with no error anywhere.
 */
export const POSTHOG_TOKEN = 'phc_u3gkdhaBscpwh8gHkmeB55Pmdn7DfahaYYZPikGKvZ4b';
export const POSTHOG_API_HOST = 'https://us.i.posthog.com';

/**
 * Cookie domain shared by www.govhub.online and app.govhub.online. Leading dot
 * for old-user-agent tolerance. Every cookie this site writes for attribution
 * uses it, so the app can read the record without a URL round-trip.
 */
export const COOKIE_DOMAIN = '.govhub.online';

/**
 * Build a CTA URL into the app that records WHICH on-site surface produced the
 * click without touching campaign attribution.
 *
 * This replaces the hardcoded `?utm_source=insights` / `?utm_source=glossary` /
 * `?utm_source=faq` hrefs. Those were an attribution bug: a visitor arriving
 * from `?utm_source=google&utm_medium=cpc&gclid=...`, landing on an insights
 * page and clicking the CTA handed the app `utm_source=insights`. GA4 treats a
 * utm_* param on the URL as authoritative and re-attributes the session, so the
 * paid click was laundered into "insights" and the ad that bought the customer
 * got no credit. It also restarts the GA4 session on the www -> app hop, which
 * double-counts one human as two sessions.
 *
 * `gh_cta` is deliberately NOT a utm_* key. GA4 and PostHog ignore it for source
 * attribution, so it can never displace the real campaign, and it is still there
 * in the app's URL and in PostHog event properties when you want to know which
 * surface converted.
 */
export function ctaHref(placement: string, path = '/signup'): string {
  return `${APP_URL}${path}?gh_cta=${encodeURIComponent(placement)}`;
}
