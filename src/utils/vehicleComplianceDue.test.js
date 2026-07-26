/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { saveOrgScoped } from "./orgStorage";
import { getVehicleDueAlerts } from "./vehicleComplianceDue.js";

import { localDateISO } from "./localDate";
describe("vehicleComplianceDue", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgScoped("vehicle_register", []);
  });

  it("reads MOT due within 30 days", () => {
    const due = new Date();
    due.setDate(due.getDate() + 4);
    saveOrgScoped("vehicle_register", [
      {
        id: "v1",
        registration: "AB12 CDE",
        motDue: localDateISO(due),
        status: "active",
      },
    ]);
    const alerts = getVehicleDueAlerts(new Date());
    expect(alerts.some((a) => a.registration.includes("AB12"))).toBe(true);
    expect(alerts[0].dueKind).toBe("mot");
  });

  it("ignores disposed vehicles", () => {
    const due = new Date();
    due.setDate(due.getDate() - 2);
    saveOrgScoped("vehicle_register", [{ id: "v1", registration: "XY01", motDue: localDateISO(due), status: "disposed" }]);
    expect(getVehicleDueAlerts(new Date())).toHaveLength(0);
  });
});
