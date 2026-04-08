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

export function prefetchView(viewId) {
  const fn = LOADERS[viewId];
  if (!fn) return;
  Promise.resolve(fn()).catch(() => {});
}
