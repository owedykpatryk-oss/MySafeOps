export function evaluateForecast(forecast, limits) {
  if (!forecast?.points?.length || forecast.points.some((p) => !Array.isArray(p.hours) || !p.hours.length))
    return { status: "Not checked", hours: [] };
  if (
    !limits?.confirmed ||
    ["wind", "gust", "rain", "minTemp", "maxTemp", "visibility"].some(
      (k) => limits[k] === "" || limits[k] == null || !Number.isFinite(Number(limits[k]))
    ) ||
    Number(limits.minTemp) > Number(limits.maxTemp) ||
    ["wind", "gust", "rain", "visibility"].some((k) => Number(limits[k]) < 0)
  )
    return { status: "Limits not confirmed", hours: [] };
  const hours = forecast.points.flatMap((p, index) =>
    p.hours.map((h) => {
      const warnings = [];
      if (["wind", "gust", "rain", "temp", "visibility"].some((k) => !Number.isFinite(h[k])))
        warnings.push("Missing forecast value");
      if (h.wind > Number(limits.wind)) warnings.push("Wind exceeds confirmed limit");
      if (h.gust > Number(limits.gust)) warnings.push("Gust exceeds confirmed limit");
      if (h.rain > Number(limits.rain)) warnings.push("Rain exceeds confirmed limit");
      if (h.temp < Number(limits.minTemp) || h.temp > Number(limits.maxTemp))
        warnings.push("Temperature outside confirmed limits");
      if (h.visibility < Number(limits.visibility)) warnings.push("Visibility below confirmed minimum");
      return { ...h, point: index + 1, warnings };
    })
  );
  return {
    status: hours.some((h) => h.warnings.length) ? "Limit exceedance" : "Within entered limits — pilot review required",
    hours,
  };
}

// A candidate hour is usable only when every representative point has data within
// the entered limits. These windows remain weather recommendations, never clearance.
export function forecastWindows(forecast, limits, start, end) {
  const assessed = evaluateForecast(forecast, limits);
  const from = Date.parse(start),
    to = Date.parse(end);
  if (!assessed.hours.length || !Number.isFinite(from) || !Number.isFinite(to)) return [];
  const grouped = new Map();
  for (const hour of assessed.hours) {
    const at = Date.parse(hour.at);
    if (!Number.isFinite(at)) continue;
    const rows = grouped.get(at) || [];
    rows.push(hour);
    grouped.set(at, rows);
  }
  const windows = [];
  for (const [at, rows] of [...grouped].sort((a, b) => a[0] - b[0])) {
    if (new Set(rows.map((h) => h.point)).size !== forecast.points.length || rows.some((h) => h.warnings.length))
      continue;
    const begin = Math.max(from, at),
      finish = Math.min(to, at + 3600000);
    if (finish <= begin) continue;
    const last = windows.at(-1);
    if (last && last.end === begin) last.end = finish;
    else windows.push({ start: begin, end: finish });
  }
  return windows.map((w) => ({ start: new Date(w.start).toISOString(), end: new Date(w.end).toISOString() }));
}
