# MySafeOps

UK-oriented construction safety and compliance workspace. **React + Vite** SPA: modules live under `src/modules/`, with **English UI** and **GB** defaults.

## Project layout

**Canonical application code lives under [`src/`](src/)** — roughly: **`modules/`** feature screens, **`components/`** shared UI, **`layout/`** app shell, **`navigation/`** route ids + lazy view map (`workspaceViews.js`) + More-menu sections, **`utils/`** storage/backup/search helpers, **`pages/`** marketing & login, **`offline/`** & **`context/`** as named.
The [`DOCS/`](DOCS/) folder is documentation, architecture notes, and may contain **historical or mirror files** — it is **not** the runtime source of truth; edit the matching files in `src/` when changing behaviour.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). You should see the **landing page** first; use **Sign in** or **Get started** to reach **/login**, then open the **workspace** at **/app** (dashboard and modules).

| Route | Purpose |
|-------|---------|
| `/` | Landing / marketing |
| `/login` | Sign in (Supabase if configured) or open local workspace |
| `/app` | Main app (bottom navigation, modules) — protected when `VITE_SUPABASE_*` is set unless you choose “continue without cloud sign-in” |

Public client/subcontractor links still use query strings: `?portal=TOKEN`, `?subcontractor=TOKEN`.

For **Cloudflare Pages** (and similar static hosts), copy [public/_redirects](public/_redirects) into the publish root so client-side routes resolve.

```bash
npm run build    # production bundle → dist/
npm run preview  # serve dist locally
```

A minimal **web app manifest** is at [public/manifest.webmanifest](public/manifest.webmanifest) (linked from `index.html`) so browsers can offer “Add to Home Screen”. Replace `/vite.svg` with proper **192×192 / 512×512** icons when you have branded assets.

**Offline:** [public/service-worker.js](public/service-worker.js) precaches the app shell for Vite (`/`, `index.html`, `manifest.webmanifest`, etc.) and uses [public/offline.html](public/offline.html) as a fallback when navigation fails. Bump `SW_VERSION` in the worker after meaningful cache changes.

## Configuration

Copy [.env.local.example](.env.local.example) to **`.env.local`** in the project root and fill in any optional values. Never commit `.env.local`.

| Area | Purpose |
|------|---------|
| `VITE_SUPABASE_*` | Optional sign-in and JSON cloud backup (`app_sync` table) |
| `VITE_ANTHROPIC_*` | Optional AI features (RAMS, toolbox, photo hazard) |
| `VITE_STORAGE_*` / `VITE_R2_PUBLIC_BASE_URL` | Optional document uploads via Cloudflare R2 Worker |

### Security: `VITE_*` variables

Anything prefixed with `VITE_` is **embedded in the browser bundle**. Do not put production secrets there. The example file warns that **Anthropic API keys in `VITE_` are visible to anyone who loads the app**; use only for local/dev or proxy AI calls through your own backend in production.

## Optional: Supabase (auth + backup)

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Enable **Email** (or other) auth under Authentication → Providers.
3. Run the SQL migration on your project:
   - **Dashboard**: SQL Editor → paste and run [supabase/migrations/20260407120000_app_sync.sql](supabase/migrations/20260407120000_app_sync.sql), or  
   - **CLI**: `supabase db push` (if the project is linked).
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

Cloud upload/restore is available from **Backup** after sign-in (see [src/utils/cloudSync.js](src/utils/cloudSync.js)).

## Optional: R2 document uploads

Deploy the Worker under `cloudflare/workers/r2-upload` and set `VITE_STORAGE_API_URL` and `VITE_STORAGE_UPLOAD_TOKEN` as described in `.env.local.example`. More context: [DOCS/architecture-current.md](DOCS/architecture-current.md) and [DOCS/cloudflare-setup.md](DOCS/cloudflare-setup.md) (R2 / Pages sections).

## Documentation map

| Document | Use |
|----------|-----|
| [DOCS/architecture-current.md](DOCS/architecture-current.md) | How the app stores data today (localStorage + optional cloud) |
| [DOCS/PRODUCT_SCOPE.md](DOCS/PRODUCT_SCOPE.md) | Prototype vs current app feature gaps |
| [DOCS/brand-guide.md](DOCS/brand-guide.md) | Brand colours and voice |
| [DOCS/CURSOR_PROMPT.md](DOCS/CURSOR_PROMPT.md) | Product/technical context for contributors and AI assistants |
| [DOCS/FILE-INDEX.md](DOCS/FILE-INDEX.md), [DOCS/CURSOR-AI-GUIDE.md](DOCS/CURSOR-AI-GUIDE.md) | **Historical** prototype package notes (see banners in those files) |

In-app **Help** lists all modules available from the navigation.

## Licence

Private project (`"private": true` in [package.json](package.json)).
