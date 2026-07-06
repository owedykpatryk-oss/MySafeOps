import { describe, it, expect } from "vitest";
import {
  canRoleWriteD1Namespace,
  D1_ADMIN_ONLY_WRITE_NAMESPACES,
  isValidD1Namespace,
} from "./d1NamespacePolicy.js";

describe("d1NamespacePolicy", () => {
  it("validates namespace shape", () => {
    expect(isValidD1Namespace("permits_v2")).toBe(true);
    expect(isValidD1Namespace("")).toBe(false);
    expect(isValidD1Namespace("bad namespace")).toBe(false);
    expect(isValidD1Namespace("x".repeat(129))).toBe(false);
  });

  it("admin and supervisor can write master-data namespaces", () => {
    for (const ns of D1_ADMIN_ONLY_WRITE_NAMESPACES) {
      expect(canRoleWriteD1Namespace("admin", ns)).toBe(true);
      expect(canRoleWriteD1Namespace("supervisor", ns)).toBe(true);
    }
  });

  it("operative cannot write master-data namespaces but can write permits", () => {
    for (const ns of D1_ADMIN_ONLY_WRITE_NAMESPACES) {
      expect(canRoleWriteD1Namespace("operative", ns)).toBe(false);
    }
    expect(canRoleWriteD1Namespace("operative", "permits_v2")).toBe(true);
    expect(canRoleWriteD1Namespace("operative", "snags")).toBe(true);
  });
});
