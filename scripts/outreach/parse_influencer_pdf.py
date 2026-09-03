#!/usr/bin/env python3
"""Extract raw contact rows from the GovCon Influencer & Media Outreach
Database PDF (researched 2026-08-31, public business contacts only).

Standalone usage rebuilds data/govcon-influencer-outreach.json from this
source alone:

    pip install pdfplumber
    python3 scripts/outreach/parse_influencer_pdf.py path/to/GovCon_Influencer_Outreach_Database_200plus.pdf

To combine this source with a later expansion batch, use
build-influencer-db.py instead, which imports extract_pdf_rows() from here.

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
  * extract_pdf_rows() reconciles record count and every per-segment count
    against the PDF's own Expansion Dashboard (254 total) and raises if they
    do not match, rather than silently emitting a short list.

Derived fields and the holds they produce are documented in
scripts/outreach/influencer-db.mjs, which is what consumes the final output.
"""
import sys
from collections import Counter

import pdfplumber

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
    chars = sorted(page.chars, key=lambda c: (c['top'], c['x0']))
    lines = []; cur = []; curtop = None
    for c in chars:
        if curtop is None or abs(c['top'] - curtop) <= ytol:
            cur.append(c); curtop = curtop if curtop is not None else c['top']
        else:
            lines.append((curtop, cur)); cur = [c]; curtop = c['top']
    if cur: lines.append((curtop, cur))
    return lines

def toks(cs, gap=0.30):
    cs = sorted(cs, key=lambda c: c['x0'])
    out = []; buf = cs[0]['text']; x0 = cs[0]['x0']; prev = cs[0]['x1']
    for c in cs[1:]:
        if c['x0'] - prev > gap:
            out.append((x0, buf)); buf = c['text']; x0 = c['x0']
        else:
            buf += c['text']
        prev = c['x1']
    out.append((x0, buf)); return out

def parse_page(pdf, pageno):
    p = pdf.pages[pageno - 1]
    ls = text_lines(p)
    hdr = toks(ls[0][1])
    bounds = [x for x, _ in hdr]; names = [t.strip() for _, t in hdr]

    def colof(x):
        best = 0
        for i, b in enumerate(bounds):
            if x >= b - 0.6: best = i
        return best

    recs = []
    for top, cs in ls[1:]:
        tk = toks(cs)
        cells = {}
        for x, t in tk:
            i = colof(x)
            cells[i] = (cells.get(i, '') + ' ' + t).strip() if i in cells else t.strip()
        isnew = 0 in cells
        if isnew:
            r = [''] * len(names)
            for i, v in cells.items():
                if i < len(names): r[i] = v
            recs.append(r)
        elif recs:
            for i, v in cells.items():
                if i < len(names):
                    prev = recs[-1][i]
                    recs[-1][i] = (prev + (' ' if prev and not prev.endswith('-') else '') + v) if prev else v
    return names, recs

VALID_SEGMENTS = {'Creator', 'Media', 'Podcast', 'Consultant / Firm', 'Consultant / Individual',
                   'APEX / Advisor', 'Association / Community', 'Government / Distribution'}

def merge_wraps(names, recs):
    """Two segment values wrap ACROSS column 0 ("Association /" then "Community"
    on the next line with nothing else in it), which reads as two records unless
    rejoined against the known segment vocabulary."""
    out = []
    for r in recs:
        seg = r[0].strip()
        if out and seg not in VALID_SEGMENTS:
            prev = out[-1]
            cand = (prev[0].strip() + ' ' + seg).strip()
            if cand in VALID_SEGMENTS or prev[0].strip() not in VALID_SEGMENTS:
                prev[0] = cand
                for i in range(1, len(names)):
                    if r[i]:
                        prev[i] = (prev[i] + (' ' if prev[i] and not prev[i].endswith('-') else '') + r[i]) if prev[i] else r[i]
                continue
        out.append(list(r))
    return out

def read_page(pdf, pageno, merge=False):
    # merge_wraps is only correct for the master table, whose column 0 is a
    # known segment vocabulary. On the newsletter tab column 0 is a newsletter
    # title, so every row would look like a continuation of the first.
    names, recs = parse_page(pdf, pageno)
    if merge:
        recs = merge_wraps(names, recs)
    return names, [dict(zip(names, r)) for r in recs]

def extract_pdf_rows(pdf_path):
    """Return a list of row dicts in the shared schema derive_one() expects."""
    pdf = pdfplumber.open(pdf_path)

    master = []
    for pg in MASTER_PAGES:
        master += read_page(pdf, pg, merge=True)[1]

    got = Counter(x['Segment'] for x in master)
    if dict(got) != EXPECTED:
        raise SystemExit(
            'PDF extraction does not reconcile with the source dashboard:\n'
            f'  got      {dict(sorted(got.items()))}\n'
            f'  expected {dict(sorted(EXPECTED.items()))}'
        )
    print(f'  extracted {len(master)} master records from the PDF, reconciled against its own dashboard')

    rows = []
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
    known = {r['rawEmail'].strip().lower() for r in rows if r['rawEmail']}
    knownorg = {r['org'].lower() for r in rows} | {r['name'].lower() for r in rows}
    for x in read_page(pdf, NEWSLETTER_PAGE)[1]:
        e = (x['Public Email'] or '').strip().lower()
        pub = x['Publisher'].strip()
        if e and e in known: continue
        if pub.lower() in knownorg or pub.lower().split(' / ')[0] in knownorg: continue
        rows.append({
            'segment': 'Newsletter', 'name': pub, 'org': x['Newsletter / List'].strip(), 'role': 'Publisher',
            'state': '', 'rawEmail': x['Public Email'], 'emailType': 'Newsletter contact',
            'website': x['Website / Source'], 'contactForm': '', 'linkedin': '', 'youtube': '', 'instagram': '', 'tiktok': '',
            'audience': '', 'reachTier': '', 'partnerType': 'Newsletter / Publisher', 'affiliate': '',
            'priority': x['Priority'].strip(), 'angle': x['Notes'].strip(),
            'sourceUrl': x['Website / Source'], 'verification': 'Newsletter tab, public listing',
            'verifiedAt': '2026-08-31', 'notes': 'Newsletter tab record.',
        })

    return rows

if __name__ == '__main__':
    import json
    sys.path.insert(0, __file__.rsplit('/', 1)[0])
    from lib_influencer_db import derive_one, apply_caps

    pdf_path = sys.argv[1] if len(sys.argv) > 1 else 'GovCon_Influencer_Outreach_Database_200plus.pdf'
    rows = extract_pdf_rows(pdf_path)
    contacts = [derive_one(r, 'master-pdf-2026-08-31') for r in rows]
    apply_caps(contacts)

    doc = {
        'version': 1, 'generatedAt': '2026-09-03',
        'source': {
            'file': 'GovCon_Influencer_Outreach_Database_200plus.pdf',
            'researched': '2026-08-31',
            'tabs': ['Master 200+', 'Dashboard 200+', 'Newsletters'],
            'note': 'Public business contacts only. Record count and per-segment counts reconcile exactly with the PDF Expansion Dashboard (254 total).',
        },
        'campaigns': {
            'C1': 'Creators and influencers', 'C2': 'Podcasts and newsletters', 'C3': 'GovCon media and blogs',
            'C4': 'Proposal and capture consultants', 'C5': 'APEX advisors and GovCon education',
            'C6': 'Associations and communities',
        },
        'contacts': contacts,
    }
    out = 'data/govcon-influencer-outreach.json'
    json.dump(doc, open(out, 'w'), indent=2, ensure_ascii=False)
    print(f'wrote {out}, {len(contacts)} contacts (PDF source only; run build-influencer-db.py to include the expansion batch)')
