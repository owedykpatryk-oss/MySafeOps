import { useEffect, useMemo, useRef, useState } from "react";
import { getHeroMockupScreens } from "../../data/landingSectionsCopy";

const ROTATE_MS = 4500;

/** @param {{ marketId?: import("../../config/markets").MarketId }} props */
export default function LandingHeroMockup({ marketId = "uk" }) {
  const screens = useMemo(() => getHeroMockupScreens(marketId), [marketId]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    setActive(0);
  }, [marketId]);

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % screens.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, screens.length]);

  const screen = screens[active] ?? screens[0];

  return (
    <div
      className="landing-hero-mockup"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) >= 48) {
          setActive((i) => (dx < 0 ? (i + 1) % screens.length : (i + screens.length - 1) % screens.length));
        }
        setPaused(false);
      }}
    >
      <div className="landing-hero-mockup__glow" aria-hidden />
      <div className="landing-hero-mockup__float">
        <div className="ph landing-hero-mockup__phone" role="img" aria-label={`MySafeOps ${screen.label} preview`}>
          <div className="ps">
            <div className="phd">
              <div className="pl">⚙️ MySafeOps</div>
              <div className="landing-hero-mockup__dots" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="pb">
              <div className="landing-hero-mockup__screen-title">
                {screen.icon} {screen.label}
              </div>
              <div className="landing-hero-mockup__kpis">
                {screen.kpis.map((k) => (
                  <div key={k.l} className="landing-hero-mockup__kpi" style={{ borderLeftColor: k.c }}>
                    <strong>{k.v}</strong>
                    <span>{k.l}</span>
                  </div>
                ))}
              </div>
              <div className="landing-hero-mockup__cards" key={screen.id}>
                {screen.cards.map((c) => (
                  <div key={c.t} className="pc landing-hero-mockup__card" style={{ borderLeftColor: c.c }}>
                    <div className="pct" style={{ color: c.c }}>
                      {c.t}
                    </div>
                    <div className="pcs">{c.s}</div>
                    <div className="pcb">
                      <div style={{ width: `${c.p}%`, background: c.c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pn">
              {screen.nav.map((item, i) => (
                <div key={item} style={{ color: i === 0 ? "#f97316" : undefined }}>
                  <span>{item.split(" ")[0]}</span>
                  {item.split(" ").slice(1).join(" ")}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="landing-hero-mockup__tabs landing-scroll-row" role="tablist" aria-label="Preview screens">
        {screens.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active === i}
            className="landing-hero-mockup__tab"
            data-active={active === i}
            onClick={() => setActive(i)}
          >
            <span className="landing-hero-mockup__tab-icon" aria-hidden>
              {s.icon}
            </span>
            <span className="landing-hero-mockup__tab-label">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
