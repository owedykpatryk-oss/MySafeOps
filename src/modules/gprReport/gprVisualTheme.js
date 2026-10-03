const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const GPR_VISUAL_THEME_PRESETS = [
  {
    key: "brand",
    label: "Organisation",
    description: "Use your organisation branding",
    primaryColor: null,
    accentColor: null,
  },
  {
    key: "radar_blue",
    label: "Radar blue",
    description: "Technical and precise",
    primaryColor: "#0C447C",
    accentColor: "#00A6D6",
  },
  {
    key: "site_gold",
    label: "Site gold",
    description: "High-visibility construction",
    primaryColor: "#172554",
    accentColor: "#F59E0B",
  },
  {
    key: "survey_green",
    label: "Survey green",
    description: "Ground and environment",
    primaryColor: "#064E3B",
    accentColor: "#10B981",
  },
  {
    key: "graphite_lime",
    label: "Graphite lime",
    description: "Modern field technology",
    primaryColor: "#111827",
    accentColor: "#84CC16",
  },
  {
    key: "ultraviolet",
    label: "Ultraviolet",
    description: "Premium geophysics",
    primaryColor: "#4C1D95",
    accentColor: "#8B5CF6",
  },
  {
    key: "custom",
    label: "Custom",
    description: "Choose both colours",
    primaryColor: "#0C447C",
    accentColor: "#00A6D6",
  },
];

export function safeGprHexColor(value, fallback) {
  const candidate = String(value || "").trim();
  return HEX_COLOR.test(candidate) ? candidate : fallback;
}

function hexToRgb(hex) {
  const safe = safeGprHexColor(hex, "#000000").slice(1);
  return [0, 2, 4].map((index) => Number.parseInt(safe.slice(index, index + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mixHex(a, b, weight) {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return rgbToHex(from.map((channel, index) => channel + (to[index] - channel) * weight));
}

function relativeLuminance(hex) {
  const channels = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function resolveGprVisualTheme(report, organisation = {}) {
  const selection = report?.visualTheme || {};
  const preset = GPR_VISUAL_THEME_PRESETS.find((item) => item.key === selection.presetKey)
    || GPR_VISUAL_THEME_PRESETS[0];
  const organisationPrimary = safeGprHexColor(organisation.primaryColor, "#0C447C");
  const organisationAccent = safeGprHexColor(organisation.accentColor, "#00A6D6");
  const primary = safeGprHexColor(
    preset.key === "brand" ? organisationPrimary : selection.primaryColor || preset.primaryColor,
    organisationPrimary
  );
  const accent = safeGprHexColor(
    preset.key === "brand" ? organisationAccent : selection.accentColor || preset.accentColor,
    organisationAccent
  );
  const accentInk = relativeLuminance(accent) > 0.48 ? mixHex(accent, "#000000", 0.42) : accent;

  return {
    key: preset.key,
    label: preset.label,
    primary,
    accent,
    accentInk,
    accentSoft: mixHex(accent, "#FFFFFF", 0.84),
    primarySoft: mixHex(primary, "#FFFFFF", 0.92),
  };
}

export function gprThemeCssVariables(report, organisation) {
  const theme = resolveGprVisualTheme(report, organisation);
  return {
    "--gpr-theme-primary": theme.primary,
    "--gpr-theme-accent": theme.accent,
    "--gpr-theme-accent-ink": theme.accentInk,
    "--gpr-theme-accent-soft": theme.accentSoft,
    "--gpr-theme-primary-soft": theme.primarySoft,
  };
}
