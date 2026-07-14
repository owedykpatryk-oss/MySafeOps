import { labelWorkflowState } from "../permitWorkflowLabels";

const ROLE_LABELS = {
  admin: "Admin",
  supervisor: "Supervisor",
  operative: "Operative",
};

export default function PermitWorkflowRoleMatrix({
  states = [],
  roles = [],
  policy = {},
  onToggle,
  compact = false,
}) {
  return (
    <div className={`ptw-role-matrix${compact ? " ptw-role-matrix--compact" : ""}`}>
      <div className="ptw-role-matrix__hint">
        Tick which roles may move permits <em>into</em> each workflow state.
      </div>
      <div className="ptw-role-matrix__table-wrap">
        <table className="ptw-role-matrix__table">
          <thead>
            <tr>
              <th scope="col">Target state</th>
              {roles.map((role) => (
                <th key={`role-col-${role}`} scope="col">
                  {ROLE_LABELS[role] || role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.map((target) => (
              <tr key={`role-row-${target}`}>
                <th scope="row">{labelWorkflowState(target)}</th>
                {roles.map((roleName) => {
                  const enabled = (policy[target] || []).includes(roleName);
                  return (
                    <td key={`role-cell-${target}-${roleName}`}>
                      <button
                        type="button"
                        className={`ptw-role-matrix__cell${enabled ? " ptw-role-matrix__cell--on" : ""}`}
                        onClick={() => onToggle?.(target, roleName)}
                        aria-pressed={enabled}
                        aria-label={`${labelWorkflowState(target)} — ${ROLE_LABELS[roleName] || roleName}: ${enabled ? "allowed" : "denied"}`}
                      >
                        {enabled ? "✓" : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
