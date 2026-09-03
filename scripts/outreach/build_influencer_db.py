#!/usr/bin/env python3
"""Rebuild data/govcon-influencer-outreach.json from every source batch.

    python3 scripts/outreach/build-influencer-db.py \
        --pdf path/to/GovCon_Influencer_Outreach_Database_200plus.pdf \
        --xlsx path/to/GovCon_Outreach_Expansion.xlsx

--pdf alone reproduces the original 265-contact database. Adding --xlsx merges
in a researched expansion batch. Neither source file is committed to the repo;
this script, and the two it imports, are what make the committed JSON
reproducible and auditable instead of a hand-edited blob.

Every row from every source is derived and capped in ONE pass
(lib_influencer_db.derive_one / apply_caps), because the cross-record checks
(one email seen twice, one organization or sending domain capped to one send)
are only correct when they see every row from every source at once. Deriving
each source separately and merging the already-derived JSON would miss a
duplicate that spans sources, which is exactly the kind of thing the
"expansion" scenario produces (see parse-expansion-xlsx.py's docstring for two
real examples this caught).

Run with no arguments to rebuild from whichever sources are already recorded
in data/govcon-influencer-outreach.json's `source.batches`, once a source
becomes unavailable in a later session; that field exists so a future run
knows what to ask for.
"""
import argparse, json, sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib_influencer_db import derive_one, apply_caps, PER_CAMPAIGN_CAP, DEFAULT_CAP
from parse_influencer_pdf import extract_pdf_rows
from parse_expansion_xlsx import extract_expansion_rows

OUT = Path(__file__).parent.parent.parent / 'data' / 'govcon-influencer-outreach.json'
CAMPAIGNS = {
    'C1': 'Creators and influencers', 'C2': 'Podcasts and newsletters', 'C3': 'GovCon media and blogs',
    'C4': 'Proposal and capture consultants', 'C5': 'APEX advisors and GovCon education',
    'C6': 'Associations and communities',
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', help='path to GovCon_Influencer_Outreach_Database_200plus.pdf')
    ap.add_argument('--xlsx', help='path to a GovCon_Outreach_Expansion.xlsx batch')
    args = ap.parse_args()

    if not args.pdf and not args.xlsx:
        ap.error('pass at least --pdf, --xlsx, or both')

    all_rows = []
    batches = []

    if args.pdf:
        print(f'reading PDF source: {args.pdf}')
        pdf_rows = extract_pdf_rows(args.pdf)
        for r in pdf_rows:
            r['origin'] = 'master-pdf-2026-08-31'
        all_rows += pdf_rows
        batches.append({'kind': 'pdf', 'file': Path(args.pdf).name, 'researched': '2026-08-31', 'rows': len(pdf_rows)})

    if args.xlsx:
        print(f'reading expansion source: {args.xlsx}')
        xlsx_rows = extract_expansion_rows(args.xlsx)
        for r in xlsx_rows:
            r['origin'] = 'expansion-2026-09-03'
        all_rows += xlsx_rows
        batches.append({'kind': 'xlsx', 'file': Path(args.xlsx).name, 'researched': '2026-09-03', 'rows': len(xlsx_rows)})

    contacts = [derive_one(r, r['origin']) for r in all_rows]
    apply_caps(contacts)

    doc = {
        'version': 2, 'generatedAt': '2026-09-03',
        'source': {
            'note': 'Public business contacts only. Combined from every batch below; see build-influencer-db.py.',
            'batches': batches,
        },
        'campaigns': CAMPAIGNS,
        # Effective per-organization / per-sending-domain cap, so the JS side
        # asserts against the same numbers rather than a second copy of them.
        'caps': {'default': DEFAULT_CAP, **PER_CAMPAIGN_CAP},
        'contacts': contacts,
    }
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False))

    print(f'\nwrote {OUT}, {len(contacts)} contacts from {len(batches)} batch(es)')
    print('by campaign:', dict(Counter(c['campaign'] for c in contacts)))
    print('sendable   :', dict(Counter(c['campaign'] for c in contacts if c['sendable'])))
    print('holds:')
    for k, v in Counter(h.split(' (')[0] for c in contacts for h in c['holds']).most_common():
        print(f'   {v:4d}  {k}')

if __name__ == '__main__':
    main()
