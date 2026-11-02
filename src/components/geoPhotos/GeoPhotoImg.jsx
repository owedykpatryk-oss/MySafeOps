import { useEffect, useRef, useState } from "react";
import { geoPhotoDisplayUrl, resolveGeoPhotoCachedDataUrl, resolveGeoPhotoPdfDataUrl } from "../../utils/geoPhotoMedia";

/** Prefer the offline copy; ignore responses for older photos. */
export default function GeoPhotoImg({ photo, alt = "", className = "", style, loading = "lazy" }) {
  const direct = geoPhotoDisplayUrl(photo);
  const key = photo?.photoStorageKey;
  const identity = `${photo?.id || ""}|${key || ""}|${direct}`;
  const [image, setImage] = useState({ identity, src: direct });
  const errorHandler = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let attempted = false;
    const show = (url) => {
      if (!cancelled) setImage({ identity, src: url || "" });
    };
    const fallback = async () => {
      if (attempted || !key) { show(""); return; }
      attempted = true;
      show(await resolveGeoPhotoPdfDataUrl({ photoStorageKey: key }));
    };
    errorHandler.current = { identity, run: fallback };
    show(direct);
    if (key && !direct.startsWith("data:")) {
      void resolveGeoPhotoCachedDataUrl(key).then((url) => {
        if (url) show(url);
        else if (!cancelled && !direct) void fallback();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [direct, key, identity]);

  const src = image.identity === identity ? image.src : direct;
  if (!src) return null;
  return <img src={src} alt={alt} className={className} style={style} loading={loading}
    onError={() => { if (errorHandler.current?.identity === identity) void errorHandler.current.run(); }} />;
}
