import { memo } from "react";

/** Animated GPR-style wave decoration for hero and empty states. */
function GprWaveBackdrop({ className = "" }) {
  return (
    <div className={`app-gpr-wave-backdrop ${className}`.trim()} aria-hidden>
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="app-gpr-wave-backdrop__svg">
        <defs>
          <linearGradient id="gprWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0c447c" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#0d9488" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path
          className="app-gpr-wave-backdrop__path app-gpr-wave-backdrop__path--1"
          d="M0,60 C150,20 350,100 500,55 S850,15 1200,50 L1200,120 L0,120 Z"
          fill="url(#gprWaveGrad)"
        />
        <path
          className="app-gpr-wave-backdrop__path app-gpr-wave-backdrop__path--2"
          d="M0,75 C200,45 400,95 600,65 S900,35 1200,70 L1200,120 L0,120 Z"
          fill="#0c447c"
          opacity="0.04"
        />
      </svg>
      <div className="app-gpr-wave-backdrop__scanlines" />
    </div>
  );
}

export default memo(GprWaveBackdrop);
