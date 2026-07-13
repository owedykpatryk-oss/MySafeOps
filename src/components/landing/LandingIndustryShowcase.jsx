import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";
import {
  getLandingProfileFocus,
  getLandingRamsPacksForTabMarket,
  getLandingRamsSectorTabs,
  getLandingWorkspaceProfiles,
  LANDING_RAMS_PACK_COUNT,
  loadLandingRamsPackCatalog,
} from "./landingShowcaseData";
import { getIndustryShowcaseUiCopy } from "../../data/appUiCopy";
import { getLandingSectionsCopy } from "../../data/landingSectionsCopy";
import { getRamsShortLabel } from "../../utils/marketLabels";
import { getMarket } from "../../config/markets";

/** @param {{ marketId?: import("../../config/markets").MarketId }} props */
function LandingIndustryShowcase({ marketId = "uk" }) {
  const market = getMarket(marketId);
  const sectionCopy = getLandingSectionsCopy(marketId);
  const ui = getIndustryShowcaseUiCopy(marketId);
  const ramsShort = getRamsShortLabel(marketId);
  const profiles = useMemo(() => getLandingWorkspaceProfiles(marketId), [marketId]);
  const sectorTabs = useMemo(() => getLandingRamsSectorTabs(marketId), [marketId]);
  const [ramsTab, setRamsTab] = useState("construction");
  const [activeProfile, setActiveProfile] = useState(marketId === "pl" ? "generalContractor" : "surveyingGeodesy");
  const [ramsCatalog, setRamsCatalog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadLandingRamsPackCatalog()
      .then((catalog) => {
        if (!cancelled) setRamsCatalog(catalog);
      })
      .catch(() => {
        if (!cancelled) setRamsCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ramsPacks = useMemo(
    () => (ramsCatalog ? getLandingRamsPacksForTabMarket(ramsTab, ramsCatalog, marketId) : []),
    [ramsTab, ramsCatalog, marketId]
  );
  const profile = profiles.find((p) => p.id === activeProfile) || profiles[0];
  const profileFocus = getLandingProfileFocus(activeProfile, marketId);

  return (
    <section className="landing-industry" id="profiles">
      <div className="ctn">
        <div className="sh fu">
          <div className="badge" style={{ background: "rgba(139,92,246,.12)", color: "#6d28d9" }}>
            {sectionCopy.industry.badge}
          </div>
          <h2>{sectionCopy.industry.title}</h2>
          <p>{sectionCopy.industry.intro}</p>
        </div>

        <div className="landing-industry-stats fu" aria-label="Product library scale">
          <div>
            <strong>{profiles.length}</strong>
            <span>{sectionCopy.industry.profilesStat}</span>
          </div>
          <div>
            <strong>{LANDING_RAMS_PACK_COUNT}+</strong>
            <span>{marketId === "pl" ? `Pakiety ${ramsShort}` : marketId === "au" ? `Built-in ${ramsShort} quick packs` : "Built-in RAMS quick packs"}</span>
          </div>
          <div>
            <strong>{marketId === "pl" ? "BHP" : marketId === "au" ? "WHS" : "PAS128"}</strong>
            <span>{marketId === "pl" ? "Plan i rejestry BHP" : marketId === "au" ? "WHS & model codes" : "Survey & AS5488 workflows"}</span>
          </div>
          <div>
            <strong>Geo</strong>
            <span>{marketId === "pl" ? "Zdjęcia z kierunkiem" : "Evidence photos with direction"}</span>
          </div>
        </div>

        <div className="landing-profile-scroll-wrap fu">
          <p className="landing-scroll-hint" aria-hidden>
            {ui.swipeProfiles}
          </p>
          <div className="landing-profile-grid landing-scroll-row" role="tablist" aria-label="Workspace profiles">
            {profiles.filter((p) => p.id !== "showEverything").map((p) => {
              const active = activeProfile === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="landing-profile-card"
                  data-active={active}
                  onClick={() => setActiveProfile(p.id)}
                >
                  <span className="landing-profile-card__icon" aria-hidden>
                    {p.icon}
                  </span>
                  <strong>{p.label}</strong>
                  <small>{p.hint}</small>
                  {p.survey ? <span className="landing-profile-card__tag">{ui.surveyTag}</span> : null}
                  {p.food ? <span className="landing-profile-card__tag landing-profile-card__tag--food">{ui.hygieneTag}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="landing-profile-detail fu landing-profile-detail--glow" aria-live="polite">
          <p className="landing-profile-detail__kicker">{ui.selectedProfile}</p>
          <h3>
            {profile.icon} {profile.label}
          </h3>
          <p>{profile.hint}</p>
          {profileFocus?.length ? (
            <ul className="landing-profile-detail__focus">
              {profileFocus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <Link to={market.loginPath} className="btn btn-p landing-btn-glow" {...loginLinkPrefetchProps}>
            {ui.cta}
          </Link>
        </aside>
      </div>

      <div className="landing-rams">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
              {ui.ramsBadge}
            </div>
            <h2>{ui.ramsTitle}</h2>
            <p>{ui.ramsIntro}</p>
          </div>

          <div className="landing-rams-tabs-wrap fu">
            <p className="landing-scroll-hint landing-scroll-hint--dark" aria-hidden>
              {ui.swipeSectors}
            </p>
            <div className="landing-rams-tabs landing-scroll-row" role="tablist" aria-label={ui.ramsSectorsAria}>
              {sectorTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={ramsTab === tab.id}
                  className="landing-rams-tab"
                  data-active={ramsTab === tab.id}
                  onClick={() => setRamsTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="landing-rams-grid fu landing-rams-grid--animate"
            key={ramsTab}
            role="tabpanel"
            aria-busy={!ramsCatalog}
          >
            {!ramsCatalog ? (
              Array.from({ length: 4 }, (_, i) => (
                <article key={i} className="landing-rams-card landing-rams-card--skeleton" aria-hidden />
              ))
            ) : (
              ramsPacks.slice(0, 8).map((pack, i) => (
                <article key={pack.id} className="landing-rams-card" style={{ animationDelay: `${i * 50}ms` }}>
                  {pack.pinned ? <span className="landing-rams-card__pin">{ui.corePack}</span> : null}
                  <h4>{pack.name}</h4>
                  <p>{pack.description}</p>
                  <span className="landing-rams-card__meta">{ui.hazardRows(pack.hazardCount)}</span>
                </article>
              ))
            )}
          </div>

          {ramsCatalog && ramsPacks.length > 8 ? (
            <p className="landing-rams-more fu">{ui.moreInSector(ramsPacks.length - 8)}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default LandingIndustryShowcase;
