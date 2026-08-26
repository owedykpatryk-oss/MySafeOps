# MySafeOps — Product Analysis

> Everything below is verified against the codebase. Where I could not verify a claim, I have said so.
> **Do not add numbers, customer names or outcomes that are not in this file.**

---

## Best marketing angle

**"The survey that finds the cable and the permit that lets you dig it are the same record."**

MySafeOps is the only product I can find evidence of that carries a **PAS 128 utility survey**, a **GPR report**, and a **permit to dig** inside one workspace, with a literal survey-to-dig handover path (`git: "Add management working diary and survey-to-dig handover"`, `surveyHandoverPack.js`, `permitDigGuidance.js`).

Everyone else sells one half. Safety apps stop at the permit. Survey software stops at the DXF. The gap between them — where a surveyor's finding has to be re-typed into a permit by someone who wasn't on site — is where services get struck.

That gap is the story. It is specific, it is real, and no competitor can copy it quickly because it needs both domains built out.

**Second angle, nearly as strong:** the **permit conflict matrix** (`permitConflictMatrix.js`). The app will *block* a hot work permit being active at the same location as a confined space entry. Most SME safety tools are digital filing cabinets — they store permits. This one refuses to issue one. That is a demonstrable, screenshot-able difference.

---

## Strongest product feature

**The permit engine.** Not because permits are exciting, but because the depth is provable and unusual:

| Capability | Evidence |
|---|---|
| Conflict matrix with block/warn outcomes | `permitConflictMatrix.js` — hot work + confined space = **block**; hot work + line break = **block**; hot work + LOTO = warn; lifting + work at height = warn; excavation + ground disturbance = warn |
| SIMOPS (simultaneous operations) | `permitSimops.js` |
| Conditional + dependency rules | `permitConditionalRules.js`, `permitDependencyRules.js` |
| Activation readiness gates | `permitActivationReadiness.js`, `permitActivationGaps.js`, `permitQualityGates.js` |
| Evidence pack export | `permitEvidencePack.js` |
| Immutable audit trail | `permitAuditLog.js` |
| Dig guidance tied to excavation | `permitDigGuidance.js` |

**20+ permit types** in `permitTypes.js`, including several nobody else bothers with:

- Rail corridor access — possession reference, **PTS numbers**, **COSS / lookout name**
- Marine / hydrographic works — vessel name, **coxswain / master**, approved **tide window**
- Aerial survey — UAV type, **CAA operator ID**, **NOTAM / airspace clearance ref**
- Radiography, line break, valve isolation, line clearance / product isolation

Those niche types are marketing gold. A rail contractor who sees "COSS / lookout name" as a native field knows immediately this was built by someone who has actually stood on a possession.

---

## Biggest customer pain point

**The same information gets typed three times by three people, and the version that matters is the wrong one.**

Concretely, from what the modules are built to replace:

1. A surveyor finds a service and records it. It ends up in a PDF.
2. Someone in the office re-keys it into a RAMS.
3. A supervisor re-keys it again onto a paper permit in a folder in a van.
4. The client asks for evidence and nobody can produce the chain.

Supporting pain the code clearly targets:
- **Records that expire silently** — `TrainingMatrix.jsx`, `InspectionTracker.jsx`, `LadderInspection.jsx`, `ElectricalPATLog.jsx`
- **No signal on site** — full offline PWA (`public/service-worker.js`, `SW_VERSION = mysafeops-v1.4.0`, `offline.html`)
- **Nothing is auditable** — `AuditLogViewer.jsx`, `pushAudit()` called throughout, `RecycleBin.jsx` with soft-delete tombstones
- **Client asks, you scramble** — token client portal (`?portal=TOKEN`) and subcontractor portal (`?subcontractor=TOKEN`)

---

## Most likely buyer

Ranked by how well the product actually fits them:

**1. Owner / director of a 5–50 person specialist contractor (UK).**
Signs off the £99–£249/mo themselves, feels the compliance risk personally, has no full-time H&S manager. The 14-day trial and self-serve Stripe checkout are built for exactly this buyer.

**2. Utility survey / GPR company owner.**
PAS 128 reporting, GPR deliverables and CAD export are their *product*, not their admin. This is the buyer for whom MySafeOps replaces a revenue-generating workflow, not just overhead — which makes it the highest-value and stickiest segment.

**3. Contracts / operations manager at a food or pharma M&E contractor.**
The hygiene module set (allergen changeover, CIP sign-off, GMP deviations, glass & hard plastic register, high care access) is not in generic construction apps. If they work in food factories, nothing else on the market speaks their language.

**4. H&S manager at a principal contractor.**
Cares about CDM, F10, RIDDOR, subcontractor competency. Real buyer, but the most crowded segment competitively.

Pricing (verified, `scripts/stripe-seed-prices.mjs`): **Solo £19 · Team £99 · Business £249 · Enterprise £499** per month GBP, with AUD and PLN price tiers alongside — this is an independently built product priced for SMEs, not enterprise.

---

## Best LinkedIn strategy

**Build in public, from the trade floor, with the permit engine as proof of depth.**

LinkedIn is where this product's buyers actually are — UK contractors, survey company owners, H&S managers. Instagram is not.

The strategy in one line: **post the problem, not the product.** Every post should be useful to somebody who never buys — a permit conflict they hadn't considered, why PAS 128 quality levels get misread, what a competency matrix should flag. The product appears as "so I built this", never as a pitch.

Cadence: **2–3 posts per week.** Mix:
- 40% problem/education (widest reach, most comments)
- 30% build in public (follower growth, credibility)
- 20% product demonstration (leads)
- 10% industry opinion (shares)

The single highest-ceiling post available: **the conflict matrix**. "Our software refuses to issue this permit" is a genuinely contrarian claim in a market that sells storage.

## Best Instagram strategy

**Visual proof, not captions.** Instagram cannot carry this product's complexity in text — but it can carry:
- Screen recordings of the app blocking something
- Before/after: paper permit in a van vs. tablet on site
- Real site photography with a single overlaid line of text

Reels over static. Static carousels for anything that needs 3+ steps explained.

**Honest assessment: Instagram is the weaker channel for this buyer.** Treat it as brand surface and recruitment/credibility, not lead generation. Repurpose from LinkedIn rather than writing Instagram-first. Do not invest equal effort.

---

## What the product actually does

A **UK-oriented construction safety, compliance and site-survey workspace**. React + Vite SPA, offline-capable PWA, multi-tenant with organisation isolation.

**80 feature modules** under `src/modules/`, grouped:

**Permits & method** — permit to work (20+ types, conflict matrix, SIMOPS), RAMS template builder with multiple hazard libraries, method statements, dynamic risk assessment register

**Site operations** — projects, people, site presence map, daily briefing, QR induction, digital signatures, timesheets, gate book, visitor log, snags, welfare checks

**Registers** — COSHH, asbestos, PPE, plant & equipment, vehicle fleet, scaffold, excavation, temporary works, LOTO, confined space, hot work, lifting plans, DSEAR, noise & vibration, ladders, MEWP, PAT, first aid, fire, waste, environmental, legislation

**Food & pharma hygiene** — allergen changeover, CIP sign-off, GMP deviations, glass & hard plastic register, high care access, water hygiene

**Incidents** — near miss, incident action tracker, incident hotspot map, RIDDOR wizard, safety observations

**Survey & geospatial** — PAS 128 survey reports, GPR reports, geo-photos, project drawing editor with geo-referenced map layers

**AI (Anthropic Claude)** — RAMS generator, toolbox talk generator, photo hazard analysis (vision). *Note: routes exist but are hidden from the More menu pending prebuilt packs (`workspaceViews.js` comment). Treat as "in development" in build-in-public content, not as a shipped headline feature.*

**Reporting & governance** — monthly report, management overview, analytics dashboard, audit log viewer, recycle bin, backup/export, client portal, subcontractor portal, document library & templates

---

## Unusual vs competitors — highlight these

These are the things I would lead with, in order:

**1. Survey and safety in one system.** PAS 128 survey reports + GPR reports + permit to dig. `surveyGprBridge.js` turns GPR findings into PAS 128 anomaly cards. `surveyRamsSync.js` syncs survey data into RAMS. Genuinely nobody else does this.

**2. A permit system that blocks.** Conflict matrix, SIMOPS, activation readiness gates, quality gates. Competitors store permits; this one refuses to issue unsafe combinations.

**3. Geo-photos that produce CAD.** `geoPhotoExport.js` exports **KML, KMZ, DXF, GPX, GeoJSON and a CAD bundle**, with coordinates converted to **British National Grid (OSGB36)** via Helmert transformation. It records **camera bearing** and **ground coverage area**, reads **GPS from EXIF**, and **warns on coarse fixes** (`isCoarseGpsAccuracy`). A site photo becomes a survey deliverable.

**4. 18 geo-photo types with their own question sets.** trial pit, borehole cap, piezometer install, window sampling, hand auger point, DCP probe, manhole/chamber, utility locator, buried services warning, traffic management, sample custody, site entrance, orientation wide shot, before/after, hazard, general site condition. A recent commit reads *"Stop asking a survey control mark which buried service it is"* — that level of domain detail is a moat.

**5. Food & pharma hygiene modules.** Allergen changeover, CIP sign-off, GMP deviations, glass & hard plastic register. Not present in generic construction safety apps.

**6. Client handover ZIP.** `surveyHandoverPack.js` builds a pack containing PDF, HTML, CSV schedules, CAD sidecar, verify sheet and README — plus an A3 board pack and a QR-linked client pack.

**7. Offline-first.** Full service worker precache with an offline fallback page. Built for rural sites and basements.

---

## Honest weaknesses — do not oversell

State these internally so nobody writes a post that gets called out:

- **AI features are gated off.** `workspaceViews.js` says AI generators are *"hidden from More nav until prebuilt packs ship"*. Do not headline AI as shipped. It is legitimate **build-in-public** material ("here's what I'm working on"), not a feature announcement.
- **The Anthropic key warning.** README states `VITE_ANTHROPIC_*` keys are visible in the browser bundle and should be proxied in production. Fine engineering hygiene, but do not make security claims about AI without checking the deployed config.
- **British National Grid accuracy is ±5 m.** The code comment is explicit: Helmert transformation, *"not a substitute for OSTN15 on precision work"*. **Never claim survey-grade accuracy for geo-photo exports.** Say "locating field evidence", which is what the code says it is for.
- **No verified customers or metrics.** There are references to a group provisioning script and org-specific packs, which suggest at least one real deployment. **Do not name any customer, and do not publish case-study numbers, time savings or ROI figures until someone gives you real ones.** Every time-saving claim in the content files is framed as a question or a personal observation, never as a statistic.
- **Product breadth is a risk as well as a strength.** 80 modules can read as unfocused. Content should always enter through *one* specific problem, never through the module list.
- **Two very different audiences.** Construction/food H&S and utility survey barely overlap. This is a real strategic question — see `TARGET_AUDIENCE.md`.

---

## Recent additions worth announcing

From git history, genuinely postable as "just shipped":

- Measure the ground a geo-photo covers, and ask each trade its own questions
- Read GPS from photo metadata and warn on coarse fixes
- Export geo-photos in British National Grid with survey provenance
- Show which way the camera faced, and stop duplicate geo-photos
- Chase the actions raised on site
- Fill the report's utility and GI schedules from field answers
- Survey-to-dig handover, and a management working diary
- Track created-by and last-edited-by on documents
- Harden Utility Mapping tablet UX across iPad and Android tabs

The commit messages themselves are written in plain trade English. That voice is the right voice for the social content — copy it.
