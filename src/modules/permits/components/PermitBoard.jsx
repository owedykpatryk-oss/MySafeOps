export default function PermitBoard({ columns, permitsByColumn, renderPermit, compact = false }) {
  return (
    <div
      style={
        compact
          ? { display:"grid", gridAutoFlow:"column", gridAutoColumns:"minmax(240px, 86vw)", gap:10, overflowX:"auto", paddingBottom:6 }
          : { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))", gap:10 }
      }
    >
      {columns.map((col) => {
        const colPermits = permitsByColumn[col.id] || [];
        return (
          <div key={col.id} className="app-panel-surface" style={{ borderRadius:10, padding:10, minHeight:220 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:600 }}>{col.label}</div>
              <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, background:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)" }}>
                {colPermits.length}
              </span>
            </div>
            {colPermits.length === 0 ? (
              <div style={{ fontSize:12, color:"var(--color-text-secondary)", padding:"8px 0" }}>No permits</div>
            ) : (
              colPermits.map((p) => renderPermit(p))
            )}
          </div>
        );
      })}
    </div>
  );
}

