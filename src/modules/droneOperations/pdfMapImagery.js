import { geometrySummary } from "./droneGeometry.js";

const R = 6378137;
export const imageryAttribution =
  "Esri World Imagery. Sources: Esri, Vantor, Earthstar Geographics and the GIS User Community.";
export function mercator([longitude, latitude]) {
  if (![longitude, latitude].every(Number.isFinite) || Math.abs(longitude) > 180 || Math.abs(latitude) > 85)
    throw new Error("Map coordinates are outside the supported extent.");
  return [(R * longitude * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360))];
}
export function imageryFrame(geometry) {
  const summary = geometrySummary(geometry);
  if (!summary.bounds) return null;
  const [west, south, east, north] = summary.bounds;
  if (east - west > 180) throw new Error("Map crosses the antimeridian; GIS review required.");
  const [xmin, ymin] = mercator([west, south]),
    [xmax, ymax] = mercator([east, north]);
  const ratio = 178 / 145;
  const width = Math.max(200, (xmax - xmin) * 1.18, (ymax - ymin) * 1.18 * ratio);
  const height = width / ratio,
    cx = (xmin + xmax) / 2,
    cy = (ymin + ymax) / 2;
  const bounds = [cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2];
  const query = new URLSearchParams({
    bbox: bounds.join(","),
    bboxSR: "3857",
    imageSR: "3857",
    size: "1424,1160",
    format: "jpg",
    f: "image",
  });
  return {
    bounds,
    centre: summary.centre,
    url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${query}`,
  };
}

// One bounded static-map request per export; no tile scraping or arbitrary URL proxy.
export async function loadPdfMapImagery(geometry) {
  try {
    const frame = imageryFrame(geometry);
    if (!frame || typeof Image === "undefined" || navigator.onLine === false)
      return { unavailable: "Satellite imagery unavailable offline or without a mapped area." };
    const dataUrl = await new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => {
        image.onload = null;
        image.onerror = null;
        image.src = "";
        reject(new Error("timeout"));
      }, 10000);
      image.crossOrigin = "anonymous";
      image.referrerPolicy = "no-referrer";
      image.onload = () => {
        clearTimeout(timer);
        try {
          if (image.naturalWidth !== 1424 || image.naturalHeight !== 1160) throw new Error("Unexpected image size");
          const canvas = document.createElement("canvas");
          canvas.width = 1424;
          canvas.height = 1160;
          canvas.getContext("2d").drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Image request failed"));
      };
      image.src = frame.url;
    });
    return { ...frame, dataUrl, fetchedAt: new Date().toISOString() };
  } catch {
    return {
      unavailable: "Satellite imagery could not be loaded. Geometry-only schematic shown; retry the export online.",
    };
  }
}
