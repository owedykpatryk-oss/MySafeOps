/**
 * Vercel serverless: accepts Web Vitals metric JSON; logs one line (Vercel → Functions → Logs).
 */

const MAX_JSON_BYTES = 12_000;

const API_RES_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, API_RES_HEADERS);
  res.end(body);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) {
      return { __body_too_large: true };
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const parsed = await readJsonBody(req);
  if (parsed?.__body_too_large) {
    return sendJson(res, 413, { error: "payload_too_large" });
  }
  if (parsed === null) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const name = String(parsed.name || parsed.metric || "unknown");
  const value = typeof parsed.value === "number" ? parsed.value : parsed.delta;
  const id = String(parsed.id || "");
  console.log(`[web-vitals] ${name} value=${value} id=${id}`);

  res.writeHead(204, {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  return res.end();
}
