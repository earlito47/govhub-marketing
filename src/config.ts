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
 * {{VERIFY: confirm app subdomain + exact /signup and /login (or /auth) paths}}
 */
export const APP_URL = 'https://app.govhub.online';
export const SIGNUP_URL = `${APP_URL}/signup`;
export const SIGNIN_URL = `${APP_URL}/login`;

/** Primary contact address. {{VERIFY: real inbound address}} */
export const CONTACT_EMAIL = 'hello@govhub.online';

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
  h1: 'AI-powered government proposal software',
  primary: 'government proposal software',
  fallback: 'government proposal software for small business',
};

export const TRIAL_DAYS = 14;
