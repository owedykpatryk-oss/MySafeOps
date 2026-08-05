/**
 * Document / audit authorship from the signed-in Supabase user.
 * Cache is kept warm by SupabaseAuthProvider; stamp helpers are sync-safe for save paths.
 */

import { deriveUserDisplayName } from "./soloWorkspace.js";

/** @type {{ id: string, email: string, name: string } | null} */
let cachedActor = null;

/**
 * @param {import("@supabase/supabase-js").User | null | undefined} user
 * @param {object} [orgSettings]
 */
export function setAuthorshipUserCache(user, orgSettings = {}) {
  if (!user?.id) {
    cachedActor = null;
    return null;
  }
  const email = String(user.email || "").trim();
  const name = deriveUserDisplayName(user, orgSettings);
  cachedActor = {
    id: String(user.id),
    email,
    name: name || email || "Unknown user",
  };
  return cachedActor;
}

/** @returns {{ id: string, email: string, name: string } | null} */
export function getCachedAuthorshipActor() {
  return cachedActor;
}

/** Clear cache (tests / sign-out). */
export function clearAuthorshipUserCache() {
  cachedActor = null;
}

/**
 * @param {{ id?: string, email?: string, name?: string } | null | undefined} actor
 * @returns {string}
 */
export function formatActorLabel(actor) {
  if (!actor) return "";
  const name = String(actor.name || "").trim();
  const email = String(actor.email || "").trim();
  if (name && email && !name.includes("@")) return `${name} (${email})`;
  return name || email || "";
}

/**
 * Stamp createdBy* on first save and updatedBy* on every save.
 * Does not overwrite an existing createdById (first author wins).
 *
 * @template {Record<string, unknown>} T
 * @param {T} record
 * @param {{ isCreate?: boolean, at?: string }} [opts]
 * @returns {T & {
 *   createdBy?: string,
 *   createdByEmail?: string,
 *   createdById?: string,
 *   updatedBy?: string,
 *   updatedByEmail?: string,
 *   updatedById?: string,
 *   updatedAt?: string,
 *   createdAt?: string,
 * }}
 */
export function stampDocumentAuthorship(record, opts = {}) {
  const actor = getCachedAuthorshipActor();
  const at = opts.at || new Date().toISOString();
  const base = record && typeof record === "object" ? { ...record } : {};
  const isCreate =
    opts.isCreate === true ||
    !base.createdAt ||
    !base.createdById;

  if (!base.createdAt) base.createdAt = at;
  base.updatedAt = at;

  if (!actor) return /** @type {any} */ (base);

  if (isCreate || !base.createdById) {
    if (!base.createdBy) base.createdBy = actor.name;
    if (!base.createdByEmail) base.createdByEmail = actor.email;
    if (!base.createdById) base.createdById = actor.id;
  }

  base.updatedBy = actor.name;
  base.updatedByEmail = actor.email;
  base.updatedById = actor.id;

  return /** @type {any} */ (base);
}

/**
 * Fields to attach onto an audit log row.
 * @returns {{ by?: string, byEmail?: string, byUserId?: string }}
 */
export function authorshipAuditFields() {
  const actor = getCachedAuthorshipActor();
  if (!actor) return {};
  return {
    by: actor.name,
    byEmail: actor.email,
    byUserId: actor.id,
  };
}

/**
 * Short line for list chips / UI.
 * @param {object} doc
 * @returns {string}
 */
export function documentAuthorshipSummary(doc) {
  if (!doc || typeof doc !== "object") return "";
  const created = String(doc.createdBy || "").trim();
  const updated = String(doc.updatedBy || "").trim();
  if (created && updated && created !== updated) {
    return `Created by ${created} · Last edit ${updated}`;
  }
  if (updated) return `Last edit ${updated}`;
  if (created) return `Created by ${created}`;
  return "";
}
