import { DEFAULT_GEO_ANCHOR } from "../modules/permits/projectDrawingGeo";
import { geoAnchorFromProject } from "./projectBoundary";
import { lookupSitePostcode, resolveSitePostcodeInput } from "./siteAddressLookup";

const DEFAULT_SPAN = { spanLat: 0.012, spanLng: 0.016 };

/**
 * Resolve drawing-editor map anchor from project lat/lng, KML boundary, or postcode lookup.
 * @param {object | null | undefined} project
 * @param {{ lookup?: typeof lookupSitePostcode }} [options]
 * @returns {Promise<{ anchor: { lat: number, lng: number, spanLat: number, spanLng: number }, source: 'project' | 'postcode' | 'default', postcode?: string }>}
 */
export async function resolveProjectGeoAnchor(project, { lookup = lookupSitePostcode } = {}) {
  const sync = geoAnchorFromProject(project);
  if (sync) return { anchor: sync, source: "project" };

  const pcQuery = resolveSitePostcodeInput(project?.postcode, project?.address, project?.site);
  if (pcQuery) {
    const pc = await lookup(pcQuery);
    if (pc && Number.isFinite(pc.lat) && Number.isFinite(pc.lng)) {
      return {
        anchor: { lat: pc.lat, lng: pc.lng, ...DEFAULT_SPAN },
        source: "postcode",
        postcode: pc.postcode || pcQuery,
      };
    }
  }

  return { anchor: { ...DEFAULT_GEO_ANCHOR }, source: "default" };
}
