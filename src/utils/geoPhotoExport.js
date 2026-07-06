/**
 * Geo-photo export — KML/KMZ (Google Earth) and DXF (AutoCAD) with camera blocks & view arrows.
 */
import { geoPhotoPreset } from "./geoPhotoPresets";
import { geoPhotoDisplayUrl } from "./geoPhotoMedia";
import { bearingToEnd, normalizeBearing } from "./geoPhotoUtils";
import { escapeXml } from "../modules/permits/projectDrawingGeo";
import { CAPTURE_PHASE_OPTIONS, resolvedGiDepth, resolvedGiLocationId } from "./geoPhotoFields";
import { loadDrawingEditorPrefs } from "../modules/permits/projectDrawingEditorPrefs";
import { latLngToPlanPercentAffine } from "../modules/permits/projectDrawingAffine";

const EARTH_RADIUS_M = 6371000;

/** Local site grid metres from WGS84 relative to origin. */
export function latLngToSiteMetres(lat, lng, originLat, originLng) {
  const la = Number(lat);
  const ln = Number(lng);
  const oLa = Number(originLat);
  const oLn = Number(originLng);
  if (![la, ln, oLa, oLn].every(Number.isFinite)) return null;
  const cosLat = Math.cos((oLa * Math.PI) / 180);
  const x = ((ln - oLn) * Math.PI) / 180 * EARTH_RADIUS_M * cosLat;
  const y = ((la - oLa) * Math.PI) / 180 * EARTH_RADIUS_M;
  return { x, y };
}

export function exportOriginForPhotos(photos, fallback = { lat: 51.5, lng: -0.1 }) {
  const pts = (photos || []).filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
  if (!pts.length) return { ...fallback };
  const lat = pts.reduce((s, p) => s + Number(p.latitude), 0) / pts.length;
  const lng = pts.reduce((s, p) => s + Number(p.longitude), 0) / pts.length;
  return { lat, lng };
}

/** First affine-calibrated site plan for a project (from drawing editor prefs). */
export function findProjectPlanAffine(projectId) {
  if (!projectId) return null;
  const prefs = loadDrawingEditorPrefs();
  const entries = Object.entries(prefs.planGeoByPlanKey || {}).filter(([k]) => k.startsWith(`${projectId}::`));
  for (const [planKey, entry] of entries) {
    if (entry?.mode === "affine" && entry.affine && typeof entry.affine.a === "number") {
      return { planKey, planId: planKey.split("::")[1] || "", affine: entry.affine };
    }
  }
  return null;
}

/** Geographic bearing (° from north) → AutoCAD INSERT rotation (CCW from +X). */
export function bearingToCadRotation(bearingDeg) {
  const b = normalizeBearing(bearingDeg);
  if (b == null) return 0;
  return normalizeBearing(90 - b);
}

/** Split photos into GPS-tagged vs missing coordinates. */
export function filterGeoPhotosWithCoords(photos) {
  const list = photos || [];
  const withCoords = list.filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
  const withIds = new Set(withCoords.map((p) => p.id));
  const withoutCoords = list.filter((p) => !withIds.has(p.id));
  return { withCoords, withoutCoords, total: list.length };
}

function capturePhaseLabel(phaseKey) {
  return CAPTURE_PHASE_OPTIONS.find((p) => p.key === phaseKey)?.label || "";
}

function photoLabel(photo) {
  const preset = geoPhotoPreset(photo.type);
  const loc = resolvedGiLocationId(photo);
  return loc ? `${preset.label} (${loc})` : preset.label;
}

function photoMetadataRows(photo) {
  const preset = geoPhotoPreset(photo.type);
  const loc = resolvedGiLocationId(photo);
  const depth = resolvedGiDepth(photo);
  const sample = String(photo.sampleRef || "").trim();
  const phase = capturePhaseLabel(photo.capturePhase);
  const bearing = normalizeBearing(photo.bearing);
  const rows = [
    ["Type", preset.label],
    loc ? ["Location ID", loc] : null,
    depth ? ["Depth", depth] : null,
    sample ? ["Sample ref", sample] : null,
    phase ? ["Phase", phase] : null,
    bearing != null ? ["View bearing", `${bearing}°`] : null,
    photo.capturedBy ? ["Captured by", photo.capturedBy] : null,
    photo.timestampUtc ? ["Captured", new Date(photo.timestampUtc).toLocaleString("en-GB")] : null,
  ].filter(Boolean);
  return rows;
}

function photoMetadataTableHtml(photo) {
  const rows = photoMetadataRows(photo);
  if (!rows.length) return "";
  const tr = rows
    .map(([k, v]) => `<tr><th style="text-align:left;padding:2px 8px 2px 0">${escapeXml(k)}</th><td>${escapeXml(v)}</td></tr>`)
    .join("");
  return `<table style="font-size:13px;margin:8px 0">${tr}</table>`;
}

function photoDescriptionHtml(photo) {
  const url = geoPhotoDisplayUrl(photo);
  const preset = geoPhotoPreset(photo.type);
  const parts = [
    `<h3>${escapeXml(preset.label)}</h3>`,
    photoMetadataTableHtml(photo),
    photo.notes ? `<p>${escapeXml(photo.notes)}</p>` : "",
  ];
  if (url && url.startsWith("http")) {
    parts.push(`<p><a href="${escapeXml(url)}">Open full image</a></p>`);
    parts.push(`<img src="${escapeXml(url)}" width="480" alt="Geo-photo"/>`);
  } else if (url && url.startsWith("data:image")) {
    parts.push(`<img src="${escapeXml(url)}" width="480" alt="Geo-photo"/>`);
  } else {
    parts.push(`<p>Image file: <code>images/${escapeXml(photo.id)}.jpg</code> (see KMZ / CAD pack)</p>`);
  }
  return parts.filter(Boolean).join("\n");
}

function arrowLineKml(photo) {
  const lat = Number(photo.latitude);
  const lng = Number(photo.longitude);
  const b = normalizeBearing(photo.bearing);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || b == null) return "";
  const end = bearingToEnd(lat, lng, b);
  if (!end) return "";
  const [lat2, lng2] = end;
  const name = escapeXml(`${photoLabel(photo)} — view direction`);
  return `    <Placemark>
      <name>${name}</name>
      <Style>
        <LineStyle><color>ff0000ff</color><width>3</width></LineStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${lng},${lat},0 ${lng2},${lat2},0</coordinates>
      </LineString>
    </Placemark>`;
}

function kmlPlacemarkForPhoto(p) {
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  const label = escapeXml(photoLabel(p));
  const bearing = normalizeBearing(p.bearing);
  const preset = geoPhotoPreset(p.type);
  const iconStyle =
    bearing != null
      ? `      <Style>
        <IconStyle>
          <color>${kmlColorAbgr(preset.color)}</color>
          <heading>${bearing}</heading>
          <scale>1.15</scale>
          <Icon><href>https://maps.google.com/mapfiles/kml/shapes/camera.png</href></Icon>
        </IconStyle>
      </Style>`
      : `      <Style>
        <IconStyle>
          <color>${kmlColorAbgr(preset.color)}</color>
          <scale>1.1</scale>
          <Icon><href>https://maps.google.com/mapfiles/kml/shapes/camera.png</href></Icon>
        </IconStyle>
      </Style>`;

  const ext = photoMetadataRows(p)
    .map(([k, v]) => `        <Data name="${escapeXml(k)}"><value>${escapeXml(v)}</value></Data>`)
    .join("\n");

  return `    <Placemark>
      <name>${label}</name>
      <description><![CDATA[${photoDescriptionHtml(p)}]]></description>
${iconStyle}
      <ExtendedData>
        <Data name="id"><value>${escapeXml(p.id)}</value></Data>
        <Data name="type"><value>${escapeXml(p.type)}</value></Data>
        <Data name="bearing"><value>${bearing ?? ""}</value></Data>
        <Data name="locationId"><value>${escapeXml(resolvedGiLocationId(p))}</value></Data>
        <Data name="projectId"><value>${escapeXml(p.projectId || "")}</value></Data>
${ext}
      </ExtendedData>
      <Point>
        <coordinates>${lng},${lat},0</coordinates>
      </Point>
    </Placemark>
${arrowLineKml(p)}`;
}

function kmlColorAbgr(hex) {
  const h = String(hex || "#2563eb").replace("#", "");
  if (h.length !== 6) return "ff2563eb";
  return `ff${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`;
}

function buildKmlLookAt(withCoords) {
  if (!withCoords.length) return "";
  const lats = withCoords.map((p) => Number(p.latitude));
  const lngs = withCoords.map((p) => Number(p.longitude));
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs), 0.0005);
  const range = Math.min(8000, Math.max(120, span * 111000 * 2.2));
  return `    <LookAt>
      <longitude>${lng}</longitude>
      <latitude>${lat}</latitude>
      <altitude>0</altitude>
      <range>${range.toFixed(1)}</range>
      <tilt>0</tilt>
      <heading>0</heading>
    </LookAt>`;
}

function buildKmlFolders(withCoords) {
  const byGroup = new Map();
  withCoords.forEach((p) => {
    const group = geoPhotoPreset(p.type).group || "General";
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(p);
  });
  return [...byGroup.entries()]
    .map(([group, items]) => {
      const body = items.map((p) => kmlPlacemarkForPhoto(p)).join("\n");
      return `    <Folder>
      <name>${escapeXml(group)}</name>
      <description>${items.length} photo(s)</description>
${body}
    </Folder>`;
    })
    .join("\n");
}

function groundOverlayKml(photo, sizeM = 10) {
  const lat = Number(photo.latitude);
  const lng = Number(photo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLat = (sizeM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(cosLat, 0.2);
  const bearing = normalizeBearing(photo.bearing) ?? 0;
  return `    <GroundOverlay>
      <name>${escapeXml(photoLabel(photo))} — thumbnail</name>
      <Icon><href>images/${escapeXml(photo.id)}.jpg</href></Icon>
      <LatLonBox>
        <north>${(lat + dLat / 2).toFixed(8)}</north>
        <south>${(lat - dLat / 2).toFixed(8)}</south>
        <east>${(lng + dLng / 2).toFixed(8)}</east>
        <west>${(lng - dLng / 2).toFixed(8)}</west>
        <rotation>${bearing}</rotation>
      </LatLonBox>
    </GroundOverlay>`;
}

/**
 * KML 2.2 document with camera placemarks, view arrows and photo balloons.
 * @param {object[]} photos
 * @param {{ name?: string, projectName?: string, folderByGroup?: boolean, groundOverlays?: boolean }} [opts]
 */
export function buildGeoPhotosKml(photos, opts = {}) {
  const name = escapeXml(opts.name || opts.projectName || "MySafeOps geo-photos");
  const desc = escapeXml(
    "Field geo-photos with GPS and camera bearing. Import in Google Earth or QGIS. KMZ export embeds JPEG thumbnails and optional ground overlays."
  );

  const { withCoords } = filterGeoPhotosWithCoords(photos);
  const origin = exportOriginForPhotos(withCoords);
  const lookAt = buildKmlLookAt(withCoords);
  const folderByGroup = opts.folderByGroup !== false;
  const body = folderByGroup ? buildKmlFolders(withCoords) : withCoords.map((p) => kmlPlacemarkForPhoto(p)).join("\n");
  const overlays =
    opts.groundOverlays && withCoords.length
      ? `\n    <Folder>\n      <name>Photo thumbnails (KMZ)</name>\n${withCoords.map((p) => groundOverlayKml(p)).join("\n")}\n    </Folder>`
      : "";
  const originNote = withCoords.length
    ? escapeXml(`Export: ${withCoords.length} GPS-tagged photo(s). CAD grid origin WGS84 ${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}.`)
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <description>${desc}${originNote ? ` ${originNote}` : ""}</description>
${lookAt}
${body}
${overlays}
  </Document>
</kml>`;
}

/** @param {string} dataUrl */
export function dataUrlToBytes(dataUrl) {
  const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function photoImageBytes(photo) {
  const url = geoPhotoDisplayUrl(photo);
  if (!url) return null;
  if (url.startsWith("data:image")) return dataUrlToBytes(url);
  if (url.startsWith("http")) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  }
  return null;
}

/** CRC32 for ZIP (IEEE). */
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(date = new Date()) {
  const d = date;
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const day = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { time, day };
}

/**
 * Minimal ZIP (store only, no compression) for KMZ / CAD bundles.
 * @param {{ name: string, data: Uint8Array }[]} files
 */
export function buildZipStore(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const nameBytes = enc.encode(name.replace(/\\/g, "/"));
    const { time, day } = dosTime();
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint32(18, crc, true);
    lv.setUint32(22, data.length, true);
    lv.setUint32(26, data.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    parts.push(local);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);
    offset += local.length;
  });

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = parts.reduce((s, p) => s + p.length, 0) + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  parts.forEach((p) => {
    out.set(p, pos);
    pos += p.length;
  });
  central.forEach((c) => {
    out.set(c, pos);
    pos += c.length;
  });
  out.set(end, pos);
  return out;
}

/**
 * KMZ = doc.kml + images/*.jpg for offline Google Earth balloons.
 */
export async function buildGeoPhotosKmzBlob(photos, opts = {}) {
  const kml = buildGeoPhotosKml(photos, { ...opts, groundOverlays: opts.groundOverlays !== false });
  const files = [{ name: "doc.kml", data: new TextEncoder().encode(kml) }];
  const withCoords = (photos || []).filter((p) => Number.isFinite(Number(p.latitude)));

  for (const p of withCoords) {
    const bytes = await photoImageBytes(p);
    if (bytes?.length) {
      files.push({ name: `images/${p.id}.jpg`, data: bytes });
    }
  }

  const zip = buildZipStore(files);
  return new Blob([zip], { type: "application/vnd.google-earth.kmz" });
}

function dxfPair(code, value) {
  return `${code}\n${value}\n`;
}

function dxfAttdef(tag, prompt, x, y, height = 0.45) {
  return [
    dxfPair(0, "ATTDEF"),
    dxfPair(8, "GEO_PHOTO"),
    dxfPair(10, String(x)),
    dxfPair(20, String(y)),
    dxfPair(30, "0"),
    dxfPair(1, prompt),
    dxfPair(2, tag),
    dxfPair(40, String(height)),
    dxfPair(70, "0"),
  ].join("");
}

function dxfAttrib(tag, value, x, y, height = 0.45) {
  return [
    dxfPair(0, "ATTRIB"),
    dxfPair(8, "GEO_PHOTO"),
    dxfPair(10, String(x)),
    dxfPair(20, String(y)),
    dxfPair(30, "0"),
    dxfPair(1, String(value || "")),
    dxfPair(2, tag),
    dxfPair(40, String(height)),
  ].join("");
}

/** Minimal DXF R2000 with GEO_PHOTO block (camera + arrow), inserts, view lines, hyperlinks. */
export function buildGeoPhotosDxf(photos, opts = {}) {
  const origin = opts.origin || exportOriginForPhotos(photos);
  const arrowLenM = opts.arrowLengthM ?? 8;
  const blockScale = opts.blockScale ?? 1;
  const { withCoords } = filterGeoPhotosWithCoords(photos);

  const layers = new Set(["GEO_PHOTOS", "GEO_VIEW_ARROWS", "GEO_LABELS", "_GEOREF"]);
  withCoords.forEach((p) => {
    const layer = `GP_${String(p.type || "other").replace(/[^a-z0-9_]/gi, "_").slice(0, 24)}`;
    layers.add(layer);
  });

  let tables = "";
  layers.forEach((layer) => {
    tables += `  0\nLAYER\n  2\n${layer}\n  70\n0\n  62\n7\n  6\nCONTINUOUS\n`;
  });

  tables += `  0\nLAYER\n  2\nGEO_PHOTO\n  70\n0\n  62\n3\n  6\nCONTINUOUS\n`;

  const al = arrowLenM * 0.35;
  const blockEntities = [
    dxfPair(0, "CIRCLE"),
    dxfPair(8, "GEO_PHOTO"),
    dxfPair(10, "0"),
    dxfPair(20, "0"),
    dxfPair(30, "0"),
    dxfPair(40, "0.4"),
    dxfPair(0, "LWPOLYLINE"),
    dxfPair(8, "GEO_PHOTO"),
    dxfPair(90, "4"),
    dxfPair(70, "1"),
    dxfPair(10, String(al * 0.15)),
    dxfPair(20, "0.22"),
    dxfPair(10, String(al * 0.55)),
    dxfPair(20, "0.22"),
    dxfPair(10, String(al * 0.55)),
    dxfPair(20, "-0.22"),
    dxfPair(10, String(al * 0.15)),
    dxfPair(20, "-0.22"),
    dxfPair(0, "LINE"),
    dxfPair(8, "GEO_PHOTO"),
    dxfPair(10, "0"),
    dxfPair(20, "0"),
    dxfPair(30, "0"),
    dxfPair(11, String(al)),
    dxfPair(21, "0"),
    dxfPair(31, "0"),
    dxfPair(0, "SOLID"),
    dxfPair(8, "GEO_PHOTO"),
    dxfPair(10, String(al * 0.92)),
    dxfPair(20, "-0.14"),
    dxfPair(11, String(al)),
    dxfPair(21, "0"),
    dxfPair(12, String(al * 0.92)),
    dxfPair(22, "0.14"),
    dxfAttdef("LOC_ID", "Location", 0, -0.75),
    dxfAttdef("DEPTH", "Depth", 0, -1.25),
  ].join("");

  let entities = "";
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const track = (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  withCoords.forEach((p) => {
    const m =
      opts.coordinateMode === "plan_percent"
        ? { x: Number(p.longitude), y: Number(p.latitude) }
        : latLngToSiteMetres(p.latitude, p.longitude, origin.lat, origin.lng);
    if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const { x, y } = m;
    track(x, y);
    const preset = geoPhotoPreset(p.type);
    const layer = `GP_${String(p.type || "other").replace(/[^a-z0-9_]/gi, "_").slice(0, 24)}`;
    const rot = bearingToCadRotation(p.bearing);
    const label = photoLabel(p);
    const imgRel = `images/${p.id}.jpg`;

    entities += dxfPair(0, "INSERT");
    entities += dxfPair(8, layer);
    entities += dxfPair(2, "GEO_PHOTO");
    entities += dxfPair(10, x.toFixed(4));
    entities += dxfPair(20, y.toFixed(4));
    entities += dxfPair(30, "0");
    entities += dxfPair(41, String(blockScale));
    entities += dxfPair(50, rot.toFixed(4));
    entities += dxfAttrib("LOC_ID", resolvedGiLocationId(p) || "—", 0, -0.75);
    entities += dxfAttrib("DEPTH", resolvedGiDepth(p) || "—", 0, -1.25);
    entities += dxfPair(0, "SEQEND");

    const b = normalizeBearing(p.bearing);
    if (b != null) {
      const rad = (b * Math.PI) / 180;
      const dx = Math.sin(rad) * arrowLenM;
      const dy = Math.cos(rad) * arrowLenM;
      const x2 = x + dx;
      const y2 = y + dy;
      track(x2, y2);
      entities += dxfPair(0, "LINE");
      entities += dxfPair(8, "GEO_VIEW_ARROWS");
      entities += dxfPair(62, "1");
      entities += dxfPair(10, x.toFixed(4));
      entities += dxfPair(20, y.toFixed(4));
      entities += dxfPair(30, "0");
      entities += dxfPair(11, x2.toFixed(4));
      entities += dxfPair(21, y2.toFixed(4));
      entities += dxfPair(31, "0");
    }

    const url = geoPhotoDisplayUrl(p);
    const linkTarget = url?.startsWith("http") ? url : imgRel;
    const mtext = `{\\H\\${linkTarget};${label.replace(/[{}\\]/g, "")}}`;

    entities += dxfPair(0, "MTEXT");
    entities += dxfPair(8, "GEO_LABELS");
    entities += dxfPair(10, x.toFixed(4));
    entities += dxfPair(20, (y - 1.2 * blockScale).toFixed(4));
    entities += dxfPair(30, "0");
    entities += dxfPair(40, "0.8");
    entities += dxfPair(71, "5");
    entities += dxfPair(1, mtext);
  });

  if (!Number.isFinite(minX)) {
    minX = -10;
    minY = -10;
    maxX = 10;
    maxY = 10;
  }

  const georefText =
    opts.coordinateMode === "plan_percent"
      ? `Geo-photo export — site plan overlay (0–100 %). Plan: ${opts.planId || "calibrated"}. Affine georef from Drawing Editor. Y = 100 − plan% (CAD Y-up). Bearing arrow = camera view direction.`
      : `Geo-photo export — local site grid (metres). Origin WGS84: ${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}. Bearing arrow = camera view direction. Click label hyperlink to open JPEG.`;
  entities += dxfPair(0, "TEXT");
  entities += dxfPair(8, "_GEOREF");
  entities += dxfPair(10, minX.toFixed(4));
  entities += dxfPair(20, (minY - 3).toFixed(4));
  entities += dxfPair(30, "0");
  entities += dxfPair(40, "1.2");
  entities += dxfPair(1, georefText);

  const header = [
    dxfPair(0, "SECTION"),
    dxfPair(2, "HEADER"),
    dxfPair(9, "$ACADVER"),
    dxfPair(1, "AC1015"),
    dxfPair(9, "$INSUNITS"),
    dxfPair(70, "6"),
    dxfPair(9, "$EXTMIN"),
    dxfPair(10, (minX - 5).toFixed(4)),
    dxfPair(20, (minY - 5).toFixed(4)),
    dxfPair(30, "0"),
    dxfPair(9, "$EXTMAX"),
    dxfPair(10, (maxX + 5).toFixed(4)),
    dxfPair(20, (maxY + 5).toFixed(4)),
    dxfPair(30, "0"),
    dxfPair(0, "ENDSEC"),
  ].join("");

  const tablesSec = [
    dxfPair(0, "SECTION"),
    dxfPair(2, "TABLES"),
    dxfPair(0, "TABLE"),
    dxfPair(2, "LAYER"),
    dxfPair(70, String(layers.size + 1)),
    tables,
    dxfPair(0, "ENDTAB"),
    dxfPair(0, "TABLE"),
    dxfPair(2, "BLOCK_RECORD"),
    dxfPair(70, "1"),
    dxfPair(0, "BLOCK_RECORD"),
    dxfPair(2, "GEO_PHOTO"),
    dxfPair(0, "ENDTAB"),
    dxfPair(0, "ENDSEC"),
  ].join("");

  const blocksSec = [
    dxfPair(0, "SECTION"),
    dxfPair(2, "BLOCKS"),
    dxfPair(0, "BLOCK"),
    dxfPair(8, "GEO_PHOTO"),
    dxfPair(2, "GEO_PHOTO"),
    dxfPair(70, "0"),
    dxfPair(10, "0"),
    dxfPair(20, "0"),
    dxfPair(30, "0"),
    blockEntities,
    dxfPair(0, "ENDBLK"),
    dxfPair(0, "ENDSEC"),
  ].join("");

  const entitiesSec = [dxfPair(0, "SECTION"), dxfPair(2, "ENTITIES"), entities, dxfPair(0, "ENDSEC")].join("");

  return [header, tablesSec, blocksSec, entitiesSec, dxfPair(0, "EOF")].join("");
}

/**
 * DXF with camera blocks on georeferenced site plan (0–100 %, Y-up CAD: y = 100 − plan%).
 * Requires 3-point affine calibration in Project Drawing Editor.
 */
export function buildGeoPhotosPlanOverlayDxf(photos, planAffine, opts = {}) {
  const arrowLen = opts.planArrowLen ?? 3;
  const blockScale = opts.blockScale ?? 0.85;
  const { withCoords } = filterGeoPhotosWithCoords(photos);
  const plan = planAffine?.affine;
  if (!plan) return "";

  const mapped = withCoords
    .map((p) => {
      const pt = latLngToPlanPercentAffine(p.latitude, p.longitude, plan);
      if (!pt || pt.px < -5 || pt.px > 105 || pt.py < -5 || pt.py > 105) return null;
      return { photo: p, px: pt.px, py: 100 - pt.py };
    })
    .filter(Boolean);

  if (!mapped.length) return "";

  return buildGeoPhotosDxf(
    mapped.map(({ photo, px, py }) => ({
      ...photo,
      latitude: py,
      longitude: px,
    })),
    {
      ...opts,
      origin: { lat: 0, lng: 0 },
      arrowLengthM: arrowLen,
      blockScale,
      coordinateMode: "plan_percent",
      planId: planAffine.planId,
    }
  );
}

function buildGeoPhotosViewerHtml(photos, origin, opts = {}) {
  const title = escapeXml(opts.name || opts.projectName || "Geo-photos");
  const rows = (photos || [])
    .filter((p) => Number.isFinite(Number(p.latitude)))
    .map((p) => {
      const preset = geoPhotoPreset(p.type);
      return {
        id: p.id,
        label: photoLabel(p),
        type: preset.label,
        color: preset.color,
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        bearing: normalizeBearing(p.bearing),
        loc: resolvedGiLocationId(p),
        depth: resolvedGiDepth(p),
        image: `images/${p.id}.jpg`,
        notes: p.notes || "",
      };
    });
  const data = JSON.stringify(rows);
  const originJson = JSON.stringify(origin);
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — viewer</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
body{font-family:system-ui,sans-serif;margin:0;display:grid;grid-template-columns:1fr 340px;min-height:100vh}
#map{min-height:100vh}
#panel{padding:16px;border-left:1px solid #cbd5e1;background:#fff;overflow:auto}
.meta{font-size:13px;color:#475569;line-height:1.5}
.meta dt{font-weight:600;margin-top:8px}
img{max-width:100%;border-radius:8px;margin-top:8px}
.cam-icon{width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);position:relative}
.cam-icon::after{content:'';position:absolute;left:50%;top:50%;width:22px;height:3px;background:#dc2626;transform-origin:left center;transform:rotate(var(--r,90deg)) translateY(-50%)}
@media(max-width:800px){body{grid-template-columns:1fr;grid-template-rows:55vh 1fr}}
</style></head><body>
<div id="map"></div>
<div id="panel"><h2>${title}</h2><p class="meta">Click a camera marker on the map to preview the field photo. Red tick = view direction (bearing).</p><div id="detail"></div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const ORIGIN = ${originJson};
const PHOTOS = ${data};
const map = L.map('map');
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
const detail = document.getElementById('detail');
function show(p){
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function safeImg(u){const x=String(u||'');if(/^https?:\\/\\//i.test(x)||/^\\.\\//.test(x)||/^images\\//.test(x))return esc(x);return '';}
  let html = '<h3>'+esc(p.label)+'</h3><dl class="meta">';
  if(p.loc) html += '<dt>Location</dt><dd>'+esc(p.loc)+'</dd>';
  if(p.depth) html += '<dt>Depth</dt><dd>'+esc(p.depth)+'</dd>';
  if(p.bearing!=null) html += '<dt>View bearing</dt><dd>'+esc(p.bearing)+'°</dd>';
  html += '</dl><img src="'+safeImg(p.image)+'" onerror="this.replaceWith(Object.assign(document.createElement(\\'p\\'),{textContent:\\'Image not found — keep images/ next to this HTML file.\\'}))"/>';
  if(p.notes) html += '<p>'+esc(p.notes)+'</p>';
  detail.innerHTML = html;
}
const bounds = [];
PHOTOS.forEach(p => {
  bounds.push([p.lat,p.lng]);
  const el = document.createElement('div');
  el.className = 'cam-icon';
  el.style.background = p.color || '#2563eb';
  if(p.bearing!=null) el.style.setProperty('--r',(90-p.bearing)+'deg');
  const icon = L.divIcon({html:el.outerHTML,className:'',iconSize:[28,28],iconAnchor:[14,14]});
  const m = L.marker([p.lat,p.lng],{icon}).addTo(map);
  m.bindTooltip(p.label);
  m.on('click',()=>show(p));
  if(p.bearing!=null){
    const rad = p.bearing * Math.PI / 180;
    const d = 0.00015;
    const lat2 = p.lat + d*Math.cos(rad), lng2 = p.lng + d*Math.sin(rad)/Math.cos(p.lat*Math.PI/180);
    L.polyline([[p.lat,p.lng],[lat2,lng2]],{color:'#dc2626',weight:3}).addTo(map);
  }
});
if(bounds.length) map.fitBounds(bounds,{padding:[40,40]});
else map.setView([ORIGIN.lat,ORIGIN.lng],15);
if(PHOTOS.length===1) show(PHOTOS[0]);
</script></body></html>`;
}

export async function buildGeoPhotosCadBundleBlob(photos, opts = {}) {
  const origin = opts.origin || exportOriginForPhotos(photos);
  const dxf = buildGeoPhotosDxf(photos, { ...opts, origin });
  const planAffine = opts.projectId ? findProjectPlanAffine(opts.projectId) : null;
  const planDxf = planAffine ? buildGeoPhotosPlanOverlayDxf(photos, planAffine, opts) : "";
  const files = [
    { name: "geo-photos.dxf", data: new TextEncoder().encode(dxf) },
    { name: "README.txt", data: new TextEncoder().encode(
      `MySafeOps geo-photos — AutoCAD export\n\n` +
        `1. Open geo-photos.dxf in AutoCAD / BricsCAD / LibreCAD.\n` +
        (planDxf ? `2. geo-photos-on-plan.dxf — cameras on your georeferenced site plan (0–100 %, from Drawing Editor affine).\n` : "") +
        `${planDxf ? "3" : "2"}. Keep this ZIP extracted so the images/ folder sits next to geo-photos.dxf.\n` +
        `${planDxf ? "4" : "3"}. Camera blocks (GEO_PHOTO) show capture position; block attributes show Location ID and depth.\n` +
        `${planDxf ? "5" : "4"}. Red lines show view direction (bearing). Click blue MTEXT labels — hyperlinks open images/photo_id.jpg.\n` +
        `${planDxf ? "6" : "5"}. Open geo-photos-viewer.html in a browser — OSM map with click-to-preview photos.\n\n` +
        `Grid origin (WGS84): ${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}\n` +
        `Units: metres (local site grid)\n`
    ) },
    { name: "geo-photos-viewer.html", data: new TextEncoder().encode(buildGeoPhotosViewerHtml(photos, origin, opts)) },
    { name: "geo-photos.csv", data: new TextEncoder().encode(buildCadManifestCsv(photos, origin)) },
  ];
  if (planDxf) {
    files.splice(1, 0, { name: "geo-photos-on-plan.dxf", data: new TextEncoder().encode(planDxf) });
  }

  const withCoords = (photos || []).filter((p) => Number.isFinite(Number(p.latitude)));
  for (const p of withCoords) {
    const bytes = await photoImageBytes(p);
    if (bytes?.length) files.push({ name: `images/${p.id}.jpg`, data: bytes });
  }

  return new Blob([buildZipStore(files)], { type: "application/zip" });
}

function buildCadManifestCsv(photos, origin) {
  const header = "id,label,type,location_id,depth,sample_ref,latitude,longitude,x_metres,y_metres,bearing,image_file,notes";
  const lines = (photos || [])
    .filter((p) => Number.isFinite(Number(p.latitude)))
    .map((p) => {
      const m = latLngToSiteMetres(p.latitude, p.longitude, origin.lat, origin.lng);
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      return [
        p.id,
        photoLabel(p),
        geoPhotoPreset(p.type).label,
        resolvedGiLocationId(p),
        resolvedGiDepth(p),
        p.sampleRef || "",
        Number(p.latitude).toFixed(8),
        Number(p.longitude).toFixed(8),
        m ? m.x.toFixed(3) : "",
        m ? m.y.toFixed(3) : "",
        normalizeBearing(p.bearing) ?? "",
        `images/${p.id}.jpg`,
        p.notes || "",
      ].map(esc).join(",");
    });
  return [header, ...lines].join("\n");
}

/** GPX 1.1 waypoints for GPS units / GIS. */
export function buildGeoPhotosGpx(photos, opts = {}) {
  const name = escapeXml(opts.name || opts.projectName || "MySafeOps geo-photos");
  const { withCoords } = filterGeoPhotosWithCoords(photos);
  const wpts = withCoords
    .map((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      const bearing = normalizeBearing(p.bearing);
      const desc = photoMetadataRows(p)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
      return `  <wpt lat="${lat.toFixed(8)}" lon="${lng.toFixed(8)}">
    <name>${escapeXml(photoLabel(p))}</name>
    <desc>${escapeXml(desc)}${p.notes ? ` — ${escapeXml(p.notes)}` : ""}</desc>
    <type>${escapeXml(p.type)}</type>${bearing != null ? `\n    <cmt>View bearing ${bearing}°</cmt>` : ""}
  </wpt>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MySafeOps" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${name}</name><desc>Field geo-photos with GPS and camera bearing</desc></metadata>
${wpts}
</gpx>`;
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadGeoPhotosKml(photos, fileName, opts = {}) {
  const kml = buildGeoPhotosKml(photos, opts);
  triggerDownload(new Blob([kml], { type: "application/vnd.google-earth.kml+xml" }), fileName || `geo-photos-${new Date().toISOString().slice(0, 10)}.kml`);
}

export async function downloadGeoPhotosKmz(photos, fileName, opts = {}) {
  const blob = await buildGeoPhotosKmzBlob(photos, opts);
  triggerDownload(blob, fileName || `geo-photos-${new Date().toISOString().slice(0, 10)}.kmz`);
}

export function downloadGeoPhotosDxf(photos, fileName, opts = {}) {
  const dxf = buildGeoPhotosDxf(photos, opts);
  triggerDownload(new Blob([dxf], { type: "application/dxf" }), fileName || `geo-photos-${new Date().toISOString().slice(0, 10)}.dxf`);
}

export async function downloadGeoPhotosCadBundle(photos, fileName, opts = {}) {
  const blob = await buildGeoPhotosCadBundleBlob(photos, opts);
  triggerDownload(blob, fileName || `geo-photos-cad-${new Date().toISOString().slice(0, 10)}.zip`);
}

export function downloadGeoPhotosGpx(photos, fileName, opts = {}) {
  const gpx = buildGeoPhotosGpx(photos, opts);
  triggerDownload(new Blob([gpx], { type: "application/gpx+xml" }), fileName || `geo-photos-${new Date().toISOString().slice(0, 10)}.gpx`);
}

/** Resolve export set and optionally warn when photos lack GPS. */
export function prepareGeoPhotoExport(photos, { confirmSkip = true } = {}) {
  const { withCoords, withoutCoords, total } = filterGeoPhotosWithCoords(photos);
  if (!withCoords.length) {
    throw new Error("No geo-photos with GPS coordinates in the current filter.");
  }
  if (withoutCoords.length && confirmSkip) {
    const confirmFn = typeof globalThis.confirm === "function" ? globalThis.confirm.bind(globalThis) : () => true;
    const ok = confirmFn(
      `${withCoords.length} of ${total} photo(s) have GPS and will be exported. ${withoutCoords.length} without coordinates will be skipped. Continue?`
    );
    if (!ok) return null;
  }
  return { photos: withCoords, skipped: withoutCoords.length, exported: withCoords.length };
}
