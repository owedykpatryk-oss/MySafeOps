/** @vitest-environment jsdom */
/**
 * Smoke-render workspace modules — catches ReferenceError / mount crashes that unit
 * tests miss (e.g. liveItems used outside the component that defines `items`).
 */
import { Component, Suspense, createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppProvider } from "../context/AppContext";
import { SupabaseAuthProvider } from "../context/SupabaseAuthContext";
import { ToastProvider } from "../context/ToastContext";
import { workspaceViewLoaders } from "../navigation/workspaceViews";

/** Views that need canvas/WebGL/Leaflet or huge async graphs — import-only check. */
const IMPORT_ONLY_IDS = new Set([
  "site-map",
  "incident-map",
  "project-drawings",
  "geo-photos",
  "survey-report",
  "gpr-report",
  "permits",
  "rams",
]);

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function Providers({ children }) {
  return createElement(
    MemoryRouter,
    { initialEntries: ["/app"] },
    createElement(
      AppProvider,
      null,
      createElement(
        SupabaseAuthProvider,
        null,
        createElement(ToastProvider, null, createElement(Suspense, { fallback: null }, children)),
      ),
    ),
  );
}

class RenderBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

async function mountDefaultExport(loader) {
  const mod = await loader();
  const Comp = mod?.default;
  if (typeof Comp !== "function") {
    throw new Error("module default export is not a component");
  }

  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  let boundaryRef = { current: null };

  class Catch extends RenderBoundary {
    constructor(props) {
      super(props);
      boundaryRef.current = this;
    }
  }

  await act(async () => {
    root.render(createElement(Providers, null, createElement(Catch, null, createElement(Comp))));
  });

  await act(async () => {
    await Promise.resolve();
  });

  const err = boundaryRef.current?.state?.error;
  root.unmount();
  host.remove();

  if (err) throw err;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("workspace module smoke", () => {
  const entries = Object.entries(workspaceViewLoaders).filter(([id]) => !IMPORT_ONLY_IDS.has(id));

  it.each(entries)(
    "renders %s without throwing",
    async (_id, loader) => {
      await expect(mountDefaultExport(loader)).resolves.toBeUndefined();
    },
    // The dashboard alone takes ~8s to transform and mount; alongside the rest of the suite
    // it has repeatedly crossed 15s. This is a load ceiling, not a slow assertion — the case
    // passes comfortably when the file runs on its own.
    30_000,
  );

  it.each([...IMPORT_ONLY_IDS].filter((id) => workspaceViewLoaders[id]))(
    "imports heavy view %s (default export is a component)",
    async (id) => {
      const mod = await workspaceViewLoaders[id]();
      expect(typeof mod.default).toBe("function");
    },
    // Same budget as the render cases above: transforming these heavy views exceeds the
    // 5s default on a loaded machine, which made the whole suite flaky rather than failing.
    15_000,
  );
});
