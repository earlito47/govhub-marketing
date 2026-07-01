# govhub-marketing
thee marketing site and efforts will be conducted in this repo for govhub

## Claude Code setup

This repo ships a `.mcp.json` and `.claude/settings.json` that register:

- The [`cloudflare/skills`](https://github.com/cloudflare/skills) plugin marketplace and the `cloudflare` plugin (auto-loaded on trust)
- The Netlify MCP server
- Five Cloudflare remote MCP servers: `cloudflare-api`, `cloudflare-docs`, `cloudflare-bindings`, `cloudflare-builds`, `cloudflare-observability`

### First-time OAuth for the Cloudflare MCP servers

The Cloudflare servers require a browser-based OAuth handshake before their
tools work. Run this once per machine, from an interactive Claude Code
session (desktop app, CLI, or web):

1. Open this repo in Claude Code and accept the trust prompt (this also
   installs the Cloudflare Skills plugin from the marketplace entry).
2. Run `/mcp`.
3. For each `cloudflare-*` server marked "needs auth," select it and choose
   **Authenticate**. A browser tab opens for Cloudflare sign-in; approve the
   scopes and return to Claude Code.
4. Repeat for all five servers. Tokens are stored locally per server.

After that, `/mcp` should show every `cloudflare-*` entry as connected.
