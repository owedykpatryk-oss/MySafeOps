/**
 * Vercel serverless: accepts Web Vitals metric JSON; logs one line (Vercel → Functions → Logs).
 */

import { API_JSON_HEADERS, readJsonBody, sanitizeWebVitalsPayload, sendJson } from "./securityUtils.js";

const MAX_JSON_BYTES = 12_000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType && !contentType.includes("application/json") && !contentType.includes("text/plain")) {
    return sendJson(res, 415, { error: "unsupported_media_type" });
  }

  const parsed = await readJsonBody(req, MAX_JSON_BYTES);
  if (parsed?.__body_too_large) {
    return sendJson(res, 413, { error: "payload_too_large" });
  }
  if (parsed === null) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const metric = sanitizeWebVitalsPayload(parsed);
  if (!metric) {
    return sendJson(res, 400, { error: "invalid_metric" });
  }

  const pathSuffix = metric.path ? ` path=${metric.path}` : "";
  console.log(`[web-vitals] ${metric.name} value=${metric.value} id=${metric.id}${pathSuffix}`);

  res.writeHead(204, API_JSON_HEADERS);
  return res.end();
}
