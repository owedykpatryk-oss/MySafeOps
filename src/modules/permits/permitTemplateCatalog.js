import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";

const TEMPLATE_STORE_KEY = "permit_templates_v1";

function fallbackTemplateForType(type, def) {
  const checklist = (def?.checklist || []).map((text, idx) => ({
    id: `${type}_${idx + 1}`,
    text,
    required: true,
  }));
  return {
    templateId: `permit.${type}.default`,
    templateType: type,
    templateVersion: 1,
    matrixVersion: "uk-v1",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    checklistItems: checklist,
    extraFields: def?.extraFields || [],
    ui: {
      color: def?.color || "#5F5E5A",
      bg: def?.bg || "#F1EFE8",
      title: def?.label || "General permit",
      description: def?.description || "",
      icon: def?.icon || "",
    },
  };
}

export function loadPermitTemplateCatalog(permitTypes = {}) {
  const stored = load(TEMPLATE_STORE_KEY, {});
  const out = {};
  Object.entries(permitTypes).forEach(([type, def]) => {
    const candidate = stored[type];
    out[type] = candidate && Array.isArray(candidate.checklistItems)
      ? candidate
      : fallbackTemplateForType(type, def);
  });
  return out;
}

export function getTemplateForType(type, permitTypes = {}) {
  const catalog = loadPermitTemplateCatalog(permitTypes);
  return catalog[type] || fallbackTemplateForType(type, permitTypes.general);
}

export function saveOrgTemplate(type, templatePatch, permitTypes = {}) {
  const catalog = loadPermitTemplateCatalog(permitTypes);
  const base = catalog[type] || fallbackTemplateForType(type, permitTypes[type]);
  const next = {
    ...base,
    ...templatePatch,
    templateType: type,
    templateId: base.templateId || `permit.${type}.org`,
    templateVersion: Number(base.templateVersion || 1) + 1,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
  const stored = load(TEMPLATE_STORE_KEY, {});
  save(TEMPLATE_STORE_KEY, { ...stored, [type]: next });
  return next;
}

