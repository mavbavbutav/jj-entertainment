# JJ Entertainment Form Worker

This Cloudflare Worker receives JJ Entertainment static-site forms and sends them through Resend. It currently supports the JJE Digital Founding Five form, the general JJ Entertainment inquiry form, the Jami Ferguson Photography inquiry form, and Real Life Court case submissions.

## Setup

1. Create or log in to a Cloudflare account for `jjecreative.com`.
2. Create a Resend account and verify a sending domain or email.
3. Update `FROM_EMAIL`, `TO_EMAIL`, `PHOTOGRAPHY_TO_EMAIL`, or `REAL_LIFE_COURT_TO_EMAIL` in `wrangler.toml` if the verified sender or recipients change.
4. Install dependencies:

   ```bash
   cd worker
   npm install
   ```

5. Add the Resend API key as a Cloudflare Worker secret. The Worker supports either `resend` or `RESEND_API_KEY`:

   ```bash
   npx wrangler secret put resend
   ```

6. Deploy:

   ```bash
   npx wrangler deploy
   ```

The current `wrangler.toml` deploys the Worker to a `workers.dev` URL. `jjecreative.com` and `www.jjecreative.com` are included in `ALLOWED_ORIGINS` so the standalone Cloudflare Pages site can submit the Founding Five form.

After `npx wrangler deploy`, Wrangler will print a URL like:

```text
https://jje-founding-five-form.johnmartinferguson.workers.dev
```

Use that URL as the form endpoint until the domain is added to Cloudflare.

When the form endpoint is ready to move behind a branded Cloudflare route, switch the site form action from the `workers.dev` URL to a production route:

```text
https://jjecreative.com/api/founding-five
```

The main JJ Entertainment website can stay on GitHub Pages. Cloudflare can handle the branded form route through the `jjecreative.com` zone when you are ready.
