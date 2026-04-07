# MySafeOps — Cursor AI Development Prompt

## Project overview

You are working on **MySafeOps** (mysafeops.com) — a UK construction site safety management platform built for **FESS Food Engineering Services**. The app is a single-page React application using localStorage for persistence and DM Sans font. No backend currently.

---

## Tech stack

- **React JSX** — single-file components, no TypeScript
- **localStorage** — all persistence, org-scoped keys
- **No external UI libraries** — inline styles only
- **DM Sans** font (Google Fonts)
- **Vite** or Create React App
- **File System Access API** — for document library
- **Web Push API + Service Worker** — for offline mode and notifications

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
│   ├── App.jsx                          ← main router + nav
│   ├── main.jsx                         ← entry point, SW registration
│   │
│   ├── components\
│   │   ├── OrgSettings.jsx              ← logo upload, brand colours, PDF defaults
│   │   ├── AnalyticsDashboard.jsx       ← live metrics from all modules
│   │   ├── ClientPortal.jsx             ← read-only client links
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
│   │   ├── InspectionTracker.jsx        ← LOLER, PAT, PUWER, EICR, scaffold
│   │   ├── RIDDORWizard.jsx             ← RIDDOR F2508 with deadline alerts
│   │   └── DocumentLibrary.jsx          ← File System Access API folder reader
│   │
│   └── offline\
│       ├── service-worker.js            ← cache-first SW, background sync
│       ├── offlineManager.js            ← SW registration, IndexedDB queue
│       ├── OfflineStatusBanner.jsx      ← online/offline/update banner
│       ├── pushNotifications.js         ← local + push notifications
│       └── NotificationSettings.jsx     ← notification preferences panel
│
├── public\
│   └── service-worker.js               ← copy of service-worker.js here
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

## Design system (inline styles only)

```js
// Standard shared styles object used across all components
const ss = {
  btn:  { padding:"7px 14px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  btnP: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #085041", background:"#0d9488", color:"#E1F5EE", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  btnO: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #c2410c", background:"#f97316", color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  inp:  { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box" },
  lbl:  { display:"block", fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:4 },
  card: { background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:12, padding:"1.25rem" },
  ta:   { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", lineHeight:1.5 },
  sec:  { fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 },
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
3. **Single file per module** — no separate CSS or sub-component files unless asked
4. **Inline styles only** — no CSS modules, no Tailwind, no styled-components
5. **Mobile-first** — all layouts work on 375px wide screen
6. **Print function** — every document module must have a `printXxx()` function
7. **Export CSV** — every register (snags, COSHH, workers, timesheets) must export to CSV
8. **Org settings in PDFs** — every print uses `getOrgSettings()` for logo and branding
9. **No alerts for deletes** — use `confirm()` before destructive actions
10. **No TypeScript** — plain JavaScript JSX only
11. **DM Sans everywhere** — `fontFamily: "DM Sans, system-ui, sans-serif"`

---

## Current modules status

### Complete and tested
- OrgSettings (logo, brand, PDF defaults, custom fields)
- PermitSystem (15 permit types, countdown timers, print)
- RAMSTemplateBuilder (4-step wizard, 103 hazard library)
- MethodStatement (5-tab builder, step editor, print)
- CDMCompliance (CDM 2015, CPP, F10 tracker)
- DailyBriefing (pre-work briefing, attendance, signatures, print)
- QRInduction (QR codes, 3-step form, site register, GPS)
- DigitalSignature (canvas, GPS, audit trail, SignaturePanel export)
- Timesheet (weekly hours, overtime, approval, CSV export)
- SnagRegister (photos, status, priority, export)
- COSHHRegister (GHS, PPE, first aid, SDS, export)
- InspectionTracker (LOLER, PAT, PUWER, EICR, 12 types)
- RIDDORWizard (7 RIDDOR types, F2508, deadline alerts)
- AnalyticsDashboard (live metrics, compliance score, charts)
- ClientPortal (read-only token links for clients)
- DocumentLibrary (File System Access API, tags, PDF preview)
- OfflineStatusBanner + offlineManager + service-worker
- pushNotifications + NotificationSettings
- ramsHazardLibrary + ramsHazardLibraryExtended + ramsHazardLibraryPro

### Still to build
- AI RAMS generator (Claude API — auto-generate RAMS from activity description)
- AI toolbox talk generator (Claude API)
- Photo hazard detection (Claude Vision API)
- Monthly auto-report PDF (auto-generated monthly H&S summary)
- Waste register module
- Subcontractor management portal
- Document templates (save/clone RAMS and MS)
- Roles & permissions system (Operative / Supervisor / Admin)
- Audit log (timestamped edit history)
- Cloud backup (Supabase free tier or Google Drive export)
- Bulk operations (multi-select approve/export)
- RIDDOR print to F2508 format

---

## App.jsx navigation structure

```jsx
// Bottom mobile nav tabs (main)
const NAV_TABS = [
  { id:"dashboard",   label:"Dashboard",    icon:BarChart2 },
  { id:"permits",     label:"Permits",      icon:FileCheck },
  { id:"rams",        label:"RAMS",         icon:ClipboardList },
  { id:"workers",     label:"Workers",      icon:Users },
  { id:"more",        label:"More",         icon:Menu },  // opens secondary nav
];

// Secondary nav (More menu)
const MORE_TABS = [
  "method-statement", "cdm", "daily-briefing", "induction", "signatures",
  "timesheets", "snags", "coshh", "inspections", "riddor",
  "analytics", "client-portal", "documents", "settings",
];
```

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

## What to work on next (prioritised)

1. **AI RAMS generator** — user types activity, Claude API generates full RAMS
2. **Monthly auto-report** — one-click branded PDF: compliance score, incidents, permits, certs expiring
3. **Waste register** — waste transfer notes, duty of care, Environment Agency
4. **Document templates** — save/clone RAMS and MS documents
5. **Roles & permissions** — Operative / Supervisor / Admin
6. **Audit log** — every edit timestamped
7. **Subcontractor portal** — sub submits RAMS/certs via link
8. **Cloud backup** — export all data to JSON bundle

---

*MySafeOps — Building safety, not paperwork.*
