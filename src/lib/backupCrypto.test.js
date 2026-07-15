import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptCloudBackupPayload,
  encryptBackupForCloud,
  hasCloudBackupDek,
  isEncryptedCloudPayload,
  clearCloudBackupDek,
} from "./backupCrypto.js";

const sample = {
  version: 1,
  exportedAt: "2026-07-06T00:00:00.000Z",
  orgId: "default",
  keys: { mysafeops_rams_default: "{}" },
};

function mockLocalStorage() {
  const store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  });
}

describe("backupCrypto", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("encrypts and decrypts round-trip", async () => {
    const enc = await encryptBackupForCloud(sample);
    expect(isEncryptedCloudPayload(enc)).toBe(true);
    expect(enc.keys).toBeUndefined();
    const out = await decryptCloudBackupPayload(enc);
    expect(out).toEqual(sample);
    expect(hasCloudBackupDek()).toBe(true);
  });

  it("passes through legacy plaintext payload", async () => {
    const out = await decryptCloudBackupPayload(sample);
    expect(out).toEqual(sample);
  });

  it("fails decrypt without local DEK", async () => {
    const enc = await encryptBackupForCloud(sample);
    localStorage.removeItem("mysafeops_cloud_dek_v1");
    await expect(decryptCloudBackupPayload(enc)).rejects.toThrow(/encrypted/i);
  });

  it("clearCloudBackupDek removes key so decrypt fails", async () => {
    const enc = await encryptBackupForCloud(sample);
    expect(hasCloudBackupDek()).toBe(true);
    clearCloudBackupDek();
    expect(hasCloudBackupDek()).toBe(false);
    await expect(decryptCloudBackupPayload(enc)).rejects.toThrow(/encrypted/i);
  });
});
