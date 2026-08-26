/** @typedef {import("../../config/markets").MarketId} MarketId */

const SECTORS_UK = [
  "General construction",
  "Utilities & civils",
  "PAS128 surveying",
  "Highways & TM",
  "Rail trackside",
  "Demolition",
  "Food & pharma",
  "Facilities M&E",
  "Industrial shutdown",
  "Geo evidence",
  "CDM 2015 registers",
  "RIDDOR workflows",
];

const SECTORS_AU = [
  "Commercial build",
  "Civil & utilities",
  "SWMS packs",
  "WHS legislation",
  "Rail & infrastructure",
  "Demolition",
  "Confined space",
  "Hot work PTW",
  "Plant & lifting",
  "Geo evidence",
  "Model WHS codes",
  "Notifiable incidents",
];

const SECTORS_PL = [
  "Budownictwo ogólne",
  "Instalacje M&E",
  "IBWR i plan BIOZ",
  "Pozwolenia na pracę",
  "Prace na wysokości",
  "Prace gorące",
  "Demontaż",
  "Rusztowania UDT",
  "Substancje niebezp.",
  "Zdjęcia geo",
  "Rejestr PIP",
  "Podwykonawcy",
];

const SECTORS_DE = [
  "Hochbau",
  "Tiefbau und Leitungen",
  "GBU und SiGe-Plan",
  "Erlaubnisscheine",
  "Absturzgefährdung",
  "Heißarbeiten",
  "Abbruch",
  "Gerüste",
  "Gefahrstoffe",
  "Geo-Fotos",
  "Unfallanzeige",
  "Nachunternehmer",
];

const SECTORS_AT = [
  "Hochbau",
  "Tiefbau und Leitungen",
  "Evaluierung und SiGe-Plan",
  "Erlaubnisscheine",
  "Absturzgefährdung",
  "Heißarbeiten",
  "Abbruch",
  "Gerüste",
  "Gefahrstoffe",
  "Geo-Fotos",
  "AUVA Unfallanzeige",
  "Nachunternehmer",
];

const SECTORS_CH = [
  "Hochbau",
  "Tiefbau und Leitungen",
  "Gefährdungsermittlung und SiKo",
  "Freigaben",
  "Absturzgefährdung",
  "Heissarbeiten",
  "Abbruch",
  "Gerüste",
  "Gefahrstoffe",
  "Geo-Fotos",
  "Suva Unfallmeldung",
  "Nachunternehmer",
];

/** @param {MarketId} marketId */
function sectorsFor(marketId) {
  if (marketId === "pl") return SECTORS_PL;
  if (marketId === "de") return SECTORS_DE;
  if (marketId === "at") return SECTORS_AT;
  if (marketId === "ch") return SECTORS_CH;
  if (marketId === "au") return SECTORS_AU;
  return SECTORS_UK;
}

/** @param {{ marketId?: MarketId }} props */
export default function LandingSectorMarquee({ marketId = "uk" }) {
  const sectors = sectorsFor(marketId);
  const items = [...sectors, ...sectors];

  return (
    <div className="landing-marquee-wrap" aria-hidden>
      <div className={`landing-marquee landing-marquee--${marketId}`}>
        {items.map((label, i) => (
          <span key={`${label}-${i}`} className="landing-marquee-chip">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
