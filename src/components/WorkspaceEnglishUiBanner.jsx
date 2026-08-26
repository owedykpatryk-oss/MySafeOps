import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { getOrgMarketId } from "../utils/orgMarket";
import { COUNTRY_WORKSPACE_CHANGED_EVENT, getCachedActiveCountryWorkspace } from "../utils/countryWorkspaces";

const DISMISS_KEY_PREFIX = "mysafeops_english_ui_banner_dismissed_";

/**
 * Landing, legal, pricing and market-specific content (permit types, compliance
 * packs, legislation, module names) are localised per market. The generic workspace
 * chrome — buttons, generic form fields, empty states, toasts — is still English
 * across every non-UK/AU market. Honest disclosure until full workspace i18n exists.
 */
const COPY_BY_MARKET = {
  pl: {
    title: "Interfejs po angielsku",
    body: "Landing, regulaminy i ceny są po polsku — obszar roboczy (rejestry, pozwolenia, RAMS, ustawienia) jest na razie po angielsku. Pełne tłumaczenie UI jest w planie.",
    dismiss: "Rozumiem",
  },
  de: {
    title: "Arbeitsbereich noch auf Englisch",
    body: "Landing-Seite, Rechtsdokumente, Preise sowie GBU/SiGe-Plan-Inhalte und Erlaubnisscheine sind auf Deutsch — die allgemeine Bedienoberfläche (Schaltflächen, Formularfelder in Registern wie Beschäftigte oder Stundenzettel) ist derzeit noch auf Englisch. Vollständige Übersetzung ist in Planung.",
    dismiss: "Verstanden",
  },
  at: {
    title: "Arbeitsbereich noch auf Englisch",
    body: "Landing-Seite, Rechtsdokumente, Preise sowie Evaluierungs-/SiGe-Plan-Inhalte und Erlaubnisscheine sind auf Deutsch — die allgemeine Bedienoberfläche (Schaltflächen, Formularfelder in Registern wie Beschäftigte oder Stundenzettel) ist derzeit noch auf Englisch. Vollständige Übersetzung ist in Planung.",
    dismiss: "Verstanden",
  },
  ch: {
    title: "Arbeitsbereich noch auf Englisch",
    body: "Landing-Seite, Rechtsdokumente, Preise sowie Gefährdungsermittlungs-/SiKo-Inhalte und Freigaben sind auf Deutsch — die allgemeine Bedienoberfläche (Schaltflächen, Formularfelder in Registern wie Beschäftigte oder Stundenzettel) ist derzeit noch auf Englisch. Vollständige Übersetzung ist in Planung.",
    dismiss: "Verstanden",
  },
};

function readDismissed(marketId) {
  try {
    return localStorage.getItem(`${DISMISS_KEY_PREFIX}${marketId}`) === "1";
  } catch {
    return false;
  }
}

export default function WorkspaceEnglishUiBanner() {
  const [marketId, setMarketId] = useState(() => getCachedActiveCountryWorkspace()?.market_id || getOrgMarketId());
  const [dismissed, setDismissed] = useState(() => readDismissed(marketId));

  useEffect(() => {
    const sync = () => {
      const next = getCachedActiveCountryWorkspace()?.market_id || getOrgMarketId();
      setMarketId(next);
      setDismissed(readDismissed(next));
    };
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, sync);
  }, []);

  const copy = COPY_BY_MARKET[marketId];
  if (!copy || dismissed) return null;

  return (
    <div className="app-trial-banner" role="status" style={{ background: "#ecfeff", borderColor: "#99f6e4" }}>
      <Info size={18} aria-hidden />
      <div className="app-trial-banner__body">
        <strong>{copy.title}</strong>
        <span>{copy.body}</span>
      </div>
      <div className="app-trial-banner__actions">
        <button
          type="button"
          className="app-trial-banner__btn"
          onClick={() => {
            try {
              localStorage.setItem(`${DISMISS_KEY_PREFIX}${marketId}`, "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          {copy.dismiss}
        </button>
      </div>
    </div>
  );
}
