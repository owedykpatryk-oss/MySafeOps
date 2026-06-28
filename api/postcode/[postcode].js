/**
 * Legacy path: GET /api/postcode/KT227SH (older cached app bundles).
 * Prefer GET /api/postcode?code=KT227SH — see api/postcode.js
 */

import handler from "../postcode.js";

export default async function legacyPostcodeHandler(req, res) {
  const code = String(req.query?.postcode || req.query?.code || "").trim();
  req.query = { ...(req.query || {}), code, postcode: code };
  return handler(req, res);
}
