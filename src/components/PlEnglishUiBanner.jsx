import { useState } from "react";
import { Info } from "lucide-react";
import { getOrgMarketId } from "../utils/orgMarket";

const DISMISS_KEY = "mysafeops_pl_ui_lang_banner_dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * PL market is live for pricing/legal/locale, but the in-app workspace UI is still English.
 * Honest disclosure until full i18n exists.
 */
export default function PlEnglishUiBanner() {
  const marketId = getOrgMarketId();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (marketId !== "pl" || dismissed) return null;

  return (
    <div className="app-trial-banner" role="status" style={{ background: "#ecfeff", borderColor: "#99f6e4" }}>
      <Info size={18} aria-hidden />
      <div className="app-trial-banner__body">
        <strong>Interfejs po angielsku</strong>
        <span>
          Landing, regulaminy i ceny są po polsku — obszar roboczy (rejestry, pozwolenia, RAMS, ustawienia) jest na
          razie po angielsku. Pełne tłumaczenie UI jest w planie.
        </span>
      </div>
      <div className="app-trial-banner__actions">
        <button
          type="button"
          className="app-trial-banner__btn"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          Rozumiem
        </button>
      </div>
    </div>
  );
}
