# phd-research-ai-worker

Cloudflare Worker API for real Crossref literature search. The API keys for later providers or AI analysis must stay in Worker-side secrets; this first version needs no API key.

## Local commands

```sh
npm install
npm run dev
npm run build
npm run test:smoke
```

The smoke script invokes the Worker fetch handler directly in Node and calls the public Crossref API. `wrangler dev` serves the same handler in the Cloudflare runtime when the local `workerd` runtime is available.

## Endpoints

- `GET /api/health`
- `GET /api/literature/search?q=...&fromYear=2021&toYear=2026&limit=20`

The allowlist is in `wrangler.toml` as exact origins: the GitHub Pages site origin and local development origins. CORS origins never include URL paths.
