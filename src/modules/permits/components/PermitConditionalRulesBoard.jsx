import { useMemo } from "react";
import {
  labelRuleAction,
  summarizeConditionalRule,
} from "../permitConditionalRuleSummary";
import { labelWorkflowState } from "../permitWorkflowLabels";

export default function PermitConditionalRulesBoard({
  rules = [],
  isNarrow = false,
  ss = {},
  effectivePermitTypes = {},
  workflowStates = [],
  fieldCatalog = [],
  projects = [],
  onAddRule,
  onReset,
  onUpdateRule,
  onAddClause,
  onUpdateClause,
  onMoveClause,
  onRemoveClause,
  onRemoveRule,
}) {
  const catalogs = useMemo(
    () => ({ permitTypes: effectivePermitTypes, projects, fieldCatalog }),
    [effectivePermitTypes, projects, fieldCatalog]
  );

  const enabledCount = rules.filter((r) => r.enabled !== false).length;

  return (
    <div className="app-panel-surface ptw-rules-board" style={{ padding: 10, borderRadius: 10, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Conditional rules builder</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            {rules.length === 0
              ? "Automate form behaviour with IF → THEN rules (required, show/hide, block issue)."
              : `${rules.length} rule${rules.length === 1 ? "" : "s"} · ${enabledCount} enabled`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onAddRule} style={{ ...ss.btnO, fontSize: 12 }}>
            + Add rule
          </button>
          <button type="button" onClick={onReset} style={{ ...ss.btn, fontSize: 12 }}>
            Reset all
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="ptw-rules-board__empty">
          No rules yet. Add your first IF/THEN rule to automate permit form behaviour.
        </div>
      ) : (
        <div className="ptw-rules-board__list">
          {rules.map((rule, ruleIndex) => {
            const summary = summarizeConditionalRule(rule, catalogs);
            const clauses = Array.isArray(rule.whenClauses) ? rule.whenClauses : [];

            return (
              <article key={rule.id} className={`ptw-rule-card${rule.enabled === false ? " ptw-rule-card--disabled" : ""}`}>
                <header className="ptw-rule-card__head">
                  <div className="ptw-rule-card__head-main">
                    <span className="ptw-rule-card__index">Rule {ruleIndex + 1}</span>
                    <p className="ptw-rule-card__summary" title={summary}>
                      {summary}
                    </p>
                  </div>
                  <label className="ptw-rule-card__enabled">
                    <input
                      type="checkbox"
                      checked={rule.enabled !== false}
                      onChange={(e) => onUpdateRule(rule.id, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </header>

                <div className={`ptw-rule-card__pipeline${isNarrow ? " ptw-rule-card__pipeline--narrow" : ""}`}>
                  <section className="ptw-rule-card__if" aria-label="IF conditions">
                    <div className="ptw-rule-card__block-label">IF</div>
                    <div className="ptw-rule-card__if-toolbar">
                      <select
                        value={rule.whenOperator || "and"}
                        onChange={(e) => onUpdateRule(rule.id, { whenOperator: e.target.value })}
                        style={{ ...ss.inp, width: 140 }}
                        aria-label="IF logic"
                      >
                        <option value="and">ALL match (AND)</option>
                        <option value="or">ANY match (OR)</option>
                      </select>
                      <button type="button" onClick={() => onAddClause(rule.id)} style={{ ...ss.btn, fontSize: 11, padding: "3px 8px" }}>
                        + Clause
                      </button>
                    </div>
                    {clauses.length === 0 ? (
                      <p className="ptw-rule-card__clause-empty">No clauses — rule applies whenever form loads.</p>
                    ) : (
                      clauses.map((clause, idx) => (
                        <div
                          key={`${rule.id}_clause_${idx}`}
                          className="ptw-rule-card__clause"
                          style={{ gridTemplateColumns: isNarrow ? "1fr" : "minmax(0,150px) minmax(0,1fr) auto" }}
                        >
                          <select
                            value={clause.field || "permitType"}
                            onChange={(e) => onUpdateClause(rule.id, idx, { field: e.target.value, value: "" })}
                            style={ss.inp}
                          >
                            <option value="permitType">Permit type</option>
                            <option value="status">Status</option>
                            <option value="projectId">Project</option>
                          </select>
                          {clause.field === "permitType" ? (
                            <select
                              value={clause.value || ""}
                              onChange={(e) => onUpdateClause(rule.id, idx, { value: e.target.value })}
                              style={ss.inp}
                            >
                              <option value="">Any permit type</option>
                              {Object.entries(effectivePermitTypes).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          ) : clause.field === "status" ? (
                            <select
                              value={clause.value || ""}
                              onChange={(e) => onUpdateClause(rule.id, idx, { value: e.target.value })}
                              style={ss.inp}
                            >
                              <option value="">Any status</option>
                              {workflowStates.map((state) => (
                                <option key={state} value={state}>
                                  {labelWorkflowState(state)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={clause.value || ""}
                              onChange={(e) => onUpdateClause(rule.id, idx, { value: e.target.value })}
                              style={ss.inp}
                            >
                              <option value="">Any project</option>
                              {projects.slice(0, 300).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name || p.id}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="ptw-rule-card__clause-actions">
                            <button type="button" onClick={() => onMoveClause(rule.id, idx, "up")} style={{ ...ss.btn, fontSize: 11, padding: "3px 8px" }} disabled={idx === 0}>
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveClause(rule.id, idx, "down")}
                              style={{ ...ss.btn, fontSize: 11, padding: "3px 8px" }}
                              disabled={idx === clauses.length - 1}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveClause(rule.id, idx)}
                              style={{ ...ss.btn, fontSize: 11, padding: "3px 8px", color: "#A32D2D", borderColor: "#F09595" }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </section>

                  <div className="ptw-rule-card__arrow" aria-hidden="true">
                    →
                  </div>

                  <section className="ptw-rule-card__then" aria-label="THEN action">
                    <div className="ptw-rule-card__block-label">THEN</div>
                    <div className="ptw-rule-card__then-grid">
                      <div>
                        <label style={{ ...ss.lbl, marginBottom: 4 }} htmlFor="permit-conditional-rules-board-action">Action</label>
                        <select value={rule.action || "required"} onChange={(e) => onUpdateRule(rule.id, { action: e.target.value })} style={ss.inp} id="permit-conditional-rules-board-action">
                          <option value="required">{labelRuleAction("required")}</option>
                          <option value="optional">{labelRuleAction("optional")}</option>
                          <option value="show">{labelRuleAction("show")}</option>
                          <option value="hide">{labelRuleAction("hide")}</option>
                          <option value="block">{labelRuleAction("block")}</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ ...ss.lbl, marginBottom: 4 }} htmlFor="permit-conditional-rules-board-then-field">Field</label>
                        <select value={rule.thenField || ""} onChange={(e) => onUpdateRule(rule.id, { thenField: e.target.value })} style={ss.inp} id="permit-conditional-rules-board-then-field">
                          {fieldCatalog.map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ ...ss.lbl, marginBottom: 4 }} htmlFor="permit-conditional-rules-board-message">Block message</label>
                        <input
                          value={rule.message || ""}
                          onChange={(e) => onUpdateRule(rule.id, { message: e.target.value })}
                          placeholder="Shown when action = block"
                          style={ss.inp}
                         id="permit-conditional-rules-board-message" />
                      </div>
                    </div>
                  </section>
                </div>

                <footer className="ptw-rule-card__foot">
                  <span className="ptw-rule-card__id">ID: {rule.id}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveRule(rule.id)}
                    style={{ ...ss.btn, fontSize: 12, color: "#A32D2D", borderColor: "#F09595" }}
                  >
                    Remove rule
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
