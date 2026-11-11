import { useState, useEffect, useCallback, useRef } from "react";
import { isR2StorageConfigured, uploadFileToR2Storage, pickR2ViewUrl, fetchR2ObjectBlob } from "../lib/r2Storage";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { safeHttpUrl } from "../utils/safeUrl";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { syncOrgSlugIfNeeded } from "../utils/orgMembership";
import { getOrgId, loadOrgScoped, saveOrgScoped, countryOperationalStorageKey, ORG_CHANGED_EVENT } from "../utils/orgStorage";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import PageHero from "../components/PageHero";
import { useWorkspaceT } from "../i18n/useWorkspaceT";
import { compressImageFile, isHeicLikeFile, jpegFileFromDataUrl } from "../utils/geoPhotoUtils";

import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { isD1Configured } from "../lib/d1SyncClient";
import { replaceWithTombstone } from "../utils/d1ArrayMerge";
import { COUNTRY_WORKSPACE_CHANGED_EVENT } from "../utils/countryWorkspaces";
import { useToast } from "../context/ToastContext";

const DOC_META_KEY = "mysafeops_doc_library";
const R2_UPLOADS_KEY = "mysafeops_r2_uploads";

function normaliseUploads(list) {
  if (!Array.isArray(list)) return [];
  return list.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const key = typeof row.key === "string" ? row.key : "";
    const id = typeof row.id === "string" && row.id ? row.id : key;
    if (!id || (!key && !row.deletedAt)) return [];
    return [{ ...row, id, key, name: typeof row.name === "string" && row.name ? row.name : key.split("/").pop() || "" }];
  });
}
const loadR2Uploads = () => normaliseUploads(loadOrgScoped(R2_UPLOADS_KEY, []));
const saveR2Uploads = (list) => saveOrgScoped(R2_UPLOADS_KEY, list);

const loadMeta = () => {
  const meta = loadOrgScoped(DOC_META_KEY, {});
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
};
const saveMeta = (m) => saveOrgScoped(DOC_META_KEY, m);

function readPendingEntries(scope) {
  try {
    const rows = JSON.parse(sessionStorage.getItem(`${scope}:pending`));
    const saved = new Set(loadR2Uploads().map((row) => row.id));
    return normaliseUploads(rows).filter((row) => !row.deletedAt && !saved.has(row.id));
  } catch { return []; }
}

function persistPendingEntries(scope, rows) {
  try {
    if (rows.length) sessionStorage.setItem(`${scope}:pending`, JSON.stringify(rows));
    else sessionStorage.removeItem(`${scope}:pending`);
  } catch { /* The visible recovery list still permits retrying on this page. */ }
}

const ss = ms;
const FILE_LIST_PAGE = 120;
const R2_LIST_PAGE = 60;
const R2_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.kml,.kmz";
const R2_ALLOWED_EXT = /\.(pdf|png|jpe?g|gif|webp|hei[cf]|docx?|xlsx?|csv|txt|zip|kml|kmz)$/i;

async function readDirRecursive(dirHandle, basePath = "") {
  const out = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const path = basePath ? `${basePath}/${name}` : name;
    if (handle.kind === "file") {
      out.push({ name, path, handle });
    } else if (handle.kind === "directory") {
      const nested = await readDirRecursive(handle, path);
      out.push(...nested);
    }
  }
  return out;
}

export default function DocumentLibrary() {
  const { t } = useWorkspaceT();
  const { pushToast } = useToast();
  const { supabase } = useSupabaseAuth();
  const [supported] = useState(() => typeof window !== "undefined" && "showDirectoryPicker" in window);
  const [dirName, setDirName] = useState(() => loadMeta().dirName || "");
  const [files, setFiles] = useState([]);
  const [meta, setMeta] = useState(loadMeta);
  const [pickError, setPickError] = useState(null);
  const [pendingMeta, setPendingMeta] = useState(false);
  const [selectedPath, setSelectedPath] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [r2Uploads, setR2Uploads] = useState(loadR2Uploads);
  const [r2Busy, setR2Busy] = useState(false);
  const [r2Msg, setR2Msg] = useState("");
  const r2InputRef = useRef(null);
  const uploadBusyRef = useRef(false);
  const workspaceRequestRef = useRef(0);
  const previewRequestRef = useRef(0);
  const folderRequestRef = useRef(0);
  const cloudRequestRef = useRef(0);
  const [cloudFile, setCloudFile] = useState(null);
  const [openingKey, setOpeningKey] = useState("");
  const [openError, setOpenError] = useState("");
  const pendingEntriesRef = useRef(new Map());
  const [pendingEntries, setPendingEntries] = useState(() => readPendingEntries(countryOperationalStorageKey(R2_UPLOADS_KEY)));
  const downloadDialogRef = useRef(null);
  const r2Enabled = isR2StorageConfigured();
  const fileListPg = useRegisterListPaging(FILE_LIST_PAGE);
  const r2ListPg = useRegisterListPaging(R2_LIST_PAGE);

  const setUploadsFromSync = useCallback((value) => setR2Uploads((previous) => normaliseUploads(typeof value === "function" ? value(previous) : value)), []);
  const { d1Hydrating, d1OutboxPending } = useD1OrgArraySync({
    storageKey: R2_UPLOADS_KEY,
    namespace: R2_UPLOADS_KEY,
    value: r2Uploads,
    setValue: setUploadsFromSync,
    load: loadR2Uploads,
    save: (_key, rows) => saveR2Uploads(normaliseUploads(rows)),
  });
  const visibleUploads = r2Uploads.filter((row) => !row.deletedAt);

  const resetFileList = fileListPg.reset;
  useEffect(() => { resetFileList(); }, [dirName, resetFileList]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const resetWorkspace = () => {
      workspaceRequestRef.current += 1;
      folderRequestRef.current += 1;
      previewRequestRef.current += 1;
      cloudRequestRef.current += 1;
      const interrupted = uploadBusyRef.current;
      uploadBusyRef.current = false;
      setR2Busy(false);
      setR2Msg(interrupted ? "Workspace changed. Choose your files again for this workspace." : "");
      setR2Uploads(loadR2Uploads());
      const nextMeta = loadMeta();
      setMeta(nextMeta);
      setDirName(nextMeta.dirName || "");
      setFiles([]);
      setSelectedPath(null);
      setPreviewUrl(null);
      setCloudFile(null);
      setOpeningKey("");
      setOpenError("");
      setPickError(null);
      setPendingMeta(false);
      const scope = countryOperationalStorageKey(R2_UPLOADS_KEY);
      setPendingEntries(pendingEntriesRef.current.get(scope) || readPendingEntries(scope));
    };
    window.addEventListener(ORG_CHANGED_EVENT, resetWorkspace);
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, resetWorkspace);
    return () => {
      workspaceRequestRef.current += 1;
      window.removeEventListener(ORG_CHANGED_EVENT, resetWorkspace);
      window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, resetWorkspace);
    };
  }, []);

  useEffect(() => () => { if (cloudFile?.url) URL.revokeObjectURL(cloudFile.url); }, [cloudFile]);

  useEffect(() => {
    if (!cloudFile) return;
    const previousFocus = document.activeElement;
    downloadDialogRef.current?.querySelector("a")?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") { cloudRequestRef.current += 1; setCloudFile(null); }
      if (event.key === "Tab") {
        const controls = downloadDialogRef.current?.querySelectorAll("a, button");
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [cloudFile]);

  const pickFolder = useCallback(async () => {
    const requestId = ++folderRequestRef.current;
    const workspace = workspaceRequestRef.current;
    const scope = countryOperationalStorageKey(DOC_META_KEY);
    const current = () => requestId === folderRequestRef.current && workspace === workspaceRequestRef.current && scope === countryOperationalStorageKey(DOC_META_KEY);
    setPickError(null);
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      if (!current()) return;
      const list = await readDirRecursive(handle);
      if (!current()) return;
      const m = { ...loadMeta(), dirName: handle.name, pickedAt: new Date().toISOString() };
      const saved = saveMeta(m);
      setPendingMeta(!saved);
      if (!saved) setPickError("Folder details could not be saved. Keep this page open and retry saving details.");
      previewRequestRef.current += 1;
      setDirName(handle.name);
      setFiles(list);
      setMeta(m);
      setSelectedPath(null);
      setPreviewUrl(null);
    } catch (e) {
      if (current() && e?.name !== "AbortError") setPickError(e?.message || "Could not open folder");
    }
  }, []);

  const updateMetaDraft = (m) => {
    setMeta(m);
    const saved = saveMeta(m);
    setPendingMeta(!saved);
    setPickError(saved ? null : "Your edits could not be saved. They are still here; keep this page open and retry saving details.");
  };

  const setNote = (path, note) => updateMetaDraft({ ...meta, notes: { ...(meta.notes || {}), [path]: note } });
  const setTags = (path, tags) => updateMetaDraft({ ...meta, tags: { ...(meta.tags || {}), [path]: tags } });

  const onR2Files = async (e) => {
    // FileList is live: clearing the input also clears its files on Safari/Chromium.
    const fl = Array.from(e.target.files || []);
    e.target.value = "";
    if (!fl.length || !r2Enabled || uploadBusyRef.current) return;
    const workspace = workspaceRequestRef.current;
    const scope = countryOperationalStorageKey(R2_UPLOADS_KEY);
    const current = () => workspace === workspaceRequestRef.current && scope === countryOperationalStorageKey(R2_UPLOADS_KEY);
    uploadBusyRef.current = true;
    setR2Msg("");
    setR2Busy(true);
    let uploadedCount = 0;
    let linkedCount = 0;
    const failures = [];
    let orgIdForPath = getOrgId();
    if (isSupabaseConfigured() && supabase) {
      try {
        orgIdForPath = await syncOrgSlugIfNeeded(supabase);
      } catch {
        /* keep getOrgId() */
      }
    }
    try {
      for (let i = 0; i < fl.length; i++) {
        if (!current()) return;
        const file = fl[i];
        try {
        const heic = isHeicLikeFile(file) || /\.hei[cf]$/i.test(file.name || "");
        if (!heic && !R2_ALLOWED_EXT.test(file.name || "")) {
          failures.push(`${file.name || "file"}: type not allowed`);
          continue;
        }
        let toUpload = file;
        if (heic) {
          const dataUrl = await compressImageFile(file);
          toUpload = jpegFileFromDataUrl(dataUrl, file.name);
        }
        if (!current()) return;
        const result = await uploadFileToR2Storage(toUpload, { orgId: orgIdForPath, subPath: "documents" });
        if (!current()) return;
        uploadedCount += 1;
        const row = {
          id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
          name: toUpload.name || file.name,
          key: result.key,
          size: result.size,
          publicUrl: result.publicUrl,
          signedUrl: result.signedUrl || null,
          signedExpiresAt: result.signedExpiresAt || null,
          uploadedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const next = [row, ...loadR2Uploads()];
        if (!saveR2Uploads(next)) {
          const waiting = [...(pendingEntriesRef.current.get(scope) || readPendingEntries(scope)), row];
          pendingEntriesRef.current.set(scope, waiting);
          persistPendingEntries(scope, waiting);
          setPendingEntries(waiting);
          throw new Error("File uploaded, but its library entry could not be saved. Use Retry saving entries below.");
        }
        setR2Uploads(next);
        pushAudit({ action: "r2_upload", entity: "document", detail: result.key });
        linkedCount += 1;
        } catch (err) {
          failures.push(`${file.name || "file"}: ${err?.message || "Upload failed"}`);
        }
      }
      if (!current()) return;
      setR2Msg(`${uploadedCount} file(s) uploaded to cloud storage.${linkedCount < uploadedCount ? ` ${linkedCount} added to the library; ${uploadedCount - linkedCount} waiting for library save.` : ""}${failures.length ? ` ${failures.join("; ")}.` : ""}`);
      if (uploadedCount > 0 && failures.length === 0 && linkedCount === uploadedCount) {
        pushToast({
          type: "success",
          title: "Upload complete",
          message: `${uploadedCount} file(s) added to the document library.`,
        });
      }
    } catch (err) {
      if (current()) setR2Msg(err.message || "Upload failed");
    } finally {
      if (current()) { uploadBusyRef.current = false; setR2Busy(false); }
    }
  };

  const retryLibraryEntries = () => {
    const scope = countryOperationalStorageKey(R2_UPLOADS_KEY);
    const waiting = pendingEntriesRef.current.get(scope) || readPendingEntries(scope);
    const ids = new Set(waiting.map((row) => row.id));
    const next = [...waiting, ...loadR2Uploads().filter((row) => !ids.has(row.id))];
    if (!saveR2Uploads(next)) { setR2Msg("Library entries still could not be saved. Keep this page open and try again after checking device storage."); return; }
    pendingEntriesRef.current.set(scope, []);
    persistPendingEntries(scope, []);
    setPendingEntries([]);
    setR2Uploads(next);
    for (const row of waiting) pushAudit({ action: "r2_upload", entity: "document", detail: row.key });
    setR2Msg(`${waiting.length} uploaded file(s) added to the library. No files were uploaded again.`);
    pushToast({
      type: "success",
      title: "Library updated",
      message: `${waiting.length} uploaded file(s) added to the library.`,
    });
  };

  const removeR2Row = (id) => {
    if (!confirm("Remove this entry from the list? The file may still exist in cloud storage.")) return;
    const next = replaceWithTombstone(loadR2Uploads(), id);
    if (!saveR2Uploads(next)) { setR2Msg("The entry could not be removed. Check available device storage and try again."); return; }
    setR2Uploads(next);
  };

  const openCloudFile = async (entry) => {
    previewRequestRef.current += 1;
    const requestId = ++cloudRequestRef.current;
    const workspace = workspaceRequestRef.current;
    const scope = countryOperationalStorageKey(R2_UPLOADS_KEY);
    const current = () => requestId === cloudRequestRef.current && workspace === workspaceRequestRef.current && scope === countryOperationalStorageKey(R2_UPLOADS_KEY);
    setOpenError("");
    setCloudFile(null);
    setOpeningKey(entry.key);
    try {
      const blob = await fetchR2ObjectBlob(entry.key);
      if (!current()) return;
      if (!blob?.size) throw new Error("The downloaded file is empty. Please try again.");
      setCloudFile({ name: entry.name, url: URL.createObjectURL(blob) });
    } catch (error) {
      if (current()) setOpenError(`${entry.name}: ${error?.message || "Could not open file. Try again."}`);
    } finally { if (current()) setOpeningKey(""); }
  };

  const openPreview = async (entry) => {
    cloudRequestRef.current += 1;
    setCloudFile(null);
    setOpeningKey("");
    const requestId = ++previewRequestRef.current;
    const workspace = workspaceRequestRef.current;
    const scope = countryOperationalStorageKey(DOC_META_KEY);
    setPreviewUrl(null);
    setPickError(null);
    setSelectedPath(entry.path);
    try {
      const file = await entry.handle.getFile();
      if (requestId !== previewRequestRef.current || workspace !== workspaceRequestRef.current || scope !== countryOperationalStorageKey(DOC_META_KEY)) return;
      const type = file.type || "";
      const lower = entry.name.toLowerCase();
      if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|pdf)$/i.test(lower) || type === "application/pdf") {
        setPreviewUrl(URL.createObjectURL(file));
        return;
      }
      setCloudFile({ name: entry.name, url: URL.createObjectURL(file) });
    } catch (error) {
      if (requestId === previewRequestRef.current && workspace === workspaceRequestRef.current) setPickError(error?.message || "Could not open file. Choose the folder again.");
    }
  };

  const cloudPanel = (
    <>
      {r2Enabled ? <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Cloud documents ({visibleUploads.length})</div>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>Upload documents from your phone or computer. Files stay linked to this workspace.</p>
        <input ref={r2InputRef} type="file" multiple accept={R2_ACCEPT} style={{ display: "none" }} onChange={onR2Files} />
        <button type="button" style={{ ...ss.btnP, minHeight: 44 }} disabled={r2Busy} onClick={() => r2InputRef.current?.click()}>
          {r2Busy ? "Uploading\u2026" : "Upload to cloud"}
        </button>
        {r2Msg ? <p role="status" style={{ marginTop: 10, fontSize: 13 }}>{r2Msg}</p> : null}
        {pendingEntries.length ? <div role="alert" style={{ marginTop: 12 }}>
          <p>{pendingEntries.length} uploaded file(s) need their library entries saved. Keep this page open until they are saved.</p>
          <button type="button" style={{ ...ss.btn, minHeight: 44 }} disabled={r2Busy} onClick={retryLibraryEntries}>Retry saving entries</button>
        </div> : null}
        {openError ? <p role="alert">{openError}</p> : null}
        {isD1Configured() && d1Hydrating ? <p role="status">Loading the shared document library\u2026</p> : null}
        {isD1Configured() && d1OutboxPending ? <p role="status">Library changes are saved on this device and waiting to sync.</p> : null}
        {!visibleUploads.length ? <p style={{ fontSize: 13 }}>No cloud documents yet. Upload a PDF, photo or site document to get started.</p> : null}
        <div style={{ marginTop: 14, maxHeight: 320, overflow: "auto" }}>
          {r2ListPg.visible(visibleUploads).map((entry) => {
            const view = safeHttpUrl(pickR2ViewUrl(entry) || "");
            return <div key={entry.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border-tertiary,#e5e5e5)", overflowWrap: "anywhere" }}>
              <strong>{entry.name}</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                <button type="button" style={{ ...ss.btn, minHeight: 44 }} disabled={openingKey === entry.key} onClick={() => openCloudFile(entry)}>
                  {openingKey === entry.key ? "Opening\u2026" : "Open file"}
                </button>
                {view ? <a href={view} target="_blank" rel="noopener noreferrer" style={{ ...ss.btn, minHeight: 44, display: "inline-flex", alignItems: "center" }}>Open link</a> : null}
                <button type="button" style={{ ...ss.btn, minHeight: 44 }} onClick={() => removeR2Row(entry.id)}>Remove from list</button>
              </div>
            </div>;
          })}
          {r2ListPg.hasMore(visibleUploads) ? <button type="button" style={{ ...ss.btn, minHeight: 44 }} onClick={r2ListPg.showMore}>Show more uploads ({r2ListPg.remaining(visibleUploads)} remaining)</button> : null}
        </div>
      </div> : <p>Cloud storage is not configured for this workspace.</p>}
      {cloudFile ? <div ref={downloadDialogRef} role="dialog" aria-modal="true" aria-labelledby="document-file-title" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ ...ss.card, maxWidth: 480, width: "100%", overflowWrap: "anywhere" }}>
          <h2 id="document-file-title">{cloudFile.name}</h2>
          <p>Your file is ready. Download it to open or share it on this device.</p>
          <a href={cloudFile.url} download={cloudFile.name} style={{ ...ss.btnP, minHeight: 44, display: "inline-flex", alignItems: "center" }}>Download file</a>
          <button type="button" style={{ ...ss.btn, minHeight: 44, marginLeft: 8 }} onClick={() => { cloudRequestRef.current += 1; setCloudFile(null); }}>Close</button>
        </div>
      </div> : null}
    </>
  );

  if (!supported) {
    return <div style={{ padding: "1.25rem 0", maxWidth: 900, margin: "0 auto" }}>
      <PageHero badgeText="DOC" title="Document library" lead="Keep your site documents together and download them when needed." />
      {cloudPanel}
      <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Folder browsing is unavailable on this device. Use cloud upload to add documents.</p>
    </div>;
  }

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, maxWidth: 900, margin: "0 auto" }}>
      <PageHero
        badgeText="DOC"
        title="Document library"
        lead="Browse files on this device and optionally upload copies to cloud storage. Tags and notes are saved per organisation."
        right={
          <button type="button" style={ss.btnP} onClick={pickFolder}>
            {dirName ? "Change folder" : "Choose folder"}
          </button>
        }
      />
      {cloudPanel}
      {pickError && <p role="alert" style={{ color: "#b91c1c", marginBottom: 12 }}>{pickError}</p>}
      {pendingMeta ? <button type="button" style={{ ...ss.btn, marginBottom: 12 }} onClick={() => updateMetaDraft(meta)}>Retry saving details</button> : null}
      {dirName && (
        <div style={{ ...ss.card, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Current folder</div>
          <div style={{ fontWeight: 600 }}>{dirName}</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 16 }}>
        <div style={ss.card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Files ({files.length}
            {fileListPg.hasMore(files) ? ` · showing ${Math.min(fileListPg.cap, files.length)}` : ""})
          </div>
          <div style={{ maxHeight: 360, overflow: "auto" }}>
            {files.length === 0 && <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Choose a folder to list documents.</div>}
            {fileListPg.visible(files).map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => openPreview(f)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 6px",
                  border: "none",
                  borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                  background: selectedPath === f.path ? "var(--color-background-secondary,#f4f4f5)" : "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "DM Sans,sans-serif",
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 36px",
                }}
              >
                {f.path}
              </button>
            ))}
            {fileListPg.hasMore(files) ? (
              <div style={{ marginTop: 10, textAlign: "center" }}>
                <button type="button" style={ss.btn} onClick={fileListPg.showMore}>
                  Show more files ({fileListPg.remaining(files)} remaining)
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div style={ss.card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Details</div>
          {!selectedPath && <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Select a file.</div>}
          {selectedPath && (
            <>
              <label style={ss.lbl} htmlFor="document-library-tags-comma-separated">Tags (comma-separated)</label>
              <input
                style={ss.inp}
                value={(meta.tags && meta.tags[selectedPath]) || ""}
                onChange={(e) => setTags(selectedPath, e.target.value)}
                placeholder="e.g. RAMS, handover"
               id="document-library-tags-comma-separated" />
              <label style={{ ...ss.lbl, marginTop: 12 }} htmlFor="document-library-notes">{t("notes")}</label>
              <textarea
                style={{ ...ss.inp, minHeight: 80, resize: "vertical" }}
                value={(meta.notes && meta.notes[selectedPath]) || ""}
                onChange={(e) => setNote(selectedPath, e.target.value)}
               id="document-library-notes" />
              {previewUrl && (selectedPath.toLowerCase().endsWith(".pdf") ? (
                <iframe title="preview" src={previewUrl} style={{ width: "100%", height: 280, border: "0.5px solid #ccc", borderRadius: 6, marginTop: 12 }} />
              ) : (
                <img alt="" src={previewUrl} loading="lazy" decoding="async" style={{ maxWidth: "100%", maxHeight: 240, marginTop: 12, objectFit: "contain" }} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
