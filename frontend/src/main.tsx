import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { getClerkPublishableKey } from './config/clerk'
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
          background: "#090a0f",
          color: "#f87171",
          fontFamily: "monospace",
          padding: "2rem",
          textAlign: "center"
        }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#ef4444" }}>
            DELTA Interface Error
          </h1>
          <p style={{ maxWidth: "600px", color: "#9ca3af", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
            {this.state.error?.message || "An unexpected error occurred in the workspace layout."}
          </p>
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

const clerkPublishableKey = getClerkPublishableKey();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: '#10b981',
            colorBackground: '#0a0a0a',
            colorText: '#ffffff',
          },
        }}
      >
        <App />
      </ClerkProvider>
    </ErrorBoundary>
  </StrictMode>,
)
