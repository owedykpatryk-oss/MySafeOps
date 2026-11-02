import { it, expect } from "vitest";
import { verifyIssuedSnapshot } from "./droneIssueConfirmation.js";
it("requires the exact issued snapshot in an acknowledged cloud read", async () => {
  const issue = { id: "i", revision: 2, kind: "approved", snapshot: { id: "m", title: "QA" } };
  await expect(verifyIssuedSnapshot(issue, async () => ({ ok: false, error: "forbidden" }))).rejects.toThrow();
  await expect(
    verifyIssuedSnapshot(issue, async () => ({ ok: true, value: [{ id: "m", issues: [] }] }))
  ).rejects.toThrow();
  await expect(
    verifyIssuedSnapshot(issue, async () => ({ ok: true, value: [{ id: "m", issues: [{ ...issue, revision: 3 }] }] }))
  ).rejects.toThrow();
  await expect(
    verifyIssuedSnapshot(issue, async () => ({ ok: true, value: [{ id: "m", issues: [issue] }] }))
  ).resolves.toBe(true);
});
