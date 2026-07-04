import { useEffect, useRef, useState } from "react";

const SCREENS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "📊",
    kpis: [
      { v: "12", l: "RAMS", c: "#f97316" },
      { v: "8", l: "Permits", c: "#a78bfa" },
      { v: "2", l: "Incidents", c: "#ef4444" },
      { v: "24", l: "Workers", c: "#06b6d4" },
    ],
    cards: [
      { t: "⚠️ RAMS — Welding/Hot Works", s: "RAMS-003 · Zone B · Approved ✅", p: 95, c: "#f97316" },
      { t: "🏗️ Height PTW — Roof Access", s: "PTW-007 · 6h remaining", p: 70, c: "#3b82f6" },
      { t: "🚨 Near Miss Reported", s: "INC-004 · Pending review", p: 40, c: "#ef4444" },
    ],
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
  },
];

const ROTATE_MS = 4500;

export default function LandingHeroMockup() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SCREENS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const screen = SCREENS[active];

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
          setActive((i) => (dx < 0 ? (i + 1) % SCREENS.length : (i + SCREENS.length - 1) % SCREENS.length));
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
              {["📊 Home", "📄 Docs", "👷 Workers", "🔧 Equip", "⚙️ More"].map((item, i) => (
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
        {SCREENS.map((s, i) => (
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
