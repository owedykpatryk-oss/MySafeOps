/**
 * Survey editor session draft — strip heavy photo payloads from sessionStorage.
 */

/**
 * @param {object} form
 * @returns {object}
 */
export function stripSurveyFormForSessionDraft(form) {
  if (!form || typeof form !== "object") return form;
  const photos = Array.isArray(form.photos)
    ? form.photos.map((ph) => {
        if (!ph || typeof ph !== "object") return ph;
        const { dataUrl, ...rest } = ph;
        // Keep remote http(s) thumbnails; drop base64 data URLs that blow up sessionStorage.
        if (typeof dataUrl === "string" && /^https?:\/\//i.test(dataUrl.trim())) {
          return { ...rest, dataUrl: dataUrl.trim() };
        }
        return { ...rest, dataUrl: "" };
      })
    : [];
  return { ...form, photos };
}

/**
 * Merge restored draft with live form photos when draft stripped dataUrls.
 * @param {object} draftForm
 * @param {object} liveForm
 */
export function mergeSurveyDraftPhotos(draftForm, liveForm) {
  const draft = draftForm && typeof draftForm === "object" ? draftForm : {};
  const live = liveForm && typeof liveForm === "object" ? liveForm : {};
  const draftPhotos = Array.isArray(draft.photos) ? draft.photos : [];
  const livePhotos = Array.isArray(live.photos) ? live.photos : [];
  const liveById = new Map(livePhotos.map((p) => [String(p?.id || ""), p]));
  const merged = draftPhotos.map((ph) => {
    const id = String(ph?.id || "");
    const livePh = liveById.get(id);
    const hasData = typeof ph?.dataUrl === "string" && ph.dataUrl.trim();
    if (hasData) return ph;
    if (livePh?.dataUrl) return { ...ph, dataUrl: livePh.dataUrl };
    return ph;
  });
  // If draft emptied photos but live still has them, keep live (reload with strip would lose either way).
  if (!merged.length && livePhotos.length) {
    return { ...draft, photos: livePhotos };
  }
  return { ...draft, photos: merged };
}
