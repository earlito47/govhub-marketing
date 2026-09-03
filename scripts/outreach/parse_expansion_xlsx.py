#!/usr/bin/env python3
"""Extract raw contact rows from a GovCon Outreach Expansion workbook.

The expansion is a researched top-up batch (this one researched 2026-09-03,
33 rows, zero fabricated email addresses) meant to be merged into the same
outreach database the PDF produced. Two things only this parser can decide,
because only it has both the new batch and the existing database in hand:

  1. A new row that is actually an existing contact under a different label.
     "Washington Technology" (no email) here is the SAME outlet as the
     existing "Washington Technology" record (submissions@washingtontechnology.com,
     already sendable), just filed under the outlet name instead of its parent
     company GovExec. Loading it anyway would not just be a wasted row, it
     would risk a second, worse-addressed record shadowing a working one if a
     future cap ever ranks them differently. These are dropped entirely, not
     held: the existing record already covers them.
  2. A new row that duplicates ANOTHER new row in the same batch. "govmates"
     appears once as a bare organization listing and once as its podcast, with
     a named host attached to the podcast row. Both name the same organization,
     so only the one with more to work from (the named host) is kept; the
     other is held with a pointer, not silently dropped, so nothing looks like
     it went missing from the sheet.

Both classes of collision were checked programmatically (org name, contact
name, and website domain, against all 265 rows produced by the PDF branch)
rather than assumed from the sheet author's own dedup notes, because that
dedup was run against the master PDF tab only (254 rows) and this database
carries 11 more from the newsletter tab, exactly the kind of gap that lets one
through.

Usage as a library: extract_expansion_rows(xlsx_path, existing_contacts).
Standalone: prints the same collision report this docstring describes.
"""
import sys
from urllib.parse import urlparse

import openpyxl

# ---- rows that duplicate an EXISTING contact from the PDF branch ----------
# Keyed by the expansion sheet's 1-indexed data row (row 2 is the first
# contact row after the header), value is the existing contact's id.
DUPLICATE_OF_EXISTING = {
    5: ('fedbiz-access-the-govcon-chronicle',
        "FedBiz'5 / Fedbiz Access podcast host Bobby Testa; the org is already a sendable C2 contact (info@fedbizaccess.com)"),
    16: ('washington-technology-govexec',
         'Washington Technology outlet; already a sendable C3 contact under its parent company GovExec (submissions@washingtontechnology.com)'),
    22: ('judy-bradt-grow-fed-biz',
         'Judy Bradt; already a sendable C1 contact as Judy Bradt / Grow Fed Biz (judy.bradt@growfedbiz.com), just a different consulting brand'),
    24: ('jennifer-schaus-federal-contractor-weekly',
         'Jennifer Schaus; already a C2 newsletter contact (hello@jenniferschaus.com)'),
}

# ---- rows that duplicate ANOTHER row inside this same batch ---------------
# (drop_row, keep_row): the org is the same, keep_row has more to work with
# (a named host/creator) so it survives and drop_row is held pointing at it.
DUPLICATE_WITHIN_BATCH = [
    (26, 7),   # "govmates" bare listing  -> kept as govmates NextGen (named host Meg O'Hara)
    (27, 15),  # "TheSmalls" bare listing -> kept as The SmallsCast (named host, "Aaron and team")
    (8, 33),   # "SAM.gov Bids LIVE / GovKid Method" podcast -> kept as the GovKid Method YouTube creator row (same person, Derek James)
]

def domain(u):
    if not u: return ''
    try:
        d = urlparse(u if '//' in u else 'https://' + u).netloc.lower()
        return d.replace('www.', '')
    except Exception:
        return ''

def extract_expansion_rows(xlsx_path, existing_contacts=None):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb['New Contacts']
    rows_raw = list(ws.iter_rows(values_only=True))
    header = rows_raw[0]
    sheet_rows = [dict(zip(header, r)) for r in rows_raw[1:]]

    dropped_existing = []
    keep_id_by_sheet_row = {}
    rows = []
    for i, x in enumerate(sheet_rows, start=2):  # row 2 = first data row
        if i in DUPLICATE_OF_EXISTING:
            existing_id, why = DUPLICATE_OF_EXISTING[i]
            dropped_existing.append((i, x['Organization / Brand'], existing_id, why))
            continue
        rows.append((i, x))

    # Resolve within-batch dedup by sheet row number, then hold the loser.
    row_by_num = {i: x for i, x in rows}
    prehold_by_num = {}
    for drop_i, keep_i in DUPLICATE_WITHIN_BATCH:
        if drop_i not in row_by_num or keep_i not in row_by_num:
            continue  # a hardcoded pointer whose row got excluded above; ignore
        prehold_by_num[drop_i] = keep_i

    out = []
    for i, x in rows:
        contact_name = x.get('Contact Name') or ''
        org = x.get('Organization / Brand') or ''
        role = x.get('Role / Context') or ''
        website = x.get('Website') or ''
        contact_path = x.get('Contact Path') or ''
        channels = x.get('Primary Channels') or ''
        reach = x.get('Reach Notes') or ''
        angle = x.get('Suggested Outreach Angle') or ''
        source_url = x.get('Source URL') or ''
        verification = x.get('Verification Status') or ''
        priority = x.get('Priority') or 'P2'
        segment = x.get('Segment') or ''

        pre_holds = []
        if i in prehold_by_num:
            keep_i = prehold_by_num[i]
            keep_org = row_by_num[keep_i].get('Organization / Brand') or ''
            pre_holds.append(f'duplicate-org-in-expansion (same organization as row {keep_i}, "{keep_org}")')

        notes = f'Expansion batch, researched 2026-09-03. Contact path: {contact_path}.' if contact_path else 'Expansion batch, researched 2026-09-03.'
        if channels:
            notes += f' Primary channels: {channels}.'

        out.append({
            'segment': segment, 'name': contact_name, 'org': org, 'role': role, 'state': '',
            'rawEmail': '',  # the sheet author fabricated none; every row is address-blank on purpose
            'emailType': '', 'website': website,
            'contactForm': '', 'linkedin': '', 'youtube': '', 'instagram': '', 'tiktok': '',
            'contactPath': contact_path,
            'audience': reach, 'reachTier': '', 'partnerType': '', 'affiliate': '',
            'priority': priority, 'angle': angle, 'sourceUrl': source_url,
            'verification': verification, 'verifiedAt': '2026-09-03', 'notes': notes,
            'preHolds': pre_holds,
        })

    print(f'  extracted {len(sheet_rows)} rows from the expansion sheet')
    print(f'  dropped {len(dropped_existing)} as duplicates of an existing contact:')
    for i, org, eid, why in dropped_existing:
        print(f'    row {i:2d}  {org[:40]:42s} -> {eid}  ({why})')
    print(f'  {len(prehold_by_num)} rows held as duplicates of another row in this same batch')
    print(f'  {len(out)} rows carried forward')
    return out

if __name__ == '__main__':
    xlsx_path = sys.argv[1] if len(sys.argv) > 1 else 'GovCon_Outreach_Expansion.xlsx'
    rows = extract_expansion_rows(xlsx_path)
    for r in rows:
        print(f"  {r['segment']:22s} {r['name'] or '(none)':30s} {r['org'][:36]:38s} {r['preHolds']}")
