export default function PermitTimeline({ permits, renderRow }) {
  if (permits.length === 0) {
    return (
      <div className="app-panel-surface" style={{ borderRadius:10, padding:12, fontSize:12, color:"var(--color-text-secondary)" }}>
        No permits to display.
      </div>
    );
  }
  return (
    <div className="app-panel-surface" style={{ borderRadius:10, padding:12 }}>
      <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Timeline</div>
      {permits.map((permit) => renderRow(permit))}
    </div>
  );
}

