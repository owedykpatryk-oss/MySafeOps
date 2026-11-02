/** Keep legacy projects selectable even if their original name is blank. */
export function projectDisplayLabel(project) {
  return [project?.name, project?.site, project?.id]
    .map(value => String(value ?? "").trim()).find(Boolean) || "—";
}
