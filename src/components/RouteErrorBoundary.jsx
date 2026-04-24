import { Component } from "react";
import { getSupportEmail } from "../config/supportContact";

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error("[RouteErrorBoundary]", error, errorInfo);
    }
    if (import.meta.env.VITE_SENTRY_DSN?.trim()) {
      void import("@sentry/react")
        .then((Sentry) => {
          Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
        })
        .catch(() => {});
    }
  }

  render() {
    if (this.state.error) {
      const support = getSupportEmail();
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
          <div style={{ fontSize: 16, fontWeight: 600, color: "#791F1F", marginBottom: 8 }}>Something went wrong</div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
            This screen failed to load. Try again, or refresh the page if the problem continues.
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
            Need help?{" "}
            <a href={`mailto:${support}`} style={{ color: "#0d9488", fontWeight: 600 }}>
              {support}
            </a>
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
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
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
