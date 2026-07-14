/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { loadOrgScoped, saveOrgScoped } from "./orgStorage";
import { getEquipmentDueAlerts } from "./equipmentInspectionDue.js";

describe("equipmentInspectionDue", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgScoped("inspection_records", []);
    saveOrgScoped("plant_register", []);
    saveOrgScoped("electrical_pat_log", []);
  });

  it("reads inspection_records nextInspectionDate", () => {
    const due = new Date();
    due.setDate(due.getDate() + 3);
    saveOrgScoped("inspection_records", [
      { id: "i1", assetRef: "Chain hoist", nextInspectionDate: due.toISOString().slice(0, 10) },
    ]);
    const alerts = getEquipmentDueAlerts(new Date());
    expect(alerts.some((a) => a.name.includes("Chain"))).toBe(true);
    expect(alerts[0].severity).toBe("critical");
  });

  it("ignores items due beyond 30 days", () => {
    const due = new Date();
    due.setDate(due.getDate() + 45);
    saveOrgScoped("plant_register", [{ id: "p1", assetRef: "EXC-1", nextDue: due.toISOString().slice(0, 10) }]);
    expect(getEquipmentDueAlerts(new Date())).toHaveLength(0);
  });
});
