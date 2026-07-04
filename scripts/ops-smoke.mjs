#!/usr/bin/env node
/**
 * Production smoke checks for public APIs (no secrets printed).
 * Usage: npm run ops:smoke
 *        OPS_SMOKE_BASE=https://www.mysafeops.com npm run ops:smoke
 */
const base = String(process.env.OPS_SMOKE_BASE || "https://www.mysafeops.com").replace(/\/+$/, "");

const jsonChecks = [
  { name: "health", path: "/api/health", expect: (j) => j?.ok === true },
  { name: "postcode", path: "/api/postcode?code=KT227SH", expect: (j) => j?.result?.latitude > 50 },
  { name: "weather-latlng", path: "/api/weather?lat=51.299&lng=-0.332", expect: (j) => typeof j?.main?.temp === "number" },
  { name: "weather-postcode", path: "/api/weather?postcode=KT227SH", expect: (j) => typeof j?.main?.temp === "number" },
];

async function checkJson(c) {
  const url = `${base}${c.path}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const json = await res.json().catch(() => null);
    const ok = res.ok && c.expect(json);
    console.log(`${ok ? "✓" : "✗"} ${c.name} ${res.status}${ok ? "" : ` — ${url}`}`);
    return ok ? 0 : 1;
  } catch (e) {
    console.log(`✗ ${c.name} — ${e?.message || "fetch failed"}`);
    return 1;
  }
}

async function checkLoginTurnstile() {
  const url = `${base}/login`;
  try {
    const res = await fetch(url, { headers: { Accept: "text/html" } });
    const html = await res.text();
    const scriptMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    if (!res.ok || !scriptMatch) {
      console.log(`✗ login-turnstile ${res.status} — missing app bundle`);
      return 1;
    }
    const bundleRes = await fetch(`${base}${scriptMatch[1]}`);
    const js = await bundleRes.text();
    const hasSiteKey = /0x4AAAA[A-Za-z0-9]+/.test(js);
    const ok = bundleRes.ok && hasSiteKey;
    console.log(`${ok ? "✓" : "✗"} login-turnstile ${res.status}${ok ? "" : ` — site key not in bundle`}`);
    return ok ? 0 : 1;
  } catch (e) {
    console.log(`✗ login-turnstile — ${e?.message || "fetch failed"}`);
    return 1;
  }
}

async function checkSecurityHeaders() {
  const paths = ["/", "/login"];
  let failed = 0;
  for (const path of paths) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { headers: { Accept: "text/html" } });
      const h = res.headers;
      const nosniff = h.get("x-content-type-options");
      const hsts = h.get("strict-transport-security");
      const csp = h.get("content-security-policy");
      const ok =
        res.ok &&
        /nosniff/i.test(nosniff || "") &&
        /max-age=/i.test(hsts || "") &&
        /default-src 'self'/i.test(csp || "") &&
        !/api\.anthropic\.com/i.test(csp || "") &&
        !/api\.openweathermap\.org/i.test(csp || "");
      console.log(`${ok ? "✓" : "✗"} security-headers${path} ${res.status}${ok ? "" : ` — ${url}`}`);
      if (!ok) failed += 1;
    } catch (e) {
      console.log(`✗ security-headers${path} — ${e?.message || "fetch failed"}`);
      failed += 1;
    }
  }
  return failed;
}

async function run() {
  let failed = 0;
  for (const c of jsonChecks) {
    failed += await checkJson(c);
  }
  failed += await checkLoginTurnstile();
  failed += await checkSecurityHeaders();

  const total = jsonChecks.length + 3;
  if (failed) {
    console.log(`\n${failed} check(s) failed against ${base}`);
    process.exit(1);
  }
  console.log(`\nAll ${total} checks passed (${base}).`);
}

run();
