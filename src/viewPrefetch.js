/**
 * Warm the module chunk before navigation (hover/focus) for faster first paint.
 */
import { workspaceViewLoaders } from "./navigation/workspaceViews";

const LOADERS = {
  ...workspaceViewLoaders,
  settings: () =>
    Promise.all([
      import("./components/CloudAccount"),
      import("./components/OrgSettings"),
      import("./offline/NotificationSettings"),
    ]),
};

const PREFETCH_DELAY_MS = 180;
const scheduled = new Map();

export function prefetchView(viewId) {
  const fn = LOADERS[viewId];
  if (!fn || scheduled.has(viewId)) return;
  const timer = setTimeout(() => {
    scheduled.delete(viewId);
    Promise.resolve(fn()).catch(() => {});
  }, PREFETCH_DELAY_MS);
  scheduled.set(viewId, timer);
}

export function cancelPrefetchView(viewId) {
  const timer = scheduled.get(viewId);
  if (timer) {
    clearTimeout(timer);
    scheduled.delete(viewId);
  }
}
