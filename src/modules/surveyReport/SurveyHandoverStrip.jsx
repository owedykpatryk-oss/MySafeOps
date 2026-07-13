import { memo } from "react";
import { openWorkspaceView, setWorkspaceNavTarget } from "../../utils/workspaceNavContext";

function SurveyHandoverStrip({ form, linkedRams, projectPermits, geoPhotoCount, onGoToTab }) {
  if (!form.projectId) return null;

  const linkedPermit = projectPermits.find((p) => p.id === form.hseRefs?.linkedPermitId);

  return (
    <div className="app-survey-handover-strip" aria-label="Project handover links">
      <button
        type="button"
        className={`app-survey-handover-card${form.linkedRamsId ? " app-survey-handover-card--linked" : ""}`}
        onClick={() => {
          if (form.linkedRamsId) openWorkspaceView({ viewId: "rams", ramsId: form.linkedRamsId, mode: "view" });
          else openWorkspaceView({ viewId: "rams", projectId: form.projectId, mode: "create" });
        }}
      >
        <span className="app-survey-handover-card__icon" aria-hidden>📋</span>
        <span className="app-survey-handover-card__label">RAMS</span>
        <span className="app-survey-handover-card__meta">{linkedRams?.title || linkedRams?.documentNo || "Link or open"}</span>
      </button>
      <button
        type="button"
        className={`app-survey-handover-card${linkedPermit ? " app-survey-handover-card--linked" : ""}`}
        onClick={() => onGoToTab?.("professional")}
      >
        <span className="app-survey-handover-card__icon" aria-hidden>⛏</span>
        <span className="app-survey-handover-card__label">Permit to dig</span>
        <span className="app-survey-handover-card__meta">
          {linkedPermit?.permitNo || linkedPermit?.ref || form.hseRefs?.permitRef || "Link PTW"}
        </span>
      </button>
      <button
        type="button"
        className={`app-survey-handover-card${geoPhotoCount > 0 ? " app-survey-handover-card--linked" : ""}`}
        onClick={() => {
          setWorkspaceNavTarget({ viewId: "geo-photos", projectId: form.projectId });
          openWorkspaceView({ viewId: "geo-photos" });
        }}
      >
        <span className="app-survey-handover-card__icon" aria-hidden>📍</span>
        <span className="app-survey-handover-card__label">Geo-photos</span>
        <span className="app-survey-handover-card__meta">{geoPhotoCount ? `${geoPhotoCount} on project` : "Open module"}</span>
      </button>
      <button
        type="button"
        className="app-survey-handover-card"
        onClick={() => openWorkspaceView({ viewId: "projects", projectId: form.projectId, mode: "view" })}
      >
        <span className="app-survey-handover-card__icon" aria-hidden>🏗</span>
        <span className="app-survey-handover-card__label">Project hub</span>
        <span className="app-survey-handover-card__meta">{form.projectName || "Dashboard"}</span>
      </button>
    </div>
  );
}

export default memo(SurveyHandoverStrip);
