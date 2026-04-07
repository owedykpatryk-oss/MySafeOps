import { useState, useEffect, useCallback } from "react";

const DOC_META_KEY = "mysafeops_doc_library";

const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const scopedMetaKey = () => `${DOC_META_KEY}_${getOrgId()}`;

const loadMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(scopedMetaKey()) || "{}");
  } catch {
    return {};
  }
};
const saveMeta = (m) => localStorage.setItem(scopedMetaKey(), JSON.stringify(m));

const ss = {
  btn: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  btnP: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid #085041", background: "#0d9488", color: "#E1F5EE", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  inp: { width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 6, fontSize: 13, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary)", fontFamily: "DM Sans,sans-serif", boxSizing: "border-box" },
  lbl: { display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 },
  card: { background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: "1.25rem" },
};

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
  const [supported] = useState(() => typeof window !== "undefined" && "showDirectoryPicker" in window);
  const [dirName, setDirName] = useState(() => loadMeta().dirName || "");
  const [files, setFiles] = useState([]);
  const [meta, setMeta] = useState(loadMeta);
  const [pickError, setPickError] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

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
      <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
        <div style={ss.card}>
          <p style={{ margin: 0 }}>The document library needs the File System Access API (Chrome or Edge 86+). It is not available in this browser.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, color: "var(--color-text-primary)" }}>Document library</h1>
        <button type="button" style={ss.btnP} onClick={pickFolder}>
          {dirName ? "Change folder" : "Choose folder"}
        </button>
      </div>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 16 }}>
        Files stay on your device — nothing is uploaded. Tags and notes are stored in localStorage ({scopedMetaKey()}).
      </p>
      {pickError && <p style={{ color: "#b91c1c", marginBottom: 12 }}>{pickError}</p>}
      {dirName && (
        <div style={{ ...ss.card, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Current folder</div>
          <div style={{ fontWeight: 600 }}>{dirName}</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
