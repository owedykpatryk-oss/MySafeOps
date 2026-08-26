const MARKET_COMPLIANCE_COPY = {
  uk: {
    firstAidLead: "Trained personnel and kit locations aligned with the site first-aid needs assessment.",
    firstAidQualificationHint: "FAW / EFAW or equivalent",
    liftingBasis: "LOLER / BS 7121 duties remain with competent persons on site.",
    welfareBasis: "CDM 2015 Schedule 2 / site rules — record the facilities applicable to this setup.",
    statutoryReportingNote: "This report does not replace statutory reporting, including RIDDOR notification to HSE.",
  },
  au: {
    firstAidLead: "Trained first aiders and equipment locations for the workplace first-aid plan.",
    firstAidQualificationHint: "Current first aid certificate / competency",
    liftingBasis: "Apply the relevant WHS plant, lifting and high-risk-work requirements for your state or territory.",
    welfareBasis: "Record workplace facilities against the applicable WHS requirements and site arrangements.",
    statutoryReportingNote: "This report does not replace immediate notification to the relevant state or territory WHS regulator.",
  },
  pl: {
    firstAidLead: "Osoby wyznaczone do udzielania pierwszej pomocy oraz lokalizacje apteczek na budowie.",
    firstAidQualificationHint: "Szkolenie / kwalifikacje z pierwszej pomocy",
    liftingBasis: "Stosuj wymagania UDT, instrukcje urządzenia i zasady bezpiecznej organizacji prac transportowych.",
    welfareBasis: "Rejestruj zaplecze higieniczno-sanitarne zgodnie z polskimi wymaganiami BHP i organizacją budowy.",
    statutoryReportingNote: "Raport nie zastępuje ustawowych zawiadomień, w tym zgłoszeń do PIP, prokuratora lub ZUS, gdy są wymagane.",
  },
  de: {
    firstAidLead: "Ersthelfer, Qualifikationen und Standorte der Erste-Hilfe-Ausstattung auf der Baustelle.",
    firstAidQualificationHint: "Erste-Hilfe-Ausbildung / Fortbildung",
    liftingBasis: "BetrSichV, DGUV-Regeln, Herstellerangaben und die betriebliche Gefährdungsbeurteilung sind zu beachten.",
    welfareBasis: "Baustelleneinrichtungen nach ArbStättV, den einschlägigen ASR und der Gefährdungsbeurteilung dokumentieren.",
    statutoryReportingNote: "Der Bericht ersetzt keine gesetzliche Unfallanzeige an den zuständigen Unfallversicherungsträger oder eine Behördenmeldung.",
  },
  at: {
    firstAidLead: "Ersthelfer, Qualifikationen und Standorte der Erste-Hilfe-Ausstattung auf der Baustelle.",
    firstAidQualificationHint: "Ersthelfer-Ausbildung / Auffrischung",
    liftingBasis: "ASchG, AM-VO, BauV, Herstellerangaben und die Arbeitsplatzevaluierung sind zu beachten.",
    welfareBasis: "Sanitär- und Sozialeinrichtungen nach den österreichischen Arbeitsschutzvorgaben und der Baustellenevaluierung dokumentieren.",
    statutoryReportingNote: "Der Bericht ersetzt keine gesetzlich erforderliche Meldung, insbesondere an AUVA oder Arbeitsinspektion.",
  },
  ch: {
    firstAidLead: "Ersthelfende Personen und Standorte der Erste-Hilfe-Ausstattung auf der Baustelle.",
    firstAidQualificationHint: "Nothilfe- / Betriebsersthelfer-Ausbildung",
    liftingBasis: "VUV, BauAV, Herstellerangaben und die betriebliche Gefährdungsbeurteilung sind zu beachten.",
    welfareBasis: "Sanitär- und Aufenthaltsbereiche nach den schweizerischen Arbeitsschutzvorgaben und der Baustellenorganisation dokumentieren.",
    statutoryReportingNote: "Der Bericht ersetzt keine gesetzlich erforderliche Unfallmeldung, insbesondere an den Unfallversicherer oder die zuständige Behörde.",
  },
};

export function getMarketComplianceCopy(marketId = "uk") {
  return MARKET_COMPLIANCE_COPY[marketId] || MARKET_COMPLIANCE_COPY.uk;
}
