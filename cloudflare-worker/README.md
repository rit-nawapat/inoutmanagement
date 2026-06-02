# Cloudflare Worker API Proxy

This Worker sits between GitHub Pages and the Apps Script backend so the browser only talks to a CORS-friendly origin.

## Environment

Set `APPS_SCRIPT_URL` to your deployed Apps Script web app URL.

## Deploy

```bash
cd cloudflare-worker
wrangler secret put APPS_SCRIPT_URL
wrangler deploy
```

## Frontend

Set `VITE_GOOGLE_SHEET_PROXY_URL` in your frontend `.env` to the Worker URL.
