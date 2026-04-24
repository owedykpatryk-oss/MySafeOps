# MySafeOps — FESS Readiness & Full Production Sprint

**For Cursor.** Read this entire file before starting. Don't skip sections, don't reorder the phases, don't invent scope. Every item exists because it unblocks a real FESS adoption decision or it's a generic product improvement that benefits every UK contractor we'll ever sign.

---

## Product context

- **Product:** MySafeOps (mysafeops.com) — UK construction & industrial safety platform
- **Stack now:** single-file React prototype (`rams-pro.jsx` ~110KB), `data.js`, `utils.js`, `index.html` landing page. State in **localStorage** with manual cloud backup. Hosted on Cloudflare Pages.
- **Brand:** teal `#0d9488`, orange `#f97316`, navy `#0f172a`. Plus Jakarta Sans (landing), DM Sans (app). Logo = teal shield with orange checkmark.
- **Infra target:** Cloudflare Pages (hosting) + D1 (SQLite) + R2 (files) + Workers (API) + KV (sessions/rate limits).
- **Payments:** Stripe hosted Checkout / Payment Links — **Secret Key NEVER client-side**.
- **Pricing:** Free £0 · Solo £29/mo · Team £79/mo · Business £149/mo · Enterprise £399/mo · Enterprise Plus (contact). **Flat org price (not per seat); field users within tier caps** — core differentiator, don't gate workers behind a per-head tax.
- **Roles:** Admin (full) · Supervisor (reports/checklists/permits) · Worker (read/sign/report — free).

**Driver:** review from Jack Haswell (FESS Group, ~20 engineers, food/pet/pharma/petrochem contractor). Using this sprint to win the FESS pilot AND make the product generically stronger for every other UK contractor.

**OUT of scope (Jack's "Route B"):** jobs register, timesheets, POs, CRM, engineer scheduling, group MI consolidation, accounting integrations. MySafeOps is a safety platform, not an operating system.

---

## Execution phases

Four phases. Ship phase by phase, don't start phase N+1 before phase N passes acceptance.

- **Phase 1 — Foundation (the 5 blockers):** data model, audit log, legal pack, login cleanup, support email.
- **Phase 2 — Security hardening:** encryption, MFA, rate limiting, session mgmt, backup, Cyber Essentials readiness.
- **Phase 3 — Industrial Sector Pack:** LOTO, food-env hot work, high-care zones, CIP, allergen changeover, ATEX/DSEAR, GMP deviation, CDM 2026.
- **Phase 4 — Polish & production-readiness:** empty/loading/error states, accessibility, performance, onboarding, Stripe, monitoring.

---

# PHASE 1 — Foundation (the 5 blockers)

## 1.1 Data model migration (localStorage → D1 source of truth)

### Why first
FESS has ~20 engineers. Two editing the same permit → localStorage loses data. Every downstream feature depends on D1 being source of truth.

### Architecture

```
Browser (React app)
    ↓ fetch with JWT in Authorization header
Cloudflare Worker (/api/*)
    ↓
D1 (business data) + R2 (photos, PDFs) + KV (sessions, rate limits)
```

- **D1 = source of truth.** Always.
- **localStorage = offline cache only.** Populated on login, reconciled on every online write.
- **Every mutation goes through a Worker endpoint.** Never direct client → storage.
- **Optimistic UI stays**, each action queues a Worker call. On failure → amber "pending sync" dot, retried when online.
- **Conflict strategy:** last-write-wins on individual fields, audit log captures every version. No CRDTs.

### Files to create

```
/workers/api/
  index.ts                    # entry, Hono
  auth.ts                     # JWT issue/verify, bcryptjs
  routes/
    organisations.ts
    users.ts
    documents.ts              # RAMS, 7 permit types, COSHH, LOLER, fire log, waste
    registers.ts              # visitors, vehicles, equipment, training, checklists
    uploads.ts                # pre-signed R2 URLs
    audit.ts
    billing.ts                # Stripe webhooks, subscription status
  middleware/
    auth.ts                   # verify JWT, attach ctx.user, ctx.orgId
    audit.ts                  # writes audit_log on every mutation
    rateLimit.ts              # see phase 2
    securityHeaders.ts        # see phase 2
  db/
    schema.sql
    query.ts                  # org-scoped query helper
  wrangler.toml

/src/lib/
  api.ts                      # client fetch wrapper with auth + offline queue
  cache.ts                    # localStorage cache layer
  sync.ts                     # background reconciliation

/src/hooks/
  useResource.ts              # const { data, mutate, pending } = useResource('permits', id)
  useAuth.ts
```

### Files to modify

- `rams-pro.jsx` — replace every `localStorage.getItem/setItem` with `useResource` or `api.foo()`. Keep component tree identical. No UI changes.
- `data.js` — seed data for new orgs only. Not a runtime source.

### D1 core schema

```sql
-- Tenancy + auth
CREATE TABLE organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',     -- free | solo | team | business
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  industry_sectors TEXT,                  -- JSON: ['construction','food','pharma','petrochem']
  cdm_role TEXT,                          -- client | principal_designer | principal_contractor | contractor
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                     -- admin | supervisor | worker
  full_name TEXT,
  mfa_secret TEXT,                        -- encrypted; null if not enrolled
  mfa_enabled INTEGER DEFAULT 0,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX idx_users_org ON users(organisation_id);

-- Unified documents table (all 14+ document types)
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,                   -- draft | active | expired | archived
  data JSON NOT NULL,
  site_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_documents_org_type ON documents(organisation_id, type);
CREATE INDEX idx_documents_status ON documents(organisation_id, status);

CREATE TABLE register_entries (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  register_type TEXT NOT NULL,
  data JSON NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_register_org_type ON register_entries(organisation_id, register_type);

CREATE TABLE signatures (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  signed_at INTEGER NOT NULL,
  ip_address TEXT,
  signature_image_r2_key TEXT
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  parent_type TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at INTEGER NOT NULL
);

CREATE TABLE password_resets (
  token TEXT PRIMARY KEY,                 -- 32-byte random hex
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,            -- created_at + 1 hour
  used_at INTEGER
);
```

### Document type enum

```ts
type DocumentType =
  // Core construction (phase 1)
  | 'rams'
  | 'permit_hot_work'
  | 'permit_confined_space'
  | 'permit_working_at_height'
  | 'permit_electrical'
  | 'permit_excavation'
  | 'permit_lifting'
  | 'permit_general'
  | 'coshh'
  | 'loler'
  | 'fire_log'
  | 'waste_transfer'
  | 'toolbox_talk'
  | 'near_miss'
  | 'incident_report'
  // Industrial sector pack (phase 3)
  | 'permit_loto'
  | 'permit_hot_work_food'
  | 'high_care_access'
  | 'cip_signoff'
  | 'allergen_changeover'
  | 'atex_dsear'
  | 'gmp_deviation';
```

### Auth flow

- **Signup:** creates `organisation` + first `user` (role=admin). Returns JWT.
- **Login:** email + password → JWT. 7-day expiry. Stored as `mso_token`.
- **JWT payload:** `{ user_id, organisation_id, role, session_id, mfa_verified }`.
- **Every Worker route** validates JWT, scopes queries to `organisation_id`.

### Multi-tenancy rule (CRITICAL)

No query ever omits `organisation_id`. Enforce in helper:

```ts
// workers/api/db/query.ts
export function orgScope(db: D1Database, orgId: string) {
  return {
    all: <T>(sql: string, ...params: any[]) => {
      if (!sql.includes('organisation_id')) {
        throw new Error('org-scoped query missing organisation_id clause');
      }
      return db.prepare(sql).bind(...params, orgId).all<T>();
    },
    // first, run, etc.
  };
}
```

### Offline sync

- On login, fetch all org data for this user's role → `mso_cache_${orgId}`.
- On write: optimistic update → queue in `mso_sync_queue` → POST to Worker. 2xx → remove from queue. Error → "pending sync" dot.
- Background sync every 30s while online.
- 409 → overwrite local with server state, toast: "This record was updated by someone else — your changes have been merged."

### Acceptance

- [ ] Two browsers, two users in same org, editing different permits simultaneously → both writes land in D1.
- [ ] Two browsers, same user, same permit field → last write wins, audit log shows both.
- [ ] Offline → create permit → amber dot → reconnect → dot gone, permit in D1.
- [ ] Worker role cannot hit admin-only endpoints (403).
- [ ] No raw localStorage calls in `rams-pro.jsx` outside `cache.ts` / `api.ts`.
- [ ] Logout clears cache and sync queue.

---

## 1.2 Audit log (tamper-evident)

### Schema

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,                   -- create|update|delete|sign|export|login|logout|role_change|login_failed|mfa_enrolled|password_reset
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before JSON,
  after JSON,
  ip_address TEXT,
  user_agent TEXT,
  occurred_at INTEGER NOT NULL,
  prev_hash TEXT,
  row_hash TEXT NOT NULL
);
CREATE INDEX idx_audit_org_time ON audit_log(organisation_id, occurred_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

### Hash chain

`row_hash = sha256(org_id + user_id + action + entity_type + entity_id + before + after + occurred_at + prev_hash)`. `prev_hash` = previous `row_hash` for this org. Broken chain = tampering.

### Middleware

```ts
// workers/api/middleware/audit.ts
export async function withAudit<T extends {id: string}>(
  c: Context,
  action: string,
  entityType: string,
  fn: () => Promise<{ result: T, before: any, after: any }>
) {
  const { result, before, after } = await fn();
  await writeAuditRow(c.env.DB, {
    organisation_id: c.get('orgId'),
    user_id: c.get('userId'),
    action, entity_type: entityType,
    entity_id: result.id,
    before, after,
    ip_address: c.req.header('CF-Connecting-IP'),
    user_agent: c.req.header('User-Agent'),
    occurred_at: Date.now(),
  });
  return result;
}
```

### UI

- `/audit` (admin only) — paginated, filters: user / entity / date / action.
- Every document detail page: "Activity" tab.
- CSV + PDF export (admin only).
- `/api/audit/verify` — walks chain, returns `{ok:true}` or broken row id.

### Acceptance

- [ ] Every create/update/delete/sign writes exactly one audit row.
- [ ] Login success + failure → audit rows.
- [ ] Chain verify returns `ok:true` on fresh DB; returns broken row id on manual tamper.
- [ ] Worker role → 403 on `/audit`.
- [ ] CSV exports open cleanly in Excel.

---

## 1.3 Legal pack live

Four docs, live and linked:

1. Privacy Policy → `/privacy`
2. Terms & Conditions → `/terms`
3. Cookie Policy → `/cookies`
4. DPA → `/dpa` (downloadable PDF)

Drafts exist in project files (check `FILE-INDEX.md`). If missing, generate using UK B2B SaaS templates covering:
- GDPR lawful basis (legitimate interest for safety records, consent for marketing)
- Data retention: **7 years safety records** (HSE guidance), **6 years financial** (UK Limitation Act)
- Sub-processors: Cloudflare (hosting/D1/R2), Stripe (payments), Resend (email)
- Data subject rights (access, rectification, erasure, portability, objection)
- International transfers: UK/EU only
- Breach notification: 72h to ICO
- Cookies: strictly necessary only (session, CSRF), no analytics by default

### Footer (landing + app)

```html
<footer>
  © 2026 MySafeOps ·
  <a href="/privacy">Privacy</a> ·
  <a href="/terms">Terms</a> ·
  <a href="/cookies">Cookies</a> ·
  <a href="/dpa">DPA</a> ·
  <a href="/security">Security</a> ·
  <a href="mailto:support@mysafeops.com">Support</a>
</footer>
```

### Signup form

Required checkbox above "Create account":
> ☐ I agree to the [Terms](/terms) and [Privacy Policy](/privacy).

### Cookie notice (one-liner, not a banner)

> MySafeOps uses essential cookies only to keep you logged in. No tracking, no ads. [Learn more](/cookies)

### Acceptance

- [ ] All four docs load on HTTPS.
- [ ] All four show "Last updated" date.
- [ ] Footer on every page.
- [ ] Signup blocks until Terms ticked.
- [ ] DPA downloads as clean PDF.

---

## 1.4 Login page cleanup

### Grep and destroy

```
supabase | redirect_url | localhost | 127.0.0.1 | TODO | FIXME | DEBUG | console.log
```

Every DOM-rendered hit → remove.

### Replace copy

- H1: "Welcome back to MySafeOps"
- Sub: "Sign in to manage your site safety."
- Fields: Email, Password
- "Forgot password?" → `/reset-password` (real flow)
- "New to MySafeOps? Create an account" → `/signup`

### `/reset-password` flow

Request form → generate 32-byte hex token → insert `password_resets` row (1h expiry) → email link → reset form → update `password_hash`, mark token `used_at`, audit log. Invalidate all active sessions for that user on reset.

### Acceptance

- [ ] Zero Supabase/localhost/dev refs visible.
- [ ] `/reset-password` works end-to-end on prod.
- [ ] Login page matches brand (teal/orange/navy, DM Sans).

---

## 1.5 Support email + domain housekeeping

### Cloudflare Email Routing

- `support@mysafeops.com` → Patryk's inbox
- Also: `hello@`, `billing@`, `security@`, `privacy@`

### Replace every `mysafeops@gmail.com`

In repo, landing, app, legal docs, email templates, meta tags → `support@mysafeops.com`.

### Transactional email (Resend)

- Verify `mysafeops.com` domain
- Add SPF, DKIM, DMARC in Cloudflare DNS
- DMARC: start `p=none` → 7 days clean → `p=quarantine`
- App emails from `no-reply@mysafeops.com`
- Emails: password reset, signup confirmation, invitation, weekly audit summary (admin opt-in), security alerts

### Acceptance

- [ ] Email to `support@mysafeops.com` arrives in < 30s.
- [ ] Password reset emails from `no-reply@mysafeops.com`.
- [ ] `mail-tester.com` score ≥ 9/10.
- [ ] `grep -r mysafeops@gmail.com` returns 0.

---

# PHASE 2 — Security hardening

Every item is either Cyber Essentials prerequisite or enterprise procurement table-stakes. Cost: ~£400 (Cyber Essentials fee) + dev time. Payoff: unblocks every conversation with clients who have procurement teams.

## 2.1 Encryption

### At rest
- **D1 / R2:** Cloudflare AES-256 automatic. Document in `/security`.
- **Sensitive fields** (MFA secrets, future PII): AES-GCM at app layer with Wrangler secret `ENCRYPTION_KEY`. Add `key_version` column for annual key rotation.

### In transit
- HTTPS everywhere. HSTS: `max-age=31536000; includeSubDomains; preload`.
- Disable TLS < 1.2 in Cloudflare dashboard.
- Security headers on every response:

```ts
// workers/api/middleware/securityHeaders.ts
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.r2.cloudflarestorage.com; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'"
};
```

## 2.2 MFA (TOTP)

**Required for admin** (7-day grace), **optional** for supervisor/worker.

- Lib: `@oslojs/otp`
- Enrolment: show QR → user scans → enters code → store encrypted `mfa_secret`, `mfa_enabled=1`
- Backup codes: 10 single-use, stored bcrypt-hashed, invalidated on use
- Login: password → if `mfa_enabled` → prompt TOTP → verify → JWT with `mfa_verified=true`
- Org setting (Business plan): "Require MFA for all users"

## 2.3 Password policy

- **Min 12 chars**, no complexity rules (NCSC 2024 — length beats complexity)
- **HIBP check** via k-anonymity API on signup + password change (SHA-1 first 5 chars → reject if breach count > 0)
- **bcrypt cost 12** (Workers CPU budget allows it)
- **History:** last 5 hashes, prevent reuse (Business plan)

## 2.4 Session management

### Sessions in KV

Don't rely solely on JWT. KV namespace `SESSIONS`:
- Key: `session:${sessionId}`
- Value: `{ user_id, org_id, created_at, last_activity, ip, user_agent, revoked: false }`
- TTL: 7 days, refreshed on activity

JWT contains `session_id`. Every request: verify JWT + KV lookup. Revoked or expired → 401.

### `/settings/sessions`

- List all active sessions: device, IP, last activity, approximate location
- Revoke any (sets `revoked=true` in KV)
- "Revoke all other sessions" button
- Force re-login all sessions on password change

## 2.5 Rate limiting

Using KV counter or Cloudflare native:

| Endpoint | Limit | Window |
|---|---|---|
| `/api/auth/login` | 5 per IP | 15 min |
| `/api/auth/login` | 10 per email | 1 hour |
| `/api/auth/reset-password` request | 3 per email | 1 hour |
| `/api/uploads/*` | 100 per user | 1 hour |
| `/api/*` (general) | 1000 per user | 1 min |

After 5 failed logins per email → 30-min lock + security alert email with IP + location.

## 2.6 Account lockout + brute force

On failed login: `failed_login_attempts++`. `>= 5` → `locked_until = now() + 30min`, counter reset. Successful login → counter reset. Every failed attempt → audit log with IP.

## 2.7 Backup & DR

### D1 backup
- Daily scheduled Worker cron → SQL dump → R2 `mso-backups` with lifecycle: keep 30 days daily, 12 months monthly
- Quarterly restore test (document in `/security`)

### R2 backup
- R2 durability: 11 9s
- Monthly cross-region replication to second R2 bucket

### Targets (document)
- **RPO:** 24h (daily backup cadence)
- **RTO:** 4h (detection to restored service)

## 2.8 Cyber Essentials readiness

Not code — documentation. `/SECURITY.md`:
- User access controls (roles, MFA)
- Secure configuration (CSP, HSTS, TLS 1.2+)
- Patch management (Cloudflare managed + `npm audit` weekly in GitHub Actions)
- Malware protection (N/A — serverless)
- Firewall (Cloudflare WAF + custom rules)

Plus:
- `/.well-known/security.txt` with `security@mysafeops.com`
- Public `/security` page summarising posture (feeds procurement)
- Responsible disclosure policy

## 2.9 Logging & monitoring

- Cloudflare Workers logs → Logpush to R2 (30-day retention)
- Sentry (free tier) — client + Worker error tracking
- Uptimerobot or Better Stack, 1-min checks on `/api/health`, `/`, `/login`
- Alerts: email + SMS to Patryk on 5xx spike or downtime > 2 min

### Phase 2 acceptance

- [ ] `securityheaders.com` → A+
- [ ] `ssllabs.com` → A or A+
- [ ] MFA works with Google Authenticator, 1Password, Authy
- [ ] Backup codes work (single-use)
- [ ] Admin without MFA blocked after 7-day grace
- [ ] Rate limit verified (6 logins/15min → locked)
- [ ] HIBP rejects known-breached passwords
- [ ] D1 daily backup visible in R2 `mso-backups`
- [ ] `/security` page live
- [ ] `/.well-known/security.txt` resolves
- [ ] Sentry capturing errors
- [ ] Uptimerobot + test alert received

---

# PHASE 3 — Industrial Sector Pack

## Why this exists

Jack flagged FESS's engineers mostly work inside food, pet food, pharma, petrochem factories. The compliance stack overlaps with but isn't the same as construction. Current MySafeOps is "Built for UK Construction" — half the story for sites FESS actually works on.

**Positioning:** NOT a FESS-only feature. Every UK contractor sending engineers into food factories has the same gap. HandsHQ, Papertrail, Joblogic treat food sector as "add-on forms". We'll treat it as a first-class industry pack.

## Product shape

Signup asks: "Which sectors does your organisation work in?" — multi-select:
- ☐ Construction (default)
- ☐ Food & Beverage
- ☐ Pet Food
- ☐ Pharmaceuticals
- ☐ Petrochemical
- ☐ Dairy
- ☐ Brewing & Distilling

Selection drives which document types and register tabs appear. Under the hood: all `documents` rows with different `type` values. No schema change — conditional UI and different templates.

Admins change sectors any time in Organisation Settings.

## 3.1 LOTO (Lockout/Tagout) — first-class workflow

Not just a form — a workflow that interlocks with Hot Work and Electrical permits.

### Schema (documents.data JSON)

```json
{
  "equipment_name": "CIP skid 3",
  "equipment_tag": "CIP-03",
  "isolation_points": [
    {
      "id": "iso-1",
      "type": "electrical",
      "description": "MCC Room 2, Breaker 14",
      "lock_number": "LOTO-1045",
      "tag_number": "T-2234",
      "locked_by_user_id": "...",
      "locked_at": 1714000000000,
      "verified_by_user_id": "...",
      "verified_at": 1714000120000,
      "unlocked_by_user_id": null,
      "unlocked_at": null
    }
  ],
  "zero_energy_verified": true,
  "zero_energy_verified_by": "...",
  "zero_energy_method": "Attempted start from MCC — confirmed no power",
  "linked_permits": ["permit_hot_work_food:abc", "permit_electrical:xyz"],
  "group_lock": false,
  "authorised_persons": ["user-id-1", "user-id-2"]
}
```

Isolation types: `electrical | pneumatic | hydraulic | steam | process | thermal`

### Workflow

1. **Planning:** supervisor creates LOTO, lists isolation points.
2. **Isolation:** each point → "Lock applied" → prompts photo of lock+tag → signature.
3. **Verification:** 4-eyes — second competent person verifies each. Cannot be the locker.
4. **Zero-energy check:** test stored energy released (try start, bleed pressure). Text + photo.
5. **Work authorised:** only once all isolations locked+verified+zero-energy.
6. **Removal:** reverse sequence. Only the locker can remove (Admin override with audit note).
7. **Locked/verified state is mandatory gate** — Hot Work on same equipment cannot issue unless LOTO active.

### Interlock logic

Creating Hot Work (food) or Electrical permit:
- Search open LOTO permits tagged to same equipment.
- None → warning: "No LOTO in place for this equipment. Continue anyway?" (justification required).
- Exists → auto-link, show lock status in permit header.

## 3.2 Hot Work (food environment)

Extends standard Hot Work with food-specific fields:

```json
{
  "food_zone_class": "high_care",         // ambient|low_risk|high_risk|high_care
  "production_status": "down",            // running|changeover|down|cip
  "foreign_body_controls": {
    "magnet_check_before": true,
    "magnet_check_after": true,
    "spark_containment": "welding_blanket",
    "debris_sheet_deployed": true,
    "post_work_metal_detector_check_required": true
  },
  "allergen_controls": {
    "allergens_present_in_area": ["milk", "gluten", "nuts"],
    "additional_ppe": ["disposable_overalls", "hair_net"],
    "cleaning_before": true,
    "cleaning_after_required": true,
    "cleaning_signed_off_by": null
  },
  "linked_loto_id": "permit_loto:xyz",
  "fire_watch": {
    "required": true,
    "duration_minutes": 60,
    "watcher_user_id": "...",
    "watcher_signature_at": 1714000000000
  },
  "qc_signoff_required": true,
  "qc_signed_off_by": null,
  "qc_signed_off_at": null
}
```

**Rule:** QC sign-off required before area returns to production. Blocks permit closure until a user with `qc_signoff` permission closes it.

## 3.3 High-care / high-risk zone access register

```json
{
  "zone_name": "High Care Slicing Room",
  "zone_class": "high_care",
  "entry_timestamp": 1714000000000,
  "exit_timestamp": null,
  "visitor_user_id": "...",
  "visitor_name": "External Engineer Name",
  "visitor_company": "FESS Group",
  "hygiene_checks": {
    "hand_wash_sanitise": true,
    "dedicated_ppe_donned": true,
    "hair_beard_net": true,
    "no_jewellery_confirmed": true,
    "footwear_changed": true
  },
  "escorted_by_user_id": "...",
  "purpose": "Repair of slicing blade",
  "tools_brought_in": ["torx T20", "shifter", "feeler gauge"],
  "tools_taken_out": ["torx T20", "shifter", "feeler gauge"],
  "tool_reconciliation_ok": true
}
```

UI: timeline per zone, tool-count-mismatch alert, real-time "who's in the zone" widget.

## 3.4 CIP (Clean-in-Place) sign-off

```json
{
  "equipment_id": "CIP-03",
  "work_order_ref": "WO-12345",
  "cip_run_at": 1714000000000,
  "cip_program": "Standard 4-step caustic",
  "cip_temperature_peak_c": 82,
  "cip_duration_minutes": 45,
  "swab_results": [
    { "location": "Product contact surface A", "atp_rlu": 12, "pass": true },
    { "location": "Weld seam B", "atp_rlu": 8, "pass": true }
  ],
  "visual_inspection_passed": true,
  "signed_off_by": "...",
  "released_to_production_at": 1714000000000
}
```

## 3.5 Allergen changeover

- Org defines allergen changeover schedules (register_entries).
- Creating any permit → check target site+time vs changeover window → banner: "⚠️ Allergen changeover in progress: milk → nut-free. Additional controls apply."
- Additional PPE auto-populates on permit.

## 3.6 ATEX / DSEAR zoning

```json
{
  "site_id": "...",
  "area_classification": "zone_1",        // zone_0|1|2|20|21|22|safe
  "atmosphere_type": "gas",               // gas|dust|mist|hybrid
  "substance": "methane",
  "temperature_class": "T3",
  "equipment_group": "IIA",
  "equipment_category": "2G",
  "ignition_sources_controlled": [],
  "operatives_certified_compex": ["user-id-1"],
  "risk_assessment_ref": "document_id",
  "permit_required": true
}
```

Zone markers on interactive site plan. Any permit inside a zoned area pulls ATEX classification into the permit header.

## 3.7 GMP deviation logging (pharma)

```json
{
  "site_id": "...",
  "batch_ref": "...",
  "deviation_type": "planned",            // planned|unplanned
  "description": "...",
  "immediate_action_taken": "...",
  "quality_notified_at": 1714000000000,
  "quality_contact": "...",
  "capa_ref": "...",
  "closed_at": null
}
```

Export to PDF formatted for pharma QA document control systems.

## 3.8 CDM 2026 reform readiness

CDM regulations under review with changes expected 2026. Build flexibility:

- New `organisations.cdm_role` field (already in schema above)
- RAMS template splits duties by CDM role (dropdown drives which fields appear)
- Pre-construction Information (PCI) upload slot per project
- Construction Phase Plan (CPP) template
- Health & Safety File accumulator — auto-gathers all permits, RAMS, as-built info per project
- F10 notification threshold tracker — auto-flag when project exceeds 500 person-days or 30-day duration
- "CDM 2026" blog/changelog section updated as HSE publishes

### Phase 3 acceptance

- [ ] Signup asks sectors, stores in `organisations.industry_sectors`
- [ ] Sector drives UI: food orgs see LOTO/Hot Work Food/High Care/CIP/Allergen in doc picker; construction-only orgs don't
- [ ] LOTO workflow enforces lock → verify → zero-energy → authorise → remove
- [ ] Hot Work (food) cannot issue without active LOTO unless justification provided
- [ ] QC sign-off blocks Hot Work closure until complete
- [ ] High-care access register + tool reconciliation flag
- [ ] ATEX zones render on site plan
- [ ] CDM role drives RAMS template fields

---

# PHASE 4 — Polish & production-readiness

Things Jack didn't flag but any competent reviewer notices on pilot. Difference between "clever beta" and "product".

## 4.1 Empty/loading/error states

### Every list/table needs three states

1. **Loading:** skeleton rows matching layout (no spinners).
2. **Empty:** illustration + headline + action.
   - "No permits yet" → "Create your first permit"
   - "No incidents this month" → "Great news. Keep it up." (celebratory)
3. **Error:** friendly message + retry + "Contact support".

### Global error boundary

Wrap app. Report to Sentry. User sees:
> "Something broke on our end. We've been notified. Try refreshing, or [contact support](mailto:support@mysafeops.com)."

### Offline banner

Top-of-screen amber: "You're offline. Changes will sync when you reconnect." Disappears on reconnect.

## 4.2 Accessibility (WCAG 2.2 AA)

- Semantic HTML (no `<div onClick>` — use `<button>`)
- All inputs have `<label>`
- Colour contrast verified (teal on white, orange on white)
- Focus rings visible (don't `outline: none` without replacement)
- Keyboard navigable — permit creation without mouse
- Screen reader tested (VoiceOver iOS, NVDA Windows)
- Skip-to-content link
- `aria-live` on sync status indicators
- `axe` runs in CI on every PR

## 4.3 Performance

### Targets

- Landing: LCP < 2.0s, CLS < 0.1, INP < 200ms (75th percentile, mobile 4G)
- App first load: < 3s on 4G
- Subsequent navigation: < 500ms

### Actions

- **Code-split** `rams-pro.jsx` (110KB single file). React.lazy by route: `/dashboard`, `/permits`, `/documents`, `/registers`, `/audit`, `/settings`.
- **Lazy-load** PDF library (jsPDF) — only when user hits Export.
- **Image compression** client-side (`browser-image-compression`) before R2 upload. Max 1920px long edge, 85% quality, WebP if supported. ~10x storage saving.
- **Cloudflare Images** or Worker image transforms for responsive sizes.
- **Preconnect** to fonts, Stripe, R2 in `<head>`.
- **Inline critical CSS** on landing page.

## 4.4 Mobile UX

FESS engineers primarily on phones. Test every flow on real Android mid-range device:

- Tap targets ≥ 44px
- Bottom-sheet modals on mobile (not centred dialogs)
- Camera: `<input type="file" accept="image/*" capture="environment">`
- Signature canvas: proper touch handling, Clear + Done always visible
- Long forms: section-by-section with progress, autosave draft every 30s

## 4.5 Onboarding

New org signup triggers onboarding:
1. Welcome screen, 3-step progress
2. Invite team (skip allowed)
3. Select sectors
4. Add first site
5. Create first RAMS (from template)
6. Done — dashboard with Readiness score 0/100 + gentle nudges

## 4.6 In-product help

- `?` icon top right → slide-in help panel
- Contextual help: "What is a RAMS?" → short article
- Loom videos (60-90s): creating first permit, signing as worker, running audit export
- Public `/changelog`

## 4.7 Monitoring dashboard (internal, private)

Single HTML page hosted internally:
- Total orgs, users, documents today
- Error rate (Sentry API)
- Uptime (Uptimerobot API)
- Stripe MRR
- Support tickets open

Takes one day. Cloudflare Worker + D1 count + Stripe API + Sentry API.

## 4.8 Stripe integration (finish properly)

### Hosted Checkout flow

1. Free user hits gated feature → modal "Upgrade to Solo"
2. Click → Worker creates Stripe Checkout Session → redirect
3. Stripe handles payment → redirect to `/billing/success?session_id=...`
4. Webhook `checkout.session.completed` → update `organisations.plan`, `stripe_subscription_id`
5. Webhook `customer.subscription.updated` → plan changes
6. Webhook `customer.subscription.deleted` → downgrade to Free (data preserved, features locked)

### Customer Portal

`/billing` → "Manage billing" → Stripe Customer Portal (hosted). Zero code from us.

### Required webhooks

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed` — email admin, 7-day grace before downgrade

## 4.9 Public marketing pages

Landing exists. Add:
- `/features` — anchored sections per feature
- `/pricing` — clear tier comparison, worker-accounts-free CTA
- `/security` — posture summary (feeds Phase 2)
- `/compare/joblogic` — honest: safety-first vs field-service-first
- `/compare/handshq` — honest: broader feature set, worker-free
- `/changelog` — public product updates
- `/docs` — help articles (markdown-to-HTML static)
- `/about` — paragraph + Patryk photo + bio

## 4.10 Demo data

On signup: "Start with demo data (clear anytime) / Start empty". Demo = 3 sites, 5 permits various states, 2 incidents, training matrix 10 workers, 20 register entries. Lets users *see* product working before real data.

### Phase 4 acceptance

- [ ] Lighthouse mobile ≥ 90 all main pages
- [ ] axe: zero critical violations
- [ ] First-load JS bundle < 200KB gzipped
- [ ] All list views: proper empty/loading/error states
- [ ] Stripe Checkout + webhook verified end-to-end
- [ ] Demo data seeder works
- [ ] Onboarding no dead-ends

---

# Global rules Cursor must follow

1. **Don't break the prototype.** Every commit leaves the app usable. Feature flag where needed: `if (FEATURES.USE_API) { ... } else { ...localStorage path... }`.
2. **No UI changes unless explicitly asked.** Upgrading backend, not redesigning.
3. **No new dependencies without reason.** Approved: Hono, itty-router, jose, bcryptjs, zod, @oslojs/otp, browser-image-compression, jspdf. Anything else — justify.
4. **Wrangler secrets only.** No `.env` committed. Required: `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `ENCRYPTION_KEY`.
5. **Stripe Secret never client-side.** Workers endpoints only. Hosted Checkout, not Elements.
6. **Worker accounts always free.** No billing gate on worker role anywhere.
7. **Tests:** each Worker route ≥ 1 integration test (Miniflare). Priority: auth, multi-tenancy isolation, audit chain verify, LOTO workflow, rate limiting.
8. **Commits small and reviewable.** `feat(api):`, `fix(login):`, `chore(audit):`.
9. **Every phase ends with a working demo.** 5-min Loom per phase before moving on.
10. **Document as you go.** New routes → `/docs/api.md`. New tables → `/docs/schema.md`. New env vars → `/docs/deployment.md`.

---

# Definition of done for the whole sprint

- [ ] Phase 1 passes acceptance (foundation solid)
- [ ] Phase 2 passes acceptance (enterprise-ready)
- [ ] Phase 3 passes acceptance (FESS's sites properly covered)
- [ ] Phase 4 passes acceptance (no longer a beta)
- [ ] `securityheaders.com` → A+
- [ ] `ssllabs.com` → A+
- [ ] `mail-tester.com` → 10/10
- [ ] Lighthouse mobile ≥ 90
- [ ] axe zero critical
- [ ] FESS admin can: sign up → invite 5 users → enrol MFA → create RAMS → issue LOTO → issue Hot Work (food) with QC sign-off → export audit log — all from a phone
- [ ] Patryk has sent mail to Jack confirming Route A + pilot start

**When this is done: we start the 90-day FESS pilot AND begin outbound sales to other UK food/construction contractors.**
