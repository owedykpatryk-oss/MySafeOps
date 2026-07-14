import { useMemo, useState } from "react";
import {
  labelWorkflowState,
  PERMIT_WORKFLOW_NODE_LAYOUT,
  PERMIT_WORKFLOW_STATES,
} from "../permitWorkflowLabels";

const NODE_W = 112;
const NODE_H = 44;

function edgePath(fromKey, toKey) {
  const from = PERMIT_WORKFLOW_NODE_LAYOUT[fromKey];
  const to = PERMIT_WORKFLOW_NODE_LAYOUT[toKey];
  if (!from || !to) return "";

  const x1 = from.x;
  const y1 = from.y;
  const x2 = to.x;
  const y2 = to.y;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = x1 + dx * 0.45;
  const cy = y1 + dy * 0.15;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export default function PermitWorkflowDesigner({
  states = PERMIT_WORKFLOW_STATES,
  policy = {},
  onToggle,
  compact = false,
}) {
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [view, setView] = useState(compact ? "list" : "visual");

  const edges = useMemo(() => {
    const list = [];
    states.forEach((from) => {
      states.forEach((to) => {
        if (from === to) return;
        list.push({ from, to, enabled: (policy[from] || []).includes(to) });
      });
    });
    return list;
  }, [states, policy]);

  const handleNodeClick = (state) => {
    if (selectedFrom === state) {
      setSelectedFrom(null);
      return;
    }
    if (!selectedFrom) {
      setSelectedFrom(state);
      return;
    }
    onToggle?.(selectedFrom, state);
  };

  const handleEdgeClick = (from, to) => {
    onToggle?.(from, to);
  };

  return (
    <div className="ptw-workflow-designer">
      <div className="ptw-workflow-designer__toolbar">
        <span className="ptw-workflow-designer__hint">
          {selectedFrom
            ? `Select target for “${labelWorkflowState(selectedFrom)}” — click a state to toggle transition`
            : "Click a state, then another to toggle allowed transitions — or click a connector line"}
        </span>
        {!compact ? (
          <div className="ptw-workflow-designer__view-toggle" role="group" aria-label="Workflow view">
            <button
              type="button"
              className={`ptw-workflow-designer__view-btn${view === "visual" ? " ptw-workflow-designer__view-btn--active" : ""}`}
              onClick={() => setView("visual")}
            >
              Visual
            </button>
            <button
              type="button"
              className={`ptw-workflow-designer__view-btn${view === "list" ? " ptw-workflow-designer__view-btn--active" : ""}`}
              onClick={() => setView("list")}
            >
              List
            </button>
          </div>
        ) : null}
      </div>

      {view === "visual" ? (
        <div className="ptw-workflow-designer__canvas-wrap">
          <svg
            className="ptw-workflow-designer__canvas"
            viewBox="0 0 720 260"
            role="img"
            aria-label="Permit workflow transition diagram"
          >
            {edges.map(({ from, to, enabled }) => (
              <g key={`edge-${from}-${to}`}>
                <path
                  d={edgePath(from, to)}
                  className={`ptw-workflow-designer__edge${enabled ? " ptw-workflow-designer__edge--on" : ""}`}
                  fill="none"
                  pointerEvents="none"
                />
                <path
                  d={edgePath(from, to)}
                  className="ptw-workflow-designer__edge-hit"
                  fill="none"
                  onClick={() => handleEdgeClick(from, to)}
                  aria-hidden="true"
                />
              </g>
            ))}
            {states.map((state) => {
              const pos = PERMIT_WORKFLOW_NODE_LAYOUT[state];
              if (!pos) return null;
              const isSelected = selectedFrom === state;
              const outgoing = (policy[state] || []).length;
              return (
                <g key={`node-${state}`} transform={`translate(${pos.x - NODE_W / 2}, ${pos.y - NODE_H / 2})`}>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={10}
                    className={`ptw-workflow-designer__node${isSelected ? " ptw-workflow-designer__node--selected" : ""}`}
                    onClick={() => handleNodeClick(state)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleNodeClick(state);
                      }
                    }}
                  />
                  <text x={NODE_W / 2} y={18} className="ptw-workflow-designer__node-label" pointerEvents="none">
                    {labelWorkflowState(state)}
                  </text>
                  <text x={NODE_W / 2} y={34} className="ptw-workflow-designer__node-meta" pointerEvents="none">
                    {outgoing} next
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="ptw-workflow-designer__list">
          {states.map((from) => (
            <div key={`wf-list-${from}`} className="ptw-workflow-designer__list-row">
              <div className="ptw-workflow-designer__list-from">{labelWorkflowState(from)}</div>
              <div className="ptw-workflow-designer__list-targets">
                {states.map((to) => {
                  const enabled = (policy[from] || []).includes(to);
                  if (from === to) return null;
                  return (
                    <button
                      key={`wf-list-${from}-${to}`}
                      type="button"
                      className={`ptw-workflow-designer__chip${enabled ? " ptw-workflow-designer__chip--on" : ""}`}
                      onClick={() => onToggle?.(from, to)}
                    >
                      {labelWorkflowState(to)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
