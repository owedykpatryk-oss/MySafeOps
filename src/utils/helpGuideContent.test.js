import { describe, expect, it } from "vitest";
import {
  APP_LAYOUT,
  GLOSSARY,
  GUIDED_HELP_TASKS,
  HELP_FAQ,
  HELP_TOC,
  SETTINGS_TAB_HELP,
} from "./helpGuideContent";
import { WORKSPACE_SETTINGS_TABS } from "../config/workspaceSettingsTabs";

describe("helpGuideContent", () => {
  it("TOC covers main help sections", () => {
    const ids = HELP_TOC.map((t) => t.id);
    expect(ids).toContain("start-here");
    expect(ids).toContain("faq");
    expect(ids).toContain("module-index");
  });

  it("settings help covers every settings tab", () => {
    for (const tab of WORKSPACE_SETTINGS_TABS) {
      expect(SETTINGS_TAB_HELP[tab.id], tab.id).toBeTruthy();
    }
  });

  it("glossary and FAQ are non-empty", () => {
    expect(GLOSSARY.length).toBeGreaterThan(5);
    expect(HELP_FAQ.length).toBeGreaterThan(3);
    expect(APP_LAYOUT.layers.length).toBeGreaterThan(2);
  });

  it("guided tasks provide actionable routes and ordered steps", () => {
    expect(GUIDED_HELP_TASKS.length).toBeGreaterThan(6);
    for (const task of GUIDED_HELP_TASKS) {
      expect(task.title).toBeTruthy();
      expect(task.steps.length).toBeGreaterThan(2);
      expect(task.target?.viewId || task.target?.settingsTab).toBeTruthy();
      expect(task.target?.label).toBeTruthy();
    }
  });
});
