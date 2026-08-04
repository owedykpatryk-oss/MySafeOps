/** @typedef {import("../config/markets").MarketId} MarketId */

/** @typedef {{ id: string; title: string; detail: string }} ReadinessSignal */

const UK_SECTIONS = {
  hero: {
    titleLine1: "Site safety,",
    titleLine2: "with real depth.",
    modulesStat: "Modules",
    profilesStat: "Workspace profiles",
    trialStat: "Full evaluation",
  },
  workflow: {
    badge: "How teams actually use it",
    title: "From profile to signed-off site records",
    intro: "One flow — not five disconnected tools. Offline on site, optional cloud sync when you need backup and invites.",
    steps: [
      { id: "profile", emoji: "🎯", title: "Pick your workspace profile", copy: "Construction, surveying, food/pharma or demolition — modules and RAMS libraries match your trade from day one.", accent: "rgba(139,92,246,.14)", border: "rgba(139,92,246,.35)", span: "wide" },
      { id: "rams", emoji: "⚠️", title: "Seed RAMS in one click", copy: "Built-in quick packs with hazards, controls, PPE and permit links — not empty Word templates.", accent: "rgba(13,148,136,.12)", border: "rgba(13,148,136,.35)", span: "normal" },
      { id: "ptw", emoji: "🔥", title: "Issue & track permits live", copy: "Hot work, height, confined space, electrical — expiry, SIMOPS and quality gates visible on the dashboard.", accent: "rgba(249,115,22,.12)", border: "rgba(249,115,22,.35)", span: "normal" },
      { id: "export", emoji: "🖨️", title: "Export audit-ready PDFs", copy: "RAMS matrix, survey reports, permit boards — print or share without rebuilding spreadsheets.", accent: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.35)", span: "wide" },
    ],
    cta: "See how it fits your trade",
    startEval: "Start 14-day evaluation →",
    exploreProfiles: "Explore profiles & RAMS",
  },
  features: { badge: "Features", title: "Everything you need on site", intro: "From risk assessments to permit management, worker competency to equipment tracking — one app replaces scattered paperwork." },
  industry: {
    badge: "Depth beyond generic HSE apps",
    title: "Pick your workspace profile — unlock the right modules",
    intro: "Nine built-in profiles tailor RAMS libraries, registers and dashboards to how you actually work — from civils contractors and PAS128 survey teams to food/pharma hygiene and demolition.",
    profilesStat: "Workspace profiles",
    packsStat: "Quick packs",
    modulesStat: "Modules",
  },
  readiness: {
    badge: "2-minute check",
    title: "How ready is your site today?",
    intro: "Toggle what is already in place and see your live readiness score. Teams use this to quickly spot where risk still leaks.",
    ringLabel: "Readiness",
    unlockCta: "Unlock full readiness dashboard",
    noGaps: "No obvious gaps selected — great baseline for the day.",
    gaps: (n) => `${n} key area${n > 1 ? "s are" : " is"} still weak. Fixing them first usually cuts rework and surprises.`,
    tones: [
      { min: 80, label: "Site ready", hint: "Strong baseline. Keep checks consistent across shifts." },
      { min: 60, label: "Good baseline", hint: "You are close. Tighten the missing checks to reduce risk." },
      { min: 40, label: "Needs attention", hint: "Some controls are inconsistent and could expose the site." },
      { min: 0, label: "High exposure", hint: "Critical controls are not stable yet. Prioritize the basics first." },
    ],
    signals: [
      { id: "permits-live", title: "Live permit status", detail: "You can instantly spot active, expiring, and overdue permits." },
      { id: "daily-briefing", title: "Daily briefing trail", detail: "Toolbox talks and briefings are signed and easy to evidence." },
      { id: "competency-watch", title: "Competency expiry watch", detail: "Workers with expiring certs are flagged before deployment." },
      { id: "incident-speed", title: "Incident capture speed", detail: "Near misses are logged with photos in under 2 minutes." },
      { id: "audit-ready", title: "Audit-ready exports", detail: "You can export clear records without spreadsheet rework." },
    ],
  },
  roles: {
    badge: "How it works",
    title: "One app, three roles",
    intro: "Everyone uses the same workspace. Permissions keep admins, supervisors, and workers in their lane.",
    admin: { title: "👑 Admin", sub: "Managers & office staff", points: ["Organisation settings & backups", "Invite users and manage roles", "Approve key documents and exports", "Full module access (per plan)"] },
    supervisor: { title: "🔧 Supervisor", sub: "Site leads & foremen", points: ["Run permits, briefings, inspections", "Toolbox talks and site records", "Report incidents and near misses", "Practical day-to-day control"], highlight: true },
    worker: { title: "👷 Worker", sub: "Operative access", points: ["Read and acknowledge RAMS where required", "Sign attendance and complete induction steps", "Report issues with photos and context", "No admin billing or org settings"], denyLast: true },
  },
  modules: { title: "40+ modules. One app.", intro: "Registers, checklists, and workflows you can grow into — without bolting on five different tools." },
  pricing: {
    badge: "Pricing",
    title: "Plans that stay transparent",
    intro: "Flat organisation pricing — not per seat. Live limits and usage are in the app under Settings → Billing & limits.",
    evaluation: "Evaluation",
    solo: "Solo",
    team: "Team",
    business: "Business",
    enterprise: "Enterprise",
    enterprisePlus: "Enterprise Plus",
    startEval: "Start evaluation",
    startTrial: "Start trial",
    contactSales: "Contact sales",
    enterpriseMailSubject: "MySafeOps Enterprise Plus",
  },
  roi: {
    badge: "Value estimate",
    title: "What is paperwork delay costing you?",
    intro: "Quick estimate only. Adjust a few numbers and see potential time and cost recovered when site documentation is handled in one flow.",
    teamLabel: "Team members on active site",
    docsLabel: "Docs/permits touched per person daily",
    minutesLabel: "Minutes saved per item",
    rateLabel: "Blended labour rate",
    people: (n) => `${n} people`,
    itemsDay: (n) => `${n} items/day`,
    min: (n) => `${n} min`,
    hour: (n, fmt) => `${fmt}/hour`,
    kicker: "Potential recovery",
    week: (h) => `${h} hrs / week`,
    month: (v, fmt) => `~ ${fmt} / month in productive time`,
    disclaimer: "Estimation assumes steady activity over 5 working days. Use this as a planning baseline, not as a guaranteed financial forecast.",
    orgPricing: "Subscription is priced per organisation (tier caps), not per worker seat — compare with the",
    pricingLink: "pricing table",
    cta: "Test this in your workspace",
  },
  blog: {
    badge: "Insights",
    title: "From the blog",
    lead: (n) => `UK construction safety guides — permits, RAMS, inductions and compliance. Browse all ${n} articles.`,
    browseAll: "Browse all",
    seeAll: "See all guides →",
    readArticle: "Read article →",
    featured: "Featured",
    tagsAria: "Tags",
  },
  missing: {
    title: "🛠️ Missing something?",
    intro: "We build MySafeOps for real site workflows — tell us what register, checklist, or workflow you need next.",
    sub: (email) => `If it matters on site, it belongs on the roadmap — email us a short brief and we will triage it. Support: ${email}`,
    emailPh: "Your email",
    namePh: "Your name / company",
    descPh: "What feature, register, or document type do you need?",
    emailLabel: "Email address",
    nameLabel: "Your name or company",
    descLabel: "Feature request details",
    cta: "Email feature request →",
    footnote: (email) => `Opens your email app with a pre-filled message to ${email}.`,
  },
  cta: {
    title: "Ready to open your workspace?",
    intro: "Sign in to start your trial (where enabled) and invite your organisation.",
    emailPh: "Work email (optional)",
    emailLabel: "Work email (optional)",
    button: "Continue to sign in →",
    help: "Help:",
  },
  footer: {
    region: "Region:",
    product: "Product",
    resources: "Resources",
    company: "Company",
    signIn: "Sign in",
    docs: "Documentation",
    contact: "Contact",
    status: "Service status",
    security: "Security & trust",
    emailUs: "Email us",
    privacy: "Privacy policy",
    terms: "Terms of service",
    cookies: "Cookie policy",
    dpa: "Data processing (DPA)",
    accessibility: "Accessibility",
    cookieNotice: "MySafeOps uses essential cookies only to keep you signed in — no advertising or cross-site tracking cookies.",
    cookiePolicy: "Cookie policy",
    help: "Help:",
  },
};

const PL_SECTIONS = {
  ...UK_SECTIONS,
  hero: {
    titleLine1: "BHP na budowie,",
    titleLine2: "z prawdziwą głębią.",
    modulesStat: "Moduły",
    profilesStat: "Profile robocze",
    trialStat: "Pełna ewaluacja",
  },
  workflow: {
    badge: "Jak ekipy tego używają",
    title: "Od profilu do podpisanych zapisów z budowy",
    intro: "Jeden flow — nie pięć rozłącznych narzędzi. Offline na budowie, opcjonalna chmura pod backup i zaproszenia.",
    steps: [
      { id: "profile", emoji: "🎯", title: "Wybierz profil roboczy", copy: "Budownictwo, instalacje lub demolka — moduły i biblioteki IOR od pierwszego dnia.", accent: "rgba(139,92,246,.14)", border: "rgba(139,92,246,.35)", span: "wide" },
      { id: "rams", emoji: "⚠️", title: "IOR jednym kliknięciem", copy: "Pakiety szybkie z zagrożeniami, środkami i powiązaniami PTW — nie puste szablony Word.", accent: "rgba(13,148,136,.12)", border: "rgba(13,148,136,.35)", span: "normal" },
      { id: "ptw", emoji: "🔥", title: "Wydawaj i śledź pozwolenia", copy: "Prace gorące, na wysokości, w przestrzeni zamkniętej — status i SIMOPS na dashboardzie.", accent: "rgba(249,115,22,.12)", border: "rgba(249,115,22,.35)", span: "normal" },
      { id: "export", emoji: "🖨️", title: "Eksport PDF pod audyt", copy: "Macierz IOR, raporty, tablica pozwoleń — bez przebudowy arkuszy.", accent: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.35)", span: "wide" },
    ],
    cta: "Zobacz dopasowanie do Twojej branży",
    startEval: "Rozpocznij 14-dniową ewaluację →",
    exploreProfiles: "Poznaj profile i IOR",
  },
  features: { badge: "Funkcje", title: "Wszystko czego potrzebujesz na budowie", intro: "Od IOR i pozwoleń po kompetencje i sprzęt — jedna aplikacja zamiast porozrzucanej dokumentacji." },
  industry: {
    badge: "Więcej niż generyczne BHP",
    title: "Profil roboczy — właściwe moduły od razu",
    intro: "Dziewięć profili dopasowuje biblioteki IOR, rejestry i dashboardy do Twojej branży — od wykonawców instalacyjnych po demolka.",
    profilesStat: "Profile robocze",
    packsStat: "Pakiety szybkie",
    modulesStat: "Moduły",
  },
  readiness: {
    badge: "Szybki test",
    title: "Jak gotowa jest Twoja budowa dziś?",
    intro: "Zaznacz co już działa i zobacz wynik gotowości. Zespoły szybko widzą, gdzie jeszcze przecieka ryzyko.",
    ringLabel: "Gotowość",
    unlockCta: "Otwórz pełny dashboard gotowości",
    noGaps: "Brak oczywistych luk — solidna baza na dziś.",
    gaps: (n) => `${n} kluczow${n > 1 ? "e obszary wymagają" : "y obszar wymaga"} uwagi. Naprawa najpierw tam zwykle ogranicza niespodzianki.`,
    tones: [
      { min: 80, label: "Budowa gotowa", hint: "Dobra baza. Utrzymuj kontrole na każdej zmianie." },
      { min: 60, label: "Dobra baza", hint: "Jesteś blisko. Dociśnij brakujące kontrole." },
      { min: 40, label: "Wymaga uwagi", hint: "Część kontroli jest niespójna — to ryzyko na budowie." },
      { min: 0, label: "Wysokie ryzyko", hint: "Krytyczne kontrole nie są stabilne. Zacznij od podstaw." },
    ],
    signals: [
      { id: "permits-live", title: "Status pozwoleń na żywo", detail: "Od razu widać aktywne, wygasające i przeterminowane PTW." },
      { id: "daily-briefing", title: "Ślad odpraw dziennych", detail: "Odprawy i toolboxy podpisane i łatwe do pokazania." },
      { id: "competency-watch", title: "Ważność kompetencji", detail: "Wygasające uprawnienia widoczne przed wysłaniem na budowę." },
      { id: "incident-speed", title: "Szybkie zgłoszenia", detail: "Zdarzenia i near-missy z foto w kilka minut." },
      { id: "audit-ready", title: "Eksport pod audyt", detail: "Czytelne zestawienia bez przerabiania arkuszy." },
    ],
  },
  roles: {
    badge: "Jak to działa",
    title: "Jedna aplikacja, trzy role",
    intro: "Wszyscy w jednym środowisku. Uprawnienia rozdzielają adminów, brygadzistów i pracowników.",
    admin: { title: "👑 Admin", sub: "Kierownictwo i biuro", points: ["Ustawienia org i kopie zapasowe", "Zaproszenia i role", "Zatwierdzanie dokumentów i eksportów", "Pełny dostęp do modułów (wg planu)"] },
    supervisor: { title: "🔧 Brygadzista", sub: "Kierownik budowy", points: ["Pozwolenia, odprawy, inspekcje", "Toolboxy i zapisy z terenu", "Zgłoszenia zdarzeń", "Codzienna kontrola operacyjna"], highlight: true },
    worker: { title: "👷 Pracownik", sub: "Dostęp operacyjny", points: ["Zapoznanie z IOR tam gdzie wymagane", "Obecność i kroki indukcji", "Zgłaszanie problemów z foto", "Bez billingu i ustawień org"], denyLast: true },
  },
  modules: { title: "40+ modułów. Jedna aplikacja.", intro: "Rejestry, checklisty i procesy — bez dokładania pięciu narzędzi." },
  pricing: {
    badge: "Cennik",
    title: "Przejrzyste plany",
    intro: "Stała cena za organizację — nie za stanowisko. Limity na żywo w Ustawienia → Billing.",
    evaluation: "Ewaluacja",
    solo: "Solo",
    team: "Team",
    business: "Business",
    enterprise: "Enterprise",
    enterprisePlus: "Enterprise Plus",
    startEval: "Rozpocznij ewaluację",
    startTrial: "Rozpocznij trial",
    contactSales: "Kontakt sprzedaż",
    enterpriseMailSubject: "MySafeOps Enterprise Plus (PL)",
  },
  roi: {
    badge: "Szacunek korzyści",
    title: "Ile kosztuje Cię opóźniona dokumentacja?",
    intro: "Szybki kalkulator — zobacz potencjalny czas i koszt odzyskany w jednym flow.",
    teamLabel: "Osób na aktywnej budowie",
    docsLabel: "Dokumentów / PTW na osobę dziennie",
    minutesLabel: "Minut oszczędności na pozycję",
    rateLabel: "Średni koszt roboczogodziny",
    people: (n) => `${n} osób`,
    itemsDay: (n) => `${n} poz./dzień`,
    min: (n) => `${n} min`,
    hour: (n, fmt) => `${fmt}/godz.`,
    kicker: "Potencjalny zysk",
    week: (h) => `${h} godz. / tydzień`,
    month: (v, fmt) => `~ ${fmt} / mies. produktywnego czasu`,
    disclaimer: "Założenie: 5 dni roboczych. To planowanie, nie gwarancja finansowa.",
    orgPricing: "Subskrypcja jest za organizację (limity planu), nie za stanowisko — porównaj z",
    pricingLink: "tabelą cen",
    cta: "Sprawdź w swoim workspace",
  },
  blog: {
    badge: "Wiedza",
    title: "Z bloga",
    lead: (n) => `Poradniki BHP i pozwolenia na pracę w Polsce. Przeglądaj ${n} artykułów.`,
    browseAll: "Wszystkie artykuły",
    seeAll: "Zobacz wszystkie →",
    readArticle: "Czytaj artykuł →",
    featured: "Wyróżnione",
    tagsAria: "Tagi",
  },
  missing: {
    title: "🛠️ Czego Ci brakuje?",
    intro: "Budujemy MySafeOps pod realne budowy — napisz jaki rejestr, checklistę lub proces dodać.",
    sub: (email) => `Jeśli to ważne na budowie, trafi na roadmapę. Wsparcie: ${email}`,
    emailPh: "Twój e-mail",
    namePh: "Imię / firma",
    descPh: "Jakiej funkcji, rejestru lub dokumentu potrzebujesz?",
    emailLabel: "Adres e-mail",
    nameLabel: "Imię lub firma",
    descLabel: "Opis prośby o funkcję",
    cta: "Wyślij prośbę e-mailem →",
    footnote: (email) => `Otworzy klienta poczty z wiadomością do ${email}.`,
  },
  cta: {
    title: "Gotowy otworzyć workspace?",
    intro: "Zaloguj się, rozpocznij trial (gdy włączony) i zaproś organizację.",
    emailPh: "E-mail służbowy (opcjonalnie)",
    emailLabel: "E-mail służbowy (opcjonalnie)",
    button: "Przejdź do logowania →",
    help: "Pomoc:",
  },
  footer: {
    region: "Region:",
    product: "Produkt",
    resources: "Zasoby",
    company: "Firma",
    signIn: "Zaloguj się",
    docs: "Dokumentacja",
    contact: "Kontakt",
    status: "Status usługi",
    security: "Bezpieczeństwo i zaufanie",
    emailUs: "Napisz do nas",
    privacy: "Polityka prywatności",
    terms: "Regulamin",
    cookies: "Polityka cookies",
    dpa: "Powierzenie danych (DPA)",
    accessibility: "Dostępność",
    cookieNotice: "MySafeOps używa tylko cookies niezbędnych do logowania — bez reklam i śledzenia między witrynami.",
    cookiePolicy: "Polityka cookies",
    help: "Pomoc:",
  },
};

/** @param {MarketId} marketId */
export function getLandingSectionsCopy(marketId) {
  if (marketId === "pl") return PL_SECTIONS;
  return UK_SECTIONS;
}

/** @param {MarketId} marketId */
export function getReadinessTone(score, marketId = "uk") {
  const tones = getLandingSectionsCopy(marketId).readiness.tones;
  return tones.find((t) => score >= t.min) ?? tones[tones.length - 1];
}

/** @param {MarketId} marketId */
export function getHeroMockupScreens(marketId) {
  const rams = marketId === "pl" ? "IOR" : marketId === "au" ? "SWMS" : "RAMS";
  const permits = marketId === "pl" ? "Pozwolenia" : "Permits";
  const incidents = marketId === "pl" ? "Zdarzenia" : "Incidents";
  const workers = marketId === "pl" ? "Pracownicy" : "Workers";

  if (marketId === "pl") {
    return [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "📊",
        kpis: [
          { v: "12", l: rams, c: "#f97316" },
          { v: "8", l: permits, c: "#a78bfa" },
          { v: "2", l: incidents, c: "#ef4444" },
          { v: "24", l: workers, c: "#06b6d4" },
        ],
        cards: [
          { t: "⚠️ IOR — Spawanie / prace gorące", s: "IOR-003 · Strefa B · Zatwierdzona ✅", p: 95, c: "#f97316" },
          { t: "🏗️ PTW wysokość — Dach", s: "PTW-007 · 6 godz. pozostało", p: 70, c: "#3b82f6" },
          { t: "🚨 Zgłoszenie zdarzenia", s: "ZDN-004 · Do weryfikacji", p: 40, c: "#ef4444" },
        ],
        nav: ["📊 Start", "📄 Dok.", "👷 Prac.", "🔧 Sprz.", "⚙️ Więcej"],
      },
      {
        id: "bhp",
        label: "Plan BHP",
        icon: "🏗️",
        kpis: [
          { v: "Plan", l: "BHP", c: "#2dd4bf" },
          { v: "4", l: "Podwyk.", c: "#818cf8" },
          { v: "92%", l: "Komplet", c: "#22c55e" },
          { v: "8", l: "Foto geo", c: "#38bdf8" },
        ],
        cards: [
          { t: "📋 Plan BHP — Etap 2", s: "Koordynacja · 3 podwykonawców", p: 88, c: "#2dd4bf" },
          { t: "📸 Dowód geo — brama", s: "GPS · azymut 247°", p: 100, c: "#38bdf8" },
          { t: "✅ Ocena ryzyka", s: "Macierz 5×5 · 2 luki", p: 62, c: "#a78bfa" },
        ],
        nav: ["📊 Start", "📄 Dok.", "👷 Prac.", "🔧 Sprz.", "⚙️ Więcej"],
      },
      {
        id: "ptw",
        label: "Pozwolenia",
        icon: "🔥",
        kpis: [
          { v: "5", l: "Aktywne", c: "#22c55e" },
          { v: "2", l: "Wygasają", c: "#eab308" },
          { v: "1", l: "Po terminie", c: "#ef4444" },
          { v: "3", l: "SIMOPS", c: "#f97316" },
        ],
        cards: [
          { t: "🔥 Prace gorące — hala", s: "Straż poż. · 2h 14m", p: 55, c: "#f97316" },
          { t: "⚡ Izolacja elektryczna", s: "LOTO · Podpis wydającego", p: 90, c: "#eab308" },
          { t: "⛑️ Przestrzeń zamknięta", s: "Pomiar gazów OK", p: 75, c: "#3b82f6" },
        ],
        nav: ["📊 Start", "📄 Dok.", "👷 Prac.", "🔧 Sprz.", "⚙️ Więcej"],
      },
    ];
  }

  if (marketId === "au") {
    return [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "📊",
        kpis: [
          { v: "12", l: rams, c: "#f97316" },
          { v: "8", l: permits, c: "#a78bfa" },
          { v: "2", l: incidents, c: "#ef4444" },
          { v: "24", l: workers, c: "#06b6d4" },
        ],
        cards: [
          { t: "⚠️ SWMS — Welding/Hot Works", s: "SWMS-003 · Zone B · Approved ✅", p: 95, c: "#f97316" },
          { t: "🏗️ Height PTW — Roof Access", s: "PTW-007 · 6h remaining", p: 70, c: "#3b82f6" },
          { t: "🚨 Near Miss Reported", s: "INC-004 · Pending review", p: 40, c: "#ef4444" },
        ],
        nav: ["📊 Home", "📄 Docs", "👷 Workers", "🔧 Equip", "⚙️ More"],
      },
      {
        id: "whs",
        label: "WHS plan",
        icon: "📋",
        kpis: [
          { v: "WHS", l: "Plan", c: "#2dd4bf" },
          { v: "4", l: "Subbies", c: "#818cf8" },
          { v: "98%", l: "Complete", c: "#22c55e" },
          { v: "12", l: "Geo photos", c: "#38bdf8" },
        ],
        cards: [
          { t: "📋 WHS management plan", s: "Stage 2 · 3 subcontractors", p: 88, c: "#2dd4bf" },
          { t: "📸 Geo evidence — gate", s: "GPS locked · bearing 247°", p: 100, c: "#38bdf8" },
          { t: "✅ Risk assessment", s: "Matrix 5×5 · 2 gaps", p: 62, c: "#a78bfa" },
        ],
        nav: ["📊 Home", "📄 Docs", "👷 Workers", "🔧 Equip", "⚙️ More"],
      },
      {
        id: "ptw",
        label: "Permits live",
        icon: "🔥",
        kpis: [
          { v: "5", l: "Live", c: "#22c55e" },
          { v: "2", l: "Expiring", c: "#eab308" },
          { v: "1", l: "Overdue", c: "#ef4444" },
          { v: "3", l: "SIMOPS", c: "#f97316" },
        ],
        cards: [
          { t: "🔥 Hot work — Fabrication bay", s: "Fire watch · 2h 14m left", p: 55, c: "#f97316" },
          { t: "⚡ Electrical isolation", s: "LOTO verified · Issuer signed", p: 90, c: "#eab308" },
          { t: "⛑️ Confined space entry", s: "Gas test OK · Rescue plan linked", p: 75, c: "#3b82f6" },
        ],
        nav: ["📊 Home", "📄 Docs", "👷 Workers", "🔧 Equip", "⚙️ More"],
      },
    ];
  }

  return [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "📊",
      kpis: [
        { v: "12", l: rams, c: "#f97316" },
        { v: "8", l: permits, c: "#a78bfa" },
        { v: "2", l: incidents, c: "#ef4444" },
        { v: "24", l: workers, c: "#06b6d4" },
      ],
      cards: [
        { t: "⚠️ RAMS — Welding/Hot Works", s: "RAMS-003 · Zone B · Approved ✅", p: 95, c: "#f97316" },
        { t: "🏗️ Height PTW — Roof Access", s: "PTW-007 · 6h remaining", p: 70, c: "#3b82f6" },
        { t: "🚨 Near Miss Reported", s: "INC-004 · Pending review", p: 40, c: "#ef4444" },
      ],
      nav: ["📊 Home", "📄 Docs", "👷 Workers", "🔧 Equip", "⚙️ More"],
    },
    {
      id: "survey",
      label: "PAS128 Survey",
      icon: "📐",
      kpis: [
        { v: "PAS128", l: "Standard", c: "#2dd4bf" },
        { v: "4", l: "Utilities", c: "#818cf8" },
        { v: "98%", l: "Complete", c: "#22c55e" },
        { v: "12", l: "Geo photos", c: "#38bdf8" },
      ],
      cards: [
        { t: "🗺️ Utility mapping — Zone A", s: "M4 · Gas · Confirmed · QL-B", p: 88, c: "#2dd4bf" },
        { t: "📸 Geo evidence — chamber 14", s: "GPS locked · bearing 247°", p: 100, c: "#38bdf8" },
        { t: "📋 Survey report draft", s: "AS5488 deliverable · 3 gaps", p: 62, c: "#a78bfa" },
      ],
      nav: ["📊 Home", "📄 Docs", "👷 Workers", "🔧 Equip", "⚙️ More"],
    },
    {
      id: "ptw",
      label: "Permits live",
      icon: "🔥",
      kpis: [
        { v: "5", l: "Live", c: "#22c55e" },
        { v: "2", l: "Expiring", c: "#eab308" },
        { v: "1", l: "Overdue", c: "#ef4444" },
        { v: "3", l: "SIMOPS", c: "#f97316" },
      ],
      cards: [
        { t: "🔥 Hot work — Fabrication bay", s: "Fire watch · 2h 14m left", p: 55, c: "#f97316" },
        { t: "⚡ Electrical isolation", s: "LOTO verified · Issuer signed", p: 90, c: "#eab308" },
        { t: "⛑️ Confined space entry", s: "Gas test OK · Rescue plan linked", p: 75, c: "#3b82f6" },
      ],
      nav: ["📊 Home", "📄 Docs", "👷 Workers", "🔧 Equip", "⚙️ More"],
    },
  ];
}

/** Blog tag filter for landing strip. */
export function getLandingBlogTag(marketId) {
  if (marketId === "pl") return "pl";
  if (marketId === "au") return "au";
  return "uk";
}
