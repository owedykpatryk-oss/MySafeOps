import { describe, expect, it } from "vitest";
import {
  APP_LAYOUT,
  GLOSSARY,
  GUIDED_HELP_TASKS,
  HELP_DETAIL_SECTIONS,
  HELP_FAQ,
  HELP_TOC,
  SETTINGS_TAB_HELP,
} from "./helpGuideContent";
import { WORKSPACE_SETTINGS_TABS } from "../config/workspaceSettingsTabs";

describe("helpGuideContent", () => {
  it("TOC covers live Help Centre sections", () => {
    const ids = HELP_TOC.map((t) => t.id);
    expect(ids).toContain("help-start");
    expect(ids).toContain("help-guides");
    expect(ids).toContain("help-questions");
    expect(ids).toContain("help-modules");
    expect(ids).toContain("help-detail");
  });

  it("settings help covers every settings tab", () => {
    for (const tab of WORKSPACE_SETTINGS_TABS) {
      expect(SETTINGS_TAB_HELP[tab.id], tab.id).toBeTruthy();
    }
  });

  it("glossary and FAQ cover survey / CAD / GPR terms", () => {
    expect(GLOSSARY.length).toBeGreaterThan(15);
    expect(HELP_FAQ.length).toBeGreaterThan(8);
    expect(APP_LAYOUT.layers.length).toBeGreaterThan(2);
    const terms = GLOSSARY.map((g) => g.term.toLowerCase()).join(" ");
    expect(terms).toMatch(/pas 128/);
    expect(terms).toMatch(/gpr/);
    expect(terms).toMatch(/model space/);
    const faq = HELP_FAQ.map((f) => `${f.q} ${f.a}`).join(" ").toLowerCase();
    expect(faq).toMatch(/dxf|cad/);
    expect(faq).toMatch(/mark final/);
  });

  it("guided tasks include survey, GPR, CAD and geo-photos", () => {
    const ids = GUIDED_HELP_TASKS.map((t) => t.id);
    expect(ids).toContain("survey-report");
    expect(ids).toContain("survey-issue-pack");
    expect(ids).toContain("survey-cad-import");
    expect(ids).toContain("gpr-report");
    expect(ids).toContain("gpr-cad-import");
    expect(ids).toContain("geo-photos");
    expect(ids).toContain("survey-gpr-dig");
    expect(GUIDED_HELP_TASKS.length).toBeGreaterThan(12);
    for (const task of GUIDED_HELP_TASKS) {
      expect(task.title).toBeTruthy();
      expect(task.steps.length).toBeGreaterThan(2);
      expect(task.target?.viewId || task.target?.settingsTab).toBeTruthy();
      expect(task.target?.label).toBeTruthy();
    }
  });

  it("detail sections explain hub, survey/CAD, roles and portals", () => {
    expect(HELP_DETAIL_SECTIONS.length).toBeGreaterThanOrEqual(6);
    const titles = HELP_DETAIL_SECTIONS.map((s) => s.title).join(" ");
    expect(titles).toMatch(/Project Hub/i);
    expect(titles).toMatch(/Survey|GPR/i);
    expect(titles).toMatch(/CAD|DXF/i);
    expect(titles).toMatch(/Roles/i);
    expect(titles).toMatch(/portal/i);
  });
});
