import { describe, it, expect } from "vitest";
import { t, getWorkspaceStrings, dayLabel, tf } from "./workspaceStrings";

describe("workspaceStrings", () => {
  it("translates common chrome strings to German for de/at/ch", () => {
    expect(t("save", "de")).toBe("Speichern");
    expect(t("save", "at")).toBe("Speichern");
    expect(t("save", "ch")).toBe("Speichern");
    expect(t("cancel", "de")).toBe("Abbrechen");
    expect(t("delete", "de")).toBe("Löschen");
  });

  it("translates to Polish for pl", () => {
    expect(t("save", "pl")).toBe("Zapisz");
    expect(t("cancel", "pl")).toBe("Anuluj");
  });

  it("defaults to English for uk/au and unknown markets", () => {
    expect(t("save", "uk")).toBe("Save");
    expect(t("save", "au")).toBe("Save");
    expect(t("save", "xx")).toBe("Save");
    expect(t("save")).toBe("Save");
  });

  it("falls back to the key itself for unknown keys", () => {
    expect(t("this_key_does_not_exist", "de")).toBe("this_key_does_not_exist");
  });

  it("getWorkspaceStrings returns the full dictionary for a market", () => {
    const de = getWorkspaceStrings("de");
    expect(de.save).toBe("Speichern");
    expect(de.cancel).toBe("Abbrechen");
    expect(Object.keys(de).length).toBeGreaterThan(20);
  });

  it("DE/AT/CH share the exact same dictionary (same UI language)", () => {
    expect(getWorkspaceStrings("de")).toEqual(getWorkspaceStrings("at"));
    expect(getWorkspaceStrings("de")).toEqual(getWorkspaceStrings("ch"));
  });

  it("every EN key has a DE and PL translation (no silent gaps)", () => {
    const en = getWorkspaceStrings("uk");
    const de = getWorkspaceStrings("de");
    const pl = getWorkspaceStrings("pl");
    for (const key of Object.keys(en)) {
      expect(de[key], `missing DE translation for "${key}"`).toBeTruthy();
      expect(pl[key], `missing PL translation for "${key}"`).toBeTruthy();
    }
  });

  it("dayLabel translates internal Mon/Tue/... data keys without changing the data model", () => {
    expect(dayLabel("Mon", "de")).toBe("Mo");
    expect(dayLabel("Sun", "de")).toBe("So");
    expect(dayLabel("Mon", "uk")).toBe("Mon");
    expect(dayLabel("Mon", "pl")).toBe("Pon");
  });

  it("dayLabel falls back to the raw key for unknown day strings", () => {
    expect(dayLabel("Xyz", "de")).toBe("Xyz");
  });

  it("tf interpolates placeholders and leaves unknown ones untouched", () => {
    expect(tf("healthPercent", "de", { n: 80 })).toBe("Zustand 80%");
    expect(tf("nextLabel", "uk", { label: "Approve" })).toBe("Next: Approve");
  });
});
