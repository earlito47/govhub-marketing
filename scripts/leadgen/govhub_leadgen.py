#!/usr/bin/env python3
"""GovHub Lead Engine — ICP company list + contacts from free federal data.

Layer 1   USASpending (no key)      WHO wins contracts (prime + sub), how often
Layer 2   SBA certification search  email / phone / contact person (free, no key)
Layer 2b  SAM.gov entity API        website / certs / POC name (needs SAM_API_KEY;
                                    POC email+phone are FOUO-gated on public keys)
Layer 3   Tomba domain search       fallback emails where registries had none
                                    (TOMBA_API_KEY, budget-capped)

Segments (--segment):
  primes      serial bidders, 18mo lookback, $100k-25M       (tiers A/B/C/D)
  new-primes  small biz whose FIRST award landed in the last
              12 months, $100k-2M                            (tier N)
  subs        subcontractors from FSRS subaward reports,
              12 months; sub-only firms sorted first         (tiers S/SP)
  all         all three, cross-deduped, one tab each

    pip install -r requirements.txt
    python govhub_leadgen.py --probe [--segment subs]
    python govhub_leadgen.py --count --segment all
    python govhub_leadgen.py --full --segment all --enrich-top 500 -o out/leads.xlsx
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
    "621111",  # Offices of Physicians (VA work; NB pulls individual doctors too)
    "611430",  # Professional & Management Training
]

# The money band. Below the floor: too small to pay $129-699/mo.
# Above the ceiling: they have a captured proposal team and use Deltek.
MIN_AWARD = 100_000
MAX_AWARD = 25_000_000

NEW_PRIME_BAND = (100_000, 2_000_000)  # server-side rough cut; re-gated client-side
SUB_BAND = (30_000, 5_000_000)         # client-side only (server ignores it on subs)

TIER_ORDER = [
    "N - new prime",       # first prime win in the last 12 months
    "S - sub only",        # subcontractor, zero prime awards ever (prime-curious)
    "A - serial bidder",   # 3+ prime wins in window
    "B - repeat bidder",
    "SP - sub + prime",
    "S? - unknown",        # sub without UEI; prime history unverifiable
    "C - occasional",
    "D - review",
]

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


def sort_tiered(df, cadence_col="award_count", amount_col="total_awarded"):
    df = df.copy()
    df["_rank"] = df["tier"].map(lambda t: TIER_ORDER.index(t) if t in TIER_ORDER else 99)
    df = (df.sort_values(["_rank", cadence_col, amount_col],
                         ascending=[True, False, False])
            .drop(columns="_rank").reset_index(drop=True))
    return df


def roll_up(award_rows):
    """Prime awards -> one row per company (keyed by UEI), with a cadence signal."""
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
    return df if df.empty else sort_tiered(df)


def roll_up_subs(sub_rows, min_sub=SUB_BAND[0], max_sub=SUB_BAND[1]):
    """Subaward rows -> one row per subcontractor. Dollar band applied here
    because the server ignores award_amount on subaward queries."""
    seen = set()
    by = defaultdict(lambda: {
        "name": "", "uei": "", "count": 0, "total": 0.0,
        "primes": set(), "agencies": set(), "naics": set(), "last": "",
    })
    for a in sub_rows:
        rid = f"{a.get('internal_id')}|{a.get('prime_award_internal_id')}"
        if rid in seen:
            continue
        seen.add(rid)
        amt = float(a.get("Sub-Award Amount") or 0)
        if not (min_sub <= amt <= max_sub):
            continue
        name = (a.get("Sub-Awardee Name") or "").strip()
        if not name:
            continue
        uei = (a.get("Sub-Recipient UEI") or "").strip()
        c = by[uei or name.upper()]
        c["name"] = c["name"] or name
        c["uei"] = c["uei"] or uei
        c["count"] += 1
        c["total"] += amt
        if a.get("Prime Recipient Name"):
            c["primes"].add(a["Prime Recipient Name"])
        if a.get("Awarding Agency"):
            c["agencies"].add(a["Awarding Agency"])
        code = _naics_code(a.get("NAICS"))
        if code:
            c["naics"].add(code)
        sd = a.get("Sub-Award Date") or ""
        if sd > c["last"]:
            c["last"] = sd

    out = []
    for c in by.values():
        out.append({
            "company": c["name"],
            "uei": c["uei"],
            "sub_award_count": c["count"],
            "sub_total": round(c["total"], 2),
            "last_sub_date": c["last"],
            "primes_worked_under": "; ".join(sorted(c["primes"]))[:250],
            "agency_count": len(c["agencies"]),
            "agencies": "; ".join(sorted(c["agencies"]))[:250],
            "naics": "; ".join(sorted(c["naics"]))[:120],
            "never_prime": "",
            "tier": "",
        })
    df = pd.DataFrame(out)
    if df.empty:
        return df
    return df.sort_values(["sub_award_count", "sub_total"],
                          ascending=[False, False]).reset_index(drop=True)


def tier_subs(cands, verbose=True):
    """1 cached count-request per sub: has this company EVER won a prime?"""
    for i, (idx, row) in enumerate(cands.iterrows(), 1):
        pc = usaspending.prime_award_count(row["uei"])
        if pc == 0:
            cands.at[idx, "tier"], cands.at[idx, "never_prime"] = "S - sub only", "Y"
        elif pc is None:
            cands.at[idx, "tier"], cands.at[idx, "never_prime"] = "S? - unknown", ""
        else:
            cands.at[idx, "tier"], cands.at[idx, "never_prime"] = "SP - sub + prime", "N"
        if verbose and i % 100 == 0:
            print(f"    {i}/{len(cands)} prime-history checks", flush=True)
    return sort_tiered(cands, "sub_award_count", "sub_total")


# --- enrichment waterfall ---------------------------------------------------

CONTACT_COLS = ["email", "email_source", "phone", "phone_source", "contact_person",
                "website", "sba_certs", "city", "state_hq", "poc_name", "poc_title",
                "sam_status", "business_types", "tomba_position", "tomba_score",
                "tomba_accept_all"]


def enrich_contacts(sub, use_sam=True, use_tomba=True, tomba_budget=80,
                    name_fallback=False, verbose=True):
    """Waterfall over an already-sliced candidate df:
    SBA by UEI -> SBA by exact name (subs) -> SAM (if key+quota) -> Tomba."""
    sub = sub.copy()
    for col in CONTACT_COLS:
        sub[col] = ""
    sub["email_source"] = "none"
    sub["phone_source"] = "none"

    if verbose:
        print(f"  SBA lookups on {len(sub)} companies (free, cached)...", flush=True)
    sba_hits = 0
    for i, (idx, row) in enumerate(sub.iterrows(), 1):
        src = "sba"
        p = enrich_sba.sba_profile(row["uei"])
        if not p.get("found") and name_fallback:
            p = enrich_sba.match_by_name(row["company"])
            src = "sba-name"
        if p.get("found"):
            sba_hits += 1
            if p.get("email"):
                sub.at[idx, "email"], sub.at[idx, "email_source"] = p["email"], src
            if p.get("phone"):
                sub.at[idx, "phone"], sub.at[idx, "phone_source"] = p["phone"], src
            sub.at[idx, "contact_person"] = p.get("contact_person", "")
            sub.at[idx, "website"] = p.get("website", "")
            sub.at[idx, "sba_certs"] = "; ".join(p.get("certs") or [])
            sub.at[idx, "city"] = p.get("city", "")
            sub.at[idx, "state_hq"] = p.get("state", "")
            if not sub.at[idx, "uei"] and p.get("uei"):
                sub.at[idx, "uei"] = p["uei"]
        if verbose and i % 100 == 0:
            print(f"    {i}/{len(sub)} ({sba_hits} SBA profiles found)", flush=True)
    if verbose:
        print(f"    done: {sba_hits}/{len(sub)} have an SBA profile", flush=True)

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
        print("  SAM layer dormant (no SAM_API_KEY set).")

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


# --- segment builders --------------------------------------------------------

def build_primes(args):
    print(f"  primes: {len(NAICS)} NAICS x up to {args.pages_per_naics or 30} pages, "
          f"{args.months}mo, ${MIN_AWARD:,}-${MAX_AWARD:,}")
    awards = usaspending.pull_awards(NAICS, args.months, MIN_AWARD, MAX_AWARD,
                                     pages_per_naics=args.pages_per_naics or 30,
                                     states=args.states)
    cos = roll_up(awards)
    print(f"  {len(awards):,} award rows -> {len(cos):,} unique companies")
    return cos


def build_new_primes(args):
    lo, hi = NEW_PRIME_BAND
    pages = args.pages_per_naics or 170
    print(f"  new-primes: 12mo, ${lo:,}-${hi:,}, small_business + new_awards_only, "
          f"up to {pages} pages/NAICS")
    awards = usaspending.pull_awards(NAICS, 12, lo, hi, pages_per_naics=pages,
                                     states=args.states, date_type="new_awards_only",
                                     recipient_types=["small_business"])
    cos = roll_up(awards)
    if cos.empty:
        return cos
    # server band is loose ($0 and >cap rows slip through) -> re-gate client-side
    cos = cos[cos["total_awarded"] > 0].copy()
    one = (cos["award_count"] == 1) & (cos["total_awarded"] < hi)
    cos.loc[one, "tier"] = "N - new prime"
    cos = sort_tiered(cos)
    print(f"  {len(awards):,} award rows -> {len(cos):,} companies "
          f"({int(one.sum()):,} are 1-award new primes)")
    return cos


def build_subs(args):
    pages = args.pages_per_naics or 60
    print(f"  subs: 12mo of FSRS subawards, band ${SUB_BAND[0]:,}-${SUB_BAND[1]:,} "
          f"client-side, up to {pages} pages/NAICS")
    rows = usaspending.pull_subawards(NAICS, 12, pages_per_naics=pages)
    cos = roll_up_subs(rows)
    print(f"  {len(rows):,} subaward rows -> {len(cos):,} unique subcontractors")
    return cos


SEGMENT_TABS = {"primes": "Companies", "new-primes": "New Primes", "subs": "Subcontractors"}


# --- CLI modes ---------------------------------------------------------------

def cmd_probe(args):
    print("PROBE — 3 pages of NAICS 541511 awards (keyless)...")
    awards = usaspending.pull_awards(["541511"], args.months, MIN_AWARD, MAX_AWARD,
                                     pages_per_naics=3)
    print(f"  got {len(awards)} award rows")
    if not awards:
        print("  ! nothing came back — check filters/network")
        return
    print("\n  sample award row:")
    print("  " + json.dumps(awards[0], indent=2, default=str)[:700].replace("\n", "\n  "))

    cos = roll_up(awards)
    with_uei = int((cos["uei"] != "").sum())
    print(f"\n  -> {len(cos)} unique companies from 3 pages ({with_uei} with UEI)")
    print(cos.head(10)[["company", "uei", "award_count", "total_awarded", "tier"]]
             .to_string(index=False))

    print("\n  SBA probe on 8 UEIs — WATCH email/phone:")
    for _, r in cos[cos["uei"] != ""].head(8).iterrows():
        p = enrich_sba.sba_profile(r["uei"])
        status = ("NOT IN DSBS" if p.get("not_found")
                  else f"email={p.get('email') or '(none)'}  phone={p.get('phone') or '(none)'}  "
                       f"contact={p.get('contact_person') or '(none)'}  certs={','.join(p.get('certs') or []) or '-'}"
                  if p.get("found") else f"ERROR {p.get('error')}")
        print(f"    {r['company'][:38]:<40} {status}")

    if args.segment in ("subs", "all"):
        print("\n  SUBAWARD probe — 1 page of NAICS 541512 subs:")
        srows = usaspending.pull_subawards(["541512"], 12, pages_per_naics=1, verbose=False)
        print(f"    got {len(srows)} sub rows")
        for a in srows[:3]:
            print(f"    {str(a.get('Sub-Awardee Name'))[:34]:<36} uei={a.get('Sub-Recipient UEI')} "
                  f"${float(a.get('Sub-Award Amount') or 0):,.0f} under {str(a.get('Prime Recipient Name'))[:24]}")
        # page 1 desc is all mega-subs; skip the band here just to demo the flow
        subs = roll_up_subs(srows, min_sub=0, max_sub=float("inf"))
        if subs.empty:
            print("    (roll-up empty)")
        for _, r in subs[subs["uei"] != ""].head(3).iterrows():
            pc = usaspending.prime_award_count(r["uei"])
            p = enrich_sba.sba_profile(r["uei"])
            email = p.get("email") if p.get("found") else "(no SBA profile)"
            print(f"    {r['company'][:34]:<36} primes_ever={pc} sba_email={email or '(none)'}")

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
    print("COUNT — matching volumes (no row pulls)...")
    if args.segment in ("primes", "all"):
        c = usaspending.count_awards(NAICS, args.months, MIN_AWARD, MAX_AWARD, args.states)
        print(f"  primes ({args.months}mo, $100k-25M):            {c.get('contracts', 0):>8,} contracts")
    if args.segment in ("new-primes", "all"):
        lo, hi = NEW_PRIME_BAND
        c = usaspending.count_awards(NAICS, 12, lo, hi, args.states,
                                     date_type="new_awards_only",
                                     recipient_types=["small_business"])
        print(f"  new-primes (12mo, $100k-2M, small biz, new):    {c.get('contracts', 0):>8,} contracts")
    if args.segment in ("subs", "all"):
        c = usaspending.count_subawards(NAICS, 12)
        print(f"  subs (12mo FSRS subawards, pre-band):           {c.get('subcontracts', c.get('contracts', 0)):>8,} subawards")
    if args.segment != "all":
        print("  per-NAICS:")
        for code in NAICS:
            if args.segment == "subs":
                c = usaspending.count_subawards([code], 12)
                n = c.get("subcontracts", c.get("contracts", 0))
            elif args.segment == "new-primes":
                lo, hi = NEW_PRIME_BAND
                c = usaspending.count_awards([code], 12, lo, hi, args.states,
                                             date_type="new_awards_only",
                                             recipient_types=["small_business"])
                n = c.get("contracts", 0)
            else:
                c = usaspending.count_awards([code], args.months, MIN_AWARD, MAX_AWARD, args.states)
                n = c.get("contracts", 0)
            print(f"    {code}: {n:>8,}")


def cmd_full(args):
    segs = ["primes", "new-primes", "subs"] if args.segment == "all" else [args.segment]
    sheets, universes = {}, []
    seen_ueis = set()

    for seg in segs:
        print(f"\n=== SEGMENT: {seg} ===")
        df = {"primes": build_primes, "new-primes": build_new_primes,
              "subs": build_subs}[seg](args)
        if df.empty:
            print("  (no rows)")
            continue
        if seen_ueis:
            before = len(df)
            df = df[(df["uei"] == "") | ~df["uei"].isin(seen_ueis)].reset_index(drop=True)
            if len(df) != before:
                print(f"  cross-segment dedupe: dropped {before - len(df):,} "
                      f"companies already enriched in an earlier tab")

        cands = df.head(args.enrich_top).copy()
        rest = df.iloc[len(cands):]
        if seg == "subs":
            print(f"  prime-history check on {len(cands)} subs (1 cached request each)...")
            cands = tier_subs(cands)
            print(cands["tier"].value_counts().to_string())
        else:
            print(cands["tier"].value_counts().to_string())

        enriched = enrich_contacts(cands, use_sam=not args.no_sam,
                                   use_tomba=not args.no_tomba,
                                   tomba_budget=args.tomba_budget,
                                   name_fallback=(seg == "subs"))
        seen_ueis.update(u for u in enriched["uei"] if u)
        sheets[SEGMENT_TABS[seg]] = enriched
        r = rest.copy()
        r.insert(0, "segment", SEGMENT_TABS[seg])
        universes.append(r)

    if not sheets:
        print("nothing to write")
        return
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    universe = pd.concat(universes, ignore_index=True) if universes else None
    cov = report.build_workbook(sheets, out, universe=universe)

    print(f"\n  wrote {out}")
    print("\nCOVERAGE (the honesty tab):")
    print(cov.to_string(index=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--probe", action="store_true", help="tiny sample + live field-yield check")
    ap.add_argument("--count", action="store_true", help="award volumes only")
    ap.add_argument("--full", action="store_true", help="the real pull + enrichment + workbook")
    ap.add_argument("--segment", choices=["primes", "new-primes", "subs", "all"],
                    default="primes")
    ap.add_argument("--enrich-top", type=int, default=500, help="companies enriched per segment")
    ap.add_argument("--tomba-budget", type=int, default=80,
                    help="max Tomba domain searches per segment run")
    ap.add_argument("--no-sam", action="store_true")
    ap.add_argument("--no-tomba", action="store_true")
    ap.add_argument("--months", type=int, default=18,
                    help="primes lookback (new-primes/subs are fixed at 12)")
    ap.add_argument("--pages-per-naics", type=int, default=None,
                    help="page cap per NAICS (defaults: primes 30, new-primes 170, subs 60)")
    ap.add_argument("--states", nargs="*", default=None, help="e.g. --states GA TX VA MD")
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
