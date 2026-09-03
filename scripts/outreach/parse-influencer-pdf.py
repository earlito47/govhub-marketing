#!/usr/bin/env python3
"""Rebuild data/govcon-influencer-outreach.json from the source PDF.

The source is the GovCon Influencer & Media Outreach Database (researched
2026-08-31, public business contacts only). The PDF itself is not committed:
it is a research artifact, and the JSON this produces is what the outreach
pipeline reads. This script exists so that JSON is reproducible and auditable
rather than a hand-edited blob.

    pip install pdfplumber
    python3 scripts/outreach/parse-influencer-pdf.py path/to/GovCon_Influencer_Outreach_Database_200plus.pdf

Extraction notes, because the PDF fights back:

  * It is a spreadsheet printed at 1.5pt onto letter pages. Row pitch is about
    3.5pt and pdfplumber's word grouping returns single characters at that size,
    so this walks raw chars: cluster by `top` into lines, then split a line into
    tokens wherever the horizontal gap exceeds a space width at 1.5pt.
  * Column boundaries come from the x positions of the header row. A token is
    assigned to the last column whose left edge it clears.
  * A wrapped cell continues on the next line with no value in column 0, and is
    appended to the record above. Two segment values ("Association / Community",
    "Government / Distribution") wrap ACROSS column 0, which naively reads as
    two records; merge_wraps rejoins them against the known segment vocabulary.
  * The reconciliation check at the end is the real test: record count and every
    per-segment count must equal the PDF's own Expansion Dashboard (254 total).
    If a future revision of the source changes shape, that assertion fires
    rather than silently emitting a short list.

Derived fields and the holds they produce are documented in
scripts/outreach/influencer-db.mjs, which is what consumes this output.
"""
import json, re, sys, unicodedata
from collections import Counter, defaultdict

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else 'GovCon_Influencer_Outreach_Database_200plus.pdf'
OUT = 'data/govcon-influencer-outreach.json'

# Master records span two pages of the same 24-column table.
MASTER_PAGES = (6, 7)
NEWSLETTER_PAGE = 3

# The PDF's own dashboard. If these stop matching, the extraction is wrong.
EXPECTED = {
    'APEX / Advisor': 117, 'Consultant / Firm': 46, 'Creator': 39,
    'Association / Community': 18, 'Media': 15, 'Government / Distribution': 7,
    'Consultant / Individual': 7, 'Podcast': 5,
}

def text_lines(page, ytol=0.9):
    chars=sorted(page.chars, key=lambda c:(c['top'], c['x0']))
    lines=[]; cur=[]; curtop=None
    for c in chars:
        if curtop is None or abs(c['top']-curtop)<=ytol:
            cur.append(c); curtop=curtop if curtop is not None else c['top']
        else:
            lines.append((curtop,cur)); cur=[c]; curtop=c['top']
    if cur: lines.append((curtop,cur))
    return lines

def toks(cs, gap=0.30):
    cs=sorted(cs,key=lambda c:c['x0'])
    out=[]; buf=cs[0]['text']; x0=cs[0]['x0']; prev=cs[0]['x1']
    for c in cs[1:]:
        if c['x0']-prev > gap:
            out.append((x0,buf)); buf=c['text']; x0=c['x0']
        else: buf+=c['text']
        prev=c['x1']
    out.append((x0,buf)); return out

def parse(pageno):
    pdf = pdfplumber.open(PDF); p = pdf.pages[pageno-1]
    ls=text_lines(p)
    hdr=toks(ls[0][1])
    bounds=[x for x,_ in hdr]; names=[t.strip() for _,t in hdr]
    def colof(x):
        best=0
        for i,b in enumerate(bounds):
            if x >= b-0.6: best=i
        return best
    recs=[]
    for top,cs in ls[1:]:
        tk=toks(cs)
        cells={}
        for x,t in tk:
            i=colof(x)
            cells[i]=(cells.get(i,'')+' '+t).strip() if i in cells else t.strip()
        isnew = 0 in cells
        if isnew:
            r=['']*len(names)
            for i,v in cells.items():
                if i<len(names): r[i]=v
            recs.append(r)
        elif recs:
            for i,v in cells.items():
                if i<len(names):
                    prev=recs[-1][i]
                    recs[-1][i]=(prev+(' ' if prev and not prev.endswith('-') else '')+v) if prev else v
    return names, recs


VALID={'Creator','Media','Podcast','Consultant / Firm','Consultant / Individual',
       'APEX / Advisor','Association / Community','Government / Distribution','Newsletter'}

def merge_wraps(names, recs):
    out=[]
    for r in recs:
        seg=r[0].strip()
        if out and seg not in VALID:
            prev=out[-1]
            cand=(prev[0].strip()+' '+seg).strip()
            if cand in VALID or prev[0].strip() not in VALID:
                prev[0]=cand
                for i in range(1,len(names)):
                    if r[i]:
                        prev[i]=(prev[i]+(' ' if prev[i] and not prev[i].endswith('-') else '')+r[i]) if prev[i] else r[i]
                continue
        out.append(list(r))
    return out


SEG2CAMPAIGN={
    'Creator':'C1','Podcast':'C2','Newsletter':'C2','Media':'C3',
    'Consultant / Firm':'C4','Consultant / Individual':'C4',
    'APEX / Advisor':'C5','Association / Community':'C6',
    # SBA, DCMA, DISA, DMEA and Air Force OSBP inboxes. Places to read from.
    'Government / Distribution':None,
}
SEGKEY={
    'Creator':'creator','Podcast':'podcast','Newsletter':'newsletter','Media':'media',
    'Consultant / Firm':'consultant_firm','Consultant / Individual':'consultant_individual',
    'APEX / Advisor':'apex','Association / Community':'association',
    'Government / Distribution':'government',
}

ROLE_LOCAL=re.compile(r'^(info|support|admin|contact|hello|team|sales|office|help|apex|ptac|ptacinfo|general|inquiries|submissions|editor|press|news|newsroom|membership|success|partnerships|marketing|questions|service|services|business|smallbusiness|procurement|contracts|bids|proposals|answerdesk|certifications|sizestandards|contracting|training|fedbiztraining|thecontractingexperience|osfreshsqueezeddaily|ncmadc|nadcptac|tgi|apexaccelerator|smallbusinesscenterinbox)([._\-]|$)', re.I)
# Bare agency acronyms are unusable here: DoD Contract Academy and GO GSA are
# private firms trading on the acronym. Only full agency names count, and a
# commercial suffix on the same line vetoes the match.
GOV_ENTITY=re.compile(r'\b(Air Force Materiel Command|Air Force Office of Small Business|Department of [A-Z]|Defense Contract Management|Defense Information Systems|Defense Logistics Agency|Defense Microelectronics|Office of Small Business Programs|Small Business Administration|General Services Administration|Department of Veterans Affairs|National Aeronautics)\b', re.I)
COMMERCIAL_BRAND=re.compile(r'\b(Academy|Consulting|Consultants|Training|LLC|Inc|Corp|Group|Solutions|Advisors|Partners|Services)\b', re.I)
INFERRED=re.compile(r'no (exact )?(public )?email|not captured|not exposed|not displayed|not first-party|needs enrichment|requires first-party', re.I)
COMPETITOR=re.compile(r'competitor|competitive', re.I)
EMAIL_RE=re.compile(r'^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')

ORGWORD=re.compile(r'\b(APEX|PTAC|Accelerator|Center|Centre|Chamber|Association|Council|Institute|University|College|Podcast|Network|Group|LLC|Inc|Corp|Consulting|Consultants|Solutions|Services|Office|Program|Programs|Department|Agency|Society|Alliance|Coalition|Board|Bureau|Commission|Development|Business|Community|Collective|Weekly|Wire|Daily|Journal|News|Times|Report|Roundup|SBDC|GovCon|Fed|Federal|Small|Systems|Partners|Partnership|Company|Media|Digital|Technologies|Technology|Tech|Global|National|State|Regional|Contract|Contracts|Contracting|Procurement|Proposal|Proposals|Capture|Academy|Training|Insights|Exchange|Hub|Works|Advisors|Advisory|Professional|Assurance|Associates|Enterprises|Enterprise|Ventures|Holdings|Labs|Lab|Studio|Select|Experience|Pricing|Strategies|Strategy|Firm|Practice|Guild|Intelligence|Data|Cloud|Software|Platform|Bid|Bids|Winners|Success|Assurance)\b', re.I)
SUFFIX=re.compile(r'\b(Jr|Sr|II|III|IV|PhD|Ph\.D|MBA|CPCM|CFCM|CPP|APMP|Esq)\b\.?', re.I)

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))

def slug(*parts):
    s=strip_accents(' '.join(p for p in parts if p)).lower()
    s=re.sub(r'[^a-z0-9]+','-',s).strip('-')
    return s[:70] or 'unknown'

def clean_url(u):
    u=re.sub(r'\s+','',u.strip())
    return u if u.startswith('http') else ''

def clean_email(raw):
    """Return (email, malformed_reason). Column bleed and line-wrap artifacts are common."""
    e=raw.strip()
    if '@' not in e: return '', ''
    e=re.sub(r'\s+','',e)                      # line-wrap inserted a space mid-address
    if EMAIL_RE.match(e): return e.lower(), ''
    # Column bleed: the Email Type text ran into the address. Salvage a clean prefix.
    m=re.match(r'^([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+?\.(?:com|org|net|edu|gov|mil|us|io|ai|co))(?=[A-Z]|$)', e)
    if m: return m.group(1).lower(), 'salvaged from a column-bleed artifact'
    return '', 'unparseable'

def person_name(n):
    """True when the Contact Name is a human name a greeting can use."""
    n=SUFFIX.sub('', n).replace('.', '. ').strip()
    n=re.sub(r'\s+', ' ', n)
    if '/' in n or ',' in n: return False
    n=re.sub(r"['\"‘’“”]", '', n)
    parts=[p for p in n.split() if p]
    if not 2 <= len(parts) <= 4: return False
    if ORGWORD.search(n): return False
    # An acronym token (GCR, NCMA, DC, AI) or internal capitals (OrangeSlices)
    # is a brand, not a given name. Single-letter initials stay allowed.
    for p in parts:
        bare = p.strip('.')
        if len(bare) >= 2 and bare.isupper(): return False
        if re.search(r'[a-z][A-Z]', bare): return False
    return all(re.match(r"^[A-Z][A-Za-z\-]*\.?$", p) for p in parts)

def first_name(n):
    n=re.sub(r"['\"‘’“”]", '', SUFFIX.sub('', n)).strip()
    p=[x for x in n.split() if x]
    if not p: return ''
    f=p[0].strip('.')
    if len(f)<=2 and len(p)>1:      # "J. Smith" -> use the second token
        f=p[1].strip('.')
    if len(f)<2 or not f.isalpha(): return ''
    return f[0].upper()+f[1:] if f.isupper() and len(f)>3 else f


def read_page(pageno, merge=False):
    # merge_wraps is only correct for the master table, whose column 0 is a
    # known segment vocabulary. On the newsletter tab column 0 is a newsletter
    # title, so every row would look like a continuation of the first.
    names, recs = parse(pageno)
    if merge:
        recs = merge_wraps(names, recs)
    return names, [dict(zip(names, r)) for r in recs]

master=[]
for _pg in MASTER_PAGES:
    master += read_page(_pg, merge=True)[1]

got = Counter(x['Segment'] for x in master)
if dict(got) != EXPECTED:
    raise SystemExit(
        'extraction does not reconcile with the source dashboard:\n'
        f'  got      {dict(sorted(got.items()))}\n'
        f'  expected {dict(sorted(EXPECTED.items()))}'
    )
print(f'extracted {len(master)} master records, reconciled against the source dashboard')

rows=[]
for x in master:
    rows.append({
        'segment': x['Segment'].strip(), 'name': x['Contact Name'].strip(),
        'org': x['Organization / Brand'].strip(), 'role': x['Role / Title'].strip(),
        'state': x['State / Region'].strip(), 'rawEmail': x['Public Business Email'],
        'emailType': x['Email Type'].strip(), 'website': x['Website'],
        'contactForm': x['Contact Form / Booking URL'], 'linkedin': x['LinkedIn URL'],
        'youtube': x['YouTube URL'], 'instagram': x['Instagram URL'], 'tiktok': x['TikTok URL'],
        'audience': x['Audience / Followers'].strip(), 'reachTier': x['Reach Tier'].strip(),
        'partnerType': x['Partner Type'].strip(), 'affiliate': x['Affiliate Potential'].strip(),
        'priority': x['Outreach Priority'].strip(), 'angle': x['Suggested Outreach Angle'].strip(),
        'sourceUrl': x['Source URL'], 'verification': x['Verification Status'].strip(),
        'verifiedAt': x['Date Verified'].strip(), 'notes': x['Notes'].strip(),
    })

# Net-new newsletter publishers that appear only on the newsletter tab.
known={r['rawEmail'].strip().lower() for r in rows}
knownorg={r['org'].lower() for r in rows}|{r['name'].lower() for r in rows}
for x in read_page(NEWSLETTER_PAGE)[1]:
    e=x['Public Email'].strip().lower()
    pub=x['Publisher'].strip()
    if e and e in known: continue
    if pub.lower() in knownorg or pub.lower().split(' / ')[0] in knownorg: continue
    rows.append({
        'segment':'Newsletter','name':pub,'org':x['Newsletter / List'].strip(),'role':'Publisher',
        'state':'','rawEmail':x['Public Email'],'emailType':'Newsletter contact',
        'website':x['Website / Source'],'contactForm':'','linkedin':'','youtube':'','instagram':'','tiktok':'',
        'audience':'','reachTier':'','partnerType':'Newsletter / Publisher','affiliate':'',
        'priority':x['Priority'].strip(),'angle':x['Notes'].strip(),
        'sourceUrl':x['Website / Source'],'verification':'Newsletter tab, public listing',
        'verifiedAt':'2026-08-31','notes':'Newsletter tab record.',
    })

# ---- derive -------------------------------------------------------------
contacts=[]
for r in rows:
    email, mal = clean_email(r['rawEmail'])
    isperson = person_name(r['name'])
    fn = first_name(r['name']) if isperson else ''
    seg = r['segment']
    holds=[]
    if not email:
        holds.append('no-public-email' if not mal else f'unparseable-email ({mal})')
    if mal=='salvaged from a column-bleed artifact':
        holds.append('email-salvaged-from-pdf-artifact')
    if email and INFERRED.search(r['verification']):
        holds.append('email-not-first-party-verified')
    # The suggested-angle cell is where the newsletter tab records the judgement:
    # GovDash is filed there as "Direct competitor; monitor more than pitch".
    if COMPETITOR.search(r['partnerType']) or COMPETITOR.search(r['notes']) or COMPETITOR.search(r['angle']):
        holds.append('competitor')
    if seg=='Government / Distribution':
        holds.append('government-mailbox')
    elif (GOV_ENTITY.search(r['org']) or GOV_ENTITY.search(r['name'])) and not COMMERCIAL_BRAND.search(r['org']+' '+r['name']):
        # A federal agency is not a partnership prospect, whatever its mail host.
        holds.append('government-entity')
    dom = email.split('@')[-1] if email else ''
    if dom.endswith('.mil') or dom.endswith('.gov'):
        holds.append('government-mailbox') if 'government-mailbox' not in holds else None
    contacts.append({
        'id': slug(r['name'] or r['org'], r['org'] if r['name'] else ''),
        'segment': SEGKEY[seg], 'campaign': SEG2CAMPAIGN[seg],
        'name': r['name'], 'firstName': fn, 'nameIsPerson': isperson,
        'org': r['org'], 'role': r['role'], 'state': r['state'],
        'email': email, 'emailType': r['emailType'],
        'emailClass': ('none' if not email else 'role' if ROLE_LOCAL.match(email.split('@')[0]) else 'person'),
        'website': clean_url(r['website']),
        'links': {k: clean_url(r[k]) for k in ('contactForm','linkedin','youtube','instagram','tiktok') if clean_url(r[k])},
        'audience': r['audience'], 'reachTier': r['reachTier'],
        'partnerType': r['partnerType'], 'affiliatePotential': r['affiliate'],
        'priority': r['priority'] or 'P2', 'angle': r['angle'],
        'sourceUrl': clean_url(r['sourceUrl']) or r['sourceUrl'].strip(),
        'verification': r['verification'], 'verifiedAt': r['verifiedAt'],
        'notes': r['notes'],
        'holds': [h for h in holds if h],
    })

# unique ids
seen=Counter()
for c in contacts:
    seen[c['id']]+=1
    if seen[c['id']]>1: c['id']=f"{c['id']}-{seen[c['id']]}"

# duplicate email: keep the highest-priority record, hold the rest
byemail=defaultdict(list)
for c in contacts:
    if c['email']: byemail[c['email']].append(c)
for e,group in byemail.items():
    if len(group)==1: continue
    group.sort(key=lambda c:(c['priority'], 0 if c['nameIsPerson'] else 1))
    for c in group[1:]:
        c['holds'].append(f'duplicate-email (kept {group[0]["id"]})')

# One contact per organization, and then one per sending domain.
#
# An association or an accelerator that gets eight separate cold emails files one
# complaint, not eight replies. The organization cap catches most of it. The
# domain cap catches what the source's own naming hides: seven Ohio University
# APEX counselors are filed under four different organization strings ("Ohio
# APEX Accelerator", "Ohio University APEX Accelerator" and so on) and all seven
# read mail at ohio.edu, so only a domain cap sees them as one office. It also
# spans campaigns, which the organization cap deliberately does not: RSM Federal
# is a creator in C1 and a publication in C3, and it is still one company.
#
# Free mail hosts are exempt: two people at gmail.com are two people.
FREE_HOSTS={'gmail.com','outlook.com','yahoo.com','hotmail.com','aol.com','icloud.com','proton.me','me.com'}

def keep_rank(c):
    """Who survives a cap. Priority first, then how likely the address is to work.

    An address that carries the contact's own name is a published personal
    mailbox; one that does not is either a typo or somebody else's inbox, and
    either way it is the weaker of two records for the same organization.
    """
    local=c['email'].split('@')[0].lower()
    parts=[p for p in re.sub(r'[^a-z ]','',c['name'].lower()).split() if p]
    carries=any(len(p)>=4 and p in local for p in parts)
    return (c['priority'], 0 if c['emailClass']=='person' else 1, 0 if carries else 1,
            0 if c['nameIsPerson'] else 1, c['id'])

byorg=defaultdict(list)
for c in contacts:
    if c['email'] and c['org']: byorg[(c['campaign'], c['org'].lower())].append(c)
for (camp,org),group in byorg.items():
    if len(group)==1 or camp is None: continue
    group.sort(key=keep_rank)
    for c in group[1:]:
        if not any(h.startswith('duplicate-email') for h in c['holds']):
            c['holds'].append(f'org-cap (one send per org; kept {group[0]["id"]})')

bydomain=defaultdict(list)
for c in contacts:
    if not c['email'] or c['holds'] or c['campaign'] is None: continue
    dom=c['email'].split('@')[1]
    if dom in FREE_HOSTS: continue
    bydomain[dom].append(c)
for dom,group in bydomain.items():
    if len(group)==1: continue
    group.sort(key=keep_rank)
    for c in group[1:]:
        c['holds'].append(f'domain-cap (one send per sending domain; kept {group[0]["id"]})')

for c in contacts:
    c['sendable'] = bool(c['email']) and not c['holds'] and c['campaign'] is not None
    c['holds'] = sorted(set(c['holds']))

doc={
  'version':1,
  'generatedAt':'2026-09-03',
  'source':{
    'file':'GovCon_Influencer_Outreach_Database_200plus.pdf',
    'researched':'2026-08-31',
    'tabs':['Master 200+','Dashboard 200+','Newsletters'],
    'note':'Public business contacts only. Record count and per-segment counts reconcile exactly with the PDF Expansion Dashboard (254 total).',
  },
  'campaigns':{
    'C1':'Creators and influencers',
    'C2':'Podcasts and newsletters',
    'C3':'GovCon media and blogs',
    'C4':'Proposal and capture consultants',
    'C5':'APEX advisors and GovCon education',
    'C6':'Associations and communities',
  },
  'contacts':contacts,
}
json.dump(doc, open(OUT,'w'), indent=2, ensure_ascii=False)
print('wrote', OUT, len(contacts), 'contacts')
print('by campaign:', Counter(c['campaign'] for c in contacts))
print('sendable   :', Counter(c['campaign'] for c in contacts if c['sendable']))
print('holds      :')
for k,v in Counter(h.split(' (')[0] for c in contacts for h in c['holds']).most_common(): print(f'   {v:4d}  {k}')
