/**
 * Lightweight password strength helper for form guidance.
 * This is UX guidance only; server-side policy remains source of truth.
 */
export function getPasswordStrengthMeta(password, minLength = 6) {
  const v = String(password || "");
  const checks = [
    { id: "len", label: `At least ${minLength} characters`, ok: v.length >= minLength },
    { id: "lower", label: "One lowercase letter", ok: /[a-z]/.test(v) },
    { id: "upper", label: "One uppercase letter", ok: /[A-Z]/.test(v) },
    { id: "num", label: "One number", ok: /[0-9]/.test(v) },
    { id: "sym", label: "One symbol", ok: /[^A-Za-z0-9]/.test(v) },
  ];
  const score = checks.reduce((n, c) => n + (c.ok ? 1 : 0), 0);
  const percent = Math.round((score / checks.length) * 100);
  let label = "Very weak";
  let color = "#b91c1c";
  if (score >= 4) {
    label = "Strong";
    color = "#166534";
  } else if (score === 3) {
    label = "Good";
    color = "#0f766e";
  } else if (score === 2) {
    label = "Fair";
    color = "#92400e";
  }
  return { checks, score, percent, label, color };
}
