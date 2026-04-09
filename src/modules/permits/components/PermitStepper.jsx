export default function PermitStepper({ current = 1 }) {
  const steps = [
    "Type and scope",
    "Controls and checklist",
    "People and timing",
    "Preview and issue",
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:6, marginBottom:12 }}>
      {steps.map((label, idx) => {
        const stepNo = idx + 1;
        const active = current === stepNo;
        const complete = current > stepNo;
        return (
          <div key={label} style={{
            borderRadius:8,
            border:`1px solid ${active ? "#0d9488" : "var(--color-border-tertiary,#e5e5e5)"}`,
            background: complete ? "#EAF3DE" : active ? "#E6F1FB" : "var(--color-background-secondary,#f7f7f5)",
            padding:"6px 8px",
            fontSize:11,
          }}>
            <div style={{ fontWeight:600, marginBottom:2 }}>{stepNo}. {label}</div>
            <div style={{ color:"var(--color-text-secondary)" }}>{complete ? "Done" : active ? "Current" : "Upcoming"}</div>
          </div>
        );
      })}
    </div>
  );
}

