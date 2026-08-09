import { memo } from "react";

/** Presentational pieces used by more than one management tab. */

export const MetricCard = memo(function MetricCard({ icon: Icon, value, label, tone = "default", detail, onClick, actionLabel }) {
  const body = (
    <>
      <span className="mgo-metric__icon"><Icon size={18} /></span>
      <div><strong>{value}</strong><span>{label}</span></div>
      {detail ? <small>{detail}</small> : null}
    </>
  );
  if (!onClick) return <article className={`mgo-metric mgo-metric--${tone}`}>{body}</article>;
  return (
    <button type="button" className={`mgo-metric mgo-metric--${tone} mgo-metric--action`} onClick={onClick} aria-label={actionLabel || `${value} ${label}`}>
      {body}
    </button>
  );
});

export const ReadinessRing = memo(function ReadinessRing({ value, size = "normal" }) {
  const tone = value === 100 ? "green" : value < 50 ? "red" : "amber";
  return (
    <span className={`mgo-readiness mgo-readiness--${tone} mgo-readiness--${size}`} style={{ "--readiness": `${value * 3.6}deg` }}>
      <span>{value}%</span>
    </span>
  );
});
