import { ms } from "../utils/moduleStyles";
import { printRegisterForm } from "../utils/registerFormPrint";

/**
 * Opens a branded A4 site form (browser Print → Save as PDF) for one register row.
 */
export default function RegisterFormPrintButton({
  moduleId,
  record,
  label = "Print form",
  style,
  className,
  disabled = false,
}) {
  const onClick = () => {
    const res = printRegisterForm(moduleId, record);
    if (!res.ok && res.reason === "popup_blocked") {
      window.alert("Allow pop-ups to print this A4 form (then use Print → Save as PDF).");
    }
  };

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || !record}
      onClick={onClick}
      style={{ ...ms.btn, padding: "4px 10px", fontSize: 12, ...(style || {}) }}
      title="Print branded A4 form — Save as PDF"
    >
      {label}
    </button>
  );
}
