import { BLOG_CATEGORIES } from "../../lib/blog/categories";

/** @param {{ active: string; onChange: (slug: string) => void }} props */
export default function BlogCategoryFilter({ active, onChange }) {
  return (
    <div className="blog-filter-group">
      <span className="blog-filter-label">Category</span>
      <div className="blog-filter-chips" role="group" aria-label="Filter by category">
        <button
          type="button"
          className={`blog-filter-chip${!active ? " blog-filter-chip--active" : ""}`}
          aria-pressed={!active}
          onClick={() => onChange("")}
        >
          All
        </button>
        {BLOG_CATEGORIES.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`blog-filter-chip${active === c.slug ? " blog-filter-chip--active" : ""}`}
            aria-pressed={active === c.slug}
            onClick={() => onChange(c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
