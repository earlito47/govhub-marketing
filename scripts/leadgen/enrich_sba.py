"""Layer 2 (primary contact source): SBA certification search, the successor
to the retired DSBS directory.

Keyless JSON API behind search.certifications.sba.gov. For small businesses
with an SBA profile it returns email, phone, contact person, website, and
live certification flags (8(a)/WOSB/HUBZone/SDVOSB/...).

Quirks (verified live):
  - needs a browser User-Agent
  - not-in-DSBS comes back as HTTP 500 "No matching MeiliSearch document"
  - email/phone are honored only when the profile's public display flags allow
This is an undocumented internal API — throttled to ~2 req/s and cached.
"""
import re
import time

import requests

import cache

PROFILE = "https://search.certifications.sba.gov/_api/v2/profile/{uei}"
SEARCH = "https://search.certifications.sba.gov/_api/v2/search"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
SPACING = 0.5


def _flag(d, name, default=True):
    v = d.get(name)
    return v if isinstance(v, bool) else default


def sba_profile(uei):
    """Return extracted profile dict, {"not_found": True}, or {"error": ...} (transient, uncached)."""
    if not uei:
        return {"not_found": True}
    hit = cache.get("sba", uei)
    if hit is not None:
        return hit
    try:
        r = requests.get(PROFILE.format(uei=uei),
                         headers={"User-Agent": UA, "Accept": "application/json"},
                         timeout=30)
    except requests.RequestException as e:
        return {"error": str(e)}
    time.sleep(SPACING)
    if r.status_code == 500 and "No matching" in r.text:
        return cache.put("sba", uei, {"not_found": True})
    if r.status_code == 404:
        return cache.put("sba", uei, {"not_found": True})
    if r.status_code != 200:
        return {"error": f"HTTP {r.status_code}: {r.text[:150]}"}
    try:
        raw = r.json()
    except ValueError:
        return {"error": "non-JSON response"}
    return cache.put("sba", uei, _extract(raw))


# body literals extracted from the SPA bundle (filters-store-v1.67); wrong enum
# casing ("OR", "AT_LEAST") or a missing entityDetailId key returns an error
def _search_body(term):
    return {
        "searchProfiles": {"searchTerm": term},
        "location": {"states": [], "zipCodes": [], "counties": [], "districts": [], "msas": []},
        "sbaCertifications": {"activeCerts": [], "isPreviousCert": False, "operatorType": "Or"},
        "naics": {"codes": [], "isPrimary": False, "operatorType": "Or"},
        "selfCertifications": {"certifications": [], "operatorType": "Or"},
        "keywords": {"list": [], "operatorType": "Or"},
        "lastUpdated": {"date": {"label": "Anytime", "value": "anytime"}},
        "samStatus": {"isActiveSAM": False},
        "qualityAssuranceStandards": {"qas": []},
        "bondingLevels": {"constructionIndividual": "", "constructionAggregate": "",
                          "serviceIndividual": "", "serviceAggregate": ""},
        "businessSize": {"relationOperator": "at-least", "numberOfEmployees": ""},
        "annualRevenue": {"relationOperator": "at-least", "annualGrossRevenue": ""},
        "entityDetailId": "",
    }


_SUFFIXES = re.compile(
    r"\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|LTD|LIMITED|CO|COMPANY|JV|PLLC|LP|LLP)\b\.?")


def _norm_name(name):
    s = re.sub(r"[^A-Z0-9 ]", " ", str(name or "").upper())
    s = _SUFFIXES.sub(" ", s)
    return " ".join(s.split())


def match_by_name(name):
    """Name-search fallback when there's no UEI/profile. Exact normalized match
    on legal or DBA name only — never fuzzy-accept. Returns extracted profile,
    {"not_found": True}, or {"error": ...}."""
    norm = _norm_name(name)
    if not norm:
        return {"not_found": True}
    hit = cache.get("sba_name", norm)
    if hit is not None:
        return hit
    try:
        r = requests.post(SEARCH, json=_search_body(name),
                          headers={"User-Agent": UA, "Content-Type": "application/json"},
                          timeout=30)
        time.sleep(SPACING)
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}: {r.text[:150]}"}
        results = (r.json() or {}).get("results") or []
    except (requests.RequestException, ValueError) as e:
        return {"error": str(e)}
    for ent in results:
        if not isinstance(ent, dict):
            continue
        if _norm_name(ent.get("legal_business_name")) == norm or \
           _norm_name(ent.get("dba_name")) == norm:
            return cache.put("sba_name", norm, _extract({"entity": ent}))
    return cache.put("sba_name", norm, {"not_found": True})


def _extract(raw):
    ent = raw.get("entity") if isinstance(raw.get("entity"), dict) else raw

    certs = set()
    for k, v in ent.items():
        if k.startswith("active_") and k.endswith("_boolean") and v is True:
            certs.add(k[len("active_"):-len("_boolean")].upper())
    for c in (raw.get("certs") or ent.get("certs") or []):
        if isinstance(c, dict):
            name = c.get("certification_type") or c.get("cert_type") or c.get("name")
            if name:
                certs.add(str(name).upper())

    public = _flag(ent, "public_display")
    email = str(ent.get("email") or "").strip()
    phone = str(ent.get("phone") or "").strip()
    if not public or not _flag(ent, "display_email"):
        email = ""
    if not public or not _flag(ent, "display_phone"):
        phone = ""

    return {
        "found": True,
        "uei": str(ent.get("uei") or "").strip(),
        "email": email,
        "phone": phone,
        "contact_person": str(ent.get("contact_person") or "").strip(),
        "website": str(ent.get("website") or "").strip(),
        "legal_name": ent.get("legal_business_name") or "",
        "city": ent.get("city") or "",
        "state": ent.get("state") or "",
        "certs": sorted(certs),
        "capabilities": str(ent.get("capabilities_narrative") or "")[:300],
        "raw_keys": sorted(ent.keys())[:50],
    }
