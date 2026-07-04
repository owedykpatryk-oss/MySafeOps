import { openWorkspaceMoreSection, openWorkspaceView } from "../utils/workspaceNavContext";
import { HSE_SECTION_TITLE } from "../utils/moduleRegisterStats";
import { modulesWithSeedTemplates, seedEmptyRegisters } from "../utils/registerSeedTemplates";
import { useToast } from "../context/ToastContext";

/**
 * Dashboard widget — HSE register health, attention list, seed empty registers.
 */
export default function HseRegistersCard({ summary, attentionModules = [], emptyModules = [], onSeeded }) {
  const { pushToast } = useToast();
  const score = summary?.healthScore ?? 0;
  const scoreColour = score >= 75 ? "#0d9488" : score >= 45 ? "#d97706" : "#dc2626";
  const seedableEmpty = modulesWithSeedTemplates(emptyModules.map((m) => m.id));

  const handleSeed = () => {
    if (!seedableEmpty.length) return;
    if (
      !window.confirm(
        `Add a starter template row to ${seedableEmpty.length} empty HSE register(s)? You can edit or delete these rows in each module.`
      )
    ) {
      return;
    }
    const { seeded } = seedEmptyRegisters(seedableEmpty);
    onSeeded?.(seeded.length);
    if (seeded.length) {
      pushToast({ type: "success", message: `Added starter records to ${seeded.length} register(s). Open More → HSE to review.` });
    }
  };

  return (
    <div className="app-hse-registers-card">
      <div className="app-hse-registers-card__head">
        <div>
          <div className="app-dashboard-card__title">HSE registers</div>
          <p className="app-hse-registers-card__lead">
            {summary?.records?.toLocaleString() ?? 0} records · {summary?.tracked ?? 0} registers tracked
          </p>
        </div>
        <div className="app-hse-registers-card__score" style={{ borderColor: scoreColour }}>
          <span style={{ color: scoreColour }}>{score}%</span>
          <small>Health</small>
        </div>
      </div>

      <div className="app-hse-registers-card__stats">
        {summary?.attention > 0 ? (
          <span className="app-hse-registers-card__pill app-hse-registers-card__pill--warn">
            {summary.attention} need attention
          </span>
        ) : null}
        {summary?.empty > 0 ? (
          <span className="app-hse-registers-card__pill">{summary.empty} empty</span>
        ) : null}
        {summary?.active > 0 ? (
          <span className="app-hse-registers-card__pill app-hse-registers-card__pill--ok">{summary.active} active</span>
        ) : null}
      </div>

      {attentionModules.length > 0 ? (
        <ul className="app-hse-registers-card__list">
          {attentionModules.slice(0, 5).map((m) => (
            <li key={m.id}>
              <button type="button" className="app-hse-registers-card__link" onClick={() => openWorkspaceView({ viewId: m.id })}>
                <span>{m.label}</span>
                <span className="app-hse-registers-card__meta">
                  {m.attentionCount} item{m.attentionCount === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="app-dashboard-empty">No HSE registers flagged for attention right now.</div>
      )}

      <div className="app-hse-registers-card__actions">
        <button
          type="button"
          className="app-hse-registers-card__btn app-hse-registers-card__btn--primary"
          onClick={() =>
            openWorkspaceMoreSection({
              sectionTitle: HSE_SECTION_TITLE,
              registerFilter: summary?.attention > 0 ? "attention" : "all",
            })
          }
        >
          Open HSE registers
        </button>
        {seedableEmpty.length > 0 ? (
          <button type="button" className="app-hse-registers-card__btn" onClick={handleSeed}>
            Seed {seedableEmpty.length} empty
          </button>
        ) : null}
      </div>
    </div>
  );
}
