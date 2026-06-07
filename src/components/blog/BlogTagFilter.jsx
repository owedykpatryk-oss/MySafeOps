/** @param {{ tags: string[]; active: string; onChange: (tag: string) => void }} props */
export default function BlogTagFilter({ tags, active, onChange }) {
  if (!tags.length) return null;

  return (
    <div className="blog-filter-group">
      <span className="blog-filter-label">Tags</span>
      <div className="blog-filter-chips" role="group" aria-label="Filter by tag">
        <button
          type="button"
          className={`blog-filter-chip blog-filter-chip--small${!active ? " blog-filter-chip--active" : ""}`}
          aria-pressed={!active}
          onClick={() => onChange("")}
        >
          All
        </button>
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            className={`blog-filter-chip blog-filter-chip--small${active === t ? " blog-filter-chip--active" : ""}`}
            aria-pressed={active === t}
            onClick={() => onChange(t)}
          >
            #{t}
          </button>
        ))}
      </div>
    </div>
  );
}
