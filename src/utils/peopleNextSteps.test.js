/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { buildPeopleNextSteps } from "./peopleNextSteps.js";

describe("buildPeopleNextSteps", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });
  it("prompts add worker when empty", () => {
    const steps = buildPeopleNextSteps({ workers: [] });
    expect(steps[0]?.action).toBe("add_worker");
  });

  it("surfaces critical cert alerts", () => {
    const steps = buildPeopleNextSteps({
      workers: [{ id: "w1", name: "Bob" }],
      certAlerts: [{ severity: "expired", worker: { id: "w1" }, days: -2 }],
    });
    expect(steps.some((s) => s.action === "scroll_certs")).toBe(true);
  });

  it("surfaces unassigned workers", () => {
    const steps = buildPeopleNextSteps({
      workers: [{ id: "w1", name: "Bob", projectIds: [] }],
      projects: [{ id: "p1", name: "Site A" }],
      certAlerts: [],
      equipmentAlerts: [],
    });
    expect(steps.some((s) => s.action === "scroll_people")).toBe(true);
  });

  it("surfaces overdue training records", () => {
    const steps = buildPeopleNextSteps({
      workers: [{ id: "w1", name: "Bob", certifications: [] }],
      trainingRecords: [{ id: "t1", expiryDate: "2020-01-01", courseName: "IPAF" }],
      certAlerts: [],
      equipmentAlerts: [],
    });
    expect(steps.some((s) => s.action === "open_training")).toBe(true);
  });

  it("surfaces PTW-blocked operatives", () => {
    const steps = buildPeopleNextSteps({
      workers: [{ id: "w1", name: "Bob", certifications: [] }],
      certAlerts: [],
      equipmentAlerts: [],
    });
    expect(steps.some((s) => s.id === "ptw_blocked")).toBe(true);
  });
});
