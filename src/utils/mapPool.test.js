import { describe, expect, it } from "vitest";
import { mapPool } from "./mapPool";

describe("mapPool", () => {
  it("runs with concurrency and preserves order", async () => {
    const started = [];
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      started.push(n);
      await new Promise((r) => setTimeout(r, 5));
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(started).toHaveLength(5);
  });

  it("handles empty input", async () => {
    expect(await mapPool([], 3, async (x) => x)).toEqual([]);
  });

  it("propagates worker errors", async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow("boom");
  });
});
