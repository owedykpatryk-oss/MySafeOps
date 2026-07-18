import { useMemo, useState } from "react";
import { ms } from "../utils/moduleStyles";
import { canUseFessExclusiveFeatures } from "../utils/fessExclusive";
import {
  buildFessClientDirectory,
  duplicateFessRamsForSite,
  launchFessSiteJobPack,
  openFessSiteLineClearance,
  openFessSiteProject,
} from "../utils/fessClientHub";
import { seedFessSitePortals, getFessPortalForSite } from "../utils/fessPortalPreset";
import {
  copyFessPortalLinkForSite,
  openFessSiteBriefing,
  openFessSitePackForSite,
} from "../utils/fessSiteActions";
import { openWorkspaceView } from "../utils/workspaceNavContext";
import { useToast } from "../context/ToastContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import FessRamsCompletenessBadge from "./FessRamsCompletenessBadge";
import { publishAllFessSitePortals, getFessPortalPublishStatus } from "../utils/fessPortalPublish";
import { seedFessSiteMobilisation } from "../utils/fessSiteMobilisation";
import { listFessJobStarters } from "../utils/fessJobStarters";
import { loadPublishedPortalTokens } from "../utils/clientPortalPublished";
import { runFessTodayOnSite } from "../utils/fessTodayOnSite";
import { getFessBrandLogoSrc } from "../utils/fessBranding";
import { loadOrgSettingsRaw } from "../utils/orgSettingsStorage";

const ss = ms;

/**
 * @param {object} props
 * @param {object[]} [props.projects]
 * @param {object[]} [props.rams]
 * @param {object[]} [props.permits]
 * @param {object[]} [props.methodStatements]
 * @param {"dashboard" | "full"} [props.variant]
 */
export default function FessClientSitesHub({
  projects = [],
  rams = [],
  permits = [],
  methodStatements = [],
  variant = "full",
}) {
  const { pushToast } = useToast();
  const { supabase, user } = useSupabaseAuth();
  const [busyId, setBusyId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [starterBySite, setStarterBySite] = useState({});
  const jobStarters = useMemo(() => listFessJobStarters(), []);
  const portalPublish = useMemo(() => getFessPortalPublishStatus(), [projects, rams]);
  const publishedTokens = useMemo(() => loadPublishedPortalTokens(), [projects, rams]);
  const fessLogo = useMemo(() => getFessBrandLogoSrc(loadOrgSettingsRaw()), []);

  const directory = useMemo(
    () => buildFessClientDirectory({ projects, rams, permits, methodStatements }),
    [projects, rams, permits, methodStatements]
  );

  if (!canUseFessExclusiveFeatures()) return null;

  const compact = variant === "dashboard";

  const run = async (siteId, fn) => {
    if (busyId) return;
    setBusyId(siteId);
    try {
      const result = fn();
      if (result?.message) {
        pushToast(result.message, result.ok ? "success" : result.reason === "no_rams" ? "info" : "warn");
      }
      if (!result?.ok && result?.reason === "no_rams") {
        launchFessSiteJobPack(siteId);
      }
    } finally {
      setBusyId("");
    }
  };

  return (
    <div
      style={{
        ...ss.card,
        marginBottom: compact ? 16 : 0,
        padding: compact ? 16 : 20,
        border: "1px solid #fdba74",
        background: "linear-gradient(165deg, #fff7ed 0%, #f0fdfa 42%, #fff 100%)",
        boxShadow: "0 8px 28px rgba(249, 115, 22, 0.08)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: "linear-gradient(180deg, #f97316 0%, #0d9488 100%)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
          {fessLogo ? (
            <img
              src={fessLogo}
              alt="FESS Group"
              style={{
                height: compact ? 40 : 52,
                width: "auto",
                maxWidth: 120,
                objectFit: "contain",
                flexShrink: 0,
                background: "#fff",
                borderRadius: 10,
                padding: "6px 8px",
                border: "1px solid #fed7aa",
              }}
            />
          ) : null}
          <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#c2410c", textTransform: "uppercase" }}>
            FESS · Client & sites
          </div>
          <div style={{ fontSize: compact ? 17 : 22, fontWeight: 600, color: "#134e4a", marginTop: 4 }}>
            Pick a food factory site — full job pack in one click
          </div>
          <div style={{ fontSize: 13, color: "#115e59", marginTop: 6, maxWidth: 640, lineHeight: 1.5 }}>
            RAMS with standard site RA baseline, method statement, line clearance and LOTO — mapped from your MC reference jobs
            (2SFG, Cranswick, Quorn, Butternut Box, Dovecoat). Use Photos for induction routes, site instructions and incident evidence.
          </div>
          </div>
        </div>
        {!compact ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => openWorkspaceView({ viewId: "fess-setup" })}>
              FESS setup
            </button>
            <button
              type="button"
              style={{ ...ss.btn, fontSize: 12 }}
              onClick={() => {
                const result = seedFessSitePortals();
                pushToast(result.message || (result.created ? `Created ${result.created} portal(s)` : "Portals ready"), result.created ? "success" : "info");
              }}
            >
              Seed site portals
            </button>
            <button
              type="button"
              disabled={publishing || !user}
              style={{ ...ss.btnP, fontSize: 12, opacity: user ? 1 : 0.6 }}
              title={user ? "Publish all FESS site portals to cloud" : "Sign in to publish portals"}
              onClick={async () => {
                if (publishing) return;
                setPublishing(true);
                try {
                  const result = await publishAllFessSitePortals(supabase);
                  pushToast(result.message || "Portal publish complete", result.ok ? "success" : "warn");
                } finally {
                  setPublishing(false);
                }
              }}
            >
              {publishing ? "Publishing…" : `Publish portals (${portalPublish.unpublished} pending)`}
            </button>
          </div>
        ) : (
          <button type="button" style={{ ...ss.btnP, fontSize: 12, padding: "8px 14px" }} onClick={() => openWorkspaceView({ viewId: "fess-sites" })}>
            Open full directory
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 14 : 20 }}>
        {directory.map((group) => (
          <div key={group.client}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f766e", marginBottom: 10 }}>
              {group.client}
              <span style={{ fontWeight: 400, color: "#5eead4", marginLeft: 8 }}>
                {group.siteCount} site{group.siteCount > 1 ? "s" : ""}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: compact ? "repeat(auto-fill, minmax(260px, 1fr))" : "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 12,
              }}
            >
              {group.sites.map(({ template, project, starter, stats }) => {
                const busy = busyId === template.id;
                return (
                  <div
                    key={template.id}
                    style={{
                      borderRadius: 12,
                      border: "1px solid #ccfbf1",
                      background: "#fff",
                      padding: 14,
                      boxShadow: "0 2px 10px rgba(13,148,136,0.08)",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#134e4a" }}>{template.location}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{template.site}</div>
                    {starter ? (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          color: "#0f766e",
                          background: "#f0fdfa",
                          borderRadius: 6,
                          padding: "4px 8px",
                          display: "inline-block",
                        }}
                      >
                        Typical job: {starter.label}
                      </div>
                    ) : null}

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {stats.hasFullPack ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#166534", background: "#dcfce7", padding: "2px 8px", borderRadius: 20 }}>
                          Full pack on site
                        </span>
                      ) : null}
                      {stats.ramsCount > 0 ? (
                        <span style={{ fontSize: 10, color: "#475569", background: "#f1f5f9", padding: "2px 8px", borderRadius: 20 }}>
                          {stats.ramsCount} RAMS
                        </span>
                      ) : null}
                      {stats.activePermits > 0 ? (
                        <span style={{ fontSize: 10, color: "#9a3412", background: "#ffedd5", padding: "2px 8px", borderRadius: 20 }}>
                          {stats.activePermits} open PTW
                        </span>
                      ) : null}
                      {stats.draftRams > 0 ? (
                        <span style={{ fontSize: 10, color: "#854f0b", background: "#fef3c7", padding: "2px 8px", borderRadius: 20 }}>
                          {stats.draftRams} draft
                        </span>
                      ) : null}
                      {stats.latestRams ? (
                        <FessRamsCompletenessBadge
                          form={stats.latestRams}
                          rows={stats.latestRams.rows || []}
                          projects={projects}
                          compact
                        />
                      ) : null}
                    </div>

                    {template.permitControllerHint ? (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, lineHeight: 1.4 }}>
                        Permit controller: {template.permitControllerContact || template.permitControllerHint}
                      </div>
                    ) : null}
                    {getFessPortalForSite(template.id) ? (
                      <div style={{ fontSize: 10, color: "#0f766e", marginTop: 6 }}>
                        Client portal ready — RAMS approval on
                        {publishedTokens.has(getFessPortalForSite(template.id)?.token) ? (
                          <span style={{ marginLeft: 6, color: "#166534" }}>· on cloud</span>
                        ) : (
                          <span style={{ marginLeft: 6, color: "#92400e" }}>· publish to cloud</span>
                        )}
                      </div>
                    ) : null}

                    {!compact && jobStarters.length ? (
                      <div style={{ marginTop: 10 }}>
                        <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4 }}>
                          Job type (optional override)
                        </label>
                        <select
                          value={starterBySite[template.id] || template.suggestedJobStarterKey || ""}
                          onChange={(e) =>
                            setStarterBySite((prev) => ({ ...prev, [template.id]: e.target.value }))
                          }
                          style={{ width: "100%", fontSize: 11, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                        >
                          <option value="">Default — {starter?.label || "site typical job"}</option>
                          {jobStarters.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        disabled={busy}
                        style={{
                          ...ss.btnP,
                          fontSize: 12,
                          padding: "8px 12px",
                          flex: "1 1 auto",
                          minWidth: 140,
                          background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                          borderColor: "#ea580c",
                        }}
                        title="Mobilise G&HP/LOTO/contacts + today's briefing"
                        onClick={() => run(template.id, () => runFessTodayOnSite(template.id))}
                      >
                        {busy ? "Starting…" : "Today on site"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                        title="Open Photos for entrance / zone instructions"
                        onClick={() => run(template.id, () => runFessTodayOnSite(template.id, { openPhotos: true }))}
                      >
                        Photos
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={{ ...ss.btnP, fontSize: 12, padding: "8px 12px", flex: "1 1 auto", minWidth: 140 }}
                        onClick={() =>
                          run(template.id, () =>
                            launchFessSiteJobPack(template.id, {
                              starterKey: starterBySite[template.id] || "",
                            })
                          )
                        }
                      >
                        {busy ? "Starting…" : "Start full job pack"}
                      </button>
                      {stats.ramsCount > 0 ? (
                        <button
                          type="button"
                          disabled={busy}
                          style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                          onClick={() => run(template.id, () => duplicateFessRamsForSite(template.id))}
                        >
                          Repeat job
                        </button>
                      ) : null}
                      {stats.latestRams ? (
                        <button
                          type="button"
                          disabled={busy}
                          style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                          onClick={async () => {
                            if (busyId) return;
                            setBusyId(template.id);
                            try {
                              const result = await openFessSitePackForSite(template.id);
                              pushToast(result.message || "", result.ok ? "success" : "warn");
                            } finally {
                              setBusyId("");
                            }
                          }}
                        >
                          Site pack
                        </button>
                      ) : null}
                      {getFessPortalForSite(template.id) ? (
                        <button
                          type="button"
                          style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                          onClick={async () => {
                            const result = await copyFessPortalLinkForSite(template.id);
                            pushToast(result.message || "", result.ok ? "success" : "warn");
                          }}
                        >
                          Copy portal
                        </button>
                      ) : null}
                      <button
                        type="button"
                        style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                        onClick={() => {
                          const result = seedFessSiteMobilisation(template.id);
                          pushToast(result.message || "", result.ok ? "success" : "info");
                        }}
                      >
                        Mobilise site
                      </button>
                      <button
                        type="button"
                        style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                        onClick={() => run(template.id, () => openFessSiteBriefing(template.id))}
                      >
                        Today briefing
                      </button>
                      {project ? (
                        <button
                          type="button"
                          style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                          onClick={() => openFessSiteProject(template.id)}
                        >
                          Project
                        </button>
                      ) : null}
                      <button
                        type="button"
                        style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                        onClick={() => openFessSiteLineClearance(template.id)}
                      >
                        Line clearance
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
