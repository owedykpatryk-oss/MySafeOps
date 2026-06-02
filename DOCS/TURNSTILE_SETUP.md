# Cloudflare Turnstile + Supabase Auth

Anti-bot on `/login` and **Cloud account** (sign-up, sign-in, password reset, resend confirmation).

## Quick commands

| Command | What it does |
|---------|----------------|
| `npm run env:turnstile` | Adds Cloudflare **test** site key to `.env.local` |
| `npm run setup:turnstile` | Above + sets `VITE_TURNSTILE_SITE_KEY` on **Vercel** (Production & Preview) via CLI |
| `npm run setup:turnstile:all` | Also PATCH Supabase Auth captcha (needs token) and optional Cloudflare widget API |

After Vercel env changes: **Redeploy** Production (and Preview if you use it).

## Production keys (one-time)

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Turnstile → **Add widget**
   - Hostnames: `mysafeops.com`, `www.mysafeops.com`, `localhost`, your `*.vercel.app` preview host if needed
   - Copy **Site key** → `VITE_TURNSTILE_SITE_KEY` (Vercel + `.env.local`)
   - Copy **Secret key** → Supabase only (below)

2. [Supabase](https://supabase.com/dashboard/project/burgpzankkqvpcmdkhro/auth/protection) → **Enable CAPTCHA** → Turnstile → paste **Secret key** → Save

3. `npm run setup:turnstile` (or add `VITE_TURNSTILE_SITE_KEY` in Vercel UI) → redeploy

## Optional automation (`.env.local`, gitignored)

```env
SUPABASE_ACCESS_TOKEN=   # Account → Access Tokens
# For real widget via API (not test keys):
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
```

Then:

```bash
npm run setup:turnstile:all
```

## Local dev (test keys)

Cloudflare test **site** key: `1x00000000000000000000AA`  
Matching **secret** for `supabase start`: see `supabase/config.toml` `[auth.captcha]` (test secret is already set for local CLI).

Test keys always pass the challenge — fine for dev, **replace in production**.

## Verify

1. `npm run dev` → open `/login` → Turnstile widget visible
2. Create account → no `captcha verification failed` from Supabase
3. `npm run env:check` → `VITE_TURNSTILE_SITE_KEY` checked

## Also in the app (no extra config)

- Sign-in lockout after repeated failures (browser-local)
- Sign-up and password-reset throttles per device
- Honeypot field on registration forms
- Blocklist of common disposable email domains on sign-up
- Supabase password policy: min 12 chars + letters/digits (`supabase config push`)
