import RegisterHealthRing from "./RegisterHealthRing";
import { buildMoreSectionPulse } from "../utils/moreSectionPulse";
import { modulesWithSeedTemplates, seedEmptyRegisters } from "../utils/registerSeedTemplates";
import { MODULE_PREBUILDS } from "../utils/moduleTileIntelligence";
import { setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { useToast } from "../context/ToastContext";

/**
 * Section spotlight — health ring, do-this-now, attention pulse, filters.
 */
export default function MoreSectionSpotlight({
  sectionTitle,
  tone,
  tabs,
  statsMap,
  filter,
  onFilterChange,
  onSeeded,
  onOpenModule,
}) {
  const { pushToast } = useToast();
  const showSpotlight = tone === "hse" || tone === "site" || tone === "insights" || tone === "data";
  if (!showSpotlight) return null;

  const pulse = buildMoreSectionPulse(tone, tabs, statsMap);
  const { summary, attentionModules, nextAction, scoreColor } = pulse;
  const ids = tabs.map((t) => t.id);
  const emptySeedable = modulesWithSeedTemplates(ids.filter((id) => statsMap[id]?.status === "empty"));
  const emptyQuickStart = ids.filter((id) => statsMap[id]?.status === "empty" && MODULE_PREBUILDS[id]);

  const chips = [
    ["all", "All"],
    ["attention", `Needs attention (${summary.attention})`],
    ["empty", `Empty (${summary.empty})`],
    ["active", `Active (${summary.active})`],
  ];

  const handleSeedEmpty = () => {
    if (!emptySeedable.length) return;
    if (!window.confirm(`Add starter template rows to ${emptySeedable.length} empty register(s)?`)) return;
    const { seeded } = seedEmptyRegisters(emptySeedable);
    onSeeded?.();
    if (seeded.length) {
      pushToast({ type: "success", message: `Seeded ${seeded.length} register(s) with template rows.` });
    }
  };

  const handleQuickStartEmpty = () => {
    if (!emptyQuickStart.length) return;
    const first = emptyQuickStart[0];
    const def = MODULE_PREBUILDS[first];
    if (def?.action) {
      setWorkspaceNavTarget({ viewId: first, action: def.action });
    }
    onOpenModule?.(first);
    pushToast({
      type: "info",
      message: `Quick start opened for ${emptyQuickStart.length} empty module(s) — starting with ${def?.shortLabel || first}.`,
    });
  };

  return (
    <div className={`app-more-spotlight app-more-spotlight--${tone}`}>
      <div className="app-more-spotlight__glow" aria-hidden />
      <div className="app-more-spotlight__inner">
        <div className="app-more-spotlight__head">
          <RegisterHealthRing score={summary.healthScore} color={scoreColor} size={58} label="Health" />
          <div className="app-more-spotlight__copy">
            <strong>{summary.records.toLocaleString()} records</strong> across {summary.tracked} registers
            {summary.attention > 0 ? (
              <span className="app-more-spotlight__warn"> · {summary.attention} need attention</span>
            ) : summary.empty > 0 ? (
              <span> · {summary.empty} empty</span>
            ) : (
              <span className="app-more-spotlight__ok"> · registers on track</span>
            )}
          </div>
          {nextAction ? (
            <button
              type="button"
              className={`app-more-spotlight__cta app-more-spotlight__cta--${nextAction.tone || "warn"}`}
              onClick={() => onOpenModule?.(nextAction.viewId)}
            >
              <span className="app-more-spotlight__cta-label">Do this now</span>
              <span className="app-more-spotlight__cta-action">{nextAction.label}</span>
              <span className="app-more-spotlight__cta-reason">{nextAction.reason}</span>
            </button>
          ) : null}
        </div>

        {attentionModules.length > 0 ? (
          <div className="app-more-spotlight__pulse" role="list" aria-label={`${sectionTitle} attention`}>
            {attentionModules.map((m) => (
              <button
                key={m.id}
                type="button"
                role="listitem"
                className="app-more-spotlight__pulse-chip"
                onClick={() => onOpenModule?.(m.id)}
              >
                <span className="app-more-spotlight__pulse-dot" aria-hidden />
                {m.label}
                {m.attentionCount > 0 ? (
                  <span className="app-more-spotlight__pulse-count">{m.attentionCount}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="app-more-spotlight__chips" role="tablist" aria-label={`Filter ${sectionTitle}`}>
          {chips.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`app-more-section-chip${filter === key ? " app-more-section-chip--active" : ""}`}
              onClick={() => onFilterChange(key)}
            >
              {label}
            </button>
          ))}
          {emptyQuickStart.length > 0 ? (
            <button type="button" className="app-more-section-chip app-more-section-chip--seed" onClick={handleQuickStartEmpty}>
              Quick start {emptyQuickStart.length} empty
            </button>
          ) : null}
          {tone === "hse" && emptySeedable.length > 0 && (
            <button type="button" className="app-more-section-chip app-more-section-chip--seed" onClick={handleSeedEmpty}>
              Seed {emptySeedable.length} empty
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
