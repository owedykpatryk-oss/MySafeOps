import { useEffect, useState } from "react";

const STORAGE_KEY = "mysafeops-blog-theme";

/** @returns {"light" | "dark" | "auto"} */
function readStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

/**
 * Blog dark mode: `auto` follows system, or force light/dark.
 */
export function useBlogTheme() {
  const [mode, setMode] = useState(readStoredTheme);
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setPrefersDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.dataset.blogTheme = resolved;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode, resolved]);

  const cycleTheme = () => {
    setMode((prev) => (prev === "auto" ? "light" : prev === "light" ? "dark" : "auto"));
  };

  return { mode, resolved, setMode, cycleTheme };
}
