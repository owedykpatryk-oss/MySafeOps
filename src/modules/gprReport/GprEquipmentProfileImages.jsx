import { useState } from "react";

export default function GprEquipmentProfileImages({ preset }) {
  const [failedUrls, setFailedUrls] = useState(() => new Set());
  const images = preset.imageUrls?.length ? preset.imageUrls : preset.imageUrl ? [preset.imageUrl] : [];
  const availableImages = images.filter((url) => !failedUrls.has(url));
  const initials = String(preset.model || "GPR")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();

  return (
    <div className="app-gpr-equipment-profile__visual">
      {availableImages.length ? images.map((url, index) => failedUrls.has(url) ? null : (
        <img
          key={url}
          src={url}
          alt={`${preset.manufacturer} ${preset.model} product view ${index + 1}`}
          loading="lazy"
          onError={() => setFailedUrls((current) => new Set(current).add(url))}
        />
      )) : (
        <div className="app-gpr-equipment-profile__fallback" aria-hidden>
          <span>{initials}</span>
          <small>{preset.model}</small>
        </div>
      )}
    </div>
  );
}
