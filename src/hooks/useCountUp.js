import { useEffect, useRef, useState } from "react";

/**
 * Smooth count-up for dashboard-style numbers (respects reduced motion).
 * @param {number} target
 * @param {number} [durationMs]
 */
export function useCountUp(target, durationMs = 420) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(target);
      prev.current = target;
      return undefined;
    }

    const from = prev.current;
    const to = target;
    prev.current = target;
    if (from === to) return undefined;

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, durationMs]);

  return display;
}
