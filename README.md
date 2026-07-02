# govhub-marketing

The marketing site for GovHub — an AI proposal writing platform for government
contractors. Built with [Astro](https://astro.build/).

## Deployment

Production is **Cloudflare Pages**, serving `www.govhub.online`.

- Build command: `npm run build` → static output in `./dist`
- Cloudflare Pages config: `wrangler.jsonc` (`pages_build_output_dir: "./dist"`)
- Canonical host: set in `astro.config.mjs` (`site`) — drives canonical URLs,
  Open Graph URLs, and the sitemap
- Redirects: `public/_redirects` (apex `govhub.online` → `www`, plus legacy
  slug aliases)

The apex domain (`govhub.online`) and `www` are both bound to the Pages project
so the apex → www redirect resolves.

## Local development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to ./dist
npm run preview  # preview the production build
npm run check    # astro check (type checking)
npm run guard    # fail if unresolved {{STAT}}/{{VERIFY}} tokens ship to dist
npm run verify   # check + build + guard
```

## MCP setup (Cloudflare)

This repo ships an `.mcp.json` that registers five Cloudflare MCP servers
(`cloudflare-api`, `cloudflare-docs`, `cloudflare-bindings`,
`cloudflare-builds`, `cloudflare-observability`). They use OAuth, so each
teammate authorizes them once on their machine.

1. Open the repo in Claude Code so it picks up `.mcp.json`.
2. Trust the folder when prompted (this also installs the Cloudflare Skills
   plugin from the marketplace entry).
3. Run `/mcp` — the five `cloudflare-*` servers appear as "needs auth."
4. Select each one and choose **Authenticate**. A browser tab opens for the
   Cloudflare OAuth handshake. Repeat per server — they share a login, but
   each gets its own token.

On Claude Code for the web the flow is the same: `/mcp` surfaces the auth
prompt and the OAuth handshake happens in your current browser tab.
