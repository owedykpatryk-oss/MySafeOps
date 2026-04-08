import { Link } from "react-router-dom";

export default function LandingTopSection({ navScrolled, cloud }) {
  return (
    <>
      <nav className={navScrolled ? "sc" : ""}>
        <div className="ctn">
          <div className="ni">
            <Link to="/" className="logo">
              <svg viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path
                  d="M2 14C2 10.5 4 8.5 6 7.8L20 2C21.2 1.6 22.8 1.6 24 2L38 7.8C40 8.5 42 10.5 42 14V30C42 42 24 50 22 51C20 50 2 42 2 30V14Z"
                  fill="#0d9488"
                  fillOpacity="0.12"
                  stroke="#0d9488"
                  strokeWidth="2.5"
                />
                <path d="M13 26L19 32L31 20" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="lt">
                <span>My</span>
                <span>Safe</span>
                <span>Ops</span>
              </div>
            </Link>
            <div className="nl">
              <a href="#features">Features</a>
              <a href="#roles">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#missing">Request Feature</a>
              <Link to="/login" className="btn btn-o nc">
                Sign in
              </Link>
              <Link to="/login" className="btn btn-p nc">
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="ctn">
          <div className="hg">
            <div>
              <div className="badge hb">🏗️ Built for UK Construction</div>
              <h1>
                Site safety,
                <br />
                <span className="hl">simplified.</span>
              </h1>
              <p>
                RAMS, Permits to Work, inspections, worker competency — all managed from your phone. UK-focused workflows for construction teams.{" "}
                {cloud ? "Cloud sign-in and backup are enabled for this deployment." : "Add Supabase in your environment for optional cloud backup."}
              </p>
              <div className="hbs">
                <Link to="/login" className="btn btn-p">
                  Get started →
                </Link>
                <a href="#features" className="btn btn-o">
                  See Features
                </a>
              </div>
              <div className="hs">
                <div>
                  <strong>14+</strong>
                  <span>Document Types</span>
                </div>
                <div>
                  <strong>7</strong>
                  <span>Permit Types</span>
                </div>
                <div>
                  <strong>30+</strong>
                  <span>Trade Libraries</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>Browser-first</span>
                </div>
              </div>
            </div>
            <div className="pw">
              <div className="pg" />
              <div className="ph">
                <div className="ps">
                  <div className="phd">
                    <div className="pl">⚙️ MySafeOps</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316" }} />
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sl4)" }} />
                    </div>
                  </div>
                  <div className="pb">
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>📊 Dashboard</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, textAlign: "center", borderLeft: "3px solid #f97316" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>12</div>
                        <div style={{ fontSize: 7, color: "#64748b" }}>RAMS</div>
                      </div>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, textAlign: "center", borderLeft: "3px solid #a78bfa" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>8</div>
                        <div style={{ fontSize: 7, color: "#64748b" }}>Permits</div>
                      </div>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, textAlign: "center", borderLeft: "3px solid #ef4444" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>2</div>
                        <div style={{ fontSize: 7, color: "#64748b" }}>Incidents</div>
                      </div>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, textAlign: "center", borderLeft: "3px solid #06b6d4" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>24</div>
                        <div style={{ fontSize: 7, color: "#64748b" }}>Workers</div>
                      </div>
                    </div>
                    <div className="pc">
                      <div className="pct">⚠️ RAMS — Welding/Hot Works</div>
                      <div className="pcs">RAMS-003 · Zone B · Approved ✅</div>
                      <div className="pcb">
                        <div style={{ width: "95%", background: "#22c55e" }} />
                      </div>
                    </div>
                    <div className="pc" style={{ borderLeftColor: "#3b82f6" }}>
                      <div className="pct" style={{ color: "#3b82f6" }}>
                        🏗️ Height PTW — Roof Access
                      </div>
                      <div className="pcs">PTW-007 · 6h remaining</div>
                      <div className="pcb">
                        <div style={{ width: "70%", background: "#3b82f6" }} />
                      </div>
                    </div>
                    <div className="pc" style={{ borderLeftColor: "#ef4444" }}>
                      <div className="pct" style={{ color: "#ef4444" }}>
                        🚨 Near Miss Reported
                      </div>
                      <div className="pcs">INC-004 · Zone C · Pending review</div>
                      <div className="pcb">
                        <div style={{ width: "40%", background: "#eab308" }} />
                      </div>
                    </div>
                  </div>
                  <div className="pn">
                    <div>
                      <span>📊</span>Home
                    </div>
                    <div style={{ color: "#f97316" }}>
                      <span>📄</span>Docs
                    </div>
                    <div>
                      <span>👷</span>Workers
                    </div>
                    <div>
                      <span>🔧</span>Equip
                    </div>
                    <div>
                      <span>⚙️</span>More
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
