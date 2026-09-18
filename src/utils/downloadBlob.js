/**
 * Trigger a file download from a Blob / data URL with browser-safe sequencing.
 * Instant revokeObjectURL after click often cancels the download in Chromium.
 */

/** iOS WebKit ignores `<a download>` for blob: URLs — open in a new tab instead. */
export function isIosWebKitDownload() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iP(ad|hone|od)/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
}

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
    a.rel = "noopener";
    a.style.display = "none";
    if (isIosWebKitDownload()) {
      a.target = "_blank";
    } else {
      a.download = name;
    }
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
