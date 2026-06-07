/** @param {{ mode: string; onToggle: () => void }} props */
export default function BlogThemeToggle({ mode, onToggle }) {
  const label =
    mode === "auto" ? "Theme: system" : mode === "dark" ? "Theme: dark" : "Theme: light";

  return (
    <button type="button" className="blog-theme-toggle" onClick={onToggle} aria-label={label} title={label}>
      {mode === "dark" ? "☾" : mode === "light" ? "☀" : "◐"}
    </button>
  );
}
