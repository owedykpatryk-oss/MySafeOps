/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readSyncQueue, readFailedSync, queueForSync, processSyncQueue } from "./offlineSync";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("offlineSync", () => {
  it("queues item in localStorage", async () => {
    const item = { type: "photo", payload: { url: "test.jpg" } };
    await queueForSync(item);

    const queue = readSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe("photo");
  });

  it("processes queue and marks successful items as completed", async () => {
    const items = [
      { type: "photo", payload: { id: 1 } },
      { type: "record", payload: { id: 2 } },
    ];

    items.forEach((item) => {
      const queue = readSyncQueue();
      queue.push({
        ...item,
        id: `sync_${item.payload.id}`,
        timestamp: Date.now(),
        retries: 0
      });
      localStorage.setItem("mysafeops_sync_queue", JSON.stringify(queue));
    });

    const handler = vi.fn().mockResolvedValue({ success: true });
    const result = await processSyncQueue(handler);

    expect(handler).toHaveBeenCalled();
    expect(result.processed).toBeGreaterThan(0);
    expect(readSyncQueue().length).toBeLessThanOrEqual(2);
  });


  it("moves items to failed queue after MAX_RETRIES", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("Persistent error"));
    const item = {
      type: "photo",
      id: "photo_fail",
      payload: {},
      retries: 3,  // At MAX_RETRIES
      timestamp: Date.now(),
    };

    const queue = [item];
    localStorage.setItem("mysafeops_sync_queue", JSON.stringify(queue));

    await processSyncQueue(handler);
    const failed = readFailedSync();

    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe("photo_fail");
    expect(readSyncQueue()).toHaveLength(0);
  });

  it("tracks sync progress via callback", async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      type: "photo",
      id: `photo_${i}`,
      payload: { id: i },
      retries: 0,
      timestamp: Date.now(),
    }));

    localStorage.setItem("mysafeops_sync_queue", JSON.stringify(items));

    const handler = vi.fn().mockResolvedValue({ success: true });
    const progress = vi.fn();

    await processSyncQueue(handler, progress);

    expect(progress).toHaveBeenCalled();
    const lastCall = progress.mock.calls[progress.mock.calls.length - 1][0];
    expect(lastCall.total).toBe(3);
    expect(lastCall.processed).toBeGreaterThan(0);
  });

  it("handles mixed success and failure", async () => {
    const handler = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("Failed"))
      .mockResolvedValueOnce({ ok: true });

    const items = [
      { type: "photo", id: "p1", payload: {}, retries: 0, timestamp: Date.now() },
      { type: "record", id: "r1", payload: {}, retries: 0, timestamp: Date.now() },
      { type: "photo", id: "p2", payload: {}, retries: 0, timestamp: Date.now() },
    ];

    localStorage.setItem("mysafeops_sync_queue", JSON.stringify(items));

    const result = await processSyncQueue(handler);

    // At least one should succeed
    expect(result.processed).toBeGreaterThan(0);
    // Failed item should be re-queued, not in dead-letter yet
    const newQueue = readSyncQueue();
    expect(newQueue.length).toBeGreaterThan(0);
  });
});
