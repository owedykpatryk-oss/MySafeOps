import { downloadBlob } from "./downloadBlob.js";

function escapeCsvCell(value) {
  let s = value == null ? "" : String(value);
  // Formula-injection guard for Excel
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {string[]} headers
 * @param {Array<Array<unknown>|Record<string, unknown>>} rows - arrays (aligned to headers) OR objects keyed by header
 * @param {string} fileName
 */
export function exportCsv(headers, rows, fileName) {
  const cols = Array.isArray(headers) ? headers : [];
  const lines = [
    cols.map(escapeCsvCell).join(","),
    ...(Array.isArray(rows) ? rows : []).map((row) => {
      if (Array.isArray(row)) {
        return cols.map((_, i) => escapeCsvCell(row[i] ?? "")).join(",");
      }
      // object keyed by header name
      return cols.map((h) => escapeCsvCell(row?.[h] ?? "")).join(",");
    }),
  ];
  const csv = "\uFEFF" + lines.join("\r\n");
  const name = String(fileName || "export.csv").endsWith(".csv")
    ? String(fileName)
    : `${fileName || "export"}.csv`;
  return downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
}
