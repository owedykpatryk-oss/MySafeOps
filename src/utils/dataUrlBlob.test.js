import { describe, expect, it } from "vitest";
import { dataUrlToArrayBuffer, dataUrlToBlob, parseDataUrl } from "./dataUrlBlob.js";

describe("dataUrlBlob", () => {
  it("parses base64 image data URLs", () => {
    expect(parseDataUrl("data:image/jpeg;base64,YWJj")).toEqual({
      mime: "image/jpeg",
      base64: "YWJj",
    });
  });

  it("decodes base64 to blob bytes", async () => {
    const blob = dataUrlToBlob("data:text/plain;base64,SGVsbG8=");
    expect(blob.type).toBe("text/plain");
    expect(await blob.text()).toBe("Hello");
  });

  it("decodes to array buffer", async () => {
    const buf = await dataUrlToArrayBuffer("data:application/octet-stream;base64,AQID");
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
  });
});
