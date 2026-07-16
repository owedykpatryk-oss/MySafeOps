import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { viteDevE2eParity } from "./scripts/viteDevE2eParity.mjs";

function supabaseDnsPrefetchOriginFromEnv(env) {
  const raw = String(env.VITE_SUPABASE_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseDnsOrigin = supabaseDnsPrefetchOriginFromEnv(env);
  const sentryAuthToken = String(env.SENTRY_AUTH_TOKEN || "").trim();
  const sentryOrg = String(env.SENTRY_ORG || "").trim();
  const sentryProject = String(env.SENTRY_PROJECT || "").trim();
  const sentryUploadEnabled = Boolean(sentryAuthToken && sentryOrg && sentryProject);

  return {
    server: {
      proxy: {
        "/api/postcode": {
          target: "https://api.postcodes.io",
          changeOrigin: true,
          rewrite: (path) => {
            const q = path.indexOf("?");
            const search = q >= 0 ? path.slice(q + 1) : "";
            const code = String(new URLSearchParams(search).get("code") || "")
              .replace(/\s/g, "")
              .toUpperCase();
            if (!code) return "/postcodes/invalid";
            return `/postcodes/${encodeURIComponent(code)}`;
          },
        },
      },
    },
    plugins: [
      react(),
      viteDevE2eParity(env),
      ...(sentryUploadEnabled
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              telemetry: false,
            }),
          ]
        : []),
      {
        name: "dev-legacy-postcode-api",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next();
            const pathOnly = req.url.split("?")[0];
            const m = pathOnly.match(/^\/api\/postcode\/([^/]+)$/);
            if (m) {
              req.url = `/api/postcode?code=${encodeURIComponent(m[1])}${req.url.includes("?") ? "&" + req.url.split("?")[1] : ""}`;
            }
            next();
          });
        },
      },
      {
        name: "dev-au-postcode-api",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next();
            const pathOnly = req.url.split("?")[0];
            const legacy = pathOnly.match(/^\/api\/au-postcode\/([^/]+)$/);
            const isAuPostcode = pathOnly === "/api/au-postcode" || legacy;
            if (!isAuPostcode) return next();

            const search = req.url.includes("?") ? req.url.split("?")[1] : "";
            const params = new URLSearchParams(search);
            const code = String(legacy?.[1] || params.get("code") || params.get("postcode") || "").replace(/\D/g, "");
            const n = Number(code);
            if (!/^\d{4}$/.test(code) || n < 800 || n > 9999) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "Invalid Australian postcode (4 digits)" }));
              return;
            }

            try {
              const url = new URL("https://nominatim.openstreetmap.org/search");
              url.searchParams.set("postalcode", code);
              url.searchParams.set("country", "Australia");
              url.searchParams.set("format", "json");
              url.searchParams.set("limit", "1");
              const upstream = await fetch(url.toString(), {
                headers: {
                  Accept: "application/json",
                  "User-Agent": "MySafeOps/1.0 (AU construction safety; support@mysafeops.com)",
                },
              });
              const rows = await upstream.json();
              const row = Array.isArray(rows) ? rows[0] : null;
              if (!row?.lat || !row?.lon) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: "Postcode not found" }));
                return;
              }
              const address = row.address || {};
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.setHeader("Cache-Control", "public, max-age=86400");
              if (req.method === "HEAD") {
                res.end();
                return;
              }
              res.end(
                JSON.stringify({
                  status: 200,
                  result: {
                    postcode: code,
                    latitude: Number(row.lat),
                    longitude: Number(row.lon),
                    locality: address.city || address.town || address.suburb || address.village || "",
                    state: address.state || "",
                    country: address.country || "Australia",
                  },
                })
              );
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "Postcode lookup unavailable" }));
            }
          });
        },
      },
      {
        name: "dev-pl-postcode-api",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next();
            const pathOnly = req.url.split("?")[0];
            const legacy = pathOnly.match(/^\/api\/pl-postcode\/([^/]+)$/);
            const isPlPostcode = pathOnly === "/api/pl-postcode" || legacy;
            if (!isPlPostcode) return next();

            const search = req.url.includes("?") ? req.url.split("?")[1] : "";
            const params = new URLSearchParams(search);
            const raw = String(legacy?.[1] || params.get("code") || params.get("postcode") || "");
            const digits = raw.replace(/\D/g, "");
            const code = digits.length === 5 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : null;
            if (!code) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "Invalid Polish postcode (format XX-XXX)" }));
              return;
            }

            try {
              const url = new URL("https://nominatim.openstreetmap.org/search");
              url.searchParams.set("postalcode", code);
              url.searchParams.set("country", "Poland");
              url.searchParams.set("format", "json");
              url.searchParams.set("limit", "1");
              const upstream = await fetch(url.toString(), {
                headers: {
                  Accept: "application/json",
                  "User-Agent": "MySafeOps/1.0 (PL construction safety; support@mysafeops.com)",
                },
              });
              const rows = await upstream.json();
              const row = Array.isArray(rows) ? rows[0] : null;
              if (!row?.lat || !row?.lon) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: "Postcode not found" }));
                return;
              }
              const address = row.address || {};
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.setHeader("Cache-Control", "public, max-age=86400");
              if (req.method === "HEAD") {
                res.end();
                return;
              }
              res.end(
                JSON.stringify({
                  lat: Number(row.lat),
                  lng: Number(row.lon),
                  postcode: address.postcode || code,
                  city: address.city || address.town || address.village || "",
                  adminDistrict: address.city || address.county || "",
                  region: address.state || address.voivodeship || "",
                  country: address.country || "Poland",
                })
              );
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "Postcode lookup unavailable" }));
            }
          });
        },
      },
      {
        name: "dev-health-api",
        configureServer(server) {
          server.middlewares.use("/api/health", (req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.statusCode = 200;
            if (req.method === "HEAD") {
              res.end();
              return;
            }
            res.end(JSON.stringify({ ok: true, ts: Date.now() }));
          });
        },
      },
      {
        name: "block-anthropic-key-in-production",
        config(_config, { mode }) {
          if (mode === "production" && String(env.VITE_ANTHROPIC_API_KEY || "").trim()) {
            throw new Error(
              "VITE_ANTHROPIC_API_KEY must not be set for production builds — use VITE_ANTHROPIC_PROXY_URL and server-side ANTHROPIC_API_KEY instead."
            );
          }
        },
      },
      {
        name: "block-openweather-key-in-production",
        config(_config, { mode }) {
          if (mode === "production" && String(env.VITE_OPENWEATHER_API_KEY || "").trim()) {
            throw new Error(
              "VITE_OPENWEATHER_API_KEY must not be set for production builds — use server-side OPENWEATHER_API_KEY with /api/weather instead."
            );
          }
        },
      },
      {
        name: "dev-weather-api",
        configureServer(server) {
          server.middlewares.use("/api/weather", async (req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            const apiKey = String(env.OPENWEATHER_API_KEY || env.VITE_OPENWEATHER_API_KEY || "").trim();
            const q = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
            const params = new URLSearchParams(q);
            let lat = parseFloat(params.get("lat") || "");
            let lng = parseFloat(params.get("lng") || params.get("lon") || "");
            let postcodeMeta = "";
            const pcRaw = String(params.get("postcode") || params.get("code") || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
            if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && pcRaw) {
              try {
                const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pcRaw)}`, {
                  headers: { Accept: "application/json" },
                });
                if (pcRes.ok) {
                  const pcJson = await pcRes.json();
                  lat = Number(pcJson?.result?.latitude);
                  lng = Number(pcJson?.result?.longitude);
                  postcodeMeta = pcJson?.result?.postcode || pcRaw;
                }
              } catch {
                /* fall through */
              }
            }
            if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
              res.statusCode = pcRaw ? 404 : 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: pcRaw ? "postcode_not_found" : "invalid_coordinates" }));
              return;
            }
            if (!apiKey) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "openweather_not_configured" }));
              return;
            }
            try {
              const u = new URL("https://api.openweathermap.org/data/2.5/weather");
              u.searchParams.set("lat", String(lat));
              u.searchParams.set("lon", String(lng));
              u.searchParams.set("appid", apiKey);
              u.searchParams.set("units", "metric");
              const upstream = await fetch(u.toString());
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader("Content-Type", "application/json");
              if (req.method === "HEAD") {
                res.end();
                return;
              }
              if (upstream.ok && postcodeMeta) {
                try {
                  const parsed = JSON.parse(text);
                  parsed._mysafeops = { postcode: postcodeMeta, lat, lng };
                  res.end(JSON.stringify(parsed));
                  return;
                } catch {
                  /* raw text */
                }
              }
              res.end(text);
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "weather_upstream_unreachable" }));
            }
          });
        },
      },
      {
        name: "dev-geology-api",
        configureServer(server) {
          server.middlewares.use("/api/geology", async (req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            const q = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
            const params = new URLSearchParams(q);
            const lat = parseFloat(params.get("lat") || "");
            const lng = parseFloat(params.get("lng") || params.get("lon") || "");
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_coordinates" }));
              return;
            }
            const delta = 0.002;
            const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
            const collections = ["bgsgeology625kbedrock", "bgsgeology625ksuperficial"];
            try {
              const fetchLayer = async (id) => {
                const u = `https://ogcapi.bgs.ac.uk/collections/${id}/items?bbox=${bbox}&limit=5&f=json`;
                const r = await fetch(u, { headers: { Accept: "application/geo+json" } });
                if (!r.ok) return null;
                const j = await r.json();
                const p = j.features?.[0]?.properties;
                if (!p) return null;
                return {
                  lex: p.lex || "",
                  lexDescription: p.lex_d || "",
                  rock: p.rock || "",
                  rockDescription: p.rock_d || "",
                  maxSystem: p.max_system || "",
                };
              };
              const [bedrock, superficial] = await Promise.all(collections.map(fetchLayer));
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              if (req.method === "HEAD") {
                res.end();
                return;
              }
              res.end(
                JSON.stringify({
                  lat,
                  lng,
                  fetchedAt: new Date().toISOString(),
                  source: "bgs-ogcapi",
                  scale: "1:625,000 (generalised)",
                  bedrock,
                  superficial,
                })
              );
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "geology_upstream_unreachable" }));
            }
          });
        },
      },
      {
        name: "dev-osrm-route-api",
        configureServer(server) {
          server.middlewares.use("/api/osrm-route", async (req, res, next) => {
            if (req.method !== "POST" && req.method !== "HEAD") return next();
            if (req.method === "HEAD") {
              res.statusCode = 204;
              res.end();
              return;
            }
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            let body = {};
            try {
              body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_json" }));
              return;
            }
            const fromLat = Number(body.fromLat ?? body.lat);
            const fromLng = Number(body.fromLng ?? body.lng);
            const toLat = Number(body.toLat);
            const toLng = Number(body.toLng);
            if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_coordinates" }));
              return;
            }
            const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
            try {
              const upstream = await fetch(url, {
                headers: { Accept: "application/json", "User-Agent": "MySafeOps/1.0 (dev osrm; mysafeops.com)" },
              });
              const text = await upstream.text();
              let json;
              try {
                json = JSON.parse(text);
              } catch {
                res.statusCode = 502;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "osrm_upstream_invalid" }));
                return;
              }
              const route = json?.routes?.[0];
              const coords = route?.geometry?.coordinates;
              if (!Array.isArray(coords) || coords.length < 2) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "no_route" }));
                return;
              }
              const ring = coords
                .map((c) => (Array.isArray(c) && c.length >= 2 ? [Number(c[1]), Number(c[0])] : null))
                .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ring,
                  distance_m: route.distance ?? null,
                  duration_s: route.duration ?? null,
                })
              );
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "osrm_upstream_unreachable" }));
            }
          });
        },
      },
      {
        name: "dev-overpass-api",
        configureServer(server) {
          server.middlewares.use("/api/overpass", async (req, res, next) => {
            if (req.method !== "POST" && req.method !== "HEAD") return next();
            if (req.method === "HEAD") {
              res.statusCode = 204;
              res.end();
              return;
            }
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            let body = {};
            try {
              body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_json" }));
              return;
            }
            const lat = Number(body.lat);
            const lng = Number(body.lng);
            const radiusM = Math.max(500, Math.min(50_000, Number(body.radiusM) || 25_000));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_coordinates" }));
              return;
            }
            const { buildHospitalQuery } = await import("./src/utils/hospitalOverpassQuery.js");
            const query = buildHospitalQuery(lat, lng, radiusM);
            const upstreams = [
              "https://overpass-api.de/api/interpreter",
              "https://lz4.overpass-api.de/api/interpreter",
              "https://overpass.kumi.systems/api/interpreter",
              "https://overpass.openstreetmap.ru/api/interpreter",
            ];
            let done = false;
            for (const url of upstreams) {
              try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 22_000);
                const upstream = await fetch(url, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
                    "User-Agent": "MySafeOps/1.0 (dev nearest hospital; mysafeops.com)",
                  },
                  body: `data=${encodeURIComponent(query)}`,
                  signal: controller.signal,
                }).finally(() => clearTimeout(timer));
                if (!upstream.ok) continue;
                const text = await upstream.text();
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.setHeader("X-Hospital-Source", "overpass");
                res.end(text);
                done = true;
                break;
              } catch {
                /* try next mirror */
              }
            }
            if (!done) {
              try {
                const delta = 0.35;
                const u = new URL("https://nominatim.openstreetmap.org/search");
                u.searchParams.set("amenity", "hospital");
                u.searchParams.set("format", "jsonv2");
                u.searchParams.set("limit", "12");
                u.searchParams.set("viewbox", `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
                u.searchParams.set("bounded", "1");
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 12_000);
                const fallback = await fetch(u.toString(), {
                  headers: {
                    Accept: "application/json",
                    "User-Agent": "MySafeOps/1.0 (dev nearest hospital; mysafeops.com)",
                  },
                  signal: controller.signal,
                }).finally(() => clearTimeout(timer));
                if (fallback.ok) {
                  const rows = await fallback.json();
                  if (Array.isArray(rows) && rows.length) {
                    const elements = rows
                      .map((row) => {
                        const la = Number(row.lat);
                        const lo = Number(row.lon);
                        if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
                        const name =
                          String(row.name || row.display_name || "Hospital").split(",")[0].trim() || "Hospital";
                        return { type: "node", lat: la, lon: lo, tags: { amenity: "hospital", name } };
                      })
                      .filter(Boolean);
                    if (elements.length) {
                      res.statusCode = 200;
                      res.setHeader("Content-Type", "application/json");
                      res.setHeader("X-Hospital-Source", "nominatim");
                      res.end(JSON.stringify({ elements }));
                      done = true;
                    }
                  }
                }
              } catch {
                /* fall through to 502 */
              }
            }
            if (!done) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "overpass_upstream_unreachable" }));
            }
          });
        },
      },
      {
        name: "inject-supabase-resource-hints",
        transformIndexHtml(html) {
          const site = String(env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/$/, "");
          const ogImage = `${site}/blog/images/permit-to-work-app-uk-hero.png`;
          const ogAlt = "MySafeOps — UK construction RAMS, permits, and site safety workspace";
          const ogBlock = `    <meta property="og:url" content="${site}/" />\n    <meta property="og:image" content="${ogImage}" />\n    <meta property="og:image:alt" content="${ogAlt}" />\n    <meta name="twitter:image" content="${ogImage}" />\n    <meta name="twitter:image:alt" content="${ogAlt}" />\n`;
          let out = /<\/title>/i.test(html)
            ? html.replace(/<\/title>\s*/i, `</title>\n${ogBlock}`)
            : html.replace("</head>", `${ogBlock}</head>`);
          if (!supabaseDnsOrigin) return out;
          return out.replace(
            "</head>",
            `    <link rel="preconnect" href="${supabaseDnsOrigin}" crossorigin />\n    <link rel="dns-prefetch" href="${supabaseDnsOrigin}" />\n  </head>`
          );
        },
      },
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.{js,jsx}", "api/**/*.test.js"],
    },
    build: {
      target: "es2022",
      sourcemap: sentryUploadEnabled ? "hidden" : false,
      reportCompressedSize: false,
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks(id) {
            const norm = id.replace(/\\/g, "/");
            if (!norm.includes("node_modules")) {
              // Tiny loader only — AppContext clears cache; must not sit in rams-hazards
              // (shared-ui ↔ rams-hazards TDZ). Heavy library stays in rams-hazards via dynamic import.
              if (norm.includes("/modules/rams/ramsHazardLibraryLoader")) return "shared-ui";
              if (
                norm.includes("/modules/rams/ramsHazardLibrary") ||
                norm.includes("/modules/rams/ramsAllHazards") ||
                norm.includes("/modules/rams/ramsHazardLibraryExtended") ||
                norm.includes("/modules/rams/ramsHazardLibraryPro")
              ) {
                return "rams-hazards";
              }
              if (norm.includes("/modules/rams/constructionQuickPacks")) {
                return "rams-quick-packs";
              }
              if (norm.includes("/modules/rams/ramsPrintHtml") || norm.includes("/modules/rams/RAMSTemplateBuilder")) {
                return norm.includes("ramsPrintHtml") || norm.includes("fessRamsPrintHtml") ? "rams-print" : "rams-builder";
              }
              // Survey catalog is a zero-dep leaf used by RAMS at module init — must not live in
              // survey-report or rams-builder (cross-chunk TDZ on SURVEY_CATALOG / Js).
              if (norm.includes("/utils/surveyContentCatalog")) return "survey-catalog";
              // Keep survey↔RAMS bridge helpers in the survey chunk (not rams-builder).
              if (
                norm.includes("/utils/documentPropagation") ||
                norm.includes("/utils/surveyCompletenessGates")
              ) {
                return "survey-report";
              }
              if (norm.includes("/utils/orgAutomationRules")) return "shared-ui";
              if (norm.includes("/utils/permitWebhook") || norm.includes("/utils/permitIntegrationNotify") || norm.includes("/utils/webhookUrlValidation")) {
                return "permits-lib";
              }
              if (norm.includes("/utils/surveyPermitLink")) return "permits-lib";
              if (norm.includes("/utils/projectRamsPresence")) return "shared-ui";
              if (norm.includes("/utils/projectDocKeys") || norm.includes("/utils/ramsDocumentClone")) return "shared-ui";
              if (
                norm.includes("/utils/industryPackLabel") ||
                norm.includes("/utils/industryPackCatalog") ||
                norm.includes("/utils/industryPackPreview")
              ) {
                return "shared-ui";
              }
              // Shared leaf utils — never absorb into feature chunks (avoids cross-chunk TDZ).
              if (
                norm.includes("/utils/moduleStyles") ||
                norm.includes("/utils/htmlEscape") ||
                norm.includes("/utils/safeUrl") ||
                norm.includes("/utils/xmlEscape") ||
                norm.includes("/utils/dataUrlBlob") ||
                norm.includes("/utils/auditLog") ||
                norm.includes("/utils/workspaceNavContext") ||
                norm.includes("/utils/orgMembership") ||
                norm.includes("/utils/orgStorage") ||
                norm.includes("/utils/orgId") ||
                norm.includes("/utils/billingState") ||
                norm.includes("/utils/pdfBranding") ||
                norm.includes("/utils/orgLocale") ||
                norm.includes("/utils/orgMarket") ||
                norm.includes("/utils/orgSettingsStorage") ||
                norm.includes("/utils/orgBrandingTheme") ||
                norm.includes("/utils/orgCustomFields") ||
                norm.includes("/utils/staticMapUrl") ||
                norm.includes("/utils/geoPhotoFields") ||
                norm.includes("/utils/geoPhotoIntegrations") ||
                norm.includes("/utils/geoPhotoPresets") ||
                norm.includes("/utils/geoPhotoMedia") ||
                norm.includes("/utils/geoPhotoUtils") ||
                norm.includes("/utils/cadImportVisuals") ||
                norm.includes("/utils/surveyDxfAnalyzer") ||
                norm.includes("/utils/weatherSummary") ||
                norm.includes("/utils/weatherFieldMap") ||
                // weatherSummary imports these — keep in shared-ui (not project-drawing-lib)
                // or shared-ui ↔ project-drawing-lib cycles.
                norm.includes("/utils/siteAddressLookup") ||
                norm.includes("/utils/postcodeLookup") ||
                norm.includes("/utils/auPostcodeLookup") ||
                norm.includes("/utils/plPostcodeLookup") ||
                norm.includes("/utils/marketLabels") ||
                norm.includes("/utils/statusChipMeta") ||
                norm.includes("/utils/recycleBin") ||
                norm.includes("/utils/useRegisterListPaging") ||
                norm.includes("/utils/permitGuideStorage") ||
                norm.includes("/utils/permitContextTips") ||
                norm.includes("/utils/fessExclusive") ||
                norm.includes("/utils/fessOrg") ||
                norm.includes("/utils/fessWorkspaceProfile") ||
                norm.includes("/utils/ramsHazardPacksStorage") ||
                norm.includes("/modules/rams/orgExclusiveQuickPacks") ||
                norm.includes("/navigation/workspaceViewIds") ||
                norm.includes("/hooks/useD1OrgArraySync") ||
                norm.includes("/hooks/useCountUp") ||
                norm.includes("/context/SupabaseAuthContext") ||
                norm.includes("/context/AppContext") ||
                norm.includes("/context/ToastContext") ||
                norm.includes("/components/PageHero") ||
                norm.includes("/components/EmptyState") ||
                norm.includes("/components/StatusChip") ||
                norm.includes("/components/D1ModuleSyncBanner") ||
                norm.includes("/components/ModuleOverlay") ||
                norm.includes("/components/PrintPreviewFrame") ||
                norm.includes("/components/ConfirmDialog") ||
                norm.includes("/components/ConfettiCelebration") ||
                norm.includes("/components/SimpleFormDialog") ||
                norm.includes("/components/TouchSignaturePad") ||
                // GPR reuses these survey UI leaves — pin here so gpr-report ↛ survey-report.
                norm.includes("/modules/surveyReport/SurveyLivePreviewDock") ||
                norm.includes("/modules/surveyReport/SurveyProgressRing") ||
                norm.includes("/modules/surveyReport/surveyPas128Visual") ||
                norm.includes("/lib/r2Storage") ||
                norm.includes("/lib/supabase") ||
                norm.includes("/config/markets")
              ) {
                return "shared-ui";
              }
              if (norm.includes("/modules/surveyReport/")) return "survey-report";
              if (norm.includes("/modules/gprReport/")) return "gpr-report";
              // Drawing / plan helpers — survey also uses overlay registry; keep out of UI chunk
              // so survey-report never sync-imports project-drawing (and vice versa).
              if (
                norm.includes("/modules/permits/projectDrawing") ||
                norm.includes("/modules/permits/permitPlanOverlayRegistry") ||
                norm.includes("/utils/planMarkupMeta") ||
                norm.includes("/utils/planPdfRaster") ||
                norm.includes("/utils/kmzExtract") ||
                norm.includes("/utils/projectBoundary") ||
                norm.includes("/utils/resolveProjectGeoAnchor") ||
                norm.includes("/utils/hospitalRoute") ||
                norm.includes("/utils/nearestHospital") ||
                norm.includes("/utils/siteEnrichment") ||
                norm.includes("/utils/geoPhotoExport") ||
                norm.includes("/utils/captureElementPng") ||
                norm.includes("/components/plans/") ||
                norm.includes("/components/ProjectKmlDropZone")
              ) {
                return "project-drawing-lib";
              }
              if (
                norm.includes("/modules/ProjectDrawing") ||
                norm.includes("/modules/ProjectSitePlanPanel")
              ) {
                return "project-drawing";
              }
              // Shared permit helpers — studio UI must not sync-import the PermitSystem chunk
              // (permits ↔ permits-studio TDZ on bindings like PERMIT_INTEGRATION_EVENTS / K).
              if (
                norm.includes("/modules/permits/") &&
                !norm.includes("/modules/permits/PermitSystem") &&
                !norm.includes("/modules/permits/components/")
              ) {
                return "permits-lib";
              }
              if (norm.includes("/modules/permits/PermitSystem")) return "permits";
              if (
                norm.includes("/modules/permits/components/PermitStudio") ||
                norm.includes("/modules/permits/components/PermitWorkflow") ||
                norm.includes("/modules/permits/components/PermitConditional") ||
                norm.includes("/modules/permits/components/PermitIntegrations") ||
                norm.includes("/modules/permits/components/PermitAudit") ||
                norm.includes("/modules/permits/components/PermitFormPreview") ||
                norm.includes("/modules/permits/components/PermitConflict") ||
                norm.includes("/modules/permits/components/PermitBoard") ||
                norm.includes("/modules/permits/components/PermitTimeline") ||
                norm.includes("/modules/permits/components/PermitLiveWall") ||
                norm.includes("/modules/permits/components/PermitSafetyMap") ||
                norm.includes("/modules/permits/components/PermitDependency") ||
                norm.includes("/modules/permits/components/PermitBuilder") ||
                norm.includes("/modules/permits/components/PermitCommandCentre") ||
                norm.includes("/modules/permits/components/PermitQuickIssue") ||
                norm.includes("/modules/permits/components/PermitFirstRun") ||
                norm.includes("/modules/permits/components/PermitContextTips") ||
                norm.includes("/modules/permits/components/PermitNextSteps") ||
                norm.includes("/modules/permits/components/PermitDialog") ||
                norm.includes("/modules/permits/components/PermitSimpleForm") ||
                norm.includes("/modules/permits/components/PermitIncident") ||
                norm.includes("/modules/permits/components/PermitEvidence") ||
                norm.includes("/modules/permits/components/PermitStepper")
              ) {
                return "permits-studio";
              }
              if (norm.includes("/utils/fessRamsPrintHtml") || norm.includes("/modules/rams/ramsPrintDocument")) {
                return "rams-print";
              }
              if (norm.includes("moduleCatalogIcons")) return "module-icons";
              return;
            }
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("lucide-react")) return "lucide";
            if (id.includes("react-router")) return "router";
            if (id.includes("leaflet")) return "leaflet";
            if (id.includes("pdfjs-dist") || id.includes("pdf.worker")) return "pdfjs";
            if (id.includes("dompurify")) return "dompurify";
            if (id.includes("html2canvas") || id.includes("jspdf")) return "print-export";
            if (
              id.includes("/react/") ||
              id.includes("\\react\\") ||
              id.includes("react-dom") ||
              id.includes("scheduler")
            ) {
              return "react-core";
            }
            // Let Rollup split the remaining deps by async boundaries.
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
