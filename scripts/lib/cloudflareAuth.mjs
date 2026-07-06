import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_ACCOUNT_ID = "18efbdd5472a2d731ef6fe63b0df2c9b";

function readWranglerOAuthToken() {
  const cfg = join(process.env.APPDATA || "", "xdg.config", ".wrangler", "config", "default.toml");
  if (!existsSync(cfg)) return "";
  const m = readFileSync(cfg, "utf8").match(/oauth_token\s*=\s*"([^"]+)"/);
  return m?.[1]?.trim() || "";
}

/** Cloudflare API bearer token + account id (env or wrangler OAuth). */
export function getCloudflareAuth(env = process.env) {
  const token = env.CLOUDFLARE_API_TOKEN?.trim() || readWranglerOAuthToken();
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() || DEFAULT_ACCOUNT_ID;
  if (!token) return null;
  return { token, accountId };
}

export async function cloudflareApi(path, { method = "GET", body, env = process.env } = {}) {
  const auth = getCloudflareAuth(env);
  if (!auth) throw new Error("Missing Cloudflare auth — run `npx wrangler login` or set CLOUDFLARE_API_TOKEN");
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.result;
}
