/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { saveOrgScoped } from "./orgStorage";
import { collectComplianceDueItems, bucketComplianceDueItems } from "./complianceDueCalendar.js";

import { localDateISO } from "./localDate";
describe("complianceDueCalendar", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgScoped("inspection_records", []);
    saveOrgScoped("plant_register", []);
    saveOrgScoped("electrical_pat_log", []);
  });

  it("merges worker certs and training expiries", () => {
    const due = new Date();
    due.setDate(due.getDate() + 5);
    const iso = localDateISO(due);
    const items = collectComplianceDueItems({
      workers: [{ id: "w1", name: "Bob", certifications: [{ certType: "CSCS", expiryDate: iso }] }],
      trainingRecords: [{ id: "t1", workerName: "Bob", courseName: "IPAF", expiryDate: iso }],
    });
    expect(items.length).toBe(2);
    expect(items.every((i) => i.days === 5)).toBe(true);
  });

  it("buckets overdue and this week", () => {
    const buckets = bucketComplianceDueItems([
      { id: "a", days: -2 },
      { id: "b", days: 3 },
      { id: "c", days: 20 },
    ]);
    expect(buckets.overdue).toHaveLength(1);
    expect(buckets.thisWeek).toHaveLength(1);
    expect(buckets.later).toHaveLength(1);
  });
});
