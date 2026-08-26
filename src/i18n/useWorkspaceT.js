import { useMemo } from "react";
import { getOrgMarketId } from "../utils/orgMarket";
import { t as translate, tf as translateFormatted, dayLabel as translateDayLabel, getWorkspaceStrings } from "./workspaceStrings";

/**
 * Hook: returns a `t(key)` function bound to the active org's market,
 * plus `ws` — the full strings dictionary for that market (handy when
 * destructuring several labels for a form at once), and `tf(key, vars)`
 * for strings with `{placeholder}` interpolation.
 *
 * @example
 * const { t } = useWorkspaceT();
 * <button onClick={onSave}>{t("save")}</button>
 */
export function useWorkspaceT(marketId = getOrgMarketId()) {
  return useMemo(() => {
    const ws = getWorkspaceStrings(marketId);
    return {
      t: (key) => translate(key, marketId),
      tf: (key, vars) => translateFormatted(key, marketId, vars),
      dayLabel: (dayKey) => translateDayLabel(dayKey, marketId),
      ws,
      marketId,
    };
  }, [marketId]);
}
