# DACH market brief — DE / AT / CH vs UK RAMS & permits

Last updated: 2026-08-21. Product guidance for MySafeOps German-speaking expansion.
Not legal advice — confirm against current statutes before claiming compliance.

## One-line rule

Same language ≠ same law. Ship **Germany first**, then fork **Austria (BauKG)** and **Switzerland (BauAV / CHF)**. Never sell “DACH pack” with only German BaustellV text.

## Document equivalents (what buyers ask for)

| UK (MySafeOps today) | Germany (DE) | Austria (AT) | Switzerland (CH) |
|---|---|---|---|
| RAMS | **GBU** (Gefährdungsbeurteilung, ArbSchG § 5) + **Betriebsanweisung** | **Evaluierung** (ASchG §§ 4–5) + Arbeitsanweisung | **Gefährdungsermittlung** + **Sicherheits- und Gesundheitsschutzkonzept (SiKo)** BauAV Art. 4 |
| CDM Construction Phase Plan / F10 | **SiGe-Plan** + **Vorankündigung** (BaustellV) + **SiGeKo** | **SiGe-Plan** + **Vorankündigung** (BauKG) + Baustellenkoordinator | No CDM twin — per-employer **SiKo**; coordination via Bauleitung / contractor duties |
| Permit to work | **Erlaubnisschein / Freigabe** (company system; BetrSichV / Anhang II practice) | **Arbeitsfreigabe** for besondere Gefahren | **Arbeitsfreigabe** / Freigabesystem; Suva guidance; some asbestos work needs Suva recognition |
| RIDDOR | **Unfallanzeige** to UVT (**BG BAU** etc.), SGB VII | **AUVA** Unfallmeldung | **Suva** Unfallmeldung |
| CSCS / SSSTS | **SCC/SCP**, **Sifa**, **SiGeKo** (RAB 30), Ersthelfer | Präventivfachkräfte, SVP, BauKG-Koordinator | EKAS Branchenlösung, designated site safety person (BauAV) |
| COSHH | **GefStoffV** + Betriebsanweisung | Gefahrstoffe under ASchG / BauV | Suva Stoffdaten / BauAV hazardous-substance duties |
| Emergency 999 | **112** | **112** | **112** / 144 (ambulance) |

### Germany — what “counts” as PTW culture

There is no single federal “Permit to Work Act”. Practice on site:

1. Employer **GBU** for the task (always).
2. **SiGe-Plan** when multiple employers + (Vorankündigung **or** Anhang II dangerous works).
3. Written **Erlaubnisschein** / Freigabe for high-risk tasks (hot work, confined space, electrical isolation, roof/fall, excavation) — buyers recognise this like UK PTW.
4. **Anhang II BaustellV** is the sales trigger: if those works appear, SiGe-Plan content must name concrete measures — vague “Vorsicht Absturz” is not enough.

Vorankündigung thresholds (aligned with EU Dir. 92/57, same shape as UK F10):

- \> 30 Arbeitstage **and** \> 20 Beschäftigte simultaneously, **or**
- \> 500 Personentage.

### Austria — close to DE, different statute names

- **BauKG** = coordination act (SiGe-Plan, Vorankündigung, Koordinator).
- Task-level risk = **Evaluierung** under **ASchG**, not “GBU” as a brand word (though Germans understand it).
- Small single-employer sites without Vorankündigung can treat written Evaluierung measures as SiGe-Plan equivalent (§ 7 Abs. 6a BauKG) — product should not force a full multi-employer pack.
- Regulator / insurer: **Arbeitsinspektion** + **AUVA**.

### Switzerland — different product story

- **BauAV 2022** (effective 1 Jan 2022): every site needs a written **SiKo** before start (Art. 4), including emergency organisation.
- Suva enforces; premium increases / site stop possible.
- No UK-style CDM principal designer/contractor roles in the same form.
- Currency **CHF**, privacy **nFADP** — billing and legal pages must not reuse DE EUR / DSGVO-only copy.
- Ship **after** DE (+ optionally AT): reuse German UI strings, swap legislation + SiKo module + CHF Stripe.

## Product mapping in MySafeOps

| Module | DE (live beta) | AT (live beta) | CH (planned) |
|---|---|---|---|
| RAMS builder | Label **GBU** | Label **Evaluierung** (reuse DE templates) | Label **SiKo / Gefährdung** |
| Compliance pack | **sige-plan** (BaustellV) | **sige-plan** shared module + BauKG content | **siko** (BauAV Art. 4) |
| Permits | Erlaubnisscheine + Anhang II links | Same UI, AT/BauKG labels | Freigabe + Suva asbestos flags |
| Notifiable incidents | BG / UVT worksheet | AUVA worksheet | Suva worksheet |
| Certs | SCC, SiGeKo, Sifa, Ersthelfer | Shared DE cert library | EKAS / Fachkundige Person |
| Locale / money | de-DE / EUR | de-AT / EUR (shared Stripe `_EUR`) | de-CH / CHF |

## What persuades them to subscribe

### Pain (use in DE landing / LinkedIn / sales)

1. **SiGe-Plan in Word** — outdated after every Gewerk change; SiGeKo weekends lost.
2. **Nachunternehmer** arrive without GBU / Freigabe; site start delayed.
3. **BG / Kontrolle** asks for Unterweisung, Erlaubnisschein, Prüfungen — evidence scattered in WhatsApp + Excel.
4. **Anhang II** jobs (roof, demolition, confined space, hot work) need named measures and a live Freigabe status, not a PDF from last year.
5. Field teams need **offline** on deep sites / basements.

### Hooks that convert (German plain speech)

- “GBU und Erlaubnisschein in einem Arbeitsbereich — Status live auf der Baustelle.”
- “SiGe-Plan mit Anhang-II-Checkliste, nicht nur Überschrift.”
- “Fester Org-Preis in Euro — nicht pro Sitzplatz.”
- “14 Tage volle Evaluation, keine Karte zum Anschauen.”
- “Österreich und Schweiz: eigene Rechtsräume — wir vermischen BaustellV nicht mit BauKG/BauAV.”

### Offer structure

| Stage | Offer |
|---|---|
| Trial | 14 days + one +14 extension (same as UK/PL) |
| Solo | Freelancer / one site — GBU + Freigabe |
| Team | Small contractor — SiGe-Plan + Nachunternehmer invites |
| Business | Multi-site + audit trail (BG-ready export story) |
| Enterprise | Group MI, custom domain, named support |

Anchor pricing vs time: one avoided delayed start or one afternoon saved for SiGeKo often pays a month of Team.

### Do not claim

- That MySafeOps files Vorankündigung / Unfallanzeige to the authority.
- That DE templates satisfy AT BauKG or CH BauAV without a market fork.
- Invented statistics (“X% fewer accidents”).

## Build order

1. **DE beta** (done): market, GBU labels, SiGe-Plan, Erlaubnisscheine, BG incidents, EUR price table, `/de` landing.
2. **DE conversion**: Anhang II catalogue in product + landing FAQ “Was ist das deutsche RAMS?” + Stripe `*_EUR`.
3. **AT fork (done as beta)**: BauKG SiGe copy, AUVA incidents, Evaluierung label, shared EUR Stripe with DE.
4. **CH**: BauAV SiKo + Suva + CHF after DE/AT conversion.
4. **CH fork**: SiKo module, Suva incidents, CHF Stripe, nFADP legal pages.

## Official starting points

- DE BaustellV: https://www.gesetze-im-internet.de/baustellv/
- DE BAuA BaustellV hub: https://www.baua.de/DE/Themen/Arbeitsgestaltung/Arbeitsstaetten/Bauwirtschaft/Baustellenverordnung.html
- AT BauKG: https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009146
- AT SiGe-Plan (Arbeitsinspektion): https://www.arbeitsinspektion.gv.at/Branchen/Branchen/Sicherheits-_und_Gesundheitsschutzplan.html
- CH BauAV: https://www.fedlex.admin.ch/eli/cc/2021/384/de
- Suva BauAV materials: search “BauAV 2022 Suva”
