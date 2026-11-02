import { useEffect, useRef, useState } from "react";
import { flattenGprAnnotations } from "./gprImageAnnotations.js";

const TOOLS = [
  ["pen", "Draw"], ["line", "Line"], ["arrow", "Arrow"], ["rectangle", "Box"], ["text", "Text"],
];
const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#ffffff", "#111827"];
const point = (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return [Math.max(0, Math.min(1000, Math.round((event.clientX - rect.left) / rect.width * 1000))), Math.max(0, Math.min(1000, Math.round((event.clientY - rect.top) / rect.height * 1000)))];
};

function Shape({ shape, imageWidth, imageHeight }) {
  const x = (value) => value * imageWidth / 1000;
  const y = (value) => value * imageHeight / 1000;
  const unit = imageWidth / 1000;
  const common = { stroke: shape.color, strokeWidth: shape.width * unit, strokeLinecap: "round", strokeLinejoin: "round" };
  if (shape.type === "text") return <text x={x(shape.x1)} y={y(shape.y1)} fill={shape.color} fontSize={shape.fontSize * unit} fontWeight="700" fontFamily="Arial, sans-serif" dominantBaseline="hanging">{shape.text}</text>;
  if (shape.type === "pin") return <><circle cx={x(shape.x1)} cy={y(shape.y1)} r={25 * unit} fill={shape.color} stroke="#fff" strokeWidth={3 * unit} /><text x={x(shape.x1)} y={y(shape.y1)} fill="#fff" fontSize={28 * unit} fontWeight="700" fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="central">{shape.number}</text></>;
  if (shape.type === "pen") return <polyline points={(shape.points || []).map(([px, py]) => `${x(px)},${y(py)}`).join(" ")} fill="none" {...common} />;
  if (shape.type === "rectangle") return <rect x={x(Math.min(shape.x1, shape.x2))} y={y(Math.min(shape.y1, shape.y2))} width={x(Math.abs(shape.x2 - shape.x1))} height={y(Math.abs(shape.y2 - shape.y1))} fill={shape.color} fillOpacity="0.13" {...common} />;
  const line = <line x1={x(shape.x1)} y1={y(shape.y1)} x2={x(shape.x2)} y2={y(shape.y2)} {...common} />;
  if (shape.type !== "arrow") return line;
  const angle = Math.atan2(y(shape.y2 - shape.y1), x(shape.x2 - shape.x1));
  const head = Math.max(12, shape.width * 4 * unit);
  const points = [[x(shape.x2), y(shape.y2)], [x(shape.x2) - head * Math.cos(angle - Math.PI / 6), y(shape.y2) - head * Math.sin(angle - Math.PI / 6)], [x(shape.x2) - head * Math.cos(angle + Math.PI / 6), y(shape.y2) - head * Math.sin(angle + Math.PI / 6)]].map((pair) => pair.join(",")).join(" ");
  return <>{line}<polygon points={points} fill={shape.color} /></>;
}

export default function GprImageAnnotator({ image, onSave, onClose, enablePins = false }) {
  const [tool, setTool] = useState("arrow");
  const [color, setColor] = useState("#ef4444");
  const [width, setWidth] = useState(5);
  const [fontSize, setFontSize] = useState(42);
  const [text, setText] = useState("");
  const [shapes, setShapes] = useState(() => image.originalDataUrl ? (image.annotations || []) : []);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageSize, setImageSize] = useState({ width: 1000, height: 1000 });
  const drawing = useRef(false);
  const draftRef = useRef(null);
  const source = image.originalDataUrl || image.dataUrl;
  const retainedAnnotations = image.originalDataUrl ? [] : (image.annotations || []);
  const displayedPins = [...retainedAnnotations, ...shapes].filter((shape) => shape.type === "pin");

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const begin = (event) => {
    const [x, y] = point(event);
    if (tool === "pin") {
      if (!text.trim()) { setError("Enter a short pin description first."); return; }
      const number = Math.max(0, ...displayedPins.map((shape) => Number(shape.number) || 0)) + 1;
      setShapes((items) => [...items, { type: "pin", x1: x, y1: y, number, text: text.trim(), color }]);
      setError("");
      return;
    }
    if (tool === "text") {
      if (text.trim()) setShapes((items) => [...items, { type: "text", x1: x, y1: y, text: text.trim(), fontSize, color }]);
      else setError("Enter text before placing it on the image.");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    draftRef.current = { type: tool, x1: x, y1: y, x2: x, y2: y, points: [[x, y]], color, width };
    setDraft(draftRef.current);
  };
  const move = (event) => {
    if (!drawing.current) return;
    const [x, y] = point(event);
    const current = draftRef.current;
    if (!current) return;
    draftRef.current = { ...current, x2: x, y2: y, points: current.type === "pen" ? [...current.points, [x, y]] : current.points };
    setDraft(draftRef.current);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const current = draftRef.current;
    if (current && (current.type === "pen" ? current.points.length > 1 : Math.hypot(current.x2 - current.x1, current.y2 - current.y1) > 3)) setShapes((items) => [...items, current]);
    draftRef.current = null;
    setDraft(null);
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const dataUrl = shapes.length ? await flattenGprAnnotations(source, shapes) : source;
      onSave({ dataUrl, originalDataUrl: shapes.length && !retainedAnnotations.length ? source : "", annotations: [...retainedAnnotations, ...shapes] });
      onClose();
    } catch (failure) {
      setError(failure?.message || "Could not save the annotated image.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="app-gpr-annotator-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="app-gpr-annotator" role="dialog" aria-modal="true" aria-label="Annotate report image">
      <div className="app-gpr-annotator__head"><div><strong>Annotate image</strong><span>{image.annotations?.length && !image.originalDataUrl ? "Existing marks are part of this image; new marks can be added." : "Drawings are included in PDF and Word exports. Reopen to edit them."}</span></div><button type="button" onClick={onClose} aria-label="Close image editor">×</button></div>
      <div className="app-gpr-annotator__tools" role="toolbar" aria-label="Drawing tools">
        {[...TOOLS, ...(enablePins ? [["pin", "Numbered pin"]] : [])].map(([key, label]) => <button key={key} type="button" aria-pressed={tool === key} onClick={() => setTool(key)}>{label}</button>)}
        <label>Colour <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
        <div className="app-gpr-annotator__swatches">{COLORS.map((value) => <button key={value} type="button" aria-label={`Use ${value}`} style={{ background: value }} onClick={() => setColor(value)} />)}</div>
        <label>Line <input type="range" min="2" max="18" value={width} onChange={(event) => setWidth(Number(event.target.value))} />{width}</label>
        {tool === "text" || tool === "pin" ? <><label>{tool === "pin" ? "Pin description" : "Text"} <input type="text" value={text} maxLength={120} placeholder={tool === "pin" ? "What does this mark show?" : "Label or note"} onChange={(event) => setText(event.target.value)} /></label>{tool === "text" ? <label>Size <input type="range" min="22" max="90" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />{fontSize}</label> : null}</> : null}
      </div>
      <div className="app-gpr-annotator__stage"><div className="app-gpr-annotator__image"><img src={source} alt="Original report image" draggable="false" onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} /><svg viewBox={`0 0 ${imageSize.width} ${imageSize.height}`} preserveAspectRatio="none" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Draw on image">{shapes.map((shape, index) => <Shape key={index} shape={shape} imageWidth={imageSize.width} imageHeight={imageSize.height} />)}{draft ? <Shape shape={draft} imageWidth={imageSize.width} imageHeight={imageSize.height} /> : null}</svg></div></div>
      {displayedPins.length ? <div className="app-gpr-annotator__pins">{displayedPins.map((shape) => <span key={shape.number}><b>{shape.number}</b> {shape.text}</span>)}</div> : null}
      {error ? <p className="app-gpr-annotator__error" role="alert">{error}</p> : null}
      <div className="app-gpr-annotator__foot"><button type="button" disabled={!shapes.length} onClick={() => setShapes((items) => items.slice(0, -1))}>Undo</button><button type="button" disabled={!shapes.length} onClick={() => setShapes([])}>Clear all</button><span /><button type="button" onClick={onClose}>Cancel</button><button type="button" className="app-gpr-annotator__save" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save image"}</button></div>
    </div>
  </div>;
}
