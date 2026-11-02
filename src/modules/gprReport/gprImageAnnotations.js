const coordinate = (value, size) => (Number(value) || 0) * size / 1000;

export function drawGprAnnotations(ctx, shapes, width, height) {
  const unit = width / 1000;
  for (const shape of shapes || []) {
    const color = /^#[0-9a-f]{6}$/i.test(shape.color) ? shape.color : "#ef4444";
    const x1 = coordinate(shape.x1, width);
    const y1 = coordinate(shape.y1, height);
    const x2 = coordinate(shape.x2, width);
    const y2 = coordinate(shape.y2, height);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, (Number(shape.width) || 4) * unit);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (shape.type === "text") {
      ctx.font = `700 ${Math.max(8, (Number(shape.fontSize) || 40) * unit)}px Arial, sans-serif`;
      ctx.textBaseline = "top";
      String(shape.text || "").split("\n").forEach((line, index) => ctx.fillText(line, x1, y1 + index * (Number(shape.fontSize) || 40) * unit * 1.25));
    } else if (shape.type === "pin") {
      const radius = 25 * unit;
      ctx.beginPath();
      ctx.arc(x1, y1, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, 3 * unit);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.max(10, 28 * unit)}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shape.number || "?"), x1, y1);
    } else if (shape.type === "rectangle") {
      ctx.globalAlpha = 0.13;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (shape.type === "pen") {
      const points = shape.points || [];
      if (points.length) {
        ctx.beginPath();
        ctx.moveTo(coordinate(points[0][0], width), coordinate(points[0][1], height));
        points.slice(1).forEach(([x, y]) => ctx.lineTo(coordinate(x, width), coordinate(y, height)));
        ctx.stroke();
      }
    } else if (shape.type === "line" || shape.type === "arrow") {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (shape.type === "arrow") {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = Math.max(12, ctx.lineWidth * 4);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

export function flattenGprAnnotations(source, shapes) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        drawGprAnnotations(ctx, shapes, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("Could not load this image for annotation."));
    image.src = source;
  });
}
