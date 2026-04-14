# MySafeOps — Permits WOW & related roadmap

Status: active  
Execution mode: sequential where noted; RAMS library grows by additive PRs.

---

## A. Permits — delivered (Steps 1–10)

| Step | Topic | Summary |
|------|--------|---------|
| 1 | SLA urgency badges | Review / approved-not-active queues with on track · due soon · overdue. |
| 2 | Reminders & escalation | 60/30/15 min + overdue; issuer/reviewer escalation; audit log. |
| 3 | Read/sign link | Contractor portal, ack with identity + timestamp. |
| 4 | SIMOPS radar | Location/time overlap, severity, links to cards. |
| 5 | Scorecard | KPIs, trends, delay reasons, filters. |
| 6 | Site pack v2 | RAMS + permit + competency + emergency; QR; handover preset. |
| 7 | UK compliance profile | Per-org, per-type overrides; legal checklist + evidence fields; reset to UK baseline. |
| 8 | Legal refs in PDF | Compliance references on printed permit. |
| 9 | Evidence pack | Validator; JSON + **CSV** export (UTF-8 BOM). |
| 10 | Post-close PDF | Optional **lessons learned** on close; closure block + watermark CLOSED. |

Supporting: **Recycle bin** (7-day restore) for deletes across modules.

---

## B. Permits — implemented (this iteration)

### Step 11 — Role-based workflow gates (in progress → baseline done)

- **`evaluatePermitActionGate`** (`permitAdvancedEngine.js`):
  - **Approve** (list/board): requires **issuer** signature.
  - **Activate** / Approve & activate: **all required signatures** for the permit type + **`legalReady`** from `evaluatePermitCompliance` (same checklist-driven compliance as the wizard).
- **Bulk approve / bulk activate** run the same checks before applying status changes.
- Blocked actions show a clear **alert** with the reason (signatures vs compliance).
- Card + wizard now surface **Who acts next** guidance so teams know which role should unblock approval/activation.

### Step 12 — Issue snapshot & drift (baseline done)

- On **first activation**, store **`issueSnapshot`** (location, description prefix, times, checklist keys).
- **`diffPermitVsIssueSnapshot`** detects drift vs current permit.
- **Permit card** shows an orange banner: **Changed since activation:** `location`, `description`, … when drift exists.

Future optional: diff UI in editor, Supabase mirror of snapshot, stricter “re-validate before work” rule.

### Step 17 — Permit conflict matrix v2 (baseline done)

- Added rule matrix by permit type pair with outcomes: `allow`, `warn`, `block`.
- Activation gates now enforce matrix outcomes in single and bulk flows:
  - `block` stops activation with conflicting permit references.
  - `warn` requires override reason + approver before activation.
- Conflict override is captured in local/cloud audit as `conflict_warn_override`.
- Permit UI now surfaces conflict status and next-action guidance.
- Org-level matrix overrides supported (JSON editor) with baseline reset.

Visual pass v5 (started now):
- ✅ Decision banner 2.0 on permit card (`Ready / Blocked / Next action`) with direct CTA.
- ✅ Mobile sticky quick-actions rail for selected permit.
- ✅ Card density modes: `comfort`, `compact`, `ops`.
- ✅ Lightweight filter-change skeleton loading and smoother visual transitions.
- ✅ Permit UI token pack + org theme mode (`auto/light/dark`) for stronger visual consistency.
- ✅ In-app reminder layer (Ops Inbox + Command strip): `briefing pending` and `active without RAMS` counters, quick filters, and one-click **Confirm briefing** action.
- ✅ Push notifications MVP (local + SW-ready): permission flow, settings toggles, auto scheduler on app start, and permit reminders (`expiry`, `briefing pending`, `RAMS missing`).
- ✅ Cloud push foundation: Supabase push-subscription sync (`org_push_subscriptions`), Edge push dispatcher (`send-permit-web-push`), and web-push trigger from permit notification flow.

### Permits — next wave candidates

- **Step 13 — Shift handover continuity**
  - Handover checklist on live permits (`what changed`, `what remains high-risk`, `critical controls confirmed`).
  - Outgoing and incoming supervisor acknowledgement with timestamp.
  - Auto-flag permits not handed over before shift boundary.
- **Step 14 — Dynamic risk re-score**
  - Recompute risk score when key fields drift (location, scope, weather, SIMOPS overlap severity).
  - Trigger “review required” state when score crosses configurable threshold.
  - Keep pre/post score history in audit log for defensible decisions.
- **Step 15 — Control effectiveness checks**
  - Mid-task control checks (spot verification prompts by role and frequency).
  - Quick “effective / partially effective / ineffective” capture with mandatory note for failures.
  - Auto-create linked CAPA action when controls are marked ineffective.
- **Step 16 — Isolations / LOTOTO lock register**
  - Permit-linked isolation points with lock/tag IDs, owner, applied/removed timestamps.
  - Prevent close-out until all mandatory isolations are safely removed/handed over.
  - Printable lock register page in site pack / close pack.
- **Step 17 — Permit conflict matrix v2**
  - Rule matrix by permit type pair (e.g., hot works + confined space) with block/warn outcomes.
  - Optional “override with reason + approver” for warn-only conflicts.
  - Dashboard widget for top recurring conflict pairs by project.

### Permits — suggested delivery order (impact/effort)

| Order | Step | Impact | Effort | Why now |
|------|------|--------|--------|---------|
| 1 | 17 — Permit conflict matrix v2 | High | M | Immediate risk reduction for incompatible simultaneous activities. |
| 2 | 13 — Shift handover continuity | High | M | Prevents loss of situational awareness at shift boundaries. |
| 3 | 15 — Control effectiveness checks | High | M | Creates a closed-loop link between permit controls and CAPA actions. |
| 4 | 14 — Dynamic risk re-score | Medium-High | M/L | Makes drift visible and forces timely re-review when risk increases. |
| 5 | 16 — Isolations / LOTOTO lock register | High | L | Critical control, but broader data model + workflow impact. |

Definition:
- **Impact**: expected reduction in operational / safety risk and compliance exposure.
- **Effort**: estimated implementation complexity across UI, rules engine, data model, and tests.

### Permits — implementation-ready scope (MVP + acceptance + tests)

#### Step 13 — Shift handover continuity

Status update:
- ✅ Started now (MVP): active-permit handover capture with dual supervisor acknowledgement, handover-due flagging, and audit events.
- ✅ Added: org-level configurable shift boundary hours (used by handover-due detection).
- ✅ Added: quick filtering for `handover due` permits (command strip + filters).
- ✅ Added: hard activation gate (`handover_required`) when shift boundary is crossed without completed handover.
- ✅ Added: `blocked now` KPI + quick filter for permits blocked by approve/activate gates.

**MVP scope**
- Add handover block on active permit with three required prompts: `what changed`, `remaining high risk`, `critical controls confirmed`.
- Require two acknowledgements: outgoing supervisor and incoming supervisor (name/role/timestamp).
- Add shift-boundary checker that flags permits with missing handover in list/card view.

**Acceptance criteria**
- Active permit crossing configured shift boundary without both acknowledgements is flagged as `handover_missing`.
- Permit with completed handover shows latest handover record (who/when/summary) in card and detail view.
- Audit log stores handover submission and both acknowledgements as separate immutable events.

**Test plan**
- Unit: validator requires all three prompt fields and both acknowledgements.
- Unit: shift-boundary rule sets/clears `handover_missing` correctly by time window.
- Integration: completing handover updates permit state + timeline + audit entries.
- UAT: supervisor A hands over to supervisor B on live permit and flag clears in UI.

#### Step 14 — Dynamic risk re-score

**MVP scope**
- Re-score permit when monitored fields change: location, scope text, weather marker, SIMOPS severity.
- If risk delta crosses threshold, set status marker `review_required` and block activate/re-activate until review.
- Store before/after score, trigger reason, and reviewer decision in audit trail.

**Acceptance criteria**
- Any monitored drift recalculates risk score once and writes one deterministic audit event.
- Threshold crossing always sets `review_required`; below-threshold changes do not set it.
- Reviewed permit can proceed only after explicit reviewer action (`accept` or `amend then accept`).

**Test plan**
- Unit: scoring function returns expected score for fixed fixtures.
- Unit: threshold logic toggles `review_required` exactly at boundary conditions.
- Integration: edit monitored field -> re-score event -> gate blocks activation until review.
- UAT: user changes scope to high-risk wording and sees forced review flow.

#### Step 15 — Control effectiveness checks

**MVP scope**
- Add scheduled spot-check prompts on active permits (frequency by permit type or fixed default).
- Capture control outcome per check: `effective`, `partially_effective`, `ineffective`; note mandatory for non-effective outcomes.
- Auto-create linked CAPA action for `ineffective` checks with owner/due date defaults.

**Acceptance criteria**
- Spot-check is due and visible according to configured frequency while permit is active.
- Submitting `partially_effective` or `ineffective` without note is rejected.
- `ineffective` submission creates CAPA linked to permit/check and appears in Incident Action Tracker.

**Test plan**
- Unit: schedule generator computes due checks for active interval.
- Unit: outcome validator enforces note requirement for non-effective outcomes.
- Integration: ineffective check creates CAPA row with correct linkage metadata.
- UAT: perform ineffective check on mobile/desktop and verify CAPA appears in tracker.

#### Step 16 — Isolations / LOTOTO lock register

**MVP scope**
- Add permit-linked isolation register: isolation point, lock/tag ID, owner, apply/remove timestamps, status.
- Require mandatory isolation points by permit template/type before activation.
- Block close-out when unresolved isolations remain; provide clear blocker message with unresolved items.

**Acceptance criteria**
- Activation fails when mandatory isolations are missing or incomplete.
- Close fails while any isolation has no valid remove/transfer state.
- Printable lock register section is included in site pack and close pack outputs.

**Test plan**
- Unit: activation gate validates mandatory isolation completeness.
- Unit: close gate rejects unresolved isolation states.
- Integration: apply/remove lifecycle transitions update status and audit events.
- Integration: PDF/site pack renderer includes isolation register entries.
- UAT: full LOTOTO cycle from issue to close-out with handover/removal.

#### Step 17 — Permit conflict matrix v2

**MVP scope**
- Introduce conflict matrix config by permit-type pair with outcomes: `allow`, `warn`, `block`.
- Evaluate matrix on create/edit/activate against overlapping live permits (location + time window).
- For `warn`, allow override with mandatory reason and approver identity; log override event.

**Acceptance criteria**
- `block` conflicts prevent activation and list conflicting permit references.
- `warn` conflicts require override reason + approver and then allow controlled continuation.
- Conflict evaluation uses deterministic pair matching independent of permit order.

**Test plan**
- Unit: pair-normalization resolves `A+B` same as `B+A`.
- Unit: matrix evaluator returns allow/warn/block for configured fixtures.
- Integration: overlapping blocked pair prevents activation in UI and bulk actions.
- Integration: warn override stores reason/approver and appears in audit log.
- UAT: hot works + confined space overlap shows expected block/warn behavior per config.

---

## C. RAMS — library architecture (reference)

| Layer | File | Role |
|--------|------|------|
| Base | `src/modules/rams/ramsHazardLibrary.js` | Core hazards + `TRADE_CATEGORIES` (legacy FESS-derived). |
| Extended | `src/modules/rams/ramsHazardLibraryExtended.js` | Extra categories (incl. **Traffic Management (TMP)**), demolition/PV additions. |
| Pro | `src/modules/rams/ramsHazardLibraryPro.js` | Additional pro tier entries. |
| Merge | `src/modules/rams/ramsAllHazards.js` | `[...BASE, ...EXT, ...PRO]` + search helpers. |

**How to add hazards:** append objects with the same shape (`id`, `category`, `activity`, `hazard`, risks, `controlMeasures`, `ppeRequired`, `regs`). Add new category strings to the relevant `*_CATEGORIES` export.

**Print sections:** `ramsSectionConfig.js` — optional future blocks (e.g. environmental, client rules) require updates here + `ramsPrintHtml.js` + builder toggles.

**AI RAMS:** `src/modules/AIRamsGenerator.jsx` — JSON shape for hazards; can be aligned to pick from library IDs later.

**Templates:** `DocumentTemplates.jsx` + `rams_builder_docs` — org-level reusable RAMS payloads.

### RAMS — backlog (ideas)

- More packs: rail possessions, asbestos removal (licensed), temporary works, marine.
- Org **starter packs** (industry preset + hazards).
- PL locale file mirroring merged libraries.
- Stronger print sections: emergency escalation, waste/environment.

### RAMS — expansion packs (next)

- **Pack 1 (High impact):** temporary works advanced, facade/glazing, high-risk MEP commissioning.
- **Pack 2 (Sector):** rail/highway traffic management, marine/water proximity, demolition variants.
- **Pack 3 (Emerging):** battery/EV lithium risk, contaminated land/remediation, advanced confined-space profiles.
- Add per-hazard tags (`environment`, `public_interface`, `night_work`, `licensed_activity`) for faster filtering.
- Add hazard versioning + changelog metadata to support legal/audit traceability.

Started now (library entries added in `ramsHazardLibraryExtended.js`):
- ✅ Temporary Works Advanced (`twx_*`)
- ✅ Facade & Glazing (`fcd_*`)
- ✅ Contaminated Land & Remediation (`clr_*`)
- ✅ Marine & Water Proximity (`mar_*`)
- ✅ Battery & Energy Storage (`bes_*`)

### RAMS — customization roadmap

- Org starter packs by industry (construction, pharma, utilities, rail, logistics).
- Project-level RAMS profile overrides (site rules, client controls, mandatory sections).
- Regional legal overlays (UK baseline + optional EU/PL profiles).
- Library governance workflow: draft → review → approved hazards with content owner sign-off.

---

## D. Cross-cutting backlog

- Notifications: real Slack/Teams delivery (beyond stubs).
- Permits: version diff between issue snapshot and current (visual).
- Geofence / gate QR (site pack narrative).
- Benchmarks across projects (org-only).

### D2. Customization backlog (platform)

- ✅ Started now (MVP): No-code permit field settings editor (required/optional, helper text, placeholder, max length) in `PermitSystem` UI without JSON.
- No-code permit type builder (fields, signatures, checklist, SLA defaults).
- ✅ Started now (MVP): org-level permit type appearance overrides (label/color/description) with reset controls in `PermitSystem`.
- Workflow designer by org (state transitions, gate logic, role permissions).
- ✅ Started now (MVP): org-level workflow transition overrides (JSON policy) enforced in single and bulk permit actions.
- ✅ Started now (MVP): workflow role permissions per target state (admin/supervisor/operative policy overrides).
- ✅ Started now (MVP): permit dependency rules (e.g. `confined_space` requires active `loto`) with activation gate enforcement.
- ✅ Added: wizard-style editors for workflow transitions, role policy, and dependency rules (JSON kept as advanced mode).
- ✅ Started now (MVP): Conditional Rules Builder v1 (no-code IF/THEN by permit type/status/project -> required/show/hide/block).
- PDF branding/profile editor (logo, footer, legal block, language, section order).
- Role-specific dashboard presets (issuer/reviewer/manager action-focused layouts).
- Per-project view presets and mandatory evidence profiles.

---

## E. New module initiative — Incident & CAPA

### Module: Incident Action Tracker (MVP started)

- New module id: `incident-actions` (in More → Health, safety & environment).
- Goal: close the loop after incident / near miss:
  - owner + due date + priority,
  - status lifecycle (`open`, `in_progress`, `blocked`, `closed`),
  - verification note for closure evidence.
- Links actions to existing incidents (`mysafeops_incidents`) so actions can reference the root event.
- Includes KPI cards (open, due in 7d, overdue, closed), filtering, search, and CSV export.
- Incident module upgrade: quick report with checkbox tags, photo capture, GPS capture, and auto-summary that can be expanded later via full edit form.
- New module added: **Incident Map & Hotspots** (`incident-map`) with GPS points, filters, and hotspot grouping.

Next increments:
- ✅ One-click action creation from incident record (`incident-actions` link via `sourceId`).
- ✅ Near-miss → incident escalation in incident register.
- ✅ CAPA reminder strip for overdue / due-soon actions.
- ✅ Incident-actions delete now moves rows to Recycle Bin.
- ✅ Incident map timeline filter (`all`, `7d`, `30d`).
- ✅ Owner-level escalation digest in Incident Action Tracker.
- ✅ Incident map project boundary overlays (when project boundary data exists).
- ✅ Hotspot auto-actions (create CAPA directly from hotspot row).
- ✅ Pull-through action suggestions from permits / inspections (failed/quarantine inspections + suspended/expired permits).
- ✅ Recycle-bin restore works for incident-actions via existing Recycle Bin module.
- ✅ Project-level escalation digest (group by owner + project context).
- ✅ Hotspot CAPA template selector (different defaults by hotspot pattern).

Next wave:
- Incident map playback scrubber (day-by-day animation).
- CAPA SLA per priority with auto due-date defaults.
- Client-facing incident transparency page (read-only evidence timeline).

---

## F. Tests

Vitest covers compliance, evidence pack, document HTML, **permit advanced engine** (gates + snapshot drift), SIMOPS, audit log, etc. Run: `npm test`.

---

## G. Mobile QA checklist (permits)

- Card headers, chips, and action strips wrap correctly on narrow widths (`<= 380px`) with no overlap.
- Permit card action buttons remain tappable (no clipped text, no horizontal scroll).
- Bulk action bar:
  - `<= 380px`: one-column button stack,
  - phone widths: two-column layout,
  - no content hidden behind sticky bars.
- Conflict override and close-permit modals are fully scrollable on small screens (`maxHeight` + `overflowY`).
- Long values (location, issued to, notes) break safely without pushing layout out of viewport.

### Mobile test matrix (manual)

**Viewport 360x800 (small Android)**
- Open permits list with at least 8 cards and long location/description values.
- Select multiple permits and verify bulk bar uses one-column action stack.
- Confirm each bulk action button text is readable and fully tappable.
- Open conflict override modal and close-permit modal; scroll to bottom and submit/cancel.

**Viewport 390x844 (iPhone baseline)**
- Verify card action area uses two-column layout without overlap.
- Trigger `warn` conflict activation and confirm override modal fields remain visible with keyboard open.
- Check action strip (`Action needed now`) wraps cleanly for long gate messages.

**Viewport 768x1024 (tablet portrait)**
- Verify sticky bulk bar behavior does not cover content while scrolling.
- Confirm cards, chips, and workflow rail keep alignment in list, board, and timeline views.
- Verify no horizontal scrolling appears in main permits screen.

---

## H. Permits customization expansion (company-first)

Goal: make permits editable by non-technical teams, with reusable company standards and consistent visual quality.

### H1. Quick wins (high impact, low effort)

- **Org text library**:
  - saved snippets for `description`, `conditions`, `evidence notes`, `handover notes`,
  - tags per snippet (`hot works`, `loto`, `night shift`) and one-click insert.
- **Company defaults per permit type**:
  - default issuer, default receiver role, default checklist state,
  - default validity window (e.g. 8h, 12h), default reminder offsets.
- **Preset bundles** (one-click apply):
  - “Weekend hot works”, “Night LOTO”, “Confined space – rescue team on standby”.
- **Optional/required toggles by org policy**:
  - signatures required now vs later,
  - mandatory fields by type (with hard/soft mode).
- **Saved view packs by role**:
  - issuer/reviewer/supervisor “home screens” with pinned filters and cards.

### H2. Mid-level customization (builder UX)

- **No-code section builder for permit form**:
  - add/remove/reorder sections and fields from UI,
  - field types: text, select, checkbox, date-time, person, attachment.
- **Conditional logic builder**:
  - “if `confined space` + `gas test fail` -> require rescue plan + supervisor signature”.
- **Validation rule builder**:
  - min/max, regex, required-if, cross-field checks.
- **Reusable company checklists**:
  - global libraries with versions, archive/restore, and “apply to all projects”.
- **Permit-type cloning**:
  - duplicate a configured type and adjust only deltas.

### H3. Workforce + signature experience

- **Worker profile autopopulation**:
  - selecting person auto-fills role, employer, cert highlights.
- **Competency-aware suggestions**:
  - recommend eligible workers first; show “why blocked” for ineligible choices.
- **Signature UX v2**:
  - quick sign + typed sign + optional drawn signature pad,
  - signature stamps with role + timestamp + device info.
- **Signature policy matrix**:
  - required signatures by status (`review`, `activate`, `close`) and by permit type.
- **Delegation mode**:
  - temporary substitute signer with reason and expiry window.

### H4. Reuse and standardization at company scale

- **Company standards pack**:
  - legal references, emergency text, permit footer, escalation contacts.
- **Project overrides on top of org baseline**:
  - project-level deltas without duplicating full templates.
- **Versioning + rollout controls**:
  - draft/published template versions, effective date, rollback.
- **Import/export standards**:
  - JSON/CSV package for moving setups across orgs/projects.
- **Approval workflow for template changes**:
  - maker-checker before policy goes live.

### H5. Visual quality and usability polish

- **Form density and label modes**:
  - compact / standard / training mode with helper text.
- **Inline “why blocked” chips**:
  - each blocker shows exact fix action and jump link.
- **Live side-by-side preview editor**:
  - edit text blocks and section order with immediate PDF/print preview.
- **Smart empty states and onboarding**:
  - first-time guided setup (“create your first company preset”).
- **Accessibility polish**:
  - larger targets, keyboard-first tab order, explicit aria labels, contrast-safe tones.

### H6. Knowledge capture (learn from repeated usage)

- **Auto-suggest from history**:
  - suggest common phrases by permit type + project + user role.
- **“Save this as company standard” prompt**:
  - appears when same text is reused multiple times.
- **Most-used controls dashboard**:
  - discover which snippets/checklists are used vs ignored.
- **Template quality score**:
  - highlights noisy/unused fields and missing standards.
- **Continuous improvement log**:
  - track template changes and outcome metrics (rework, delays, blocked activations).

### Suggested delivery order

1. Org text library + company defaults + optional/required toggles.
2. Preset bundles + role view packs + worker competency suggestions.
3. No-code section builder + conditional logic + validation builder.
4. Signature UX v2 + signature policy matrix + delegation mode.
5. Versioned standards pack + project overrides + approval workflow.
