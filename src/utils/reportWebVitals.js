import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

function vitalsEndpoint() {
  const u = String(import.meta.env.VITE_WEB_VITALS_URL || "").trim();
  if (u) return u;
  if (import.meta.env.PROD) return "/api/web-vitals";
  return "";
}

function sendToServer(metric) {
  const url = vitalsEndpoint();
  if (!url) return;
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

function vitalsSink(metric) {
  if (import.meta.env.DEV) {
    console.debug("[web-vitals]", metric.name, metric.value, metric.rating || "");
  }
  sendToServer(metric);
}

/**
 * Registers Core Web Vitals observers (console in dev; POST /api/web-vitals in prod unless overridden).
 */
export function reportWebVitals() {
  onLCP(vitalsSink);
  onINP(vitalsSink);
  onCLS(vitalsSink);
  onFCP(vitalsSink);
  onTTFB(vitalsSink);
}
