# Deploy Concord — wallet "Send" backend

GitHub Pages serves **static files only** (HTML/JS/JSON). The dashboard's
balance + transaction history read the public Arc explorer API directly from
the browser — **no backend needed** for those. Only the **Send** button needs
a small Node backend (`api-send.mjs`) that calls Circle's API with your keys.

## Prerequisites
- Node 18+
- Your Circle **developer-controlled wallet id** (the agent wallet `0x76bc...`)
- Your Circle **API key** + **entity secret** (kept in `.env`, never committed)

## Option A — local + ngrok (fastest)
1. Copy `.env.example` to `.env` and fill in the three values:
   - Circle API key
   - Circle entity secret
   - Circle wallet id
2. `npm install`
3. `node api-send.mjs`  (listens on :3001)
4. In a second terminal: `ngrok http 3001` -> gives `https://xxxx.ngrok-free.dev`
5. Put that URL into `docs/config.json` as `sendApi`, then commit + push.
   The live dashboard's Send button will now call it.

Note: ngrok-free URLs rotate when the process restarts. For a stable demo,
use Option B.

## Option B — VPS (always on, free tier)
- Copy `api-send.mjs` + `.env` to the VPS.
- `npm install && node api-send.mjs` (or `pm2 start api-send.mjs`).
- Put it behind Caddy/nginx for HTTPS, e.g. `https://pay.yourdomain/api/send`.
- Set that URL in `docs/config.json` as `sendApi`.

## config.json
`docs/config.json` holds:
```json
{ "sendApi": "https://your-backend/api/send" }
```
Empty string -> Send button shows "not configured".

## How the dashboard finds the backend
On load, the page fetches `config.json` from the same origin (GitHub Pages)
and uses `sendApi` as the endpoint. A `localStorage` key `concord_sendApi`
overrides it for local testing without a re-push.

## Security
- Never commit `.env` (it is gitignored).
- The backend sets `Access-Control-Allow-Origin: *` so the GitHub Pages site
  can call it cross-origin.
- Keys live only on your host, never in the browser or the repo.

## Repo layout
- `docs/index.html` — the wallet UI (live on GitHub Pages)
- `docs/config.json` — backend URL config
- `docs/payroll.html` — original payroll dashboard (preserved)
- `api-send.mjs` — Send backend (Circle SCP transfer)
- `.env.example` — template for your secrets
