# Event Time Machine API

Cloudflare Worker backend for the Event Time Machine MVP.

## What It Provides

- Creates real event records in Cloudflare D1.
- Stores uploaded photos, videos, audio, and files in Cloudflare R2.
- Saves memory metadata, captions, locations, people, and guest stories in D1.
- Returns private event/share links with upload tokens.
- Streams uploaded media back through event-scoped API URLs.
- Creates customer accounts, paid package credits, and Stripe Checkout Sessions.
- Supports password-based account signup/login, password reset, and email-link fallback.
- Requires a paid event workspace credit before creating a saved event.
- Enforces basic package upload quotas and rate limits on sensitive endpoints.
- Accepts Stripe webhooks to mark purchases paid and unlock event creation credits.

## Deployed Worker

```text
https://event-time-machine-api.johnmartinferguson.workers.dev
```

The static page at `https://jjecreative.com/event-time-machine/` automatically uses that Worker by default, including from local preview URLs. For local Worker development, open the page with `?api=local` or set `window.EVENT_TIME_MACHINE_API_URL` before loading `script.js`:

```text
http://127.0.0.1:4173/event-time-machine/?api=local
```

## Cloudflare Resources

- D1 database: `event-time-machine`
- D1 database id: `65acb8cb-7198-4ef6-aaf2-c2211ecfd856`
- R2 bucket: `event-time-machine-uploads`
- Worker: `event-time-machine-api`

## Local Development

From this folder:

```bash
npm install
npm run db:migrate:local
npm run dev
```

Serve the static site from `jj-entertainment`:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4173/event-time-machine/
```

## Production Deploy

```bash
npm run db:migrate
npm run deploy
```

The current static site must also be published with the new `event-time-machine/` folder. Once the JJE Creative site deploys, production event links like this will work:

```text
https://jjecreative.com/event-time-machine/?event=<event-slug>&token=<guest-upload-token>
```

## Stripe Setup

The Worker code is deployed with payment routes, but checkout requires Cloudflare secrets:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Optional email sign-in through Resend:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put AUTH_EMAIL_FROM
```

Create a Stripe webhook endpoint pointing to:

```text
https://event-time-machine-api.johnmartinferguson.workers.dev/api/stripe/webhook
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

## API Routes

- `GET /api/health`
- `GET /api/packages`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`
- `POST /api/auth/request-link`
- `POST /api/auth/verify`
- `GET /api/account`
- `POST /api/checkout/session`
- `POST /api/checkout/confirm`
- `POST /api/stripe/webhook`
- `POST /api/events`
- `GET /api/events/:slug`
- `PATCH /api/events/:slug`
- `POST /api/events/:slug/memories`
- `PATCH /api/events/:slug/memories/:memoryId`
- `GET /api/events/:slug/memories/:memoryId/file`
- `POST /api/events/:slug/stories`

## Current MVP Limits

- Caption suggestions are still front-end templates, not model-generated API calls.
- The Highlight Film package is a concierge add-on request, not an automated generated video workflow yet.
- Guest upload tokens are share-link based; invite management is not a full account system yet.
- Email sign-in and password-reset delivery need `RESEND_API_KEY` and `AUTH_EMAIL_FROM`; checkout confirmation requires the signed-in account that started checkout.
