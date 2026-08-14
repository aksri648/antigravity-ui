import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global Error Boundary to prevent full-screen white crash
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DELTA] Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c0c0e",
          color: "#e5e7eb",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: "2rem",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem", color: "#f87171" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#9ca3af", maxWidth: "480px", marginBottom: "1.5rem" }}>
            DELTA encountered an unexpected error. Your data is safe.
          </p>
          <pre style={{
            fontSize: "0.75rem",
            color: "#6b7280",
            background: "#1a1a1e",
            padding: "1rem",
            borderRadius: "0.5rem",
            maxWidth: "600px",
            overflow: "auto",
            marginBottom: "1.5rem",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1.5rem",
              background: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            Reload DELTA
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
