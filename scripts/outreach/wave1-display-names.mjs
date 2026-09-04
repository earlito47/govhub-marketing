// Turn the raw SAM.gov legal entity name into something a human would write.
//
// Every wave 1 lead carries `companyName` exactly as SAM stores it: ALL CAPS,
// with the legal suffix attached. All 1,800 of them. That string is not a
// footnote in the copy, it is the subject line and the first thing in the
// body:
//
//     Subject: THE BLACKLEDGE GROUP, INC. proposals
//     Hey Dawn, noticed THE BLACKLEDGE GROUP, INC. has been bidding federal
//     work lately.
//
// Nobody writes their own company that way. On the opening line of a cold
// email to a stranger it reads as a mail merge, which is the one thing the
// first sentence cannot afford to look like.
//
// What this does, in order:
//   1. Strips the trailing legal suffix (INC, LLC, CORP, PBC, and friends,
//      including stacked ones like ", INC., PBC").
//   2. Un-inverts SAM's trailing article: "BOULEVARD GROUP, LLC, THE" and
//      "MITCHELL GROUP, INC. (THE)" both become "The ... Group".
//   3. Title-cases what is left, leaving acronyms alone.
//
// Step 3 is the part that cannot be done blindly, and the reason this is a
// script with an --audit mode rather than a one-line sed. Because the source
// is uniformly uppercase, case carries no signal about which tokens are words
// and which are initialisms: DFW, RHI and AJCE need to stay shouting while
// BLUE, PEAK and STAR must not. The rule is a curated list of short English
// words (WORDS below) plus a handful of structural cases; a short token that
// is not a known word is assumed to be an acronym and left alone, because
// "AJCE" reading as an acronym is harmless and "Ajce" is not.
//
// The original string is never discarded. It moves to a `legalName` custom
// variable on the same lead, so the entity stays identifiable and this is
// reversible from the data alone.
//
// Only the two changed keys go in the PATCH. `custom_variables` MERGES into
// the stored payload rather than replacing it, so uei, naics, segment and the
// rest survive untouched. That was checked against the API rather than assumed
// -- a PATCH carrying three keys came back with all fourteen intact.
//
// One trap worth knowing about, because it wastes an hour: /leads/list is
// eventually consistent. Read a lead straight after patching it and you get
// the old payload back, which looks exactly like a write that silently failed.
// It is not. The PATCH response itself echoes the merged payload immediately,
// so that is what this asserts on; a re-read through the list endpoint needs
// to wait.
//
// Env: INSTANTLY_API_KEY
// Usage:
//   node scripts/outreach/wave1-display-names.mjs --dry-run   every derivation
//   node scripts/outreach/wave1-display-names.mjs --audit      only the risky ones
//   node scripts/outreach/wave1-display-names.mjs --one <email>  patch a single lead
//   node scripts/outreach/wave1-display-names.mjs              patch all of them

const API = 'https://api.instantly.ai/api/v2';
const KEY = process.env.INSTANTLY_API_KEY;

const CAMPAIGNS = {
  A: '31fc2282-4153-42f9-b8d7-94517162b47c',
  B: '61c3b5df-22b6-4f98-ae56-290a750f1833',
  C: '09189743-6310-46bd-b48f-e5ca931d7e7e',
};

// Trailing legal forms. Order matters only in that the loop strips repeatedly,
// so "..., INC., PBC" comes off in two passes.
const SUFFIX = String.raw`(?:INCORPORATED|INC|L\.?L\.?C|L\.?L\.?P|LLP|L\.?P|PLLC|P\.?L\.?L\.?C|CORPORATION|CORP|COMPANY|CO|LTD|LIMITED|PBC|P\.?C|P\.?A|L\.?C|CHTD|CHARTERED)`;
const SUFFIX_RE = new RegExp(String.raw`[\s,]*\b${SUFFIX}\b\.?[\s,]*$`, 'i');

// Lowercased inside a name, capitalised when they lead it.
const SMALL = new Set(['a', 'an', 'and', 'at', 'by', 'de', 'del', 'for', 'in', 'la', 'las',
  'los', 'of', 'on', 'or', 'the', 'to', 'van', 'von', 'y']);

// Short English words that appear in these company names. Anything <= 4
// characters NOT in this set is treated as an initialism and left uppercase,
// so this list is the thing to extend when a real word starts shouting.
const WORDS = new Set([
  // Legal forms. Only reachable when the floor guard above kept one, in which
  // case it is part of the name and should read as "E Corp", not "E CORP".
  'corp', 'inc', 'ltd', 'co', 'company',
  'able', 'ace', 'acme', 'aero', 'age', 'aid', 'aim', 'air', 'all',
  'ally', 'alpha', 'and', 'apex', 'arc', 'arch', 'area', 'arm', 'army', 'arts', 'atom',
  'auto', 'axis', 'back', 'bank', 'barn', 'base', 'bay', 'beam', 'bear', 'bell', 'belt',
  'bend', 'best', 'big', 'bird', 'blue', 'blvd', 'boat', 'bold', 'bolt', 'bond', 'book',
  'boot', 'born', 'boss', 'both', 'box', 'boy', 'brew', 'brk', 'bros', 'buck', 'bug',
  'bulk', 'bull', 'buoy', 'bus', 'busy', 'buy', 'cab', 'cafe', 'calm', 'camp', 'cape',
  'car', 'card', 'care', 'cars', 'case', 'cash', 'cast', 'cave', 'cell', 'chef', 'city',
  'clay', 'clan', 'claw', 'clay', 'clean', 'clear', 'cliff', 'club', 'coal', 'coast',
  'coho', 'cold', 'cole', 'colt', 'cone', 'cook', 'cool', 'copy', 'cord', 'core', 'corn',
  'cost', 'cove', 'cow', 'crew', 'crop', 'cross', 'crow', 'cube', 'cure', 'cut', 'dale',
  'dam', 'dark', 'dart', 'data', 'dawn', 'day', 'deal', 'dean', 'deck', 'deep', 'deer',
  'dell', 'delta', 'desk', 'dial', 'dirt', 'dive', 'dock', 'doe', 'dog', 'dome', 'door',
  'dove', 'down', 'drum', 'dry', 'duck', 'due', 'dune', 'dust', 'duty', 'each', 'eagle',
  'earl', 'east', 'easy', 'echo', 'edge', 'elk', 'elm', 'end', 'era', 'eve', 'even',
  'ever', 'exit', 'eye', 'face', 'fact', 'fair', 'fall', 'fan', 'far', 'farm', 'fast',
  'fed', 'few', 'fife', 'find', 'fine', 'fire', 'firm', 'fish', 'fist', 'five', 'flag',
  'flat', 'flex', 'flow', 'fly', 'foam', 'fold', 'font', 'food', 'foot', 'ford', 'fork',
  'fort', 'four', 'fox', 'free', 'fuel', 'full', 'fund', 'fuse', 'gain', 'gale', 'gap',
  'gas', 'gate', 'gear', 'gem', 'gift', 'girl', 'give', 'glen', 'goal', 'goat', 'gold',
  'golf', 'good', 'gray', 'grid', 'grit', 'grow', 'gulf', 'gull', 'gun', 'guy', 'hall',
  'halo', 'hand', 'hard', 'hark', 'harp', 'hawk', 'hay', 'head', 'heal', 'heat', 'help',
  'hemp', 'herb', 'here', 'hero', 'high', 'hill', 'hire', 'hive', 'hold', 'hole', 'home',
  'hood', 'hoof', 'hook', 'hope', 'horn', 'host', 'hour', 'hub', 'hunt', 'hurt', 'ice',
  'idea', 'inn', 'iris', 'iron', 'isle', 'jack', 'jade', 'jet', 'job', 'join', 'joy',
  'jump', 'june', 'just', 'keel', 'keen', 'keep', 'key', 'kick', 'kids', 'kiln', 'kind',
  'king', 'kite', 'knot', 'know', 'lab', 'labs', 'lace', 'lake', 'lamb', 'lamp', 'land',
  'lane', 'last', 'late', 'lawn', 'lead', 'leaf', 'leap', 'left', 'lens', 'life', 'lift',
  'light', 'like', 'lily', 'lime', 'line', 'link', 'lion', 'list', 'live', 'load', 'loan',
  'lock', 'loft', 'log', 'long', 'look', 'loop', 'lost', 'loud', 'love', 'low', 'luck',
  'lynx', 'made', 'magic', 'mail', 'main', 'make', 'man', 'many', 'map', 'mark', 'mars',
  'mask', 'mass', 'mast', 'mate', 'math', 'meal', 'mesa', 'mesh', 'mess', 'mid', 'mile',
  'milk', 'mill', 'mind', 'mine', 'mint', 'mist', 'mix', 'moat', 'mode', 'moon', 'moor',
  'more', 'moss', 'most', 'moth', 'move', 'much', 'mule', 'must', 'nail', 'name', 'navy',
  'near', 'neat', 'neck', 'need', 'nest', 'net', 'new', 'news', 'next', 'nice', 'night',
  'nine', 'node', 'none', 'noon', 'north', 'nose', 'note', 'nova', 'now', 'oak', 'oaks',
  'oasis', 'odd', 'off', 'oil', 'old', 'omega', 'once', 'one', 'only', 'onyx', 'open',
  'opus', 'orbit', 'ore', 'ours', 'out', 'over', 'owl', 'own', 'pace', 'pack', 'pad',
  'page', 'paid', 'pair', 'palm', 'park', 'part', 'pass', 'past', 'path', 'peak', 'pear',
  'peer', 'pen', 'perk', 'pick', 'pier', 'pike', 'pile', 'pine', 'pink', 'pipe', 'pit',
  'plan', 'play', 'plum', 'plus', 'poet', 'pole', 'poly', 'pond', 'pony', 'pool', 'poor',
  'port', 'post', 'pot', 'prep', 'prime', 'pro', 'prop', 'pull', 'pulse', 'pump', 'pure',
  'push', 'quad', 'quay', 'quest', 'quick', 'race', 'rack', 'raft', 'rail', 'rain',
  'ramp', 'ranch', 'rand', 'rank', 'rate', 'raven', 'raw', 'ray', 'reach', 'read', 'real',
  'red', 'reed', 'reef', 'reel', 'rest', 'rich', 'ride', 'ridge', 'rift', 'rim', 'ring',
  'rise', 'risk', 'river', 'road', 'rock', 'rod', 'role', 'roll', 'roof', 'room', 'root',
  'rope', 'rose', 'rove', 'row', 'rule', 'run', 'rush', 'rust', 'safe', 'sage', 'sail',
  'salt', 'sand', 'save', 'saw', 'sea', 'seal', 'seat', 'see', 'seed', 'self', 'sell',
  'set', 'shed', 'ship', 'shop', 'shore', 'show', 'side', 'sign', 'silk', 'sill', 'silo',
  'sing', 'site', 'six', 'size', 'sky', 'slate', 'slot', 'slow', 'small', 'smart', 'snap',
  'snow', 'soft', 'soil', 'sole', 'solid', 'son', 'song', 'sons', 'sort', 'soul', 'sound',
  'south', 'span', 'spar', 'spot', 'spur', 'star', 'stars', 'stay', 'steel', 'stem',
  'step', 'stone', 'stop', 'storm', 'stream', 'strong', 'sub', 'such', 'suit', 'sum',
  'summit', 'sun', 'sure', 'surf', 'swan', 'sway', 'swift', 'tab', 'tag', 'tail', 'take',
  'tale', 'talk', 'tall', 'tank', 'tap', 'tape', 'task', 'team', 'tech', 'tee', 'tell',
  'ten', 'tent', 'term', 'test', 'text', 'that', 'them', 'then', 'thin', 'this', 'thor',
  'thru', 'tide', 'tie', 'tier', 'tile', 'till', 'time', 'tin', 'tip', 'tire', 'toll',
  'tone', 'tool', 'tools', 'top', 'torch', 'total', 'tour', 'tow', 'town', 'trac', 'track',
  'trade', 'trail', 'tree', 'trek', 'trend', 'tri', 'trim', 'trio', 'true', 'trust',
  'tube', 'tune', 'turf', 'turn', 'twin', 'two', 'type', 'union', 'unit', 'up', 'urban',
  'use', 'valley', 'value', 'vast', 'vault', 'veer', 'vent', 'very', 'vest', 'view',
  'vine', 'void', 'volt', 'vote', 'wage', 'wagon', 'walk', 'wall', 'want', 'ward', 'warm',
  'warn', 'wash', 'watch', 'water', 'wave', 'wax', 'way', 'weld', 'well', 'west', 'wide',
  'wild', 'will', 'wind', 'wine', 'wing', 'wire', 'wise', 'wolf', 'wood', 'wool', 'word',
  'work', 'works', 'worth', 'yard', 'year', 'york', 'zone']);

// Left uppercase regardless of length or the word list.
const FORCE_UPPER = new Set(['USA', 'US', 'IT', 'AI', 'CAD', 'HVAC', 'JV', 'LLC', 'GIS',
  'RF', 'IT', 'HR', 'PC', 'TV', 'AV', 'DC', 'NY', 'LA', 'SF', 'UK', 'EU', 'UAV', 'UAS',
  'ISR', 'EOD', 'SAR', 'GSA', 'DOD', 'VA', 'NASA', 'FAA', 'EPA', 'CNC', 'GPS', 'LED',
  'HD', 'XL', 'MRO', 'PPE', 'STEM', 'AEC', 'MEP', 'HHS', 'IRS', 'TSA', 'DHS', 'CBP']);

const ROMAN = /^(?:II|III|IV|VI|VII|VIII|IX|XI|XII)$/;
const VOWEL = /[AEIOUY]/;

function titleToken(tok, isFirst, forceWord = false) {
  const bare = tok.replace(/[^A-Za-z0-9&'.\-]/g, '');
  if (!bare) return tok;

  // Initials and single letters: "V.", "G", "J3".
  if (/^[A-Z]\.?$/.test(bare)) return bare;
  // Digits: FATHOM5 and VALID8.COM are a word with a number stuck on and read
  // fine title-cased. A1FEDIMPACT and 4VETS have the digit inside or in front,
  // where the intended casing is unknowable, so they stay as they are.
  if (/\d/.test(bare)) {
    const trailing = /^[A-Za-z]{3,}\d+(?:\.[A-Za-z]+)?$/.test(bare);
    if (!trailing) return bare;
    return bare.replace(/^[A-Za-z]+/, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .replace(/\.[A-Za-z]+$/, (x) => x.toLowerCase());
  }
  if (ROMAN.test(bare)) return bare;
  if (FORCE_UPPER.has(bare.toUpperCase())) return bare.toUpperCase();

  const lower = bare.toLowerCase();
  if (lower === 'jr' || lower === 'jr.') return 'Jr.';
  if (lower === 'sr' || lower === 'sr.') return 'Sr.';

  const known = WORDS.has(lower) || SMALL.has(lower);

  // Short and not a word we recognise: assume an initialism and leave it.
  // A no-vowel token is an initialism at any length (BLDG, MGMT, TRNSP).
  //
  // The length cut is 3, not 4, and that was measured rather than guessed. Of
  // the 206 distinct four-character tokens carrying a vowel in this list, the
  // large majority are ordinary words and surnames that must be cased --
  // BLUE, TECH, APEX, PEAK, STAR, SONS, KING, POLK, AMES, YORK, ANNA -- and
  // only about 25 are genuine initialisms such as AJCE, ASRC and NREC. Cutting
  // at 4 shouts all 206; cutting at 3 renders roughly 25 as Ajce and Asrc,
  // which is mild beside "POLK & Associates". Vowel-free four-letter forms
  // like FDCD are still caught by the rule above.
  if (!known && !forceWord && (bare.length <= 3 || !VOWEL.test(bare))) return bare.toUpperCase();

  if (SMALL.has(lower) && !isFirst) return lower;

  // Hyphens and apostrophes split into separately-capitalised parts, so
  // MILLER-REMICK becomes Miller-Remick and O'BRIEN becomes O'Brien.
  const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);
  let out = lower.split('-').map(cap).join('-');
  out = out.replace(/'(\w)/g, (m, c) => "'" + c.toUpperCase());
  // Mc and Mac only when what follows still looks like a name.
  out = out.replace(/^Mc([a-z])/, (m, c) => 'Mc' + c.toUpperCase());
  return out;
}

export function displayName(raw) {
  if (!raw) return '';
  let n = String(raw).trim();

  // Quotes SAM sometimes leaves around a form: FIVE CLAW "LLC".
  n = n.replace(/["“”]/g, ' ').replace(/\s+/g, ' ').trim();

  // Un-invert the trailing article before suffixes come off, because it can
  // sit either side of them: "GROUP, LLC, THE" and "GROUP, INC. (THE)".
  let leadingThe = false;
  const unInvert = () => {
    const m = n.match(/[\s,]*\(?\bTHE\b\)?[\s,.]*$/i);
    if (m && m.index > 0) { leadingThe = true; n = n.slice(0, m.index).trim().replace(/[,\s]+$/, ''); return true; }
    return false;
  };

  // A parenthetical disambiguator reads as boilerplate in a sentence, and it
  // has to come off before the suffix loop or it hides the suffix behind it:
  // "... COMPANY, INC. (OF VIRGINIA)" ends in the parenthetical, not in INC.
  // The un-inverted article is the one exception, so it is rescued first.
  if (/\(\s*THE\s*\)\s*$/i.test(n)) { leadingThe = true; n = n.replace(/\(\s*THE\s*\)\s*$/i, '').trim(); }
  n = n.replace(/\s*\([^)]*\)\s*$/, '').trim().replace(/[,\s.]+$/, '');

  // A legal form sitting mid-string before "OF": GENERAL CONSTRUCTORS INC. OF
  // THE QUAD CITIES. Stripping from the end never reaches it.
  n = n.replace(new RegExp(String.raw`[\s,]*\b${SUFFIX}\b\.?[\s,]*(?=\bOF\b)`, 'i'), ' ');

  let prev = null;
  while (prev !== n) {
    prev = n;
    unInvert();
    // Never strip a suffix down to nothing: "E CORP" is the whole name, and
    // so is "C. & J". Two characters is the floor, so the first keeps its
    // suffix and the second loses it.
    const next = n.replace(SUFFIX_RE, '').trim().replace(/[,\s.]+$/, '');
    if (next.replace(/[^A-Za-z0-9]/g, '').length < 2) break;
    n = next;
  }

  if (!n) return String(raw).trim(); // never hand back an empty name

  // Sole proprietors are registered under the person's own name, and SAM
  // stores it inverted: "GUEST, STEVEN G", "DUONG, HOA". Left alone that
  // renders as "noticed Guest, Steven G has been bidding", which is a merge
  // artifact on the opening line. Un-invert it.
  //
  // Guarded tightly so it cannot catch a company: the part before the comma
  // has to be a single token, the part after at most three, and neither may
  // contain a conjunction or any word that marks an organisation. Real
  // company names with commas ("EA ENGINEERING, SCIENCE, AND TECHNOLOGY")
  // fail the first test on the space alone.
  let isPersonal = false;
  const inverted = n.match(/^([A-Za-z][A-Za-z'\-]*),\s*([A-Za-z][A-Za-z'.\- ]*)$/);
  if (inverted) {
    const [, last, rest] = inverted;
    const restToks = rest.trim().split(/\s+/);
    const orgish = /\b(AND|&|GROUP|SERVICES|SOLUTIONS|ASSOCIATES|PARTNERS|CO|COMPANY|SONS|BROS|ENTERPRISES|HOLDINGS|CONSULTING|CONTRACTING)\b/i;
    if (restToks.length <= 3 && !orgish.test(rest) && !orgish.test(last)) {
      n = `${rest.trim()} ${last}`;
      // Every token in a person's name is a word, never an initialism. Without
      // this, "DUONG, HOA" comes back as "HOA Duong".
      isPersonal = true;
    }
  }

  // "IRSA UMAR" is two four-letter tokens the word list does not know, so the
  // acronym rule would shout both. A name made ENTIRELY of unknown short
  // tokens is far more likely a person or a place than a stack of
  // initialisms, so title-case it. One unknown token beside a real word
  // ("DFW CAD SERVICES") keeps the acronym reading.
  const toks = n.split(/\s+/).filter((t) => /[A-Za-z]/.test(t));
  const unknownShort = (t) => {
    const b = t.replace(/[^A-Za-z0-9&'.\-]/g, '');
    return b.length > 1 && b.length <= 4 && !/\d/.test(b) &&
      !WORDS.has(b.toLowerCase()) && !SMALL.has(b.toLowerCase()) &&
      !FORCE_UPPER.has(b.toUpperCase()) && !ROMAN.test(b) && VOWEL.test(b);
  };
  const allUnknown = isPersonal || (toks.length >= 2 && toks.every(unknownShort));

  const parts = n.split(/(\s+)/);
  let first = true;
  const out = parts.map((p) => {
    if (/^\s+$/.test(p)) return ' ';
    if (p === '&' || p === '-') return p;
    const t = titleToken(p, first, allUnknown);
    first = false;
    return t;
  }).join('');

  let result = out.replace(/\s+/g, ' ').trim().replace(/[,\s]+$/, '');
  if (leadingThe && !/^the\b/i.test(result)) result = 'The ' + result;
  return result;
}

// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2] || '';
  const onlyEmail = arg === '--one' ? process.argv[3] : null;

  if (!KEY) { console.error('INSTANTLY_API_KEY is not set'); process.exit(1); }

  const api = async (method, path, body) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  };

  const all = [];
  for (const [key, id] of Object.entries(CAMPAIGNS)) {
    let cursor = null;
    for (let i = 0; i < 40; i++) {
      const body = { limit: 100, campaign: id };
      if (cursor) body.starting_after = cursor;
      const d = await api('POST', '/leads/list', body);
      for (const l of d.items || []) all.push({ seg: key, lead: l });
      cursor = d.next_starting_after;
      if (!(d.items || []).length || !cursor) break;
    }
  }

  const rows = all.map(({ seg, lead }) => {
    const p = lead.payload || {};
    const raw = p.legalName || p.companyName || '';
    return { seg, lead, raw, display: displayName(raw) };
  });

  // Anything a human should look at before this ships.
  const risky = (r) =>
    !r.display ||
    r.display.length < 3 ||
    /\b(INC|LLC|CORP|LTD)\b/i.test(r.display) ||
    r.display === r.raw ||
    /[A-Z]{5,}/.test(r.display.replace(/^[A-Z]+(?=\s|$)/, '')) ||
    r.display.split(' ').length > 7;

  if (arg === '--dry-run' || arg === '--audit') {
    const show = arg === '--audit' ? rows.filter(risky) : rows;
    for (const r of show) console.log(`${r.seg}  ${r.raw}\n    -> ${r.display}`);
    console.log(`\n${show.length} shown of ${rows.length}.`);
    const changed = rows.filter((r) => r.display !== r.raw).length;
    console.log(`${changed} would change, ${rows.length - changed} identical, ${rows.filter(risky).length} flagged for review.`);
    process.exit(0);
  }

  let updated = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    if (onlyEmail && r.lead.email.toLowerCase() !== onlyEmail.toLowerCase()) continue;
    const p = r.lead.payload || {};
    if (p.companyName === r.display && p.legalName === r.raw) { skipped++; continue; }
    const vars = { companyName: r.display, legalName: r.raw };
    try {
      // The response echoes the merged payload, so assert on that rather than
      // trusting the status code. A 200 here does not mean anything landed.
      const res = await api('PATCH', `/leads/${r.lead.id}`, { custom_variables: vars });
      const got = res.payload || {};
      if (got.companyName !== r.display || got.legalName !== r.raw) {
        throw new Error(`stored companyName=${JSON.stringify(got.companyName)} legalName=${JSON.stringify(got.legalName)}`);
      }
      updated++;
      if (onlyEmail || updated % 100 === 0) console.log(`  ${updated} updated  (last: ${r.raw} -> ${r.display})`);
    } catch (e) {
      failed++;
      console.log(` FAIL ${r.lead.email}  ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`\n${updated} updated, ${skipped} already correct, ${failed} failed.`);
}
