import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";
import {
  getLandingRamsPacksForTab,
  LANDING_PROFILE_SITE_FOCUS,
  LANDING_RAMS_PACK_COUNT,
  LANDING_RAMS_SECTOR_TABS,
  LANDING_WORKSPACE_PROFILES,
  loadLandingRamsPackCatalog,
} from "./landingShowcaseData";

function LandingIndustryShowcase() {
  const [ramsTab, setRamsTab] = useState("construction");
  const [activeProfile, setActiveProfile] = useState("surveyingGeodesy");
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
    () => (ramsCatalog ? getLandingRamsPacksForTab(ramsTab, ramsCatalog) : []),
    [ramsTab, ramsCatalog]
  );
  const profile = LANDING_WORKSPACE_PROFILES.find((p) => p.id === activeProfile) || LANDING_WORKSPACE_PROFILES[0];
  const profileFocus =
    LANDING_PROFILE_SITE_FOCUS[activeProfile] || LANDING_PROFILE_SITE_FOCUS.generalContractor;

  return (
    <section className="landing-industry" id="profiles">
      <div className="ctn">
        <div className="sh fu">
          <div className="badge" style={{ background: "rgba(139,92,246,.12)", color: "#6d28d9" }}>
            Depth beyond generic HSE apps
          </div>
          <h2>Pick your workspace profile — unlock the right modules</h2>
          <p>
            Nine built-in profiles tailor RAMS libraries, registers and dashboards to how you actually work — from civils contractors
            and PAS128 survey teams to food/pharma hygiene and demolition.
          </p>
        </div>

        <div className="landing-industry-stats fu" aria-label="Product library scale">
          <div>
            <strong>{LANDING_WORKSPACE_PROFILES.length}</strong>
            <span>Workspace profiles</span>
          </div>
          <div>
            <strong>{LANDING_RAMS_PACK_COUNT}+</strong>
            <span>Built-in RAMS quick packs</span>
          </div>
          <div>
            <strong>PAS128</strong>
            <span>Survey &amp; AS5488 workflows</span>
          </div>
          <div>
            <strong>Geo</strong>
            <span>Evidence photos with direction</span>
          </div>
        </div>

        <div className="landing-profile-scroll-wrap fu">
          <p className="landing-scroll-hint" aria-hidden>
            Swipe profiles →
          </p>
          <div className="landing-profile-grid landing-scroll-row" role="tablist" aria-label="Workspace profiles">
            {LANDING_WORKSPACE_PROFILES.filter((p) => p.id !== "showEverything").map((p) => {
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
                  {p.survey ? <span className="landing-profile-card__tag">Survey workflow</span> : null}
                  {p.food ? <span className="landing-profile-card__tag landing-profile-card__tag--food">Hygiene registers</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="landing-profile-detail fu landing-profile-detail--glow" aria-live="polite">
          <p className="landing-profile-detail__kicker">Selected profile</p>
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
          <Link to="/login" className="btn btn-p landing-btn-glow" {...loginLinkPrefetchProps}>
            Start evaluation with this profile →
          </Link>
        </aside>
      </div>

      <div className="landing-rams">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
              RAMS quick packs
            </div>
            <h2>Trade libraries you can seed in one click</h2>
            <p>
              Pre-built hazard rows with controls, PPE, regs and permit links — groundworks, utilities, PAS128 utility intelligence,
              site investigation, food factory M&amp;E and more. Not blank templates.
            </p>
          </div>

          <div className="landing-rams-tabs-wrap fu">
            <p className="landing-scroll-hint landing-scroll-hint--dark" aria-hidden>
              Swipe sectors →
            </p>
            <div className="landing-rams-tabs landing-scroll-row" role="tablist" aria-label="RAMS pack sectors">
              {LANDING_RAMS_SECTOR_TABS.map((tab) => (
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
                  {pack.pinned ? <span className="landing-rams-card__pin">Core pack</span> : null}
                  <h4>{pack.name}</h4>
                  <p>{pack.description}</p>
                  <span className="landing-rams-card__meta">{pack.hazardCount} hazard rows</span>
                </article>
              ))
            )}
          </div>

          {ramsCatalog && ramsPacks.length > 8 ? (
            <p className="landing-rams-more fu">
              + {ramsPacks.length - 8} more in this sector — full library unlocked during your 14-day evaluation.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default LandingIndustryShowcase;
