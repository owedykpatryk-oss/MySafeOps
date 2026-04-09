export function createDefaultChecklistItems(type, checklistStrings = []) {
  return (checklistStrings || []).map((text, idx) => ({
    id: `${type}_${idx + 1}`,
    text,
    required: true,
  }));
}

export function normalizeChecklistItems(type, permitLike, checklistStrings) {
  const source =
    Array.isArray(permitLike?.checklistItems) && permitLike.checklistItems.length
      ? permitLike.checklistItems
      : createDefaultChecklistItems(type, checklistStrings);
  return source.map((item, idx) => ({
    id: String(item?.id || `${type}_${idx + 1}`),
    text: String(item?.text || "").trim() || `Checklist item ${idx + 1}`,
    required: item?.required !== false,
  }));
}

export function normalizeChecklistState(rawChecklist, items) {
  const src = rawChecklist || {};
  const out = {};
  items.forEach((item, idx) => {
    const byId = Object.prototype.hasOwnProperty.call(src, item.id) ? src[item.id] : undefined;
    const byIndex = Object.prototype.hasOwnProperty.call(src, idx) ? src[idx] : undefined;
    out[item.id] = Boolean(byId ?? byIndex);
  });
  return out;
}
