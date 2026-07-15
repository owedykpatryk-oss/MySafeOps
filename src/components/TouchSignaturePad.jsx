import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Mobile-friendly signature pad (pointer + touch).
 * Imperative API: hasInk(), toDataURL(), clear()
 */
const TouchSignaturePad = forwardRef(function TouchSignaturePad(
  { height = 140, placeholder = "Sign here with finger or mouse", style },
  ref
) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const pointerRef = useRef(null);
  const hasInkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hasInkRef.current = false;
    setHasInk(false);
    drawingRef.current = false;
    pointerRef.current = null;
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const cssWidth = canvas.clientWidth || 420;
    const cssHeight = canvas.clientHeight || height;
    const prev = canvas.toDataURL("image/png");
    const hadInk = hasInkRef.current;
    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    if (hadInk && prev) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
      };
      img.src = prev;
    }
  }, [height]);

  useEffect(() => {
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resize]);

  useImperativeHandle(
    ref,
    () => ({
      hasInk: () => hasInkRef.current,
      toDataURL: (type = "image/png") => {
        const canvas = canvasRef.current;
        if (!canvas || !hasInkRef.current) return "";
        return canvas.toDataURL(type);
      },
      clear: clearCanvas,
    }),
    [clearCanvas]
  );

  const pointFromEvent = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const pt = pointFromEvent(event);
    if (!ctx || !pt) return;
    event.preventDefault();
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    pointerRef.current = pt;
    drawingRef.current = true;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const onPointerMove = (event) => {
    if (!drawingRef.current || !pointerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const pt = pointFromEvent(event);
    if (!ctx || !pt) return;
    event.preventDefault();
    ctx.beginPath();
    ctx.moveTo(pointerRef.current.x, pointerRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    pointerRef.current = pt;
    if (!hasInkRef.current) {
      hasInkRef.current = true;
      setHasInk(true);
    }
  };

  const onPointerUp = (event) => {
    if (pointerRef.current) event.preventDefault();
    pointerRef.current = null;
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={style}>
      <div
        style={{
          position: "relative",
          border: "1px solid var(--color-border-secondary,#cbd5e1)",
          borderRadius: 8,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width: "100%",
            height,
            display: "block",
            cursor: "crosshair",
            touchAction: "none",
          }}
        />
        {!hasInk ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>{placeholder}</span>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <button
          type="button"
          onClick={clearCanvas}
          style={{
            fontSize: 12,
            padding: "6px 10px",
            minHeight: 36,
            borderRadius: 6,
            border: "1px solid var(--color-border-secondary,#ccc)",
            background: "var(--color-background-secondary,#f8fafc)",
            cursor: "pointer",
          }}
        >
          Clear signature
        </button>
      </div>
    </div>
  );
});

export default TouchSignaturePad;
