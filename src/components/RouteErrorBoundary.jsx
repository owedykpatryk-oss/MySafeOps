import { Component } from "react";
import { getSupportEmail } from "../config/supportContact";
import { captureSentryException } from "../utils/sentryClient.js";
import { isChunkLoadError, reloadOnceForStaleChunk } from "../utils/chunkLoadError.js";
import { logOpsEvent } from "../utils/clientOpsMonitor.js";

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, staleChunk: false };
  }

  static getDerivedStateFromError(error) {
    return { error, staleChunk: isChunkLoadError(error) };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error("[RouteErrorBoundary]", error, errorInfo);
    }
    try {
      logOpsEvent({
        level: "critical",
        source: "RouteErrorBoundary",
        message: error?.message || String(error),
        stack: error?.stack,
        meta: { componentStack: errorInfo?.componentStack },
      });
    } catch {
      /* ignore */
    }
    captureSentryException(error, { extra: { componentStack: errorInfo?.componentStack } });
    if (isChunkLoadError(error)) {
      reloadOnceForStaleChunk();
    }
  }

  render() {
    if (this.state.error) {
      const support = getSupportEmail();
      const stale = this.state.staleChunk;
      return (
        <div
          role="alert"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            fontFamily: "DM Sans, system-ui, sans-serif",
            padding: "2rem 1.25rem",
            background: "var(--color-background-tertiary, #f8fafc)",
          }}
        >
          <div
            className="app-surface-card"
            style={{
              maxWidth: 520,
              width: "100%",
              textAlign: "center",
              padding: "1.5rem 1.25rem",
              borderRadius: 12,
              border: "1px solid var(--color-border-tertiary, #e2e8f0)",
              background: "var(--color-background-primary, #fff)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "#791F1F", marginBottom: 8 }}>
              {stale ? "App update detected" : "Something went wrong"}
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              {stale
                ? "This screen uses an older cached file from before the last update. Reload the page to load the latest version."
                : "Something broke on our end. We've been notified. Try refreshing, or contact support if it continues."}
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
              Need help?{" "}
              <a href={`mailto:${support}`} style={{ color: "#0d9488", fontWeight: 600 }}>
                {support}
              </a>
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {stale ? (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "0.5px solid #085041",
                    background: "#0d9488",
                    color: "#E1F5EE",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  Reload page
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => this.setState({ error: null, staleChunk: false })}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "0.5px solid #085041",
                    background: "#0d9488",
                    color: "#E1F5EE",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
