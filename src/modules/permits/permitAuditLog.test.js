import { describe, it, expect } from "vitest";
import { appendPermitAuditEntry, describePermitAuditEvent, permitAuditDetailSnapshot } from "./permitAuditLog";

describe("appendPermitAuditEntry", () => {
  it("records created when no previous permit", () => {
    const log = appendPermitAuditEntry(undefined, { id: "1", status: "draft" });
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe("created");
  });

  it("records status_changed when status differs", () => {
    const prev = { id: "1", status: "pending_review", auditLog: [{ at: "t0", action: "created" }] };
    const log = appendPermitAuditEntry(prev, { id: "1", status: "active" });
    expect(log[log.length - 1].action).toBe("status_changed");
    expect(log[log.length - 1].from).toBe("pending_review");
    expect(log[log.length - 1].to).toBe("active");
  });

  it("records updated when status unchanged", () => {
    const prev = { id: "1", status: "active", auditLog: [] };
    const log = appendPermitAuditEntry(prev, { id: "1", status: "active" });
    expect(log[log.length - 1].action).toBe("updated");
  });
});

describe("describePermitAuditEvent", () => {
  it("matches append semantics for cloud row", () => {
    expect(describePermitAuditEvent(undefined, { status: "draft" }).action).toBe("created");
    expect(describePermitAuditEvent({ status: "a" }, { status: "b" }).action).toBe("status_changed");
    expect(describePermitAuditEvent({ status: "x" }, { status: "x" }).action).toBe("updated");
  });

  it("supports explicit custom audit action", () => {
    const row = describePermitAuditEvent(
      { status: "approved" },
      { status: "approved", _auditAction: "conflict_warn_override" }
    );
    expect(row.action).toBe("conflict_warn_override");
  });
});

describe("permitAuditDetailSnapshot", () => {
  it("truncates long text", () => {
    const s = permitAuditDetailSnapshot({
      type: "hot_work",
      status: "active",
      location: "x".repeat(300),
      description: "y".repeat(200),
    });
    expect(s.location?.length).toBe(240);
    expect(s.descriptionPreview?.length).toBe(120);
  });

  it("adds conflict override details when action provided", () => {
    const s = permitAuditDetailSnapshot({
      _auditAction: "conflict_warn_override",
      status: "approved",
      conflictWarnOverride: {
        reason: "Controlled by area segregation and appointed banksman.",
        approvedBy: "Area Authority",
      },
    });
    expect(s.conflictWarnOverride?.approvedBy).toBe("Area Authority");
  });
});
