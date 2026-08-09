import { describe, expect, it } from "vitest";
import { groupJobsByClient, summariseClients } from "./managementClients";

const TODAY = "2026-08-05";
const JOBS = [
  { id: "j1", name: "Ring main", client: "Acme Utilities", start: "2026-08-03", end: "2026-08-10", status: "confirmed", value: 40000, source: "project", readiness: { dates: true, team: true, rams: true, permits: true, survey: true, client: true } },
  { id: "j2", name: "Footway dig", client: "acme utilities", start: "2026-08-20", end: "2026-08-24", status: "provisional", value: 10000, source: "project", readiness: { dates: true } },
  { id: "j3", name: "Old survey", client: "Beta Networks", start: "2026-07-01", end: "2026-07-04", status: "completed", value: 5000, source: "project", readiness: {} },
  { id: "j4", name: "Late job", client: "Beta Networks", start: "2026-07-20", end: "2026-07-31", status: "confirmed", value: 3000, source: "project", readiness: {} },
  { id: "j5", name: "Framework option", client: "", start: "2026-09-10", end: "2026-09-14", status: "provisional", value: 90000, source: "opportunity", readiness: { dates: true } },
];

describe("clients view", () => {
  it("groups case-insensitively and counts each job's phase", () => {
    const rows = groupJobsByClient(JOBS, { today: TODAY });
    const acme = rows.find((row) => row.key === "acme utilities");

    // "Acme Utilities" and "acme utilities" are one client, keeping the first spelling seen.
    expect(acme.name).toBe("Acme Utilities");
    expect(acme.counts).toMatchObject({ total: 2, live: 1, upcoming: 1, overdue: 0 });
    expect(acme.nextStart).toBe("2026-08-20");

    const beta = rows.find((row) => row.key === "beta networks");
    expect(beta.counts).toMatchObject({ total: 2, completed: 1, overdue: 1 });
    expect(beta.nextStart).toBe("");

    // A job with no client still has to appear somewhere.
    expect(rows.some((row) => row.name === "Client not set")).toBe(true);
  });

  it("keeps pipeline value out of the ranking total", () => {
    const rows = groupJobsByClient(JOBS, { today: TODAY });
    const unnamed = rows.find((row) => row.name === "Client not set");

    expect(unnamed.value.pipeline).toBe(90000);
    expect(unnamed.value.total).toBe(0);
    // Acme's won work outranks a bigger unwon opportunity.
    expect(rows[0].name).toBe("Acme Utilities");
    expect(rows[0].value.total).toBe(50000);
  });

  it("counts attention and conflicts per client", () => {
    const rows = groupJobsByClient(JOBS, { today: TODAY, conflictedIds: new Set(["j1", "j4"]) });
    const acme = rows.find((row) => row.key === "acme utilities");
    const beta = rows.find((row) => row.key === "beta networks");

    expect(acme.conflicts).toBe(1);
    expect(beta.conflicts).toBe(1);
    // The ready, confirmed job is not "attention"; the half-filled ones are.
    expect(acme.attention).toBe(1);
    expect(beta.attention).toBe(1);
  });

  it("sorts each client's jobs by start date", () => {
    const rows = groupJobsByClient(JOBS, { today: TODAY });
    const acme = rows.find((row) => row.key === "acme utilities");
    expect(acme.jobs.map((job) => job.id)).toEqual(["j1", "j2"]);
  });

  it("summarises the book and flags concentration", () => {
    const summary = summariseClients(groupJobsByClient(JOBS, { today: TODAY }));
    expect(summary).toMatchObject({ clients: 3, topName: "Acme Utilities" });
    // Acme 50k of 58k total won work.
    expect(summary.totalValue).toBe(58000);
    expect(summary.topShare).toBe(86);
    expect(summariseClients([])).toMatchObject({ clients: 0, totalValue: 0, topShare: 0 });
  });

  it("survives an empty or malformed programme", () => {
    expect(groupJobsByClient()).toEqual([]);
    expect(groupJobsByClient(null)).toEqual([]);
  });
});
