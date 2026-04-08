const TYPE_STYLES = {
  info: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  success: { bg: "#f0fdf4", border: "#a7f3d0", color: "#166534" },
  warn: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
  error: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
};

export default function InlineAlert({ type = "info", text, style }) {
  if (!text) return null;
  const t = TYPE_STYLES[type] || TYPE_STYLES.info;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      style={{
        marginTop: 12,
        fontSize: 13,
        lineHeight: 1.5,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.color,
        borderRadius: "10px",
        padding: "9px 10px",
        ...style,
      }}
    >
      {text}
    </div>
  );
}
