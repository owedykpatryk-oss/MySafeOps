import { useBillingWriteGate } from "../hooks/useBillingWriteGate";
import InlineAlert from "./InlineAlert";

/** Compact read-only notice for module pages when trial expired without subscription. */
export default function BillingReadOnlyBanner({ className = "" }) {
  const { writeBlocked, message } = useBillingWriteGate();
  if (!writeBlocked) return null;

  return (
    <div className={className} style={{ marginBottom: 16 }}>
      <InlineAlert type="warn" text={message} />
    </div>
  );
}
