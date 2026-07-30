#!/usr/bin/env python3
"""
generate_post.py

Reads topic.json and writes:
  - <CONTENT_DIR>/<slug>.md          blog collection entry
  - social/<slug>.linkedin.txt       LinkedIn copy, published after merge
  - data/covered-topics.json         ledger, so we never repeat a topic
  - pr_body.md                       the review brief for the weekly PR

The frontmatter it emits has to satisfy the blog collection schema in
src/content.config.ts exactly. `astro check` in the weekly workflow is the
gate that proves it does.

Env:
  OPENAI_API_KEY
  OPENAI_MODEL         default gpt-5
  OPENAI_REASONING     default medium
  CONTENT_DIR          default src/content/blog
  SITE_URL             default https://www.govhub.online
"""

import json
import os
import re
import sys
from datetime import date
from pathlib import Path

import requests

# Called via raw HTTP rather than the openai SDK, matching
# scripts/insights/generate-narratives.mjs. requests is already a dependency
# for publish_social.py, so this adds nothing to install.
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

# The insights pipeline uses gpt-5-mini for short entity blurbs. This is a
# different job: one 1500-word post a week that carries the site's organic
# search, so it runs on the full model. That is roughly four calls a month.
# Set OPENAI_MODEL=gpt-5-mini to trade quality for cost.
MODEL = os.environ.get("OPENAI_MODEL", "gpt-5")
REASONING_EFFORT = os.environ.get("OPENAI_REASONING", "medium")
CONTENT_DIR = Path(os.environ.get("CONTENT_DIR", "src/content/blog"))
SOCIAL_DIR = Path("social")
LEDGER_PATH = Path(os.environ.get("COVERED_LEDGER", "data/covered-topics.json"))
# Canonical host, per astro.config.mjs. The apex 301s to www, so posting the
# apex URL to LinkedIn would burn a redirect on every click.
SITE_URL = os.environ.get("SITE_URL", "https://www.govhub.online").rstrip("/")

DATA_DIR = Path("src/data")

# check-meta.mjs budgets, mirrored here so we ask for copy that passes the
# guard rather than finding out at build time. BaseLayout renders <title>
# verbatim with no site-name suffix, so these are the real limits.
TITLE_MAX = 60
DESC_MIN, DESC_MAX = 140, 158

SYSTEM = """You write for GovHub, a software product that helps small and \
mid-size federal contractors analyze RFPs, build compliance matrices, and \
produce proposals.

Audience: capture managers, proposal managers, and owner-operators at firms \
with 5 to 200 employees. They are busy, experienced, and allergic to fluff. \
They have read a hundred generic "how to win government contracts" posts and \
bounced off all of them.

Voice rules, all mandatory:
- Never use em dashes or en dashes. Use commas, periods, or restructure the \
sentence. This is a hard rule with no exceptions.
- Plain human language. No "delve", "leverage", "landscape", "navigate the \
complexities", "in today's fast-paced world", "unlock", "game-changer".
- No throat-clearing intros. First sentence delivers something useful.
- Short paragraphs. Two to four sentences.
- Be specific. Cite actual FAR clause numbers, actual form names, actual \
section letters, actual dollar thresholds. Vague advice is worthless here.
- Say the hard part out loud. If a process is genuinely painful or a common \
approach is wrong, name it.
- Mention GovHub at most once, near the end, and only where it honestly fits. \
The post has to stand on its own as useful writing.

Structure the blog post so it directly and completely answers the target \
query in the first 150 words, then goes deeper. Use H2 subheads that a person \
would actually search for. Include one concrete worked example or checklist.
"""

USER_TEMPLATE = """Write this week's post.

TARGET QUERY: {query}

SEARCH DATA:
{search_data}

RELATED QUERIES TO COVER INSIDE THE POST (these are real searches from the \
same audience, work them in naturally as subheads or sections):
{related}

INTERNAL LINK TARGETS (real pages on this site, use markdown links to two or \
three of the most relevant ones inside the body, in context, never as a link \
dump at the end):
{link_targets}

BRAND MEDIA (the only image paths that exist; pick from this list only):
{media_targets}

Return ONLY a JSON object, no markdown fences, no preamble, with these keys:
  "title"            SEO title, at most {title_max} characters, contains the \
target query or a close variant
  "slug"             lowercase, hyphens, no stop words, under 60 characters
  "description"      meta description, between {desc_min} and {desc_max} \
characters. This is a hard limit, count them.
  "tags"             array of 3 to 5 lowercase tags
  "body_markdown"    the full post, 1100 to 1600 words, starting at an H2 \
(no H1, the layout renders the title)
  "linkedin_post"    LinkedIn copy for the GovHub company page, 120 to 200 \
words. Open with a specific claim or number, not a question. No hashtag \
soup, three tags maximum at the end. Do not paste the article, give one \
genuinely useful takeaway and let the link carry the rest.
  "internal_links_used"  array of the hrefs you actually linked to in the body
  "cover_asset"      the BRAND MEDIA path most relevant to this post's topic
  "cover_alt"        one plain sentence describing the cover for screen readers
  "figure_asset"     a second, different BRAND MEDIA path to illustrate the \
body, or null if nothing on the list genuinely fits
"""


def load_topic() -> dict:
    p = Path("topic.json")
    if not p.exists():
        sys.exit("topic.json not found. Run pick_topic.py first.")
    return json.loads(p.read_text())


def link_inventory() -> str:
    """Real internal link targets, so the model links to pages that exist.

    Left to itself an LLM invents plausible-looking hrefs, which ship as 404s.
    Handing it the actual routes is cheaper than validating hallucinations.
    """
    targets = []

    for f in sorted(CONTENT_DIR.glob("*.md")):
        title = ""
        for line in f.read_text().splitlines()[1:12]:
            if line.startswith("title:"):
                title = line.split(":", 1)[1].strip().strip('"')
                break
        targets.append(f"- /blog/{f.stem}/ ({title or f.stem})")

    # Same string-scrape approach as pick_topic.py: the catalogs are TS, and
    # two fields do not justify a TypeScript parser in the content pipeline.
    catalogs = {
        "solutions.ts": "/solutions/",
        "glossary.ts": "/glossary/",
    }
    for filename, prefix in catalogs.items():
        path = DATA_DIR / filename
        if not path.exists():
            continue
        text = path.read_text()
        for slug in re.findall(r"\bslug:\s*'([^']+)'", text):
            targets.append(f"- {prefix}{slug}/")

    return "\n".join(targets)


def from_search_console(topic: dict) -> bool:
    """True for any GSC-derived tier, strict or emerging."""
    return str(topic.get("source", "")).startswith("gsc_")


# Brand art that is page furniture, not editorial illustration. Offering these
# to the model just invites a footer strip as a blog cover.
MEDIA_DENYLIST = ("404", "footer-", "cta-band", "home-hero", "og-", "linkedin-cover")

DEFAULT_COVER = "/brand/page-graphics/blog-trail-map.svg"


def media_inventory() -> list:
    """Real brand SVGs the model may choose from. Same reasoning as
    link_inventory: handing it the actual files beats validating inventions."""
    assets = []
    for subdir in ("page-graphics", "illustrations", "graphics"):
        base = Path("public/brand") / subdir
        if not base.exists():
            continue
        for f in sorted(base.glob("*.svg")):
            if any(t in f.name for t in MEDIA_DENYLIST):
                continue
            hint = f.stem.replace("-", " ").replace("@2x", "")
            assets.append({"path": f"/brand/{subdir}/{f.name}", "hint": hint})
    return assets


def format_media(assets: list) -> str:
    return "\n".join(f"- {a['path']} ({a['hint']})" for a in assets)


def resolve_asset(picked, assets: list):
    """Only paths from the inventory survive. Anything else becomes None."""
    if not picked:
        return None
    paths = {a["path"] for a in assets}
    return picked if picked in paths else None


def format_search_data(topic: dict) -> str:
    if not from_search_console(topic):
        return ("No Search Console history for this query yet. This is a "
                "proactive topic from the priority backlog. Write it as the "
                "definitive answer.")
    return (
        f"- Impressions in last 28 days: {topic['impressions']}\n"
        f"- Current average position: {topic['position']}\n"
        f"- Current CTR: {topic['ctr'] * 100:.2f}%\n"
        f"- Estimated monthly clicks gained by reaching position 3: "
        f"{topic['opportunity_clicks']}\n"
        f"\nWe already rank on page one or two for this. The page that wins "
        f"needs to be more complete and more specific than what is there now."
    )


def format_related(topic: dict) -> str:
    rel = topic.get("related_queries") or []
    if not rel:
        return "(none, use your judgment on subtopics)"
    return "\n".join(
        f"- {r['query']} ({r['impressions']} impressions, position {r['position']})"
        for r in rel
    )


def strip_dashes(text: str) -> str:
    """Belt and braces. The prompt bans em dashes, this guarantees it.

    check-emdash.mjs fails the build on any em dash in visible copy, so a
    single slip here would break the weekly run.
    """
    text = text.replace("—", ", ").replace("–", "-")
    text = re.sub(r"\s*,\s*,", ",", text)
    return re.sub(r" {2,}", " ", text)


def clean_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def call_openai(messages: list) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("OPENAI_API_KEY is not set.")
    r = requests.post(
        OPENAI_URL,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {api_key}"},
        json={
            "model": MODEL,
            "messages": messages,
            # Guarantees parseable JSON, so a stray prose preamble cannot
            # break the run. The prompt still spells out the shape.
            "response_format": {"type": "json_object"},
            "reasoning_effort": REASONING_EFFORT,
            # Reasoning tokens count against this, and the post alone is
            # ~2k. Too low truncates mid-JSON, which reads as a parse error.
            "max_completion_tokens": 16000,
        },
        timeout=300,
    )
    if not r.ok:
        raise RuntimeError(f"OpenAI {r.status_code}: {r.text[:300]}")
    data = r.json()
    choice = (data.get("choices") or [{}])[0]
    if choice.get("finish_reason") == "length":
        raise RuntimeError(
            "OpenAI hit the token ceiling and returned truncated JSON. "
            "Raise max_completion_tokens or lower OPENAI_REASONING."
        )
    content = (choice.get("message") or {}).get("content")
    if not content:
        raise RuntimeError("OpenAI returned empty content")
    return clean_json(content)


def repair_description(post: dict) -> dict:
    """Re-ask for the meta description alone when it overshoots the budget.

    Models reliably overrun a character target on this field: the first two
    live runs came back at 163 and 165 characters against a 158 ceiling.
    check-meta.mjs fails the build above 170, so left alone this would sit five
    characters from breaking the weekly run. One tiny follow-up call is cheaper
    than a red Monday.
    """
    desc = post.get("description", "")
    if DESC_MIN <= len(desc) <= DESC_MAX:
        return post

    print(f"Description is {len(desc)} chars, outside {DESC_MIN}-{DESC_MAX}. "
          f"Requesting a rewrite.", file=sys.stderr)
    try:
        fixed = call_openai([
            {"role": "system", "content": "You write concise SEO meta descriptions. "
                                          "Never use em dashes or en dashes."},
            {"role": "user", "content":
                f'Rewrite this meta description for a post titled '
                f'"{post.get("title", "")}" so it is between {DESC_MIN} and '
                f'{DESC_MAX} characters. Count the characters. Keep the meaning '
                f'and the specifics. Return JSON: {{"description": "..."}}\n\n'
                f'Current ({len(desc)} chars): {desc}'},
        ]).get("description", "")
    except Exception as exc:  # noqa: BLE001
        print(f"Description rewrite failed ({exc}); keeping the original.",
              file=sys.stderr)
        return post

    if DESC_MIN <= len(fixed) <= DESC_MAX:
        print(f"Rewritten to {len(fixed)} chars.", file=sys.stderr)
        post["description"] = fixed
    else:
        # Still out of budget. Keep whichever is closer to the ceiling without
        # exceeding it, and let the PR body flag it for the reviewer.
        print(f"Rewrite came back at {len(fixed)} chars, still outside the "
              f"budget. Keeping the better of the two.", file=sys.stderr)
        if len(desc) > DESC_MAX and len(fixed) < len(desc):
            post["description"] = fixed
    return post


def generate(topic: dict, assets: list) -> dict:
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": USER_TEMPLATE.format(
            query=topic["query"],
            search_data=format_search_data(topic),
            related=format_related(topic),
            link_targets=link_inventory(),
            media_targets=format_media(assets),
            title_max=TITLE_MAX,
            desc_min=DESC_MIN,
            desc_max=DESC_MAX,
        )},
    ]
    # One retry. A malformed or truncated response is worth a second shot
    # before failing the weekly run outright.
    last = None
    for attempt in (1, 2):
        try:
            return repair_description(call_openai(messages))
        except (RuntimeError, json.JSONDecodeError, requests.RequestException) as exc:
            last = exc
            print(f"Generation attempt {attempt} failed: {exc}", file=sys.stderr)
    raise SystemExit(f"Both generation attempts failed. Last error: {last}")


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60].strip("-")


def yaml_string(value: str) -> str:
    """Quote a frontmatter scalar. Astro parses this as YAML."""
    return '"' + value.replace("\\", "\\\\").replace('"', "'") + '"'


def insert_figure(body: str, asset: str) -> str:
    """Drop a decorative figure before the second H2, matching the exact
    markup the hand-written posts use (see what-is-rfp-shredding.md)."""
    img = (f'<img class="post-figure" src="{asset}" alt="" aria-hidden="true" '
           f'width="720" height="480" loading="lazy" decoding="async" />')
    headings = [m.start() for m in re.finditer(r"^## ", body, re.M)]
    if len(headings) < 2:
        return body + "\n\n" + img
    cut = headings[1]
    return body[:cut] + img + "\n\n" + body[cut:]


def write_outputs(topic: dict, post: dict, assets: list) -> tuple:
    slug = slugify(post.get("slug") or post["title"])
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    SOCIAL_DIR.mkdir(parents=True, exist_ok=True)
    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)

    title = strip_dashes(post["title"]).strip()
    desc = strip_dashes(post["description"]).strip()
    body = strip_dashes(post["body_markdown"]).strip()
    today = date.today().isoformat()

    # Media: only inventory paths survive; anything else falls back to the
    # layout default so a hallucinated path can never ship a broken image.
    cover = resolve_asset(post.get("cover_asset"), assets) or DEFAULT_COVER
    cover_alt = strip_dashes(post.get("cover_alt") or "").strip()
    figure = resolve_asset(post.get("figure_asset"), assets)
    if figure and figure != cover:
        body = insert_figure(body, figure)

    # Exactly the fields in src/content.config.ts. `tags` and the search
    # metrics are deliberately not here: they are not in the schema, Astro
    # would drop them, and the ledger is the right home for them.
    frontmatter = (
        "---\n"
        f"title: {yaml_string(title)}\n"
        f"description: {yaml_string(desc)}\n"
        f"publishDate: {today}\n"
        f"updatedDate: {today}\n"
        "author: GovHub team\n"
        f"pillarSlug: {topic.get('pillar_hint', 'how-to-respond-to-a-government-rfp')}\n"
        f"cover: {yaml_string(cover)}\n"
        f"coverAlt: {yaml_string(cover_alt)}\n"
        "draft: false\n"
        "---\n\n"
    )
    (CONTENT_DIR / f"{slug}.md").write_text(frontmatter + body + "\n")

    # trailingSlash is 'always' in astro.config.mjs, so the trailing slash is
    # load-bearing. Without it the LinkedIn link eats a redirect.
    url = f"{SITE_URL}/blog/{slug}/"
    li = strip_dashes(post["linkedin_post"]).rstrip() + f"\n\n{url}"
    (SOCIAL_DIR / f"{slug}.linkedin.txt").write_text(li + "\n")

    ledger = {"topics": []}
    if LEDGER_PATH.exists():
        ledger = json.loads(LEDGER_PATH.read_text())
    ledger.setdefault("topics", []).append({
        "query": topic["query"],
        "slug": slug,
        "title": title,
        "source": topic.get("source"),
        "pillar": topic.get("pillar_hint"),
        "tags": post.get("tags", []),
        "impressions_at_pick": topic.get("impressions"),
        "position_at_pick": topic.get("position"),
        "opportunity_clicks": topic.get("opportunity_clicks"),
        "published_on": today,
    })
    LEDGER_PATH.write_text(json.dumps(ledger, indent=2) + "\n")

    return slug, title, desc, url


def main():
    topic = load_topic()
    assets = media_inventory()
    post = generate(topic, assets)
    slug, title, desc, url = write_outputs(topic, post, assets)

    # Surface the guard budgets in the PR so a near-miss is visible to a human
    # before the build complains.
    title_flag = "" if len(title) <= TITLE_MAX else f" OVER by {len(title) - TITLE_MAX}"
    desc_flag = "" if DESC_MIN <= len(desc) <= DESC_MAX else " OUT OF RANGE"

    links = post.get("internal_links_used", [])
    why = (
        f"`{topic.get('source')}`, position {topic.get('position')}, "
        f"{topic.get('impressions')} impressions, "
        f"est. +{topic.get('opportunity_clicks')} clicks/mo"
        if from_search_console(topic)
        else f"{topic.get('source')} (no Search Console history for this query)"
    )

    summary = (
        f"### {title}\n\n"
        f"**Target query:** `{topic['query']}`  \n"
        f"**Why this one:** {why}  \n"
        f"**Runner up was:** {topic.get('runner_up') or 'n/a'}  \n"
        f"**Pillar:** `{topic.get('pillar_hint')}`  \n"
        f"**Live URL after merge:** {url}\n\n"
        f"**Metadata budgets:** title {len(title)}/{TITLE_MAX}{title_flag}, "
        f"description {len(desc)} chars (target {DESC_MIN}-{DESC_MAX}){desc_flag}  \n"
        f"**Cover:** `{resolve_asset(post.get('cover_asset'), assets) or DEFAULT_COVER + ' (default)'}`  \n"
        f"**Body figure:** `{resolve_asset(post.get('figure_asset'), assets) or 'none'}`\n\n"
        f"**Internal links used:**\n"
        + ("\n".join(f"- {l}" for l in links) if links else "- (none)")
        + f"\n\n**LinkedIn copy** is in `social/{slug}.linkedin.txt`. It publishes "
          f"automatically once this merges and the page is live.\n"
    )
    Path("pr_body.md").write_text(summary)
    print(summary)


if __name__ == "__main__":
    main()
