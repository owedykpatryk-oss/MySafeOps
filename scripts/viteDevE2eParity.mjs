/**
 * Vite dev middleware parity with Vercel serverless routes for Playwright E2E.
 */
import { isSameSiteApiRequest, sanitizeWebVitalsPayload } from "../api/securityUtils.js";
import {
  isValidUkPostcodeCompact,
  normaliseUkPostcodeCompact,
} from "../api/postcodeUtils.js";

const DEV_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io;",
};

function slimPostcodePayload(value) {
  if (!value?.result) return value;
  const r = value.result;
  return {
    status: value.status,
    result: {
      postcode: r.postcode,
      latitude: r.latitude,
      longitude: r.longitude,
      admin_district: r.admin_district,
      region: r.region,
      country: r.country,
      parish: r.parish,
    },
  };
}

async function openMeteoWeather(lat, lng) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lng));
  u.searchParams.set("current", "temperature_2m,weather_code");
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = await res.json();
  const temp = json?.current?.temperature_2m;
  if (typeof temp !== "number") return null;
  return {
    main: { temp },
    weather: [{ description: "Open-Meteo dev fallback" }],
  };
}

export function viteDevE2eParity(env) {
  return {
    name: "dev-e2e-parity",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const pathOnly = req.url.split("?")[0];

        if ((pathOnly === "/" || pathOnly === "/login") && (req.method === "GET" || req.method === "HEAD")) {
          for (const [k, v] of Object.entries(DEV_SECURITY_HEADERS)) res.setHeader(k, v);
          return next();
        }

        if (pathOnly === "/api/web-vitals") {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          if (!isSameSiteApiRequest(req)) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "forbidden_origin" }));
            return;
          }
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          let parsed = {};
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          } catch {
            res.statusCode = 400;
            res.end();
            return;
          }
          if (!sanitizeWebVitalsPayload(parsed)) {
            res.statusCode = 400;
            res.end();
            return;
          }
          res.statusCode = 204;
          res.end();
          return;
        }

        if (pathOnly === "/api/postcode" || pathOnly.startsWith("/api/postcode/")) {
          if (req.method !== "GET" && req.method !== "HEAD") return next();
          if (!isSameSiteApiRequest(req)) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "forbidden_origin" }));
            return;
          }
          const legacy = pathOnly.match(/^\/api\/postcode\/([^/]+)$/);
          const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
          const params = new URLSearchParams(q);
          const raw = legacy?.[1] || params.get("code") || params.get("postcode") || "";
          const compact = normaliseUkPostcodeCompact(raw);
          if (!compact || !isValidUkPostcodeCompact(compact)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid UK postcode" }));
            return;
          }
          try {
            const upstream = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`, {
              headers: { Accept: "application/json" },
            });
            const text = await upstream.text();
            const value = JSON.parse(text);
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json");
            if (req.method === "HEAD") {
              res.end();
              return;
            }
            res.end(JSON.stringify(slimPostcodePayload(value)));
          } catch {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Postcode lookup unavailable" }));
          }
          return;
        }

        if (pathOnly === "/api/weather") {
          if (req.method !== "GET" && req.method !== "HEAD") return next();
          if (!isSameSiteApiRequest(req)) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "forbidden_origin" }));
            return;
          }
          const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
          const params = new URLSearchParams(q);
          let lat = parseFloat(params.get("lat") || "");
          let lng = parseFloat(params.get("lng") || params.get("lon") || "");
          const pcRaw = String(params.get("postcode") || params.get("code") || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && pcRaw) {
            const compact = normaliseUkPostcodeCompact(pcRaw);
            if (!compact || !isValidUkPostcodeCompact(compact)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_postcode" }));
              return;
            }
            try {
              const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`, {
                headers: { Accept: "application/json" },
              });
              if (!pcRes.ok) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "postcode_not_found" }));
                return;
              }
              const pcJson = await pcRes.json();
              lat = Number(pcJson?.result?.latitude);
              lng = Number(pcJson?.result?.longitude);
            } catch {
              res.statusCode = 502;
              res.end();
              return;
            }
          }
          if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "invalid_coordinates" }));
            return;
          }
          const apiKey = String(env.OPENWEATHER_API_KEY || env.VITE_OPENWEATHER_API_KEY || "").trim();
          if (apiKey) {
            return next();
          }
          const fallback = await openMeteoWeather(lat, lng);
          if (!fallback) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "weather_unavailable" }));
            return;
          }
          if (pcRaw) {
            try {
              const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(normaliseUkPostcodeCompact(pcRaw))}`, {
                headers: { Accept: "application/json" },
              });
              if (pcRes.ok) {
                const pcJson = await pcRes.json();
                fallback._mysafeops = {
                  postcode: pcJson?.result?.postcode || pcRaw,
                  lat,
                  lng,
                };
              }
            } catch {
              /* optional meta */
            }
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          if (req.method === "HEAD") {
            res.end();
            return;
          }
          res.end(JSON.stringify(fallback));
          return;
        }

        return next();
      });
    },
  };
}
