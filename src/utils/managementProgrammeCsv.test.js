import { describe, expect, it } from "vitest";
import { buildProgrammeCsv, csvCell, summariseProgramme } from "./managementProgrammeCsv";

const TODAY = "2026-08-05";
const TEAMS = [{ id: "a", name: "North Team" }];
const JOBS = [
  {
    id: "j1",
    name: "Manchester dig",
    client: "Acme",
    site: "M1",
    teamId: "a",
    start: "2026-08-10",
    end: "2026-08-12",
    status: "confirmed",
    value: 12500,
    source: "project",
    readiness: { dates: true, team: true, rams: true, permits: true, survey: true, client: true },
  },
  {
    id: "j2",
    name: "=cmd|' /c calc'!A1",
    client: "Prospect",
    site: "Leeds",
    teamId: "",
    start: "2026-09-01",
    end: "2026-09-02",
    status: "provisional",
    source: "opportunity",
    readiness: { dates: true },
  },
];

describe("programme CSV", () => {
  it("neutralises spreadsheet formulas and quotes everything", () => {
    expect(csvCell("=1+1")).toBe(`"'=1+1"`);
    expect(csvCell("+44 7700 900000")).toBe(`"'+44 7700 900000"`);
    expect(csvCell('He said "no"')).toBe(`"He said ""no"""`);
    expect(csvCell("line\nbreak")).toBe(`"line break"`);
  });

  it("writes a header row and one row per job", () => {
    const csv = buildProgrammeCsv(JOBS, { teams: TEAMS, conflictedIds: new Set(["j1"]), today: TODAY });
    const lines = csv.split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('"Job","Client","Location","Team"');
    expect(lines[1]).toContain('"Manchester dig"');
    expect(lines[1]).toContain('"North Team"');
    expect(lines[1]).toContain('"upcoming"');
    expect(lines[1]).toContain('"12500"');
    expect(lines[1].endsWith('"Yes"')).toBe(true);
    // The hostile job name is exported as text, never as a formula.
    expect(lines[2]).toContain(`"'=cmd`);
    expect(lines[2]).toContain('"Pipeline"');
  });

  it("summarises tone counts", () => {
    expect(summariseProgramme(JOBS)).toMatchObject({ green: 1 });
  });
});
