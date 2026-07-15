/**
 * Trigger a file download from a Blob / data URL with browser-safe sequencing.
 * Instant revokeObjectURL after click often cancels the download in Chromium.
 */

/**
 * @param {Blob | string} blobOrUrl
 * @param {string} fileName
 * @returns {boolean}
 */
export function downloadBlob(blobOrUrl, fileName) {
  const name = String(fileName || "download").trim() || "download";
  let objectUrl = "";
  try {
    if (typeof blobOrUrl === "string") {
      objectUrl = blobOrUrl;
    } else if (blobOrUrl instanceof Blob) {
      objectUrl = URL.createObjectURL(blobOrUrl);
    } else {
      return false;
    }

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (blobOrUrl instanceof Blob) {
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* ignore */
        }
      }, 60_000);
    }
    return true;
  } catch {
    if (objectUrl && blobOrUrl instanceof Blob) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
    }
    return false;
  }
}
