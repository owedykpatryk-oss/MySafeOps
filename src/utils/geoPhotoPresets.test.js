import { describe, expect, it } from "vitest";
import {
  GEO_PHOTO_GROUP_ORDER,
  GEO_PHOTO_PRESETS,
  geoPhotoGroupOrderForPack,
  listGeoPhotoPresetsForOrg,
  presetsByGroup,
} from "./geoPhotoPresets";

describe("geoPhotoPresets", () => {
  it("keeps every preset in a known group with the parts the UI needs", () => {
    const groups = new Set(GEO_PHOTO_GROUP_ORDER);
    const ids = new Set();
    for (const preset of GEO_PHOTO_PRESETS) {
      expect(groups.has(preset.group)).toBe(true);
      expect(preset.label).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
    }
  });

  describe("ordering for the workspace's trade", () => {
    it("brings a demolition crew's own groups to the top", () => {
      const order = geoPhotoGroupOrderForPack("demolitionStripout");
      expect(order[0]).toBe("Demolition & asbestos");
      expect(order.indexOf("Demolition & asbestos")).toBeLessThan(order.indexOf("Ground investigation"));
    });

    it("puts survey groups first for a surveying workspace", () => {
      const order = geoPhotoGroupOrderForPack("surveyingGeodesy");
      expect(order.slice(0, 2)).toEqual(["Survey & utilities", "Ground investigation"]);
    });

    it("puts works and quality first for a builder, survey lower down", () => {
      const order = geoPhotoGroupOrderForPack("generalContractor");
      expect(order.indexOf("Construction & works")).toBeLessThan(order.indexOf("Survey & utilities"));
      expect(order.indexOf("Civils & earthworks")).toBeLessThan(order.indexOf("Food & pharma hygiene"));
    });

    it("keeps the groups everyone uses ahead of other trades' groups", () => {
      const order = geoPhotoGroupOrderForPack("foodPharma");
      expect(order[0]).toBe("Food & pharma hygiene");
      expect(order.indexOf("Access & logistics")).toBeLessThan(order.indexOf("Ground investigation"));
    });

    it("hides nothing — every group survives the sort", () => {
      for (const pack of ["demolitionStripout", "surveyingGeodesy", "generalContractor", "foodPharma", ""]) {
        expect([...geoPhotoGroupOrderForPack(pack)].sort()).toEqual([...GEO_PHOTO_GROUP_ORDER].sort());
      }
    });

    it("leaves the catalogue alone for a workspace that asked to see everything", () => {
      expect(geoPhotoGroupOrderForPack("showEverything")).toEqual(GEO_PHOTO_GROUP_ORDER);
    });
  });

  it("groups every preset for the capture picker, in the trade's order", () => {
    const grouped = presetsByGroup("facilitiesMaintenance");
    expect(grouped[0].group).toBe("Facilities & maintenance");
    expect(grouped.flatMap((g) => g.presets)).toHaveLength(GEO_PHOTO_PRESETS.length);
  });

  it("still floats the Utility Mapping capture order above the trade order", () => {
    const list = listGeoPhotoPresetsForOrg(true, "generalContractor");
    expect(list[0].id).toBe("site_entrance");
    expect(list).toHaveLength(GEO_PHOTO_PRESETS.length);
    expect(new Set(list.map((p) => p.id)).size).toBe(GEO_PHOTO_PRESETS.length);
  });
});
