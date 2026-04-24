import { useD1OrgArraySync } from "./useD1OrgArraySync";

const WORKERS_KEY = "mysafeops_workers";
const PROJECTS_KEY = "mysafeops_projects";

/**
 * Hydrate + debounce-sync the shared workers/projects lists to D1 (two KV namespaces).
 * Use wherever the module keeps workers/projects in React state (not one-shot load() in forms).
 */
export function useD1WorkersProjectsSync({ workers, setWorkers, projects, setProjects, load, save }) {
  const w = useD1OrgArraySync({
    storageKey: WORKERS_KEY,
    namespace: WORKERS_KEY,
    value: workers,
    setValue: setWorkers,
    load,
    save,
  });
  const p = useD1OrgArraySync({
    storageKey: PROJECTS_KEY,
    namespace: PROJECTS_KEY,
    value: projects,
    setValue: setProjects,
    load,
    save,
  });
  return {
    d1Ready: w.d1Ready && p.d1Ready,
    d1Syncing: w.d1Syncing || p.d1Syncing,
  };
}
