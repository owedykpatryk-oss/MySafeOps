/** @typedef {import("../config/markets").MarketId} MarketId */

import { AU_PLAN_PRICE_LABELS } from "../config/auPricing";
import { PL_PLAN_PRICE_LABELS } from "../config/plPricing";
import { DE_PLAN_PRICE_LABELS } from "../config/dePricing";
import { AT_PLAN_PRICE_LABELS } from "../config/atPricing";
import { CH_PLAN_PRICE_LABELS } from "../config/chPricing";
import { getMarketLabelPack } from "../config/marketLabelPacks";

/** @typedef {{ price: string; suffix?: string; subtitle: string; tag: string; features: string[] }} LandingPricingTier */

/** @type {Record<MarketId, {
 *   title: string;
 *   description: string;
 *   heroBadge: string;
 *   heroLeadFull: string;
 *   heroLeadShort: string;
 *   trustPills: string[];
 *   ramsLabel: string;
 *   footerBlurb: string;
 *   complianceBadge: string;
 *   complianceTitle: string;
 *   complianceIntro: string;
 *   complianceBadgeCode: string;
 *   complianceItems: [string, string][];
 *   pricingFootnote: string;
 *   pricingDisclaimer: string;
 *   incidentFeature: string;
 *   faqLegalRef: string;
 *   faqRegulator: string;
 *   roiDefaultRate: number;
 *   pricing: {
 *     trial: LandingPricingTier;
 *     starter: LandingPricingTier;
 *     team: LandingPricingTier;
 *     business: LandingPricingTier;
 *     enterprise: LandingPricingTier;
 *     enterprisePlus: LandingPricingTier;
 *   };
 * }>} */
export const LANDING_MARKET_CONTENT = {
  uk: {
    title: "MySafeOps — RAMS, permits & site safety for UK construction & surveying",
    description:
      "RAMS quick packs, permits to work, PAS128 survey workflows, geo evidence and 40+ registers — browser-first for UK construction, utilities and surveying teams. Flat organisation pricing. 14-day full evaluation.",
    heroBadge: "🇬🇧 UK site teams — construction to survey",
    heroLeadFull:
      "RAMS quick packs, permits, PAS128 survey workflows, geo evidence and hygiene registers — one workspace tuned to your trade. Offline-first core",
    heroLeadShort: "RAMS packs, PAS128 surveys, permits and registers — one workspace for your trade. Offline-first",
    trustPills: ["Offline-capable", "UK registers", "Flat org pricing", "Optional cloud backup"],
    ramsLabel: "RAMS quick packs",
    footerBlurb: "Construction safety workspace for UK sites — RAMS, permits, registers, and evidence in one place.",
    complianceBadge: "UK-focused",
    complianceTitle: "Built for practical compliance evidence",
    complianceIntro:
      "Use MySafeOps to organise site safety records — not as a substitute for legal advice or statutory reporting obligations.",
    complianceBadgeCode: "UK",
    complianceItems: [
      ["CDM 2015", "Construction (Design & Management) Regulations — structured site records and responsibilities."],
      ["HASAWA 1974", "Health and Safety at Work Act — consistent day-to-day controls and evidence trails."],
      ["Work at height", "Plan controls, briefings, and inspections with traceable records."],
      ["Equipment & lifting", "Keep inspection discipline visible — PAT, plant, lifting accessories (as your workflows require)."],
      ["COSHH", "Manage substance records and practical controls alongside site activity."],
      ["RIDDOR", "Support timely internal reporting workflows — follow HSE guidance for statutory reporting."],
    ],
    pricingFootnote:
      "Includes a 14-day evaluation in-product when you sign in (optional +14 day extension once). After trial, subscribe to keep editing — existing data stays viewable and exportable. Not legal advice — always follow your site rules and UK requirements.",
    pricingDisclaimer: "Terms §7.5",
    incidentFeature: "Near misses, injuries, RIDDOR paths. Capture evidence fast and keep follow-up visible.",
    faqLegalRef: "HSE reporting",
    faqRegulator: "RIDDOR",
    roiDefaultRate: 28,
    pricing: {
      trial: { price: "£0", subtitle: "14 days · all modules", tag: "👷 Try before you buy", features: ["Full module library during trial", "One free +14 day extension", "Then subscribe from Solo"] },
      starter: { price: "£19", suffix: "/mo", subtitle: "5 workers · 100 projects · 2GB", tag: "👷 Freelancer / single site", features: ["Full module library", "Cloud backup (when configured)", "Email support"] },
      team: { price: "£109", suffix: "/mo", subtitle: "20 workers · 500 projects · 10GB", tag: "👷 Small contractor", features: ["Full module library", "Invites & role management", "Priority support", "Multi-supervisor sites"] },
      business: { price: "£319", suffix: "/mo", subtitle: "75 workers · 2,500 projects · 50GB", tag: "👷 Multi-site governance", features: ["Tamper-evident audit log", "Dedicated onboarding", "Higher operational headroom"] },
      enterprise: { price: "£649", suffix: "/mo", subtitle: "200 workers · 10,000 projects · 200GB", tag: "👷 Group operations", features: ["Custom subdomain", "Group MI dashboard", "SLA & named support"] },
      enterprisePlus: { price: "Let's talk", subtitle: "150+ people · custom SLA", tag: "👷 Post-acquisition scale", features: ["Unlimited workers & projects", "Custom integrations", "Dedicated account manager"] },
    },
  },
  au: {
    title: "MySafeOps — SWMS, permits & site safety for Australian construction",
    description:
      "SWMS and RAMS packs, permits to work, WHS registers and geo evidence — browser-first for Australian construction, civil and industrial site teams. Flat organisation pricing in AUD. 14-day full evaluation.",
    heroBadge: "🇦🇺 Australian site teams — construction & civil",
    heroLeadFull:
      "SWMS packs, permits to work, WHS registers and geo evidence — one workspace tuned to Australian construction and civil trades. Offline-first core",
    heroLeadShort: "SWMS packs, permits and WHS registers — one workspace for your trade. Offline-first",
    trustPills: ["Offline-capable", "WHS registers", "Flat org pricing", "Optional cloud backup"],
    ramsLabel: "SWMS & RAMS packs",
    footerBlurb: "Construction safety workspace for Australian sites — SWMS, permits, registers, and evidence in one place.",
    complianceBadge: "Australia-focused",
    complianceTitle: "Built for practical WHS evidence",
    complianceIntro:
      "Use MySafeOps to organise site safety records aligned with model WHS laws — not as a substitute for legal advice or state regulator reporting.",
    complianceBadgeCode: "AU",
    complianceItems: [
      ["WHS Act 2011", "Model Work Health and Safety Act — PCBU duties, consultation, and reasonably practicable controls."],
      ["SWMS", "Safe Work Method Statements for high-risk construction work — structured templates and sign-off trails."],
      ["Permits to work", "Hot work, height, confined space, isolation and excavation — live status on site."],
      ["Plant & equipment", "Pre-starts, inspections and maintenance records visible to supervisors."],
      ["Notifiable incidents", "Support internal reporting workflows — follow your state regulator for statutory notification."],
      ["White Card", "Track construction induction and competency alongside site records."],
    ],
    pricingFootnote:
      "Includes a 14-day evaluation in-product when you sign in (optional +14 day extension once). After trial, subscribe to keep editing — existing data stays viewable and exportable. Prices in AUD ex GST unless stated. Not legal advice — follow your site rules and state WHS requirements.",
    pricingDisclaimer: "Terms §7.5",
    incidentFeature: "Near misses, injuries and notifiable incident paths. Capture evidence fast and keep follow-up visible.",
    faqLegalRef: "regulator reporting",
    faqRegulator: "notifiable incidents",
    roiDefaultRate: 45,
    pricing: {
      trial: { price: AU_PLAN_PRICE_LABELS.trial, subtitle: "14 days · all modules", tag: "👷 Try before you buy", features: ["Full module library during trial", "One free +14 day extension", "Then subscribe from Solo"] },
      starter: { price: AU_PLAN_PRICE_LABELS.starter, suffix: "/mo", subtitle: "5 workers · 100 projects · 2GB", tag: "👷 Freelancer / single site", features: ["Full module library", "Cloud backup (when configured)", "Email support"] },
      team: { price: AU_PLAN_PRICE_LABELS.team, suffix: "/mo", subtitle: "20 workers · 500 projects · 10GB", tag: "👷 Small contractor", features: ["Full module library", "Invites & role management", "Priority support", "Multi-supervisor sites"] },
      business: { price: AU_PLAN_PRICE_LABELS.business, suffix: "/mo", subtitle: "75 workers · 2,500 projects · 50GB", tag: "👷 Multi-site governance", features: ["Tamper-evident audit log", "Dedicated onboarding", "Higher operational headroom"] },
      enterprise: { price: AU_PLAN_PRICE_LABELS.enterprise, suffix: "/mo", subtitle: "200 workers · 10,000 projects · 200GB", tag: "👷 Group operations", features: ["Custom subdomain", "Group MI dashboard", "SLA & named support"] },
      enterprisePlus: { price: "Let's talk", subtitle: "150+ people · custom SLA", tag: "👷 Post-acquisition scale", features: ["Unlimited workers & projects", "Custom integrations", "Dedicated account manager"] },
    },
  },
  pl: {
    title: "MySafeOps — IBWR, pozwolenia na pracę i BHP dla budownictwa w Polsce",
    description:
      "Pakiety IBWR, pozwolenia na pracę, rejestry BHP i dowody z terenu — w przeglądarce, dla polskich firm budowlanych i instalacyjnych. Stała cena za organizację w PLN. 14 dni pełnej ewaluacji.",
    heroBadge: "🇵🇱 Polskie ekipy budowlane i instalacyjne",
    heroLeadFull:
      "Pakiety IBWR, pozwolenia na pracę, plany BIOZ i rejestry — jedno środowisko pod polskie budowy. Rdzeń offline",
    heroLeadShort: "IBWR, PTW i rejestry BHP — jedno środowisko dla Twojej budowy. Offline",
    trustPills: ["Działa offline", "Rejestry BHP", "Stała cena org", "Opcjonalna kopia w chmurze"],
    ramsLabel: "Pakiety IBWR",
    footerBlurb: "BHP na budowie — IBWR, pozwolenia, rejestry i dowody w jednym miejscu.",
    complianceBadge: "Polska",
    complianceTitle: "Dowody BHP na co dzień",
    complianceIntro:
      "MySafeOps porządkuje dokumentację BHP — nie zastępuje porady prawnej ani zgłoszeń do PIP.",
    complianceBadgeCode: "PL",
    complianceItems: [
      ["Kodeks pracy", "Obowiązki pracodawcy, ocena ryzyka, szkolenia BHP."],
      ["IBWR", "Instrukcja bezpiecznego wykonywania robót — szablony i ścieżka zatwierdzenia."],
      ["Pozwolenia na pracę", "Prace szczególnie niebezpieczne — status na budowie."],
      ["Plan BIOZ", "Plan dla inwestycji budowlanej i koordynacja podwykonawców."],
      ["Zdarzenia PIP", "Wsparcie wewnętrznego raportowania — zgłoszenia ustawowe po Twojej stronie."],
      ["Uprawnienia", "UDT, SEP, szkolenia BHP przy rejestrze pracowników."],
    ],
    pricingFootnote:
      "14 dni ewaluacji po zalogowaniu (+14 dni przedłużenia raz). Po trialu subskrypcja — dane do podglądu i eksportu zostają. Ceny w PLN netto. To nie porada prawna.",
    pricingDisclaimer: "Regulamin §7.5",
    incidentFeature: "Zdarzenia, urazy, ścieżki PIP — szybki zapis i follow-up.",
    faqLegalRef: "zgłoszenia PIP",
    faqRegulator: "PIP",
    roiDefaultRate: 55,
    pricing: {
      trial: { price: PL_PLAN_PRICE_LABELS.trial, subtitle: "14 dni · wszystkie moduły", tag: "👷 Wypróbuj", features: ["Pełna biblioteka w trialu", "Jedno przedłużenie +14 dni", "Potem subskrypcja od Solo"] },
      starter: { price: PL_PLAN_PRICE_LABELS.starter, suffix: "/mies.", subtitle: "5 pracowników · 100 projektów · 2GB", tag: "👷 Freelancer / jedna budowa", features: ["Pełna biblioteka", "Kopia w chmurze (gdy skonfigurowana)", "Wsparcie e-mail"] },
      team: { price: PL_PLAN_PRICE_LABELS.team, suffix: "/mies.", subtitle: "20 pracowników · 500 projektów · 10GB", tag: "👷 Mały wykonawca", features: ["Zaproszenia i role", "Wsparcie priorytetowe", "Wiele brygad"] },
      business: { price: PL_PLAN_PRICE_LABELS.business, suffix: "/mies.", subtitle: "75 pracowników · 2 500 projektów · 50GB", tag: "👷 Wiele budów", features: ["Audyt", "Onboarding", "Większe limity"] },
      enterprise: { price: PL_PLAN_PRICE_LABELS.enterprise, suffix: "/mies.", subtitle: "200 pracowników · 10 000 projektów · 200GB", tag: "👷 Grupa kapitałowa", features: ["Subdomena", "Dashboard grupy", "SLA"] },
      enterprisePlus: { price: "Porozmawiajmy", subtitle: "150+ osób · SLA", tag: "👷 Skala korporacyjna", features: ["Nielimitowani pracownicy", "Integracje", "Opiekun konta"] },
    },
  },
  de: {
    title: "MySafeOps — GBU, Erlaubnisscheine und Arbeitsschutz für das deutsche Baugewerbe",
    description:
      "GBU-Schnellpakete, Erlaubnisscheine, SiGe-Plan und Nachweise — im Browser, für Bau- und Ausbauunternehmen in Deutschland. Fester Organisationspreis in EUR. 14 Tage volle Evaluation.",
    heroBadge: "🇩🇪 Deutsche Bauteams — Hochbau bis Tiefbau",
    heroLeadFull:
      "GBU-Pakete, Erlaubnisscheine, SiGe-Plan und Register — ein Arbeitsbereich für deutsche Baustellen. Offline-Kern",
    heroLeadShort: "GBU, Erlaubnisscheine und Register — ein Arbeitsbereich für Ihre Baustelle. Offline",
    trustPills: ["Offline-fähig", "Arbeitsschutz-Register", "Fester Org-Preis", "Optionale Cloud-Sicherung"],
    ramsLabel: "GBU-Schnellpakete",
    footerBlurb: "Arbeitsschutz auf der Baustelle — GBU, Erlaubnisscheine, Register und Nachweise an einem Ort.",
    complianceBadge: "Deutschland",
    complianceTitle: "Nachweise für den Alltag auf der Baustelle",
    complianceIntro:
      "MySafeOps ordnet Arbeitsschutzunterlagen — es ersetzt keine Rechtsberatung und keine gesetzlichen Meldungen.",
    complianceBadgeCode: "DE",
    complianceItems: [
      ["ArbSchG § 5", "GBU — das deutsche Pendant zu RAMS: Gefährdung, Maßnahmen, Unterweisung."],
      ["BaustellV / SiGe-Plan", "Koordination mehrerer Arbeitgeber, SiGeKo, Vorankündigung."],
      ["Anhang II", "Besonders gefährliche Arbeiten — benannte Maßnahmen, oft mit Erlaubnisschein."],
      ["Erlaubnisscheine", "Freigabe wie UK Permit to Work: Heißarbeiten, Absturz, enge Räume, Elektro."],
      ["Unfallanzeige", "Interne Erfassung — gesetzliche Meldung bleibt beim UVT / BG BAU."],
      ["Qualifikation", "SCC, SiGeKo, Sifa, Ersthelfer im Beschäftigtenregister."],
    ],
    pricingFootnote:
      "14 Tage Evaluation (einmal +14 Tage). Danach Abo — Daten bleiben lesbar und exportierbar. Fester Org-Preis in EUR netto (19 % MwSt. bei Stripe). Ein vermiedener Startstopp oder ein gesparter SiGeKo-Nachmittag deckt oft einen Monatsbeitrag. Keine Rechtsberatung. AT (BauKG) und CH (BauAV) folgen als eigene Rechtsräume.",
    pricingDisclaimer: "AGB §7.5",
    incidentFeature: "Ereignisse, Verletzungen, Pfad zur Unfallanzeige — schnell erfassen und nachverfolgen.",
    faqLegalRef: "Unfallanzeige",
    faqRegulator: "BG BAU",
    roiDefaultRate: 45,
    pricing: {
      trial: { price: DE_PLAN_PRICE_LABELS.trial, subtitle: "14 Tage · alle Module", tag: "👷 Testen", features: ["Volle Bibliothek im Trial", "Eine Verlängerung +14 Tage", "Danach Abo ab Solo"] },
      starter: { price: DE_PLAN_PRICE_LABELS.starter, suffix: "/Monat", subtitle: "5 Beschäftigte · 100 Projekte · 2GB", tag: "👷 Einzelunternehmen / eine Baustelle", features: ["Volle Bibliothek", "Cloud-Sicherung (wenn eingerichtet)", "E-Mail-Support"] },
      team: { price: DE_PLAN_PRICE_LABELS.team, suffix: "/Monat", subtitle: "20 Beschäftigte · 500 Projekte · 10GB", tag: "👷 Kleiner Auftragnehmer", features: ["Einladungen und Rollen", "Priorisierter Support", "Mehrere Kolonnen"] },
      business: { price: DE_PLAN_PRICE_LABELS.business, suffix: "/Monat", subtitle: "75 Beschäftigte · 2.500 Projekte · 50GB", tag: "👷 Mehrere Baustellen", features: ["Audit", "Onboarding", "Höhere Limits"] },
      enterprise: { price: DE_PLAN_PRICE_LABELS.enterprise, suffix: "/Monat", subtitle: "200 Beschäftigte · 10.000 Projekte · 200GB", tag: "👷 Unternehmensgruppe", features: ["Subdomain", "Gruppen-Dashboard", "SLA"] },
      enterprisePlus: { price: "Sprechen wir", subtitle: "150+ Personen · SLA", tag: "👷 Konzernmaßstab", features: ["Unbegrenzte Beschäftigte", "Integrationen", "Betreuer"] },
    },
  },
  at: {
    title: "MySafeOps — Evaluierung, Erlaubnisscheine und Arbeitsschutz für Österreich",
    description:
      "Evaluierungs-Schnellpakete, Erlaubnisscheine, SiGe-Plan (BauKG) und Nachweise — im Browser, für Bauunternehmen in Österreich. Fester Organisationspreis in EUR. 14 Tage volle Evaluation.",
    heroBadge: "🇦🇹 Österreichische Bauteams — Hochbau bis Tiefbau",
    heroLeadFull:
      "Evaluierung, Erlaubnisscheine, SiGe-Plan (BauKG) und Register — ein Arbeitsbereich für österreichische Baustellen. Offline-Kern",
    heroLeadShort: "Evaluierung, Erlaubnisscheine und Register — ein Arbeitsbereich für Ihre Baustelle. Offline",
    trustPills: ["Offline-fähig", "Arbeitsschutz-Register", "Fester Org-Preis", "Optionale Cloud-Sicherung"],
    ramsLabel: "Evaluierungs-Schnellpakete",
    footerBlurb: "Arbeitsschutz auf der Baustelle — Evaluierung, Erlaubnisscheine, Register und Nachweise an einem Ort.",
    complianceBadge: "Österreich",
    complianceTitle: "Nachweise für den Alltag auf der Baustelle",
    complianceIntro:
      "MySafeOps ordnet Arbeitsschutzunterlagen — es ersetzt keine Rechtsberatung und keine gesetzlichen Meldungen.",
    complianceBadgeCode: "AT",
    complianceItems: [
      ["ASchG", "Evaluierung — das österreichische Pendant zu RAMS: Gefahren, Maßnahmen, Unterweisung."],
      ["BauKG / SiGe-Plan", "Koordination mehrerer Arbeitgeber, SiGeKo, Vorankündigung."],
      ["Besonders gefährlich", "Arbeiten mit hohem Risiko — benannte Maßnahmen, oft mit Arbeitsfreigabe."],
      ["Erlaubnisscheine", "Freigabe wie UK Permit to Work: Heißarbeiten, Absturz, enge Räume, Elektro."],
      ["Unfallanzeige", "Interne Erfassung — gesetzliche Meldung bleibt bei der AUVA."],
      ["Qualifikation", "BauKG-Koordinator, Sicherheitsfachkraft, Ersthelfer im Beschäftigtenregister."],
    ],
    pricingFootnote:
      "14 Tage Evaluation (einmal +14 Tage). Danach Abo — Daten bleiben lesbar und exportierbar. Fester Org-Preis in EUR netto (20 % USt. bei Stripe). Ein vermiedener Startstopp oder ein gesparter SiGeKo-Nachmittag deckt oft einen Monatsbeitrag. Keine Rechtsberatung. Deutschland (BaustellV) und die Schweiz (BauAV) sind eigene Rechtsräume.",
    pricingDisclaimer: "AGB §7.5",
    incidentFeature: "Ereignisse, Verletzungen, Pfad zur Unfallanzeige — schnell erfassen und nachverfolgen.",
    faqLegalRef: "Unfallanzeige",
    faqRegulator: "AUVA",
    roiDefaultRate: 45,
    pricing: {
      trial: { price: AT_PLAN_PRICE_LABELS.trial, subtitle: "14 Tage · alle Module", tag: "👷 Testen", features: ["Volle Bibliothek im Trial", "Eine Verlängerung +14 Tage", "Danach Abo ab Solo"] },
      starter: { price: AT_PLAN_PRICE_LABELS.starter, suffix: "/Monat", subtitle: "5 Beschäftigte · 100 Projekte · 2GB", tag: "👷 Einzelunternehmen / eine Baustelle", features: ["Volle Bibliothek", "Cloud-Sicherung (wenn eingerichtet)", "E-Mail-Support"] },
      team: { price: AT_PLAN_PRICE_LABELS.team, suffix: "/Monat", subtitle: "20 Beschäftigte · 500 Projekte · 10GB", tag: "👷 Kleiner Auftragnehmer", features: ["Einladungen und Rollen", "Priorisierter Support", "Mehrere Kolonnen"] },
      business: { price: AT_PLAN_PRICE_LABELS.business, suffix: "/Monat", subtitle: "75 Beschäftigte · 2.500 Projekte · 50GB", tag: "👷 Mehrere Baustellen", features: ["Audit", "Onboarding", "Höhere Limits"] },
      enterprise: { price: AT_PLAN_PRICE_LABELS.enterprise, suffix: "/Monat", subtitle: "200 Beschäftigte · 10.000 Projekte · 200GB", tag: "👷 Unternehmensgruppe", features: ["Subdomain", "Gruppen-Dashboard", "SLA"] },
      enterprisePlus: { price: "Sprechen wir", subtitle: "150+ Personen · SLA", tag: "👷 Konzernmaßstab", features: ["Unbegrenzte Beschäftigte", "Integrationen", "Betreuer"] },
    },
  },
  ch: {
    title: "MySafeOps — SiKo, Freigaben und Arbeitssicherheit für die Schweiz",
    description:
      "Gefährdungsermittlungs-Schnellpakete, Freigaben, SiKo (BauAV Art. 4) und Nachweise — im Browser, für Bauunternehmen in der Schweiz. Fester Organisationspreis in CHF. 14 Tage volle Evaluation.",
    heroBadge: "🇨🇭 Schweizer Bauteams — Hochbau bis Tiefbau",
    heroLeadFull:
      "Gefährdungsermittlung, Freigaben, SiKo (BauAV) und Register — ein Arbeitsbereich für Schweizer Baustellen. Offline-Kern",
    heroLeadShort: "Gefährdungsermittlung, Freigaben und Register — ein Arbeitsbereich für Ihre Baustelle. Offline",
    trustPills: ["Offline-fähig", "Arbeitssicherheits-Register", "Fester Org-Preis", "Optionale Cloud-Sicherung"],
    ramsLabel: "Gefährdungsermittlungs-Schnellpakete",
    footerBlurb: "Arbeitssicherheit auf der Baustelle — Gefährdungsermittlung, Freigaben, Register und Nachweise an einem Ort.",
    complianceBadge: "Schweiz",
    complianceTitle: "Nachweise für den Alltag auf der Baustelle",
    complianceIntro:
      "MySafeOps ordnet Arbeitssicherheitsunterlagen — es ersetzt keine Rechtsberatung und keine gesetzlichen Meldungen.",
    complianceBadgeCode: "CH",
    complianceItems: [
      ["ArG / ArGV", "Gesundheitsschutz und Arbeitszeit — Grundlage für die Baustellenorganisation."],
      ["BauAV / SiKo", "Sicherheits- und Gesundheitsschutzkonzept vor Baubeginn, inkl. Notfallorganisation (Art. 4)."],
      ["Besonders gefährlich", "Arbeiten mit hohem Risiko — benannte Massnahmen, oft mit Freigabe."],
      ["Freigaben", "Wie UK Permit to Work: Heissarbeiten, Absturz, enge Räume, Elektro."],
      ["Unfallmeldung", "Interne Erfassung — gesetzliche Meldung bleibt bei der Suva."],
      ["Qualifikation", "Sicherheitsbeauftragter, Suva-anerkannte Fachperson, Ersthelfer im Beschäftigtenregister."],
    ],
    pricingFootnote:
      "14 Tage Evaluation (einmal +14 Tage). Danach Abo — Daten bleiben lesbar und exportierbar. Fester Org-Preis in CHF netto (8.1 % MWST bei Stripe). Ein vermiedenes SiKo-Nacharbeiten oder ein gesparter Suva-Kontrollnachmittag deckt oft einen Monatsbeitrag. Keine Rechtsberatung. Deutschland (BaustellV) und Österreich (BauKG) sind eigene Rechtsräume — wir vermischen sie nicht mit der BauAV.",
    pricingDisclaimer: "AGB §7.5",
    incidentFeature: "Ereignisse, Verletzungen, Pfad zur Unfallmeldung — schnell erfassen und nachverfolgen.",
    faqLegalRef: "Unfallmeldung",
    faqRegulator: "Suva",
    roiDefaultRate: 45,
    pricing: {
      trial: { price: CH_PLAN_PRICE_LABELS.trial, subtitle: "14 Tage · alle Module", tag: "👷 Testen", features: ["Volle Bibliothek im Trial", "Eine Verlängerung +14 Tage", "Danach Abo ab Solo"] },
      starter: { price: CH_PLAN_PRICE_LABELS.starter, suffix: "/Monat", subtitle: "5 Beschäftigte · 100 Projekte · 2GB", tag: "👷 Einzelunternehmen / eine Baustelle", features: ["Volle Bibliothek", "Cloud-Sicherung (wenn eingerichtet)", "E-Mail-Support"] },
      team: { price: CH_PLAN_PRICE_LABELS.team, suffix: "/Monat", subtitle: "20 Beschäftigte · 500 Projekte · 10GB", tag: "👷 Kleiner Auftragnehmer", features: ["Einladungen und Rollen", "Priorisierter Support", "Mehrere Kolonnen"] },
      business: { price: CH_PLAN_PRICE_LABELS.business, suffix: "/Monat", subtitle: "75 Beschäftigte · 2.500 Projekte · 50GB", tag: "👷 Mehrere Baustellen", features: ["Audit", "Onboarding", "Höhere Limits"] },
      enterprise: { price: CH_PLAN_PRICE_LABELS.enterprise, suffix: "/Monat", subtitle: "200 Beschäftigte · 10.000 Projekte · 200GB", tag: "👷 Unternehmensgruppe", features: ["Subdomain", "Gruppen-Dashboard", "SLA"] },
      enterprisePlus: { price: "Sprechen wir", subtitle: "150+ Personen · SLA", tag: "👷 Konzernmaßstab", features: ["Unbegrenzte Beschäftigte", "Integrationen", "Betreuer"] },
    },
  },
};

/** @param {MarketId} marketId */
export function getLandingMarketContent(marketId) {
  return LANDING_MARKET_CONTENT[marketId] ?? LANDING_MARKET_CONTENT.uk;
}

/** @param {MarketId} marketId */
export function getLandingFeatures(marketId) {
  const copy = getLandingMarketContent(marketId);
  const pack = getMarketLabelPack(marketId);
  const deUi = marketId === "de" || marketId === "at" || marketId === "ch";
  const ramsLabel =
    marketId === "pl"
      ? "Kreator IBWR"
      : marketId === "de"
        ? "GBU-Generator"
        : marketId === "at"
          ? "Evaluierungs-Generator"
          : marketId === "ch"
            ? "Gefährdungsermittlungs-Generator"
            : marketId === "au"
              ? "SWMS Builder"
              : "RAMS Builder";
  const ramsDesc =
    marketId === "pl"
      ? "Macierz ryzyka, sugestie zagrożeń i metody pracy. Spójne IBWR do weryfikacji na budowie."
      : marketId === "de"
        ? "Risikomatrix, Gefährdungshinweise und Betriebsanweisungen. Einheitliche GBU zur Prüfung auf der Baustelle."
        : marketId === "at"
          ? "Risikomatrix, Gefährdungshinweise und Betriebsanweisungen. Einheitliche Evaluierung zur Prüfung auf der Baustelle."
          : marketId === "ch"
            ? "Risikomatrix, Gefährdungshinweise und Arbeitsanweisungen. Einheitliche Gefährdungsermittlung zur Prüfung auf der Baustelle."
            : marketId === "au"
              ? "Clickable risk matrix, hazard suggestions, and method statements. Keep SWMS consistent and easy to review."
              : "Clickable risk matrix, hazard suggestions, and method statements. Keep RAMS consistent and easy to review.";
  return [
    { emoji: "⚠️", bg: "rgba(13,148,136,.1)", t: ramsLabel, d: ramsDesc },
    { emoji: "🔥", bg: "rgba(249,115,22,.1)", t: marketId === "pl" ? "Pozwolenia na pracę" : deUi ? "Erlaubnisscheine" : "Permits to Work", d: marketId === "pl" ? "Prace gorące, na wysokości, w przestrzeni zamkniętej, elektryczne i więcej — status na żywo." : deUi ? "Heißarbeiten, Absturz, enge Räume, Elektro — Status live." : "Hot work, height, confined space, electrical, excavation, lifting, and more — with live/expired visibility." },
    { emoji: "🚨", bg: "rgba(239,68,68,.1)", t: marketId === "pl" ? "Zgłaszanie zdarzeń" : deUi ? "Ereignismeldung" : "Incident Reporting", d: copy.incidentFeature },
    { emoji: "👷", bg: "rgba(59,130,246,.1)", t: marketId === "pl" ? "Kompetencje" : deUi ? "Qualifikation" : "Worker competency", d: marketId === "pl" ? pack.competencyHint + " — ważność i przypomnienia." : deUi ? pack.competencyHint + " — Gültigkeit und Erinnerungen." : marketId === "au" ? "White Card, certificates, training matrix, and expiry awareness — so skills stay current on site." : "Certificates, training matrix, and expiry awareness — so skills stay current on site." },
    { emoji: "📊", bg: "rgba(139,92,246,.1)", t: marketId === "pl" ? "Widoczność operacyjna" : deUi ? "Betriebliche Übersicht" : "Operational visibility", d: marketId === "pl" ? "Dashboardy i rejestry pomagają wychwycić luki zanim staną się zdarzeniem." : deUi ? "Dashboards und Register helfen, Lücken zu sehen, bevor daraus ein Ereignis wird." : "Dashboards and registers that help supervisors spot gaps before they become incidents." },
    { emoji: "🗺️", bg: "rgba(34,197,94,.1)", t: marketId === "pl" ? "Plany budowy i zdjęcia" : deUi ? "Lagepläne und Fotos" : "Site plans & photos", d: marketId === "pl" ? "Oznacz zagrożenia, punkty zbiórki i wyłączenia — z dowodami łatwymi do odnalezienia." : deUi ? "Gefahren, Sammelplätze und Sperrzonen markieren — Nachweise später leicht finden." : "Mark hazards, assembly points, and exclusions — with evidence that is easy to find later." },
    { emoji: "📚", bg: "rgba(6,182,212,.1)", t: marketId === "pl" ? "Rejestry" : deUi ? "Register" : "Registers & logs", d: marketId === "pl" ? "Substancje, pożar, odpady, goście, inspekcje — bez chaosu w arkuszach." : deUi ? "Gefahrstoffe, Brandschutz, Abfall, Besucher, Prüfungen — ohne Tabellenchaos." : marketId === "au" ? "Hazardous substances, fire, waste, visitors, inspections — structured records without spreadsheet chaos." : "COSHH, fire, waste, visitors, inspections — structured records without spreadsheet chaos." },
    { emoji: "✅", bg: "rgba(120,113,108,.1)", t: marketId === "pl" ? "Listy kontrolne" : deUi ? "Prüflisten" : "Inspection checklists", d: marketId === "pl" ? "Przed rozpoczęciem, cotygodniowe, urządzenia — odhacz, opisz i dołącz dowód." : deUi ? "Vor Arbeitsbeginn, wöchentlich, Geräte — abhaken, notieren, nachweisen." : "Pre-starts, weekly checks, equipment inspections — tick, note, and evidence in one flow." },
    { emoji: "🚗", bg: "rgba(168,85,247,.1)", t: marketId === "pl" ? "Pojazdy i sprzęt" : deUi ? "Fahrzeuge und Geräte" : "Vehicle & equipment", d: marketId === "pl" ? "Inspekcje, kalibracje i terminy z przypomnieniami zanim coś przegapisz." : deUi ? "Prüfungen, Kalibrierung und Termine mit Erinnerungen, bevor etwas durchrutscht." : "Track inspections, calibration, and key dates with reminders before things slip." },
  ];
}

/** @param {MarketId} marketId */
export function getModuleTicker(marketId) {
  const ramsTag = marketId === "pl" ? "⚠️ IBWR" : marketId === "de" ? "⚠️ GBU" : marketId === "at" ? "⚠️ Evaluierung" : marketId === "ch" ? "⚠️ Gefährdungsermittlung" : marketId === "au" ? "⚠️ SWMS" : "⚠️ RAMS";
  const substTag = marketId === "pl" ? "☠️ Substancje" : marketId === "de" || marketId === "at" || marketId === "ch" ? "☠️ Gefahrstoffe" : marketId === "au" ? "☠️ Hazardous substances" : "☠️ COSHH";
  const liftTag = marketId === "pl" ? "🏋️ Urządzenia" : marketId === "de" || marketId === "at" || marketId === "ch" ? "🏋️ Heben" : marketId === "au" ? "🏋️ Plant & lifting" : "🏋️ LOLER";
  const de = marketId === "de" || marketId === "at" || marketId === "ch";
  const pl = marketId === "pl";
  const base = [
    ramsTag,
    pl ? "🔥 Pozwolenia — prace gorące" : de ? "🔥 Erlaubnisschein Heißarbeiten" : "🔥 Hot Work Permits",
    pl ? "🏗️ Prace na wysokości" : de ? "🏗️ Absturz" : "🏗️ Height Permits",
    pl ? "⛑️ Przestrzeń zamknięta" : de ? "⛑️ Enge Räume" : "⛑️ Confined Space",
    pl ? "⚡ Prace elektryczne" : de ? "⚡ Freischaltung" : "⚡ Electrical PTW",
    pl ? "⛏️ Wykopy" : de ? "⛏️ Aushub" : "⛏️ Excavation PTW",
    pl ? "🏋️ Podnoszenie" : de ? "🏋️ Hebevorgang" : "🏋️ Lifting PTW",
    pl ? "📋 Raporty budowy" : de ? "📋 Baustellenberichte" : "📋 Site Reports",
    pl ? "🚨 Zdarzenia" : de ? "🚨 Ereignisse" : "🚨 Incidents",
    substTag,
    pl ? "🪜 Rejestr rusztowań" : de ? "🪜 Gerüstregister" : "🪜 Scaffold Register",
    liftTag,
    pl ? "🔥 Rejestr pożarowy" : de ? "🔥 Brandschutzlog" : "🔥 Fire Log",
    pl ? "♻️ Rejestr odpadów" : de ? "♻️ Abfallregister" : "♻️ Waste Register",
    pl ? "🧑‍💼 Goście" : de ? "🧑‍💼 Besucher" : "🧑‍💼 Visitors",
    pl ? "✅ Listy kontrolne" : de ? "✅ Prüflisten" : "✅ Checklists",
    pl ? "📊 Macierz szkoleń" : de ? "📊 Unterweisungsmatrix" : "📊 Training Matrix",
    pl ? "🗺️ Plany budowy" : de ? "🗺️ Lagepläne" : "🗺️ Site Plans",
    pl ? "📸 Dowody" : de ? "📸 Nachweise" : "📸 Evidence",
  ];
  if (marketId === "uk") {
    base.push("📐 PAS128 surveys", "🛰️ Geo photos", "🧪 GMP & allergen");
  } else if (marketId === "pl") {
    base.push("🛰️ Geo photos", "📋 Przepisy BHP", "🏗️ Plan BIOZ");
  } else if (marketId === "de" || marketId === "at" || marketId === "ch") {
    base.push("🛰️ Geo-Fotos", "📋 Arbeitsschutzvorschriften", "🏗️ SiGe-Plan");
  } else {
    base.push("🛰️ Geo photos", "📋 WHS legislation");
  }
  base.push(
    pl ? "🚗 Pojazdy" : de ? "🚗 Fahrzeuge" : "🚗 Vehicles",
    pl ? "🔧 Sprzęt" : de ? "🔧 Geräte" : "🔧 Equipment",
    pl ? "🖨️ Eksport PDF" : de ? "🖨️ PDF-Export" : "🖨️ PDF Export"
  );
  return base;
}

/** @typedef {{ href: string; label: string; spa?: boolean; compactHide?: boolean }} LandingNavLink */

/** @param {MarketId} marketId */
export function getLandingNavLinks(marketId) {
  if (marketId === "pl") {
    return {
      mobile: [
        { href: "#workflow", label: "Jak to działa" },
        { href: "#product", label: "Produkt" },
        { href: "#features", label: "Funkcje" },
        { href: "#pricing", label: "Cennik" },
        { href: "#faq", label: "FAQ" },
        { href: "/blog", label: "Blog", spa: true },
      ],
      desktop: [
        { href: "#workflow", label: "Proces" },
        { href: "#product", label: "Produkt" },
        { href: "#features", label: "Funkcje" },
        { href: "#pricing", label: "Cennik" },
        { href: "/blog", label: "Blog", spa: true },
        { href: "#faq", label: "FAQ" },
      ],
      signIn: "Zaloguj się",
      getStarted: "Wypróbuj",
      skipToMain: "Przejdź do treści",
      heroGetStarted: "Wypróbuj →",
      heroSeeProfiles: "Zobacz profile",
      heroQuickCheck: "Szybki test",
    };
  }
  if (marketId === "de" || marketId === "at" || marketId === "ch") {
    return {
      mobile: [
        { href: "#workflow", label: "So funktioniert es" },
        { href: "#product", label: "Produkt" },
        { href: "#features", label: "Funktionen" },
        { href: "#pricing", label: "Preise" },
        { href: "#faq", label: "FAQ" },
        { href: "/blog", label: "Blog", spa: true },
      ],
      desktop: [
        { href: "#workflow", label: "Ablauf" },
        { href: "#product", label: "Produkt" },
        { href: "#features", label: "Funktionen" },
        { href: "#pricing", label: "Preise" },
        { href: "/blog", label: "Blog", spa: true },
        { href: "#faq", label: "FAQ" },
      ],
      signIn: "Anmelden",
      getStarted: "Testen",
      skipToMain: "Zum Inhalt springen",
      heroGetStarted: "Testen →",
      heroSeeProfiles: "Profile ansehen",
      heroQuickCheck: "Kurzcheck",
    };
  }
  return {
    mobile: [
      { href: "#workflow", label: "How it works" },
      { href: "#product", label: "Product" },
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
      { href: "#faq", label: "FAQ" },
      { href: "/blog", label: "Blog", spa: true },
    ],
    desktop: [
      { href: "#workflow", label: "Workflow" },
      { href: "#product", label: "Product" },
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
      { href: "/blog", label: "Blog", spa: true },
      { href: "#faq", label: "FAQ" },
    ],
    signIn: "Sign in",
    getStarted: "Get started",
    skipToMain: "Skip to main content",
    heroGetStarted: "Get started →",
    heroSeeProfiles: "See profiles",
    heroQuickCheck: "2-min check",
  };
}

/** @param {MarketId} marketId */
export function getLandingFaqCopy(marketId) {
  const copy = getLandingMarketContent(marketId);
  if (marketId === "pl") {
    return {
      heading: "Najczęstsze pytania",
      intro: "Krótkie odpowiedzi — w aplikacji zobaczysz limity i funkcje swojego planu.",
      legalQuestion: "Czy MySafeOps to porada prawna lub zgłoszenia do PIP?",
      legalAnswer:
        "Nie. Pomaga porządkować IBWR, pozwolenia, rejestry i dowody. Za zgłoszenia ustawowe i zasady na budowie odpowiadasz Ty.",
      regulator: copy.faqRegulator,
      regionQuestion: "Czy MySafeOps obejmuje polskie przepisy BHP?",
      regionAnswer:
        "Szablony są pod kodeks pracy, rozporządzenia BHP i praktykę PIP. Zawsze zweryfikuj wymagania inwestora i branży.",
    };
  }
  if (marketId === "de") {
    return {
      heading: "Häufige Fragen",
      intro: "Kurze Antworten — in der App sehen Sie Limits und Funktionen Ihres Plans.",
      legalQuestion: "Ist MySafeOps Rechtsberatung oder eine Unfallanzeige?",
      legalAnswer:
        "Nein. Es hilft, GBU, Erlaubnisscheine, Register und Nachweise zu ordnen. Für gesetzliche Meldungen und Baustellenregeln bleiben Sie verantwortlich.",
      regulator: copy.faqRegulator,
      regionQuestion: "Gibt es in Deutschland etwas wie RAMS und Permit to Work?",
      regionAnswer:
        "Ja — nur unter anderen Namen. RAMS entspricht der Gefährdungsbeurteilung (GBU) plus Betriebsanweisung. Permit to Work entspricht dem Erlaubnisschein/Freigabe für riskante Arbeiten. Der SiGe-Plan (BaustellV) koordiniert mehrere Arbeitgeber und Anhang-II-Arbeiten — vergleichbar mit einem CDM Construction Phase Plan, aber nach deutschem Recht.",
      conversionQuestion: "Warum ein Abo statt Word und Excel?",
      conversionAnswer:
        "Weil SiGe-Plan, GBU und Freigabe veralten, sobald ein Nachunternehmer wechselt. MySafeOps hält Status live, verknüpft Anhang-II-Arbeiten mit Erlaubnisscheinen und lässt sich auf der Baustelle auch offline nutzen — fester Org-Preis in Euro, nicht pro Sitzplatz. Österreich (BauKG) und die Schweiz (BauAV) bekommen eigene Rechtsräume; wir mischen BaustellV nicht hinein.",
    };
  }
  if (marketId === "at") {
    return {
      heading: "Häufige Fragen",
      intro: "Kurze Antworten — in der App sehen Sie Limits und Funktionen Ihres Plans.",
      legalQuestion: "Ist MySafeOps Rechtsberatung oder eine Unfallanzeige?",
      legalAnswer:
        "Nein. Es hilft, Evaluierung, Erlaubnisscheine, Register und Nachweise zu ordnen. Für gesetzliche Meldungen und Baustellenregeln bleiben Sie verantwortlich.",
      regulator: copy.faqRegulator,
      regionQuestion: "Gibt es in Österreich etwas wie RAMS und Permit to Work?",
      regionAnswer:
        "Ja — unter österreichischen Namen. RAMS entspricht der Evaluierung nach ASchG plus Betriebsanweisung. Permit to Work entspricht dem Erlaubnisschein/Arbeitsfreigabe. Der SiGe-Plan (BauKG) koordiniert mehrere Arbeitgeber — vergleichbar mit CDM, aber nach österreichischem Recht.",
      conversionQuestion: "Warum ein Abo statt Word und Excel?",
      conversionAnswer:
        "Weil SiGe-Plan, Evaluierung und Freigabe veralten, sobald ein Nachunternehmer wechselt. MySafeOps hält Status live und lässt sich auf der Baustelle auch offline nutzen — fester Org-Preis in Euro. Deutschland (BaustellV) und die Schweiz (BauAV) bleiben eigene Rechtsräume.",
    };
  }
  if (marketId === "ch") {
    return {
      heading: "Häufige Fragen",
      intro: "Kurze Antworten — in der App sehen Sie Limits und Funktionen Ihres Plans.",
      legalQuestion: "Ist MySafeOps Rechtsberatung oder eine Unfallmeldung?",
      legalAnswer:
        "Nein. Es hilft, Gefährdungsermittlung, Freigaben, Register und Nachweise zu ordnen. Für gesetzliche Meldungen und Baustellenregeln bleiben Sie verantwortlich.",
      regulator: copy.faqRegulator,
      regionQuestion: "Gibt es in der Schweiz etwas wie RAMS und Permit to Work?",
      regionAnswer:
        "Ja — unter Schweizer Namen. RAMS entspricht der Gefährdungsermittlung plus Arbeitsanweisung. Permit to Work entspricht der Freigabe für riskante Arbeiten. Das SiKo (BauAV Art. 4) verlangt vor Baubeginn ein schriftliches Sicherheits- und Gesundheitsschutzkonzept mit Notfallorganisation — anders als beim deutschen SiGe-Plan gibt es keine Vorankündigungsschwelle: Das SiKo gilt für jede Baustelle.",
      conversionQuestion: "Warum ein Abo statt Word und Excel?",
      conversionAnswer:
        "Weil das SiKo, die Gefährdungsermittlung und Freigaben veralten, sobald ein Nachunternehmer wechselt. MySafeOps hält den Status live und lässt sich auf der Baustelle auch offline nutzen — fester Org-Preis in CHF. Deutschland (BaustellV) und Österreich (BauKG) bleiben eigene Rechtsräume; wir vermischen sie nicht mit der BauAV.",
    };
  }
  if (marketId === "au") {
    return {
      heading: "Common questions",
      intro: "Short answers — open the app for live limits and features on your plan.",
      legalQuestion: "Is MySafeOps legal advice or regulator reporting?",
      legalAnswer:
        "No. It helps you organise SWMS, permits, registers, and evidence. You remain responsible for statutory reporting (e.g. notifiable incidents) and site-specific rules.",
      regulator: copy.faqRegulator,
      regionQuestion: "Does MySafeOps cover every Australian state?",
      regionAnswer:
        "Templates align with model WHS laws and Safe Work Australia codes of practice. State regulators (NSW, VIC, QLD, etc.) may have additional requirements — always verify against your jurisdiction.",
    };
  }
  return {
    heading: "Common questions",
    intro: "Short answers — open the app for live limits and features on your plan.",
    legalQuestion: "Is MySafeOps legal advice or HSE reporting?",
    legalAnswer:
      "No. It helps you organise RAMS, permits, registers, and evidence. You remain responsible for statutory reporting (e.g. RIDDOR) and site-specific rules.",
    regulator: copy.faqRegulator,
    regionQuestion: null,
    regionAnswer: null,
  };
}
