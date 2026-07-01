# govhub-marketing
thee marketing site and efforts will be conducted in this repo for govhub

## MCP setup (Cloudflare + Netlify)

This repo ships an `.mcp.json` that registers Netlify and five Cloudflare MCP
servers (`cloudflare-api`, `cloudflare-docs`, `cloudflare-bindings`,
`cloudflare-builds`, `cloudflare-observability`). The Cloudflare servers use
OAuth, so each teammate needs to authorize them once on their machine.

### Claude Code (desktop / CLI)

1. Open the repo in Claude Code so it picks up `.mcp.json`.
2. Trust the folder when prompted (this also installs the Cloudflare Skills
   plugin from the marketplace entry).
3. Run `/mcp` — the five `cloudflare-*` servers appear as "needs auth."
4. Select each one and choose **Authenticate**. A browser tab opens for the
   Cloudflare OAuth handshake. Repeat per server — they share a login, but
   each gets its own token.

### Claude Code on the web

Same flow: `/mcp` surfaces the auth prompt and the OAuth handshake happens
in your current browser tab.

### Netlify

The Netlify server runs locally via `npx @netlify/mcp` and uses your existing
Netlify CLI credentials — run `netlify login` once if you haven't already.
