/** Format permit events for Slack / Teams incoming webhooks. */

const EVENT_LABELS = {
  issued: "Permit issued",
  status_changed: "Permit status changed",
  deleted: "Permit deleted",
  test: "Webhook test",
};

export function labelPermitIntegrationEvent(event) {
  const key = String(event || "").toLowerCase();
  return EVENT_LABELS[key] || `Permit event: ${key}`;
}

export function buildPermitIntegrationSummary(event, permit = {}, detail = {}) {
  const label = labelPermitIntegrationEvent(event);
  const type = String(permit?.type || "general").replace(/_/g, " ");
  const location = permit?.location || "—";
  const permitId = permit?.id || "—";
  const status = permit?.status || detail?.to_status || detail?.status || "—";
  const issuedTo = permit?.issuedTo ? ` · ${permit.issuedTo}` : "";
  return `${label}: ${type} at ${location}${issuedTo} (${permitId}) · status ${status}`;
}

export function formatSlackWebhookPayload(event, permit = {}, detail = {}) {
  const summary = buildPermitIntegrationSummary(event, permit, detail);
  return {
    text: summary,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: labelPermitIntegrationEvent(event), emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Type:*\n${String(permit?.type || "—").replace(/_/g, " ")}` },
          { type: "mrkdwn", text: `*Status:*\n${permit?.status || detail?.to_status || "—"}` },
          { type: "mrkdwn", text: `*Location:*\n${permit?.location || "—"}` },
          { type: "mrkdwn", text: `*Permit ID:*\n${permit?.id || "—"}` },
        ],
      },
      { type: "context", elements: [{ type: "mrkdwn", text: `_MySafeOps PTW · ${new Date().toISOString()}_` }] },
    ],
  };
}

export function formatTeamsWebhookPayload(event, permit = {}, detail = {}) {
  const summary = buildPermitIntegrationSummary(event, permit, detail);
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary,
    themeColor: event === "deleted" ? "A32D2D" : event === "issued" ? "0d9488" : "2563eb",
    title: labelPermitIntegrationEvent(event),
    sections: [
      {
        facts: [
          { name: "Type", value: String(permit?.type || "—").replace(/_/g, " ") },
          { name: "Status", value: String(permit?.status || detail?.to_status || "—") },
          { name: "Location", value: String(permit?.location || "—") },
          { name: "Permit ID", value: String(permit?.id || "—") },
        ],
      },
    ],
  };
}

export function formatGenericWebhookPayload(event, permit = {}, detail = {}) {
  return {
    event: String(event || "").toLowerCase(),
    at: new Date().toISOString(),
    permitId: permit?.id || "",
    permitType: permit?.type || "",
    status: permit?.status || "",
    location: permit?.location || "",
    detail,
  };
}

export function detectIncomingWebhookKind(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes("hooks.slack.com")) return "slack";
  if (u.includes("webhook.office.com") || u.includes("outlook.office.com/webhook")) return "teams";
  return "generic";
}

export function pickWebhookPayload(event, permit, detail, kind) {
  if (kind === "slack") return formatSlackWebhookPayload(event, permit, detail);
  if (kind === "teams") return formatTeamsWebhookPayload(event, permit, detail);
  return formatGenericWebhookPayload(event, permit, detail);
}

export async function postIncomingWebhook(url, payload, source = "ptw-webhook") {
  const target = String(url || "").trim();
  if (!target) return { ok: false, error: "URL required" };
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-MySafeOps-Source": source },
      body: JSON.stringify(payload),
      mode: "cors",
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
