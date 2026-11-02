// Per-recipient links in reply-desk emails.
//
// Every govhub.online link in a reply leaves with:
//   - utm_source=instantly, utm_medium=email, utm_campaign=reply_desk, unless the
//     link already names a campaign (the matrix-builder URL in content.mjs does);
//   - gh_lid=<Instantly lead id>, so a click and every later visit from that
//     browser can be tied back to the person we wrote to
//     (scripts/outreach/lead-visits.mjs). The id is opaque: an Instantly
//     record id, never the email address, because a URL ends up in browser
//     history, server logs and anything the visitor forwards.
//
// The site takes gh_lid out of the address bar before GA4, the Meta Pixel or
// Cloudflare read it (src/components/LeadLink.astro), keeps it in a
// first-party cookie, and honors the /privacy/ opt-out and Global Privacy
// Control. See docs/seo-week1-attribution.md, "Per-recipient links".
//
// Applied at send time, after the draft is linted and approved, so the text a
// person reviews stays readable and the allow-list check sees the plain URL.

const SITE = /https:\/\/(?:www\.)?govhub\.online(?:\/[^\s<>"')\]]*)?/g;

/**
 * @param {string} text  the email body
 * @param {{ leadId?: string | null }} opts
 * @returns {string}
 */
export function stampLinks(text, { leadId } = {}) {
  const id = leadId && /^[A-Za-z0-9._-]{6,64}$/.test(leadId) ? leadId : null;
  return text.replace(SITE, (raw) => {
    // A sentence often ends right after a link: keep the full stop outside it.
    const trail = raw.match(/[.,;:!?]+$/)?.[0] ?? '';
    const href = trail ? raw.slice(0, -trail.length) : raw;
    let u;
    try { u = new URL(href); } catch { return raw; }
    u.hostname = 'www.govhub.online'; // the apex 301s; skip the hop
    if (!u.searchParams.has('utm_source')) {
      u.searchParams.set('utm_source', 'instantly');
      u.searchParams.set('utm_medium', 'email');
      u.searchParams.set('utm_campaign', 'reply_desk');
    }
    if (id && !u.searchParams.has('gh_lid')) u.searchParams.set('gh_lid', id);
    return u.toString() + trail;
  });
}
