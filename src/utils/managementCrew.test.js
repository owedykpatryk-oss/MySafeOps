import { describe, expect, it } from "vitest";
import { buildCrewByTeam, crewWarnings, unassignedWorkers } from "./managementCrew";
import { normaliseManagementState } from "./managementOverview";

const NOW = new Date("2026-08-05T12:00:00");
const WORKERS = [
  { id: "w1", name: "Sam Fitter", role: "Groundworker", certifications: [{ certCode: "cscs", expiryDate: "2027-01-01" }] },
  { id: "w2", name: "Ola Nowak", role: "Supervisor", certifications: [{ certCode: "cscs", expiryDate: "2026-07-01" }] },
  { id: "w3", name: "Chris Lane", role: "Operative", certifications: [{ certCode: "cscs", expiryDate: "2026-08-20" }] },
  { id: "w4", name: "Spare Hand", role: "Operative" },
];
const TEAMS = [
  { id: "a", name: "North Team", memberIds: ["w1", "w2", "w3", "ghost"] },
  { id: "b", name: "Central Team", memberIds: [] },
];

describe("management crew", () => {
  it("rosters workers and counts certification problems", () => {
    const crew = buildCrewByTeam(TEAMS, WORKERS, NOW);
    const north = crew.get("a");

    expect(north.count).toBe(3);
    expect(north.expired).toBe(1); // Ola expired on 1 July.
    expect(north.expiringSoon).toBe(1); // Chris expires within 30 days.
    expect(north.missingIds).toEqual(["ghost"]);
    expect(crew.get("b").count).toBe(0);
  });

  it("warns only about teams that actually have work booked", () => {
    const crew = buildCrewByTeam(TEAMS, WORKERS, NOW);
    const jobs = [
      { id: "j1", teamId: "b", status: "confirmed" },
      { id: "j2", teamId: "a", status: "confirmed" },
      { id: "j3", teamId: "c", status: "cancelled" },
    ];
    const warnings = crewWarnings(crew, jobs);

    expect(warnings.empty.map((team) => team.id)).toEqual(["b"]);
    expect(warnings.expired.map((row) => row.team.id)).toEqual(["a"]);

    // No work booked anywhere: nothing to shout about.
    expect(crewWarnings(crew, []).empty).toEqual([]);
  });

  it("lists workers who are not in any crew", () => {
    expect(unassignedWorkers(TEAMS, WORKERS).map((worker) => worker.id)).toEqual(["w4"]);
  });

  it("keeps and de-duplicates roster ids through state validation", () => {
    const state = normaliseManagementState({
      teams: [{ id: "a", name: "North", memberIds: ["w1", "w1", "  ", "w2"] }],
    });
    expect(state.teams[0].memberIds).toEqual(["w1", "w2"]);
  });
});
