import "fake-indexeddb/auto";
import { IDBDatabase } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { readGeoPhotoOffline, writeGeoPhotoOffline, deleteGeoPhotoOffline } from "./geoPhotoOfflineStore";
import { readCaptureDraft, readSessionCaptureDraft, writeCaptureDraft, clearCaptureDraft } from "./geoPhotoCaptureDraft";

describe("durable geo-photo recovery", () => {
  it("commits image bytes separately from metadata and isolates workspace keys", async () => {
    const image = new Blob(["photo"], { type: "image/jpeg" });
    expect(await writeGeoPhotoOffline("org-a:uk:photo", image)).toBe(true);
    expect((await readGeoPhotoOffline("org-a:uk:photo")).size).toBe(5);
    expect(await readGeoPhotoOffline("org-b:uk:photo")).toBeNull();
    expect(await readGeoPhotoOffline("org-a:pl:photo")).toBeNull();
  });

  it("does not resurrect a draft when an earlier write finishes after deletion is requested", async () => {
    const write = writeGeoPhotoOffline("draft-race", { notes: "old" });
    const clear = deleteGeoPhotoOffline("draft-race");
    await Promise.all([write, clear]);
    expect(await readGeoPhotoOffline("draft-race")).toBeNull();
  });

  it("recovers the photo and notes without sessionStorage and clears a completed draft", async () => {
    const draft = { captureId: "capture-1", photoDataUrl: "data:image/jpeg;base64,YWJj", notes: "Evidence" };
    expect(await writeCaptureDraft(draft, "org-a:uk:draft")).toBe(true);
    expect(await readCaptureDraft("org-a:uk:draft")).toEqual(draft);
    expect(await readCaptureDraft("org-b:uk:draft")).toBeNull();
    await clearCaptureDraft("org-a:uk:draft");
    expect(await readCaptureDraft("org-a:uk:draft")).toBeNull();
  });

  it("reports unavailable storage instead of pretending an image was cached", async () => {
    vi.stubGlobal("indexedDB", undefined);
    try {
      expect(await writeGeoPhotoOffline("unavailable", new Blob(["x"]))).toBeNull();
      expect(await writeCaptureDraft({ photoDataUrl: "data:image/jpeg;base64,YQ==" }, "unavailable")).toBe(false);
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not report success for an aborted image transaction", async () => {
    const transaction = IDBDatabase.prototype.transaction;
    const spy = vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (...args) {
      const tx = transaction.apply(this, args);
      if (args[1] === "readwrite") queueMicrotask(() => tx.abort());
      return tx;
    });
    try { expect(await writeGeoPhotoOffline("aborted-photo", new Blob(["x"]))).toBeNull(); }
    finally { spy.mockRestore(); }
    expect(await readGeoPhotoOffline("aborted-photo")).toBeNull();
  });

  it("keeps a session fallback but reports that restart recovery is unavailable", async () => {
    const values = new Map();
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("sessionStorage", {
      setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key) || null,
    });
    const draft = { photoDataUrl: "data:image/jpeg;base64,YQ==", notes: "Keep open" };
    try {
      expect(await writeCaptureDraft(draft, "session-only")).toBe(false);
      expect(readSessionCaptureDraft("session-only")).toEqual(draft);
      expect(await readCaptureDraft("session-only")).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
});
