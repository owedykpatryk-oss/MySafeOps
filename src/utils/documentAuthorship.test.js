import { describe, it, expect, beforeEach } from "vitest";
import {
  clearAuthorshipUserCache,
  documentAuthorshipSummary,
  formatActorLabel,
  setAuthorshipUserCache,
  stampDocumentAuthorship,
  authorshipAuditFields,
} from "./documentAuthorship.js";

describe("documentAuthorship", () => {
  beforeEach(() => {
    clearAuthorshipUserCache();
  });

  it("caches actor from supabase user metadata", () => {
    setAuthorshipUserCache({
      id: "u1",
      email: "jack@fess.example",
      user_metadata: { full_name: "Jack Haswell" },
    });
    expect(authorshipAuditFields()).toEqual({
      by: "Jack Haswell",
      byEmail: "jack@fess.example",
      byUserId: "u1",
    });
    expect(formatActorLabel({ name: "Jack Haswell", email: "jack@fess.example" })).toBe(
      "Jack Haswell (jack@fess.example)",
    );
  });

  it("stamps create then update without overwriting original author", () => {
    setAuthorshipUserCache({
      id: "u1",
      email: "a@example.com",
      user_metadata: { full_name: "Alice" },
    });
    const created = stampDocumentAuthorship({ title: "RAMS" }, { isCreate: true, at: "2026-01-01T10:00:00.000Z" });
    expect(created.createdBy).toBe("Alice");
    expect(created.createdById).toBe("u1");
    expect(created.updatedBy).toBe("Alice");

    setAuthorshipUserCache({
      id: "u2",
      email: "b@example.com",
      user_metadata: { full_name: "Bob" },
    });
    const updated = stampDocumentAuthorship(created, { at: "2026-01-02T10:00:00.000Z" });
    expect(updated.createdBy).toBe("Alice");
    expect(updated.createdById).toBe("u1");
    expect(updated.updatedBy).toBe("Bob");
    expect(updated.updatedByEmail).toBe("b@example.com");
    expect(documentAuthorshipSummary(updated)).toContain("Alice");
    expect(documentAuthorshipSummary(updated)).toContain("Bob");
  });

  it("returns record unchanged when signed out", () => {
    const next = stampDocumentAuthorship({ id: "1", createdAt: "t" }, { isCreate: true });
    expect(next.createdBy).toBeUndefined();
    expect(next.updatedAt).toBeTruthy();
  });
});
