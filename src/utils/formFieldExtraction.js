/**
 * Smart form field extraction from construction documents (PDFs, scanned images).
 * Uses pattern matching + heuristics to extract permits, certificates, dates, etc.
 *
 * Supported document types:
 * - Permit to Work (PTW)
 * - Hot Work Permits
 * - Confined Space Entry
 * - Site Induction Certificates
 * - Incident/Accident Reports
 * - Risk Assessment Forms
 */

/** @typedef {{
 *   type: 'permit' | 'certificate' | 'incident' | 'assessment';
 *   fields: Record<string, string | null>;
 *   confidence: 'high' | 'medium' | 'low';
 *   extractedText: string;
 * }} ExtractionResult */

const PATTERNS = {
  // Permit/Certificate numbers - must have colon or equals sign
  permitNumber: /(?:Permit\s+(?:Number|#|No\.?)|Certificate\s+(?:Number|#|No\.?)|Ref(?:erence)?\s*#)\s*[=:]\s*([A-Z0-9/-]+)/gi,

  // Dates (multiple formats)
  date: /(?:Date|Issue|Issued|Valid|Expires?|Until)\s*[=:]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{2,4}[-/]\d{1,2}[-/]\d{1,2})/gi,

  // Site addresses
  address: /(?:Site|Location|Address|Building|Project)\s*[=:]\s*([^\n]+?)(?=\n|$)/gi,

  // Person names - require explicit key
  name: /(?:Name|Signed by|Approved by|Inspector|Competent Person)\s*[=:]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,

  // Email
  email: /([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,

  // Phone - more lenient
  phone: /(?:Tel|Phone|Contact)\s*[=:]\s*([\d\s+()-]{7,})/gi,

  // Work type / hazard
  workType: /(?:Type\s+of\s+Work|Work\s+Category|Hazard|Activity)\s*[=:]\s*([^\n]+)/gi,

  // Duration / hours
  duration: /(?:Duration|Hours|Time)\s*[=:]\s*(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|min|days?)/gi,

  // Contractor / Company
  contractor: /(?:Contractor|Company|Employer|Carried out by)\s*[=:]\s*([^\n]+)/gi,
};

/**
 * Clean and normalize extracted text for pattern matching.
 */
function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract field from text using regex pattern.
 * Returns first match or null. Resets lastIndex since patterns are shared module-level objects.
 */
function extractField(text, pattern) {
  pattern.lastIndex = 0;
  const match = pattern.exec(text);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extract multiple values using regex.
 */
function extractFields(text, pattern) {
  pattern.lastIndex = 0;
  const results = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) {
      results.push(match[1].trim());
    }
  }
  return results;
}

/**
 * Detect document type from content heuristics.
 */
function detectDocumentType(text) {
  const lower = text.toLowerCase();

  if (lower.includes("hot work") || lower.includes("hotwork")) return "permit";
  if (lower.includes("confined space") || lower.includes("loto")) return "permit";
  if (lower.includes("permit to work") || lower.includes("ptw")) return "permit";
  if (lower.includes("certificate") || lower.includes("certified")) return "certificate";
  if (lower.includes("incident") || lower.includes("accident")) return "incident";
  if (lower.includes("risk assessment") || lower.includes("hazard")) return "assessment";

  return null;
}

/**
 * Calculate extraction confidence based on field fill rate.
 */
function calculateConfidence(fields) {
  const filled = Object.values(fields).filter(Boolean).length;
  const total = Object.keys(fields).length;
  const rate = total > 0 ? filled / total : 0;

  if (rate >= 0.75) return "high";
  if (rate >= 0.5) return "medium";
  return "low";
}

/**
 * Main extraction function.
 * @param {string} documentText - Raw text extracted from document (PDF text or OCR output)
 * @param {string} [knownType] - Optional: override document type detection
 * @returns {ExtractionResult}
 */
export function extractFormFields(documentText, knownType = null) {
  const normalized = normalizeText(documentText);
  const type = knownType || detectDocumentType(normalized);

  // Common fields across all document types
  const fields = {
    documentType: type,
    permitNumber: extractField(normalized, PATTERNS.permitNumber),
    date: extractField(normalized, PATTERNS.date),
    site: extractField(normalized, PATTERNS.address),
    issuedTo: extractField(normalized, PATTERNS.name),
    email: extractField(normalized, PATTERNS.email),
    phone: extractField(normalized, PATTERNS.phone),
    workType: extractField(normalized, PATTERNS.workType),
    duration: extractField(normalized, PATTERNS.duration),
    contractor: extractField(normalized, PATTERNS.contractor),
  };

  return {
    type,
    fields,
    confidence: calculateConfidence(fields),
    extractedText: normalized.slice(0, 500), // First 500 chars for verification
  };
}

/**
 * Parse date string to ISO format.
 * Handles: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;

  // Try ISO format
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {
    /* fall through */
  }

  // Try DD/MM/YYYY
  const match = dateStr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (match) {
    let [, d, m, y] = match;
    y = y.length === 2 ? `20${y}` : y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

/**
 * Batch extract from multiple document texts.
 * Useful for processing multiple scans/uploads.
 */
export function extractBatchFormFields(documentTexts) {
  return documentTexts.map((text, idx) => ({
    id: `extract_${idx}_${Date.now()}`,
    ...extractFormFields(text),
  }));
}

/**
 * Score extraction quality for sorting/filtering.
 * Higher = better extraction.
 */
export function scoreExtraction(result) {
  let score = 0;

  // Type detection bonus
  if (result.type) score += 10;

  // Field count bonus
  const filled = Object.values(result.fields).filter(Boolean).length;
  score += filled * 5;

  // Confidence bonus
  if (result.confidence === "high") score += 20;
  if (result.confidence === "medium") score += 10;

  return score;
}
