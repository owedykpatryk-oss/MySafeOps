import { useMemo } from "react";
import DOMPurify from "dompurify";

const SVG_SANITIZE = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ["use"],
  FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

/** Inline SVG container for permit guidance panels (DOMPurify SVG profile). */
export default function SvgBlock({ html, title }) {
  const safe = useMemo(() => {
    if (!html) return "";
    try {
      return DOMPurify.sanitize(String(html), SVG_SANITIZE);
    } catch {
      return "";
    }
  }, [html]);

  if (!safe) return null;
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
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
