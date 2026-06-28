/** Lightweight canvas confetti — no dependencies. */
export function burstSurveyCelebration(originY = 0.35) {
  if (typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.className = "app-survey-celebration-canvas";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const colors = ["#0d9488", "#14b8a6", "#2dd4bf", "#f59e0b", "#0c447c", "#86efac", "#fcd34d"];
  const cx = canvas.width * 0.5;
  const cy = canvas.height * originY;
  const particles = Array.from({ length: 96 }, () => ({
    x: cx + (Math.random() - 0.5) * 80,
    y: cy,
    vx: (Math.random() - 0.5) * 14,
    vy: Math.random() * -16 - 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: Math.random() * 7 + 4,
    h: Math.random() * 4 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 1,
  }));

  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38;
      p.vx *= 0.99;
      p.rot += p.vr;
      p.life -= 0.012;
      if (p.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame += 1;
    if (frame < 100) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(tick);
}
