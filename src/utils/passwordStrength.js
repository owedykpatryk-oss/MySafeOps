/**
 * Password strength guidance for sign-up / reset forms.
 * NCSC-style: length is the primary control; extra checks are recommendations, not blockers.
 */
export function getPasswordStrengthMeta(password, minLength = 12) {
  const v = String(password || "");
  const lenOk = v.length >= minLength;
  const recommended = [
    { id: "long", label: "15+ characters (stronger against guessing)", ok: v.length >= 15 },
    { id: "lower", label: "Lowercase letter", ok: /[a-z]/.test(v) },
    { id: "upper", label: "Uppercase letter", ok: /[A-Z]/.test(v) },
    { id: "num", label: "Number", ok: /[0-9]/.test(v) },
    { id: "sym", label: "Symbol", ok: /[^A-Za-z0-9]/.test(v) },
  ];
  const checks = [{ id: "len", label: `At least ${minLength} characters`, ok: lenOk }, ...recommended];
  const score = checks.reduce((n, c) => n + (c.ok ? 1 : 0), 0);
  const percent = Math.round((score / checks.length) * 100);
  let label = "Too short";
  let color = "#b91c1c";
  if (!lenOk) {
    label = "Too short";
    color = "#b91c1c";
  } else if (score >= 5) {
    label = "Strong";
    color = "#166534";
  } else if (score >= 4) {
    label = "Good";
    color = "#0f766e";
  } else if (score >= 2) {
    label = "Fair (consider adding length or variety)";
    color = "#92400e";
  } else {
    label = "Meets minimum — add variety if you can";
    color = "#92400e";
  }
  return { checks, score, percent, label, color, meetsMinimum: lenOk };
}
