import { getPermitGuidance } from "../registry";
import { getOrgMarketId } from "../../../../utils/orgMarket";

export default function PermitGuidancePanel({ permitType, extraFields, onExtraChange, ss, permit, marketId }) {
  const market = marketId || getOrgMarketId();
  const entry = getPermitGuidance(permitType, market);
  if (!entry?.Panel) return null;
  const Panel = entry.Panel;
  return (
    <Panel
      permitType={permitType}
      extraFields={extraFields}
      onExtraChange={onExtraChange}
      ss={ss}
      permit={permit}
      marketId={market}
    />
  );
}
