import { supabase } from "../lib/supabase";
import { getCachedActiveCountryWorkspace } from "./countryWorkspaces";

const BUCKET = "permit-evidence";

/**
 * Upload a site evidence image for a permit. Requires signed-in user and storage migration.
 * Stores the private storage path only — signed URLs are minted short-lived at display time.
 * @param {File} file
 * @param {string} permitId
 * @returns {{ path: string, signedUrl: string | null }}
 */
export async function uploadPermitEvidencePhoto(file, permitId) {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user?.id) throw new Error("Sign in to upload photos.");
  // Country workspaces isolate evidence per paid country. Organisations that have not been
  // migrated yet (or are offline-only) keep uploading under a stable legacy segment rather
  // than losing the feature — the storage policy scopes objects by user id either way.
  const workspaceId = getCachedActiveCountryWorkspace()?.id || "legacy";

  const safePermit = String(permitId || "draft").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${workspaceId}/${safePermit}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throw upErr;

  // Optional short-lived URL for immediate UI preview only — do not persist this on the permit.
  let signedUrl = null;
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (signed?.signedUrl) signedUrl = signed.signedUrl;

  return { path, signedUrl };
}
