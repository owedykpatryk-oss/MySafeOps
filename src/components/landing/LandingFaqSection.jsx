import { Link } from "react-router-dom";
import { getPriceAdjustmentDetail } from "../../lib/billingPlans";
import { getLandingFaqCopy } from "../../data/landingMarketContent";

/** @param {{ market: import("../../config/markets").MarketConfig }} props */
export default function LandingFaqSection({ market }) {
  const faqCopy = getLandingFaqCopy(market.id);
  const trialAnswer =
    market.id === "pl"
      ? "14 dni pełnego dostępu po zalogowaniu z chmurą, plus jedno przedłużenie +14 dni na organizację. Potem subskrypcja — istniejące dane zostają do podglądu i eksportu."
      : (market.id === "de" || market.id === "at" || market.id === "ch")
        ? "14 Tage voller Zugang nach der Cloud-Anmeldung, plus eine Verlängerung +14 Tage je Organisation. Danach Abo — vorhandene Daten bleiben lesbar und exportierbar."
        : "14 days of full module access when you sign in with cloud billing, plus one optional +14 day extension per organisation. After that, subscribe to keep editing — existing records stay viewable and exportable.";

  const pricingAnswer =
    market.id === "pl"
      ? "Stała miesięczna cena za organizację (poziomy różnią się limitami pracowników i projektów). Użytkownicy w terenie wliczeni do limitu planu — szczegóły w Cenniku i w Billing w aplikacji."
      : (market.id === "de" || market.id === "at" || market.id === "ch")
        ? "Fester Monatspreis pro Organisation (Stufen unterscheiden sich nach Beschäftigten- und Projektlimits). Personen auf der Baustelle zählen zum Planlimit — Details unter Preise und Billing in der App."
        : "Plans are a flat monthly price per organisation (tiers differ by how many workers and projects you can run). Field users are included up to each tier’s caps — see the Pricing section above and Billing & limits in the app for live numbers.";

  const offlineAnswer =
    market.id === "pl"
      ? "Aplikacja działa w przeglądarce i wiele zadań można wykonać offline. Opcjonalny Supabase dodaje logowanie i kopię w chmurze."
      : (market.id === "de" || market.id === "at" || market.id === "ch")
        ? "Die App läuft im Browser; viele Aufgaben gehen offline. Optionales Supabase ergänzt Anmeldung und Cloud-Sicherung."
        : "The workspace is browser-first and can keep working offline for many tasks. Optional Supabase adds sign-in and cloud backup when you configure it.";

  /** @type {{ q: string; a: import("react").ReactNode }[]} */
  const faq = [
    {
      q: market.id === "pl" ? "Czy na budowie potrzebuję internetu?" : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Brauche ich Internet auf der Baustelle?" : "Do I need an internet connection on site?",
      a: offlineAnswer,
    },
    {
      q: faqCopy.legalQuestion,
      a: faqCopy.legalAnswer,
    },
    {
      q: market.id === "pl" ? "Co obejmuje trial?" : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Was umfasst der Trial?" : "What does a trial include?",
      a: trialAnswer,
    },
    {
      q: market.id === "pl" ? "Czy płacę za pracownika czy za organizację?" : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Zahle ich pro Person oder pro Organisation?" : "Is pricing per worker or per seat?",
      a: pricingAnswer,
    },
    {
      q: market.id === "pl" ? "Czy ceny subskrypcji mogą wzrosnąć?" : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Können Abo-Preise steigen?" : "Can subscription prices go up?",
      a: (
        <>
          {getPriceAdjustmentDetail(market.id)}{" "}
          <Link to={market.termsPath}>{market.id === "pl" ? "Regulamin" : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Nutzungsbedingungen" : "Full terms"} (§7.5)</Link>.
        </>
      ),
    },
    {
      q: market.id === "pl" ? "Gdzie przeczytam o bezpieczeństwie i danych?" : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Wo lese ich zu Sicherheit und Daten?" : "Where can I read about security and data handling?",
      a: (
        <>
          {market.id === "pl" ? "Strona " : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Siehe " : "See the public "}
          <Link to="/security">{market.id === "pl" ? "Bezpieczeństwo i zaufanie" : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Sicherheit und Vertrauen" : "Security & trust"}</Link>
          {market.id === "pl"
            ? " oraz polityki prawne w stopce (prywatność, regulamin, DPA)."
            : (market.id === "de" || market.id === "at" || market.id === "ch")
              ? " sowie die Rechtstexte in der Fußzeile (Datenschutz, AGB, AVV)."
            : " page for a procurement-friendly summary, and legal policies (privacy, terms, DPA) linked in the footer."}
        </>
      ),
    },
    {
      q: market.id === "pl" ? "Czy mogę użyć własnego brandingu na PDF?" : (market.id === "de" || market.id === "at" || market.id === "ch") ? "Können wir eigenes Branding auf PDFs nutzen?" : "Can we use our own branding on PDFs?",
      a:
        market.id === "pl"
          ? "Tak. Ustawienia organizacji obejmują logo, kolory i stopkę PDF pod Twoją firmę."
          : (market.id === "de" || market.id === "at" || market.id === "ch")
            ? "Ja. In den Organisationseinstellungen gibt es Logo, Farben und PDF-Fußzeile für Ihre Firma."
            : "Yes. Organisation settings support logo, colours, and PDF footer lines so exports match your company.",
    },
    ...(faqCopy.regionQuestion
      ? [{
          q: faqCopy.regionQuestion,
          a: faqCopy.regionAnswer,
        }]
      : []),
    ...(faqCopy.conversionQuestion
      ? [{
          q: faqCopy.conversionQuestion,
          a: faqCopy.conversionAnswer,
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
