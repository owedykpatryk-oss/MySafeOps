# Content Ideas

22 topics, ranked. Every one is grounded in something that exists in the codebase — the evidence column is there so nobody writes a post about a feature that isn't real.

**Scoring:** Reach = likelihood of travelling beyond followers. Leads = likelihood of producing an enquiry.

---

## Tier 1 — Post these first

### 1. The permit your software should refuse to issue
**Angle:** unpopular opinion / surprising fact
**Reach ★★★★★ · Leads ★★★★☆ · Persona:** H&S manager, contractor owner

Most permit software is a filing cabinet with a login. It will happily let you have a hot work permit and a confined space entry live in the same place at the same time, because it is storing documents, not thinking about them. Ours blocks it.

**Evidence:** `permitConflictMatrix.js` — hot work + confined space = block, hot work + line break = block, hot work + LOTO = warn, lifting + work at height = warn
**Formats:** LinkedIn text + screenshot · IG Reel (screen recording of the block) · carousel of the five rules
**Why it works:** contrarian, provable in one screenshot, and everyone in the industry has a story about two jobs happening at once.

---

### 2. The survey found the cable. The permit didn't know about it.
**Angle:** industry problem nobody talks about
**Reach ★★★★★ · Leads ★★★★★ · Persona:** survey owner, contractor owner

The strongest story the product has. A surveyor finds a service, writes it in a report, the report becomes a PDF, someone in an office re-types it into a permit, and the man with the breaker never sees the original. Every re-keying is a chance to lose it.

**Evidence:** `surveyHandoverPack.js`, `permitDigGuidance.js`, git: "Add management working diary and survey-to-dig handover"
**Formats:** LinkedIn text (flagship) · diagram of the handover chain · IG Reel
**Why it works:** this is the moat. No competitor can answer it.

---

### 3. A site photo that exports as a CAD file
**Angle:** feature reveal / "this used to take X steps"
**Reach ★★★★☆ · Leads ★★★★★ · Persona:** survey owner, surveyor

Take a photo on site. It reads the GPS out of the EXIF, converts to British National Grid, records which way the camera was facing, and exports as DXF, KML, KMZ, GPX or GeoJSON.

**Evidence:** `geoPhotoExport.js`, `britishNationalGrid.js`, `geoPhotoUtils.isCoarseGpsAccuracy`
**Caveat that must appear:** BNG conversion is Helmert, ±5 m — for locating field evidence, not precision setting-out. **Say this in the post.** It builds more trust than it costs.
**Formats:** IG Reel (photo → DXF in 15s) · LinkedIn screen recording · before/after
**Why it works:** it looks like magic and it's completely verifiable.

---

### 4. Stop asking a survey control mark which buried service it is
**Angle:** behind the scenes / build in public
**Reach ★★★★☆ · Leads ★★★☆☆ · Persona:** surveyor, survey owner

A real commit message. Every geo-photo type now asks only its own questions — a trial pit gets trial pit fields, a borehole cap gets borehole fields, a control mark doesn't get asked what utility it is.

**Evidence:** `geoPhotoFields.js` — 18 types; git commits a6ca1fd, 1c65d5c, 861a06a
**Formats:** LinkedIn build-in-public · IG carousel of the 18 types
**Why it works:** the specificity *is* the credibility. Only someone who has done the job knows this is annoying.

---

### 5. The ticket expired on Tuesday. Nobody noticed until Friday.
**Angle:** pain/problem
**Reach ★★★★☆ · Leads ★★★★☆ · Persona:** contractor owner, H&S manager

Cards run out, medicals lapse, inspection certificates go out of date quietly while the work carries on. The system should tell you a month before, not a month after.

**Evidence:** `TrainingMatrix.jsx`, `InspectionTracker.jsx`, `trainingWorkerCertSync.js`, `LadderInspection.jsx`, `ElectricalPATLog.jsx`
**Formats:** LinkedIn text · IG static with the line as overlay
**Why it works:** universal, uncomfortable, generates "this happened to us" comments.

---

## Tier 2 — Strong, post regularly

### 6. No signal in the basement
**Angle:** real-world use case
**Reach ★★★☆☆ · Leads ★★★☆☆ · Persona:** surveyor, field engineer

Half the places this job happens have no signal. Plant rooms, basements, rural lanes, inside a tank. Cloud-only tools fail exactly where the work is.

**Evidence:** `public/service-worker.js` (`SW_VERSION = mysafeops-v1.4.0`), `offline.html`, `src/offline/`
**Formats:** IG Reel (airplane mode demo) · LinkedIn text

---

### 7. Why your GPR report gets questioned every time
**Angle:** education / expertise
**Reach ★★★★☆ · Leads ★★★★☆ · Persona:** survey owner

PAS 128 quality levels are misread constantly — by clients and sometimes by the people writing the reports. Explain M1 vs M2 vs M2P, what each actually evidences, and what a client is entitled to conclude.

**Evidence:** `pas128MethodPresets.js` — M1 desktop (Type D), M2 EML+GPR real-time, M2P 2 m grid post-processed
**Formats:** LinkedIn carousel · IG carousel
**Note:** pure education. Useful to somebody who never buys — which is exactly why it travels.

---

### 8. Permit types nobody else builds
**Angle:** curiosity / feature reveal
**Reach ★★★☆☆ · Leads ★★★★☆ · Persona:** rail, marine, aerial contractors

COSS and lookout names. Coxswain and approved tide window. CAA operator ID and NOTAM reference. If you work rail, marine or UAV you have spent years bending a generic form to fit.

**Evidence:** `permitTypes.js`
**Formats:** LinkedIn text · IG carousel
**Why it works:** tiny audience, near-zero competition, very high intent.

---

### 9. Generic safety apps have never heard of an allergen changeover
**Angle:** industry problem nobody talks about
**Reach ★★★☆☆ · Leads ★★★★★ · Persona:** food/pharma ops manager

Working in a live food plant has rules construction software has never met. CIP sign-off, glass and hard plastic control, high care access, GMP deviation.

**Evidence:** `AllergenChangeoverRegister.jsx`, `CIPSignoffRegister.jsx`, `GMPDeviationLog.jsx`, `GlassHardPlasticRegister.jsx`, `HighCareAccessRegister.jsx`
**Formats:** LinkedIn text · IG carousel

---

### 10. What "can I see your RAMS" should cost you
**Angle:** before vs after
**Reach ★★★★☆ · Leads ★★★★☆ · Persona:** contractor owner

The client asks on site. You either pull it up or you ring the office. One of those loses you the next job.

**Evidence:** `ClientPortal`, `?portal=TOKEN`, `rams/PublicRamsShareView.jsx`
**Formats:** LinkedIn text · IG before/after · Reel

---

### 11. Deleted isn't gone
**Angle:** feature reveal / credibility
**Reach ★★★☆☆ · Leads ★★★☆☆ · Persona:** H&S manager

If somebody can quietly delete a permit and the record vanishes, your audit trail is decoration. Soft delete to a recycle bin, tombstones on sync, created-by and last-edited-by on every document.

**Evidence:** `RecycleBin.jsx`, `d1ArrayMerge.replaceWithTombstone`, `documentAuthorship.js`, `AuditLogViewer.jsx`, git 3f9d9b2
**Formats:** LinkedIn text · screenshot

---

### 12. I got tired of re-typing the schedule
**Angle:** "I built this because…"
**Reach ★★★★☆ · Leads ★★★☆☆ · Persona:** survey owner

Field answers now populate the report's utility and GI schedules directly.

**Evidence:** git 6def8cb "Fill the report's utility and GI schedules from field answers"
**Formats:** LinkedIn build-in-public · IG Reel

---

### 13. The actions raised on site that nobody chased
**Angle:** pain/problem
**Reach ★★★☆☆ · Leads ★★★☆☆ · Persona:** H&S manager, contractor owner

Someone spots it, photographs it, notes it. Then what? Most systems record the finding and lose the follow-up.

**Evidence:** `geoPhotoActions.js`, `IncidentActionTracker.jsx`, git d84d5b4
**Formats:** LinkedIn text · IG static

---

### 14. Which way was the camera pointing?
**Angle:** surprising detail
**Reach ★★★☆☆ · Leads ★★★☆☆ · Persona:** surveyor

A photo of a chamber is useless in six months if nobody knows where you were standing or which way you were facing. Bearing captured, ground coverage measured, plotted on a map.

**Evidence:** `GeoPhotoDirectionMap.jsx`, `GeoPhotoAreaPanel.jsx`, `geoPhotoMobilisation.geoPhotoGroupCoverage`, git 16aa67b, 861a06a
**Formats:** IG Reel · diagram

---

### 15. The GPS said 40 metres and the app said so
**Angle:** trust / build in public
**Reach ★★★☆☆ · Leads ★★☆☆☆ · Persona:** surveyor

Phones lie about accuracy. The app now warns you when the fix is coarse instead of silently recording a position that is wrong.

**Evidence:** `isCoarseGpsAccuracy`, git f9132eb
**Formats:** LinkedIn build-in-public
**Why it works:** admitting a limitation builds more credibility than claiming precision.

---

## Tier 3 — Good rotation material

### 16. A GPR anomaly becomes a PAS 128 card by itself
**Evidence:** `surveyGprBridge.js` · **Persona:** survey owner · Reach ★★★☆☆ · Leads ★★★★☆

### 17. What goes in a client handover pack
**Evidence:** `surveyHandoverPack.js` — PDF, HTML, CSV schedules, CAD sidecar, verify sheet, README, A3 board pack, QR client pack · **Persona:** survey owner · Reach ★★★☆☆ · Leads ★★★★☆

### 18. Induction by QR code
**Evidence:** `QRInduction.jsx` · **Persona:** contractor owner · Reach ★★★☆☆ · Leads ★★★☆☆

### 19. The subcontractor portal — their documents, kept current by them
**Evidence:** `SubcontractorPortal.jsx`, `?subcontractor=TOKEN` · **Persona:** contractor owner · Reach ★★★☆☆ · Leads ★★★★☆

### 20. Building for an 11-inch tablet with gloves on
**Angle:** build in public / lessons learned
**Evidence:** git 6b98eeb, c7635da (Lenovo tablet tuning, iPad/Android hardening) · Reach ★★★☆☆ · Leads ★★☆☆☆
Good honest post about designing for the actual device people hold, not the one on your desk.

### 21. The feature that looked simple and wasn't
**Angle:** lessons learned
**Evidence:** git 471813d "Stop the geo-photo sync loop that flickered the screen and ate photos", 738c271 (PWA camera loss + R2 401) · Reach ★★★★☆ · Leads ★★☆☆☆
A bug that ate users' photos is a genuinely strong build-in-public post. Honest, technical, memorable.

### 22. Where I think utility survey goes in five years
**Angle:** industry opinion
**Reach ★★★★☆ · Leads ★★☆☆☆ · Persona:** survey owner
Opinion piece. High comment potential, low direct lead value. Use for reach and authority. Ground it in what the product already does rather than speculation.

---

## Ideas deliberately excluded

- **AI RAMS / toolbox / photo hazard as a shipped feature.** The routes are hidden pending prebuilt packs (`workspaceViews.js`). Usable as *build-in-public* ("here's what I'm building"), never as a feature announcement.
- **Any time-saving statistic.** No measured data exists. Every efficiency claim must be framed as a question or a personal observation.
- **Any customer name or case study.** Not until someone gives permission and real numbers.
- **Survey-grade accuracy claims for geo-photos.** ±5 m, stated in the code.
