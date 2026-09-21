import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  CloudCog,
  FileCheck2,
  MapPinned,
  ShieldCheck,
  Users,
} from "lucide-react";

import { loginLinkPrefetchProps, prefetchLoginPage } from "../../utils/routePrefetch";
import { getPriceAdjustmentShort } from "../../lib/billingPlans";
import { getLandingFeatures } from "../../data/landingMarketContent";
import { getLandingSectionsCopy } from "../../data/landingSectionsCopy";
import LandingProductShowcase from "./LandingProductShowcase";
import LandingWorkflowBento from "./LandingWorkflowBento";

const LandingFaqSection = lazy(() => import("./LandingFaqSection"));

const FEATURE_ICONS = [FileCheck2, ClipboardCheck, ShieldCheck, Users, BarChart3, MapPinned];

function FaqSuspenseFallback() {
  return (
    <section className="landing-faq" id="faq" aria-busy="true" aria-label="Loading FAQ">
      <div className="ctn"><div className="landing-v2-section-head"><span>FAQ</span><h2>Common questions</h2></div></div>
    </section>
  );
}

function TrustSection({ market }) {
  const isPl = market.id === "pl";
  const items = [
    {
      icon: ShieldCheck,
      title: isPl ? "Kontrolowany dostęp" : "Controlled access",
      text: isPl ? "Role organizacji oddzielają ustawienia, management i pracę operacyjną." : "Organisation roles separate management, settings and day-to-day site work.",
      to: "/security",
      label: isPl ? "Bezpieczeństwo" : "Security posture",
    },
    {
      icon: CloudCog,
      title: isPl ? "Offline i chmura" : "Offline and cloud",
      text: isPl ? "Pracuj bez stabilnego zasięgu i synchronizuj dane, gdy połączenie wróci." : "Keep working through weak signal and synchronise when connectivity returns.",
      to: "/status",
      label: isPl ? "Status usługi" : "Service status",
    },
    {
      icon: FileCheck2,
      title: isPl ? "Kontrolowane dokumenty" : "Controlled documents",
      text: isPl ? "Rewizje, zatwierdzenia i czytelne PDF-y zamiast ręcznego składania raportów." : "Revisions, approvals and clear PDFs without rebuilding reports by hand.",
      to: market.dpaPath,
      label: isPl ? "Przetwarzanie danych" : "Data processing",
    },
  ];

  return (
    <section className="landing-v2-trust" aria-labelledby="landing-trust-title">
      <div className="ctn">
        <div className="landing-v2-trust-intro fu">
          <span>{isPl ? "Zaufanie" : "Built for accountable work"}</span>
          <h2 id="landing-trust-title">{isPl ? "Mniej deklaracji. Więcej dowodów." : "Less marketing theatre. More operational evidence."}</h2>
          <p>{isPl ? "MySafeOps pokazuje kto zrobił co, kiedy i dla którego projektu." : "MySafeOps keeps who did what, when and for which project visible to the people responsible."}</p>
        </div>
        <div className="landing-v2-trust-grid">
          {items.map(({ icon: Icon, title, text, to, label }) => (
            <article key={title} className="fu">
              <Icon size={21} />
              <h3>{title}</h3>
              <p>{text}</p>
              <Link to={to}>{label} →</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({ name, tier, featured, cta, to, contact }) {
  return (
    <article className={`landing-v2-price-card${featured ? " is-featured" : ""}`}>
      {featured ? <span className="landing-v2-price-card__flag">Recommended</span> : null}
      <h3>{name}</h3>
      <div className="landing-v2-price"><strong>{tier.price}</strong>{tier.suffix ? <span>{tier.suffix}</span> : null}</div>
      <p>{tier.subtitle}</p>
      <ul>{tier.features.slice(0, 4).map((feature) => <li key={feature}><CheckCircle2 size={15} />{feature}</li>)}</ul>
      {contact
        ? <a href={to} className="btn btn-o">{cta}</a>
        : <Link to={to} className={`btn ${featured ? "btn-p" : "btn-o"}`} {...loginLinkPrefetchProps}>{cta}</Link>}
    </article>
  );
}

export default function LandingContentSections({ market, copy, supportEmail, ctaEmail, onCtaEmailChange, onCtaGo }) {
  const loginTo = market.loginPath;
  const sections = getLandingSectionsCopy(market.id);
  const features = getLandingFeatures(market.id).slice(0, 6);
  const pricing = copy.pricing;
  const isPl = market.id === "pl";

  return (
    <>
      <LandingWorkflowBento marketId={market.id} />
      <LandingProductShowcase marketId={market.id} />

      <section className="landing-v2-features" id="features">
        <div className="ctn">
          <div className="landing-v2-section-head fu">
            <span>{sections.features.badge}</span>
            <h2>{isPl ? "Jedno środowisko. Najważniejsze procesy." : "One workspace. The workflows that matter."}</h2>
            <p>{isPl ? "Tylko funkcje, które pomagają przygotować pracę, kontrolować ryzyko i zostawić czytelny ślad." : "The core tools to prepare work, control risk and leave a clear evidence trail."}</p>
          </div>
          <div className="landing-v2-feature-grid">
            {features.map((feature, index) => {
              const Icon = FEATURE_ICONS[index];
              return <article key={feature.t} className="fu"><span><Icon size={20} /></span><h3>{feature.t}</h3><p>{feature.d}</p></article>;
            })}
          </div>
        </div>
      </section>

      <TrustSection market={market} />

      <section className="landing-v2-pricing" id="pricing" aria-labelledby="pricing-heading">
        <div className="ctn">
          <div className="landing-v2-section-head fu">
            <span>{sections.pricing.badge}</span>
            <h2 id="pricing-heading">{sections.pricing.title}</h2>
            <p>{isPl ? "Cena za organizację, nie za każdą osobę. 14 dni pełnej ewaluacji w każdym planie." : "Priced per organisation, not per seat. Every plan starts with a 14-day full evaluation."}</p>
          </div>
          <div className="landing-v2-pricing-grid fu">
            <PricingCard name={sections.pricing.solo} tier={pricing.starter} cta={sections.pricing.startTrial} to={loginTo} />
            <PricingCard name={sections.pricing.team} tier={pricing.team} featured cta={sections.pricing.startTrial} to={loginTo} />
            <PricingCard name={sections.pricing.business} tier={pricing.business} cta={sections.pricing.startTrial} to={loginTo} />
            <PricingCard
              name={sections.pricing.enterprise}
              tier={pricing.enterprise}
              cta={sections.pricing.contactSales}
              to={`mailto:${supportEmail}?subject=${encodeURIComponent(sections.pricing.enterpriseMailSubject)}`}
              contact
            />
          </div>
          <p className="landing-v2-pricing-note">{copy.pricingFootnote}</p>
          <p className="landing-v2-pricing-terms">{getPriceAdjustmentShort(market.id)} <Link to={market.termsPath}>{copy.pricingDisclaimer}</Link>.</p>
        </div>
      </section>

      <Suspense fallback={<FaqSuspenseFallback />}><LandingFaqSection market={market} /></Suspense>

      <section className="cta landing-v2-cta" id="cta">
        <div className="ctn">
          <span>{isPl ? "14 dni pełnej ewaluacji" : "14-day full evaluation"}</span>
          <h2>{sections.cta.title}</h2>
          <p>{sections.cta.intro}</p>
          <div className="landing-v2-cta-form">
            <label className="landing-sr-only" htmlFor="landing-cta-email">{sections.cta.emailLabel}</label>
            <input
              id="landing-cta-email"
              type="email"
              placeholder={sections.cta.emailPh}
              value={ctaEmail}
              onChange={(event) => onCtaEmailChange(event.target.value)}
              onFocus={prefetchLoginPage}
              autoComplete="email"
              aria-label={sections.cta.emailLabel}
            />
            <button type="button" className="btn btn-p" onMouseEnter={prefetchLoginPage} onFocus={prefetchLoginPage} onClick={onCtaGo}>{sections.cta.button}</button>
          </div>
          <small>{sections.cta.help} <a href={`mailto:${supportEmail}`}>{supportEmail}</a></small>
        </div>
      </section>
    </>
  );
}
