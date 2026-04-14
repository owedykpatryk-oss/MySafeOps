import { supabase } from "../lib/supabase";

function normalizePersonKey(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.-]/g, "")
    .trim();
}

function stripRoleFromLabel(v) {
  const text = String(v || "");
  const idx = text.indexOf(" — ");
  return idx >= 0 ? text.slice(0, idx).trim() : text.trim();
}

function uniqEmails(items) {
  const seen = new Set();
  const out = [];
  items.forEach((email) => {
    const e = String(email || "").trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    if (seen.has(e)) return;
    seen.add(e);
    out.push(e);
  });
  return out;
}

export function parseManualEmails(raw) {
  return uniqEmails(
    String(raw || "")
      .split(/[,\s;]+/g)
      .map((x) => x.trim())
      .filter(Boolean)
  );
}

/**
 * Build recipient list for permit notifications from worker records.
 * @param {object} permit
 * @param {Array<{name?: string, email?: string}>} workers
 */
export function buildPermitEmailRecipients(permit, workers = []) {
  const who = [permit?.issuedTo, permit?.issuedBy]
    .map((x) => stripRoleFromLabel(x))
    .filter(Boolean)
    .map(normalizePersonKey);
  if (who.length === 0) return [];
  const emails = workers
    .filter((w) => {
      const workerName = normalizePersonKey(w?.name);
      return workerName && who.includes(workerName);
    })
    .map((w) => w?.email)
    .filter(Boolean);
  return uniqEmails(emails);
}

/**
 * Send permit notification email via Supabase Edge Function.
 * @param {{ permit: object, recipients: string[], orgName?: string, message?: string, ramsDoc?: object }} payload
 */
export async function sendPermitNotificationEmail(payload) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const body = {
    permit: {
      id: payload?.permit?.id,
      type: payload?.permit?.type,
      location: payload?.permit?.location,
      description: payload?.permit?.description,
      status: payload?.permit?.status,
      startDateTime: payload?.permit?.startDateTime,
      endDateTime: payload?.permit?.endDateTime,
      issuedTo: payload?.permit?.issuedTo,
      issuedBy: payload?.permit?.issuedBy,
      notes: payload?.permit?.notes,
    },
    recipients: uniqEmails(payload?.recipients || []),
    orgName: String(payload?.orgName || "MySafeOps"),
    message: String(payload?.message || ""),
    ramsDoc: payload?.ramsDoc
      ? {
          id: payload.ramsDoc.id,
          title: payload.ramsDoc.title,
          documentNo: payload.ramsDoc.documentNo,
          status: payload.ramsDoc.documentStatus || payload.ramsDoc.status,
        }
      : null,
  };
  const { data, error } = await supabase.functions.invoke("send-permit-notification", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data || { ok: true };
}

/**
 * Send Web Push permit notification via Supabase Edge Function.
 * Uses subscriptions registered for current user/org.
 * @param {{ permit: object, title?: string, body?: string, orgSlug?: string, url?: string, tag?: string }} payload
 */
export async function sendPermitNotificationWebPush(payload) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const body = {
    orgSlug: String(payload?.orgSlug || localStorage.getItem("mysafeops_orgId") || "default").trim().toLowerCase(),
    title: String(payload?.title || "Permit update"),
    body: String(payload?.body || ""),
    url: String(payload?.url || "/?tab=permits"),
    tag: String(payload?.tag || `permit_${payload?.permit?.id || "update"}`),
    permit: {
      id: payload?.permit?.id,
      type: payload?.permit?.type,
      location: payload?.permit?.location,
      status: payload?.permit?.status,
    },
  };
  const { data, error } = await supabase.functions.invoke("send-permit-web-push", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data || { ok: true };
}
