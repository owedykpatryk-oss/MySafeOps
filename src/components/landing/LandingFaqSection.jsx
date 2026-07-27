import { Link } from "react-router-dom";
import { getPriceAdjustmentDetail } from "../../lib/billingPlans";
import { getLandingFaqCopy } from "../../data/landingMarketContent";

/** @param {{ market: import("../../config/markets").MarketConfig }} props */
export default function LandingFaqSection({ market }) {
  const faqCopy = getLandingFaqCopy(market.id);
  const trialAnswer =
    market.id === "pl"
      ? "14 dni pełnego dostępu po zalogowaniu z chmurą, plus jedno przedłużenie +14 dni na organizację. Potem subskrypcja — istniejące dane zostają do podglądu i eksportu."
      : "14 days of full module access when you sign in with cloud billing, plus one optional +14 day extension per organisation. After that, subscribe to keep editing — existing records stay viewable and exportable.";

  const pricingAnswer =
    market.id === "pl"
      ? "Stała miesięczna cena za organizację (poziomy różnią się limitami pracowników i projektów). Użytkownicy w terenie wliczeni do limitu planu — szczegóły w Cenniku i w Billing w aplikacji."
      : "Plans are a flat monthly price per organisation (tiers differ by how many workers and projects you can run). Field users are included up to each tier’s caps — see the Pricing section above and Billing & limits in the app for live numbers.";

  const offlineAnswer =
    market.id === "pl"
      ? "Aplikacja działa w przeglądarce i wiele zadań można wykonać offline. Opcjonalny Supabase dodaje logowanie i kopię w chmurze."
      : "The workspace is browser-first and can keep working offline for many tasks. Optional Supabase adds sign-in and cloud backup when you configure it.";

  /** @type {{ q: string; a: import("react").ReactNode }[]} */
  const faq = [
    {
      q: market.id === "pl" ? "Czy na budowie potrzebuję internetu?" : "Do I need an internet connection on site?",
      a: offlineAnswer,
    },
    {
      q: faqCopy.legalQuestion,
      a: faqCopy.legalAnswer,
    },
    {
      q: market.id === "pl" ? "Co obejmuje trial?" : "What does a trial include?",
      a: trialAnswer,
    },
    {
      q: market.id === "pl" ? "Czy płacę za pracownika czy za organizację?" : "Is pricing per worker or per seat?",
      a: pricingAnswer,
    },
    {
      q: market.id === "pl" ? "Czy ceny subskrypcji mogą wzrosnąć?" : "Can subscription prices go up?",
      a: (
        <>
          {getPriceAdjustmentDetail(market.id)}{" "}
          <Link to={market.termsPath}>{market.id === "pl" ? "Regulamin" : "Full terms"} (§7.5)</Link>.
        </>
      ),
    },
    {
      q: market.id === "pl" ? "Gdzie przeczytam o bezpieczeństwie i danych?" : "Where can I read about security and data handling?",
      a: (
        <>
          {market.id === "pl" ? "Strona " : "See the public "}
          <Link to="/security">{market.id === "pl" ? "Bezpieczeństwo i zaufanie" : "Security & trust"}</Link>
          {market.id === "pl"
            ? " oraz polityki prawne w stopce (prywatność, regulamin, DPA)."
            : " page for a procurement-friendly summary, and legal policies (privacy, terms, DPA) linked in the footer."}
        </>
      ),
    },
    {
      q: market.id === "pl" ? "Czy mogę użyć własnego brandingu na PDF?" : "Can we use our own branding on PDFs?",
      a:
        market.id === "pl"
          ? "Tak. Ustawienia organizacji obejmują logo, kolory i stopkę PDF pod Twoją firmę."
          : "Yes. Organisation settings support logo, colours, and PDF footer lines so exports match your company.",
    },
    ...(faqCopy.regionQuestion
      ? [{
          q: faqCopy.regionQuestion,
          a: faqCopy.regionAnswer,
        }]
      : []),
  ];

  return (
    <section className="landing-faq" id="faq" aria-labelledby="landing-faq-heading">
      <div className="ctn">
        <div className="sh fu">
          <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
            FAQ
          </div>
          <h2 id="landing-faq-heading">{faqCopy.heading}</h2>
          <p>{faqCopy.intro}</p>
        </div>
        <div className="landing-faq-list">
          {faq.map((item) => (
            <details key={item.q} className="landing-faq-item fu">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
