/**
 * Polskie druki BHP — definicje formularzy wypełnianych i drukowanych na budowie.
 *
 * To nie są urzędowe wzory do składania w systemach zewnętrznych, tylko formularze robocze
 * o układzie zgodnym z powszechnie stosowanymi drukami: skierowanie na badania, karta
 * szkolenia wstępnego, zaświadczenie o szkoleniu okresowym, ewidencja odzieży i ŚOI oraz
 * komplet druków powypadkowych. Wypełniony druk zapisuje się w rejestrze i drukuje na A4.
 *
 * Każdy druk ma sekcje, a każda sekcja pola. Rodzaje pól: text, textarea, date, select, check.
 */

/**
 * @typedef {{ key: string, label: string, kind?: "text"|"textarea"|"date"|"select"|"check", options?: string[], hint?: string, wide?: boolean, required?: boolean }} PlFormField
 * @typedef {{ title: string, fields: PlFormField[] }} PlFormSection
 * @typedef {{ key: string, label: string, grupa: string, opis: string, podstawa: string, sections: PlFormSection[], stopka?: string }} PlFormDef
 */

const OSOBA = [
  { key: "imieNazwisko", label: "Imię i nazwisko", required: true },
  { key: "pesel", label: "PESEL / data urodzenia" },
  { key: "stanowisko", label: "Stanowisko", required: true },
  { key: "komorka", label: "Komórka organizacyjna / budowa", wide: true },
];

/** @type {PlFormDef[]} */
export const PL_FORMS = [
  {
    key: "skierowanie_badania",
    label: "Skierowanie na badania lekarskie",
    grupa: "Badania i szkolenia",
    opis: "Skierowanie na badania wstępne, okresowe lub kontrolne — z opisem warunków pracy.",
    podstawa: "Rozporządzenie MZiOS z 30.05.1996 (badania profilaktyczne); Kodeks pracy art. 229",
    sections: [
      {
        title: "Pracownik",
        fields: [
          ...OSOBA,
          {
            key: "rodzajBadania",
            label: "Rodzaj badania",
            kind: "select",
            options: ["wstępne", "okresowe", "kontrolne"],
            required: true,
          },
        ],
      },
      {
        title: "Opis warunków pracy",
        fields: [
          { key: "opisStanowiska", label: "Określenie stanowiska i charakteru pracy", kind: "textarea", wide: true },
          {
            key: "czynnikiFizyczne",
            label: "Czynniki fizyczne (hałas, drgania, mikroklimat, oświetlenie)",
            kind: "textarea",
            wide: true,
          },
          { key: "czynnikiPylowe", label: "Pyły (w tym krzemionka krystaliczna)", kind: "textarea", wide: true },
          { key: "czynnikiChemiczne", label: "Czynniki chemiczne i biologiczne", kind: "textarea", wide: true },
          {
            key: "czynnikiUciazliwe",
            label: "Czynniki uciążliwe (dźwiganie, wymuszona pozycja, praca zmianowa)",
            kind: "textarea",
            wide: true,
          },
          { key: "wysokosc", label: "Praca na wysokości powyżej 3 m", kind: "check" },
          { key: "maszyny", label: "Obsługa maszyn w ruchu / urządzeń UDT", kind: "check" },
          { key: "kierowanie", label: "Kierowanie pojazdem służbowym", kind: "check" },
          { key: "wynikiPomiarow", label: "Aktualne wyniki pomiarów czynników szkodliwych", kind: "textarea", wide: true },
        ],
      },
      {
        title: "Wystawienie",
        fields: [
          { key: "miejscowosc", label: "Miejscowość" },
          { key: "dataWystawienia", label: "Data wystawienia", kind: "date", required: true },
          { key: "wystawil", label: "Wystawił (pracodawca / osoba upoważniona)", wide: true },
        ],
      },
    ],
    stopka:
      "Skierowanie wystawia pracodawca. Orzeczenie lekarskie wydaje lekarz medycyny pracy — bez ważnego orzeczenia nie wolno dopuścić pracownika do pracy.",
  },
  {
    key: "karta_szkolenia_wstepnego",
    label: "Karta szkolenia wstępnego BHP",
    grupa: "Badania i szkolenia",
    opis: "Instruktaż ogólny i instruktaż stanowiskowy — karta przechowywana w aktach osobowych.",
    podstawa: "Rozporządzenie MGiP z 27.07.2004 (szkolenie w dziedzinie BHP)",
    sections: [
      { title: "Pracownik", fields: OSOBA },
      {
        title: "Instruktaż ogólny",
        fields: [
          { key: "ogolnyData", label: "Data instruktażu", kind: "date" },
          { key: "ogolnyProwadzacy", label: "Prowadzący instruktaż (imię, nazwisko, stanowisko)", wide: true },
          { key: "ogolnyCzas", label: "Liczba godzin" },
        ],
      },
      {
        title: "Instruktaż stanowiskowy",
        fields: [
          { key: "stanowiskowyStanowisko", label: "Stanowisko pracy", wide: true },
          { key: "stanowiskowyDataOd", label: "Data rozpoczęcia", kind: "date" },
          { key: "stanowiskowyDataDo", label: "Data zakończenia", kind: "date" },
          { key: "stanowiskowyProwadzacy", label: "Prowadzący instruktaż", wide: true },
          { key: "stanowiskowyCzas", label: "Liczba godzin" },
          {
            key: "zakres",
            label: "Zakres instruktażu (zagrożenia, środki ochrony, IBWR, postępowanie awaryjne)",
            kind: "textarea",
            wide: true,
          },
          { key: "ryzykoOmowione", label: "Omówiono ocenę ryzyka zawodowego na stanowisku", kind: "check" },
          { key: "soiPrzekazane", label: "Przekazano środki ochrony indywidualnej", kind: "check" },
        ],
      },
    ],
    stopka:
      "Odbycie instruktażu pracownik potwierdza podpisem. Karta jest przechowywana w aktach osobowych pracownika.",
  },
  {
    key: "zaswiadczenie_okresowe",
    label: "Zaświadczenie — szkolenie okresowe BHP",
    grupa: "Badania i szkolenia",
    opis: "Zaświadczenie o ukończeniu szkolenia okresowego dla stanowisk robotniczych lub kierowniczych.",
    podstawa: "Rozporządzenie MGiP z 27.07.2004 (szkolenie w dziedzinie BHP)",
    sections: [
      { title: "Uczestnik", fields: OSOBA },
      {
        title: "Szkolenie",
        fields: [
          {
            key: "grupaStanowisk",
            label: "Grupa stanowisk",
            kind: "select",
            options: [
              "pracownicy na stanowiskach robotniczych",
              "pracodawcy i inne osoby kierujące pracownikami",
              "pracownicy inżynieryjno-techniczni",
              "pracownicy służby BHP",
              "pracownicy administracyjno-biurowi",
            ],
            required: true,
          },
          { key: "forma", label: "Forma szkolenia", kind: "select", options: ["instruktaż", "kurs", "seminarium", "samokształcenie kierowane"] },
          { key: "dataOd", label: "Data rozpoczęcia", kind: "date" },
          { key: "dataDo", label: "Data zakończenia", kind: "date", required: true },
          { key: "liczbaGodzin", label: "Liczba godzin" },
          { key: "organizator", label: "Organizator szkolenia", wide: true },
          { key: "programRamowy", label: "Program szkolenia / zakres tematyczny", kind: "textarea", wide: true },
          { key: "wynikSprawdzianu", label: "Wynik sprawdzianu wiedzy", kind: "select", options: ["pozytywny", "negatywny"] },
          { key: "waznoscDo", label: "Ważne do", kind: "date", hint: "Robotnicze zwykle 3 lata, kierownicze 5 lat" },
        ],
      },
    ],
    stopka: "Zaświadczenie podpisuje organizator szkolenia. Kopię przechowuje się w aktach osobowych pracownika.",
  },
  {
    key: "karta_odziezy",
    label: "Karta ewidencji odzieży roboczej i ŚOI",
    grupa: "Środki ochrony",
    opis: "Wydania odzieży roboczej, obuwia i środków ochrony indywidualnej z potwierdzeniem odbioru.",
    podstawa: "Kodeks pracy art. 2376–2379; Rozporządzenie — ogólne przepisy BHP, załącznik nr 2",
    sections: [
      { title: "Pracownik", fields: OSOBA },
      {
        title: "Wydanie",
        fields: [
          { key: "przedmiot", label: "Odzież / obuwie / ŚOI", required: true, wide: true },
          { key: "norma", label: "Norma lub kategoria (np. EN 397, FFP3)" },
          { key: "rozmiar", label: "Rozmiar" },
          { key: "ilosc", label: "Ilość" },
          { key: "dataWydania", label: "Data wydania", kind: "date", required: true },
          { key: "okresUzywalnosci", label: "Przewidywany okres używalności" },
          { key: "dataZwrotu", label: "Data zwrotu / wymiany", kind: "date" },
          { key: "instruktaz", label: "Przekazano instrukcję użytkowania", kind: "check" },
          { key: "uwagi", label: "Uwagi", kind: "textarea", wide: true },
        ],
      },
    ],
    stopka: "Odbiór wyposażenia pracownik potwierdza podpisem. Ekwiwalent nie przysługuje za środki ochrony indywidualnej.",
  },
  {
    key: "zgloszenie_wypadku_pracownika",
    label: "Zgłoszenie wypadku przy pracy — pracownik",
    grupa: "Wypadki",
    opis: "Zgłoszenie zdarzenia przez poszkodowanego pracownika lub świadka — punkt wyjścia do postępowania.",
    podstawa: "Rozporządzenie RM z 1.07.2009 (ustalanie okoliczności i przyczyn wypadków przy pracy)",
    sections: [
      { title: "Poszkodowany", fields: OSOBA },
      {
        title: "Zdarzenie",
        fields: [
          { key: "dataZdarzenia", label: "Data zdarzenia", kind: "date", required: true },
          { key: "godzina", label: "Godzina" },
          { key: "miejsce", label: "Miejsce zdarzenia", wide: true, required: true },
          { key: "czynnosc", label: "Wykonywana czynność w chwili zdarzenia", kind: "textarea", wide: true },
          { key: "przebieg", label: "Przebieg zdarzenia", kind: "textarea", wide: true, required: true },
          { key: "skutki", label: "Doznane urazy", kind: "textarea", wide: true },
          { key: "pomoc", label: "Udzielona pomoc / placówka medyczna", kind: "textarea", wide: true },
          { key: "swiadkowie", label: "Świadkowie (imię, nazwisko, kontakt)", kind: "textarea", wide: true },
        ],
      },
      {
        title: "Zgłoszenie",
        fields: [
          { key: "dataZgloszenia", label: "Data zgłoszenia", kind: "date", required: true },
          { key: "zglaszajacy", label: "Zgłaszający", wide: true },
          { key: "przyjmujacy", label: "Przyjmujący zgłoszenie", wide: true },
        ],
      },
    ],
    stopka:
      "Zgłoszenie uruchamia powołanie zespołu powypadkowego. Przy wypadku śmiertelnym, ciężkim lub zbiorowym pracodawca zawiadamia niezwłocznie okręgowego inspektora pracy i prokuratora.",
  },
  {
    key: "zgloszenie_wypadku_niepracownika",
    label: "Zgłoszenie wypadku — osoba niebędąca pracownikiem",
    grupa: "Wypadki",
    opis: "Zdarzenie z udziałem zleceniobiorcy, praktykanta, gościa lub podwykonawcy — podstawa do karty wypadku.",
    podstawa: "Ustawa o ubezpieczeniu społecznym z tytułu wypadków przy pracy i chorób zawodowych",
    sections: [
      {
        title: "Poszkodowany",
        fields: [
          { key: "imieNazwisko", label: "Imię i nazwisko", required: true },
          { key: "pesel", label: "PESEL / data urodzenia" },
          {
            key: "tytulUbezpieczenia",
            label: "Podstawa wykonywania pracy",
            kind: "select",
            options: ["umowa zlecenia", "umowa o dzieło", "samozatrudnienie / B2B", "praktykant / stażysta", "wolontariusz", "inna"],
          },
          { key: "podmiotZlecajacy", label: "Podmiot zlecający / firma", wide: true },
        ],
      },
      {
        title: "Zdarzenie",
        fields: [
          { key: "dataZdarzenia", label: "Data zdarzenia", kind: "date", required: true },
          { key: "godzina", label: "Godzina" },
          { key: "miejsce", label: "Miejsce zdarzenia", wide: true, required: true },
          { key: "przebieg", label: "Przebieg zdarzenia", kind: "textarea", wide: true, required: true },
          { key: "skutki", label: "Doznane urazy", kind: "textarea", wide: true },
          { key: "swiadkowie", label: "Świadkowie", kind: "textarea", wide: true },
        ],
      },
      {
        title: "Zgłoszenie",
        fields: [
          { key: "dataZgloszenia", label: "Data zgłoszenia", kind: "date", required: true },
          { key: "zglaszajacy", label: "Zgłaszający", wide: true },
        ],
      },
    ],
    stopka: "Dla osoby niebędącej pracownikiem okoliczności i przyczyny zdarzenia dokumentuje się kartą wypadku.",
  },
  {
    key: "protokol_powypadkowy",
    label: "Protokół ustalenia okoliczności i przyczyn wypadku przy pracy",
    grupa: "Wypadki",
    opis: "Protokół zespołu powypadkowego — ustalenia, przyczyny, kwalifikacja prawna i wnioski profilaktyczne.",
    podstawa: "Rozporządzenie MRPiPS z 24.05.2019 (wzór protokołu); Rozporządzenie RM z 1.07.2009",
    sections: [
      {
        title: "Zespół powypadkowy",
        fields: [
          { key: "numerProtokolu", label: "Numer protokołu", required: true },
          { key: "czlonek1", label: "Członek zespołu (służba BHP)", wide: true },
          { key: "czlonek2", label: "Członek zespołu (społeczny inspektor pracy / przedstawiciel)", wide: true },
          { key: "dataPowolania", label: "Data powołania zespołu", kind: "date" },
        ],
      },
      { title: "Poszkodowany", fields: OSOBA },
      {
        title: "Ustalenia",
        fields: [
          { key: "dataZdarzenia", label: "Data i godzina zdarzenia", required: true },
          { key: "dataZgloszenia", label: "Data zgłoszenia wypadku", kind: "date" },
          { key: "miejsce", label: "Miejsce zdarzenia", wide: true },
          { key: "okolicznosci", label: "Ustalone okoliczności wypadku", kind: "textarea", wide: true, required: true },
          { key: "przyczyny", label: "Ustalone przyczyny wypadku", kind: "textarea", wide: true, required: true },
          {
            key: "naruszenia",
            label: "Stwierdzone naruszenia przepisów przez pracodawcę (ze wskazaniem przepisów)",
            kind: "textarea",
            wide: true,
          },
          {
            key: "naruszeniaPracownik",
            label: "Stwierdzone naruszenie przepisów przez poszkodowanego",
            kind: "textarea",
            wide: true,
          },
          { key: "stanNietrzezwosci", label: "Stan nietrzeźwości / środki odurzające", kind: "select", options: ["nie stwierdzono", "stwierdzono", "nie badano"] },
        ],
      },
      {
        title: "Kwalifikacja",
        fields: [
          {
            key: "kwalifikacja",
            label: "Kwalifikacja prawna zdarzenia",
            kind: "select",
            options: [
              "wypadek przy pracy",
              "wypadek traktowany na równi z wypadkiem przy pracy",
              "nie jest wypadkiem przy pracy",
            ],
            required: true,
          },
          { key: "rodzajWypadku", label: "Rodzaj wypadku", kind: "select", options: ["indywidualny", "zbiorowy", "ciężki", "śmiertelny"] },
          { key: "skutki", label: "Skutki wypadku", kind: "textarea", wide: true },
          { key: "wnioski", label: "Wnioski i środki profilaktyczne", kind: "textarea", wide: true, required: true },
          { key: "dataSporzadzenia", label: "Data sporządzenia protokołu", kind: "date", required: true },
          { key: "zapoznanie", label: "Poszkodowany / rodzina zapoznani z treścią protokołu", kind: "check" },
          { key: "zastrzezenia", label: "Zgłoszone zastrzeżenia", kind: "textarea", wide: true },
          { key: "dataZatwierdzenia", label: "Data zatwierdzenia przez pracodawcę", kind: "date" },
        ],
      },
    ],
    stopka:
      "Protokół sporządza się nie później niż w terminie 14 dni od uzyskania zawiadomienia o wypadku. Zatwierdza go pracodawca.",
  },
  {
    key: "karta_wypadku",
    label: "Karta wypadku",
    grupa: "Wypadki",
    opis: "Karta wypadku dla osób niebędących pracownikami — zamiast protokołu powypadkowego.",
    podstawa: "Rozporządzenie MPiPS w sprawie wzoru karty wypadku",
    sections: [
      {
        title: "Poszkodowany",
        fields: [
          { key: "imieNazwisko", label: "Imię i nazwisko", required: true },
          { key: "pesel", label: "PESEL / data urodzenia" },
          { key: "tytulUbezpieczenia", label: "Tytuł ubezpieczenia wypadkowego", wide: true },
          { key: "podmiotZlecajacy", label: "Podmiot, na rzecz którego wykonywana była praca", wide: true },
        ],
      },
      {
        title: "Zdarzenie",
        fields: [
          { key: "dataZdarzenia", label: "Data i godzina zdarzenia", required: true },
          { key: "miejsce", label: "Miejsce zdarzenia", wide: true },
          { key: "okolicznosci", label: "Okoliczności wypadku", kind: "textarea", wide: true, required: true },
          { key: "przyczyny", label: "Przyczyny wypadku", kind: "textarea", wide: true, required: true },
          { key: "skutki", label: "Skutki wypadku", kind: "textarea", wide: true },
          { key: "swiadkowie", label: "Świadkowie", kind: "textarea", wide: true },
        ],
      },
      {
        title: "Ustalenie",
        fields: [
          {
            key: "kwalifikacja",
            label: "Kwalifikacja",
            kind: "select",
            options: ["wypadek przy pracy", "nie jest wypadkiem przy pracy"],
            required: true,
          },
          { key: "uzasadnienie", label: "Uzasadnienie kwalifikacji", kind: "textarea", wide: true },
          { key: "sporzadzil", label: "Sporządził", wide: true },
          { key: "dataSporzadzenia", label: "Data sporządzenia", kind: "date", required: true },
          { key: "zapoznanie", label: "Poszkodowany zapoznany z treścią karty", kind: "check" },
        ],
      },
    ],
    stopka: "Kartę wypadku sporządza się w terminie 14 dni od uzyskania zawiadomienia o wypadku.",
  },
  {
    key: "karta_wypadku_w_drodze",
    label: "Karta wypadku w drodze do pracy lub z pracy",
    grupa: "Wypadki",
    opis: "Zdarzenie w drodze do lub z pracy — odrębna kwalifikacja i odrębna karta.",
    podstawa: "Rozporządzenie MPiPS z 24.12.2002 (karta wypadku w drodze do pracy lub z pracy)",
    sections: [
      { title: "Poszkodowany", fields: OSOBA },
      {
        title: "Zdarzenie",
        fields: [
          { key: "dataZdarzenia", label: "Data i godzina zdarzenia", required: true },
          { key: "miejsce", label: "Miejsce zdarzenia", wide: true, required: true },
          {
            key: "kierunek",
            label: "Droga",
            kind: "select",
            options: ["do pracy", "z pracy", "do miejsca innego zatrudnienia", "z miejsca innego zatrudnienia"],
          },
          { key: "trasa", label: "Opis trasy i czy była najkrótsza / nieprzerwana", kind: "textarea", wide: true },
          { key: "okolicznosci", label: "Okoliczności zdarzenia", kind: "textarea", wide: true, required: true },
          { key: "skutki", label: "Doznane urazy", kind: "textarea", wide: true },
          { key: "swiadkowie", label: "Świadkowie", kind: "textarea", wide: true },
        ],
      },
      {
        title: "Ustalenie",
        fields: [
          {
            key: "kwalifikacja",
            label: "Kwalifikacja",
            kind: "select",
            options: ["wypadek w drodze do pracy lub z pracy", "nie jest wypadkiem w drodze"],
            required: true,
          },
          { key: "uzasadnienie", label: "Uzasadnienie", kind: "textarea", wide: true },
          { key: "sporzadzil", label: "Sporządził", wide: true },
          { key: "dataSporzadzenia", label: "Data sporządzenia", kind: "date", required: true },
        ],
      },
    ],
    stopka: "Kartę sporządza się po ustaleniu okoliczności i przyczyn zdarzenia, nie później niż w terminie 14 dni.",
  },
  {
    key: "statystyczna_karta",
    label: "Statystyczna karta wypadku (Z-KW) — arkusz roboczy",
    grupa: "Wypadki",
    opis: "Dane do statystycznej karty wypadku przekazywanej do GUS — arkusz pomocniczy przed wypełnieniem karty.",
    podstawa: "Rozporządzenie MPiPS z 7.01.2009 (statystyczna karta wypadku przy pracy)",
    sections: [
      {
        title: "Identyfikacja",
        fields: [
          { key: "numerProtokolu", label: "Numer protokołu / karty wypadku", required: true },
          { key: "dataZdarzenia", label: "Data wypadku", kind: "date", required: true },
          { key: "regon", label: "REGON pracodawcy" },
          { key: "pkd", label: "PKD — rodzaj działalności" },
        ],
      },
      {
        title: "Poszkodowany",
        fields: [
          { key: "plec", label: "Płeć", kind: "select", options: ["kobieta", "mężczyzna"] },
          { key: "wiek", label: "Wiek" },
          { key: "zawod", label: "Zawód wykonywany" },
          { key: "stazOgolem", label: "Staż pracy ogółem" },
          { key: "stazNaStanowisku", label: "Staż na stanowisku" },
        ],
      },
      {
        title: "Dane o wypadku",
        fields: [
          { key: "rodzajUrazu", label: "Rodzaj urazu", wide: true },
          { key: "umiejscowienieUrazu", label: "Umiejscowienie urazu", wide: true },
          { key: "wydarzeniePowodujace", label: "Wydarzenie powodujące uraz", kind: "textarea", wide: true },
          { key: "czynnoscWykonywana", label: "Czynność wykonywana w chwili wypadku", kind: "textarea", wide: true },
          { key: "miejsceTyp", label: "Miejsce powstania wypadku", wide: true },
          { key: "liczbaDniNiezdolnosci", label: "Liczba dni niezdolności do pracy" },
          { key: "skutekSmiertelny", label: "Skutek śmiertelny", kind: "check" },
          { key: "dataPrzekazania", label: "Data przekazania karty", kind: "date" },
        ],
      },
    ],
    stopka:
      "Część I statystycznej karty przekazuje się w terminie 14 dni roboczych od zatwierdzenia protokołu, część II uzupełnia po zakończeniu leczenia.",
  },
  {
    key: "skierowanie_sanepid",
    label: "Skierowanie na badania do celów sanitarno-epidemiologicznych",
    grupa: "Higiena i produkcja",
    opis: "Badania dla osób wykonujących prace w kontakcie z żywnością — warunek wejścia w strefę produkcyjną.",
    podstawa: "Ustawa z 5.12.2008 o zapobieganiu oraz zwalczaniu zakażeń i chorób zakaźnych u ludzi",
    sections: [
      { title: "Pracownik", fields: OSOBA },
      {
        title: "Zakres pracy",
        fields: [
          {
            key: "rodzajPracy",
            label: "Rodzaj wykonywanej pracy",
            kind: "select",
            options: [
              "prace w kontakcie z żywnością",
              "prace przy produkcji i obrocie żywnością",
              "prace wymagające kontaktu z wodą przeznaczoną do spożycia",
              "inne prace wymagające orzeczenia",
            ],
            required: true,
          },
          { key: "zakladProdukcyjny", label: "Zakład / strefa produkcyjna", wide: true },
          { key: "opisCzynnosci", label: "Opis czynności w strefie", kind: "textarea", wide: true },
          { key: "dataWystawienia", label: "Data wystawienia", kind: "date", required: true },
          { key: "wystawil", label: "Wystawił", wide: true },
        ],
      },
    ],
    stopka:
      "Bez aktualnego orzeczenia do celów sanitarno-epidemiologicznych nie wolno dopuścić pracownika do prac w kontakcie z żywnością.",
  },
  {
    key: "zezwolenie_strefa_produkcyjna",
    label: "Zezwolenie na wejście do strefy produkcyjnej",
    grupa: "Higiena i produkcja",
    opis: "Wejście ekipy serwisowej na halę — higiena, odzież, narzędzia i zgoda produkcji.",
    podstawa: "Zasady GHP/GMP zakładu; system HACCP; Rozporządzenie (WE) nr 852/2004",
    sections: [
      {
        title: "Ekipa i strefa",
        fields: [
          { key: "firmaSerwisowa", label: "Firma wykonawcza", wide: true, required: true },
          { key: "osobyWchodzace", label: "Osoby wchodzące do strefy", kind: "textarea", wide: true, required: true },
          { key: "strefa", label: "Strefa / linia", wide: true, required: true },
          {
            key: "poziomRyzyka",
            label: "Poziom strefy",
            kind: "select",
            options: ["strefa ogólna", "strefa produkcyjna", "strefa wysokiego ryzyka (high-care)", "strefa high-risk"],
            required: true,
          },
          { key: "dataOd", label: "Wejście od", kind: "date", required: true },
          { key: "dataDo", label: "Wejście do", kind: "date" },
        ],
      },
      {
        title: "Warunki higieniczne",
        fields: [
          { key: "orzeczeniaSanepid", label: "Aktualne orzeczenia sanitarno-epidemiologiczne sprawdzone", kind: "check" },
          { key: "szkolenieGhp", label: "Szkolenie GHP/GMP i zasady zakładu omówione", kind: "check" },
          { key: "odziezOchronna", label: "Odzież ochronna, obuwie i nakrycie głowy wydane", kind: "check" },
          { key: "bizuteriaZdjeta", label: "Biżuteria i przedmioty osobiste zdeponowane", kind: "check" },
          { key: "narzedziaZewidencjonowane", label: "Narzędzia policzone i zewidencjonowane przed wejściem", kind: "check" },
          { key: "szkloWniesione", label: "Szkło i twardy plastik wniesione do strefy", kind: "textarea", wide: true },
          { key: "produkcjaPoinformowana", label: "Kierownik produkcji poinformowany o zakresie prac", kind: "check" },
          { key: "zabezpieczenieProduktu", label: "Sposób zabezpieczenia produktu i linii", kind: "textarea", wide: true },
        ],
      },
      {
        title: "Zgoda",
        fields: [
          { key: "zgodaOsoba", label: "Zgody udzielił (produkcja / QA)", wide: true, required: true },
          { key: "uwagi", label: "Uwagi i ograniczenia", kind: "textarea", wide: true },
        ],
      },
    ],
    stopka: "Wyjście ze strefy wymaga rozliczenia narzędzi oraz protokołu mycia i dezynfekcji.",
  },
  {
    key: "protokol_zwolnienia_linii",
    label: "Protokół zwolnienia linii do produkcji",
    grupa: "Higiena i produkcja",
    opis: "Przekazanie linii po pracach serwisowych — narzędzia, czystość, próby i zgoda na uruchomienie.",
    podstawa: "Zasady GHP/GMP zakładu; system HACCP",
    sections: [
      {
        title: "Zakres prac",
        fields: [
          { key: "linia", label: "Linia / urządzenie", wide: true, required: true },
          { key: "firmaSerwisowa", label: "Firma wykonawcza", wide: true },
          { key: "zakresPrac", label: "Wykonany zakres prac", kind: "textarea", wide: true, required: true },
          { key: "dataZakonczenia", label: "Data zakończenia prac", kind: "date", required: true },
        ],
      },
      {
        title: "Kontrola przed uruchomieniem",
        fields: [
          { key: "narzedziaRozliczone", label: "Narzędzia rozliczone — zgodność z listą wejściową", kind: "check" },
          { key: "brakCialObcych", label: "Kontrola ciał obcych wykonana (szkło, metal, plastik)", kind: "check" },
          { key: "myciePrzeprowadzone", label: "Mycie i dezynfekcja przeprowadzone", kind: "check" },
          { key: "oslonyZalozone", label: "Osłony i zabezpieczenia zamontowane", kind: "check" },
          { key: "wykrywaczMetaliTest", label: "Test wykrywacza metali / detektora rentgenowskiego", kind: "check" },
          { key: "probaRuchowa", label: "Próba ruchowa wykonana bez produktu", kind: "check" },
          { key: "uwagiKontroli", label: "Uwagi z kontroli", kind: "textarea", wide: true },
        ],
      },
      {
        title: "Zwolnienie",
        fields: [
          { key: "zwolnilProdukcja", label: "Linię zwolnił (produkcja)", wide: true, required: true },
          { key: "zatwierdzilQa", label: "Zatwierdził (QA / dział jakości)", wide: true },
          { key: "dataZwolnienia", label: "Data i godzina zwolnienia", required: true },
        ],
      },
    ],
    stopka: "Bez podpisu produkcji i QA linia nie może zostać uruchomiona z produktem.",
  },
  {
    key: "karta_niezgodnosci",
    label: "Karta niezgodności / odchylenia",
    grupa: "Higiena i produkcja",
    opis: "Odchylenie od procedury, ciało obce lub awaria w strefie — opis, działania i weryfikacja skuteczności.",
    podstawa: "System HACCP i procedury GMP zakładu",
    sections: [
      {
        title: "Zdarzenie",
        fields: [
          { key: "numerNiezgodnosci", label: "Numer niezgodności", required: true },
          { key: "dataStwierdzenia", label: "Data stwierdzenia", kind: "date", required: true },
          { key: "zglaszajacy", label: "Zgłaszający", wide: true },
          { key: "strefa", label: "Strefa / linia / urządzenie", wide: true },
          {
            key: "kategoria",
            label: "Kategoria",
            kind: "select",
            options: [
              "ciało obce",
              "odchylenie od procedury",
              "higiena i mycie",
              "awaria urządzenia",
              "alergen / zmiana asortymentu",
              "temperatura / łańcuch chłodniczy",
              "inne",
            ],
            required: true,
          },
          { key: "opis", label: "Opis niezgodności", kind: "textarea", wide: true, required: true },
          { key: "produktWstrzymany", label: "Produkt wstrzymany / zablokowany", kind: "check" },
          { key: "zakresPartii", label: "Zakres partii objętych blokadą", kind: "textarea", wide: true },
        ],
      },
      {
        title: "Działania",
        fields: [
          {
            key: "dzialaniaNatychmiastowe",
            label: "Działania natychmiastowe (korekcja)",
            kind: "textarea",
            wide: true,
            required: true,
          },
          { key: "przyczynaZrodlowa", label: "Przyczyna źródłowa", kind: "textarea", wide: true },
          { key: "dzialaniaKorygujace", label: "Działania korygujące i zapobiegawcze", kind: "textarea", wide: true },
          { key: "odpowiedzialny", label: "Odpowiedzialny za wdrożenie", wide: true },
          { key: "terminWdrozenia", label: "Termin wdrożenia", kind: "date" },
        ],
      },
      {
        title: "Zamknięcie",
        fields: [
          { key: "weryfikacja", label: "Weryfikacja skuteczności", kind: "textarea", wide: true },
          { key: "zamknalQa", label: "Zamknął (QA)", wide: true },
          { key: "dataZamkniecia", label: "Data zamknięcia", kind: "date" },
        ],
      },
    ],
    stopka: "Kartę zamyka dział jakości po potwierdzeniu skuteczności działań, nie po samym ich zgłoszeniu.",
  },
  {
    key: "protokol_szkla",
    label: "Protokół kontroli szkła i twardego plastiku",
    grupa: "Higiena i produkcja",
    opis: "Kontrola przed i po pracach oraz postępowanie przy stłuczeniu w strefie produkcyjnej.",
    podstawa: "Rejestr szkła i twardego plastiku wymagany przez system HACCP oraz standardy BRCGS/IFS",
    sections: [
      {
        title: "Kontrola",
        fields: [
          { key: "strefa", label: "Strefa / linia", wide: true, required: true },
          { key: "dataKontroli", label: "Data kontroli", kind: "date", required: true },
          {
            key: "typKontroli",
            label: "Rodzaj kontroli",
            kind: "select",
            options: ["przed pracami", "po pracach", "okresowa", "po stłuczeniu"],
            required: true,
          },
          {
            key: "elementySprawdzone",
            label: "Sprawdzone elementy (osłony, lampy, okna, przyrządy)",
            kind: "textarea",
            wide: true,
          },
          { key: "stanBezUszkodzen", label: "Wszystkie elementy bez uszkodzeń", kind: "check" },
        ],
      },
      {
        title: "Stłuczenie",
        fields: [
          { key: "stluczenieWystapilo", label: "Wystąpiło stłuczenie", kind: "check" },
          { key: "opisStluczenia", label: "Opis zdarzenia i lokalizacja", kind: "textarea", wide: true },
          { key: "strefaOdgrodzona", label: "Strefa odgrodzona i produkcja wstrzymana", kind: "check" },
          { key: "produktUsuniety", label: "Produkt z obszaru zagrożenia usunięty", kind: "check" },
          { key: "sprzatanieWykonane", label: "Sprzątanie i kontrola powtórna wykonane", kind: "check" },
          { key: "elementWymieniony", label: "Element wymieniony na bezpieczny (osłona, tworzywo)", kind: "check" },
        ],
      },
      {
        title: "Potwierdzenie",
        fields: [
          { key: "kontrolujacy", label: "Kontrolę wykonał", wide: true, required: true },
          { key: "zatwierdzilQa", label: "Zatwierdził (QA)", wide: true },
        ],
      },
    ],
    stopka: "Protokół jest częścią rejestru szkła i twardego plastiku i podlega audytowi standardu jakości.",
  },
  {
    key: "protokol_mycia",
    label: "Protokół mycia i dezynfekcji po pracach",
    grupa: "Higiena i produkcja",
    opis: "Mycie strefy i urządzeń po pracach serwisowych — środki, stężenia i potwierdzenie skuteczności.",
    podstawa: "Zasady GHP zakładu; karty charakterystyki stosowanych środków",
    sections: [
      {
        title: "Zakres",
        fields: [
          { key: "strefa", label: "Strefa / urządzenie", wide: true, required: true },
          { key: "dataMycia", label: "Data mycia", kind: "date", required: true },
          { key: "wykonawca", label: "Mycie wykonał", wide: true, required: true },
          { key: "srodki", label: "Zastosowane środki (nazwa, stężenie, czas kontaktu)", kind: "textarea", wide: true },
          { key: "kartyCharakterystyki", label: "Karty charakterystyki dostępne na miejscu", kind: "check" },
        ],
      },
      {
        title: "Weryfikacja",
        fields: [
          { key: "splukanieWykonane", label: "Spłukanie wodą zdatną do spożycia wykonane", kind: "check" },
          { key: "kontrolaWizualna", label: "Kontrola wizualna czystości pozytywna", kind: "check" },
          { key: "wymazy", label: "Pobrano wymazy / testy czystości", kind: "check" },
          { key: "wynikiTestow", label: "Wyniki testów czystości", kind: "textarea", wide: true },
          { key: "zatwierdzilQa", label: "Zatwierdził (QA / higiena)", wide: true },
        ],
      },
    ],
    stopka: "Strefa wraca do produkcji dopiero po pozytywnej weryfikacji czystości.",
  },
];

const BY_KEY = Object.fromEntries(PL_FORMS.map((f) => [f.key, f]));

/** @param {string} key */
export function findPlForm(key) {
  return BY_KEY[String(key || "")] || null;
}

/** Grupy druków w kolejności wyświetlania. */
export function listPlFormGroups() {
  const seen = [];
  for (const f of PL_FORMS) if (!seen.includes(f.grupa)) seen.push(f.grupa);
  return seen;
}

/** Wszystkie pola druku spłaszczone do jednej listy. @param {string} key */
export function plFormFields(key) {
  const def = findPlForm(key);
  if (!def) return [];
  return def.sections.flatMap((s) => s.fields);
}

/**
 * Braki w wypełnieniu — pola oznaczone jako wymagane, których nie uzupełniono.
 * @param {string} key
 * @param {Record<string, unknown>} values
 */
export function plFormMissingFields(key, values = {}) {
  return plFormFields(key)
    .filter((f) => f.required && !String(values?.[f.key] ?? "").trim())
    .map((f) => f.label);
}

/** Etykieta druku do listy i eksportu. @param {string} key */
export function plFormLabel(key) {
  return findPlForm(key)?.label || String(key || "");
}
