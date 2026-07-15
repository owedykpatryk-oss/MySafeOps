/**
 * Capture a DOM element as PNG blob (html2canvas).
 * Includes Leaflet transform freeze so map panes/tiles don't shift in the bitmap.
 */

/**
 * html2canvas misreads Leaflet's CSS transforms — freeze panes/tiles to left/top for capture.
 * @param {HTMLElement} root
 * @returns {() => void} restore
 */
export function freezeLeafletForCapture(root) {
  if (!root?.querySelector?.(".leaflet-container")) return () => {};

  const snapshots = [];

  const freezeNode = (el) => {
    if (!el?.style) return;
    const transform = el.style.transform || "";
    if (!transform || transform === "none") return;
    const match = transform.match(/translate3d\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/i)
      || transform.match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/i);
    if (!match) return;
    const dx = parseFloat(match[1]) || 0;
    const dy = parseFloat(match[2]) || 0;
    const prevLeft = el.style.left;
    const prevTop = el.style.top;
    const prevTransform = el.style.transform;
    const baseLeft = parseFloat(el.style.left) || 0;
    const baseTop = parseFloat(el.style.top) || 0;
    snapshots.push({ el, left: prevLeft, top: prevTop, transform: prevTransform });
    el.style.transform = "none";
    el.style.left = `${baseLeft + dx}px`;
    el.style.top = `${baseTop + dy}px`;
  };

  root.querySelectorAll(
    ".leaflet-map-pane, .leaflet-tile-pane, .leaflet-overlay-pane, .leaflet-shadow-pane, .leaflet-marker-pane, .leaflet-tooltip-pane, .leaflet-popup-pane, .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-zoom-animated"
  ).forEach(freezeNode);

  return () => {
    for (const s of snapshots) {
      s.el.style.transform = s.transform;
      s.el.style.left = s.left;
      s.el.style.top = s.top;
    }
  };
}

/**
 * Wait briefly for Leaflet tiles to settle (best-effort).
 * @param {HTMLElement} root
 * @param {number} [timeoutMs]
 */
export function waitForLeafletTiles(root, timeoutMs = 900) {
  return new Promise((resolve) => {
    const container = root?.querySelector?.(".leaflet-container") || root;
    if (!container) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      container.removeEventListener("load", onLoad, true);
      resolve();
    };
    const onLoad = (e) => {
      if (e?.target?.tagName === "IMG") {
        window.clearTimeout(timer);
        timer = window.setTimeout(done, 120);
      }
    };
    container.addEventListener("load", onLoad, true);
    let timer = window.setTimeout(done, timeoutMs);
  });
}

/**
 * @param {HTMLElement} el
 * @param {{ scale?: number, backgroundColor?: string, waitForTiles?: boolean }} [opts]
 * @returns {Promise<Blob | null>}
 */
export async function captureElementPngBlob(el, opts = {}) {
  if (!el) return null;
  if (opts.waitForTiles !== false) {
    await waitForLeafletTiles(el);
  }
  const restore = freezeLeafletForCapture(el);
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      useCORS: true,
      allowTaint: false,
      scale: opts.scale ?? 2,
      logging: false,
      backgroundColor: opts.backgroundColor ?? "#f1f5f9",
      // Avoid scrolling-shift artefacts on nested overflow stacks
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    restore();
  }
}

export function downloadPngBlob(blob, filename) {
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
