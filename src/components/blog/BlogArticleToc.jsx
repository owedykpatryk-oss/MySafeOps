/** @param {{ level: number; text: string; id: string }[]} toc */
export default function BlogArticleToc({ toc }) {
  if (toc.length === 0) return null;
  return (
    <nav className="blog-article-toc" aria-labelledby="blog-toc-heading">
      <h2 id="blog-toc-heading" className="blog-article-toc-title">
        On this page
      </h2>
      <ol className="blog-article-toc-list">
        {toc.map((item) => (
          <li
            key={item.id}
            className={`blog-article-toc-item blog-article-toc-item--h${item.level}`}
          >
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
