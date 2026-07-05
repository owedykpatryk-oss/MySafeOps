import { Link } from "react-router-dom";
import { PRICE_ADJUSTMENT_DETAIL } from "../../lib/billingPlans";

/** @type {{ q: string; a: import("react").ReactNode }[]} */
const FAQ = [
  {
    q: "Do I need an internet connection on site?",
    a: "The workspace is browser-first and can keep working offline for many tasks. Optional Supabase adds sign-in and cloud backup when you configure it.",
  },
  {
    q: "Is MySafeOps legal advice or HSE reporting?",
    a: "No. It helps you organise RAMS, permits, registers, and evidence. You remain responsible for statutory reporting (e.g. RIDDOR) and site-specific rules.",
  },
  {
    q: "What does a trial include?",
    a: "14 days of full module access when you sign in with cloud billing, plus one optional +14 day extension per organisation. After that, subscribe to keep editing — existing records stay viewable and exportable.",
  },
  {
    q: "Is pricing per worker or per seat?",
    a: "Plans are a flat monthly price per organisation (tiers differ by how many workers and projects you can run). Field users are included up to each tier’s caps — see the Pricing section above and Billing & limits in the app for live numbers.",
  },
  {
    q: "Can subscription prices go up?",
    a: (
      <>
        {PRICE_ADJUSTMENT_DETAIL}{" "}
        <Link to="/terms">Full terms (§7.5)</Link>.
      </>
    ),
  },
  {
    q: "Where can I read about security and data handling?",
    a: (
      <>
        See the public <Link to="/security">Security &amp; trust</Link> page for a procurement-friendly summary, and legal policies (privacy, terms, DPA) linked in the footer.
      </>
    ),
  },
  {
    q: "Can we use our own branding on PDFs?",
    a: "Yes. Organisation settings support logo, colours, and PDF footer lines so exports match your company.",
  },
];

export default function LandingFaqSection() {
  return (
    <section className="landing-faq" id="faq" aria-labelledby="landing-faq-heading">
      <div className="ctn">
        <div className="sh fu">
          <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
            FAQ
          </div>
          <h2 id="landing-faq-heading">Common questions</h2>
          <p>Short answers — open the app for live limits and features on your plan.</p>
        </div>
        <div className="landing-faq-list">
          {FAQ.map((item) => (
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
