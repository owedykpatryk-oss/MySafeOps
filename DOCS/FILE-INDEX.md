# MySafeOps — Complete File Package

## 📋 Everything you have (18 files)

### 🚀 APP (for Cursor AI)
| # | File | Size | What it is |
|---|------|------|-----------|
| 1 | `rams-pro.jsx` | 110KB | Complete working prototype — all 14 doc types, 7 registers, 5 checklists, training matrix, site plan, weather, calendar, timeline, permit dashboard, photos, equipment, vehicles, inductions, toolbox talks, PDF export, global search, compliance score, smart suggestions, clickable risk matrix, auto-PPE, branding, dark/light theme |
| 2 | `data.js` | 31KB | Data constants — 35 trades, hazard libraries, auto-PPE mappings, 160+ equipment, vehicle checklists, toolbox talks, cert types, photo categories, blank factories |
| 3 | `utils.js` | 30KB | Business logic — PDF export (A4, logo, cover page, ToC, hazard tables, worker cards), compliance calculator, smart control suggestions, risk matrix math |
| 4 | `CURSOR-AI-GUIDE.md` | 10KB | Step-by-step instructions for Cursor AI — project setup, file structure, prompts, priorities, checklist |

### 🌐 LANDING PAGE (for mysafeops.com)
| # | File | Size | What it is |
|---|------|------|-----------|
| 5 | `index.html` | 34KB | Complete landing page — hero with phone mockup, 9 features, 3 roles, scrolling modules strip, 4-tier pricing (workers free), "Missing something?" request form, UK compliance section, CTA, footer |
| 6 | `privacy-policy.html` | 5KB | GDPR-compliant privacy policy — UK GDPR, DPA 2018, data retention for H&S records |
| 7 | `terms.html` | 5KB | Terms of service — pricing, liability, cancellation, data ownership, UK law |
| 8 | `robots.txt` | 0.1KB | SEO — allow landing, block app/api routes |
| 9 | `sitemap.xml` | 0.4KB | SEO sitemap for Google |

### 🎨 LOGO & BRANDING
| # | File | Size | What it is |
|---|------|------|-----------|
| 10 | `logo-horizontal.svg` | 1KB | Main logo — light backgrounds |
| 11 | `logo-horizontal-dark.svg` | 1KB | Main logo — dark backgrounds |
| 12 | `logo-stacked.svg` | 1KB | Square/stacked — PDFs, social |
| 13 | `logo-icon.svg` | 0.5KB | Shield icon only — favicon, app icon |
| 14 | `brand-guide.md` | 4KB | Complete brand identity — colours, fonts, sizes, voice, do's/don'ts |

### ☁️ CLOUDFLARE & DATABASE
| # | File | Size | What it is |
|---|------|------|-----------|
| 15 | `database-schema.sql` | 8KB | Full D1 database — 18 tables (orgs, users, projects, documents, workers, certs, vehicles, equipment, photos, registers, checklists, inductions, audit log, etc.) |
| 16 | `cloudflare-setup.md` | 6KB | Deployment guide — Pages, D1, R2, Workers, API routes, storage limits, photo compression, cost estimates |
| 17 | `manifest.json` | 0.8KB | PWA manifest — app name, icons, colours, standalone mode |
| 18 | `FILE-INDEX.md` | This file | Complete package index |

---

## 🗺️ Where each file goes

### On mysafeops.com (landing page)
```
mysafeops.com/
├── index.html              ← Landing page
├── privacy-policy.html     ← /privacy-policy
├── terms.html              ← /terms
├── robots.txt              ← SEO
├── sitemap.xml             ← SEO
├── manifest.json           ← PWA
├── logo-horizontal.svg     ← Header
├── logo-icon.svg           ← Favicon (convert to .ico)
└── icons/                  ← Generate from logo-icon.svg
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-192.png
    └── icon-512.png
```

### In Cursor AI (app development)
```
mysafeops-app/
├── src/
│   ├── App.jsx             ← Split from rams-pro.jsx
│   ├── data.js             ← Copy directly
│   ├── utils.js            ← Copy directly
│   └── components/         ← Split rams-pro.jsx into components
├── database-schema.sql     ← For Cloudflare D1
├── wrangler.toml           ← Create per cloudflare-setup.md
├── functions/api/          ← Create per cloudflare-setup.md
├── CURSOR-AI-GUIDE.md      ← Reference
├── brand-guide.md          ← Reference
└── public/
    ├── manifest.json
    ├── robots.txt
    └── logo files
```

---

## ✅ Launch Checklist

### Phase 1: Landing page LIVE (this week)
- [ ] Upload index.html + privacy + terms to Cloudflare Pages
- [ ] Point mysafeops.com DNS to Cloudflare
- [ ] Test on mobile
- [ ] Set up email (hello@mysafeops.com, privacy@mysafeops.com)
- [ ] Submit to Google Search Console
- [ ] Share on LinkedIn / construction forums

### Phase 2: App MVP (Cursor AI, 2-4 weeks)
- [ ] Set up Vite + React project
- [ ] Split rams-pro.jsx into components
- [ ] Create Cloudflare D1 database
- [ ] Create R2 bucket
- [ ] Build Workers API (auth, CRUD)
- [ ] Implement login / registration
- [ ] Implement role-based access (admin/supervisor/worker)
- [ ] Test on mobile devices

### Phase 3: Beta launch (1-2 weeks after)
- [ ] FESS as first user (20 people)
- [ ] Gather feedback, fix bugs
- [ ] Add storage limits & plan enforcement
- [ ] Stripe integration for payments
- [ ] Open to early access list

### Phase 4: Public launch
- [ ] Polish based on beta feedback
- [ ] SEO optimisation
- [ ] Social media presence
- [ ] LinkedIn articles about UK construction safety
- [ ] HSE forum participation
- [ ] Referral programme

---

## 💰 Pricing Summary

| Plan | Price | Admins | Supervisors | Workers | Storage |
|------|-------|--------|-------------|---------|---------|
| Free | £0 | 1 | 0 | 5 | 100MB |
| Solo | £19/mo | 1 | 1 | 10 | 2GB |
| Team | £49/mo | 3 | 5 | Unlimited FREE | 10GB |
| Business | £99/mo | Unlimited | Unlimited | Unlimited FREE | 50GB |

Annual: 20% off (Solo £15/mo, Team £39/mo, Business £79/mo)

---

## 🏗️ Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | React + Vite | Free |
| Hosting | Cloudflare Pages | Free |
| Database | Cloudflare D1 (SQLite) | Free to ~£5/mo |
| File Storage | Cloudflare R2 | Free to ~£5/mo |
| API | Cloudflare Workers | Free to ~£5/mo |
| Domain | mysafeops.com | ~£10/year |
| Email | Cloudflare Email / Zoho | Free |
| **Total hosting** | | **£0-15/month** |
