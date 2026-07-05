import { getPermitGuidance } from "../registry";

export default function PermitGuidancePanel({ permitType, extraFields, onExtraChange, ss, permit }) {
  const entry = getPermitGuidance(permitType);
  if (!entry?.Panel) return null;
  const Panel = entry.Panel;
  return (
    <Panel
      permitType={permitType}
      extraFields={extraFields}
      onExtraChange={onExtraChange}
      ss={ss}
      permit={permit}
    />
  );
}
