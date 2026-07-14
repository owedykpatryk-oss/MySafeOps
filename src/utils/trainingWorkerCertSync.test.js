/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  matchTrainingCourseToCertCode,
  mergeTrainingIntoWorker,
  syncAllTrainingToWorkers,
} from "./trainingWorkerCertSync.js";

describe("trainingWorkerCertSync", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("matches CSCS from course name", () => {
    expect(matchTrainingCourseToCertCode("CSCS Green Card")).toBe("cscs");
    expect(matchTrainingCourseToCertCode("IPAF 3a")).toBe("ipaf");
  });

  it("merges training expiry into worker certs", () => {
    const worker = { id: "w1", name: "Bob", certifications: [] };
    const merged = mergeTrainingIntoWorker(worker, {
      id: "t1",
      courseName: "CSCS",
      expiryDate: "2027-01-15",
      provider: "CITB",
    });
    expect(merged.changed).toBe(true);
    expect(merged.worker.certifications[0].certType).toMatch(/CSCS/i);
    expect(merged.worker.certifications[0].expiryDate).toBe("2027-01-15");
  });

  it("bulk sync skips rows without expiry", () => {
    const workers = [{ id: "w1", name: "Bob", certifications: [] }];
    const out = syncAllTrainingToWorkers(workers, [
      { id: "t1", workerId: "w1", courseName: "CSCS", expiryDate: "2027-06-01" },
      { id: "t2", workerId: "w1", courseName: "IPAF" },
    ]);
    expect(out.synced).toBe(1);
    expect(out.skipped).toBe(1);
    expect(out.workers[0].certifications.length).toBe(1);
  });
});
