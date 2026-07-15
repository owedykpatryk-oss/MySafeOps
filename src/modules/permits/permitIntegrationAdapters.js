function nowIso() {
  return new Date().toISOString();
}

export function suggestPermitDescriptionText(draft) {
  const type = String(draft?.type || "general").replace(/_/g, " ");
  const location = String(draft?.location || "specified work area");
  const issuedTo = String(draft?.issuedTo || "assigned team");
  return `Carry out ${type} operations at ${location}. Work party: ${issuedTo}. Follow RAMS and permit controls, maintain exclusion zones, and stop work if conditions change.`;
}

export function queueIntegrationEvent(permit, channel, payload = {}) {
  return {
    id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: nowIso(),
    channel: String(channel || "webhook").toLowerCase(),
    status: "queued",
    payload,
    permitId: permit?.id || "",
  };
}

const CHANNEL_META = {
  webhook: {
    label: "Custom webhook",
    hint: "Generic JSON POST for automation tools (Zapier, Make, your API).",
  },
  slack: {
    label: "Slack",
    hint: "Incoming webhook — posts to a channel when permits are issued or closed.",
  },
  teams: {
    label: "Microsoft Teams",
    hint: "Incoming webhook — posts MessageCard alerts to a Teams channel.",
  },
  calendar: {
    label: "Calendar sync",
    hint: "Coming soon — validity windows in Outlook / Google Calendar.",
  },
};

export function buildIntegrationAdaptersStatus(webhookConfig = null) {
  const webhook = webhookConfig || loadDefaults();
  const genericLive = Boolean(webhook.enabled && webhook.url);
  const slackLive = Boolean(webhook.slackEnabled && webhook.slackUrl);
  const teamsLive = Boolean(webhook.teamsEnabled && webhook.teamsUrl);

  return [
    {
      channel: "webhook",
      label: CHANNEL_META.webhook.label,
      enabled: genericLive,
      note: genericLive
        ? "Live — JSON events POST to your URL."
        : "Add a URL below for custom automation.",
    },
    {
      channel: "slack",
      label: CHANNEL_META.slack.label,
      enabled: slackLive,
      note: slackLive ? "Live — Slack incoming webhook connected." : CHANNEL_META.slack.hint,
    },
    {
      channel: "teams",
      label: CHANNEL_META.teams.label,
      enabled: teamsLive,
      note: teamsLive ? "Live — Teams incoming webhook connected." : CHANNEL_META.teams.hint,
    },
  ];
}

function loadDefaults() {
  return {
    enabled: false,
    url: "",
    slackEnabled: false,
    slackUrl: "",
    teamsEnabled: false,
    teamsUrl: "",
  };
}

export const PERMIT_INTEGRATION_EVENTS = [
  { id: "issued", label: "Permit issued / activated" },
  { id: "status_changed", label: "Status changed" },
  { id: "deleted", label: "Permit deleted" },
];
