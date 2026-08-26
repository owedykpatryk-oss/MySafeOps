# Target Audience

Five personas, ranked by product fit. Each has the language they actually use, the pain they actually feel, and the modules that serve them.

**Rule for all content:** speak to one persona per post. A post written for everyone reaches nobody.

---

## The strategic question you need to answer

MySafeOps serves **two audiences that barely overlap**:

- **Safety & compliance** — contractors, H&S managers, food/pharma M&E
- **Utility survey** — PAS 128, GPR, geo-photos, CAD deliverables

A survey company owner does not care about allergen changeover registers. A food factory H&S manager has never heard of PAS 128 quality levels.

**Three options:**

1. **One brand, two content tracks.** Same account, alternate topics. Cheapest, but the feed reads as unfocused and each post reaches the wrong half of the audience.
2. **Lead with survey, treat safety as the bundle.** Survey is where the product is most differentiated and least contested — and it is a revenue workflow for the buyer, not overhead. Safety becomes "and it does all your permits too", which is a strong upsell rather than a competing message.
3. **Two accounts.** Cleanest targeting, double the work. Only viable if one channel is clearly winning.

**My recommendation: option 2.** Lead with survey. It is the sharper wedge, the harder-to-copy product, and the buyer who values it most. Safety content still gets posted — but positioned as the thing that comes free with the survey workspace, not as the headline. Revisit after 30 days of data.

---

## Persona 1 — Survey company owner / director

**Highest product fit. Lead with this one.**

| | |
|---|---|
| **Company** | 3–30 person utility survey / GPR / topographic survey firm |
| **Job titles** | Owner, Managing Director, Survey Manager, Operations Manager |
| **Buys** | Business £249, occasionally Team £99 |

**What they actually care about**

Their deliverable *is* the product. Every hour spent formatting a PAS 128 report is an hour not billed. They are judged by clients on report quality and turnaround, and they lose bids on both.

**Pain, in their words**
- "The survey's done in a day and the report takes three."
- "Every client wants the schedule in a slightly different format."
- "My best surveyor spends his evenings in AutoCAD instead of on site."
- "The QL levels get questioned every single time."
- "Undertaker records come back weeks later and I've got to fold them into a report I've already drafted."

**Modules that serve them**
`surveyReport/` (PAS 128 methods M1/M2/M2P, QL dashboard, findings builder, undertaker enquiry tracking, revision timeline), `gprReport/` (radargrams, chainage charts, CAD import, deliverable scorecard), `GeoPhotos.jsx` (BNG export, bearing, 18 typed capture presets), `surveyHandoverPack.js` (client ZIP: PDF, HTML, CSV schedules, CAD sidecar, verify sheet)

**Language to use** — PAS 128, quality level, QL-B, EML, GPR, radargram, chainage, undertaker records, statutory records, National Grid, DXF, topo, C2 drawing, dig risk, anomaly, trial pit

**Language to avoid** — "safety software", "compliance platform", "HSE". They will file you under overhead and stop reading.

**Where they are** — LinkedIn, heavily. Survey and geospatial groups. Not Instagram.

---

## Persona 2 — Owner / director, small specialist contractor

**The volume buyer.**

| | |
|---|---|
| **Company** | 5–50 people. M&E, mechanical install, fabrication, fit-out |
| **Job titles** | Owner, Director, Contracts Manager |
| **Buys** | Team £99 or Business £249, on their own card |

**What they actually care about**

They carry the compliance risk personally and have no full-time H&S person. They want to stop losing tenders on paperwork and stop lying awake about what would happen if the HSE turned up.

**Pain, in their words**
- "The client asked for our RAMS and it took me two days to find the current one."
- "I'm not paying for a system my lads won't use."
- "Half my Sunday is paperwork."
- "One of the subbies turned up with an out-of-date ticket and it's my problem."
- "We got knocked back on a PQQ for something we actually do properly — we just couldn't prove it."

**Modules that serve them**
`permits/`, `rams/RAMSTemplateBuilder`, `SubcontractorPortal.jsx`, `TrainingMatrix.jsx`, `QRInduction.jsx`, `ClientPortal`, `DocumentLibrary.jsx`

**Language to use** — RAMS, permit to work, method statement, tickets, cards, subbies, PQQ, pre-qual, client audit, toolbox talk, CSCS, tender

**Language to avoid** — "digital transformation", "workflow orchestration", "enterprise". They are suspicious of anything that sounds like it needs a consultant.

**Where they are** — LinkedIn and Facebook trade groups. Some Instagram.

---

## Persona 3 — Contracts / ops manager, food & pharma M&E contractor

**Narrowest niche, least competition, best conversion.**

| | |
|---|---|
| **Company** | Contractor working inside food factories, dairies, breweries, pharma plants |
| **Job titles** | Contracts Manager, Operations Manager, Site Manager |
| **Buys** | Business £249 |

**What they actually care about**

Working in a live food plant has rules no construction app understands. Hygiene clearance, allergen risk, glass and hard plastic control, high care access, CIP sign-off. They currently manage this on spreadsheets the client made them use.

**Pain, in their words**
- "The client's hygiene team won't release the line until the paperwork's signed."
- "Every factory has a different glass and hard plastic procedure."
- "We shut a production line down for four hours because a permit wasn't signed off."
- "Generic safety apps have never heard of an allergen changeover."

**Modules that serve them**
`AllergenChangeoverRegister.jsx`, `CIPSignoffRegister.jsx`, `GMPDeviationLog.jsx`, `GlassHardPlasticRegister.jsx`, `HighCareAccessRegister.jsx`, `WaterHygieneLog.jsx`, `FoodPharmaSetupWizard.jsx`, plus the permit types for line clearance / product isolation

**Language to use** — allergen changeover, CIP, GMP deviation, glass and hard plastic, high care, low risk / high risk zone, line clearance, product isolation, hygiene clearance, BRCGS, shutdown, planned downtime

**Where they are** — LinkedIn. Food manufacturing and engineering groups.

---

## Persona 4 — H&S manager / advisor, principal contractor

**Real buyer, most crowded market.**

| | |
|---|---|
| **Company** | 50–500 people, principal contractor or large subcontractor |
| **Job titles** | H&S Manager, HSEQ Manager, SHEQ Advisor, Compliance Manager |
| **Buys** | Business £249 or Enterprise £499 |

**What they actually care about**

Being able to prove it. They are measured on audit outcomes, RIDDOR performance and whether the site paperwork survives scrutiny. They are also the persona most likely to already have SafetyCulture or similar — so content aimed at them must differentiate, not describe.

**Pain, in their words**
- "I can't tell you what's happening on site right now without ringing four people."
- "Our incident data goes into a spreadsheet and nothing comes out of it."
- "The audit trail falls apart the moment someone edits a document."
- "Near misses get reported when there's already been an accident."

**Modules that serve them**
`AuditLogViewer.jsx`, `IncidentHotspotMap.jsx`, `IncidentActionTracker.jsx`, `RIDDORWizard.jsx`, `CDMCompliance.jsx`, `ManagementOverview.jsx`, `MonthlyReport.jsx`, `permits/permitLegalGovernance.js`

**Language to use** — CDM 2015, F10, RIDDOR, principal contractor, construction phase plan, audit trail, leading indicators, close-out, HSE inspection

**Differentiator to lead with for this persona** — the conflict matrix and audit trail. Not "we have permits" (everyone does) but "we block conflicting permits and you can't quietly edit history".

**Where they are** — LinkedIn, IOSH/NEBOSH circles.

---

## Persona 5 — Field surveyor / engineer (user, not buyer)

**Does not sign the cheque. Kills the purchase if the tool annoys them.**

| | |
|---|---|
| **Job titles** | Utility surveyor, site engineer, maintenance engineer, technician |

**What they actually care about**

Getting off site on time. They have been given bad software before and they will quietly go back to paper.

**Pain, in their words**
- "No signal in the basement, so the app's useless."
- "I'm not typing all that in on a phone with gloves on."
- "I take the photo twice because I don't trust it saved."
- "Why do I have to fill in fields that don't apply to this job?"

**Why the product actually answers this** — offline PWA, typed geo-photo presets that only ask relevant questions, duplicate prevention, EXIF GPS read automatically, coarse-fix warning, tablet UX hardened for iPad and Android

**Content role** — this persona drives **shares and comments**, not leads. Posts written for them get forwarded to their boss. That is the mechanism. Write for the surveyor, sell to the director.

**Where they are** — Instagram, Reddit, WhatsApp groups. This is the one persona where Instagram genuinely works.

---

## Persona summary

| Persona | Fit | Buys | Best channel | Content job |
|---|---|---|---|---|
| Survey company owner | Highest | £249 | LinkedIn | Leads |
| Small contractor owner | High | £99–£249 | LinkedIn | Leads, volume |
| Food/pharma ops manager | High | £249 | LinkedIn | Leads, niche authority |
| H&S manager | Medium | £249–£499 | LinkedIn | Credibility |
| Field surveyor/engineer | User | — | Instagram | Reach, shares |
