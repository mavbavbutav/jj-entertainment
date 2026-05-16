# JJE Founding Five Form Worker

This Cloudflare Worker receives the JJE Digital Founding Five application form and sends it to `contact@jjentertainmentsolutions.com` through Resend.

## Setup

1. Create or log in to a Cloudflare account for `jjentertainmentsolutions.com`.
2. Create a Resend account and verify a sending domain or email.
3. Update `FROM_EMAIL` in `wrangler.toml` if your verified sender is different from `contact@jjentertainmentsolutions.com`.
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

The current `wrangler.toml` deploys the Worker to a `workers.dev` URL because `jjentertainmentsolutions.com` is not currently available as a Cloudflare zone.

After `npx wrangler deploy`, Wrangler will print a URL like:

```text
https://jje-founding-five-form.johnmartinferguson.workers.dev
```

Use that URL as the form endpoint until the domain is added to Cloudflare.

When `jjentertainmentsolutions.com` is managed by Cloudflare, you can switch back to a production route:

```text
https://jjentertainmentsolutions.com/api/founding-five
```

The main website can stay on GitHub Pages. Cloudflare will only intercept this `/api/founding-five` route for form submissions once the domain is active in Cloudflare.
