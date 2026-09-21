import { describe, expect, it } from "vitest";
import { buildQuickProject, findProjectByName, postcodeFromAddress, quickProjectNameError } from "./quickProject";

describe("quickProject", () => {
  it("builds a minimal project from a name only", () => {
    const project = buildQuickProject({ name: "  Elm Road footway  " });
    expect(project.name).toBe("Elm Road footway");
    expect(project.id).toMatch(/^w_/);
    expect(project.closed).toBe(false);
    expect(project.quickCreated).toBe(true);
    expect(project.lat).toBe("");
    expect(project.lng).toBe("");
  });

  it("returns null without a name", () => {
    expect(buildQuickProject({ name: "   " })).toBeNull();
    expect(buildQuickProject()).toBeNull();
  });

  it("keeps address, postcode and rounded GPS", () => {
    const project = buildQuickProject({
      name: "Depot survey",
      address: "12 Elm Road, Leeds ls11ba",
      latitude: 53.7996123456,
      longitude: -1.5491987654,
    });
    expect(project.address).toBe("12 Elm Road, Leeds ls11ba");
    expect(project.site).toBe("12 Elm Road, Leeds ls11ba");
    expect(project.postcode).toBe("LS1 1BA");
    expect(project.lat).toBe(53.799612);
    expect(project.lng).toBe(-1.549199);
  });

  it("ignores non-finite coordinates", () => {
    const project = buildQuickProject({ name: "No GPS", latitude: null, longitude: "abc" });
    expect(project.lat).toBe("");
    expect(project.lng).toBe("");
  });

  it("finds an existing project ignoring case and spacing", () => {
    const projects = [{ id: "p1", name: "Elm  Road Footway" }];
    expect(findProjectByName("elm road footway", projects)?.id).toBe("p1");
    expect(findProjectByName("Other site", projects)).toBeNull();
    expect(findProjectByName("", projects)).toBeNull();
  });

  it("flags empty and duplicate names", () => {
    const projects = [{ id: "p1", name: "Elm Road" }];
    expect(quickProjectNameError("", projects)).toMatch(/Enter a site/);
    expect(quickProjectNameError("elm road", projects)).toMatch(/already exists/);
    expect(quickProjectNameError("New site", projects)).toBe("");
  });

  it("extracts UK postcodes only when present", () => {
    expect(postcodeFromAddress("Unit 4, M1 4BT Manchester")).toBe("M1 4BT");
    expect(postcodeFromAddress("Behind the depot")).toBe("");
  });
});
