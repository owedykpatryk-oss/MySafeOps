import { useRef, useState } from "react";

const KML_ACCEPT =
  ".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/zip,text/xml";

function isKmlFile(file) {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase();
  return name.endsWith(".kml") || name.endsWith(".kmz");
}

/**
 * Drag-and-drop or click-to-browse KML boundary import.
 */
export default function ProjectKmlDropZone({
  onFile,
  busy = false,
  compact = false,
  buttonLabel = "Browse KML file",
  hint = "Drop a .kml or .kmz file here, or browse",
  children = null,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file) => {
    if (!file || busy) return;
    if (!isKmlFile(file)) return;
    onFile?.(file);
  };

  return (
    <div
      className={`project-kml-drop${dragOver ? " project-kml-drop--active" : ""}${compact ? " project-kml-drop--compact" : ""}${busy ? " project-kml-drop--busy" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer?.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={KML_ACCEPT}
        hidden
        disabled={busy}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="project-kml-drop__inner">
        <span className="project-kml-drop__icon" aria-hidden>🗺️</span>
        <p className="project-kml-drop__hint">{busy ? "Importing boundary…" : hint}</p>
        <button
          type="button"
          className="project-kml-drop__browse"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Importing…" : buttonLabel}
        </button>
        {children}
      </div>
    </div>
  );
}
