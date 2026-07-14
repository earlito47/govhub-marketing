#!/usr/bin/env python3
"""GovHub Lead Engine — ICP company list + contacts from free federal data.

Layer 1   USASpending (no key)      WHO wins contracts, how often, how big
Layer 2   SBA certification search  email / phone / contact person (free, no key)
Layer 2b  SAM.gov entity API        website / certs / POC name (needs SAM_API_KEY;
                                    POC email+phone are FOUO-gated on public keys)
Layer 3   Tomba domain search       fallback emails where registries had none
                                    (TOMBA_API_KEY, budget-capped)

    pip install -r requirements.txt
    python govhub_leadgen.py --probe        # tiny sample, shows real field yields first
    python govhub_leadgen.py --count        # volume only, no rows
    python govhub_leadgen.py --full --enrich-top 500 --tomba-budget 80 -o out/leads.xlsx
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

import enrich_sam
import enrich_sba
import enrich_tomba
import report
import usaspending

# ---------------------------------------------------------------------------
# TARGETING — edit this block. This is the whole strategy.
# ---------------------------------------------------------------------------

# Firms that write a lot of proposals. Services-heavy, low capital, competitive.
NAICS = [
    "541511",  # Custom Computer Programming
    "541512",  # Computer Systems Design
    "541519",  # Other Computer Related Services
    "541330",  # Engineering Services
    "541611",  # Admin & General Management Consulting
    "541618",  # Other Management Consulting
    "541990",  # Other Professional/Scientific/Technical
    "561210",  # Facilities Support Services
    "561612",  # Security Guard Services
    "236220",  # Commercial Building Construction
    "237310",  # Highway/Street/Bridge Construction
    "238220",  # Plumbing/HVAC Contractors
    "621111",  # Offices of Physicians (VA work)
    "611430",  # Professional & Management Training
]

# The money band. Below the floor: too small to pay $129-699/mo.
# Above the ceiling: they have a captured proposal team and use Deltek.
MIN_AWARD = 100_000
MAX_AWARD = 25_000_000

# ---------------------------------------------------------------------------


def tier_of(count, total):
    """A company that won 3+ contracts in 18 months wrote a dozen proposals —
    that's a person with a recurring, painful, expensive problem. A company
    with one $20M award is a company with a contract, not a proposal habit."""
    if count >= 3 and total < 15_000_000:
        return "A - serial bidder"
    if count == 2:
        return "B - repeat bidder"
    if count == 1 and total < 2_000_000:
        return "C - occasional"
    return "D - review"


def _naics_code(v):
    if isinstance(v, dict):
        return str(v.get("code") or "")
    return str(v or "")


def roll_up(award_rows):
    """Awards -> one row per company (keyed by UEI), with a proposal-cadence signal."""
    seen_awards = set()
    by = defaultdict(lambda: {
        "name": "", "uei": "", "recipient_id": "", "awards": 0, "total": 0.0,
        "agencies": set(), "naics": set(), "states": set(), "last": "",
    })
    for a in award_rows:
        aid = a.get("generated_internal_id") or f"{a.get('Award ID')}|{a.get('Awarding Agency')}"
        if aid in seen_awards:
            continue
        seen_awards.add(aid)
        name = (a.get("Recipient Name") or "").strip()
        if not name or name.upper().startswith("MULTIPLE RECIPIENTS"):
            continue
        uei = (a.get("Recipient UEI") or "").strip()
        key = uei or (a.get("recipient_id") or "").strip() or name.upper()
        c = by[key]
        c["name"] = c["name"] or name
        c["uei"] = c["uei"] or uei
        c["recipient_id"] = c["recipient_id"] or (a.get("recipient_id") or "")
        c["awards"] += 1
        c["total"] += float(a.get("Award Amount") or 0)
        if a.get("Awarding Agency"):
            c["agencies"].add(a["Awarding Agency"])
        code = _naics_code(a.get("NAICS"))
        if code:
            c["naics"].add(code)
        if a.get("Place of Performance State Code"):
            c["states"].add(a["Place of Performance State Code"])
        sd = a.get("Start Date") or ""
        if sd > c["last"]:
            c["last"] = sd

    out = []
    for c in by.values():
        out.append({
            "company": c["name"],
            "uei": c["uei"],
            "award_count": c["awards"],
            "total_awarded": round(c["total"], 2),
            "avg_award": round(c["total"] / c["awards"], 2),
            "last_award_date": c["last"],
            "agency_count": len(c["agencies"]),
            "agencies": "; ".join(sorted(c["agencies"]))[:250],
            "naics": "; ".join(sorted(c["naics"]))[:120],
            "award_states": "; ".join(sorted(c["states"]))[:60],
            "tier": tier_of(c["awards"], c["total"]),
        })
    df = pd.DataFrame(out)
    if df.empty:
        return df
    return df.sort_values(["tier", "award_count"], ascending=[True, False]).reset_index(drop=True)


# --- enrichment waterfall ---------------------------------------------------

CONTACT_COLS = ["email", "email_source", "phone", "phone_source", "contact_person",
                "website", "sba_certs", "city", "state_hq", "poc_name", "poc_title",
                "sam_status", "business_types", "tomba_position", "tomba_score",
                "tomba_accept_all"]


def enrich(df, top_n, use_sam=True, use_tomba=True, tomba_budget=80, verbose=True):
    sub = df.head(top_n).copy()
    for col in CONTACT_COLS:
        sub[col] = ""
    sub["email_source"] = "none"
    sub["phone_source"] = "none"

    # Layer 2: SBA certification search (free) — the primary email/phone source
    if verbose:
        print(f"\n  SBA lookups on {len(sub)} companies (free, cached)...", flush=True)
    sba_hits = 0
    for i, (idx, row) in enumerate(sub.iterrows(), 1):
        p = enrich_sba.sba_profile(row["uei"])
        if p.get("found"):
            sba_hits += 1
            if p.get("email"):
                sub.at[idx, "email"], sub.at[idx, "email_source"] = p["email"], "sba"
            if p.get("phone"):
                sub.at[idx, "phone"], sub.at[idx, "phone_source"] = p["phone"], "sba"
            sub.at[idx, "contact_person"] = p.get("contact_person", "")
            sub.at[idx, "website"] = p.get("website", "")
            sub.at[idx, "sba_certs"] = "; ".join(p.get("certs") or [])
            sub.at[idx, "city"] = p.get("city", "")
            sub.at[idx, "state_hq"] = p.get("state", "")
        if verbose and i % 50 == 0:
            print(f"    {i}/{len(sub)} ({sba_hits} SBA profiles found)", flush=True)
    if verbose:
        print(f"    done: {sba_hits}/{len(sub)} have an SBA profile", flush=True)

    # Layer 2b: SAM.gov — only if a key is present; fills website/POC/certs gaps
    key = enrich_sam.sam_key()
    if use_sam and key:
        todo = [r["uei"] for _, r in sub.iterrows() if r["uei"] and not r["website"]]
        if verbose:
            print(f"  SAM batches for {len(todo)} companies (100/request)...", flush=True)
        try:
            for start in range(0, len(todo), 100):
                got = enrich_sam.sam_batch(todo[start:start + 100], key)
                for idx, row in sub.iterrows():
                    e = got.get(row["uei"])
                    if not e or not e.get("found"):
                        continue
                    sub.at[idx, "website"] = sub.at[idx, "website"] or e.get("website", "")
                    sub.at[idx, "poc_name"] = e.get("poc_name", "")
                    sub.at[idx, "poc_title"] = e.get("poc_title", "")
                    sub.at[idx, "sam_status"] = e.get("sam_status", "")
                    sub.at[idx, "business_types"] = e.get("business_types", "")
                    sub.at[idx, "city"] = sub.at[idx, "city"] or e.get("city", "")
                    sub.at[idx, "state_hq"] = sub.at[idx, "state_hq"] or e.get("state", "")
                    if e.get("poc_email") and not sub.at[idx, "email"]:
                        sub.at[idx, "email"], sub.at[idx, "email_source"] = e["poc_email"], "sam"
                    if e.get("poc_phone") and not sub.at[idx, "phone"]:
                        sub.at[idx, "phone"], sub.at[idx, "phone_source"] = e["poc_phone"], "sam"
        except enrich_sam.SamQuota as e:
            print(f"  ! SAM quota reached, continuing without it: {e}", file=sys.stderr)
    elif use_sam and verbose:
        print("  SAM layer dormant (no SAM_API_KEY set) — websites/POC names skipped for non-SBA firms.")

    # Layer 3: Tomba — only for rows that still lack an email but have a domain
    kv = enrich_tomba.creds() if use_tomba else None
    if kv:
        q = enrich_tomba.quota(kv)
        remaining = None
        if isinstance(q.get("available"), int) and isinstance(q.get("used"), int):
            remaining = max(0, q["available"] - q["used"])
        budget = min(tomba_budget, remaining) if remaining is not None else tomba_budget
        candidates = [(idx, enrich_tomba.domain_of(row["website"]))
                      for idx, row in sub.iterrows()
                      if not row["email"] and enrich_tomba.domain_of(row["website"])]
        if verbose:
            print(f"  Tomba: plan={q.get('plan') or '?'} used={q.get('used')}/{q.get('available')}; "
                  f"{len(candidates)} candidates, budget {budget}", flush=True)
        spent = 0
        for idx, domain in candidates:
            if spent >= budget:
                break
            t = enrich_tomba.domain_search(domain, kv)
            if "error" not in t and not t.get("_cached"):
                spent += 1
            if t.get("found") and t.get("email"):
                sub.at[idx, "email"], sub.at[idx, "email_source"] = t["email"], "tomba"
                if t.get("email_name") and not sub.at[idx, "contact_person"]:
                    sub.at[idx, "contact_person"] = t["email_name"]
                sub.at[idx, "tomba_position"] = str(t.get("email_position") or "")
                sub.at[idx, "tomba_score"] = str(t.get("email_score") or "")
                sub.at[idx, "tomba_accept_all"] = "Y" if t.get("accept_all") else ""
        if verbose:
            print(f"    Tomba searches spent this run: <= {spent}", flush=True)
    elif use_tomba and verbose:
        print("  Tomba layer skipped (TOMBA_API_KEY missing or malformed).")

    return sub


# --- CLI modes ---------------------------------------------------------------

def cmd_probe(args):
    print("PROBE — 3 pages of NAICS 541511 awards (keyless)...")
    awards = usaspending.pull_awards(["541511"], args.months, MIN_AWARD, MAX_AWARD,
                                     pages_per_naics=3)
    print(f"  got {len(awards)} award rows")
    if not awards:
        print("  ! nothing came back — check filters/network"); return
    print("\n  sample award row:")
    print("  " + json.dumps(awards[0], indent=2, default=str)[:700].replace("\n", "\n  "))

    cos = roll_up(awards)
    with_uei = int((cos["uei"] != "").sum())
    print(f"\n  -> {len(cos)} unique companies from 3 pages ({with_uei} with UEI)")
    print(cos.head(10)[["company", "uei", "award_count", "total_awarded", "tier"]]
             .to_string(index=False))

    print("\n  SBA probe on 8 UEIs — WATCH email/phone:")
    shown_keys = False
    for _, r in cos[cos["uei"] != ""].head(8).iterrows():
        p = enrich_sba.sba_profile(r["uei"])
        if p.get("found") and not shown_keys:
            print(f"    [profile fields available: {', '.join(p.get('raw_keys') or [])[:400]}]")
            shown_keys = True
        status = ("NOT IN DSBS" if p.get("not_found")
                  else f"email={p.get('email') or '(none)'}  phone={p.get('phone') or '(none)'}  "
                       f"contact={p.get('contact_person') or '(none)'}  certs={','.join(p.get('certs') or []) or '-'}"
                  if p.get("found") else f"ERROR {p.get('error')}")
        print(f"    {r['company'][:38]:<40} {status}")

    key = enrich_sam.sam_key()
    if key:
        ueis = [u for u in cos["uei"].head(5) if u]
        print(f"\n  SAM probe on {len(ueis)} UEIs (checking POC email/phone visibility)...")
        try:
            got = enrich_sam.sam_batch(ueis, key)
            for u, e in got.items():
                if e.get("found"):
                    print(f"    {u}: poc={e.get('poc_name') or '(none)'} "
                          f"email={e.get('poc_email') or '(FOUO-hidden)'} "
                          f"phone={e.get('poc_phone') or '(FOUO-hidden)'} site={e.get('website') or '-'}")
                else:
                    print(f"    {u}: not found/inactive")
        except enrich_sam.SamQuota as e:
            print(f"    ! SAM quota: {e}")
    else:
        print("\n  SAM layer dormant — set SAM_API_KEY to add websites/POC names/certs.")

    kv = enrich_tomba.creds()
    if kv:
        q = enrich_tomba.quota(kv)
        print(f"\n  Tomba: plan={q.get('plan') or '?'} domain-searches used={q.get('used')} "
              f"available={q.get('available')} (errors: {q.get('error', 'none')})")
    else:
        print("\n  Tomba: TOMBA_API_KEY missing or not in ta_...:ts_... form — layer disabled.")


def cmd_count(args):
    print("COUNT — matching award volume (no row pulls)...")
    total = usaspending.count_awards(NAICS, args.months, MIN_AWARD, MAX_AWARD, args.states)
    print(f"  all 14 NAICS combined: {json.dumps(total)}")
    for code in NAICS:
        c = usaspending.count_awards([code], args.months, MIN_AWARD, MAX_AWARD, args.states)
        print(f"  {code}: {c.get('contracts', 0):>8,} contracts")


def cmd_full(args):
    print(f"FULL PULL — {len(NAICS)} NAICS x up to {args.pages_per_naics} pages each")
    awards = usaspending.pull_awards(NAICS, args.months, MIN_AWARD, MAX_AWARD,
                                     pages_per_naics=args.pages_per_naics, states=args.states)
    cos = roll_up(awards)
    print(f"  {len(awards):,} award rows -> {len(cos):,} unique companies")
    print(cos["tier"].value_counts().to_string())

    enriched = enrich(cos, args.enrich_top, use_sam=not args.no_sam,
                      use_tomba=not args.no_tomba, tomba_budget=args.tomba_budget)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    # full universe on one tab is too big to be useful; ship enriched + the rest compactly
    rest = cos.iloc[len(enriched):]
    cov = report.build_workbook(enriched, out)
    if not rest.empty:
        with pd.ExcelWriter(out, engine="openpyxl", mode="a") as xl:
            rest.to_excel(xl, sheet_name="Universe (unenriched)", index=False)

    print(f"\n  wrote {out}")
    print("\nCOVERAGE (the honesty tab):")
    print(cov.to_string(index=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--probe", action="store_true", help="tiny sample + live field-yield check")
    ap.add_argument("--count", action="store_true", help="award volumes only")
    ap.add_argument("--full", action="store_true", help="the real pull + enrichment + workbook")
    ap.add_argument("--enrich-top", type=int, default=500)
    ap.add_argument("--tomba-budget", type=int, default=80, help="max Tomba domain searches this run")
    ap.add_argument("--no-sam", action="store_true")
    ap.add_argument("--no-tomba", action="store_true")
    ap.add_argument("--months", type=int, default=18)
    ap.add_argument("--pages-per-naics", type=int, default=30)
    ap.add_argument("--states", nargs="*", default=None, help='e.g. --states GA TX VA MD')
    ap.add_argument("-o", "--out", default="out/govhub_leads.xlsx")
    args = ap.parse_args()

    if args.probe:
        cmd_probe(args)
    elif args.count:
        cmd_count(args)
    elif args.full:
        cmd_full(args)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
