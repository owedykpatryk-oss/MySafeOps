export function weatherFreshness(forecast, now = Date.now()) {
  if (!forecast) return { current: false, label: "No forecast saved" };
  const fetched = Date.parse(forecast.fetchedAt),
    expires = Date.parse(forecast.validUntil);
  if (!Number.isFinite(fetched) || !Number.isFinite(expires) || expires <= fetched || fetched > now + 60000)
    return { current: false, label: "Forecast freshness could not be verified — fetch again" };
  if (expires <= now) return { current: false, label: "Forecast expired — fetch again before reviewing conditions" };
  return {
    current: true,
    label: `Fetched ${Math.max(0, Math.floor((now - fetched) / 60000))} min ago · refresh due in ${Math.ceil((expires - now) / 60000)} min`,
  };
}
