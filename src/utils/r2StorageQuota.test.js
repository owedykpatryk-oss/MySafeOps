import { describe, expect, it } from "vitest";
import { StorageQuotaLedger } from "../../cloudflare/workers/r2-upload/storageQuota.mjs";

function fixture(objects = []) {
  const files = new Map(objects.map((o) => [o.key, o]));
  const state = new Map();
  let failAfterPut = false;
  const storage = { get: async (key) => state.get(key), put: async (key, value) => state.set(key, value) };
  const bucket = {
    list: async ({ cursor }) => {
      const all = [...files.values()]; const start = Number(cursor || 0);
      return { objects: all.slice(start, start + 2), truncated: start + 2 < all.length, cursor: String(start + 2) };
    },
    head: async (key) => files.get(key),
    put: async (key, body) => {
      const object = { key, size: body.length }; files.set(key, object);
      if (failAfterPut) { failAfterPut = false; throw new Error("connection lost after storage accepted bytes"); }
      return object;
    },
  };
  const ledger = new StorageQuotaLedger(storage, bucket);
  return { ledger, files, restart: () => new StorageQuotaLedger(storage, bucket), fail: () => { failAfterPut = true; } };
}
const options = (key, size, limit = 10) => ({ key, size, limit, contentType: "text/plain", contentDisposition: "attachment" });
const primary = "files/org_acme/main/";
const secondary = "files/org_acme/country_11111111-2222-4333-8444-555555555555/";

describe("durable storage allowance", () => {
  it("includes every page of legacy files, while isolating organisations and countries", async () => {
    const { ledger } = fixture([
      { key: "documents/org_acme/old.txt", size: 3 }, { key: "photos/org_acme/old.jpg", size: 4 },
      { key: "documents/org_other/old.txt", size: 100 }, { key: `${secondary}a.txt`, size: 100 },
      { key: `${primary}b.txt`, size: 2 },
    ]);
    expect(await ledger.usage("acme:main")).toEqual({ bytes: 9 });
    expect(await ledger.upload(options(`${primary}c.txt`, 2), "xx")).toMatchObject({ ok: false, used: 9 });
  });
  it("serializes racing uploads so only one can consume the remaining allowance", async () => {
    const { ledger, files } = fixture();
    const result = await Promise.all([ledger.upload(options(`${primary}a.txt`, 6), "123456"), ledger.upload(options(`${primary}b.txt`, 6), "123456")]);
    expect(result.map((r) => r.ok)).toEqual([true, false]);
    expect(files.size).toBe(1);
  });
  it("charges replacements by their delta and permits reductions following a downgrade", async () => {
    const { ledger } = fixture([{ key: `${primary}a.txt`, size: 20 }]);
    expect(await ledger.upload(options(`${primary}a.txt`, 15), "x".repeat(15))).toMatchObject({ ok: true, used: 15 });
    expect(await ledger.upload(options(`${primary}a.txt`, 16), "x".repeat(16))).toMatchObject({ ok: false });
    expect(await ledger.upload(options(`${primary}a.txt`, 5), "12345")).toMatchObject({ ok: true, used: 5 });
  });
  it("reconciles ambiguous failed writes after restart, without undercounting or double charging", async () => {
    const f = fixture(); f.fail();
    await expect(f.ledger.upload(options(`${primary}a.txt`, 6), "123456")).rejects.toThrow("connection lost");
    const restarted = f.restart();
    expect(await restarted.usage("acme:main")).toEqual({ bytes: 6 });
    expect(await restarted.upload(options(`${primary}a.txt`, 6), "123456")).toMatchObject({ ok: true, used: 6 });
    expect(await restarted.upload(options(`${primary}b.txt`, 5), "12345")).toMatchObject({ ok: false });
  });
});
