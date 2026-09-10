import { useState } from "react";
import { BarChart3, ClipboardCheck, LayoutDashboard } from "lucide-react";

const SCREENS = [
  {
    id: "management",
    icon: BarChart3,
    label: "Management",
    title: "See the next decision before it becomes a delay.",
    detail: "Programme, team capacity, readiness gaps and board reporting in one private management view.",
    image: "/product/management-overview.png",
    alt: "MySafeOps Management Overview with capacity, readiness and programme information",
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label: "Operations",
    title: "One operational view for the working day.",
    detail: "Projects, expiring competencies, open records and priority actions stay visible without rebuilding a spreadsheet.",
    image: "/product/project-dashboard.png",
    alt: "MySafeOps operational dashboard with site actions and project information",
  },
  {
    id: "permits",
    icon: ClipboardCheck,
    label: "Permit control",
    title: "Issue and control permits without losing the audit trail.",
    detail: "Hot work, height, electrical, confined space, excavation and lifting workflows share the same controlled workspace.",
    image: "/product/permit-control.png",
    alt: "MySafeOps Permit to Work control screen",
  },
];

export default function LandingProductShowcase({ marketId = "uk" }) {
  const [activeId, setActiveId] = useState(SCREENS[0].id);
  const active = SCREENS.find((screen) => screen.id === activeId) || SCREENS[0];
  const title = marketId === "pl" ? "To jest prawdziwy produkt — nie wizualizacja." : "The real product — not a concept render.";
  const intro = marketId === "pl"
    ? "Zobacz działające widoki używane przez biuro, management i osoby kontrolujące pozwolenia."
    : "Explore working screens used by management, office teams and permit controllers.";

  return (
    <section className="landing-v2-product" id="product" aria-labelledby="landing-product-title">
      <div className="ctn">
        <div className="landing-v2-section-head fu">
          <span>Inside MySafeOps</span>
          <h2 id="landing-product-title">{title}</h2>
          <p>{intro}</p>
        </div>

        <div className="landing-v2-product-shell fu">
          <div className="landing-v2-product-tabs" role="tablist" aria-label="Product screens">
            {SCREENS.map((screen) => {
              const Icon = screen.icon;
              return (
                <button
                  key={screen.id}
                  type="button"
                  role="tab"
                  aria-selected={screen.id === active.id}
                  className={screen.id === active.id ? "is-active" : ""}
                  onClick={() => setActiveId(screen.id)}
                >
                  <Icon size={17} /><span>{screen.label}</span>
                </button>
              );
            })}
          </div>

          <div className="landing-v2-product-stage">
            <div className="landing-v2-product-copy">
              <span>0{SCREENS.findIndex((screen) => screen.id === active.id) + 1}</span>
              <h3>{active.title}</h3>
              <p>{active.detail}</p>
            </div>
            <div className="landing-v2-product-window">
              <div className="landing-v2-browser__bar"><i /><i /><i /><span>app.mysafeops.com</span></div>
              <img key={active.id} src={active.image} alt={active.alt} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
