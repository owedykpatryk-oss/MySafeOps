# Product scope — prototype vs current app

This file clarifies what the **historical monolith** and planning docs described versus what the **current Vite app** in `src/` implements.

## Current app (implemented)

- SPA with **localStorage** (org-scoped keys) as the default database.
- **Optional Supabase**: authentication + full JSON backup row per user/org (`app_sync`).
- **Optional R2 uploads** via **Cloudflare Worker** (no R2 secrets in the browser).
- **Optional Anthropic** for AI modules (env exposed via `VITE_*` — see [README.md](../README.md)).
- **Many modules** registers, permits, RAMS builder, CDM, induction, documents, portals, backup, audit, etc. — see in-app **Help** and [src/App.jsx](../src/App.jsx).

## Described in older docs but not the same as the monolith

The package index [FILE-INDEX.md](./FILE-INDEX.md) and guide [CURSOR-AI-GUIDE.md](./CURSOR-AI-GUIDE.md) refer to **DOCS/rams-pro.jsx** and dependencies such as:

| Area | Prototype / doc intent | Current repo |
|------|------------------------|--------------|
| **Code shape** | Single huge `rams-pro.jsx` | Many files under `src/modules/`, `src/components/` |
| **Routing** | `react-router-dom` suggested | View state in `App.jsx` (no React Router) |
| **Styling** | Tailwind optional in guide | Inline styles + `moduleStyles` + `index.css` |
| **PDF** | jsPDF / html2canvas stack suggested | Print/HTML patterns per module (no shared jsPDF dependency in [package.json](../package.json)) |
| **Data layer** | IndexedDB (`idb`) suggested | localStorage (+ optional Supabase JSON sync) |
| **Global search** | Across all entities in prototype | Not a single global search UX |
| **Site plan / weather / calendar / timeline** | Called out in prototype marketing | Not implemented as in monolith |
| **Cloudflare D1 + Worker API** | [D1_SETUP.md](./D1_SETUP.md), [cloudflare-setup.md](./cloudflare-setup.md) | **Optional**; when `VITE_D1_API_URL` is set, org-scoped JSON (e.g. permits, RAMS) and server audit sync to D1. App does not require D1 for local-only use. |
| **Stripe / plan tiers** | Launch checklist in FILE-INDEX | Not implemented in app |
| **PWA** | manifest + icons in package story | [public/manifest.webmanifest](../public/manifest.webmanifest) + `service-worker.js` + `vite.svg`; add dedicated **maskable PNG** icons for best install UX |

## How to use this doc

- **Product / sales**: do not promise D1 for every module, Stripe, or monolith-only features without checking `src/` and [SERVER_SOURCE_OF_TRUTH.md](./SERVER_SOURCE_OF_TRUTH.md).
- **Engineering**: when porting a feature from `DOCS/rams-pro.jsx`, treat it as **reference UX**, reimplement in the current patterns (`ms`, org-scoped keys, `pushAudit`, etc.).
