import { describe, expect, it, vi } from "vitest";
import {
  escapeHtml,
  safeCssColor,
  safeImageSrc,
  safeOpaqueToken,
  sanitizePrintPreviewHtml,
  buildPrintPreviewSrcDoc,
  writePrintWindowDocument,
  openPrintWindowOrWarn,
} from "./htmlEscape.js";

describe("escapeHtml", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });
});

describe("safeCssColor", () => {
  it("allows hex colours only", () => {
    expect(safeCssColor("#0d9488")).toBe("#0d9488");
    expect(safeCssColor("#abc")).toBe("#abc");
    expect(safeCssColor("red")).toBe("#0d9488");
    expect(safeCssColor("#0d9488; background:url(javascript:1)")).toBe("#0d9488");
  });
});

describe("safeImageSrc", () => {
  it("blocks javascript: and svg data URLs", () => {
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
    expect(safeImageSrc('data:image/svg+xml,<svg onload="alert(1)"/>')).toBeNull();
  });

  it("allows https and safe raster data URLs", () => {
    expect(safeImageSrc("https://example.com/logo.png")).toMatch(/^https:/);
    expect(safeImageSrc("data:image/png;base64,abcd1234+/=")).toBe("data:image/png;base64,abcd1234+/=");
  });

  it("allows same-origin /branding logos for PWA chrome", () => {
    expect(safeImageSrc("/branding/utility-mapping-logo.png")).toMatch(/\/branding\/utility-mapping-logo\.png$/);
    expect(safeImageSrc("/branding/fess-group-logo.png")).toMatch(/\/branding\/fess-group-logo\.png$/);
  });
});

describe("safeOpaqueToken", () => {
  it("accepts share tokens and rejects junk", () => {
    expect(safeOpaqueToken("r_abc123_def456")).toBe("r_abc123_def456");
    expect(safeOpaqueToken("ack_abc_def")).toBe("ack_abc_def");
    expect(safeOpaqueToken("<script>")).toBeNull();
    expect(safeOpaqueToken("a".repeat(200))).toBeNull();
  });
});

describe("sanitizePrintPreviewHtml", () => {
  it("removes scripts, iframes, and inline handlers", () => {
    const dirty = `<p>Hi</p><script>alert(1)</script><img src=x onerror="alert(2)">`;
    const clean = sanitizePrintPreviewHtml(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).toContain("Hi");
  });

  it("blocks meta refresh and javascript/data-html URLs", () => {
    const dirty = `<meta http-equiv="refresh" content="0;url=javascript:alert(1)"><a href="javascript:alert(1)">x</a>`;
    const clean = sanitizePrintPreviewHtml(dirty);
    expect(clean).not.toMatch(/refresh/i);
    expect(clean).not.toMatch(/javascript:/i);
  });

  it("removes unclosed and self-closing script tags", () => {
    const dirty = `<p>Ok</p><script src="https://evil.test/x.js"><script/>`;
    const clean = sanitizePrintPreviewHtml(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<\/script/i);
    expect(clean).toContain("Ok");
  });

  it("keeps document style blocks for print/PDF layout", () => {
    const dirty = `<!DOCTYPE html><html><head><style>.sr-body{color:teal}</style></head><body><div class="sr-body">Survey</div></body></html>`;
    const clean = sanitizePrintPreviewHtml(dirty);
    expect(clean).toMatch(/<style[\s>]/i);
    expect(clean).toContain(".sr-body");
    expect(clean).toContain("Survey");
    expect(clean).not.toMatch(/<script/i);
  });

  it("writePrintWindowDocument strips scripts before write", async () => {
    const writes = [];
    const win = {
      document: {
        open: () => {},
        write: (s) => writes.push(s),
        close: () => {},
      },
    };
    await writePrintWindowDocument(win, `<html><head></head><body><script>x</script><p>Print</p></body></html>`);
    expect(writes.join("")).not.toMatch(/<script/i);
    expect(writes.join("")).toContain("Print");
    expect(writes.join("")).toMatch(/Content-Security-Policy/i);
  });

  it("buildPrintPreviewSrcDoc injects CSP and strips scripts for sandboxed iframe", () => {
    const doc = buildPrintPreviewSrcDoc(`<!DOCTYPE html><html><head></head><body><script>alert(1)</script><p>RAMS</p></body></html>`);
    expect(doc).toMatch(/Content-Security-Policy/i);
    expect(doc).toMatch(/script-src 'none'/i);
    expect(doc).not.toMatch(/<script/i);
    expect(doc).toContain("RAMS");
  });
});

describe("openPrintWindowOrWarn", () => {
  it("alerts when the print window cannot open", () => {
    const alert = vi.fn();
    const open = vi.fn(() => null);
    vi.stubGlobal("alert", alert);
    vi.stubGlobal("open", open);
    const win = openPrintWindowOrWarn();
    expect(win).toBeNull();
    expect(alert).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
