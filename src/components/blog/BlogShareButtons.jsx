/** @param {{ title: string; url?: string }} props */
export default function BlogShareButtons({ title, url }) {
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="blog-share" aria-label="Share this article">
      <span className="blog-share-label">Share</span>
      <div className="blog-share-actions">
        <a
          className="blog-share-btn"
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        <a
          className="blog-share-btn"
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          X
        </a>
        <a className="blog-share-btn" href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}>
          Email
        </a>
        <button type="button" className="blog-share-btn" onClick={copyLink}>
          Copy link
        </button>
      </div>
    </div>
  );
}
