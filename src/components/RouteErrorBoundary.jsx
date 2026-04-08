import { Component } from "react";

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            fontFamily: "DM Sans, system-ui, sans-serif",
            padding: "2rem 1.25rem",
            maxWidth: 520,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: "#791F1F", marginBottom: 8 }}>Something went wrong</div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
            This screen failed to load. Try again, or refresh the page if the problem continues.
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
      );
    }
    return this.props.children;
  }
}
