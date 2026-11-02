import { describe, it, expect, vi, afterEach } from "vitest";
import handler, { validateWeatherRequest } from "./drone-weather.js";
vi.mock("./verifySupabaseAuth.js", () => ({
  parseBearerToken: () => "test-token",
  verifySupabaseAccessToken: async () => ({ id: "test-user" }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("counts retries against the provider budget and never returns a successful check after an outage", async () => {
  vi.stubEnv("DRONE_OPEN_METEO_API_KEY", "synthetic-key");
  vi.stubEnv("DRONE_WEATHER_COMMERCIAL_LICENSE_CONFIRMED", "true");
  vi.stubEnv("DRONE_WEATHER_INSTANCE_DAILY_LIMIT", "1");
  vi.stubEnv("SUPABASE_URL", "https://test.example");
  vi.stubEnv("SUPABASE_ANON_KEY", "public-test");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => true })
    .mockRejectedValue(new Error("network timeout"));
  vi.stubGlobal("fetch", fetcher);
  let status, body;
  await handler(
    {
      method: "POST",
      headers: { host: "localhost:4192", origin: "http://localhost:4192" },
      body: {
        ...request,
        start: new Date(Date.now() + 3600000).toISOString(),
        end: new Date(Date.now() + 7200000).toISOString(),
      },
    },
    {
      writeHead: (s) => {
        status = s;
      },
      end: (t) => {
        body = JSON.parse(t);
      },
    }
  );
  expect(status).toBe(429);
  expect(body.error).toContain("budget");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(body.status).not.toBe("available");
});
const now = Date.parse("2026-10-29T09:00:00Z");
const request = {
  points: [[-5.93, 54.6]],
  orgSlug: "test-org",
  dataKey: "main",
  start: "2026-10-29T10:00:00Z",
  end: "2026-10-29T11:00:00Z",
};
describe("drone weather service boundaries", () => {
  it("accepts Australia only in the Australian region and rejects unknown regions", () => {
    expect(validateWeatherRequest({ ...request, regionCode: "au", points: [[115.86, -31.95]] }, now).status).toBe(
      "valid"
    );
    expect(() => validateWeatherRequest({ ...request, regionCode: "au" }, now)).toThrow(/region/i);
    expect(() => validateWeatherRequest({ ...request, regionCode: "uk", points: [[115.86, -31.95]] }, now)).toThrow(
      /region/i
    );
    expect(() => validateWeatherRequest({ ...request, regionCode: "unknown" }, now)).toThrow(/region/i);
  });
  it("supports Northern Ireland without inferring a postcode", () =>
    expect(validateWeatherRequest(request, now).status).toBe("valid"));
  it("marks distant dates unavailable", () =>
    expect(
      validateWeatherRequest({ ...request, start: "2027-01-01T10:00:00Z", end: "2027-01-01T11:00:00Z" }, now).status
    ).toBe("unavailable"));
  it("rejects arbitrary coordinates, over-budget points and invalid time windows", () => {
    expect(() => validateWeatherRequest({ ...request, points: [[200, 500]] }, now)).toThrow();
    expect(() => validateWeatherRequest({ ...request, points: Array(4).fill([-1, 51]) }, now)).toThrow();
    expect(() => validateWeatherRequest({ ...request, end: request.start }, now)).toThrow();
  });
});
it("returns Not connected without a licensed key and makes no weather request", async () => {
  vi.stubEnv("DRONE_OPEN_METEO_API_KEY", "");
  vi.stubEnv("SUPABASE_URL", "https://test.example");
  vi.stubEnv("SUPABASE_ANON_KEY", "public-test");
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => true }));
  vi.stubGlobal("fetch", fetcher);
  const start = new Date(Date.now() + 3600000).toISOString(),
    end = new Date(Date.now() + 7200000).toISOString();
  const req = {
    method: "POST",
    headers: { host: "localhost:4192", origin: "http://localhost:4192" },
    body: { ...request, start, end },
  };
  let status, body;
  const res = {
    writeHead: (s) => {
      status = s;
    },
    end: (t) => {
      body = JSON.parse(t);
    },
  };
  await handler(req, res);
  expect(status).toBe(503);
  expect(body.status).toBe("not_connected");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toContain("/rest/v1/rpc/");
});
