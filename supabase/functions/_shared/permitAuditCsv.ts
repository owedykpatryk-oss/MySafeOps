export type PermitAuditCsvRow = {
  occurred_at: string;
  permit_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  detail: Record<string, unknown> | null;
};

/** RFC 4122 UUID (versions 1–5). Used to reject missing/forged country workspace ids. */
export const COUNTRY_WORKSPACE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCountryWorkspaceId(value: unknown): boolean {
  return COUNTRY_WORKSPACE_ID_RE.test(String(value || ""));
}

export function csvEsc(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}

export function permitAuditRowsToCsv(rows: PermitAuditCsvRow[]): string {
  const header = ["occurred_at", "permit_id", "action", "from_status", "to_status", "location", "type"];
  const lines = [header.join(",")];
  rows.forEach((row) => {
    lines.push(
      [
        csvEsc(row.occurred_at),
        csvEsc(row.permit_id),
        csvEsc(row.action),
        csvEsc(row.from_status),
        csvEsc(row.to_status),
        csvEsc(row.detail?.location),
        csvEsc(row.detail?.type),
      ].join(",")
    );
  });
  return lines.join("\n");
}
