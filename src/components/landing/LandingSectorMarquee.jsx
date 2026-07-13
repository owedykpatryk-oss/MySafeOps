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
  "IOR i plan BHP",
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

/** @param {MarketId} marketId */
function sectorsFor(marketId) {
  if (marketId === "pl") return SECTORS_PL;
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
