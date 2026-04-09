import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

const BUCKET = "permit-evidence";

/**
 * Renders site evidence: refreshes signed URL when `storagePath` is set (private bucket).
 */
export default function PermitEvidenceImage({ storagePath, srcUrl, alt = "Site evidence" }) {
  const [url, setUrl] = useState(srcUrl || "");
  const [err, setErr] = useState(null);

  useEffect(() => {
    setErr(null);
    if (!storagePath || !supabase) {
      setUrl(srcUrl || "");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        setUrl(srcUrl || "");
        return;
      }
      if (data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath, srcUrl]);

  if (err && !url) {
    return (
      <div style={{ marginTop: 10, fontSize: 11, color: "#A32D2D" }}>
        Could not load photo{err ? `: ${err}` : ""}
        {srcUrl ? (
          <div style={{ marginTop: 6 }}>
            <a href={srcUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0C447C" }}>
              Open last link
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  if (!url) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>Site evidence</div>
      <img
        src={url}
        alt={alt}
        style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, border: "1px solid var(--color-border-tertiary,#e5e5e5)", display: "block" }}
      />
    </div>
  );
}
