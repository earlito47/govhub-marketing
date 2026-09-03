"""Shared normalization for the GovCon outreach database.

Two independent scripts feed this: parse-influencer-pdf.py (the original
254-record source, researched 2026-08-31) and parse-expansion-xlsx.py (a
researched top-up batch, researched 2026-09-03). Both produce a plain list of
"row" dicts in the same shape; build-influencer-db.py combines those lists and
calls derive_one() + apply_caps() here exactly once, over the FULL combined
set. That is the only way the cross-record logic (one email seen twice, one
organization capped, one sending domain capped) is correct: it has to see
every row from every source at the same time, or a duplicate that spans
sources is invisible to it.

Keeping this logic in one place matters more than usual here: the person/org
name heuristics (ORGWORD, person_name) and the hold reasons are exactly what
influencer-db.mjs documents and what --check asserts against, so a second copy
that drifts is a second copy that silently stops matching its own tests.
"""
import re, unicodedata
from collections import Counter, defaultdict

# ---- campaign mapping -------------------------------------------------
SEG2CAMPAIGN = {
    'Creator': 'C1', 'Podcast': 'C2', 'Newsletter': 'C2', 'Media': 'C3',
    'Consultant / Firm': 'C4', 'Consultant / Individual': 'C4',
    'APEX / Advisor': 'C5',
    # VBOC counselors operate under the same SBA-funded vendor-neutrality rule
    # as APEX Accelerators, so it rides the same campaign and inherits the
    # same no-commission guardrail in instantly-influencer.mjs. It is a
    # distinct segment (for reporting) on the same campaign (for copy).
    'Education Network': 'C5',
    'Association / Community': 'C6',
    # SBA, DCMA, DISA, DMEA and Air Force OSBP inboxes. Places to read from.
    'Government / Distribution': None,
}
SEGKEY = {
    'Creator': 'creator', 'Podcast': 'podcast', 'Newsletter': 'newsletter', 'Media': 'media',
    'Consultant / Firm': 'consultant_firm', 'Consultant / Individual': 'consultant_individual',
    'APEX / Advisor': 'apex', 'Education Network': 'education_network',
    'Association / Community': 'association',
    'Government / Distribution': 'government',
}

# ---- pattern library ----------------------------------------------------
ROLE_LOCAL = re.compile(r'^(info|support|admin|contact|hello|team|sales|office|help|apex|ptac|ptacinfo|general|inquiries|submissions|editor|press|news|newsroom|membership|success|partnerships|marketing|questions|service|services|business|smallbusiness|procurement|contracts|bids|proposals|answerdesk|certifications|sizestandards|contracting|training|fedbiztraining|thecontractingexperience|osfreshsqueezeddaily|ncmadc|nadcptac|tgi|apexaccelerator|smallbusinesscenterinbox)([._\-]|$)', re.I)

GOV_ENTITY = re.compile(r'\b(Air Force Materiel Command|Air Force Office of Small Business|Department of [A-Z]|Defense Contract Management|Defense Information Systems|Defense Logistics Agency|Defense Microelectronics|Office of Small Business Programs|Small Business Administration|General Services Administration|Department of Veterans Affairs|National Aeronautics)\b', re.I)
COMMERCIAL_BRAND = re.compile(r'\b(Academy|Consulting|Consultants|Training|LLC|Inc|Corp|Group|Solutions|Advisors|Partners|Services)\b', re.I)
INFERRED = re.compile(r'no (exact )?(public )?email|not captured|not exposed|not displayed|not first-party|needs enrichment|requires first-party', re.I)
COMPETITOR = re.compile(r'competitor|competitive', re.I)
EMAIL_RE = re.compile(r'^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')

ORGWORD = re.compile(r'\b(APEX|PTAC|Accelerator|Center|Centre|Chamber|Association|Council|Institute|University|College|Podcast|Network|Group|LLC|Inc|Corp|Consulting|Consultants|Solutions|Services|Office|Program|Programs|Department|Agency|Society|Alliance|Coalition|Board|Bureau|Commission|Development|Business|Community|Collective|Weekly|Wire|Daily|Journal|News|Times|Report|Roundup|SBDC|GovCon|Fed|Federal|Small|Systems|Partners|Partnership|Company|Media|Digital|Technologies|Technology|Tech|Global|National|State|Regional|Contract|Contracts|Contracting|Procurement|Proposal|Proposals|Capture|Academy|Training|Insights|Exchange|Hub|Works|Advisors|Advisory|Professional|Assurance|Associates|Enterprises|Enterprise|Ventures|Holdings|Labs|Lab|Studio|Select|Experience|Pricing|Strategies|Strategy|Firm|Practice|Guild|Intelligence|Data|Cloud|Software|Platform|Bid|Bids|Winners|Success|Assurance|Playbook|Brief|Standard|Live|Method|Coalition|Outreach|Centers|Center|Compass|Chapter|Different|Bytes|Adventures|Conversation|Procurement|Outlook)\b', re.I)
SUFFIX = re.compile(r'\b(Jr|Sr|II|III|IV|PhD|Ph\.D|MBA|CPCM|CFCM|CPP|APMP|Esq)\b\.?', re.I)

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))

def slug(*parts):
    s = strip_accents(' '.join(p for p in parts if p)).lower()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:70] or 'unknown'

def clean_url(u):
    u = re.sub(r'\s+', '', (u or '').strip())
    return u if u.startswith('http') else ''

def clean_email(raw):
    """Return (email, malformed_reason). Column bleed and line-wrap artifacts are common."""
    e = (raw or '').strip()
    if '@' not in e: return '', ''
    e = re.sub(r'\s+', '', e)
    if EMAIL_RE.match(e): return e.lower(), ''
    m = re.match(r'^([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+?\.(?:com|org|net|edu|gov|mil|us|io|ai|co))(?=[A-Z]|$)', e)
    if m: return m.group(1).lower(), 'salvaged from a column-bleed artifact'
    return '', 'unparseable'

def person_name(n):
    """True when the Contact Name is a human name a greeting can use."""
    n = SUFFIX.sub('', n or '').replace('.', '. ').strip()
    n = re.sub(r'\s+', ' ', n)
    if '/' in n or ',' in n: return False
    n = re.sub(r"['\"‘’“”]", '', n)
    parts = [p for p in n.split() if p]
    if not 2 <= len(parts) <= 4: return False
    if ORGWORD.search(n): return False
    for p in parts:
        bare = p.strip('.')
        if len(bare) >= 2 and bare.isupper(): return False
        if re.search(r'[a-z][A-Z]', bare): return False
    return all(re.match(r"^[A-Z][A-Za-z\-]*\.?$", p) for p in parts)

def first_name(n):
    n = re.sub(r"['\"‘’“”]", '', SUFFIX.sub('', n or '')).strip()
    p = [x for x in n.split() if x]
    if not p: return ''
    f = p[0].strip('.')
    if len(f) <= 2 and len(p) > 1:
        f = p[1].strip('.')
    if len(f) < 2 or not f.isalpha(): return ''
    return f[0].upper() + f[1:] if f.isupper() and len(f) > 3 else f

# ---- one-record derivation -----------------------------------------------
def derive_one(r, origin):
    """r is a dict with the row fields; origin tags where the row came from
    (e.g. 'master-pdf-2026-08-31', 'expansion-2026-09-03') so a human auditing
    the JSON can tell a researched-in-August record from a researched-last-week
    one without cross-referencing a commit date."""
    email, mal = clean_email(r.get('rawEmail', ''))
    name = r.get('name') or ''
    org = r.get('org') or ''
    isperson = person_name(name)
    fn = first_name(name) if isperson else ''
    seg = r['segment']
    holds = []
    if not email:
        holds.append('no-public-email' if not mal else f'unparseable-email ({mal})')
    if mal == 'salvaged from a column-bleed artifact':
        holds.append('email-salvaged-from-pdf-artifact')
    if email and INFERRED.search(r.get('verification', '') or ''):
        holds.append('email-not-first-party-verified')
    if COMPETITOR.search(r.get('partnerType', '') or '') or COMPETITOR.search(r.get('notes', '') or '') or COMPETITOR.search(r.get('angle', '') or ''):
        holds.append('competitor')
    if seg == 'Government / Distribution':
        holds.append('government-mailbox')
    elif (GOV_ENTITY.search(org) or GOV_ENTITY.search(name)) and not COMMERCIAL_BRAND.search(org + ' ' + name):
        holds.append('government-entity')
    dom = email.split('@')[-1] if email else ''
    if dom.endswith('.mil') or dom.endswith('.gov'):
        if 'government-mailbox' not in holds: holds.append('government-mailbox')
    # Pre-set holds a source-specific parser already decided (duplicate of an
    # existing contact, or a duplicate within its own batch). Carried through
    # rather than recomputed here because only the source parser has the
    # context (e.g. "this org already exists under a different display name").
    holds += r.get('preHolds', [])
    return {
        'id': slug(name or org, org if name else ''),
        'segment': SEGKEY[seg], 'campaign': SEG2CAMPAIGN[seg],
        'name': name, 'firstName': fn, 'nameIsPerson': isperson,
        'org': org, 'role': r.get('role', ''), 'state': r.get('state', ''),
        'email': email, 'emailType': r.get('emailType', ''),
        'emailClass': ('none' if not email else 'role' if ROLE_LOCAL.match(email.split('@')[0]) else 'person'),
        'website': clean_url(r.get('website', '')),
        'links': {k: clean_url(r.get(k, '')) for k in ('contactForm', 'linkedin', 'youtube', 'instagram', 'tiktok') if clean_url(r.get(k, ''))},
        'contactPath': (r.get('contactPath') or '').strip(),
        'audience': r.get('audience', ''), 'reachTier': r.get('reachTier', ''),
        'partnerType': r.get('partnerType', ''), 'affiliatePotential': r.get('affiliate', ''),
        'priority': r.get('priority') or 'P2', 'angle': r.get('angle', ''),
        'sourceUrl': clean_url(r.get('sourceUrl', '')) or (r.get('sourceUrl') or '').strip(),
        'verification': r.get('verification', ''), 'verifiedAt': r.get('verifiedAt', ''),
        'notes': r.get('notes', ''),
        'origin': origin,
        'holds': [h for h in holds if h],
    }

# ---- cross-record caps -----------------------------------------------------
# Free mail hosts are exempt from the domain cap: two people at gmail.com are
# two people, not one office.
FREE_HOSTS = {'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'aol.com', 'icloud.com', 'proton.me', 'me.com'}

def keep_rank(c):
    """Who survives a cap. Priority first, then how likely the address is to work.

    An address that carries the contact's own name is a published personal
    mailbox; one that does not is either a typo or somebody else's inbox, and
    either way it is the weaker of two records for the same organization.
    """
    local = c['email'].split('@')[0].lower()
    parts = [p for p in re.sub(r'[^a-z ]', '', c['name'].lower()).split() if p]
    carries = any(len(p) >= 4 and p in local for p in parts)
    return (c['priority'], 0 if c['emailClass'] == 'person' else 1, 0 if carries else 1,
            0 if c['nameIsPerson'] else 1, c['id'])

def apply_caps(contacts):
    """Mutates contacts in place: unique ids, duplicate-email, org-cap,
    domain-cap, then sets `sendable`. Must run over the FULL combined set from
    every source in one call, or a duplicate spanning two sources is missed."""
    seen = Counter()
    for c in contacts:
        seen[c['id']] += 1
        if seen[c['id']] > 1: c['id'] = f"{c['id']}-{seen[c['id']]}"

    byemail = defaultdict(list)
    for c in contacts:
        if c['email']: byemail[c['email']].append(c)
    for e, group in byemail.items():
        if len(group) == 1: continue
        group.sort(key=lambda c: (c['priority'], 0 if c['nameIsPerson'] else 1))
        for c in group[1:]:
            c['holds'].append(f'duplicate-email (kept {group[0]["id"]})')

    byorg = defaultdict(list)
    for c in contacts:
        if c['email'] and c['org']: byorg[(c['campaign'], c['org'].lower())].append(c)
    for (camp, org), group in byorg.items():
        if len(group) == 1 or camp is None: continue
        group.sort(key=keep_rank)
        for c in group[1:]:
            if not any(h.startswith('duplicate-email') for h in c['holds']):
                c['holds'].append(f'org-cap (one send per org; kept {group[0]["id"]})')

    bydomain = defaultdict(list)
    for c in contacts:
        if not c['email'] or c['holds'] or c['campaign'] is None: continue
        dom = c['email'].split('@')[1]
        if dom in FREE_HOSTS: continue
        bydomain[dom].append(c)
    for dom, group in bydomain.items():
        if len(group) == 1: continue
        group.sort(key=keep_rank)
        for c in group[1:]:
            c['holds'].append(f'domain-cap (one send per sending domain; kept {group[0]["id"]})')

    for c in contacts:
        c['sendable'] = bool(c['email']) and not c['holds'] and c['campaign'] is not None
        c['holds'] = sorted(set(c['holds']))
