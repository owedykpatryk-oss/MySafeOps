import { useEffect, useState } from "react";
import { geoPhotoDisplayUrl, resolveGeoPhotoObjectUrl } from "../../utils/geoPhotoMedia";

/**
 * Geo-photo thumbnail / preview. Uses data/signed/public URL when available;
 * falls back to authenticated R2 GET /object when only photoStorageKey remains
 * (e.g. after D1 sync stripped base64, or misconfigured public base cleared the data URL).
 */
export default function GeoPhotoImg({ photo, alt = "", className = "", style, loading = "lazy" }) {
  const direct = geoPhotoDisplayUrl(photo);
  const [src, setSrc] = useState(direct);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    if (direct) {
      setSrc(direct);
      return () => {
        cancelled = true;
      };
    }

    setSrc("");
    if (!photo?.photoStorageKey) {
      return () => {
        cancelled = true;
      };
    }

    void resolveGeoPhotoObjectUrl(photo.photoStorageKey).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (!url) return;
      objectUrl = url;
      setSrc(url);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [direct, photo?.id, photo?.photoStorageKey]);

  const onError = () => {
    if (!photo?.photoStorageKey || !direct || src !== direct) {
      setSrc("");
      return;
    }
    void resolveGeoPhotoObjectUrl(photo.photoStorageKey).then((url) => {
      if (url) setSrc(url);
      else setSrc("");
    });
  };

  if (!src) return null;

  return <img src={src} alt={alt} className={className} style={style} loading={loading} onError={onError} />;
}
