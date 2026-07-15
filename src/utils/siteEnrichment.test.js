import { describe, expect, it } from "vitest";
import {
  clearSiteEnrichmentFields,
  formatSiteEnrichmentCaption,
  siteCoordFingerprint,
  siteEnrichmentMatchesCoords,
  withSiteEnrichment,
} from "./siteEnrichment";

describe("siteEnrichment", () => {
  it("fingerprints coords to 4 decimal places", () => {
    expect(siteCoordFingerprint(51.5074, -0.1278)).toBe("51.5074,-0.1278");
    expect(siteCoordFingerprint("x", 1)).toBe("");
  });

  it("clears hospital and weather fields", () => {
    const cleared = clearSiteEnrichmentFields({
      name: "Keep me",
      postcode: "SW1A 1AA",
      nearestHospital: "St Elsewhere",
      hospitalDirectionsUrl: "https://maps.example/x",
      weatherSnapshot: "Rain",
      weatherFetchedAt: "2020-01-01",
      siteEnrichmentFor: "51.5000,-0.1200",
      siteEnrichmentAt: "2020-01-01T00:00:00.000Z",
    });
    expect(cleared.name).toBe("Keep me");
    expect(cleared.postcode).toBe("SW1A 1AA");
    expect(cleared.nearestHospital).toBe("");
    expect(cleared.weatherSnapshot).toBe("");
    expect(cleared.siteEnrichmentFor).toBe("");
  });

  it("does not treat enrichment for another pin as a match", () => {
    const form = { siteEnrichmentFor: "51.5000,-0.1200", nearestHospital: "Old A&E" };
    expect(siteEnrichmentMatchesCoords(form, 51.5, -0.12)).toBe(true);
    expect(siteEnrichmentMatchesCoords(form, 53.48, -2.24)).toBe(false);
  });

  it("writes enrichment from weather/hospital without keeping stale blanks", () => {
    const next = withSiteEnrichment(
      { postcode: "M1 1AE", nearestHospital: "OLD" },
      {
        lat: 53.4808,
        lng: -2.2426,
        weather: { text: "Cloudy", fetchedAt: "t1" },
        hospital: null,
      }
    );
    expect(next.nearestHospital).toBe("");
    expect(next.weatherSnapshot).toBe("Cloudy");
    expect(next.siteEnrichmentFor).toBe(siteCoordFingerprint(53.4808, -2.2426));
    expect(next.siteEnrichmentAt).toBeTruthy();
  });

  it("captions enrichment by postcode when present", () => {
    const caption = formatSiteEnrichmentCaption({
      postcode: "SW1A 1AA",
      siteEnrichmentFor: "51.5010,-0.1410",
      siteEnrichmentAt: "2026-07-15T10:00:00.000Z",
    });
    expect(caption).toContain("SW1A 1AA");
    expect(caption).toMatch(/fetched/i);
  });
});
