# MySafeOps — Cursor AI Development Prompt

## Project overview

You are working on **MySafeOps** (mysafeops.com) — a UK construction site safety management platform (initially shaped around **FESS Food Engineering Services** source material). The app is a **Vite + React** SPA: **localStorage** is the primary persistence (org-scoped keys). There is **no mandatory server** for core use.

**Optional cloud (when configured):**

- **Supabase** — email (etc.) auth and JSON backup table `public.app_sync` ([README.md](../README.md), [architecture-current.md](./architecture-current.md)).
- **Cloudflare R2** — document uploads via a **Worker** (`cloudflare/workers/r2-upload`); browser uses `VITE_STORAGE_API_URL` + token, not R2 secret keys.
- **Anthropic** — AI modules (`VITE_ANTHROPIC_*`); keys in `VITE_*` are exposed in the bundle — dev-only or proxy via backend for production.

---

## Tech stack

- **React 19 + JSX** — no TypeScript
- **Vite** — dev server and production build (`npm run dev` / `npm run build`)
- **localStorage** — primary persistence, org-scoped keys (`${key}_${orgId}`)
- **@supabase/supabase-js** — optional auth + cloud backup
- **lucide-react** — icons in the app shell
- **Styling** — mostly inline styles; shared tokens in [src/utils/moduleStyles.js](../src/utils/moduleStyles.js) (`ms`); global mobile/base rules in [src/index.css](../src/index.css)
- **File System Access API** — optional folder picker in Document library (Chromium)
- **Service Worker** — [public/service-worker.js](../public/service-worker.js) (offline / notifications where implemented)

---

## Brand colours

```js
const TEAL    = "#0d9488";  // primary — buttons, headers
const ORANGE  = "#f97316";  // accent — CTAs, highlights
const NAVY    = "#0f172a";  // dark backgrounds
const TEAL_BG = "#E1F5EE";  // light teal surfaces
const ORANGE_BG = "#FAEEDA"; // light orange surfaces
```

Logo: teal shield (#0d9488) with orange checkmark (#f97316).

---

## Folder structure

```
E:\MySafeOps\
├── src\
│   ├── App.jsx                          ← view state + bottom nav + More grid (no react-router)
│   ├── main.jsx                         ← entry point, SW registration
│   │
│   ├── components\
│   │   ├── OrgSettings.jsx              ← logo upload, brand colours, PDF defaults
│   │   ├── AnalyticsDashboard.jsx       ← live metrics from all modules
│   │   ├── ClientPortal.jsx             ← read-only client links (+ public portal view)
│   │   ├── CloudAccount.jsx             ← Supabase sign-in when configured
│   │   ├── HelpAbout.jsx                ← in-app module index + disclaimer
│   │
│   ├── context\                         ← AppContext (roles/caps), SupabaseAuthContext
│   ├── lib\                             ← supabase client helper
│   ├── utils\                           ← auditLog, backupBundle, cloudSync, moduleStyles (ms)
│   │
│   ├── modules\
│   │   ├── permits\
│   │   │   └── PermitSystem.jsx         ← all 15 permit types + countdown timers
│   │   │
│   │   ├── rams\
│   │   │   ├── RAMSTemplateBuilder.jsx  ← 4-step wizard, hazard library
│   │   │   ├── ramsHazardLibrary.js     ← 30 base hazards (FESS source)
│   │   │   ├── ramsHazardLibraryExtended.js ← 35 hazards (12 new trade categories)
│   │   │   └── ramsHazardLibraryPro.js  ← 38 hazards (10 more categories)
│   │   │
│   │   ├── MethodStatement.jsx          ← 5-tab MS builder, print A4
│   │   ├── CDMCompliance.jsx            ← CDM 2015, CPP, F10 notification
│   │   ├── DailyBriefing.jsx            ← pre-work briefing with signatures
│   │   ├── QRInduction.jsx              ← QR site induction, sign-in register
│   │   ├── DigitalSignature.jsx         ← canvas signatures, GPS, audit trail
│   │   ├── Timesheet.jsx                ← weekly timesheets, payroll export
│   │   ├── SnagRegister.jsx             ← snagging with photos, status tracking
│   │   ├── COSHHRegister.jsx            ← substances, PPE, first aid, SDS
│   │   ├── InspectionTracker.jsx        ← inspections register
│   │   ├── IncidentNearMiss.jsx         ← incidents & near miss
│   │   ├── EmergencyContacts.jsx
│   │   ├── RIDDORWizard.jsx             ← RIDDOR F2508 with deadline alerts
│   │   ├── DocumentLibrary.jsx          ← local folder + optional R2 upload
│   │   ├── BackupExport.jsx             ← JSON backup + optional Supabase sync
│   │   ├── AuditLogViewer.jsx
│   │   ├── AIRamsGenerator, ToolboxTalkAI, PhotoHazardAI
│   │   ├── MonthlyReport, WasteRegister, DocumentTemplates
│   │   ├── SubcontractorPortal.jsx
│   │   ├── PPERegister, PlantEquipmentRegister, FireSafetyLog, TrainingMatrix, VisitorLog
│   │   ├── ToolboxTalkRegister, FirstAidRegister, LoneWorkingLog, EnvironmentalLog, SafetyObservations
│   │   ├── LadderInspection, MEWPLog, GateBook, AsbestosRegister, ConfinedSpaceLog
│   │   ├── LOTORegister, ElectricalPATLog, LiftingPlanRegister, DSEARLog, HotWorkRegister
│   │   ├── NoiseVibrationLog, ScaffoldRegister, ExcavationLog, TemporaryWorksRegister
│   │   ├── WelfareCheckLog, WaterHygieneLog
│   │   └── … (see src/modules/ and in-app Help)
│   │
│   └── offline\
│       ├── offlineManager.js            ← SW registration hooks
│       ├── OfflineStatusBanner.jsx      ← online/offline/update banner
│       ├── pushNotifications.js         ← local + push notifications
│       └── NotificationSettings.jsx     ← notification preferences panel
│
├── public\
│   └── service-worker.js                ← service worker asset
│
└── DOCS\                                ← E:\MySafeOps\DOCS
    └── [all FESS documents — PDFs, DOCX, etc.]
```

---

## Data model (localStorage keys)

All keys are org-scoped: `{key}_{orgId}`

```js
// Organisation
"mysafeops_org_settings"              // logo, colours, name, address, PDF defaults
"mysafeops_orgId"                     // current org ID

// Core data
"mysafeops_workers_{orgId}"           // worker profiles + certifications
"mysafeops_projects_{orgId}"          // projects list
"permits_v2_{orgId}"                  // all permits (15 types)
"rams_builder_docs_{orgId}"           // RAMS built with template builder
"method_statements_{orgId}"           // method statements
"mysafeops_incidents_{orgId}"         // incidents / near misses
"riddor_reports_{orgId}"              // RIDDOR records

// Modules
"mysafeops_timesheets_{orgId}"        // timesheet entries
"snags_{orgId}"                       // snagging register
"coshh_items_{orgId}"                 // COSHH substances
"cdm_packs_{orgId}"                   // CDM 2015 compliance packs
"daily_briefings_{orgId}"             // daily briefing records
"inspection_records_{orgId}"          // LOLER/PAT/PUWER inspections
"induction_sites_{orgId}"             // QR induction sites
"induction_entries_{orgId}"           // QR sign-in records
"signatures_{orgId}"                  // digital signatures
"sig_docs_{orgId}"                    // signature document list
"client_portals_{orgId}"              // client portal links

// Notifications
"mysafeops_notif_prefs"               // notification preferences
"mysafeops_notif_seen"                // notification cooldown tracking

// Document library
"mysafeops_doc_library"               // file tags, notes, project links

// Typical register modules (examples — each module uses its own base key + org suffix)
// e.g. ppe_register_{orgId}, plant_register_{orgId}, fire_safety_log_{orgId},
// noise_vibration_log_{orgId}, scaffold_register_{orgId}, …
// Inspect `load("…", [])` / `save("…", …)` in src/modules/*.jsx for exact keys.
```

---

## Component architecture

### Shared helpers (define in each file or extract to utils.js)

```js
const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const sk = (k) => `${k}_${getOrgId()}`;
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(sk(k)) || JSON.stringify(fb)); } catch { return fb; } };
const save = (k, v) => localStorage.setItem(sk(k), JSON.stringify(v));
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
```

### Org settings (used in PDF generation)

```js
import { getOrgSettings } from "./components/OrgSettings";
// Returns: { name, logo (base64), address, phone, email, primaryColor, accentColor, pdfFooter, pdfHeader, defaultLeadEngineer, customFields[] }
```

### Hazard library (RAMS module)

```js
import BASE from "./modules/rams/ramsHazardLibrary";
import EXT  from "./modules/rams/ramsHazardLibraryExtended";
import PRO  from "./modules/rams/ramsHazardLibraryPro";
export const ALL_HAZARDS = [...BASE, ...EXT, ...PRO]; // 103 hazards, 33 categories
```

Each hazard:
```js
{
  id: "elec_001",
  category: "Electrical",
  activity: "Use of hand tools and power tools",
  hazard: "Electric shock from faulty leads",
  initialRisk: { L: 4, S: 6, RF: 24 },
  controlMeasures: ["measure 1", "measure 2", ...],
  revisedRisk: { L: 2, S: 6, RF: 12 },
  ppeRequired: ["Hard hat", "Safety glasses"],
  regs: ["Electricity at Work Regs 1989", "PUWER 1998"],
}
```

---

## Design system

Most modules import shared mobile-friendly styles:

```js
import { ms } from "../utils/moduleStyles";
const ss = ms; // or { ...ms, ta: { ...ms.inp, minHeight: 100 }, ... } for extras
```

Org settings and some components extend `ms` for `btnO`, `ta`, `sec`, etc. Global CSS variables and touch-target helpers live in [src/index.css](../src/index.css).

Legacy reference (conceptually aligned with `ms`, not a second source of truth):

```js
const ss = {
  btn:  { /* see moduleStyles.js */ },
  btnP: { /* primary teal */ },
  // …
};
```

Status colour system:
```js
// Risk levels
const RL = {
  high:   { bg:"#FCEBEB", color:"#791F1F" },
  medium: { bg:"#FAEEDA", color:"#633806" },
  low:    { bg:"#EAF3DE", color:"#27500A" },
};
// Permit/status
"active"  → bg:"#EAF3DE" color:"#27500A"
"pending" → bg:"#FAEEDA" color:"#633806"
"expired" → bg:"#FCEBEB" color:"#791F1F"
"closed"  → bg:"var(--color-background-secondary)" color:"var(--color-text-secondary)"
"draft"   → bg:"#E6F1FB" color:"#0C447C"
```

---

## Permit types (15 total)

```
hot_work          | Welding, grinding, sparks
electrical        | Safe isolation, LOTO, live work
work_at_height    | Scaffold, MEWP, ladders
confined_space    | Tanks, sewers, voids
excavation        | Utility strike prevention, CAT scan
lifting           | Crane, LOLER operations
cold_work         | Maintenance LOTO on live plant
line_break        | Opening pressurised pipework
roof_access       | Any roof — flat, pitched, fragile
night_works       | Out-of-hours, security arrangements
valve_isolation   | Process plant — food/pharma
visitor_access    | Visitor/contractor authorised entry
radiography       | Gamma-ray/X-ray NDT inspection
ground_disturbance| Piling, ground anchors, UXO
general           | General works, custom checklist
```

---

## PDF generation pattern

All modules generate print-ready A4 HTML in a new window:

```js
function printDocument(data) {
  const org = getOrgSettings();
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${data.title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0; padding: 20px; }
    h1 { background: ${org.primaryColor || "#0d9488"}; color: #fff; padding: 8px 12px; font-size: 15px; }
    @media print { h1 { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>
    <!-- logo header -->
    <div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid ${org.primaryColor||"#0d9488"};padding-bottom:10px;margin-bottom:14px">
      ${org.logo ? `<img src="${org.logo}" style="height:44px;max-width:120px;object-fit:contain"/>` : ""}
      <div>
        <div style="font-weight:bold;font-size:14px">${org.name || "MySafeOps"}</div>
        ${org.pdfHeader ? `<div style="font-size:11px;color:#666">${org.pdfHeader}</div>` : ""}
      </div>
    </div>
    <!-- content -->
    ...
    <!-- footer -->
    <p style="font-size:10px;color:#999;margin-top:16px">${org.pdfFooter || "Generated by MySafeOps"}</p>
  </body></html>`);
  win.document.close();
  win.print();
}
```

---

## UK regulatory framework

The app is built for the UK market. All regulation references must be accurate:

| Regulation | Area |
|---|---|
| HASAWA 1974 | General health & safety duty of care |
| Management of H&S Regs 1999 | Risk assessment requirement |
| CDM 2015 | Construction design & management |
| Electricity at Work Regs 1989 | Electrical safety |
| Work at Height Regs 2005 | Falls prevention |
| LOLER 1998 | Lifting operations |
| PUWER 1998 | Work equipment safety |
| COSHH 2002 | Hazardous substances |
| Manual Handling Ops Regs 1992 | Manual handling |
| Confined Spaces Regs 1997 | Confined space entry |
| Control of Noise Regs 2005 | Noise at work |
| Control of Vibration Regs 2005 | HAVs & WBV |
| RIDDOR 2013 | Incident reporting to HSE |
| PPE Regs 2022 | Personal protective equipment |
| PSSR 2000 | Pressure systems safety |
| DSEAR 2002 | Dangerous substances / explosion |
| Control of Asbestos Regs 2012 | Asbestos management |
| Control of Lead Regs 2002 | Lead exposure |
| F-Gas Regs (UK retained) | Fluorinated gases |
| Gas Safety Regs 1998 | Gas installation |
| IRR 2017 | Ionising radiation |
| NRSWA 1991 | Street works (utilities) |
| Chapter 8 Traffic Signs Manual | Road works TM |

---

## Document library (E:\MySafeOps\DOCS)

The `DocumentLibrary.jsx` component uses the **File System Access API**:

```js
// User selects folder once via showDirectoryPicker()
const handle = await window.showDirectoryPicker({ mode: "read" });
// Files read recursively — subfolders included
// PDFs preview inline in iframe
// Images preview inline
// All other files download
// Tags/notes/project links stored in localStorage
// NOTHING is uploaded — all local
```

Works in **Chrome and Edge 86+** only. Not supported in Firefox.

---

## RAMS hazard library totals

| File | Categories | Hazards |
|---|---|---|
| ramsHazardLibrary.js | 11 (base — FESS source) | 30 |
| ramsHazardLibraryExtended.js | 12 (new trades) | 35 |
| ramsHazardLibraryPro.js | 10 (specialist) | 38 |
| **Total** | **33 categories** | **103 hazards** |

Categories covered: Electrical, Mechanical/Pipework, Welding/Hot Works, Work at Height, Manual Handling, General Site, Machine Installation, Food Factory Specific, Confined Space, Lifting Operations, Groundworks & Excavation, Asbestos & Hazardous Materials, Gas & HVAC, Roofing & Waterproofing, Structural Steel, Demolition & Strip-out, Painting/Decorating/Flooring, Plumbing & Drainage, Fire Protection, Solar PV & EV Charging, Rail & Trackside, Warehousing & Logistics, Scaffolding, Chapter 8 Traffic Management, Healthcare & Cleanroom, Telecoms & Data Cabling, Concrete & Formwork, Bricklaying & Masonry, Compressed Air & Steam Systems, Rope Access (IRATA), Cold Storage & Refrigerated Spaces, Security & Building Technology Systems.

---

## Coding rules

1. **Always org-scope storage keys**: `${key}_${getOrgId()}`
2. **Never hardcode personal data** — worker names, client names etc. are user-entered
3. **Prefer one main file per feature module** — split only when it improves clarity
4. **Styling** — inline styles + `ms` from `moduleStyles.js`; use `index.css` only for global/mobile primitives
5. **Mobile-first** — layouts must work on narrow phones (see existing modules)
6. **Print** — document-style modules should offer print/PDF-friendly output where it adds value (`getOrgSettings()` for branding)
7. **CSV** — list/register modules should offer export where it matches user expectations
8. **Destructive actions** — use `confirm()` (or equivalent) before delete
9. **No TypeScript** — plain JavaScript JSX unless the repo moves to TS deliberately
10. **DM Sans** — `fontFamily: "DM Sans, system-ui, sans-serif"` (loaded from Google Fonts in `index.html`)

---

## Current modules (shipping in `src/`)

Authoritative UX list: in-app **Help** ([src/components/HelpAbout.jsx](../src/components/HelpAbout.jsx)) mirrors the product modules. Navigation ids are defined in [src/App.jsx](../src/App.jsx) (`VIEW_COMPONENTS` + `MORE_TABS`).

**Bottom nav:** Dashboard, Permits, RAMS, Workers, More.

**More menu (and lazy-loaded views)** includes among others: Method statement, CDM, Daily briefing, QR induction, Signatures, Timesheets, Snags, COSHH, Inspections, Incidents, RIDDOR, Emergency, PPE, Plant, Fire safety, Hot work, Training, Visitors, Toolbox log, First aid, Lone working, Environmental, Observations, Ladders, MEWP, Gate book, Asbestos, Confined space, LOTO, Electrical, Lifting, DSEAR, Noise & vibration, Scaffold, Excavations, Temporary works, Welfare checks, Water hygiene, Analytics, Monthly report, Waste register, Templates, AI RAMS / AI toolbox / AI photo hazard, Client portal, Subcontractor, Documents, Backup, Audit log, Help, Settings.

**Settings** bundles CloudAccount (Supabase), OrgSettings, NotificationSettings.

### Gaps vs historical prototype (`DOCS/rams-pro.jsx`)

See **[PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md)** for features described in older docs but not implemented as in the monolith (e.g. global search, full D1 backend, Stripe billing).

### Small code pointer

`src/productBacklog.js` may reference further enhancements (e.g. richer multi-device sync).

---

## App.jsx navigation structure

Keep [src/App.jsx](../src/App.jsx) in sync when adding a module:

1. `lazy(() => import("…"))` for the component
2. `VIEW_COMPONENTS` entry (`id` → component)
3. `MORE_TABS` row (`id`, `label`) unless it is one of the four main tabs
4. [src/viewPrefetch.js](../src/viewPrefetch.js) `LOADERS` for the same `id`
5. [HelpAbout.jsx](../src/components/HelpAbout.jsx) `MODULE_GROUPS` if users should see it in the index

**Bottom nav:** `dashboard`, `permits`, `rams`, `workers`, `more`.

**More menu ids** (abbreviated — copy from `App.jsx` when in doubt):  
`method-statement`, `cdm`, `daily-briefing`, `induction`, `signatures`, `timesheets`, `snags`, `coshh`, `inspections`, `incidents`, `riddor`, `emergency`, `ppe`, `plant`, `fire`, `hot-work`, `training`, `visitors`, `toolbox-reg`, `first-aid`, `lone-working`, `environmental`, `observations`, `ladders`, `mewp`, `gate`, `asbestos`, `confined-space`, `loto`, `electrical-pat`, `lifting`, `dsear`, `noise`, `scaffold`, `excavation`, `temp-works`, `welfare`, `water-hygiene`, `analytics`, `monthly-report`, `waste`, `templates`, `ai-rams`, `ai-toolbox`, `ai-photo`, `client-portal`, `subcontractor`, `documents`, `backup`, `audit`, `help`, `settings`.

---

## Key patterns

### Form with save/edit
```jsx
function MyForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(item ? {...item} : { id:genId(), ...defaults });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  // ...
  return (
    <div style={{ minHeight:600, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:580 }}>
        {/* form content */}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:16 }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <button onClick={()=>onSave(form)} style={ss.btnP}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

### Main module with list
```jsx
export default function MyModule() {
  const [items, setItems] = useState(()=>load("my_items",[]));
  const [modal, setModal] = useState(null);
  useEffect(()=>{ save("my_items",items); },[items]);
  const saveItem = (item) => {
    setItems(prev=>prev.find(x=>x.id===item.id)?prev.map(x=>x.id===item.id?item:x):[item,...prev]);
    setModal(null);
  };
  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14 }}>
      {modal?.type==="form" && <MyForm item={modal.data} onSave={saveItem} onClose={()=>setModal(null)} />}
      {/* header, stats, filters, list */}
    </div>
  );
}
```

---

## FESS source documents (E:\MySafeOps\DOCS)

22 RAMS/MS PDFs from real FESS jobs:
- 2SFG Scunthorpe (8 docs): FP1 works, Dolav/Meyn stations, kettle removal, RO room, tank relocation
- 2SFG Flixton (2 docs): Grills M&E works
- Dovecoat Park (4 docs): Machine installation/placement
- Butternut Box (3 docs): Variovac install, spiral conveyor repair
- Quorn Foods (2 docs): Evap tower pipe support
- Cranswick/Foodclean Lazenby (2 docs): Chemical pipe changeover

All hazards, control measures, PPE and regs in the hazard library are extracted from these real documents.

---

## What to work on next (suggestions — verify against repo)

Priorities evolve; check **Help**, **productBacklog.js**, and **[PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md)**.

1. **Real multi-device sync** — beyond JSON `app_sync` snapshot (if product requires live CRUD)
2. **Production-safe AI** — proxy Anthropic from a backend; remove secrets from `VITE_*`
3. **PWA polish** — manifest + icons in `public/` if you want installable app
4. **Bulk operations** — multi-select approve/export across modules
5. **Deeper RIDDOR / statutory outputs** — match official formats where required
6. **Stripe / plans** — if moving from single-org local tool to SaaS ([FILE-INDEX.md](./FILE-INDEX.md) checklist is historical but lists intent)

---

*MySafeOps — Building safety, not paperwork.*

**Also read:** [README.md](../README.md), [architecture-current.md](./architecture-current.md).
