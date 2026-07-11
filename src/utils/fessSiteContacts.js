/**
 * FESS Group — seed site permit controller and A&E contacts (org-exclusive).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { isFessOrg } from "./fessOrg";
import { FESS_CLIENT_SITE_TEMPLATES } from "./fessClientSites";

const KEY = "emergency_contacts";
const genId = () => `ec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

/**
 * Idempotent seed of FESS site contacts from client site templates.
 * @returns {{ created: number, total: number }}
 */
export function seedFessSiteContacts() {
  if (!isFessOrg()) return { created: 0, total: 0 };

  const existing = Array.isArray(load(KEY, [])) ? [...load(KEY, [])] : [];
  const labels = new Set(existing.map((c) => String(c.label || "").trim().toLowerCase()));
  let created = 0;

  for (const tmpl of FESS_CLIENT_SITE_TEMPLATES) {
    const permitLabel = `${tmpl.location} — permit controller`;
    if (tmpl.permitControllerContact && !labels.has(permitLabel.toLowerCase())) {
      existing.push({
        id: genId(),
        label: permitLabel,
        phone: "",
        notes: tmpl.permitControllerContact,
        fessSiteTemplateId: tmpl.id,
        createdAt: new Date().toISOString(),
      });
      labels.add(permitLabel.toLowerCase());
      created += 1;
    }

    const hospitalLabel = `${tmpl.location} — nearest A&E`;
    if (tmpl.nearestHospital && !labels.has(hospitalLabel.toLowerCase())) {
      existing.push({
        id: genId(),
        label: hospitalLabel,
        phone: "",
        notes: tmpl.nearestHospital,
        fessSiteTemplateId: tmpl.id,
        createdAt: new Date().toISOString(),
      });
      labels.add(hospitalLabel.toLowerCase());
      created += 1;
    }
  }

  if (created) save(KEY, existing);
  return { created, total: existing.length };
}
