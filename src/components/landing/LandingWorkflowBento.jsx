import { Link } from "react-router-dom";
import { ClipboardCheck, Download, FileCheck2, SlidersHorizontal } from "lucide-react";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";
import { getLandingSectionsCopy } from "../../data/landingSectionsCopy";
import { getMarket } from "../../config/markets";

/** @param {{ marketId?: import("../../config/markets").MarketId }} props */
export default function LandingWorkflowBento({ marketId = "uk" }) {
  const copy = getLandingSectionsCopy(marketId);
  const loginTo = getMarket(marketId).loginPath;
  const icons = [SlidersHorizontal, FileCheck2, ClipboardCheck, Download];

  return (
    <section className="landing-bento" id="workflow">
      <div className="ctn">
        <div className="sh fu">
          <div className="badge" style={{ background: "rgba(249,115,22,.12)", color: "var(--org-d)" }}>
            {copy.workflow.badge}
          </div>
          <h2>{copy.workflow.title}</h2>
          <p>{copy.workflow.intro}</p>
        </div>

        <div className="landing-bento-grid fu">
          {copy.workflow.steps.map((step, i) => {
            const Icon = icons[i];
            return (
              <article key={step.id} className="landing-bento-card" style={{ "--bento-delay": `${i * 60}ms` }}>
                <span className="landing-bento-card__step">{String(i + 1).padStart(2, "0")}</span>
                <span className="landing-bento-card__icon" aria-hidden><Icon size={20} /></span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            );
          })}
        </div>

        <div className="landing-bento-cta fu">
          <Link to={loginTo} className="btn btn-p landing-btn-glow" {...loginLinkPrefetchProps}>
            {copy.workflow.startEval}
          </Link>
          <a href="#profiles" className="btn btn-o">
            {copy.workflow.exploreProfiles}
          </a>
        </div>
      </div>
    </section>
  );
}
