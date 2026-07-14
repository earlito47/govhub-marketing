"""Layer 2b: SAM.gov Entity Management v3 — dormant unless SAM_API_KEY is set.

Public (non-FOUO) keys DO NOT receive POC email/phone; those fields are
restricted to federal system accounts. What this layer reliably adds:
website (entityURL), address, POC name/title, CAGE, registration status,
and businessTypes/certifications.

ueiSAM accepts up to 100 values per request ([UEI1~UEI2~...]), so even a
10-request/day personal key covers 1,000 companies. Request pattern mirrors
strata-parse supabase/functions/company-lookup/sam.ts (GET with api_key,
fall back to POST with x-api-key on 401/403/405; 429/402 = quota stop).
"""
import os
import time

import requests

import cache

URL = "https://api.sam.gov/entity-information/v3/entities"
SECTIONS = "entityRegistration,coreData,assertions,pointsOfContact"


class SamQuota(Exception):
    """Daily rate limit (429) or quota (402) reached — stop cleanly, cache keeps progress."""


def sam_key():
    return os.environ.get("SAM_API_KEY", "").strip()


def _request(params, key):
    q = dict(params, api_key=key)
    r = requests.get(URL, params=q, timeout=60)
    if r.status_code in (401, 403, 405):
        r = requests.post(URL, params=params, headers={"x-api-key": key}, timeout=60)
    if r.status_code in (429, 402):
        raise SamQuota(f"HTTP {r.status_code}: {r.text[:200]}")
    if r.status_code != 200:
        raise RuntimeError(f"SAM HTTP {r.status_code}: {r.text[:300]}")
    return r.json()


def sam_batch(ueis, key):
    """Fetch up to 100 UEIs. Returns {uei: extracted-or-not_found}. Raises SamQuota when out of calls."""
    out = {}
    todo = []
    for u in filter(None, ueis):
        hit = cache.get("sam", u)
        if hit is not None:
            out[u] = hit
        else:
            todo.append(u)
    if not todo:
        return out

    entities, complete = [], True
    try:
        data = _request({"ueiSAM": "[" + "~".join(todo) + "]",
                         "includeSections": SECTIONS, "size": str(len(todo))}, key)
        entities = data.get("entityData") or []
    except RuntimeError:
        # multi-value syntax rejected by this deployment -> one at a time
        for u in todo:
            try:
                d = _request({"ueiSAM": u, "includeSections": SECTIONS, "size": "1"}, key)
                entities.extend(d.get("entityData") or [])
                time.sleep(0.6)
            except RuntimeError:
                complete = False  # unknown failure: don't mark this UEI as not_found

    for e in entities:
        ext = _extract(e)
        if ext.get("uei"):
            out[ext["uei"]] = cache.put("sam", ext["uei"], ext)
    if complete:
        for u in todo:
            if u not in out:
                out[u] = cache.put("sam", u, {"not_found": True})
    return out


def _extract(e):
    reg = e.get("entityRegistration") or {}
    core = e.get("coreData") or {}
    poc = (e.get("pointsOfContact") or {}).get("governmentBusinessPOC") or {}
    addr = core.get("physicalAddress") or {}
    info = core.get("entityInformation") or {}
    types = ((core.get("businessTypes") or {}).get("businessTypeList")) or []
    return {
        "found": True,
        "uei": reg.get("ueiSAM", ""),
        "cage": reg.get("cageCode", "") or "",
        "sam_status": reg.get("registrationStatus", "") or "",
        "sam_expires": reg.get("registrationExpirationDate", "") or "",
        "website": str(info.get("entityURL") or "").strip(),
        "poc_name": " ".join(x for x in [poc.get("firstName"), poc.get("lastName")] if x),
        "poc_title": poc.get("title") or "",
        "poc_email": poc.get("email") or "",    # populated only for FOUO-privileged keys
        "poc_phone": poc.get("usPhone") or "",  # populated only for FOUO-privileged keys
        "city": addr.get("city") or "",
        "state": addr.get("stateOrProvinceCode") or "",
        "business_types": "; ".join(filter(None, (b.get("businessTypeDesc", "") for b in types)))[:200],
    }
