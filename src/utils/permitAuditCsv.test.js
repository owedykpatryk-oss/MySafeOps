import { describe, expect, it } from "vitest";
import {
  csvEsc,
  isCountryWorkspaceId,
  permitAuditRowsToCsv,
} from "../../supabase/functions/_shared/permitAuditCsv.ts";

describe("isCountryWorkspaceId", () => {
  it("accepts RFC 4122 version 4 UUIDs used by country workspaces", () => {
    expect(isCountryWorkspaceId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isCountryWorkspaceId("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
  });

  it("rejects missing, truncated, or non-UUID workspace ids", () => {
    expect(isCountryWorkspaceId("")).toBe(false);
    expect(isCountryWorkspaceId("legacy")).toBe(false);
    expect(isCountryWorkspaceId("11111111-1111-4111-8111-11111111111")).toBe(false);
    expect(isCountryWorkspaceId("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});

describe("permitAuditRowsToCsv", () => {
  it("emits a header-only CSV when there are no PTW audit rows", () => {
    expect(permitAuditRowsToCsv([])).toBe(
      "occurred_at,permit_id,action,from_status,to_status,location,type",
    );
  });

  it("quotes fields and doubles embedded quotes from permit location/type", () => {
    expect(csvEsc('Plant "A" room')).toBe('"Plant ""A"" room"');
    const csv = permitAuditRowsToCsv([
      {
        occurred_at: "2026-08-13T09:00:00.000Z",
        permit_id: "p-uk-hot-1",
        action: "issued",
        from_status: "draft",
        to_status: "active",
        detail: { location: 'Plant "A" room', type: "hot_work" },
      },
    ]);
    expect(csv).toContain('"p-uk-hot-1"');
    expect(csv).toContain('"Plant ""A"" room"');
    expect(csv).toContain('"hot_work"');
    expect(csv).toContain('"issued"');
  });
});
