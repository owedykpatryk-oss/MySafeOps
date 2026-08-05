/**
 * Lightweight DXF HATCH parser (model space).
 * dxf-parser does not register HATCH handlers — we scan the ENTITIES section ourselves.
 */

/** Access / site-constraint hatch categories from layer names. */
/** Token match that tolerates underscores in layer names (JS \\b treats _ as a word char). */
function layerTokenRe(src) {
  return new RegExp(`(?:^|[^A-Za-z0-9])(?:${src})(?:[^A-Za-z0-9]|$)`, "i");
}

export const HATCH_CONSTRAINT_TOKENS = [
  {
    key: "vegetation",
    label: "Vegetation / foliage",
    re: layerTokenRe("VEG(?:ETATION)?|FOLIAGE|TREES?|BUSH(?:ES)?|HEDGE|SHRUB|OVERGROWN|GRASS"),
    limitationKey: "access_coverage",
    narrative: "No access / unable to survey due to vegetation or foliage.",
  },
  {
    key: "obstruction",
    label: "Obstruction",
    re: layerTokenRe("OBSTRUCT(?:ION)?|OBSTACLE|CLUTTER|STOCKPILE|SKIP|MATERIAL|COMPOUND"),
    limitationKey: "access_coverage",
    narrative: "Unable to survey — physical obstruction on site.",
  },
  {
    key: "building",
    label: "Building / structure",
    re: layerTokenRe("BUILDING|STRUCTURE|EDIFICE|SHED|CABIN|PORTAKABIN|HOARDING"),
    limitationKey: "access_coverage",
    narrative: "Unable to survey under / against building footprint or structure.",
  },
  {
    key: "no_access",
    label: "No access / exclusion",
    re: layerTokenRe("NO[_ ]?ACCESS|EXCLUSION|OUT[_ ]?OF[_ ]?BOUNDS|RESTRICTED|UNABLE|NOT[_ ]?SURVEYED|NOSURVEY"),
    limitationKey: "access_coverage",
    narrative: "No access — area excluded from survey coverage.",
  },
  {
    key: "water",
    label: "Water / ponding",
    re: layerTokenRe("WATER|POND|LAKE|FLOOD|STANDING[_ ]?WATER|WETLAND"),
    limitationKey: "access_coverage",
    narrative: "Unable to survey — standing water / wet ground.",
  },
  {
    key: "hardstanding",
    label: "Hardstanding / slab",
    re: layerTokenRe("HARDSTAND(?:ING)?|SLAB|CONCRETE|PAVING|CAR[_ ]?PARK"),
    limitationKey: null,
    narrative: "Hardstanding / slab hatch present — surface coupling may be limited.",
  },
];

export function classifyHatchLayer(layerName) {
  const layer = String(layerName || "").trim();
  if (!layer) return null;
  for (const token of HATCH_CONSTRAINT_TOKENS) {
    if (token.re.test(layer)) {
      return { key: token.key, label: token.label, limitationKey: token.limitationKey, narrative: token.narrative, layer };
    }
  }
  // Generic hatch layers that still look like site constraints
  if (/\b(HATCH|FILL|AREA|ZONE)\b/i.test(layer) && /\b(SITE|ACCESS|LIMIT|EXCL)\b/i.test(layer)) {
    return {
      key: "no_access",
      label: "Site exclusion hatch",
      limitationKey: "access_coverage",
      narrative: "Hatch indicates limited or no survey access.",
      layer,
    };
  }
  return null;
}

/** Shoelace polygon area (absolute). Points are [x,y] in metres. */
export function polygonAreaM2(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function formatAreaM2(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return "0 m²";
  if (n < 10) return `${n.toFixed(1)} m²`;
  if (n < 10000) return `${Math.round(n)} m²`;
  return `${(n / 10000).toFixed(2)} ha`;
}

/**
 * Split DXF into entity chunks from the ENTITIES section (best-effort).
 * @param {string} text
 * @returns {Array<{ type: string, groups: Array<{ code: number, value: string }> }>}
 */
export function extractDxfEntityChunks(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const chunks = [];
  let inEntities = false;
  let current = null;

  const pushCurrent = () => {
    if (current?.type) chunks.push(current);
    current = null;
  };

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(String(lines[i]).trim(), 10);
    const value = String(lines[i + 1] ?? "").trim();
    if (!Number.isFinite(code)) continue;

    if (code === 0 && value === "SECTION") {
      // look ahead for section name on next pair — handled below via state
      continue;
    }
    if (code === 2 && value === "ENTITIES") {
      inEntities = true;
      continue;
    }
    if (code === 0 && value === "ENDSEC" && inEntities) {
      pushCurrent();
      inEntities = false;
      continue;
    }
    if (!inEntities) continue;

    if (code === 0) {
      pushCurrent();
      current = { type: value, groups: [] };
      continue;
    }
    if (current) current.groups.push({ code, value });
  }
  pushCurrent();
  return chunks;
}

/**
 * Parse polyline-style boundary vertices from a HATCH entity's groups.
 * Ignores the hatch elevation point (10/20/30 before boundary paths) and only
 * collects vertices after boundary markers (91 path count / 92 path flag / 93 edges).
 */
export function hatchBoundaryRingsFromGroups(groups, scale = 1) {
  const rings = [];
  let ring = [];
  let pendingX = null;
  let inBoundary = false;

  const flush = () => {
    if (ring.length >= 3) rings.push(ring);
    ring = [];
    pendingX = null;
  };

  for (const g of groups) {
    // 91 = number of boundary paths — elevation/extrusion groups are before this.
    if (g.code === 91) {
      inBoundary = true;
      continue;
    }
    // Path type / edge count — start a new ring
    if (g.code === 92 || g.code === 93) {
      if (!inBoundary) inBoundary = true;
      if (ring.length >= 3) flush();
      else {
        ring = [];
        pendingX = null;
      }
      continue;
    }
    if (!inBoundary) continue;
    // Skip seed points (98) and other non-boundary 10/20 after paths if needed — still OK for area.
    if (g.code === 10) {
      pendingX = Number(g.value);
      continue;
    }
    if (g.code === 20 && pendingX != null) {
      const y = Number(g.value);
      if (Number.isFinite(pendingX) && Number.isFinite(y)) {
        ring.push([pendingX * scale, y * scale]);
      }
      pendingX = null;
    }
  }
  flush();
  return rings;
}

/**
 * @param {string} text DXF contents
 * @param {{ scale?: number, modelSpaceOnly?: boolean }} [opts] scale = drawing units → metres
 */
export function analyzeDxfHatches(text, opts = {}) {
  const scale = Number(opts.scale) > 0 ? Number(opts.scale) : 1;
  const modelSpaceOnly = opts.modelSpaceOnly !== false;
  const chunks = extractDxfEntityChunks(text).filter((c) => c.type === "HATCH");

  const hatches = [];
  let paperspaceSkipped = 0;

  for (const chunk of chunks) {
    let layer = "0";
    let inPaperSpace = false;
    let patternName = "";
    for (const g of chunk.groups) {
      if (g.code === 8) layer = g.value;
      if (g.code === 67 && Number(g.value) !== 0) inPaperSpace = true;
      if (g.code === 2) patternName = g.value;
    }
    if (modelSpaceOnly && inPaperSpace) {
      paperspaceSkipped += 1;
      continue;
    }

    const rings = hatchBoundaryRingsFromGroups(chunk.groups, scale);
    const areaM2 = Math.round(rings.reduce((s, r) => s + polygonAreaM2(r), 0) * 100) / 100;
    const classification = classifyHatchLayer(layer);
    hatches.push({
      layer,
      patternName,
      areaM2,
      ringCount: rings.length,
      vertexCount: rings.reduce((s, r) => s + r.length, 0),
      classification,
      isConstraint: Boolean(classification),
    });
  }

  const constraints = hatches.filter((h) => h.isConstraint);
  const byCategoryMap = new Map();
  for (const h of constraints) {
    const key = h.classification.key;
    const prev = byCategoryMap.get(key) || {
      key,
      label: h.classification.label,
      narrative: h.classification.narrative,
      limitationKey: h.classification.limitationKey,
      hatchCount: 0,
      areaM2: 0,
      layers: new Set(),
    };
    prev.hatchCount += 1;
    prev.areaM2 += h.areaM2;
    prev.layers.add(h.layer);
    byCategoryMap.set(key, prev);
  }

  const byCategory = [...byCategoryMap.values()]
    .map((c) => ({
      ...c,
      areaM2: Math.round(c.areaM2 * 100) / 100,
      layers: [...c.layers].sort(),
    }))
    .sort((a, b) => b.areaM2 - a.areaM2 || b.hatchCount - a.hatchCount);

  const totalConstraintAreaM2 = Math.round(byCategory.reduce((s, c) => s + c.areaM2, 0) * 100) / 100;
  const limitationKeys = [...new Set(byCategory.map((c) => c.limitationKey).filter(Boolean))];
  const narratives = byCategory.map((c) => {
    const areaBit = c.areaM2 > 0 ? ` (${formatAreaM2(c.areaM2)} on ${c.hatchCount} hatch${c.hatchCount === 1 ? "" : "es"})` : ` (${c.hatchCount} hatch${c.hatchCount === 1 ? "" : "es"})`;
    return `${c.narrative}${areaBit}`;
  });

  return {
    hatchCount: hatches.length,
    constraintHatchCount: constraints.length,
    paperspaceSkipped,
    totalConstraintAreaM2,
    byCategory,
    hatches: constraints.length ? constraints : hatches.filter((h) => h.areaM2 > 0).slice(0, 20),
    limitationKeys,
    narratives,
  };
}

/** Build findings / limitations prose from hatch analysis. */
export function buildHatchConstraintNarrative(hatchReport) {
  if (!hatchReport?.constraintHatchCount) {
    return "";
  }
  const lines = ["=== Site access / unable-to-survey hatches (model space) ==="];
  lines.push(
    `${hatchReport.constraintHatchCount} constraint hatch${hatchReport.constraintHatchCount === 1 ? "" : "es"} · total area ${formatAreaM2(hatchReport.totalConstraintAreaM2)}${
      hatchReport.paperspaceSkipped ? ` · ${hatchReport.paperspaceSkipped} layout hatch(es) ignored` : ""
    }.`
  );
  (hatchReport.byCategory || []).forEach((c) => {
    lines.push(`• ${c.label}: ${c.hatchCount} hatch(es) · ${formatAreaM2(c.areaM2)} — ${c.narrative}`);
    if (c.layers?.length) lines.push(`  Layers: ${c.layers.join(", ")}`);
  });
  return lines.join("\n");
}
