#!/usr/bin/env python3
"""
publish_social.py

Publishes any unposted social/*.linkedin.txt files, then moves them to
social/posted/ so they never fire twice. Runs after the content PR merges and
after the blog URL is confirmed live, so the link in the copy always resolves.

Providers:
  dry_run          print only, move nothing. The default, on purpose.
  postiz           Postiz public API. Identical on Cloud and self-hosted, so
                   moving to a self-hosted box later is a POSTIZ_URL change.
  blotato          Blotato v2 API.
  linkedin_direct  LinkedIn /rest/posts, for after Community Management API
                   access is granted. No third party, no subscription.

Env (common):
  SOCIAL_PROVIDER    default dry_run
  SOCIAL_API_KEY

Env (postiz):
  POSTIZ_URL         default https://api.postiz.com
  POSTIZ_INTEGRATION_ID   the connected LinkedIn page channel
  POSTIZ_POST_TYPE   draft (default) | now | schedule
                     draft stages the copy in the Postiz calendar for a human
                     to publish. Switch to now once you trust the output.

Env (blotato):
  BLOTATO_ACCOUNT_ID
  BLOTATO_PAGE_ID    the LinkedIn company page; omit to post to the profile

Env (linkedin_direct):
  LINKEDIN_ACCESS_TOKEN
  LINKEDIN_ORG_ID    numeric organization id
  LINKEDIN_VERSION   default 202605
"""

import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

PROVIDER = os.environ.get("SOCIAL_PROVIDER", "dry_run").lower()
API_KEY = os.environ.get("SOCIAL_API_KEY", "")
TIMEOUT = 60

# Defaults to draft on purpose. A post to a company page cannot be meaningfully
# unpublished, so the safe default stages copy in the Postiz calendar and lets a
# human press publish. Flip to "now" once the output has earned it.
POSTIZ_POST_TYPES = ("draft", "schedule", "now")
POSTIZ_POST_TYPE = os.environ.get("POSTIZ_POST_TYPE", "draft").lower()

SOCIAL_DIR = Path("social")
POSTED_DIR = SOCIAL_DIR / "posted"


def post_dry_run(text: str) -> dict:
    print(f"--- dry run, would post ---\n{text}\n---------------------------")
    return {"status": "dry_run"}


def post_postiz(text: str) -> dict:
    base = os.environ.get("POSTIZ_URL", "https://api.postiz.com").rstrip("/")
    integration_id = os.environ["POSTIZ_INTEGRATION_ID"]
    if POSTIZ_POST_TYPE not in POSTIZ_POST_TYPES:
        sys.exit(f"POSTIZ_POST_TYPE={POSTIZ_POST_TYPE!r} is not one of "
                 f"{', '.join(POSTIZ_POST_TYPES)}.")

    r = requests.post(
        f"{base}/public/v1/posts",
        # Postiz wants the raw key. A "Bearer " prefix here returns
        # 401 Invalid API key, despite what the MCP setup snippet uses.
        headers={"Authorization": API_KEY, "Content-Type": "application/json"},
        json={
            "type": POSTIZ_POST_TYPE,
            # Required by CreatePostRequest for every type, including "now",
            # where the server then ignores it. Omitting it is a 400.
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "shortLink": False,
            "tags": [],
            "posts": [{
                "integration": {"id": integration_id},
                "value": [{"content": text, "image": []}],
                "settings": {
                    "__type": "linkedin-page",
                    "post_as_images_carousel": False,
                },
            }],
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    result = r.json() if r.content else {}
    if POSTIZ_POST_TYPE == "draft":
        print("  Staged as a Postiz draft. It is NOT live on LinkedIn until "
              "you publish it from the Postiz calendar.")
    return result


def post_blotato(text: str) -> dict:
    target = {"targetType": "linkedin"}
    page_id = os.environ.get("BLOTATO_PAGE_ID")
    if page_id:
        # Without pageId Blotato posts to the personal profile, not the page.
        target["pageId"] = page_id
    r = requests.post(
        "https://backend.blotato.com/v2/posts",
        headers={"blotato-api-key": API_KEY, "Content-Type": "application/json"},
        json={"post": {
            "accountId": os.environ["BLOTATO_ACCOUNT_ID"],
            "content": {"text": text, "mediaUrls": [], "platform": "linkedin"},
            "target": target,
        }},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def escape_commentary(text: str) -> str:
    """LinkedIn's /rest/posts commentary field treats these as markup."""
    return re.sub(r"([\\|{}@\[\]()<>#*_~])", r"\\\1", text)


def post_linkedin_direct(text: str) -> dict:
    token = os.environ["LINKEDIN_ACCESS_TOKEN"]
    org_id = os.environ["LINKEDIN_ORG_ID"]
    r = requests.post(
        "https://api.linkedin.com/rest/posts",
        headers={
            "Authorization": f"Bearer {token}",
            "LinkedIn-Version": os.environ.get("LINKEDIN_VERSION", "202605"),
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json={
            "author": f"urn:li:organization:{org_id}",
            "commentary": escape_commentary(text),
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": [],
            },
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False,
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    # A successful create returns 201 with the URN in a header, body is empty.
    return {"urn": r.headers.get("x-restli-id", "created")}


ADAPTERS = {
    "dry_run": post_dry_run,
    "postiz": post_postiz,
    "blotato": post_blotato,
    "linkedin_direct": post_linkedin_direct,
}


def main():
    if PROVIDER not in ADAPTERS:
        sys.exit(f"Unknown SOCIAL_PROVIDER: {PROVIDER}. "
                 f"Options: {', '.join(sorted(ADAPTERS))}")

    if not SOCIAL_DIR.exists():
        print("No social/ directory yet. Nothing to publish.")
        return

    pending = sorted(SOCIAL_DIR.glob("*.linkedin.txt"))
    if not pending:
        print("Nothing to publish.")
        return

    mode = f" (type={POSTIZ_POST_TYPE})" if PROVIDER == "postiz" else ""
    print(f"Provider: {PROVIDER}{mode}. {len(pending)} post(s) pending.")
    failures = 0

    for path in pending:
        text = path.read_text().strip()
        if not text:
            print(f"Skipping empty {path.name}")
            continue
        try:
            result = ADAPTERS[PROVIDER](text)
            # "Delivered", not "Posted": in Postiz draft mode the provider
            # accepted it but nothing is live yet, and the log should not
            # claim otherwise.
            print(f"Delivered {path.name}: {json.dumps(result)[:300]}")
            if PROVIDER != "dry_run":
                # Move only after a confirmed post. A file that stays put gets
                # retried next run; a file moved too early is a silent miss.
                POSTED_DIR.mkdir(parents=True, exist_ok=True)
                shutil.move(str(path), str(POSTED_DIR / path.name))
        except Exception as exc:  # noqa: BLE001
            failures += 1
            detail = ""
            if isinstance(exc, requests.HTTPError) and exc.response is not None:
                detail = f" body={exc.response.text[:300]}"
            print(f"FAILED {path.name}: {exc}{detail}", file=sys.stderr)

    if failures:
        sys.exit(f"{failures} post(s) failed")


if __name__ == "__main__":
    main()
