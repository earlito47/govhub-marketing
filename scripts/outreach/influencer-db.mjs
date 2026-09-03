// GovCon influencer outreach database: segmentation, list hygiene, lead export.
//
// Source of truth is data/govcon-influencer-outreach.json, normalized from the
// GovCon Influencer & Media Outreach Database (researched 2026-08-31, public
// business contacts only). Record counts reconcile exactly with that file's own
// Expansion Dashboard: 254 records, and every per-segment count matches.
//
// This script does three things:
//
//   --report          what is in the list, what is held back, and why
//   --export [dir]    per-campaign CSVs ready for Instantly import
//   --check           assert the export guarantees hold. Run before any import.
//
// The export exists because of one rule: a merge variable that can be blank
// cannot carry the first line of an email. Instantly's preview substitutes a
// populated sample lead, so every blank-variable failure stays invisible until
// the first real send. So the CSV carries {{greeting}} and {{opener}} as
// complete written text per lead, and --check refuses to emit a lead missing
// either. Nothing in the sequence copy has to guess.
//
// Holds. A held contact is not deleted and not "bad", it is a contact this
// automated sequence must not send to. Six kinds:
//
//   no-public-email                 no address was published. Manual channel only.
//   email-not-first-party-verified  the database supplies an address while its
//                                   own verification note says none was found,
//                                   so the address is inferred. Bounces are what
//                                   kill a young sending domain, and these are
//                                   where the bounces are.
//   email-salvaged-from-pdf-artifact  two addresses were recovered from a column
//                                   collision in the source PDF. Re-read from the
//                                   site before trusting either.
//   duplicate-email                 one address, several records. Instantly would
//                                   send the same person two sequences.
//   org-cap                         several contacts at one organization. Eight
//                                   separate cold emails into one association
//                                   produces one complaint, not eight replies.
//   domain-cap                      several contacts reading mail at one domain.
//                                   Seven Ohio University APEX counselors are
//                                   filed under four different organization
//                                   names and all seven answer at ohio.edu, so
//                                   only the domain sees them as one office.
//                                   Spans campaigns: RSM Federal is a creator in
//                                   C1 and a publication in C3, and is still one
//                                   company. Free mail hosts are exempt.
//   competitor                      Deltek, HigherGov, GovSpend, Capture2Proposal,
//                                   GovDash. A partnership pitch to a competitor
//                                   is a product briefing for their sales team.
//   government-mailbox              DCMA, DISA, DMEA, Air Force OSBP and three SBA
//                                   program inboxes, plus APEX offices on .gov and
//                                   .mil addresses. The source database marks these
//                                   "do not pitch as affiliate; use for public
//                                   resource" and it is right. These are places to
//                                   read from, not send to.
//
// Usage:
//   node scripts/outreach/influencer-db.mjs --report
//   node scripts/outreach/influencer-db.mjs --check
//   node scripts/outreach/influencer-db.mjs --export out/instantly

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DB = JSON.parse(readFileSync(join(ROOT, 'data/govcon-influencer-outreach.json'), 'utf8'));
const VENDOR = join(ROOT, 'data/vendor-outreach.json');

// ---- Suppression ----------------------------------------------------------
// data/vendor-outreach.json is the existing opt-out record for the vendor
// "claim your page" outreach. Anyone who opted out there has opted out, full
// stop; a different campaign is not a fresh start. Matched on address, and on
// sending domain, because an opt-out from one person at a small firm covers the
// shared inbox at the same firm in every way that matters.
function suppression() {
  const emails = new Set();
  const domains = new Set();
  if (!existsSync(VENDOR)) return { emails, domains, present: false };
  const v = JSON.parse(readFileSync(VENDOR, 'utf8'));
  const add = (e) => {
    if (!e || !e.includes('@')) return;
    emails.add(e.toLowerCase());
    domains.add(e.toLowerCase().split('@')[1]);
  };
  for (const rec of Object.values(v.vendors || {})) {
    if (['opted-out', 'optedout', 'unsubscribed', 'bounced', 'complained'].includes(String(rec.status))) add(rec.email);
  }
  for (const e of v.suppressed || []) add(typeof e === 'string' ? e : e.email);
  return { emails, domains, present: true };
}

// ---- Derived lead fields --------------------------------------------------
// Greeting. 60 of the 116 sendable contacts have a usable first name and the
// rest are a shared inbox at a named organization, so this is written out per
// lead rather than left to {{firstName}}, which would render "Hi ," for the
// others. "Hi <Org> team" is what a person writing to info@ would actually type.
function greeting(c) {
  if (c.firstName) return `Hi ${c.firstName}`;
  // Greet whoever owns the inbox, which is not always the outlet. GovCon Wire is
  // published by Executive Mosaic and its address is info@executivemosaic.com,
  // so "Hi Executive Mosaic team" is what a person would write. Washington
  // Technology is owned by GovExec but answers at washingtontechnology.com, so
  // there the outlet is the right name. The email domain settles it.
  const root = c.email.split('@')[1].split('.')[0].toLowerCase();
  const squash = (v) => v.toLowerCase().replace(/[^a-z]/g, '');
  for (const cand of [displayOrg(c), brand(c)]) {
    if (!cand) continue;
    const sq = squash(cand);
    if (sq && (sq.startsWith(root) || root.startsWith(sq) || sq.includes(root))) return `Hi ${cand} team`;
  }
  return `Hi ${brand(c) || displayOrg(c)} team`;
}

// Primary channel, singular. The source database stores it as a list
// ("YouTube, Podcast, LinkedIn, Instagram") and a body that says "yours to use
// on YouTube, Podcast, LinkedIn, Instagram however you like" reads as a mail
// merge, which is the one thing this campaign cannot afford to read as.
const CHANNEL_FALLBACK = { C1: 'your channel', C2: 'your show', C3: 'your site', C4: '', C5: '', C6: '' };
function channel(c) {
  const m = /Primary channels:\s*(.+)$/i.exec(c.notes || '');
  if (m) {
    const first = m[1].split(',')[0].trim();
    if (first) return /^(podcast|newsletter|blog|courses|community|training|publication|platform)$/i.test(first)
      ? `your ${first.toLowerCase()}`
      : first;
  }
  if (c.segment === 'podcast') return 'your show';
  if (c.segment === 'newsletter') return 'your newsletter';
  return CHANNEL_FALLBACK[c.campaign] || '';
}

// Opener. One complete sentence, and the first thing the recipient reads.
//
// These are DERIVED, not researched. Every one of them is true of the record it
// is built from and none of them asserts anything about the recipient's recent
// work, because the database has no recent-content field and an opener that
// invents one is worse than a plain one. They are a floor: good enough that no
// lead ships with a blank or a generic "I hope this finds you well", and
// deliberately not good enough for a P1. --report lists every P1 so the opener
// can be rewritten by hand from the person's actual last month of output, which
// is the single highest-leverage edit available on this campaign.
// The source stores brand and legal entity in one cell ("Kizzy Parks / KPC",
// "GovClose / DoD Contract Academy"). The first segment is the name a person
// would use out loud, and the rest reads as a database field when it lands in a
// sentence.
function displayOrg(c) {
  return (c.org.split(' / ')[0] || c.org).trim();
}

// The name to use when the sentence is about what they publish. For a
// publication, a show or a newsletter the source files the outlet under Contact
// Name and the parent company under Organization, so "and GovExec kept coming
// up" would name a company the recipient does not write under. Everywhere else
// the organization is the brand.
const OUTLET_SEGMENTS = new Set(['media', 'podcast', 'newsletter']);
function brand(c) {
  if (OUTLET_SEGMENTS.has(c.segment) && c.name) return (c.name.split(' / ')[0] || c.name).trim();
  return displayOrg(c) || c.name;
}

// True when the organization IS the person: a personal brand, where "that is how
// I found Kizzy Parks" while the greeting already says "Hi Kizzy" reads as two
// halves of a mail merge that were not introduced to each other.
function isPersonalBrand(c) {
  if (!c.firstName) return false;
  const org = displayOrg(c).toLowerCase();
  const name = c.name.toLowerCase();
  return org === name || org.startsWith(c.firstName.toLowerCase() + ' ');
}

const OPENERS = {
  C1: (c) =>
    isPersonalBrand(c)
      ? `I went looking for the people who show small federal contractors how the work actually gets done rather than talk around it, and your name came up more than once.`
      : `I went looking for the people who show small federal contractors how the work actually gets done rather than talk around it, and that is how I found ${brand(c)}.`,
  C2: (c) =>
    c.segment === 'newsletter'
      ? `I have been mapping the newsletters that small federal contractors actually read, and ${brand(c)} is on that short list.`
      : `I went looking for GovCon shows that get into the mechanics of bidding instead of staying at the strategy level, which is how I found ${brand(c)}.`,
  C3: (c) => `I was working out who covers federal contracting for the firms doing the bidding rather than for the primes, and ${brand(c)} kept coming up.`,
  C4: (c) => `I came across ${brand(c)} while looking at who does proposal and capture work for small federal contractors.`,
  C5: (c) => `I have been going through the APEX Accelerator network state by state to understand what counselors are up against, which is how I got to ${brand(c)}.`,
  C6: (c) => `I was mapping the associations that small federal contractors actually belong to, and ${brand(c)} is on that list.`,
};

function lead(c) {
  return {
    email: c.email,
    firstName: c.firstName,
    companyName: brand(c),
    greeting: greeting(c),
    opener: OPENERS[c.campaign](c),
    channel: channel(c),
    // Carried for the operator, not referenced by any body. A body that
    // referenced them would be a body that can render blank.
    specialty: c.angle,
    audienceType: c.audience,
    priority: c.priority,
    id: c.id,
    website: c.website,
    sourceUrl: c.sourceUrl,
  };
}

const CAMPAIGN_ORDER = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
// Campaigns whose bodies reference {{channel}}. For these the value is not
// optional: a blank renders "yours to use on  however you like".
const NEEDS_CHANNEL = new Set(['C1', 'C3']);

function sendable() {
  const sup = suppression();
  const out = [];
  const suppressed = [];
  for (const c of DB.contacts) {
    if (!c.sendable) continue;
    if (sup.emails.has(c.email) || sup.domains.has(c.email.split('@')[1])) {
      suppressed.push(c);
      continue;
    }
    out.push(c);
  }
  return { out, suppressed, sup };
}

// A person-addressed mailbox that carries neither half of the contact's name is
// either a transcription slip in the source or somebody else's inbox, and both
// send a greeting to the wrong person. Advisory rather than a hold: it names the
// handful of addresses to open in a browser before import.
//
// It catches two real things in this list. mlejuene@rsmfederal.com is the same
// letters as LeJeune in the wrong order, which is a typo and therefore a bounce.
// bridget@govconnow.co is filed under Sheena Parker, and the source's own note
// says the address books for both of them, so "Hi Sheena" goes to Bridget.
function nameEmailMismatch(c) {
  if (!c.email || c.emailClass !== 'person' || !c.nameIsPerson) return false;
  const local = c.email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  const parts = c.name.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last = parts[parts.length - 1] || '';
  if (last.length < 4) return false;
  if (local.includes(last) || (first.length >= 4 && local.includes(first))) return false;
  // An initial plus the surname (jsmith, s.mccall) is a naming convention, not
  // a mismatch, so only flag when the surname is absent entirely.
  return true;
}

// ---- Reporting ------------------------------------------------------------
function report() {
  const { out, suppressed, sup } = sendable();
  const total = DB.contacts.length;
  const byCampaign = (pred) => CAMPAIGN_ORDER.map((k) => DB.contacts.filter((c) => c.campaign === k && pred(c)).length);

  console.log('GovCon influencer outreach database\n');
  for (const b of DB.source.batches || []) {
    console.log(`  ${b.kind === 'pdf' ? 'source' : 'expansion'}  ${b.file}  researched ${b.researched}  (${b.rows} rows)`);
  }
  console.log(`\n  ${total} contacts, ${DB.contacts.filter((c) => c.email).length} with a public email\n`);

  console.log('  campaign                              total  sendable  held');
  for (const k of CAMPAIGN_ORDER) {
    const all = DB.contacts.filter((c) => c.campaign === k);
    const send = out.filter((c) => c.campaign === k);
    console.log(`  ${k} ${DB.campaigns[k].padEnd(34)} ${String(all.length).padStart(4)}  ${String(send.length).padStart(8)}  ${String(all.length - send.length).padStart(4)}`);
  }
  const unassigned = DB.contacts.filter((c) => !c.campaign);
  console.log(`  ${'no campaign (government distribution)'.padEnd(37)} ${String(unassigned.length).padStart(4)}  ${String(0).padStart(8)}  ${String(unassigned.length).padStart(4)}`);
  console.log(`  ${'TOTAL'.padEnd(37)} ${String(total).padStart(4)}  ${String(out.length).padStart(8)}  ${String(total - out.length).padStart(4)}\n`);

  const holds = {};
  for (const c of DB.contacts) for (const h of c.holds) {
    const k = h.split(' (')[0];
    holds[k] = (holds[k] || 0) + 1;
  }
  console.log('  held back, by reason');
  for (const [k, v] of Object.entries(holds).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(4)}  ${k}`);
  console.log(`    ${String(suppressed.length).padStart(4)}  suppressed by data/vendor-outreach.json${sup.present ? '' : ' (FILE MISSING)'}`);
  for (const c of suppressed) console.log(`          ${c.email}  ${c.name}`);

  console.log('\n  P1 contacts needing a hand-written opener before send');
  const p1 = out.filter((c) => c.priority === 'P1');
  for (const c of p1) {
    console.log(`    ${c.campaign}  ${(c.name || c.org).slice(0, 30).padEnd(32)}${c.email.padEnd(36)}${(c.audience || c.reachTier || '').slice(0, 18)}`);
  }
  console.log(`    ${p1.length} of ${out.length} sendable contacts are P1.`);

  // Everything an expansion batch adds is address-blank on principle (see
  // parse_expansion_xlsx.py's docstring: no guessed addresses, because a
  // guessed address is a bounce and bounces are what kill a young domain), so
  // none of it is sendable yet. It is still ranked: P1 rows with a contactPath
  // are worth a human's time to go find the address for before the batch as a
  // whole is written off as "held".
  const toResearch = DB.contacts.filter((c) => !c.sendable && c.contactPath && c.priority === 'P1' && !c.holds.some((h) => h.startsWith('duplicate')));
  if (toResearch.length) {
    console.log(`
  P1 prospects worth finding an address for (no email in the source, but a contact path exists)`);
    for (const c of toResearch) {
      console.log(`    ${c.campaign}  ${(c.name || c.org).slice(0, 30).padEnd(32)}${c.org.slice(0, 30).padEnd(32)}${c.contactPath.slice(0, 50)}`);
    }
  }
  const needsVerification = DB.contacts.filter((c) => /needs verification/i.test(c.verification));
  if (needsVerification.length) {
    console.log(`
  ${needsVerification.length} contacts are unverified ecosystem entities (the expansion author's own flag, not re-checked): confirm the org and role are current before researching an address.`);
    for (const c of needsVerification) console.log(`    ${c.campaign}  ${(c.name || c.org).slice(0, 30).padEnd(32)}${c.org.slice(0, 40)}`);
  }

  const mismatch = out.filter(nameEmailMismatch);
  if (mismatch.length) {
    console.log('\n  addresses to open in a browser before import (the mailbox does not carry the contact name)');
    for (const c of mismatch) console.log(`    ${c.email.padEnd(36)}${c.name}`);
  }

  const verdicts = {};
  for (const c of out) verdicts[c.emailVerify || 'not checked'] = (verdicts[c.emailVerify || 'not checked'] || 0) + 1;
  console.log('\n  deliverability of the sendable list (MillionVerifier)');
  for (const [k, v] of Object.entries(verdicts).sort((a, b) => b[1] - a[1])) {
    const note_ = k === 'catch_all'
      ? '  the domain accepts every address, so the mailbox cannot be confirmed either way'
      : k === 'ok' ? '  confirmed deliverable' : '';
    console.log(`    ${String(v).padStart(4)}  ${k}${note_}`);
  }

  const roleInbox = out.filter((c) => c.emailClass === 'role').length;
  console.log(`\n  ${roleInbox} of ${out.length} sendable addresses are a shared inbox rather than a person.`);
  console.log(`  ${out.filter((c) => !c.firstName).length} have no usable first name, which is why {{greeting}} is written per lead.`);
  console.log(`\n  sends if all four steps run: ${out.length * 4} across ${CAMPAIGN_ORDER.length} campaigns.`);
}

// ---- Export ---------------------------------------------------------------
const CSV_COLS = ['email', 'firstName', 'companyName', 'greeting', 'opener', 'channel', 'specialty', 'audienceType', 'priority', 'id', 'website', 'sourceUrl'];

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsvs(dir) {
  const { out } = sendable();
  mkdirSync(dir, { recursive: true });
  for (const k of CAMPAIGN_ORDER) {
    const rows = out.filter((c) => c.campaign === k).map(lead);
    const csv = [CSV_COLS.join(','), ...rows.map((r) => CSV_COLS.map((col) => csvCell(r[col])).join(','))].join('\n');
    const path = join(dir, `${k.toLowerCase()}-${DB.campaigns[k].toLowerCase().replace(/[^a-z]+/g, '-')}.csv`);
    writeFileSync(path, csv + '\n');
    console.log(`  ${rows.length.toString().padStart(3)} leads  ${path}`);
  }
  // Everything held, in one file, so the manual pile is a worklist and not a
  // silent deletion.
  const held = DB.contacts.filter((c) => !c.sendable);
  const hcols = ['campaign', 'segment', 'name', 'org', 'email', 'priority', 'holds', 'contactPath', 'website', 'sourceUrl'];
  const hcsv = [hcols.join(','), ...held.map((c) => hcols.map((col) => csvCell(col === 'holds' ? c.holds.join('; ') : c[col])).join(','))].join('\n');
  writeFileSync(join(dir, 'held-manual-followup.csv'), hcsv + '\n');
  console.log(`  ${held.length.toString().padStart(3)} held   ${join(dir, 'held-manual-followup.csv')}`);
}

// ---- Check ----------------------------------------------------------------
function check() {
  let fail = 0;
  const note = (ok, label, detail) => {
    if (!ok) fail++;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? '  ' + detail : ''}`);
  };

  // The source file must still reconcile with the database it came from.
  note(DB.contacts.length >= 254, 'contact count', `${DB.contacts.length} contacts`);
  const ids = DB.contacts.map((c) => c.id);
  note(new Set(ids).size === ids.length, 'contact ids are unique');

  const { out, sup } = sendable();
  note(sup.present, 'suppression ledger data/vendor-outreach.json was read');

  const leads = out.map(lead);
  note(leads.every((l) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(l.email)), 'every exported address parses');
  const emails = leads.map((l) => l.email.toLowerCase());
  note(new Set(emails).size === emails.length, 'no address appears in two campaigns', `${emails.length} leads`);

  // The whole reason the export exists.
  note(leads.every((l) => l.greeting && l.greeting.length > 4), 'every lead has a greeting');
  note(leads.every((l) => l.opener && l.opener.trim().endsWith('.') && l.opener.split(/\s+/).length >= 12), 'every lead has a complete opener sentence');
  note(leads.every((l) => l.companyName && l.companyName.length > 1), 'every lead has a company name');
  note(!leads.some((l) => /\{\{|\}\}/.test(Object.values(l).join(' '))), 'no exported value contains a merge variable');
  note(!leads.some((l) => Object.values(l).some((v) => String(v).includes('—'))), 'no exported value contains an em dash');

  // {{channel}} is referenced by C1 and C3 bodies, so a blank is a broken send.
  const needChan = out.filter((c) => NEEDS_CHANNEL.has(c.campaign)).map(lead);
  note(needChan.every((l) => l.channel && l.channel.length > 2), 'every C1 and C3 lead has a channel', `${needChan.length} leads`);
  note(needChan.every((l) => !l.channel.includes(',')), 'channel is singular, not a list');

  // The greeting is the first line the recipient reads. A role word or a legal
  // suffix in it is proof of process, which is the wave 1 lesson.
  const ROLE_WORDS = /\b(info|admin|support|contracts|procurement|bids|proposals|team inbox|sales|office)\b/i;
  note(!leads.some((l) => l.firstName && ROLE_WORDS.test(l.firstName)), 'no first name is a role word');
  note(!leads.some((l) => l.firstName && (l.firstName.length < 2 || /[\d@]/.test(l.firstName))), 'no first name is too short or contains a digit');
  note(!leads.some((l) => l.greeting.startsWith('Hi ,')), 'no greeting renders with a dangling comma');
  // "Payne Professional Assurance" and "Washington Technology" both parsed as
  // people, which put "Hi Payne," and "Hi Washington," on the first line. A
  // first name that is also a word in a multi-word company name is a brand.
  const brandAsName = leads.filter(
    (l) => l.firstName && l.companyName.split(/\s+/).length >= 3 &&
      l.companyName.toLowerCase().split(/\s+/).includes(l.firstName.toLowerCase())
  );
  note(brandAsName.length === 0, 'no first name is a word from its own company name', brandAsName.map((l) => `${l.firstName}/${l.companyName}`).join(' '));

  // Nothing held for a reason about the ADDRESS may leak into an export.
  // duplicate-email and org-cap holds are excluded by definition: those records
  // share an address or an organization with the record that was kept, which is
  // the whole point of holding them.
  const positional = (c) =>
    c.holds.every((h) => h.startsWith('duplicate-email') || h.startsWith('org-cap') || h.startsWith('domain-cap'));
  const heldEmails = new Set(
    DB.contacts.filter((c) => !c.sendable && c.email && !positional(c)).map((c) => c.email.toLowerCase())
  );
  const leaked = emails.filter((e) => heldEmails.has(e));
  note(leaked.length === 0, 'no address held on its own merits appears in an export', leaked.join(' '));
  const gov = emails.filter((e) => e.endsWith('.gov') || e.endsWith('.mil'));
  note(gov.length === 0, 'no .gov or .mil address is exported', gov.join(' '));
  const comp = out.filter((c) => /competitor|competitive/i.test(c.partnerType));
  note(comp.length === 0, 'no competitor is exported', comp.map((c) => c.org).join(' '));

  // One organization, one conversation.
  // Deliverability. The structural holds answer "should we send here"; these
  // answer "will this address accept mail". MillionVerifier found five
  // confirmed-dead addresses sitting in what was going to be sent, which on a
  // 104-address list is a 4.8% bounce rate, above the 3% the wave 1 doc says
  // to stop and investigate at.
  const badVerdicts = out.filter((c) => ['invalid', 'disposable', 'unknown'].includes(c.emailVerify));
  note(badVerdicts.length === 0, 'no invalid or unverifiable address is exported', badVerdicts.map((c) => `${c.email}:${c.emailVerify}`).join(' '));
  const unchecked = out.filter((c) => !c.emailVerify);
  note(
    unchecked.length === 0,
    'every exported address has a verification verdict',
    unchecked.length ? `${unchecked.length} unchecked; run verify-emails.mjs` : ''
  );

  const orgs = out.map((c) => `${c.campaign}:${c.org.toLowerCase()}`);
  note(new Set(orgs).size === orgs.length, 'one contact per organization per campaign');
  const FREE_HOSTS = new Set(['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'aol.com', 'icloud.com', 'proton.me', 'me.com']);
  const doms = out.map((c) => c.email.split('@')[1]).filter((d) => !FREE_HOSTS.has(d));
  const overDom = [...new Set(doms.filter((d, i) => doms.indexOf(d) !== i))];
  note(overDom.length === 0, 'one contact per sending domain across all campaigns', overDom.join(' '));

  console.log(`\n${out.length} sendable leads. ${fail === 0 ? 'All checks pass.' : fail + ' FAILURES.'}`);
  return fail;
}

// ---- Exported for push-leads.mjs ------------------------------------------
// The uploader needs the exact rows --export writes, so it imports them from
// here rather than reimplementing the derivation. If the two ever disagreed,
// the CSV a human reviews and the leads actually in Instantly would differ,
// which is the kind of gap nobody notices until a send goes out wrong.
export function buildLeads() {
  const { out } = sendable();
  return out.map((c) => ({ campaign: c.campaign, ...lead(c) }));
}

// ---- CLI ------------------------------------------------------------------
// Guarded so importing this module does not run the CLI.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const arg = process.argv[2] || '--report';
  if (arg === '--report') report();
  else if (arg === '--check') process.exit(check() === 0 ? 0 : 1);
  else if (arg === '--export') {
    if (check() !== 0) { console.error('\nChecks failed. No CSVs written.'); process.exit(1); }
    console.log('');
    exportCsvs(process.argv[3] || join(ROOT, 'out/instantly-influencer'));
  } else { console.error(`unknown argument ${arg}`); process.exit(1); }
}
