/** Inline SVG container for permit guidance panels. */
export default function SvgBlock({ html, title }) {
  if (!html) return null;
  return (
    <div
      title={title}
      style={{
        borderRadius: 8,
        border: "1px solid var(--color-border-tertiary,#e5e5e5)",
        padding: 8,
        background: "#fff",
        overflow: "hidden",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
