/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import MissionComposer from "./MissionComposer.jsx";
import DroneWeather from "./DroneWeather.jsx";
import { weatherFreshness } from "./weatherFreshness.js";

vi.mock("../../lib/supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "local-test-only" } } }) } },
}));
vi.mock("../../utils/appApiUrl.js", () => ({ appApiUrl: (path) => path }));
vi.mock("../../utils/orgStorage.js", () => ({ getOrgId: () => "qa" }));
vi.mock("../../utils/countryWorkspaces.js", () => ({ getCachedActiveCountryWorkspace: () => null }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
const now = Date.parse("2026-10-30T10:00:00Z");
const forecast = () => ({
  status: "available",
  fetchedAt: new Date(now).toISOString(),
  validUntil: new Date(now + 900000).toISOString(),
  points: [{ hours: [{ at: "2026-10-30T10:00:00Z", wind: 1, gust: 2, rain: 0, temp: 10, visibility: 10000 }] }],
});
const mission = () => ({
  id: "m1",
  editToken: "v1",
  regionCode: "uk",
  timeZone: "Europe/London",
  start: "2026-10-30T10:00",
  end: "2026-10-30T11:00",
  flightArea: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-0.1, 51.5],
              [-0.09, 51.5],
              [-0.09, 51.51],
              [-0.1, 51.5],
            ],
          ],
        },
      },
    ],
  },
  limits: { wind: 5, gust: 8, rain: 1, minTemp: 0, maxTemp: 30, visibility: 1000, confirmed: true },
  weather: forecast(),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => forecast() }))
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const render = async (element) => act(async () => root.render(element));
const button = (name) => [...host.querySelectorAll("button")].find((e) => e.textContent.trim() === name);
const field = (label) =>
  [...host.querySelectorAll("label")]
    .find((e) => e.textContent.trim().startsWith(label))
    ?.querySelector("input,select");
const change = async (input, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(
      input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      "value"
    ).set.call(input, value);
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });

it("prepares a repeat with local duration and resets selection when the project changes", async () => {
  const onCreate = vi.fn();
  const source = {
    id: "old",
    projectId: "p1",
    title: "Previous survey",
    templateId: "topo",
    regionCode: "uk",
    editToken: "source-v1",
    workContexts: ["roads"],
  };
  await render(
    <MissionComposer
      regionCode="uk"
      projects={[
        { id: "p1", name: "Depot" },
        { id: "p2", name: "Bridge" },
      ]}
      templates={[{ id: "topo", name: "Topographic" }]}
      missions={[source, { ...source, id: "foreign", regionCode: "au", title: "Foreign survey" }]}
      onCreate={onCreate}
      canEdit
    />
  );
  await change(field("Project for"), "p1");
  expect(host.textContent).not.toContain("Foreign survey");
  await change(field("Reuse a previous"), "old");
  await change(field("Planned start"), "2026-03-29T00:30");
  expect(field("Planned end").value).toBe("2026-03-29T03:30");
  await act(async () => button("Continue").click());
  await act(async () => button("Preview package").click());
  expect(host.textContent).toContain("Previous survey");
  await act(async () => button("Create prepared mission").click());
  expect(onCreate).toHaveBeenCalledWith(
    expect.objectContaining({ sourceMissionId: "old", sourceVersion: "source-v1", end: "2026-03-29T03:30" })
  );
  await act(async () => button("Back").click());
  await act(async () => button("Back").click());
  await change(field("Project for"), "p2");
  expect(field("Reuse a previous")).toBeUndefined();
});
it("blocks reversed or partial dates before the next step", async () => {
  const onCreate = vi.fn();
  await render(
    <MissionComposer
      regionCode="uk"
      projects={[{ id: "p", name: "Depot" }]}
      templates={[{ id: "topo", name: "Topographic" }]}
      canEdit
      onCreate={onCreate}
    />
  );
  await change(field("Project for"), "p");
  await change(field("Planned start"), "2026-10-30T10:00");
  await change(field("Planned end"), "2026-10-30T09:00");
  await act(async () => button("Continue").click());
  expect(host.querySelector('[role="alert"]').textContent).toContain("after");
  await change(field("Planned end"), "");
  await act(async () => button("Continue").click());
  expect(host.querySelector('[role="alert"]').textContent).toContain("both");
  expect(onCreate).not.toHaveBeenCalled();
});
it("removes candidate windows as a forecast expires without a reload", async () => {
  await render(<DroneWeather mission={{ ...mission(), weatherAutoRefresh: false }} onChange={vi.fn()} canEdit />);
  expect(host.textContent).toContain("Within entered limits — pilot review required");
  await act(async () => vi.advanceTimersByTime(900000));
  expect(host.textContent).toContain("Forecast expired");
  expect(host.textContent).toContain("No candidate window established");
  expect(fetch).not.toHaveBeenCalled();
});
it("fetches automatically without a click, then stops after a provider error", async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Provider unavailable" }) });
  await render(<DroneWeather mission={{ ...mission(), weather: null }} onChange={vi.fn()} canEdit />);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(field("Keep forecast fresh").checked).toBe(false);
  expect(host.textContent).toContain("Provider unavailable");
  await act(async () => vi.advanceTimersByTime(120000));
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("pauses automatic requests offline and in a hidden tab", async () => {
  const m = { ...mission(), weather: null },
    onChange = vi.fn(() => true);
  await render(<DroneWeather mission={m} onChange={onChange} canEdit offline />);
  await act(async () => vi.advanceTimersByTime(60000));
  expect(fetch).not.toHaveBeenCalled();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await render(<DroneWeather mission={m} onChange={onChange} canEdit />);
  await act(async () => vi.advanceTimersByTime(60000));
  expect(fetch).not.toHaveBeenCalled();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ weather: forecast() });
});
it("discards a forecast returned after the mission was edited", async () => {
  let resolve;
  fetch.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    })
  );
  const onChange = vi.fn(() => true);
  await render(<DroneWeather mission={mission()} onChange={onChange} canEdit />);
  await act(async () => button("Fetch hourly forecast").click());
  await render(<DroneWeather mission={{ ...mission(), editToken: "v2" }} onChange={onChange} canEdit />);
  await act(async () => resolve({ ok: true, json: async () => forecast() }));
  expect(onChange).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Mission changed");
});
it("stops automatic refresh when saving the fetched forecast fails", async () => {
  await render(<DroneWeather mission={{ ...mission(), weather: null }} onChange={() => undefined} canEdit />);
  expect(host.textContent).toContain("could not be saved");
  expect(field("Keep forecast fresh").checked).toBe(false);
});
it("does not offer automatic refresh for an approved mission", async () => {
  await render(<DroneWeather mission={{ ...mission(), approval: { by: "Pilot" } }} onChange={vi.fn()} canEdit />);
  expect(field("Keep forecast fresh").disabled).toBe(true);
});
it("waits without an API error for an area, then fetches as soon as it is supplied", async () => {
  const onChange = vi.fn(() => true),
    onNavigate = vi.fn();
  await render(
    <DroneWeather
      mission={{ ...mission(), flightArea: null, weather: null }}
      onChange={onChange}
      onNavigate={onNavigate}
      canEdit
    />
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(button("Fetch hourly forecast").disabled).toBe(true);
  expect(host.textContent).not.toContain("Commercial Open-Meteo connection required");
  await act(async () => button("Set flight area on map").click());
  expect(onNavigate).toHaveBeenCalledWith("overview");
  await render(<DroneWeather mission={{ ...mission(), weather: null }} onChange={onChange} canEdit />);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ weather: forecast() });
});
it("respects saved opt-out and persists a user's change", async () => {
  const onChange = vi.fn(() => true);
  await render(
    <DroneWeather mission={{ ...mission(), weather: null, weatherAutoRefresh: false }} onChange={onChange} canEdit />
  );
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => field("Keep forecast fresh").click());
  expect(onChange).toHaveBeenCalledWith({ weatherAutoRefresh: true });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("fills limits from the matching saved equipment without copying its confirmation", async () => {
  const m = { ...mission(), assetId: "aircraft", profileId: "survey", payloadId: "rgb" };
  const onChange = vi.fn(() => true);
  const setup = { ...m, id: "setup", name: "Survey setup", limits: { ...m.limits, wind: 7, confirmed: true } };
  await render(<DroneWeather mission={m} onChange={onChange} savedSetups={[setup]} canEdit />);
  await act(async () => button("Use saved equipment limits").click());
  expect(onChange).toHaveBeenCalledWith({ limits: { ...setup.limits, confirmed: false } });
});
it("treats missing, future or malformed forecast validity as unverified", () => {
  for (const data of [
    null,
    {},
    { ...forecast(), fetchedAt: "invalid" },
    { ...forecast(), fetchedAt: new Date(now + 120000).toISOString() },
  ])
    expect(weatherFreshness(data, now).current).toBe(false);
  expect(weatherFreshness(forecast(), now).current).toBe(true);
  expect(weatherFreshness(forecast(), now + 900000).current).toBe(false);
});
