/** @typedef {import("../config/markets").MarketId} MarketId */
import { getMarketLabelPack } from "../config/marketLabelPacks";

/** @type {Record<MarketId, {
 *   workspace: { moreModules: string; workspace: string };
 *   moreSections: Record<string, string>;
 *   onboarding: Record<string, string | ((...args: unknown[]) => string)>;
 *   constructionWizard: Record<string, string>;
 *   constructionSteps: Record<string, string>;
 *   constructionActions: Record<string, string>;
 *   dashboard: { constructionBannerTitle: (c: number, t: number, p: number) => string; constructionBannerLead: string; openWizard: string };
 *   projectHub: Record<string, string | ((...args: unknown[]) => string)>;
 *   industryShowcase: Record<string, string>;
 * }>} */
const APP_UI = {
  uk: {
    workspace: { moreModules: "More modules", workspace: "Workspace" },
    moreSections: {},
    onboarding: {},
    constructionWizard: {
      badge: "GC",
      title: "Setup in an afternoon",
      lead: "Onboarding checklist for UK general contractors — CDM, RAMS, permits, daily briefing and client portal in one session.",
      progress: "Progress",
      runNow: "Run now",
      open: "Open",
      markDone: "Mark done",
    },
    constructionSteps: {
      workspaceProfile: "Apply general contractor workspace profile",
      workspaceProfileHint: "Shows daily briefing, inspections, snags and hides food/pharma modules.",
      hazardPacksHint: "Hot works, height, excavation, electrical — ready in RAMS Builder.",
      firstProject: (ed) => `First project with ${ed}`,
      firstProjectHint: "Enrich site on project — blocks RAMS issue without emergency hospital details.",
      clientPortal: "Client portal published",
      clientPortalHint: "Share read-only compliance view — publish cloud for any device.",
      inspections: "Equipment inspection register started",
    },
    constructionActions: {
      workspaceProfile: "General contractor profile applied with register seeds.",
      hazardPacks: (n) => `Construction quick packs ready (${n} total).`,
      legislation: "CDM / H&S legislation register seeded.",
      default: "Open the linked module to complete this step.",
    },
    dashboard: {
      constructionBannerTitle: (c, t, p) => `Construction setup — ${c}/${t} complete (${p}%)`,
      constructionBannerLead: " · CDM, RAMS, permits, daily briefing and client portal in one afternoon.",
      openWizard: "Open setup wizard",
    },
    projectHub: {},
    industryShowcase: {},
  },
  au: {
    workspace: { moreModules: "More modules", workspace: "Workspace" },
    moreSections: {},
    onboarding: {},
    constructionWizard: {
      badge: "GC",
      title: "Setup in an afternoon",
      lead: "Onboarding checklist for Australian general contractors — WHS, SWMS, permits, daily briefing and client portal in one session.",
      progress: "Progress",
      runNow: "Run now",
      open: "Open",
      markDone: "Mark done",
    },
    constructionSteps: {
      workspaceProfile: "Apply general contractor workspace profile",
      workspaceProfileHint: "Shows daily briefing, inspections, snags and hides food/pharma modules.",
      hazardPacksHint: "Hot works, height, excavation, electrical — ready in SWMS Builder.",
      firstProject: (ed) => `First project with ${ed}`,
      firstProjectHint: "Enrich site on project — blocks SWMS issue without emergency hospital details.",
      clientPortal: "Client portal published",
      clientPortalHint: "Share read-only compliance view — publish cloud for any device.",
      inspections: "Plant inspection register started",
    },
    constructionActions: {
      workspaceProfile: "General contractor profile applied with register seeds.",
      hazardPacks: (n) => `Construction quick packs ready (${n} total).`,
      legislation: "WHS legislation register seeded.",
      default: "Open the linked module to complete this step.",
    },
    dashboard: {
      constructionBannerTitle: (c, t, p) => `Construction setup — ${c}/${t} complete (${p}%)`,
      constructionBannerLead: " · WHS, SWMS, permits, daily briefing and client portal in one afternoon.",
      openWizard: "Open setup wizard",
    },
    projectHub: {},
    industryShowcase: {},
  },
  pl: {
    workspace: { moreModules: "Więcej modułów", workspace: "Obszar roboczy" },
    moreSections: {
      "Site operations": "Operacje na budowie",
      "Health, safety & environment": "BHP i środowisko",
      "Insights & reports": "Analizy i raporty",
      "Data & app": "Dane i aplikacja",
    },
    onboarding: {
      skipAria: "Pomiń konfigurację na razie",
      welcomeTitle: "Witaj w MySafeOps",
      welcomeLead: (name) =>
        `Skonfiguruj <strong>${name}</strong> w mniej niż minutę. Profil obszaru roboczego decyduje, które moduły są widoczne, jak Panel projektu ocenia gotowość i jaki pakiet IOR jest sugerowany — zmienisz to w Ustawieniach.`,
      getStarted: "Zacznij",
      profileTitle: "Wybierz profil obszaru roboczego",
      profileLead:
        "Wybierz opcję najbliższą Twojej branży. To pokazuje rejestry w Więcej, ustawia bramki Panelu projektu i sugeruje pakiet IOR — nic nie znika po zmianie profilu.",
      profileNote:
        "Wiersze startowe mogą zostać dodane do pustych rejestrów po kontynuacji. Pełny przewodnik: Pomoc (<kbd>?</kbd>) → Profile obszaru.",
      profileAdminNote: "Poproś administratora o zastosowanie profilu lub kontynuuj z domyślnym układem.",
      back: "Wstecz",
      continue: "Dalej",
      shortcutTitle: "Przypnij moduł do dolnego paska",
      shortcutLead: "Zamień domyślny slot <strong>Kosz</strong> na najczęściej używany rejestr — jeden dotyk z każdego ekranu.",
      shortcutLabel: "Skrót dolnego paska",
      shortcutDefault: "Kosz (domyślnie)",
      shortcutAdminNote: "Administratorzy ustawią to w Ustawienia → Organizacja → Moduły.",
      doneTitle: "Gotowe",
      doneLead: "Obszar roboczy jest dopasowany. Uzupełnij to, gdy będziesz mieć chwilę:",
      checklistHelp: "Przeczytaj przewodnik profilu (Pomoc)",
      checklistBranding: "Dodaj logo i dane firmy",
      checklistPeople: "Dodaj ludzi do zespołu",
      checklistProject: "Dodaj pierwszy projekt",
      checklistRams: "Utwórz pierwszą IOR",
      openDashboard: "Otwórz panel",
    },
    constructionWizard: {
      badge: "BUD",
      title: "Konfiguracja w popołudnie",
      lead: "Lista kontrolna dla wykonawców budowlanych — Plan BHP, IOR, pozwolenia, odprawa dzienna i portal klienta w jednej sesji.",
      progress: "Postęp",
      runNow: "Uruchom",
      open: "Otwórz",
      markDone: "Oznacz jako gotowe",
    },
    constructionSteps: {
      workspaceProfile: "Zastosuj profil wykonawcy budowlanego",
      workspaceProfileHint: "Pokazuje odprawę dzienną, kontrole i usterki — ukrywa moduły spożywcze/farmaceutyczne.",
      hazardPacksHint: "Prace gorące, wysokość, wykopy, elektryczne — gotowe w Kreatorze IOR.",
      firstProject: (ed) => `Pierwszy projekt z ${ed}`,
      firstProjectHint: "Uzupełnij budowę w projekcie — bez SOR nie wydasz IOR.",
      clientPortal: "Portal klienta opublikowany",
      clientPortalHint: "Udostępnij widok zgodności tylko do odczytu — publikacja w chmurze na każdym urządzeniu.",
      inspections: "Rejestr kontroli urządzeń",
    },
    constructionActions: {
      workspaceProfile: "Zastosowano profil wykonawcy budowlanego z danymi startowymi rejestrów.",
      hazardPacks: (n) => `Pakiety budowlane gotowe (${n} łącznie).`,
      legislation: "Rejestr przepisów BHP załadowany.",
      default: "Otwórz powiązany moduł, aby ukończyć ten krok.",
    },
    dashboard: {
      constructionBannerTitle: (c, t, p) => `Konfiguracja budowy — ${c}/${t} ukończone (${p}%)`,
      constructionBannerLead: " · Plan BHP, IOR, pozwolenia, odprawa dzienna i portal klienta w jednym popołudniu.",
      openWizard: "Otwórz kreator konfiguracji",
    },
    projectHub: {
      eyebrowHub: "Centrum projektu",
      eyebrowDashboard: "Panel projektu",
      untitled: "Projekt bez nazwy",
      addSiteDetails: "Dodaj dane budowy w ustawieniach projektu.",
      preview: " · podgląd",
      liveReadiness: (pct) => `Gotowość budowy ${pct}%`,
      pipeline: (d, t) => `Proces ${d}/${t}`,
      closed: "Zamknięty",
      permits: (i, r) => `Pozwolenia ${i}/${r}`,
      checklistOpen: (n) => `Lista kontrolna ${n} otwartych`,
      doThisNow: "Zrób teraz",
      printSitePack: "Drukuj pakiet budowy",
    },
    industryShowcase: {
      swipeProfiles: "Przesuń profile →",
      swipeSectors: "Przesuń branże →",
      selectedProfile: "Wybrany profil",
      surveyTag: "Proces geodezyjny",
      hygieneTag: "Rejestry higieny",
      cta: "Rozpocznij ewaluację z tym profilem →",
      ramsBadge: "Pakiety IOR",
      ramsTitle: "Biblioteki branżowe jednym kliknięciem",
      ramsIntro:
        "Gotowe wiersze zagrożeń ze środkami, OOP, przepisami i powiązaniami PTW — roboty ziemne, instalacje, geodezja, M&E i więcej. Nie puste szablony.",
      ramsSectorsAria: "Branże pakietów IOR",
      corePack: "Pakiet podstawowy",
      hazardRows: (n) => `${n} wierszy zagrożeń`,
      moreInSector: (n) => `+ ${n} więcej w tej branży — pełna biblioteka w 14-dniowej ewaluacji.`,
    },
  },
};

/** @param {MarketId} [marketId] */
export function getAppUiCopy(marketId = "uk") {
  return APP_UI[marketId] ?? APP_UI.uk;
}

/** @param {string} englishTitle @param {MarketId} [marketId] */
export function getMoreSectionDisplayTitle(englishTitle, marketId = "uk") {
  const localized = getAppUiCopy(marketId).moreSections[englishTitle];
  return localized || englishTitle;
}

/** @param {string} key @param {MarketId} marketId @param {...unknown} args */
export function getOnboardingCopy(key, marketId, ...args) {
  const pack = getAppUiCopy(marketId).onboarding;
  const val = pack[key];
  if (!val) return null;
  return typeof val === "function" ? val(...args) : val;
}

/** @param {MarketId} [marketId] */
export function getConstructionWizardCopy(marketId = "uk") {
  const pack = APP_UI[marketId] || APP_UI.uk;
  const wizard = pack.constructionWizard;
  if (wizard && Object.keys(wizard).length) return wizard;
  return {
    badge: "GC",
    title: "Setup in an afternoon",
    lead: "Onboarding checklist for UK general contractors — CDM, RAMS, permits, daily briefing and client portal in one session.",
    progress: "Progress",
    runNow: "Run now",
    open: "Open",
    markDone: "Mark done",
  };
}

/** @param {MarketId} [marketId] */
export function getIndustryShowcaseUiCopy(marketId = "uk") {
  const pl = APP_UI.pl.industryShowcase;
  if (marketId === "pl" && pl && Object.keys(pl).length) return pl;
  const ramsLabel = getMarketLabelPack(marketId).ramsShort;
  return {
    swipeProfiles: "Swipe profiles →",
    swipeSectors: "Swipe sectors →",
    selectedProfile: "Selected profile",
    surveyTag: "Survey workflow",
    hygieneTag: "Hygiene registers",
    cta: "Start evaluation with this profile →",
    ramsBadge: `${ramsLabel} quick packs`,
    ramsTitle: "Trade libraries you can seed in one click",
    ramsIntro:
      "Pre-built hazard rows with controls, PPE, regs and permit links — groundworks, utilities, PAS128 utility intelligence, site investigation, food factory M&E and more. Not blank templates.",
    ramsSectorsAria: `${ramsLabel} pack sectors`,
    corePack: "Core pack",
    hazardRows: (n) => `${n} hazard rows`,
    moreInSector: (n) => `+ ${n} more in this sector — full library unlocked during your 14-day evaluation.`,
  };
}

/** @param {MarketId} [marketId] */
export function getProjectHubCopy(marketId = "uk") {
  return getAppUiCopy(marketId).projectHub;
}
