import { supabase } from "../lib/supabase";

const BUCKET = "permit-evidence";

/**
 * Upload a site evidence image for a permit. Requires signed-in user and storage migration.
 * @param {File} file
 * @param {string} permitId
 * @returns {{ path: string, signedUrl: string }}
 */
export async function uploadPermitEvidencePhoto(file, permitId) {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user?.id) throw new Error("Sign in to upload photos.");

  const safePermit = String(permitId || "draft").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${safePermit}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr) throw signErr;
  if (!signed?.signedUrl) throw new Error("Could not create access link for upload.");

  return { path, signedUrl: signed.signedUrl };
}
