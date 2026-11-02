import { useState } from "react";
import {
  overlayDraftKey,
  readOverlayFormDraft,
  writeOverlayFormDraft,
  clearOverlayFormDraft,
} from "../../hooks/useOverlayFormDraft.js";

export function useMissionDraft(purpose, mission, actor, defaults) {
  const key = overlayDraftKey(`drone-${purpose}`, JSON.stringify([mission.id, actor.id || actor.name || "member"]));
  const seed = () => {
    const saved = readOverlayFormDraft(key);
    const valid =
      saved?.values &&
      Number.isInteger(saved.revision) &&
      Object.keys(defaults).every((field) => typeof saved.values[field] === "string");
    return {
      key,
      values: valid ? Object.fromEntries(Object.keys(defaults).map((field) => [field, saved.values[field]])) : defaults,
      revision: valid ? saved.revision : mission.revision,
      restored: !!valid,
      dirty: !!valid,
      storageError: false,
    };
  };
  const [stored, setStored] = useState(seed);
  let state = stored;
  if (stored.key !== key) {
    state = seed();
    setStored(state);
  }
  function persist(values, revision = state.dirty ? state.revision : mission.revision) {
    const saved = writeOverlayFormDraft(key, { values, revision });
    setStored({ ...state, values, revision, dirty: true, storageError: !saved });
  }
  return {
    values: state.values,
    dirty: state.dirty,
    restored: state.restored,
    storageError: state.storageError,
    revisionChanged: state.dirty && state.revision !== mission.revision,
    sourceRevision: state.revision,
    set: (values) => persist(typeof values === "function" ? values(state.values) : values),
    confirmRevision: () => persist(state.values, mission.revision),
    reset: () => {
      clearOverlayFormDraft(key);
      setStored({
        key,
        values: defaults,
        revision: mission.revision,
        restored: false,
        dirty: false,
        storageError: false,
      });
    },
  };
}
