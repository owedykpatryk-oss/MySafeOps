import { describe, it, expect } from "vitest";
import {
  extractFormFields,
  parseDate,
  extractBatchFormFields,
  scoreExtraction,
} from "./formFieldExtraction";

describe("formFieldExtraction", () => {
  it("extracts permit number from permit text", () => {
    const text = `
      HOT WORK PERMIT
      Permit Number: HWP-2024-001
      Date: 15/08/2024
    `;
    const result = extractFormFields(text);
    expect(result.fields.permitNumber).toBe("HWP-2024-001");
    expect(result.type).toBe("permit");
  });

  it("extracts date in multiple formats", () => {
    expect(parseDate("15/08/2024")).toMatch(/2024-08/);
    expect(parseDate("2024-08-15")).toMatch(/2024-08-15/);
  });

  it("detects certificate document type", () => {
    const text = `
      SITE INDUCTION CERTIFICATE
      Issued to: John Smith
      This certifies that...
    `;
    const result = extractFormFields(text);
    expect(result.type).toBe("certificate");
  });

  it("detects incident report document type", () => {
    const text = `
      INCIDENT REPORT FORM
      Date of Incident: 12/08/2024
      Type of Accident: Minor cut
    `;
    const result = extractFormFields(text);
    expect(result.type).toBe("incident");
  });

  it("extracts site address", () => {
    const text = `
      Site Address: 123 Main Street, London, UK
      Work Type: Electrical Installation
    `;
    const result = extractFormFields(text);
    expect(result.fields.site).toContain("123 Main Street");
  });

  it("extracts person name", () => {
    const text = `
      Name = Alice Johnson
      Approval Date = 10/08/2024
    `;
    const result = extractFormFields(text);
    expect(result.fields.issuedTo).toContain("Alice");
  });

  it("extracts email and phone", () => {
    const text = `
      Contact: john.doe@company.com
      Phone: +44 20 1234 5678
    `;
    const result = extractFormFields(text);
    expect(result.fields.email).toBe("john.doe@company.com");
    expect(result.fields.phone).toContain("44");
  });

  it("extracts work type / hazard", () => {
    const text = `
      Type of Work: Hot Work - Welding
      Hazard: Fire Risk
      Duration: 4 hours
    `;
    const result = extractFormFields(text);
    expect(result.fields.workType).toContain("Welding");
    expect(result.fields.duration).toBe("4");
  });

  it("extracts contractor information", () => {
    const text = `
      Contractor: Acme Construction Ltd
      Project: Site Expansion Phase 2
    `;
    const result = extractFormFields(text);
    expect(result.fields.contractor).toContain("Acme");
  });

  it("detects hot work permit specifically", () => {
    const text = `
      HOT WORK PERMIT
      Permit #: HW-2024-042
      Authorization for hot work activities
    `;
    const result = extractFormFields(text);
    expect(result.type).toBe("permit");
    expect(result.fields.permitNumber).toBe("HW-2024-042");
  });

  it("detects confined space permit", () => {
    const text = `
      CONFINED SPACE ENTRY PERMIT
      LOTO Applied: Yes
      Competent Person: Bob Wilson
    `;
    const result = extractFormFields(text);
    expect(result.type).toBe("permit");
  });

  it("calculates confidence based on filled fields", () => {
    const fullText = `
      Certificate Number: CERT-001
      Date: 15/08/2024
      Site: 123 Main St
      Issued to: John Smith
      Email: john@company.com
      Phone: 12345678
      Work Type: Electrical
      Duration: 8 hours
      Contractor: ABC Ltd
    `;
    const result = extractFormFields(fullText);
    expect(result.confidence).toBe("high");
  });

  it("gives low confidence for sparse text", () => {
    const sparseText = `
      Document
      Some content
    `;
    const result = extractFormFields(sparseText);
    expect(result.confidence).toBe("low");
  });

  it("processes batch extractions", () => {
    const texts = [
      "Permit Number = HWP-001\nDate = 15/08/2024",
      "Certificate Number = CERT-002\nName = Alice",
    ];
    const results = extractBatchFormFields(texts);
    expect(results).toHaveLength(2);
    expect(results[0].fields.permitNumber).toBe("HWP-001");
    expect(results[1].type).toBe("certificate");
  });

  it("scores extractions for ranking", () => {
    const goodResult = extractFormFields(`
      Permit: HWP-001
      Date: 15/08/2024
      Site: Main St
      Name: John Smith
      Type: Hot Work
      Contractor: ABC Ltd
    `);
    const poorResult = extractFormFields("Document");

    const goodScore = scoreExtraction(goodResult);
    const poorScore = scoreExtraction(poorResult);

    expect(goodScore).toBeGreaterThan(poorScore);
  });

  it("handles document type override", () => {
    const text = "Some ambiguous text";
    const result = extractFormFields(text, "certificate");
    expect(result.type).toBe("certificate");
  });

  it("normalizes whitespace and line breaks", () => {
    const messyText = `
      Permit    Number:   HWP-001

      Date:  15/08/2024


      Site:  123 Main Street
    `;
    const result = extractFormFields(messyText);
    expect(result.fields.permitNumber).toBe("HWP-001");
    expect(result.fields.date).toContain("15/08/2024");
  });

  it("handles missing fields gracefully", () => {
    const minimalText = "Permit Number = HWP-001";
    const result = extractFormFields(minimalText);
    expect(result.fields.permitNumber).toBe("HWP-001");
    expect(result.fields.site).toBeNull();
    expect(result.fields.date).toBeNull();
  });
});
