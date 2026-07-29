# Weekly content pipeline

A blog post a week, chosen by search demand rather than by whoever had an idea
on Monday, plus matching LinkedIn copy for the GovHub company page.

Two workflows, deliberately split:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `weekly-content` | Mon 13:00 UTC, or manual | Picks a topic, writes the post, verifies the build, opens a PR |
| `publish-social` | Merge to `main` touching `social/*.linkedin.txt` | Waits for the page to be live, posts to LinkedIn |

Nothing publishes without a human merging the PR.

## How the topic gets picked

`scripts/content/pick_topic.py` pulls 28 days of query data from Search
Console and keeps queries in **striking distance**: position 4 to 20, at least
25 impressions. Those are queries where Google already thinks we are relevant
but nobody clicks, which is the cheapest traffic on the board.

Each candidate is scored by the clicks we would gain at position 3:

```
score = impressions x (expected_ctr(3) - current_ctr)
```

The winner is clustered with its sibling queries, so the writer gets a real
brief instead of a single keyword. Anything the site already targets is
excluded, checked against four sources: the ledger of past runs, blog
filenames, every route under `src/pages`, and the slugs and primary keywords in
the `src/data` catalogs. That last part matters. Publishing a post that
competes with an existing `/solutions/` page splits the ranking signal instead
of concentrating it.

If Search Console is unreachable or not yet configured, the picker falls back
to a seed bank rather than failing the run, so the workflow is safe to turn on
before the Google side is wired up.

### Two bands, not one

The strict band above is the one worth chasing. A young property has nothing in
it, and that is the data, not a bug. The first live run against
`sc-domain:govhub.online` returned **439 queries and zero cleared the strict
bar**: the only things ranking 4 to 20 with 25+ impressions were branded
(`govhub`, `gov hub`, `gov.hub`), and everything non-branded sat at position 30
to 70 with 1 to 3 impressions.

So the picker tries a second, wider band before giving up:

| Tier | `source` | Position | Min impressions |
| --- | --- | --- | --- |
| Strict | `gsc_striking_distance` | 4 to 20 | 25 |
| Emerging | `gsc_emerging` | 4 to 50 | 3 |
| Backlog | `seed_bank` | n/a | n/a |

Thin demand from your actual audience still beats a generic seed topic, and the
PR body always names the tier the topic came from, so you can see how much
weight to put on it. As traffic grows the strict band starts matching and the
wider one stops being reached, with no code change. Both are tunable via the
`MIN_IMPRESSIONS`, `EMERGING_MIN_IMPRESSIONS`, and `EMERGING_MAX_POSITION`
environment variables.

## Setup

### 1. Search Console access

1. In Google Cloud, create a service account and enable the **Search Console API**.
2. Download a JSON key.
3. In Search Console: Settings, Users and permissions, Add user. Paste the
   service account email, access level **Restricted**.
4. Add the JSON as the repo secret `GSC_SERVICE_ACCOUNT_JSON`.

The default property is `sc-domain:govhub.online`. The domain property covers
both the apex and `www`, so one entry is enough. Override with the
`GSC_PROPERTY` repo variable if you use a URL-prefix property instead.

### 2. Writing

Nothing to do. It uses `OPENAI_API_KEY`, the same secret the `weekly-insights`
narrative stage already relies on.

It calls `chat/completions` with `response_format: json_object` over raw HTTP,
the same shape as `scripts/insights/generate-narratives.mjs`, so there is no
extra SDK to install.

The model defaults to `gpt-5`, not the `gpt-5-mini` the insights pipeline uses.
Different job: this is one 1500-word post a week carrying the site's organic
search, roughly four calls a month, so it is not worth economising on. Set the
`OPENAI_MODEL` repo variable to `gpt-5-mini` if you want to anyway, and
`OPENAI_REASONING` (default `medium`) to trade thinking time for cost.

### 3. LinkedIn

Set the `SOCIAL_PROVIDER` repo variable. It defaults to `dry_run`, which logs
the copy and posts nothing, so you can run the whole pipeline before deciding.

Posting to a company **page** requires LinkedIn's Community Management API.
That access is not self-serve: it needs a registered legal entity, a verified
Page, super-admin sign-off, and a manual review that takes one to four weeks.
This is the real cost driver, and it is why self-hosting a scheduler does not
automatically make this free.

| Provider | Cost | Community Management API approval | Extra config |
| --- | --- | --- | --- |
| `postiz` | $29/mo cloud, or free self-hosted | Cloud: no. Self-hosted: **yes, you apply** | `POSTIZ_URL`, `POSTIZ_INTEGRATION_ID` |
| `blotato` | $29/mo | No, they are an approved partner | `BLOTATO_ACCOUNT_ID`, `BLOTATO_PAGE_ID` |
| `linkedin_direct` | Free | **Yes, you apply** | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORG_ID` |

Postiz Cloud is the recommended start. Its public API is identical to the
self-hosted one, so moving to a self-hosted instance later is a change to
`POSTIZ_URL`, not a rewrite. If you apply for Community Management API access
in parallel and it lands, switch `SOCIAL_PROVIDER` to `linkedin_direct` and the
recurring cost goes to zero.

Set `SOCIAL_API_KEY` to whichever provider's key you land on.

## Why the workflows look the way they do

**`weekly-content` runs `npm run verify` before opening the PR.** That is the
gate. `astro check` proves the generated frontmatter satisfies the blog
collection schema in `src/content.config.ts`, and the `check:meta` and
`guard:emdash` guards hold the generated prose to the same standard as the
hand-written posts. A draft that fails never becomes a green PR.

**It runs at 13:00 UTC, four hours after `weekly-insights`.** The two Monday
jobs both commit to the repo, so they are kept apart.

**`publish-social` polls the live URL instead of sleeping.** The blog link is
the entire point of the LinkedIn post, so the job reads the URL out of the copy
file and waits for a real 200 from Cloudflare Pages, up to 15 minutes. Posting a
link that 404s because the deploy had not finished is worse than posting late.

**Published copy moves to `social/posted/`.** That archive is what makes a
rerun a no-op, so a retry can never double-post to the company page.

## Running it by hand

```bash
pip install -r scripts/content/requirements.txt

python scripts/content/pick_topic.py        # writes topic.json
python scripts/content/generate_post.py     # writes the post, copy, ledger, PR body
npm run verify                              # the same gate CI runs

SOCIAL_PROVIDER=dry_run python scripts/content/publish_social.py
```

To force a specific topic, run the `weekly-content` workflow manually and fill
in the `force_query` input.

## Files

- `scripts/content/pick_topic.py` picks the topic, writes `topic.json`
- `scripts/content/generate_post.py` writes the post, the LinkedIn copy, the
  ledger entry, and `pr_body.md`
- `scripts/content/publish_social.py` publishes and archives the copy
- `data/covered-topics.json` the ledger, created on first run. It is what stops
  the picker repeating itself, so it is committed with each post.
