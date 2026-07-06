import { D1_ADMIN_ONLY_WRITE_NAMESPACES } from "./d1NamespacePolicy.js";

/** Fired when D1 PUT is rejected (403) — role cannot write this namespace. */
export const D1_WRITE_FORBIDDEN_EVENT = "mysafeops-d1-write-forbidden";
export const D1_WRITE_FORBIDDEN_CLEAR_EVENT = "mysafeops-d1-write-forbidden-clear";

export function isForbiddenD1Write(error) {
  const e = String(error || "").toLowerCase();
  return e.includes("forbidden") || e === "http_403";
}

function messageForNamespace(namespace) {
  const ns = String(namespace || "").trim();
  if (D1_ADMIN_ONLY_WRITE_NAMESPACES.has(ns)) {
    const label =
      ns === "mysafeops_workers"
        ? "workers"
        : ns === "mysafeops_projects"
          ? "projects"
          : ns === "training_matrix"
            ? "training matrix"
            : ns === "cdm_packs"
              ? "CDM packs"
              : ns === "mysafeops_timesheets"
                ? "timesheets"
                : ns.replace(/_/g, " ");
    return `Cloud sync for ${label} is limited to admins and supervisors. Your changes are saved on this device only.`;
  }
  return "Cloud sync is read-only for your role on this data. Changes are saved on this device only.";
}

/** @param {string} [namespace] */
export function notifyD1WriteForbidden(namespace) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(D1_WRITE_FORBIDDEN_EVENT, {
      detail: { namespace: namespace || "", message: messageForNamespace(namespace) },
    }),
  );
}

export function clearD1WriteForbidden() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(D1_WRITE_FORBIDDEN_CLEAR_EVENT));
}
