# JJE Founding Five Form Worker

This Cloudflare Worker receives the JJE Digital Founding Five application form and sends it to `contact@jjentertainmentsolutions.com` through Resend.

## Setup

1. Create or log in to a Cloudflare account for `jjentertainmentsolutions.com`.
2. Create a Resend account and verify a sending domain or email.
3. Update `FROM_EMAIL` in `wrangler.toml` if your verified sender is different from `founding-five@jjentertainmentsolutions.com`.
4. Install dependencies:

   ```bash
   cd worker
   npm install
   ```

5. Add the Resend API key as a Cloudflare Worker secret:

   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```

6. Deploy:

   ```bash
   npx wrangler deploy
   ```

The route in `wrangler.toml` maps the Worker to:

```text
https://jjentertainmentsolutions.com/api/founding-five
```

The main website can stay on GitHub Pages. Cloudflare will only intercept this `/api/founding-five` route for form submissions.
