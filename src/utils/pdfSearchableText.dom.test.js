/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { collectPdfSearchableWords } from "./pdfSearchableText";

describe("collectPdfSearchableWords", () => {
  it("collects visible text with positions and ignores aria-hidden content", () => {
    document.body.innerHTML = '<div id="capture"><p class="strong">Searchable report title</p><span aria-hidden="true">decorative</span></div>';
    const root = document.getElementById("capture");
    root.getBoundingClientRect = () => ({ left: 5, top: 10 });
    Range.prototype.getClientRects = function getClientRects() {
      return [{ left: 15, top: 30, width: this.toString().length * 5, height: 16 }];
    };
    const style = document.createElement("style");
    style.textContent = ".strong { font-size: 16px; font-weight: 700; }";
    document.head.append(style);

    const words = collectPdfSearchableWords(root);
    expect(words.map(({ text }) => text)).toEqual(["Searchable", "report", "title"]);
    expect(words[0]).toMatchObject({ left: 10, top: 20, fontSize: 16, bold: true });
  });
});
