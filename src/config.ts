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
