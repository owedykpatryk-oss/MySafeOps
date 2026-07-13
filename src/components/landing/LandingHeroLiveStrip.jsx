import { useEffect, useState } from "react";

/** @typedef {{ dot: string; label: string; tone?: "ok" | "warn" | "live" }} LiveChip */

/** @type {Record<import("../../config/markets").MarketId, LiveChip[]>} */
const CHIPS_BY_MARKET = {
  uk: [
    { dot: "live", label: "5 permits live", tone: "live" },
    { dot: "warn", label: "2 expiring today", tone: "warn" },
    { dot: "ok", label: "RAMS approved", tone: "ok" },
    { dot: "ok", label: "14 workers on site", tone: "ok" },
  ],
  au: [
    { dot: "live", label: "5 permits live", tone: "live" },
    { dot: "warn", label: "2 expiring today", tone: "warn" },
    { dot: "ok", label: "SWMS approved", tone: "ok" },
    { dot: "ok", label: "White Card matrix OK", tone: "ok" },
  ],
  pl: [
    { dot: "live", label: "5 PTW aktywnych", tone: "live" },
    { dot: "warn", label: "2 wygasa dziś", tone: "warn" },
    { dot: "ok", label: "IOR zatwierdzona", tone: "ok" },
    { dot: "ok", label: "14 pracowników na budowie", tone: "ok" },
  ],
};

/** @param {{ marketId?: import("../../config/markets").MarketId }} props */
export default function LandingHeroLiveStrip({ marketId = "uk" }) {
  const chips = CHIPS_BY_MARKET[marketId] ?? CHIPS_BY_MARKET.uk;
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return undefined;
    const id = window.setInterval(() => setActive((i) => (i + 1) % chips.length), 3200);
    return () => window.clearInterval(id);
  }, [chips.length]);

  return (
    <div className="landing-live-strip" aria-live="polite" aria-atomic="true">
      <span className="landing-live-strip__beacon" aria-hidden />
      <span className="landing-live-strip__label">
        {marketId === "pl" ? "Na budowie teraz" : marketId === "au" ? "On site now" : "On site now"}
      </span>
      <div className="landing-live-strip__chips">
        {chips.map((chip, i) => (
          <span
            key={chip.label}
            className="landing-live-chip"
            data-tone={chip.tone}
            data-active={i === active}
          >
            <span className="landing-live-chip__dot" aria-hidden />
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
