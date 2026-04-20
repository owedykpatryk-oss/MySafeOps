/**
 * Vercel serverless: accepts Web Vitals metric JSON; logs one line (Vercel → Functions → Logs).
 */

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
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
  if (parsed === null) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const name = String(parsed.name || parsed.metric || "unknown");
  const value = typeof parsed.value === "number" ? parsed.value : parsed.delta;
  const id = String(parsed.id || "");
  console.log(`[web-vitals] ${name} value=${value} id=${id}`);

  res.writeHead(204);
  return res.end();
}
