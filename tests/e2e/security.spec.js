import { expect, test } from "@playwright/test";

// The /api routes enforce an origin allowlist. Playwright's request context sends no
// Origin header, so same-origin calls must set it explicitly — otherwise every API test
// fails with forbidden_origin the moment the suite is pointed at a deployed environment.
const SAME_ORIGIN = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const sameOrigin = { headers: { Origin: SAME_ORIGIN } };

test.describe("Security posture (public)", () => {
  test("/security renders trust summary", async ({ page }) => {
    await page.goto("/security");
    await expect(page).toHaveURL(/\/security$/);
    await expect(page.getByRole("heading", { name: /Security & trust/i })).toBeVisible();
    await expect(page.getByText(/Supabase Auth/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /\.well-known\/security\.txt/ })).toBeVisible();
  });

  test("security.txt is reachable and lists contact", async ({ request }) => {
    const res = await request.get("/.well-known/security.txt");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/Contact:\s*mailto:/i);
    expect(text).toMatch(/support@mysafeops\.com/i);
    expect(text).toMatch(/Canonical:\s*https:\/\//i);
  });

  test("postcode API accepts query and legacy paths", async ({ request }) => {
    for (const path of ["/api/postcode?code=KT227SH", "/api/postcode/KT227SH"]) {
      const res = await request.get(path, sameOrigin);
      expect(res.ok()).toBeTruthy();
      const json = await res.json();
      expect(json?.result?.postcode).toMatch(/KT22 7SH/i);
      expect(typeof json?.result?.latitude).toBe("number");
    }
  });

  test("marketing and login pages send security headers", async ({ request }) => {
    for (const path of ["/", "/login"]) {
      const res = await request.get(path);
      expect(res.ok()).toBeTruthy();
      const headers = res.headers();
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["strict-transport-security"]).toMatch(/max-age=/i);
      expect(headers["content-security-policy"]).toMatch(/default-src 'self'/);
      expect(headers["content-security-policy"]).not.toMatch(/api\.anthropic\.com/);
      expect(headers["content-security-policy"]).not.toMatch(/api\.openweathermap\.org/);
      expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    }
  });

  test("web-vitals API rejects cross-origin POST", async ({ request }) => {
    const res = await request.post("/api/web-vitals", {
      headers: { Origin: "https://evil.example.com", "Content-Type": "application/json" },
      data: { name: "LCP", value: 1.2, id: "v1" },
    });
    expect(res.status()).toBe(403);
  });

  test("postcode API rejects cross-origin GET", async ({ request }) => {
    const res = await request.get("/api/postcode?code=KT227SH", {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.status()).toBe(403);
  });

  test("origin gate survives a warmed CDN cache", async ({ request }) => {
    // These routes are cached publicly at the edge. Without Vary: Origin the first
    // same-origin request warms a cache entry that is then served to every origin,
    // silently defeating the allowlist. Locally there is no CDN, so this only really
    // bites on a deployed environment — which is where it matters.
    for (const path of ["/api/postcode?code=KT227SH", "/api/weather?lat=51.5&lng=-0.12"]) {
      const warm = await request.get(path, sameOrigin);
      expect(warm.ok()).toBeTruthy();
      const crossOrigin = await request.get(path, {
        headers: { Origin: "https://evil.example.com" },
      });
      expect(crossOrigin.status(), `${path} served a cached response cross-origin`).toBe(403);
    }
  });

  test("weather API rejects cross-origin GET", async ({ request }) => {
    const res = await request.get("/api/weather?lat=51.5&lng=-0.12", {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.status()).toBe(403);
  });

  test("weather API returns OpenWeather for valid coordinates", async ({ request }) => {
    const res = await request.get("/api/weather?lat=51.299424&lng=-0.33181", sameOrigin);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.main?.temp).toEqual(expect.any(Number));
    expect(json?.weather?.[0]?.description).toEqual(expect.any(String));
  });

  test("weather API accepts UK postcode and returns weather", async ({ request }) => {
    const res = await request.get("/api/weather?postcode=KT227SH", sameOrigin);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.main?.temp).toEqual(expect.any(Number));
    expect(json?._mysafeops?.postcode).toMatch(/KT22 7SH/i);
  });

  test("weather API rejects invalid postcode", async ({ request }) => {
    const res = await request.get("/api/weather?postcode=NOTVALID", sameOrigin);
    expect(res.status()).toBe(400);
  });

  test("health API returns ok", async ({ request }) => {
    const res = await request.get("/api/health", sameOrigin);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.ok).toBe(true);
  });

  test("postcode API returns slim payload", async ({ request }) => {
    const res = await request.get("/api/postcode?code=KT227SH", sameOrigin);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.result?.latitude).toBeGreaterThan(50);
    expect(json?.result?.eastings).toBeUndefined();
  });

  test("postcode then weather chain (KT22 7SH)", async ({ request }) => {
    const pc = await request.get("/api/postcode?code=KT227SH", sameOrigin);
    expect(pc.ok()).toBeTruthy();
    const pcJson = await pc.json();
    const lat = pcJson?.result?.latitude;
    const lng = pcJson?.result?.longitude;

    const wx = await request.get(`/api/weather?lat=${lat}&lng=${lng}`, sameOrigin);
    expect(wx.ok()).toBeTruthy();
    expect((await wx.json())?.main?.temp).toEqual(expect.any(Number));
  });
});
