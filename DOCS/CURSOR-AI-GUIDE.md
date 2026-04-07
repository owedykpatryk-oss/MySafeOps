# RAMS Pro — Cursor AI Setup Guide

## ✅ Co MASZ (pliki z Claude):

### 1. `rams-pro.jsx` (110KB) — Działający prototyp
- Kompletne UI z WSZYSTKIMI modułami
- 14 typów dokumentów, 7 registers, 5 checklists
- Training matrix, site plan, weather, calendar, timeline
- PDF export, global search, compliance score
- **UWAGA:** To jest SINGLE FILE prototype — działa w Claude Artifacts ale do produkcji trzeba rozdzielić

### 2. `data.js` (31KB) — Rozbudowana baza danych
- 35 trades z auto-PPE (z EN standards)
- Kompletne hazard libraries per trade (z UK law refs)
- Smart control suggestions (10 categories)
- 160+ equipment items
- Vehicle checklists (40+ items)
- Equipment inspection checklists
- Full toolbox talks library
- 40+ certificate types
- 50+ photo categories
- Blank factories for ALL document types

### 3. `utils.js` (30KB) — Logika biznesowa
- PDF export z cover page, ToC, hazard tables, worker cards
- Compliance score calculator
- Smart control suggestion engine
- Risk matrix calculations
- Document completeness calculator

---

## ❌ Co POTRZEBUJESZ dodać w Cursor AI:

### Krok 1: Stwórz projekt React
```bash
npm create vite@latest rams-pro -- --template react
cd rams-pro
npm install
```

### Krok 2: Zainstaluj dependencies
```bash
npm install react-router-dom    # routing
npm install tailwindcss @tailwindcss/vite  # styling (opcjonalnie — inline styles już działają)
npm install jspdf jspdf-autotable  # lepszy PDF export
npm install html2canvas           # screenshot site plan do PDF
npm install qrcode.react          # QR codes na dokumentach
npm install react-icons           # ikony (opcjonalnie)
npm install idb                   # IndexedDB zamiast localStorage (więcej danych)
npm install date-fns              # date formatting
```

### Krok 3: Struktura plików
Skopiuj pliki i rozdziel `rams-pro.jsx` na komponenty:

```
src/
├── App.jsx                 ← Main shell (routing, state management)
├── data.js                 ← SKOPIUJ z Claude (constants, trades, hazards)
├── utils.js                ← SKOPIUJ z Claude (PDF, compliance, helpers)
├── store.js                ← NOWY: State management (Context/Zustand)
├── db.js                   ← NOWY: IndexedDB instead of localStorage
│
├── components/
│   ├── layout/
│   │   ├── Header.jsx
│   │   ├── BottomNav.jsx
│   │   └── Layout.jsx
│   │
│   ├── shared/
│   │   ├── RiskMatrix.jsx      ← Clickable 5x5 matrix
│   │   ├── TrainingMatrix.jsx  ← Workers x certs grid
│   │   ├── ComplianceScore.jsx
│   │   ├── Signatures.jsx
│   │   ├── PhotoCapture.jsx
│   │   ├── GlobalSearch.jsx
│   │   └── UI.jsx             ← Shared form components (Input, Select, etc.)
│   │
│   ├── dashboard/
│   │   └── Dashboard.jsx
│   │
│   ├── projects/
│   │   ├── ProjectList.jsx
│   │   ├── ProjectView.jsx
│   │   └── ProjectEdit.jsx
│   │
│   ├── documents/
│   │   ├── DocEditor.jsx       ← Router for all doc types
│   │   ├── RAMSEditor.jsx
│   │   ├── PermitEditor.jsx
│   │   ├── IncidentEditor.jsx
│   │   ├── SnagEditor.jsx
│   │   ├── RFIEditor.jsx
│   │   ├── SiteReportEditor.jsx
│   │   └── InstructionEditor.jsx
│   │
│   ├── workers/
│   │   ├── WorkerList.jsx
│   │   ├── WorkerEdit.jsx
│   │   └── CertificateCard.jsx
│   │
│   ├── vehicles/
│   │   ├── VehicleList.jsx
│   │   └── VehicleEdit.jsx
│   │
│   ├── equipment/
│   │   ├── EquipmentList.jsx
│   │   └── EquipmentEdit.jsx
│   │
│   ├── siteplan/
│   │   └── SitePlan.jsx
│   │
│   ├── registers/
│   │   ├── RegistersPage.jsx
│   │   ├── COSHHRegister.jsx
│   │   ├── ScaffoldRegister.jsx
│   │   ├── LiftingRegister.jsx
│   │   ├── FireLog.jsx
│   │   ├── WasteRegister.jsx
│   │   ├── VisitorLog.jsx
│   │   └── DrawingRegister.jsx
│   │
│   ├── checklists/
│   │   ├── ChecklistPage.jsx
│   │   └── ChecklistRunner.jsx
│   │
│   ├── permits/
│   │   └── PermitDashboard.jsx
│   │
│   ├── weather/
│   │   └── WeatherPage.jsx
│   │
│   ├── timeline/
│   │   └── Timeline.jsx
│   │
│   ├── calendar/
│   │   └── Calendar.jsx
│   │
│   ├── toolbox/
│   │   └── ToolboxTalks.jsx
│   │
│   ├── inductions/
│   │   └── InductionPage.jsx
│   │
│   └── settings/
│       ├── Settings.jsx
│       └── Branding.jsx
│
├── styles/
│   └── globals.css
│
└── assets/
    └── (logo files etc.)
```

### Krok 4: Prompt dla Cursor AI

Wklej to jako pierwszy prompt w Cursor:

```
I have a construction safety management app (RAMS Pro) built as a single React file prototype.
I need you to:

1. Split rams-pro.jsx into separate component files following the structure in the README
2. Use data.js for all constants and utils.js for business logic
3. Add React Router for navigation
4. Replace localStorage with IndexedDB (using idb library) for better data storage
5. Add proper error boundaries and loading states
6. Make it a PWA (Progressive Web App) with offline support
7. Add proper TypeScript types (optional but recommended)

The app manages:
- Projects (CDM 2015 compliant)
- RAMS (Risk Assessment & Method Statements) with 5x5 clickable risk matrix
- 7 types of Permits to Work
- Site Reports, Day Reports, Instructions
- Incident/Near Miss register (RIDDOR compliant)
- Snagging/Defect list
- RFI tracker
- Worker profiles with certificate expiry tracking
- Vehicle fleet (MOT, insurance, tax tracking)
- Equipment register with calibration
- Interactive site plans with markers
- GPS-tagged photos
- 7 registers (COSHH, Scaffold, Lifting, Fire, Waste, Visitor, Drawing)
- 5 pre-built checklists
- Training matrix
- Weather integration with safety recommendations
- PDF export with company branding
- Compliance scoring
- Global search

All UK Health & Safety law compliant (CDM 2015, HASAWA 1974, WAHR 2005, LOLER 1998, etc.)

Please start by creating the project structure and splitting the components.
```

---

## 🔮 Co jeszcze warto DODAĆ w Cursor (NEXT STEPS):

### Priority 1 — Production Ready:
- [ ] **Backend/Database** — Supabase lub Firebase (multi-user, cloud sync)
- [ ] **Authentication** — Login/register, role-based access
- [ ] **PWA** — Offline support, installable on phone
- [ ] **File uploads** — PDF certificates, site photos to cloud storage
- [ ] **Push notifications** — Cert expiry reminders, permit alerts

### Priority 2 — Professional Features:
- [ ] **Multi-user** — Admin, Manager, Supervisor, Worker roles
- [ ] **Real-time sync** — Multiple users on same project
- [ ] **Email integration** — Send documents, alerts
- [ ] **QR codes** — On every document, scan to view
- [ ] **Digital signatures** — Touch/draw signature on mobile
- [ ] **Audit trail** — Who changed what, when
- [ ] **Document versioning** — Revision history
- [ ] **Batch PDF export** — Export all project docs at once

### Priority 3 — Advanced:
- [ ] **AI risk assessment** — Auto-generate from job description
- [ ] **OCR** — Scan paper certificates
- [ ] **CSCS verification API** — Check card validity
- [ ] **Companies House API** — Verify contractors
- [ ] **Client portal** — Read-only access for clients
- [ ] **Analytics dashboard** — Incident trends, compliance over time
- [ ] **Custom report builder** — Drag & drop report creation
- [ ] **Integration** — Procore, Fieldwire, Xero export

---

## 📋 Checklist: "Czy to gotowe do produkcji?"

| Item | Prototype ✅ | Production ❌ |
|------|-------------|--------------|
| UI/UX | ✅ Complete | Needs responsive polish |
| All document types | ✅ 14 types | Done |
| Risk matrix | ✅ Clickable 5x5 | Done |
| Auto-PPE | ✅ 16 trades | Done |
| Smart suggestions | ✅ 10 categories | Done |
| Hazard library | ✅ Per trade | Done |
| PDF export | ✅ With logo | Needs jsPDF for better quality |
| Data storage | ⚠️ localStorage | Need database (Supabase/Firebase) |
| Authentication | ❌ None | Need login system |
| Multi-user | ❌ Single user | Need real-time sync |
| Offline | ⚠️ Works offline | Need proper PWA/service worker |
| File uploads | ❌ Base64 in localStorage | Need cloud storage (S3/Supabase) |
| Notifications | ❌ None | Need push notifications |
| Security | ❌ No auth | Need encryption, RBAC |
| Testing | ❌ None | Need unit/integration tests |
| Deployment | ❌ Local only | Need hosting (Vercel/Netlify) |

---

## 🚀 Quick Deploy (for testing/demo):

```bash
# Build and deploy to Vercel (free)
npm run build
npx vercel deploy
```

Or Netlify:
```bash
npm run build
npx netlify deploy --prod --dir=dist
```

---

## 💡 Tip for Cursor AI:

When working in Cursor, tell it:
- "Use the data from data.js — don't recreate constants"
- "Follow the same UI patterns as rams-pro.jsx"
- "Keep the dark/light theme system"
- "Maintain the orange (#f97316) accent colour scheme"
- "All UK H&S law references must be preserved"
- "Mobile-first responsive design"
