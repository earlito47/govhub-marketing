#!/usr/bin/env python3
"""
daily_linkedin.py

One LinkedIn post per day for the GovHub company page, staged in Postiz.
Unlike the weekly blog pipeline this commits nothing to the repo: the data is
already here, the copy goes straight to the Postiz calendar as a draft, and a
human presses publish.

The content is current government contract news, drawn from the datasets the
weekly-insights job refreshes every Monday from USAspending, rotated so the
week never repeats itself:

  Mon  largest awards with activity last week
  Tue  top agencies by new obligations
  Wed  most active industries (NAICS)
  Thu  top states by new obligations
  Fri  a flagship ranking (rotates weekly through rankings/)
  Sat  a glossary term (rotates through the 20 terms)
  Sun  an evergreen blog post resurfaced

Every dollar figure in the copy is verified against the source data before
anything is sent: the model must use the pre-formatted numbers verbatim, and
any $ amount in the output that is not in the allowed set fails the run.
Wrong numbers on a company page are worse than no post.

Env:
  OPENAI_API_KEY
  OPENAI_MODEL           default gpt-5-mini (short copy, daily volume)
  SOCIAL_API_KEY         Postiz key
  POSTIZ_INTEGRATION_ID
  POSTIZ_POST_TYPE       draft (default) | now | schedule
  DRY_RUN                "true" to print instead of sending to Postiz
  FORCE_WEEKDAY          0-6 to test a specific day's source
"""

import json
import os
import re
import sys
from datetime import date
from pathlib import Path

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_post import OPENAI_URL, clean_json, strip_dashes  # noqa: E402
from publish_social import post_postiz  # noqa: E402

MODEL = os.environ.get("OPENAI_MODEL", "gpt-5-mini")
SITE_URL = os.environ.get("SITE_URL", "https://www.govhub.online").rstrip("/")
DRY_RUN = os.environ.get("DRY_RUN", "").lower() == "true"

REPORTS_DIR = Path("src/data/insights/reports")
RANKINGS_DIR = Path("src/data/insights/rankings")
GLOSSARY_TS = Path("src/data/glossary.ts")
BLOG_DIR = Path("src/content/blog")

SYSTEM = """You write LinkedIn posts for GovHub, a software product that helps \
small and mid-size federal contractors analyze RFPs, build compliance \
matrices, and produce proposals.

Audience: capture managers, proposal managers, and owner-operators. Busy, \
experienced, allergic to fluff.

Rules, all mandatory:
- Never use em dashes or en dashes. Use commas, periods, or restructure.
- 80 to 150 words. Open with a specific number or claim, never a question.
- Use the pre-formatted numbers from FACTS verbatim. Do not invent, round, \
recompute, or extrapolate any figure. If a number is not in FACTS, it does \
not go in the post.
- Plain human language. No "delve", "leverage", "landscape", "unlock", \
"game-changer", "in today's fast-paced world".
- One clear takeaway a contractor can act on, not a data dump.
- At most 3 hashtags, at the end.
- Do not mention GovHub features unless the FACTS are about a GovHub page.
- End the body before the link; the link is appended by the system.
"""

USER_TEMPLATE = """Write today's LinkedIn post for the GovHub company page.

ANGLE: {angle}

FACTS (the only numbers you may use, verbatim):
{facts}

Return ONLY a JSON object: {{"post": "..."}}
"""


def fmt_money(v: float) -> str:
    """Compact dollar format. One decimal, no trailing zero noise."""
    for cut, suffix in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(v) >= cut:
            s = f"{v / cut:.1f}".rstrip("0").rstrip(".")
            return f"${s}{suffix}"
    return f"${v:,.0f}"


def latest_week_dir() -> Path:
    weeks = sorted(d for d in REPORTS_DIR.iterdir() if d.is_dir())
    if not weeks:
        sys.exit("No weekly report data found under src/data/insights/reports.")
    return weeks[-1]


def chart_points(page: dict, limit: int = 5) -> list:
    charts = page.get("charts") or []
    if not charts:
        return []
    series = (charts[0].get("series") or [{}])[0]
    return (series.get("points") or [])[:limit]


def facts_from_insights_page(page: dict, href: str, label: str) -> tuple:
    """(facts dict, allowed formatted numbers) from a report/ranking JSON."""
    allowed = set()
    rows = []
    for name, value in chart_points(page):
        formatted = fmt_money(float(value))
        allowed.add(formatted)
        rows.append({"name": name, "value": formatted})
    # The source labels use an en dash ("Jul 21–27"). The model tends to drop
    # it entirely ("Jul 2127"), so hand it an ASCII hyphen instead.
    window = (page.get("fyWindow") or {}).get("label", "")
    facts = {
        "dataset": label,
        "window": window.replace("–", "-").replace("—", "-"),
        "top_entries": rows,
        "link": f"{SITE_URL}{href}",
    }
    total = (page.get("stats") or {}).get("totalObligations")
    if total:
        facts["largest_value"] = fmt_money(float(total))
        allowed.add(facts["largest_value"])
    return facts, allowed


def source_report(slug: str, angle: str):
    week_dir = latest_week_dir()
    page = json.loads((week_dir / f"{slug}.json").read_text())
    href = f"/insights/reports/{week_dir.name}/{slug}/"
    facts, allowed = facts_from_insights_page(page, href, page.get("title", slug))
    return angle, facts, allowed, facts["link"]


def source_ranking():
    files = sorted(RANKINGS_DIR.glob("*.json"))
    pick = files[date.today().isocalendar().week % len(files)]
    page = json.loads(pick.read_text())
    href = f"/insights/{page['slug']}/"
    facts, allowed = facts_from_insights_page(page, href, page.get("title", ""))
    angle = ("A standout fact from GovHub's live federal spending rankings, "
             "and why it matters to a small or mid-size contractor.")
    return angle, facts, allowed, facts["link"]


def glossary_href(slug: str) -> str:
    """Live URL for a glossary term, mirroring hrefForTerm in data/glossary.ts.

    Parsed out of the pillars list rather than hardcoded, so adding a term to a
    pillar keeps this correct without a second edit.
    """
    src = GLOSSARY_TS.read_text(encoding="utf-8")
    tail = src[src.index("export const pillars"):] if "export const pillars" in src else ""
    for m in re.finditer(r"slug: '([a-z-]+)',[\s\S]*?termSlugs: \[([^\]]*)\]", tail):
        pillar, terms = m.group(1), re.findall(r"'([a-z0-9-]+)'", m.group(2))
        if slug in terms:
            return f"/glossary/{pillar}/#{slug}"
    return "/glossary/"

def source_glossary():
    """Rotate through glossary terms. String-scrape, same as pick_topic.py."""
    text = GLOSSARY_TS.read_text()
    entries = []
    for block in re.split(r"\n  \{\n", text)[1:]:
        slug = re.search(r"slug: '([^']+)'", block)
        term = re.search(r"term: '([^']+)'", block)
        short = re.search(r"short:\s*\n?\s*'((?:[^'\\]|\\.)+)'", block)
        if slug and term and short:
            entries.append({
                "slug": slug.group(1),
                "term": term.group(1),
                "short": short.group(1).replace("\\'", "'"),
            })
    if not entries:
        sys.exit("Could not parse any glossary entries from src/data/glossary.ts.")
    e = entries[date.today().timetuple().tm_yday % len(entries)]
    # Term pages were consolidated into pillar pages, so /glossary/<term>/ now
    # 301s. Resolve the pillar anchor the way hrefForTerm does in
    # src/data/glossary.ts, so posted links land in one hop.
    link = f"{SITE_URL}{glossary_href(e['slug'])}"
    facts = {"term": e["term"], "definition": e["short"], "link": link}
    angle = (f"Explain the term '{e['term']}' the way a veteran capture manager "
             f"would to a new teammate. No numbers needed today.")
    return angle, facts, set(), link


def source_evergreen():
    posts = []
    for f in sorted(BLOG_DIR.glob("*.md")):
        fm = f.read_text().split("---")[1] if f.read_text().startswith("---") else ""
        title = re.search(r"^title:\s*[\"']?(.+?)[\"']?\s*$", fm, re.M)
        desc = re.search(r"^description:\s*[\"']?(.+?)[\"']?\s*$", fm, re.M)
        if title and "draft: true" not in fm:
            posts.append({
                "slug": f.stem,
                "title": title.group(1),
                "description": desc.group(1) if desc else "",
            })
    if not posts:
        sys.exit("No blog posts found to resurface.")
    p = posts[date.today().isocalendar().week % len(posts)]
    link = f"{SITE_URL}/blog/{p['slug']}/"
    facts = {"post_title": p["title"], "post_summary": p["description"], "link": link}
    angle = ("Resurface this evergreen guide with one genuinely useful takeaway "
             "from its topic. Do not say 'in case you missed it'.")
    return angle, facts, set(), link


def pick_source():
    # workflow_dispatch passes the input through even when blank, so an empty
    # string must mean "no override" rather than a crash in int().
    weekday = int(os.environ.get("FORCE_WEEKDAY") or date.today().weekday())
    if weekday == 0:
        return source_report("largest-awards",
                             "The biggest federal awards that moved last week.")
    if weekday == 1:
        return source_report("top-agencies",
                             "Which agencies obligated the most new money last week.")
    if weekday == 2:
        return source_report("most-active-naics",
                             "The most active federal markets (NAICS) last week.")
    if weekday == 3:
        return source_report("state-movers",
                             "Where federal contract money landed last week, by state.")
    if weekday == 4:
        return source_ranking()
    if weekday == 5:
        return source_glossary()
    return source_evergreen()


DOLLAR_RE = re.compile(r"\$[\d][\d,.]*\s?[BMK]?(?:illion)?", re.I)


def unverified_numbers(text: str, allowed: set) -> list:
    """Any $ figure the model used that is not verbatim from FACTS."""
    normalized = {a.replace(" ", "") for a in allowed}
    return [m for m in DOLLAR_RE.findall(text)
            if m.replace(" ", "").rstrip(".") not in normalized]


def call_model(messages: list) -> str:
    r = requests.post(
        OPENAI_URL,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        json={
            "model": MODEL,
            "messages": messages,
            "response_format": {"type": "json_object"},
            # Short copy does not need deep thinking, and reasoning tokens
            # count against the cap: at the default effort gpt-5-mini spent
            # the entire budget reasoning and returned empty content.
            "reasoning_effort": "low",
            "max_completion_tokens": 6000,
        },
        timeout=180,
    )
    if not r.ok:
        raise RuntimeError(f"OpenAI {r.status_code}: {r.text[:300]}")
    content = (r.json().get("choices") or [{}])[0].get("message", {}).get("content")
    if not content:
        raise RuntimeError("OpenAI returned empty content")
    return clean_json(content).get("post", "")


def main():
    angle, facts, allowed, link = pick_source()
    print(f"Source: {facts.get('dataset') or facts.get('term') or facts.get('post_title')}")

    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": USER_TEMPLATE.format(
            angle=angle, facts=json.dumps(facts, indent=2))},
    ]

    post = ""
    for attempt in (1, 2, 3):
        try:
            post = strip_dashes(call_model(messages)).strip()
        except (RuntimeError, json.JSONDecodeError, requests.RequestException) as exc:
            print(f"Attempt {attempt}: model call failed ({exc}), retrying.",
                  file=sys.stderr)
            continue
        bad = unverified_numbers(post, allowed)
        if post and not bad:
            break
        print(f"Attempt {attempt}: unverified figures {bad}, retrying.", file=sys.stderr)
        messages.append({"role": "assistant", "content": json.dumps({"post": post})})
        messages.append({"role": "user", "content":
                         f"These figures are not in FACTS: {bad}. Rewrite using "
                         f"only the pre-formatted numbers from FACTS, verbatim."})
    else:
        sys.exit("Could not produce copy with verified numbers. Refusing to post.")

    text = f"{post}\n\n{link}"
    if DRY_RUN:
        print(f"--- dry run ---\n{text}\n---------------")
        return
    result = post_postiz(text)
    print(f"Delivered to Postiz: {json.dumps(result)[:200]}")


if __name__ == "__main__":
    main()
