/** @param {{ page: number; totalPages: number; onPageChange: (p: number) => void }} props */
export default function BlogPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="blog-pagination" aria-label="Blog pagination">
      <button
        type="button"
        className="blog-pagination-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Previous
      </button>
      <ul className="blog-pagination-list">
        {pages.map((p) => (
          <li key={p}>
            <button
              type="button"
              className={`blog-pagination-num${p === page ? " blog-pagination-num--active" : ""}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="blog-pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}
