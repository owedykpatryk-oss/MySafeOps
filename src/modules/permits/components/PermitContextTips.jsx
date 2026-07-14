import { useMemo, useState } from "react";
import { dismissContextTip, loadDismissedContextTips, PTW_CONTEXT_TIPS } from "../../../utils/permitContextTips";

export default function PermitContextTips({ isAdmin = false, onDismiss }) {
  const [dismissed, setDismissed] = useState(() => loadDismissedContextTips());

  const visible = useMemo(
    () => PTW_CONTEXT_TIPS.filter((t) => !t.adminOnly || isAdmin).filter((t) => !dismissed.includes(t.id)),
    [dismissed, isAdmin]
  );

  if (visible.length === 0) return null;

  const tip = visible[0];

  const close = () => {
    dismissContextTip(tip.id);
    setDismissed((prev) => [...prev, tip.id]);
    onDismiss?.(tip.id);
  };

  return (
    <div className="ptw-context-tip" data-permit-guide={tip.target} role="note">
      <div className="ptw-context-tip__glow" aria-hidden />
      <div className="ptw-context-tip__content">
        <span className="ptw-context-tip__badge">Tip</span>
        <strong className="ptw-context-tip__title">{tip.title}</strong>
        <span className="ptw-context-tip__body">{tip.body}</span>
      </div>
      <button type="button" className="ptw-context-tip__close" onClick={close} aria-label="Dismiss tip">
        Got it
      </button>
      {visible.length > 1 ? (
        <span className="ptw-context-tip__more">{visible.length - 1} more tip{visible.length > 2 ? "s" : ""}</span>
      ) : null}
    </div>
  );
}
