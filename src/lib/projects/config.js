/**
 * Multi-project content platform config.
 * Articles carry a `project` slug; filters default to the active site project.
 */

/** @typedef {{ slug: string; name: string; domain: string; locale: string; blogTitle: string; blogDescription: string }} ContentProject */

/** @type {Record<string, ContentProject>} */
export const CONTENT_PROJECTS = {
  mysafeops: {
    slug: "mysafeops",
    name: "MySafeOps",
    domain: "mysafeops.com",
    locale: "en-GB",
    blogTitle: "Blog — UK construction safety guides | MySafeOps",
    blogDescription:
      "Practical UK construction safety guides for site managers and H&S leads: permits, inductions, toolbox talks, COSHH, and compliance updates.",
  },
  landorahub: {
    slug: "landorahub",
    name: "LandoraHub",
    domain: "landorahub.com",
    locale: "en-GB",
    blogTitle: "LandoraHub Blog",
    blogDescription: "Property and land management insights.",
  },
  flowconnect: {
    slug: "flowconnect",
    name: "FlowConnect",
    domain: "flowconnect.io",
    locale: "en-GB",
    blogTitle: "FlowConnect Blog",
    blogDescription: "Integration and workflow automation guides.",
  },
};

/** Active project for this deployment (override via VITE_CONTENT_PROJECT). */
export function getActiveProjectSlug() {
  const fromEnv = String(import.meta.env.VITE_CONTENT_PROJECT || "").trim().toLowerCase();
  if (fromEnv && CONTENT_PROJECTS[fromEnv]) return fromEnv;
  return "mysafeops";
}

/** @param {string} [slug] */
export function getProjectConfig(slug) {
  const key = slug || getActiveProjectSlug();
  return CONTENT_PROJECTS[key] ?? CONTENT_PROJECTS.mysafeops;
}
