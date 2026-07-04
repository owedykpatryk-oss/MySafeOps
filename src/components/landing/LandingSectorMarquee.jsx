const SECTORS = [
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

export default function LandingSectorMarquee() {
  const items = [...SECTORS, ...SECTORS];

  return (
    <div className="landing-marquee-wrap" aria-hidden>
      <div className="landing-marquee">
        {items.map((label, i) => (
          <span key={`${label}-${i}`} className="landing-marquee-chip">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
