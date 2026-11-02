import { expect, it } from "vitest";
import { tileSmartLine } from "./moduleTileIntelligence";

it("shows the entire safety instruction on the register tile", () => {
  const instruction = "No records yet — tap Quick start on this tile for a pre-built template, or seed empty registers in the HSE spotlight.";
  expect(tileSmartLine({ smartText: instruction })).toBe(instruction);
});
