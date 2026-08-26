import { useState, useRef } from "react";
import { Upload, X, Check, AlertCircle, Edit2 } from "lucide-react";
import { extractFormFields, parseDate, scoreExtraction } from "../utils/formFieldExtraction";

/**
 * Modal to upload/scan documents and auto-extract form fields.
 * Accepts: PDF, images (camera/gallery), or pasted text.
 * Shows extracted fields for review before creating workspace record.
 */
export default function DocumentFieldExtractor({
  open,
  onClose,
  onExtract,
  title = "Extract Document Fields",
}) {
  const [step, setStep] = useState("upload"); // 'upload' | 'extract' | 'review'
  const [documentText, setDocumentText] = useState("");
  const [extraction, setExtraction] = useState(null);
  const [editMode, setEditMode] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleFileSelect = async (file) => {
    setLoading(true);
    setError("");

    try {
      if (file.type === "application/pdf") {
        // For PDF: would need pdfjs library
        // For now, show message to user
        setError("PDF extraction requires pdfjs library installation");
        setLoading(false);
        return;
      }

      if (file.type.startsWith("image/")) {
        // For images: would need OCR (Tesseract or cloud API)
        // For now, show message
        setError("Image OCR requires external service (Tesseract or cloud API)");
        setLoading(false);
        return;
      }

      // Text file
      const text = await file.text();
      setDocumentText(text);
      handleExtract(text);
    } catch (err) {
      setError(err.message || "Failed to read file");
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = (text) => {
    const result = extractFormFields(text);
    setExtraction(result);
    setStep("review");
    setEditMode({});
  };

  const handleTextPaste = (e) => {
    const text = e.target.value;
    setDocumentText(text);
    if (text.trim().length > 50) {
      handleExtract(text);
    }
  };

  const handleFieldEdit = (key, value) => {
    setExtraction((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: value },
    }));
  };

  const handleSubmit = () => {
    onExtract?.(extraction);
    onClose();
  };

  const confidentColor =
    extraction?.confidence === "high"
      ? "#22c55e"
      : extraction?.confidence === "medium"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 8,
          maxWidth: 600,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fee2e2", color: "#dc2626", padding: 12, borderRadius: 4, marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {step === "upload" && (
          <div>
            <div
              style={{
                border: "2px dashed #d1d5db",
                borderRadius: 8,
                padding: 32,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              <Upload size={32} style={{ margin: "0 auto 12px", color: "#9ca3af" }} />
              <p style={{ margin: "0 0 12px", fontWeight: 500 }}>Upload document or paste text</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#0d9488",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                accept=".pdf,.jpg,.jpeg,.png,.txt"
                style={{ display: "none" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Or paste document text:</label>
              <textarea
                value={documentText}
                onChange={handleTextPaste}
                placeholder="Paste permit, certificate, or form text here..."
                style={{
                  width: "100%",
                  height: 150,
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              />
            </div>

            <button
              type="button"
              disabled={!documentText.trim() || loading}
              onClick={() => handleExtract(documentText)}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: documentText.trim() ? "#0d9488" : "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: documentText.trim() ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Extracting…" : "Extract Fields"}
            </button>
          </div>
        )}

        {step === "review" && extraction && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 8px",
                  backgroundColor: confidentColor,
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {extraction.confidence.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {extraction.type || "Unknown document type"}
              </span>
            </div>

            <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
              {Object.entries(extraction.fields)
                .filter(([, value]) => value !== null && value !== "unknown")
                .map(([key, value]) => (
                  <div key={key} style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}
                    </label>
                    {editMode[key] ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input
                          type="text"
                          value={value || ""}
                          onChange={(e) => handleFieldEdit(key, e.target.value)}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            fontSize: 13,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setEditMode((prev) => ({ ...prev, [key]: false }))}
                          style={{
                            padding: "6px 8px",
                            backgroundColor: "#0d9488",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          backgroundColor: "#f9fafb",
                          borderRadius: 4,
                          fontSize: 13,
                        }}
                      >
                        <span>{value || "(empty)"}</span>
                        <button
                          type="button"
                          onClick={() => setEditMode((prev) => ({ ...prev, [key]: true }))}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#6b7280",
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setExtraction(null);
                  setDocumentText("");
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  backgroundColor: "#0d9488",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Use These Fields
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
