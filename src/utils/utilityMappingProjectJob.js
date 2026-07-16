/**
 * Project-level Utility Mapping job identity — one UM26-job-CLIENT for the whole site.
 * Org-exclusive.
 */
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import {
  formatUtilityMappingRef,
  formatUtilityMappingTypedRef,
  nextUtilityMappingJobNumber,
  parseUtilityMappingRef,
  syncUtilityMappingReportRef,
  utilityMappingJobYearYY,
} from "./utilityMappingDocRefs";
import { getUtilityMappingClient, matchUtilityMappingClientCode } from "./utilityMappingClients";

/**
 * Resolve job + client code from a project record.
 * @param {object} project
 * @returns {{ umJobNumber: string, umClientCode: string, clientName: string, jobRef: string }}
 */
export function getUtilityMappingProjectJob(project = {}) {
  if (!isUtilityMappingOrg() || !project) {
    return { umJobNumber: "", umClientCode: "", clientName: "", jobRef: "" };
  }
  const fromCode = parseUtilityMappingRef(project.code || project.umJobRef || project.jobRef || "");
  const umJobNumber =
    String(project.umJobNumber || "").replace(/\D/g, "") ||
    fromCode?.jobNumber ||
    "";
  const umClientCode =
    String(project.umClientCode || "").trim().toUpperCase() ||
    fromCode?.clientCode ||
    matchUtilityMappingClientCode(project.client || project.site) ||
    "";
  const clientName =
    project.client ||
    getUtilityMappingClient(umClientCode)?.name ||
    project.site ||
    "";
  const jobRef =
    umJobNumber && umClientCode
      ? formatUtilityMappingRef({
          jobNumber: umJobNumber,
          clientCode: umClientCode,
          surveyDate: project.timelineStart,
        })
      : fromCode
        ? formatUtilityMappingRef(fromCode)
        : "";
  return { umJobNumber, umClientCode, clientName, jobRef };
}

/**
 * Keep project.code / umJobRef in sync with job + client fields.
 * @param {object} project
 * @param {Array<{ ref?: string }>} [existingRefs] for auto job number
 */
export function syncUtilityMappingProjectJob(project, existingRefs = []) {
  if (!isUtilityMappingOrg() || !project) return project;
  const yy = utilityMappingJobYearYY(project.timelineStart);
  let umJobNumber = String(project.umJobNumber || "").replace(/\D/g, "");
  let umClientCode = String(project.umClientCode || "").trim().toUpperCase();
  if (!umClientCode) {
    umClientCode = matchUtilityMappingClientCode(project.client || project.site) || "";
  }
  if (!umJobNumber) {
    umJobNumber = nextUtilityMappingJobNumber(existingRefs, yy);
  }
  const jobRef =
    umJobNumber && umClientCode
      ? formatUtilityMappingRef({ yearYY: yy, jobNumber: umJobNumber, clientCode: umClientCode })
      : umJobNumber
        ? formatUtilityMappingRef({ yearYY: yy, jobNumber: umJobNumber, clientCode: "XXX" })
        : "";
  const clientName =
    project.client ||
    getUtilityMappingClient(umClientCode)?.name ||
    project.site ||
    "";
  return {
    ...project,
    umJobNumber,
    umClientCode,
    code: jobRef || project.code || "",
    umJobRef: jobRef || project.umJobRef || "",
    client: clientName || project.client || "",
  };
}

/**
 * Apply project job identity onto a document (survey / gpr / rams / ms).
 * @param {object} doc
 * @param {object} project
 * @param {'SR'|'GPR'|'RA'|'MS'|'PTW'} [docType]
 */
export function applyUtilityMappingProjectJobToDoc(doc, project, docType = "SR") {
  if (!isUtilityMappingOrg() || !doc || !project) return doc;
  const job = getUtilityMappingProjectJob(project);
  if (!job.umJobNumber && !job.umClientCode) return doc;
  const next = {
    ...doc,
    umJobNumber: job.umJobNumber || doc.umJobNumber || "",
    umClientCode: job.umClientCode || doc.umClientCode || "",
    client: job.clientName || doc.client || "",
  };
  if (docType === "SR") {
    return syncUtilityMappingReportRef(next, []);
  }
  if (docType === "GPR") {
    const typed = formatUtilityMappingTypedRef("GPR", next);
    return { ...next, ref: typed || next.ref };
  }
  if (docType === "RA") {
    const typed = formatUtilityMappingTypedRef("RA", { ...next, jobRef: job.jobRef });
    return {
      ...next,
      documentNo: typed || next.documentNo,
      jobRef: job.jobRef || next.jobRef,
    };
  }
  if (docType === "MS") {
    const typed = formatUtilityMappingTypedRef("MS", { ...next, jobRef: job.jobRef });
    return { ...next, jobRef: typed || job.jobRef || next.jobRef };
  }
  if (docType === "PTW") {
    const typed = formatUtilityMappingTypedRef("PTW", { ...next, jobRef: job.jobRef });
    return { ...next, jobRef: typed || job.jobRef || next.jobRef };
  }
  return next;
}
