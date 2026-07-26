# Cloudflare Turnstile + Supabase Auth

Anti-bot on `/login` and **Cloud account** (sign-up, sign-in, password reset, resend confirmation).

## Quick commands

| Command | What it does |
|---------|----------------|
| `npm run env:turnstile` | Adds Cloudflare **test** site key to `.env.local` |
| `npm run setup:turnstile` | Above + sets `VITE_TURNSTILE_SITE_KEY` on **Vercel** (Production & Preview) via CLI |
| `npm run setup:turnstile:all` | Also PATCH Supabase Auth captcha (needs token) and optional Cloudflare widget API |
| `npm run turnstile:push-secret` | Push **prod** Turnstile secret from `.env.local` to Supabase (safe — reverts `config.toml` test secret after) |

After Vercel env changes: **Redeploy** Production (and Preview if you use it).

## Production keys (one-time)

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Turnstile → **Add widget**
   - Hostnames: `mysafeops.com`, `www.mysafeops.com`, `localhost`, `127.0.0.1`, your `*.vercel.app` preview host if needed
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

```bash
npm run env:turnstile   # writes the test site key into .env.local
```

Test keys always pass the challenge — fine for dev, **replace in production**.

**Do not** use a production Turnstile site key on localhost unless `localhost` / `127.0.0.1` are on that widget’s hostname allow-list. If the widget fails to load (wrong host, ad blocker, corporate firewall), the app **fail-closes**: Sign in stays disabled and shows a clear error — it will not send auth without `captcha_token` (which Supabase would reject and which previously burned lockout attempts).

## Fail-closed behaviour

| State | Behaviour |
|-------|-----------|
| No `VITE_TURNSTILE_SITE_KEY` | Captcha skipped client-side (only OK if Supabase captcha is also off) |
| Key set, widget OK | Sign in / sign-up / reset require a live token |
| Key set, widget blocked | Clear error + retry; submit buttons disabled; lockout **not** incremented for `no captcha_token` / Turnstile errors |

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
