import { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext.jsx";
import { useD1OrgArraySync } from "../../hooks/useD1OrgArraySync.js";
import { D1ModuleSyncBanner } from "../../components/D1ModuleSyncBanner.jsx";
import PageHero from "../../components/PageHero.jsx";
import { loadOrgScoped as load, saveOrgScoped as save, countryOperationalStorageKey } from "../../utils/orgStorage.js";
import { COUNTRY_WORKSPACE_CHANGED_EVENT } from "../../utils/countryWorkspaces.js";
import { isBillingWriteBlocked } from "../../utils/billingAccess.js";
import { getOrgSettings } from "../../utils/orgSettingsStorage.js";
import { getOrgMarketId } from "../../utils/orgMarket.js";
import { reverseUkPostcode } from "../../utils/postcodeLookup.js";
import { parseProjectBoundaryRing } from "../../utils/projectBoundary.js";
import { openWorkspaceView } from "../../utils/workspaceNavContext.js";
import { pushAudit } from "../../utils/auditLog.js";
import {
  EQUIPMENT_PROFILES as BASE_PROFILES,
  PAYLOADS as BASE_PAYLOADS,
  MISSION_TEMPLATES as BASE_TEMPLATES,
} from "./droneLibrary.js";
import {
  blankMission,
  copyMission,
  editMission,
  assessMission,
  applicableChecklist,
  issuePack,
  droneId,
  applyMissionMutation,
  setupMissionDefaults,
} from "./droneMission.js";
import { importDroneBoundary, parseDroneGeometry, geometrySummary } from "./droneGeometry.js";
import { useDroneRegisters, refreshDroneRegisters, readStoredDroneMissions } from "./useDroneRegisters.js";
import { isD1Configured } from "../../lib/d1SyncClient.js";
import { verifyIssuedSnapshot } from "./droneIssueConfirmation.js";
import DroneMap from "./DroneMap.jsx";
import BoundaryImportDialog from "./BoundaryImportDialog.jsx";
import { saveManualRows } from "./companyManual.js";
import { MAP_DESTINATIONS, prepareMapImport } from "./mapTools.js";
import FieldWorkspace, { LandingLocations } from "./FieldWorkspace.jsx";
import { MissionNextStep, ExportReviewDialog } from "./MissionWorkflow.jsx";
import { exportReviewKey } from "./missionWorkflow.js";
import DroneEvidence from "./DroneEvidence.jsx";
import DroneManuals from "./DroneManuals.jsx";
import DroneLibraryEditor from "./DroneLibraryEditor.jsx";
import DroneWeather from "./DroneWeather.jsx";
import HelicopterSetup, { OperatorRelease } from "./HelicopterSetup.jsx";
import MissionComposer from "./MissionComposer.jsx";
import { preparationError, repeatMissionDefaults } from "./missionPreparation.js";
import DocumentWorkbench from "./DocumentWorkbench.jsx";
import { projectSuggestions, preparationPatch } from "./documentAutomation.js";
import { missionReminders, actionSection } from "./droneReminders.js";
import {
  regionOf,
  isHelicopter,
  regionalSources,
  missionTimeZone,
  AU_TIME_ZONES,
  UK_PATHWAYS,
  AU_PATHWAYS,
  approvedStatus,
  manualApplies,
  ruleVersion,
} from "./droneRegions.js";
import "./droneOperations.css";

function useRows(key) {
  const [rows, setRows] = useState(() => load(key, []));
  const sync = useD1OrgArraySync({ storageKey: key, namespace: key, value: rows, setValue: setRows, load, save });
  return [rows, setRows, sync];
}
function Field({ label, value, onChange, type = "text", wide = false, children, ...rest }) {
  return (
    <label className={wide ? "drone-wide" : undefined}>
      {label}
      {children ? (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} {...rest}>
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} {...rest} />
      ) : (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
      )}
    </label>
  );
}
const option = (id, name) => (
  <option key={id} value={id}>
    {name}
  </option>
);

// Remount all editor state on organisation/country changes; async callbacks retain their original scope.
export default function DroneOperations() {
  const { orgId } = useApp();
  const [countryTick, setCountryTick] = useState(0);
  useEffect(() => {
    const change = () => setCountryTick((t) => t + 1);
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, change);
    return () => window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, change);
  }, []);
  return <DroneWorkspace key={`${orgId}:${countryOperationalStorageKey("drone_missions")}:${countryTick}`} />;
}
function DroneWorkspace() {
  const regionCode = getOrgMarketId(),
    au = regionCode === "au";
  const { role } = useApp();
  const { user } = useSupabaseAuth();
  const actor = { name: user?.email || "Local responsible person", id: user?.id || null, role };
  const canEdit = ["admin", "supervisor"].includes(role) && !isBillingWriteBlocked();
  const [missions, setMissions, sync] = useRows("drone_missions");
  const missionsRef = useRef(missions);
  missionsRef.current = missions;
  const [manuals, setManuals, manualSync] = useRows("drone_manuals");
  const manualsRef = useRef(manuals);
  manualsRef.current = manuals;
  const [allSetups, setSetups, setupSync] = useRows("drone_setups");
  const setups = allSetups.filter((s) => regionOf(s) === regionCode);
  const [library, setLibrary, librarySync] = useRows("drone_library");
  const { registers, setRegisters, registerError } = useDroneRegisters();
  const [selected, setSelected] = useState(() => load("drone_editor_session", {}).missionId || "");
  const [tab, setTab] = useState("missions"),
    [section, setSection] = useState("overview"),
    [search, setSearch] = useState("");
  const [librarySearch, setLibrarySearch] = useState(""),
    [compareProfiles, setCompareProfiles] = useState([]);
  const [composing, setComposing] = useState(false);
  const [confirmedIssues, setConfirmedIssues] = useState({});
  const cloudRequired = isD1Configured();
  const issueConfirmed = (issue) => !cloudRequired || confirmedIssues[issue.id] === JSON.stringify(issue);
  const displayStatus = (m, status) => {
    const issue = m.issues?.find((i) => i.snapshot?.approval?.at === m.approval?.at);
    return cloudRequired && status === approvedStatus(m) && (!issue || !issueConfirmed(issue))
      ? "Awaiting cloud confirmation"
      : status;
  };
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [onSite, setOnSite] = useState(false);
  const [exportReview, setExportReview] = useState(null);
  const [exportProgress, setExportProgress] = useState("");
  const exportCancelled = useRef(false);
  const [mapImport, setMapImport] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine),
    [now, setNow] = useState(Date.now());
  const alive = useRef(true),
    current = useRef(null);
  const scope = useRef(countryOperationalStorageKey("drone_missions"));
  const mission = missions.find((m) => m.id === selected && !m.deletedAt && regionOf(m) === regionCode);
  const helicopter = isHelicopter(mission);
  let zone = "UTC";
  try {
    zone = missionTimeZone(mission || { regionCode, timeZone: au ? "Australia/Perth" : "Europe/London" });
  } catch {
    /* Invalid zone remains a blocking next action. */
  }
  current.current = { selected, revision: mission?.revision, editToken: mission?.editToken };
  const extensions = {
    profiles: library.filter((r) => r.kind === "profile" && regionOf(r) === regionCode),
    payloads: library.filter((r) => r.kind === "payload" && regionOf(r) === regionCode),
    templates: library.filter((r) => r.kind === "template" && regionOf(r) === regionCode),
    checklists: library.filter((r) => r.kind === "checklist" && regionOf(r) === regionCode),
  };
  const EQUIPMENT_PROFILES = [...BASE_PROFILES, ...extensions.profiles],
    PAYLOADS = [...BASE_PAYLOADS, ...extensions.payloads],
    MISSION_TEMPLATES = [...BASE_TEMPLATES, ...extensions.templates];
  const context = { ...registers, manuals, ...extensions };
  // The timer refreshes idle screens; edits must evaluate against the current clock,
  // otherwise evidence entered just after a minute boundary can look future-dated.
  const assessedAt = Date.now();
  const assessment = mission ? assessMission(mission, context, assessedAt, offline) : null;
  const summary = geometrySummary(mission?.boundary);
  const reminders = missionReminders(
    missions.filter((m) => regionOf(m) === regionCode),
    now
  );
  useEffect(() => {
    alive.current = true;
    const online = () => setOffline(!navigator.onLine),
      timer = setInterval(() => setNow(Date.now()), 30000);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    save("drone_editor_session", { missionId: selected });
    setOnSite(false);
  }, [selected, mission?.revision]);
  function persist(next) {
    if (!canEdit || !alive.current || scope.current !== countryOperationalStorageKey("drone_missions")) return;
    let result;
    try {
      result = applyMissionMutation(missionsRef.current, next);
    } catch (e) {
      setError(e.message);
      return;
    }
    if (!save("drone_missions", result.rows)) {
      setError("Save failed. Check storage space or billing access before leaving.");
      return;
    }
    missionsRef.current = result.rows;
    setMissions(result.rows);
    setError("");
    return result.saved;
  }
  const patch = (changes) => persist(editMission(mission, changes, actor.name));
  function createPrepared(options) {
    const { sourceMissionId, sourceVersion, ...planning } = options;
    const project = registers.projects.find((p) => p.id === options.projectId && !p.deletedAt);
    const template = MISSION_TEMPLATES.find((t) => t.id === options.templateId);
    if (!project || !template) {
      setError("The selected project or template is no longer available. Choose it again.");
      return false;
    }
    const problem = preparationError({ ...planning, regionCode });
    if (problem) {
      setError(problem);
      return false;
    }
    const source = sourceMissionId && missionsRef.current.find((m) => m.id === sourceMissionId);
    if (
      sourceMissionId &&
      (!source ||
        source.deletedAt ||
        source.cancelled ||
        source.projectId !== planning.projectId ||
        (source.regionCode || "uk") !== regionCode ||
        (source.aircraftKind || "drone") !== planning.aircraftKind ||
        (source.editToken || source.updatedAt || String(source.revision)) !== sourceVersion)
    ) {
      setError("The previous mission changed or is no longer available. Select it again before preparing the draft.");
      return false;
    }
    let next = blankMission({
      ...(source
        ? repeatMissionDefaults(source)
        : planning.aircraftKind === "drone"
          ? setupMissionDefaults(setups.find((s) => s.isDefault))
          : {}),
      ...(source && source.templateId !== planning.templateId ? { qa: "", deliverables: "" } : {}),
      ...planning,
      ...(source
        ? {
            preparationSource: {
              id: source.id,
              revision: source.revision,
              title: source.title,
              copiedAt: new Date().toISOString(),
            },
          }
        : {}),
      regionCode,
      country: au ? "Australia" : "United Kingdom",
      title: `${project.name} — ${template.name}`,
    });
    next = { ...next, ...preparationPatch(next, projectSuggestions(next, project, template), actor.name) };
    const ring = parseProjectBoundaryRing(project);
    if (ring && !next.boundary)
      try {
        const coords = ring.map(([lat, lng]) => [lng, lat]);
        if (JSON.stringify(coords[0]) !== JSON.stringify(coords.at(-1))) coords.push(coords[0]);
        next.boundary = parseDroneGeometry(JSON.stringify({ type: "Polygon", coordinates: [coords] }));
      } catch {
        /* Existing project outline needs manual review in Mission & map. */
      }
    if (!persist(next)) return false;
    setSelected(next.id);
    setTab("missions");
    setSection("documents");
    setComposing(false);
    setMessage("Draft package prepared. Review the reused details and complete the outstanding checks.");
    return true;
  }
  function create() {
    setComposing(false);
    const saved = setups.find((s) => s.isDefault);
    const next = blankMission({
      ...setupMissionDefaults(saved),
      regionCode,
      aircraftKind: au && !saved ? "helicopter" : "drone",
      timeZone: au ? "" : "Europe/London",
      country: au ? "Australia" : "",
      title: au ? "New aerial survey" : "New drone survey",
    });
    if (!persist(next)) return;
    setSelected(next.id);
    setTab("missions");
    setSection("overview");
  }
  async function importFile(file) {
    if (!file || !canEdit || busy) return;
    const target = { ...current.current };
    setBusy(true);
    setError("");
    try {
      const geometry = await importDroneBoundary(file);
      if (
        !alive.current ||
        current.current.selected !== target.selected ||
        current.current.editToken !== target.editToken
      )
        return;
      setMapImport({ geometry, filename: file.name, missionId: target.selected, editToken: target.editToken });
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function confirmMapImport(indices, target) {
    if (!mapImport || !mission || mission.id !== mapImport.missionId || mission.editToken !== mapImport.editToken) {
      setError("The mission changed. Cancel this preview and import again.");
      return;
    }
    try {
      const changes = prepareMapImport(mapImport.geometry, indices, target);
      if (target === "boundary" && ["New drone survey", "New aerial survey"].includes(mission.title))
        changes.title = changes.boundary.features[0].properties.name || mapImport.filename;
      if (!patch(changes)) {
        setMapImport((review) => ({
          ...review,
          notice: "The import was not saved. Check storage space and editing access, then retry or cancel.",
        }));
        return;
      }
      setMapImport(null);
      setMessage(`${MAP_DESTINATIONS[target]} imported. Review it against current site conditions.`);
    } catch (e) {
      setError(e.message);
    }
  }
  async function findNearbyPostcode() {
    if (!canEdit || busy || !summary.centre || au) return;
    const target = { ...current.current };
    setBusy(true);
    try {
      const location = await reverseUkPostcode(summary.centre[1], summary.centre[0]);
      if (
        !alive.current ||
        current.current.selected !== target.selected ||
        current.current.editToken !== target.editToken
      )
        return;
      if (!location) {
        setMessage("No reliable nearby postcode was returned. Enter the location manually.");
        return;
      }
      const changes = {};
      if (!mission.location) changes.location = location.adminDistrict || location.parish || "";
      if (!mission.postcode) changes.postcode = location.postcode || "";
      if (!mission.country) changes.country = location.country || "";
      if (Object.keys(changes).length && !patch(changes)) return;
      setMessage("Nearby postcode checked. Existing location details were kept; review any filled fields.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function selectProject(id) {
    const p = registers.projects.find((r) => r.id === id),
      ring = parseProjectBoundaryRing(p);
    const changes = {
      projectId: id,
      ...preparationPatch(mission, projectSuggestions(mission, p, null), actor.name),
    };
    if (!mission.boundary && ring) {
      const coords = ring.map(([lat, lng]) => [lng, lat]);
      if (JSON.stringify(coords[0]) !== JSON.stringify(coords.at(-1))) coords.push(coords[0]);
      try {
        changes.boundary = parseDroneGeometry(JSON.stringify({ type: "Polygon", coordinates: [coords] }));
      } catch {
        setMessage("Project boundary needs review. Import a validated boundary.");
      }
    }
    patch(changes);
  }
  function draftSnapshot() {
    const liveAssessment = assessMission(mission, context, Date.now(), !navigator.onLine);
    return JSON.parse(
      JSON.stringify({
        kind: "draft",
        issuedAt: new Date().toISOString(),
        snapshot: {
          ...mission,
          records: {
            project: registers.projects.find((p) => p.id === mission.projectId),
            pilot: registers.workers.find((w) => w.id === mission.pilotId),
            observer: registers.workers.find((w) => w.id === mission.observerId),
            asset: registers.assets.find((a) => a.id === mission.assetId),
            rams: registers.rams.find((r) => r.id === mission.ramsId),
            manual: manuals.find((r) => r.id === mission.manualId),
          },
          catalogue: {
            profile: liveAssessment.profile,
            payload: liveAssessment.payload,
            template: liveAssessment.template,
          },
          sources: regionalSources(mission),
          checklistDefinitions: applicableChecklist(mission, context),
          nextActions: liveAssessment.actions,
          branding: getOrgSettings(),
        },
      })
    );
  }
  function confirmDraftExport() {
    if (!mission || mission.id !== exportReview.issue.snapshot.id) {
      setExportReview(null);
      setError("The selected mission changed. Open a new export review.");
      return;
    }
    const fresh = draftSnapshot();
    if (exportReviewKey(fresh) !== exportReviewKey(exportReview.issue)) {
      setExportReview({
        ...exportReview,
        issue: fresh,
        notice: "The mission or linked records changed. This review has been refreshed; check it before exporting.",
      });
      return;
    }
    const reviewed = exportReview;
    setExportReview(null);
    exportPdf(reviewed.issue, reviewed.kind);
  }
  async function exportPdf(issue, documentKind) {
    if (!issue) {
      setExportReview({ issue: draftSnapshot(), kind: documentKind });
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setExportProgress("Preparing export…");
    exportCancelled.current = false;
    const exportScope = scope.current;
    try {
      if (issue?.kind === "approved" && cloudRequired) {
        await verifyIssuedSnapshot(issue, readStoredDroneMissions);
        if (!alive.current || scope.current !== countryOperationalStorageKey("drone_missions")) return;
        setConfirmedIssues((rows) => ({ ...rows, [issue.id]: JSON.stringify(issue) }));
      }
      const { downloadDronePack, downloadPreparationDocument } = await import("./dronePdf.js");
      const download =
        documentKind === "bundle"
          ? (await import("./documentBundle.js")).downloadDraftBundle
          : documentKind
            ? (data, options) => downloadPreparationDocument(data, documentKind, options)
            : downloadDronePack;
      if (!alive.current || scope.current !== exportScope) return;
      const result = await download(issue, {
        isActive: () =>
          !exportCancelled.current &&
          alive.current &&
          scope.current === exportScope &&
          countryOperationalStorageKey("drone_missions") === exportScope,
        onProgress: (label) => {
          if (alive.current && scope.current === exportScope) setExportProgress(label);
        },
      });
      if (alive.current && scope.current === exportScope)
        setMessage(
          result?.warnings?.length
            ? `Export prepared with a map warning: ${result.warnings.join(" ")} Check your browser downloads.`
            : "Export prepared. Check your browser downloads."
        );
    } catch (e) {
      if (alive.current && scope.current === exportScope) {
        if (e.name === "AbortError") setMessage("Export cancelled. No file was downloaded.");
        else setError(e.message);
      }
    } finally {
      if (alive.current && scope.current === exportScope) {
        setBusy(false);
        setExportProgress("");
      }
    }
  }
  async function approve() {
    setBusy(true);
    setError("");
    setMessage("");
    const target = { ...current.current };
    try {
      const fresh = await refreshDroneRegisters();
      if (
        !alive.current ||
        current.current.selected !== target.selected ||
        current.current.editToken !== target.editToken
      )
        throw new Error("Mission changed during review. Review the current version.");
      setRegisters(fresh);
      const next = issuePack(
        mission,
        { ...fresh, manuals, ...extensions },
        actor,
        onSite,
        Date.now(),
        !navigator.onLine
      );
      next.issues.at(-1).snapshot.branding = getOrgSettings();
      if (!persist(next)) return;
      pushAudit({
        module: "Drone Operations",
        action: cloudRequired ? "submit-review" : "approve",
        detail: `${cloudRequired ? "Review awaiting cloud confirmation" : "Approved mission"} ${mission.title}, revision ${mission.revision}`,
      });
      setMessage(
        cloudRequired
          ? "Review saved locally and awaiting cloud confirmation. Verify the cloud copy before downloading an issued PDF."
          : "Approved snapshot saved. Download it from Issued packs."
      );
      setOnSite(false);
    } catch (e) {
      setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function saveSetup() {
    if (!mission.assetId || !mission.profileId || !mission.payloadId) {
      setError("Select an aircraft and compatible profile/payload first.");
      return;
    }
    const row = {
      id: droneId(),
      name: `${assessment.profile?.name} / ${assessment.payload?.name}`,
      regionCode,
      assetId: mission.assetId,
      payloadAssetId: mission.payloadAssetId,
      profileId: mission.profileId,
      payloadId: mission.payloadId,
      pilotId: mission.pilotId,
      useRtk: mission.useRtk,
      limits: mission.limits,
      updatedAt: new Date().toISOString(),
    };
    setSetups((rows) => [row, ...rows]);
    setMessage("Saved configuration. Serial, mass, class and inspection still require mission review.");
  }
  function saveManual(next, expected = null) {
    if (!canEdit || !alive.current || scope.current !== countryOperationalStorageKey("drone_missions"))
      throw new Error("Editing access or workspace changed. Reopen the manual.");
    const current = load("drone_manuals", []);
    let rows;
    try {
      rows = saveManualRows(current, next, expected);
    } catch (error) {
      // Refresh the stored version while the editor retains the rejected input.
      manualsRef.current = current;
      setManuals(current);
      throw error;
    }
    if (!save("drone_manuals", rows))
      throw new Error("Save failed. Your edits are still here; check storage space and editing access, then retry.");
    manualsRef.current = rows;
    setManuals(rows);
    return next;
  }
  const field = (key, label, type = "text", extra = {}) => (
    <Field label={label} value={mission[key]} onChange={(v) => patch({ [key]: v })} type={type} {...extra} />
  );
  const select = (key, label, items, handler) => (
    <Field label={label} value={mission[key]} onChange={handler || ((v) => patch({ [key]: v }))}>
      <option value="">Select…</option>
      {items}
    </Field>
  );
  const nav = (viewId) => openWorkspaceView({ viewId });
  return (
    <div className="drone-module">
      <PageHero
        badgeText={au ? "AIR" : "UAS"}
        title={au ? "Aerial Survey Operations" : "Drone Operations"}
        lead="Plan the survey. Resolve the checks. Brief the crew."
        suppressRegisterPdf
        right={
          canEdit && (
            <button className="drone-primary" onClick={create}>
              New mission
            </button>
          )
        }
      />
      <div className="drone-tabs" role="tablist" aria-label="Drone Operations workspace">
        {[
          ["missions", "Missions"],
          ["manuals", "Operations Manuals"],
          ["library", "Equipment & templates"],
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <D1ModuleSyncBanner
        d1Hydrating={sync.d1Hydrating || manualSync.d1Hydrating || setupSync.d1Hydrating || librarySync.d1Hydrating}
        d1OutboxPending={
          sync.d1OutboxPending || manualSync.d1OutboxPending || setupSync.d1OutboxPending || librarySync.d1OutboxPending
        }
        scopeLabel={au ? "Aerial Survey Operations" : "Drone Operations"}
      />
      {offline && (
        <p className="drone-error" role="status">
          Offline — cached records only. Airspace and weather need a fresh check before approval.
        </p>
      )}
      {error && (
        <div className="drone-error" role="alert">
          {error}
          <button onClick={() => setError("")} style={{ marginLeft: 12 }}>
            Dismiss
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {tab === "manuals" && (
        <DroneManuals
          key={`${regionCode}:${actor.id || "local"}`}
          manuals={manuals}
          regionCode={regionCode}
          onSave={saveManual}
          actor={actor}
          canEdit={canEdit}
          companySettings={getOrgSettings()}
          onExport={async (manual) => {
            try {
              const { downloadDroneManual } = await import("./dronePdf.js");
              await downloadDroneManual(manual, getOrgSettings());
            } catch (e) {
              setError(e.message);
            }
          }}
        />
      )}
      {tab === "library" && (
        <>
          <DroneLibraryEditor
            entries={library.filter((r) => regionOf(r) === regionCode)}
            onAdd={(entry) => setLibrary((rows) => [...rows, { ...entry, regionCode }])}
            payloads={PAYLOADS}
            actor={actor}
            canEdit={role === "admin" && canEdit}
          />
          <h2>Verified starter library</h2>
          <input
            aria-label="Search equipment library"
            placeholder="Search models or payloads"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
          />
          <p>
            Manufacturer model profiles are separate from your aircraft in Plant. Confirm applicable registration/class,
            serial, mass, firmware and configuration before each operation.
          </p>
          <div className="drone-library">
            {EQUIPMENT_PROFILES.filter((p) =>
              `${p.name} ${p.payloadIds.map((id) => PAYLOADS.find((x) => x.id === id)?.name).join(" ")}`
                .toLowerCase()
                .includes(librarySearch.toLowerCase())
            ).map((p) => (
              <article className="drone-card" key={p.id}>
                <span className="drone-catalog-tag">
                  {p.kind === "profile" ? "Organisation-reviewed profile" : "Manufacturer profile"} · {p.version}
                </span>
                <label>
                  <input
                    type="checkbox"
                    checked={compareProfiles.includes(p.id)}
                    onChange={(e) =>
                      setCompareProfiles((ids) =>
                        e.target.checked ? [...ids, p.id].slice(-3) : ids.filter((id) => id !== p.id)
                      )
                    }
                  />
                  Compare {p.name}
                </label>
                <h3>{p.name}</h3>
                <p>
                  <strong>Suitable for:</strong>{" "}
                  {p.payloadIds.map((id) => PAYLOADS.find((x) => x.id === id)?.name).join(", ")}
                </p>
                <p>
                  <strong>Required accessories:</strong> {p.required}
                </p>
                <p>
                  <strong>Limitations:</strong> {p.limitations}
                </p>
                <p>
                  <strong>Not supported:</strong> {p.notSupported}
                </p>
                <p className="drone-source">
                  <a href={p.source.url} target="_blank" rel="noreferrer">
                    Manufacturer source
                  </a>{" "}
                  · verified {p.source.verifiedOn}
                </p>
              </article>
            ))}
          </div>
          {compareProfiles.length > 1 && (
            <section className="drone-card">
              <h2>Compare equipment</h2>
              <div className="drone-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Compatible payloads</th>
                      <th>Required accessories</th>
                      <th>Limitations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EQUIPMENT_PROFILES.filter((p) => compareProfiles.includes(p.id)).map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.payloadIds.map((id) => PAYLOADS.find((x) => x.id === id)?.name).join(", ")}</td>
                        <td style={{ whiteSpace: "normal", minWidth: 200 }}>{p.required}</td>
                        <td style={{ whiteSpace: "normal", minWidth: 200 }}>{p.limitations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Compatibility does not establish mission suitability or permission to operate.</p>
            </section>
          )}
          <h2>Mission templates</h2>
          <div className="drone-library">
            {MISSION_TEMPLATES.map((t) => (
              <article key={t.id} className="drone-card">
                <h3>{t.name}</h3>
                <p>{t.deliverables}</p>
                <small>Checks required: {t.qa}</small>
              </article>
            ))}
          </div>
          <h2>Saved organisation setups</h2>
          {!setups.length && (
            <p>Save a configuration from a mission to reuse aircraft, payload, pilot and reviewed limits.</p>
          )}
          {[...setups]
            .sort(
              (a, b) =>
                Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) ||
                String(b.updatedAt).localeCompare(String(a.updatedAt))
            )
            .map((s) => (
              <div key={s.id} className="drone-evidence">
                <strong>{s.name}</strong>
                <p>
                  Saved {s.updatedAt}
                  {s.isDefault ? " · Default for new missions" : ""}
                </p>
                {canEdit && (
                  <div className="drone-actions">
                    <button
                      onClick={() =>
                        setSetups((rows) =>
                          rows.map((row) => (row.id === s.id ? { ...row, favourite: !row.favourite } : row))
                        )
                      }
                    >
                      {s.favourite ? "Remove favourite" : "Add favourite"}
                    </button>
                    <button
                      onClick={() =>
                        setSetups((rows) =>
                          rows.map((row) =>
                            regionOf(row) === regionCode ? { ...row, isDefault: row.id === s.id && !s.isDefault } : row
                          )
                        )
                      }
                    >
                      {s.isDefault ? "Clear default" : "Use as organisation default"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          <details>
            <summary>Library maintenance and source review</summary>
            <p>
              Profiles above are versioned manufacturer evidence. Organisation procedures are maintained in Operations
              Manuals; saved configurations are maintained through mission editing. New manufacturer profiles require
              source verification before inclusion.
            </p>
            <p>
              Rule sources are versioned {ruleVersion({ regionCode })}; they are review prompts, not an aviation
              authorisation.
            </p>
            {regionalSources({ regionCode }).map((s) => (
              <p key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>{" "}
                · {s.kind} · {s.verifiedOn}
              </p>
            ))}
          </details>
        </>
      )}
      {tab === "missions" && !mission && (
        <>
          {composing ? (
            <MissionComposer
              regionCode={regionCode}
              projects={registers.projects}
              templates={MISSION_TEMPLATES}
              missions={missions}
              canEdit={canEdit}
              onCreate={createPrepared}
              onCancel={() => setComposing(false)}
            />
          ) : (
            <section className="document-launch">
              <div>
                <h2>A clear path from project to paperwork.</h2>
                <p>Prepare the right sections, reuse project details and see exactly what still needs a review.</p>
              </div>
              <button className="drone-primary" disabled={!canEdit} onClick={() => setComposing(true)}>
                Prepare a mission
              </button>
            </section>
          )}
          {reminders.length > 0 && (
            <details className="drone-card">
              <summary>Expiry and recheck reminders · {reminders.length}</summary>
              <p>
                Current in-app reminders for stored evidence expiring within seven days. External sources are not
                monitored in the background.
              </p>
              {reminders.slice(0, 50).map((r) => (
                <div className="drone-evidence" key={r.id}>
                  <strong>
                    {r.title} · {r.kind.replaceAll("-", " ")}
                  </strong>
                  <p>
                    {r.expired ? "Expired — recheck required" : "Expires"} · {r.until}
                  </p>
                  <button
                    onClick={() => {
                      setSelected(r.missionId);
                      setSection(r.section);
                    }}
                  >
                    Review this check
                  </button>
                </div>
              ))}
            </details>
          )}
          <div className="drone-stats">
            <div>
              <strong>{missions.length}</strong>Missions
            </div>
            <div>
              <strong>{missions.filter((m) => m.approval).length}</strong>Reviewed records
            </div>
            <div>
              <strong>{missions.reduce((n, m) => n + (m.issues?.length || 0), 0)}</strong>Issued packs
            </div>
          </div>
          <div className="drone-toolbar">
            <h2>Survey missions</h2>
            <input
              aria-label="Search missions"
              placeholder="Search missions or locations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          </div>
          {!missions.length ? (
            <div className="drone-card drone-empty">
              <h2>{au ? "Prepare your first aerial survey" : "Prepare your first drone survey"}</h2>
              <p>
                Import a Google Earth boundary, choose your project, aircraft and pilot, then resolve checks before
                issuing a pre-flight pack.
              </p>
              {canEdit && (
                <button className="drone-primary" onClick={create}>
                  Create mission
                </button>
              )}
            </div>
          ) : (
            <div className="drone-list">
              {missions
                .filter(
                  (m) =>
                    !m.deletedAt &&
                    regionOf(m) === regionCode &&
                    `${m.title} ${m.location}`.toLowerCase().includes(search.toLowerCase())
                )
                .map((m) => {
                  const a = assessMission(m, context, assessedAt, offline);
                  return (
                    <article key={m.id} className="drone-list-row">
                      <div>
                        <h3>{m.title}</h3>
                        <p>
                          {m.location || "Location not set"} · {m.start || "Date not set"} · revision {m.revision}
                        </p>
                      </div>
                      <span className="drone-status" data-approved={displayStatus(m, a.status) === approvedStatus(m)}>
                        {displayStatus(m, a.status)}
                      </span>
                      <div className="drone-actions">
                        <button
                          onClick={() => {
                            setSelected(m.id);
                            setSection("overview");
                          }}
                        >
                          Open mission
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => {
                              const copy = copyMission(m);
                              if (persist(copy)) setSelected(copy.id);
                            }}
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </>
      )}
      {tab === "missions" && mission && (
        <>
          <div className="drone-toolbar">
            <div className="drone-actions">
              <button onClick={() => setSelected("")}>← All missions</button>
              <span
                className="drone-status"
                data-approved={displayStatus(mission, assessment.status) === approvedStatus(mission)}
              >
                {displayStatus(mission, assessment.status)}
              </span>
            </div>
            <output>
              {busy ? exportProgress || "Working…" : `Autosaved locally · revision ${mission.revision}`} ·{" "}
              {sync.d1Syncing ? "Syncing…" : sync.d1OutboxPending ? "Cloud sync pending" : ""}
            </output>
            {exportProgress && (
              <button
                type="button"
                disabled={exportProgress === "Cancelling export…"}
                onClick={() => {
                  exportCancelled.current = true;
                  setExportProgress("Cancelling export…");
                }}
              >
                Cancel export
              </button>
            )}
          </div>
          <MissionNextStep
            mission={mission}
            actions={assessment.actions}
            definitions={applicableChecklist(mission, context)}
            at={assessedAt}
            onNavigate={setSection}
            onExport={(kind) => exportPdf(null, kind)}
            busy={busy}
          />
          <div className="drone-tabs" role="tablist" aria-label="Mission sections">
            {[
              ["documents", "Prepare documents"],
              ["overview", "Mission & map"],
              ["setup", "Aircraft & crew"],
              ["checks", "Weather & checks"],
              ["checklist", "Briefing & checklist"],
              ["field", "Field mode"],
              ["review", "Review & PDF"],
            ].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)}>
                {label}
              </button>
            ))}
          </div>
          {section === "documents" && (
            <DocumentWorkbench
              key={`${mission.id}:${mission.aircraftKind}`}
              mission={mission}
              context={context}
              template={assessment.template}
              actor={actor}
              canEdit={canEdit}
              onPatch={patch}
              onSave={persist}
              onExport={(kind) => exportPdf(null, kind)}
              onNavigate={setSection}
              busy={busy}
              actions={assessment.actions}
            />
          )}
          {section === "field" && (
            <FieldWorkspace
              key={mission.id}
              mission={mission}
              actor={actor}
              assessment={assessment}
              definitions={applicableChecklist(mission, context)}
              at={assessedAt}
              canEdit={canEdit}
              busy={busy}
              offline={offline}
              onSave={persist}
              onNavigate={setSection}
              onExport={(kind) => exportPdf(null, kind)}
            />
          )}
          <div
            className="drone-grid"
            style={["documents", "field"].includes(section) ? { display: "none" } : undefined}
          >
            <div>
              {section === "overview" && (
                <>
                  <section className="drone-card">
                    <h2>Mission details</h2>
                    <fieldset disabled={!canEdit || busy}>
                      <div className="drone-fields">
                        {field("title", "Mission name")}
                        {select(
                          "projectId",
                          "Project",
                          registers.projects.map((p) => option(p.id, p.name)),
                          selectProject
                        )}
                        {field("client", "Client")}
                        {field("location", "Location description")}
                        {au &&
                          select(
                            "aircraftKind",
                            "Aircraft type",
                            [option("drone", "Drone / RPAS"), option("helicopter", "Crewed helicopter")],
                            (value) =>
                              patch({
                                aircraftKind: value,
                                category: "",
                                profileId: "",
                                payloadId: "",
                                pilotId: "",
                                assetId: "",
                                helicopter: {},
                              })
                          )}
                        {au &&
                          select(
                            "timeZone",
                            "Operation time zone",
                            AU_TIME_ZONES.map((z) => option(z, z))
                          )}
                        {field("start", `Start (${au ? "operation local time" : "Europe/London"})`, "datetime-local")}
                        {field("end", `End (${au ? "operation local time" : "Europe/London"})`, "datetime-local")}
                        {select(
                          "timeOccurrence",
                          "If a clock-change time occurs twice",
                          au
                            ? [option("earlier", "First occurrence"), option("later", "Second occurrence")]
                            : [option("BST", "First occurrence (BST)"), option("GMT", "Second occurrence (GMT)")]
                        )}
                        {field("postcode", "Approximate nearby postcode")}
                        {select(
                          "templateId",
                          "Survey type",
                          MISSION_TEMPLATES.map((t) => option(t.id, t.name)),
                          (id) => {
                            const t = MISSION_TEMPLATES.find((t) => t.id === id);
                            patch({
                              templateId: id,
                              ...preparationPatch(mission, projectSuggestions(mission, null, t), actor.name),
                            });
                          }
                        )}
                        {field("country", "Country / region")}
                      </div>
                    </fieldset>
                    <p className="drone-note">
                      Postcode is an approximate location, not a confirmed address or ownership evidence. The boundary
                      may span several postcodes.
                    </p>
                  </section>
                  <section className="drone-card">
                    <h2>Operating areas</h2>
                    <label>
                      Import survey boundary (KML, KMZ, GeoJSON)
                      <input
                        type="file"
                        accept=".kml,.kmz,.geojson,.json"
                        disabled={!canEdit || busy}
                        onChange={(e) => {
                          importFile(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p className="drone-note">
                      WGS84 · {summary.polygonCount} polygon(s) · {(summary.areaM2 / 10000).toFixed(2)} ha ·{" "}
                      {Math.round(summary.perimeterM)} m perimeter. Imported altitude values are retained; they do not
                      define flight height.
                    </p>
                    {!au && summary.centre && (
                      <button type="button" disabled={!canEdit || busy} onClick={findNearbyPostcode}>
                        Fill missing location from nearby postcode
                      </button>
                    )}
                    <DroneMap key={mission.id} mission={mission} onChange={patch} readOnly={!canEdit || busy} />
                    <LandingLocations mission={mission} onPatch={patch} disabled={!canEdit || busy} />
                    {summary.hasLines && (
                      <fieldset disabled={!canEdit}>
                        <div className="drone-fields">
                          {field("corridorWidthM", "Proposed corridor width (m)", "number")}
                          <label>
                            <input
                              type="checkbox"
                              checked={mission.corridorConfirmed}
                              onChange={(e) => patch({ corridorConfirmed: e.target.checked })}
                            />
                            I have confirmed the corridor width and will define the flight area.
                          </label>
                        </div>
                      </fieldset>
                    )}
                    <p className="drone-note">
                      Draw each area independently. Choosing a drawing layer replaces that layer only. Flight area,
                      contingency and safety zones depend on your authorisation and site assessment.
                    </p>
                  </section>
                </>
              )}
              {section === "setup" && helicopter && (
                <HelicopterSetup mission={mission} onChange={patch} registers={registers} canEdit={canEdit} />
              )}
              {section === "setup" && !helicopter && (
                <section className="drone-card">
                  <h2>Aircraft, payload and crew</h2>
                  <fieldset disabled={!canEdit}>
                    <div className="drone-fields">
                      <Field
                        label="Use saved setup"
                        value=""
                        onChange={(id) => {
                          const s = setups.find((s) => s.id === id);
                          if (s) {
                            patch(setupMissionDefaults(s));
                          }
                        }}
                      >
                        <option value="">Choose a saved configuration</option>
                        {setups.map((s) => option(s.id, s.name))}
                      </Field>
                      {select(
                        "assetId",
                        "Aircraft from Plant",
                        registers.assets.map((a) => option(a.id, `${a.assetRef || ""} ${a.description || ""}`))
                      )}
                      {select(
                        "profileId",
                        "Manufacturer model",
                        EQUIPMENT_PROFILES.map((p) => option(p.id, p.name)),
                        (id) => patch({ profileId: id, payloadId: "" })
                      )}
                      {select(
                        "payloadId",
                        "Compatible payload",
                        PAYLOADS.filter((p) => assessment.profile?.payloadIds.includes(p.id)).map((p) =>
                          option(p.id, p.name)
                        )
                      )}
                      {select(
                        "payloadAssetId",
                        "Payload asset (if separately registered)",
                        registers.assets.map((a) => option(a.id, `${a.assetRef || ""} ${a.description || ""}`))
                      )}
                      {select(
                        "pilotId",
                        "Remote pilot from People",
                        registers.workers.map((w) => option(w.id, w.name))
                      )}
                      {select(
                        "observerId",
                        "Airspace observer (if required)",
                        registers.workers.map((w) => option(w.id, w.name))
                      )}
                      {field(
                        "operatorId",
                        au
                          ? "Operator ARN and aircraft registration references"
                          : "Operator ID (do not enter Remote ID private key)"
                      )}
                      {field("massKg", "Actual take-off mass with payload (kg)", "number")}
                      {!au &&
                        select(
                          "classMark",
                          "Verified aircraft class / legacy status",
                          ["Legacy", "UK0", "UK1", "UK2", "UK3", "UK4", "UK5", "UK6", "Other — reviewed"].map((v) =>
                            option(v, v)
                          )
                        )}
                      {select(
                        "category",
                        "Operating pathway",
                        (au ? AU_PATHWAYS : UK_PATHWAYS).map((v) => option(v, v))
                      )}
                      {select(
                        "flightMode",
                        "Operating mode",
                        ["VLOS", "BVLOS — authorisation review required"].map((v) => option(v, v))
                      )}
                      {field("heightM", "Planned maximum height (m)", "number")}
                      {select(
                        "heightReference",
                        "Height reference",
                        ["AGL", "AMSL", "Above take-off — terrain review required"].map((v) => option(v, v))
                      )}
                      <label>
                        <input
                          type="checkbox"
                          checked={mission.useRtk}
                          onChange={(e) => patch({ useRtk: e.target.checked })}
                        />
                        RTK corrections will be used
                      </label>
                    </div>
                    {assessment.profile && (
                      <div className="drone-note">
                        <strong>Why this setup?</strong>
                        <p>
                          {assessment.payload?.capabilities?.join(", ") || "Select a payload to review capabilities."}
                        </p>
                        <p>{assessment.profile.required}</p>
                        <p>{assessment.profile.limitations}</p>
                        <p>Not supported: {assessment.profile.notSupported}</p>
                      </div>
                    )}
                    <button onClick={saveSetup} style={{ marginTop: 16 }}>
                      Save configuration
                    </button>
                  </fieldset>
                  <div className="drone-actions" style={{ marginTop: 18 }}>
                    <button onClick={() => nav("people")}>Open People</button>
                    <button onClick={() => nav("plant")}>Open Plant</button>
                    <button onClick={() => nav("documents")}>Open Document Library</button>
                  </div>
                </section>
              )}
              {section === "checks" && (
                <>
                  <DroneWeather
                    key={mission.id}
                    mission={mission}
                    onChange={patch}
                    canEdit={canEdit}
                    offline={offline}
                    onNavigate={setSection}
                    savedSetups={setups}
                  />
                  <DroneEvidence
                    key={mission.id}
                    mission={mission}
                    onSave={persist}
                    actor={actor}
                    documents={registers.documents}
                    canEdit={canEdit}
                  />
                </>
              )}
              {section === "checklist" && (
                <>
                  <section className="drone-card">
                    <h2>Survey, RAMS and emergency plan</h2>
                    <fieldset disabled={!canEdit}>
                      <div className="drone-fields">
                        {field("crs", "Survey coordinate reference system")}
                        {field("verticalDatum", "Height datum")}
                        {field("deliverables", "Agreed deliverables", "textarea", { wide: true })}
                        {field("qa", "QA plan and GCP / independent check points", "textarea", { wide: true })}
                        {field("emergency", "Emergency procedures and confirmed site contacts", "textarea", {
                          wide: true,
                        })}
                        {select(
                          "ramsId",
                          "Linked RAMS",
                          registers.rams.map((r) => option(r.id, r.title || r.name || r.ref || r.id))
                        )}
                        {select(
                          "manualId",
                          "Reviewed Operations Manual version",
                          manuals
                            .filter((m) => m.approvedAt && manualApplies(m, mission))
                            .map((m) => option(m.id, `${m.title} · ${m.version}`))
                        )}
                      </div>
                    </fieldset>
                    <div className="drone-actions" style={{ marginTop: 16 }}>
                      <button onClick={() => nav("rams")}>Open RAMS builder</button>
                      <button onClick={() => nav("permits")}>Open aerial survey permits</button>
                    </div>
                    <p className="drone-note">
                      Use the existing UAV hazards in RAMS. Map indications are not a complete site survey. Enter
                      mission-specific buffers, RTH and abort criteria in the reviewed procedures; the platform does not
                      invent them.
                    </p>
                  </section>
                  <section className="drone-card">
                    <h2>{helicopter ? "Survey team coordination checklist" : "Pilot checklist"}</h2>
                    <p>
                      Record physical checks only when performed. Planning and site checks are required for final
                      approval; flight and post-flight entries remain available for the operation record.
                    </p>
                    <fieldset disabled={!canEdit}>
                      {applicableChecklist(mission, context).map((item) => (
                        <div className="drone-check" key={item.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={mission.checklist?.[item.id]?.status === "done"}
                              onChange={(e) =>
                                persist({
                                  ...mission,
                                  approval: null,
                                  checklist: {
                                    ...mission.checklist,
                                    [item.id]: {
                                      ...mission.checklist?.[item.id],
                                      status: e.target.checked ? "done" : "pending",
                                      at: new Date().toISOString(),
                                      by: actor.name,
                                    },
                                  },
                                  updatedAt: new Date().toISOString(),
                                })
                              }
                            />
                            {item.stage} · {item.phase}
                          </label>
                          <small>
                            {item.text} · {item.role} · v{item.version}
                          </small>
                          {mission.checklist?.[item.id]?.at && (
                            <small>
                              {mission.checklist[item.id].at} · {mission.checklist[item.id].by}
                            </small>
                          )}
                          <details>
                            <summary>Note or evidence reference</summary>
                            <label>
                              {item.stage} note
                              <textarea
                                value={mission.checklist?.[item.id]?.note || ""}
                                onChange={(e) =>
                                  persist({
                                    ...mission,
                                    approval: null,
                                    checklist: {
                                      ...mission.checklist,
                                      [item.id]: { ...mission.checklist?.[item.id], note: e.target.value },
                                    },
                                    updatedAt: new Date().toISOString(),
                                  })
                                }
                              />
                            </label>
                          </details>
                        </div>
                      ))}
                    </fieldset>
                  </section>
                </>
              )}
              {section === "review" && helicopter && (
                <OperatorRelease
                  key={`${mission.id}:${mission.revision}`}
                  mission={mission}
                  onSave={persist}
                  canEdit={canEdit}
                />
              )}
              {section === "review" && (
                <section className="drone-card">
                  <h2>Review and issue the pre-flight pack</h2>
                  <p>
                    {helicopter
                      ? "The pack records survey coordination review. Flight release, airworthiness and flight decisions remain with the aviation operator and pilot in command."
                      : "The pack records evidence and an accountable review. It does not grant permission to fly or certify regulatory compliance."}
                  </p>
                  {registerError && <p className="drone-error">{registerError}</p>}
                  <p>
                    {assessment.actions.length} unresolved action(s). {mission.issues.length} immutable issued
                    snapshot(s).
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={onSite}
                      disabled={!canEdit}
                      onChange={(e) => setOnSite(e.target.checked)}
                    />
                    I am the responsible person and have checked current conditions on site.
                  </label>
                  <p>
                    Responsible person: <strong>{actor.name}</strong> · {role}
                  </p>
                  <div className="drone-actions">
                    <button onClick={() => exportPdf()} disabled={busy}>
                      Download draft PDF
                    </button>
                    <button
                      className="drone-primary"
                      disabled={
                        !canEdit ||
                        busy ||
                        !onSite ||
                        offline ||
                        assessment.actions.length > 0 ||
                        sync.d1Hydrating ||
                        sync.d1OutboxPending
                      }
                      onClick={approve}
                    >
                      {helicopter ? "Review coordination and issue snapshot" : "Approve and issue snapshot"}
                    </button>
                  </div>
                  <h3 style={{ marginTop: 24 }}>Issued packs</h3>
                  {mission.issues.map((i) => (
                    <div className="drone-evidence" key={i.id}>
                      <strong>
                        Revision {i.revision} · {i.issuedAt}
                      </strong>
                      <p>
                        {issueConfirmed(i) ? "Approved by" : "Local review pending cloud confirmation:"}{" "}
                        {i.snapshot.approval?.name}
                      </p>
                      <button disabled={busy} onClick={() => exportPdf(i)}>
                        {cloudRequired ? "Verify and download issued PDF" : "Download issued PDF"}
                      </button>
                    </div>
                  ))}
                  <details>
                    <summary>Change history</summary>
                    {mission.history.map((h, i) => (
                      <p key={i}>
                        <small>
                          {h.at} · {h.actor} · {h.action}
                        </small>
                      </p>
                    ))}
                  </details>
                  {canEdit && (
                    <button style={{ marginTop: 18 }} onClick={() => patch({ cancelled: !mission.cancelled })}>
                      {mission.cancelled ? "Reopen as draft" : "Cancel mission"}
                    </button>
                  )}
                </section>
              )}
            </div>
            <aside className="drone-card drone-aside">
              <h2>Next actions</h2>
              <small>
                Derived from the current mission and evidence. Last evaluated{" "}
                {new Date(now).toLocaleTimeString("en-GB", { timeZone: zone })} ({zone}).
              </small>
              <ul className="drone-next">
                {assessment.actions.map((a, i) => (
                  <li key={`${a.key}-${i}`}>
                    {a.text}
                    <button
                      type="button"
                      className="drone-action-link"
                      onClick={() => setSection(actionSection(a.key))}
                    >
                      Review
                    </button>
                  </li>
                ))}
              </ul>
              {!assessment.actions.length && (
                <p>Ready for the responsible person’s review. Recheck changing conditions before flight.</p>
              )}
              <p className="drone-note">
                Automatic checks do not replace the pilot’s judgement, operator procedures or applicable aviation
                permissions.
              </p>
            </aside>
          </div>
        </>
      )}
      {mapImport && (
        <BoundaryImportDialog
          review={mapImport}
          mission={mission}
          busy={busy}
          onClose={() => setMapImport(null)}
          onConfirm={confirmMapImport}
        />
      )}
      {exportReview && (
        <ExportReviewDialog
          review={exportReview}
          busy={busy}
          onClose={() => setExportReview(null)}
          onConfirm={confirmDraftExport}
          onFix={(target) => {
            setExportReview(null);
            setSection(target);
          }}
        />
      )}
    </div>
  );
}
