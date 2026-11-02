import { loadPdfMapImagery } from "./pdfMapImagery.js";

// Kept within one export: no cross-mission, cross-account or persistent imagery cache.
export function createPdfExportSession(
  { onProgress = () => {}, isActive = () => true } = {},
  loader = loadPdfMapImagery
) {
  const pending = new Map(),
    warnings = new Set();
  const assertActive = () => {
    if (!isActive()) throw new DOMException("Export cancelled. No file was downloaded.", "AbortError");
  };
  const report = (label) => {
    assertActive();
    onProgress(label);
  };
  return {
    report,
    assertActive,
    get warnings() {
      return [...warnings];
    },
    async loadMapImagery(geometry) {
      assertActive();
      const key = JSON.stringify(geometry);
      if (!pending.has(key)) {
        report("Loading satellite map…");
        pending.set(
          key,
          Promise.resolve()
            .then(() => loader(geometry))
            .catch(() => ({
              unavailable:
                "Satellite imagery could not be loaded. Geometry-only schematic shown; retry the export online.",
            }))
            .then((result) => {
              if (result.unavailable) warnings.add(result.unavailable);
              return result;
            })
        );
      }
      const result = await pending.get(key);
      assertActive();
      return result;
    },
  };
}

export function missionExportFilename(mission, suffix) {
  const name =
    String(mission.title || "Survey")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim()
      .slice(0, 65) || "Survey";
  return `${name}-R${mission.revision || 1}-${suffix}`;
}
