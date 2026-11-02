import { describe, expect, it, vi } from "vitest";
import { drawGprAnnotations } from "./gprImageAnnotations.js";

describe("GPR image annotations", () => {
  it("draws a labelled arrow and a highlighted box at image resolution", () => {
    const ctx = Object.fromEntries(["save", "restore", "beginPath", "moveTo", "lineTo", "stroke", "closePath", "fill", "fillRect", "strokeRect", "fillText", "arc"].map((name) => [name, vi.fn()]));
    drawGprAnnotations(ctx, [
      { type: "arrow", x1: 100, y1: 200, x2: 500, y2: 600, color: "#ef4444", width: 5 },
      { type: "rectangle", x1: 200, y1: 100, x2: 400, y2: 300, color: "#3b82f6", width: 4 },
      { type: "text", x1: 250, y1: 250, text: "Utility crossing", fontSize: 50, color: "#111827" },
      { type: "pin", x1: 600, y1: 400, number: 1, text: "Possible service", color: "#ef4444" },
    ], 2000, 1000);
    expect(ctx.moveTo).toHaveBeenCalledWith(200, 200);
    expect(ctx.lineTo).toHaveBeenCalledWith(1000, 600);
    expect(ctx.strokeRect).toHaveBeenCalledWith(400, 100, 400, 200);
    expect(ctx.fillText).toHaveBeenCalledWith("Utility crossing", 500, 250);
    expect(ctx.arc).toHaveBeenCalledWith(1200, 400, 50, 0, Math.PI * 2);
    expect(ctx.fillText).toHaveBeenCalledWith("1", 1200, 400);
  });
});
