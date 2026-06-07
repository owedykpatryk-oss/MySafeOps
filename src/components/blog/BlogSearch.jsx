import { useId } from "react";

/** @param {{ value: string; onChange: (v: string) => void; resultCount?: number }} props */
export default function BlogSearch({ value, onChange, resultCount }) {
  const id = useId();

  return (
    <div className="blog-search">
      <label htmlFor={id} className="blog-search-label">
        Search guides
      </label>
      <input
        id={id}
        type="search"
        className="blog-search-input"
        placeholder="Permits, RAMS, COSHH…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />
      {typeof resultCount === "number" ? (
        <p className="blog-search-count" aria-live="polite">
          {resultCount} {resultCount === 1 ? "article" : "articles"}
        </p>
      ) : null}
    </div>
  );
}
