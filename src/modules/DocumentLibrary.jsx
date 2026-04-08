import { useState, useEffect, useCallback, useRef } from "react";
import { isR2StorageConfigured, uploadFileToR2Storage } from "../lib/r2Storage";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { safeHttpUrl } from "../utils/safeUrl";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { syncOrgSlugIfNeeded } from "../utils/orgMembership";
import { getOrgId, loadOrgScoped, saveOrgScoped, orgScopedKey } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const DOC_META_KEY = "mysafeops_doc_library";
const R2_UPLOADS_KEY = "mysafeops_r2_uploads";

const loadR2Uploads = () => {
  const list = loadOrgScoped(R2_UPLOADS_KEY, []);
  return Array.isArray(list) ? list : [];
};
const saveR2Uploads = (list) => saveOrgScoped(R2_UPLOADS_KEY, list);

const loadMeta = () => loadOrgScoped(DOC_META_KEY, {});
const saveMeta = (m) => saveOrgScoped(DOC_META_KEY, m);

const ss = ms;

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
  const { supabase } = useSupabaseAuth();
  const [supported] = useState(() => typeof window !== "undefined" && "showDirectoryPicker" in window);
  const [dirName, setDirName] = useState(() => loadMeta().dirName || "");
  const [files, setFiles] = useState([]);
  const [meta, setMeta] = useState(loadMeta);
  const [pickError, setPickError] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [r2Uploads, setR2Uploads] = useState(loadR2Uploads);
  const [r2Busy, setR2Busy] = useState(false);
  const [r2Msg, setR2Msg] = useState("");
  const r2InputRef = useRef(null);
  const r2Enabled = isR2StorageConfigured();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickFolder = useCallback(async () => {
    setPickError(null);
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      setDirName(handle.name);
      const list = await readDirRecursive(handle);
      setFiles(list);
      const m = { ...loadMeta(), dirName: handle.name, pickedAt: new Date().toISOString() };
      saveMeta(m);
      setMeta(m);
      setSelectedPath(null);
    } catch (e) {
      if (e?.name !== "AbortError") setPickError(e?.message || "Could not open folder");
    }
  }, []);

  const setNote = (path, note) => {
    const notes = { ...(meta.notes || {}), [path]: note };
    const m = { ...meta, notes };
    saveMeta(m);
    setMeta(m);
  };

  const setTags = (path, tagsStr) => {
    const tags = { ...(meta.tags || {}), [path]: tagsStr };
    const m = { ...meta, tags };
    saveMeta(m);
    setMeta(m);
  };

  const onR2Files = async (e) => {
    const fl = e.target.files;
    e.target.value = "";
    if (!fl?.length || !r2Enabled) return;
    setR2Msg("");
    setR2Busy(true);
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
        const file = fl[i];
        const result = await uploadFileToR2Storage(file, { orgId: orgIdForPath, subPath: "documents" });
        const row = {
          id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          key: result.key,
          size: result.size,
          publicUrl: result.publicUrl,
          uploadedAt: new Date().toISOString(),
        };
        setR2Uploads((prev) => {
          const next = [row, ...prev];
          saveR2Uploads(next);
          return next;
        });
        pushAudit({ action: "r2_upload", entity: "document", detail: result.key });
      }
      setR2Msg(`${fl.length} file(s) uploaded to Cloudflare R2.`);
    } catch (err) {
      setR2Msg(err.message || "Upload failed");
    } finally {
      setR2Busy(false);
    }
  };

  const removeR2Row = (id) => {
    if (!confirm("Remove this entry from the list? (The object may still exist in R2.)")) return;
    setR2Uploads((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveR2Uploads(next);
      return next;
    });
  };

  const openPreview = async (entry) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedPath(entry.path);
    const file = await entry.handle.getFile();
    const type = file.type || "";
    const lower = entry.name.toLowerCase();
    if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(lower)) {
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }
    if (type === "application/pdf" || lower.endsWith(".pdf")) {
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = entry.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!supported) {
    return (
      <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, maxWidth: 900, margin: "0 auto" }}>
        <PageHero
          badgeText="DOC"
          title="Document library"
          lead="The local folder view needs the File System Access API (Chrome or Edge 86+). R2 upload may still work below."
        />
        <div style={ss.card}>
          <p style={{ margin: 0 }}>The local folder view needs the File System Access API (Chrome or Edge 86+). It is not available in this browser.</p>
        </div>
        {r2Enabled && (
          <div style={{ ...ss.card, marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Cloudflare R2 upload</div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>You can still upload files to R2 from this browser.</p>
            <input ref={r2InputRef} type="file" multiple style={{ display: "none" }} onChange={onR2Files} />
            <button type="button" style={ss.btnP} disabled={r2Busy} onClick={() => r2InputRef.current?.click()}>
              {r2Busy ? "Uploading…" : "Upload to R2"}
            </button>
            {r2Msg && <p style={{ marginTop: 10, fontSize: 13 }}>{r2Msg}</p>}
            {r2Uploads.length > 0 && (
              <div style={{ marginTop: 14, maxHeight: 240, overflow: "auto" }}>
                {r2Uploads.map((u) => (
                  <div key={u.id} style={{ fontSize: 12, padding: "8px 0", borderBottom: "0.5px solid #e5e5e5" }}>
                    <strong>{u.name}</strong>
                    <div style={{ wordBreak: "break-all", color: "var(--color-text-secondary)" }}>{u.key}</div>
                    {u.publicUrl && (() => {
                      const pub = safeHttpUrl(u.publicUrl);
                      return pub ? (
                        <a href={pub} target="_blank" rel="noopener noreferrer" style={{ color: "#0d9488" }}>
                          Open link
                        </a>
                      ) : (
                        <span style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>Invalid link URL</span>
                      );
                    })()}
                    <button type="button" style={{ ...ss.btn, fontSize: 12, marginTop: 6 }} onClick={() => removeR2Row(u.id)}>
                      Remove from list
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, maxWidth: 900, margin: "0 auto" }}>
      <PageHero
        badgeText="DOC"
        title="Document library"
        lead={
          <>
            Local folder view: files stay on your device unless you use cloud upload below. Tags and notes use key{" "}
            <code style={{ fontSize: 12 }}>{orgScopedKey(DOC_META_KEY)}</code>.
          </>
        }
        right={
          <button type="button" style={ss.btnP} onClick={pickFolder}>
            {dirName ? "Change folder" : "Choose folder"}
          </button>
        }
      />
      {r2Enabled && (
        <div style={{ ...ss.card, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Cloudflare R2 upload</div>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
            Objects are stored in your R2 bucket via the upload Worker. Configure <code style={{ fontSize: 11 }}>VITE_STORAGE_API_URL</code> and{" "}
            <code style={{ fontSize: 11 }}>VITE_STORAGE_UPLOAD_TOKEN</code> in <code style={{ fontSize: 11 }}>.env.local</code>. Optional public links:{" "}
            <code style={{ fontSize: 11 }}>VITE_R2_PUBLIC_BASE_URL</code>.
          </p>
          <input ref={r2InputRef} type="file" multiple style={{ display: "none" }} onChange={onR2Files} />
          <button type="button" style={ss.btnP} disabled={r2Busy} onClick={() => r2InputRef.current?.click()}>
            {r2Busy ? "Uploading…" : "Upload to R2"}
          </button>
          {r2Msg && <p style={{ marginTop: 10, fontSize: 13 }}>{r2Msg}</p>}
          {r2Uploads.length > 0 && (
            <div style={{ marginTop: 14, maxHeight: 200, overflow: "auto" }}>
              {r2Uploads.map((u) => (
                <div
                  key={u.id}
                  style={{
                    fontSize: 12,
                    padding: "8px 0",
                    borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{u.name}</div>
                    <div style={{ color: "var(--color-text-secondary)", wordBreak: "break-all" }}>{u.key}</div>
                    {u.publicUrl && (() => {
                      const pub = safeHttpUrl(u.publicUrl);
                      return pub ? (
                        <a href={pub} target="_blank" rel="noopener noreferrer" style={{ color: "#0d9488", fontSize: 12 }}>
                          Open public link
                        </a>
                      ) : (
                        <span style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>Invalid public URL</span>
                      );
                    })()}
                  </div>
                  <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => removeR2Row(u.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {pickError && <p style={{ color: "#b91c1c", marginBottom: 12 }}>{pickError}</p>}
      {dirName && (
        <div style={{ ...ss.card, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Current folder</div>
          <div style={{ fontWeight: 600 }}>{dirName}</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 16 }}>
        <div style={ss.card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Files ({files.length})</div>
          <div style={{ maxHeight: 360, overflow: "auto" }}>
            {files.length === 0 && <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Choose a folder to list documents.</div>}
            {files.map((f) => (
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
                }}
              >
                {f.path}
              </button>
            ))}
          </div>
        </div>
        <div style={ss.card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Details</div>
          {!selectedPath && <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Select a file.</div>}
          {selectedPath && (
            <>
              <label style={ss.lbl}>Tags (comma-separated)</label>
              <input
                style={ss.inp}
                value={(meta.tags && meta.tags[selectedPath]) || ""}
                onChange={(e) => setTags(selectedPath, e.target.value)}
                placeholder="e.g. RAMS, handover"
              />
              <label style={{ ...ss.lbl, marginTop: 12 }}>Notes</label>
              <textarea
                style={{ ...ss.inp, minHeight: 80, resize: "vertical" }}
                value={(meta.notes && meta.notes[selectedPath]) || ""}
                onChange={(e) => setNote(selectedPath, e.target.value)}
              />
              {previewUrl && (selectedPath.toLowerCase().endsWith(".pdf") ? (
                <iframe title="preview" src={previewUrl} style={{ width: "100%", height: 280, border: "0.5px solid #ccc", borderRadius: 6, marginTop: 12 }} />
              ) : (
                <img alt="" src={previewUrl} style={{ maxWidth: "100%", maxHeight: 240, marginTop: 12, objectFit: "contain" }} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
