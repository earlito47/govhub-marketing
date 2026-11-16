// Opt-out handling for the reply desk.
//
// WHY. Until 2026-11-13 a reply classified `unsubscribe` ("Stop", "Remove me")
// or `not_interested` (a bare "No") was recorded as `no_action`. Instantly's
// stop_on_reply ends THAT campaign for that lead, but nothing stopped another
// campaign, on another of the 16 sending domains, from emailing them again.
// The workspace blocklist was maintained by hand: 2 entries against 16 written
// opt-outs on 2026-11-04 (docs/instantly-angle-coverage.md).
//
// CAN-SPAM (15 U.S.C. 7704(a)(4)) requires an opt-out to be honoured within
// 10 business days, across every message the sender initiates, so a request
// made in one campaign has to reach all of them. The Instantly workspace
// blocklist is the one place that covers every mailbox and campaign at once.
//
// WHICH REPLIES. `unsubscribe` always. `not_interested` too: the influencer
// and wave 1 bodies say 'Reply "no" and I will not reach out again', so a bare
// "No" is the opt-out our own email told them to send, and treating it as
// anything else would make that line untrue. This replaces the earlier
// programme rule that a bare "no" is only ever read by a human.
//
// Suppression is per address, never per domain: one person at a company
// opting out does not opt their colleagues out (and a free-mail domain would
// block thousands of strangers).

/** Reply categories that must put the sender on the workspace blocklist. */
export const OPT_OUT_CATEGORIES = new Set(['unsubscribe', 'not_interested']);

export function isOptOut(category) {
  return OPT_OUT_CATEGORIES.has(category);
}

/** Normalised address to block, or null when it is not a plausible single mailbox. */
export function blockValue(email) {
  const v = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

/**
 * Ledger rows that still need a blocklist write:
 *   - suppress_failed: the write failed on an earlier scan. Retried on every
 *     scan until it succeeds, independently of the inbox cursor, so a
 *     temporary API error can never drop an opt-out.
 *   - no_action with an opt-out category: replies recorded before this module
 *     existed (17 unsubscribe and 60 not_interested rows on 2026-11-13). The
 *     first scan after this ships blocks them; blocking an address that is
 *     already on the list is harmless.
 */
export function pendingSuppressions(ledgerEmails) {
  return Object.entries(ledgerEmails)
    .filter(([, r]) =>
      (r.status === 'suppress_failed' || (r.status === 'no_action' && isOptOut(r.category))) &&
      blockValue(r.lead))
    .map(([id, r]) => ({ id, lead: r.lead }));
}
