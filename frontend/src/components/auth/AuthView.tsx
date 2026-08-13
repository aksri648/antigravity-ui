import React, { useState } from "react";
import {
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Key,
  Server,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { apiUrl } from "../../config/api";

interface AuthViewProps {
  onAuthSuccess: (authData: {
    token: string;
    user: {
      id: string;
      email: string;
      name?: string;
      daytonaApiKey?: string;
      daytonaServerUrl?: string;
    };
    activeSandbox?: {
      id: string;
      daytonaSandboxId: string;
      previewUrl?: string;
      activePort?: number;
    };
  }) => void;
  onContinueAsGuest: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess, onContinueAsGuest }) => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [daytonaApiKey, setDaytonaApiKey] = useState(() => localStorage.getItem("daytona_api_key") || "");
  const [daytonaServerUrl, setDaytonaServerUrl] = useState(() => localStorage.getItem("daytona_server_url") || "https://app.daytona.io/api");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
    const payload = mode === "signup"
      ? { email, password, name, daytonaApiKey, daytonaServerUrl }
      : { email, password };

    try {
      const res = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed. Please check your credentials.");
      }

      // Save token and user details to localStorage
      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }
      if (data.user) {
        localStorage.setItem("daytona_user_id", data.user.id);
        localStorage.setItem("user_email", data.user.email);
        if (data.user.name) localStorage.setItem("user_name", data.user.name);
        if (data.user.daytonaApiKey) localStorage.setItem("daytona_api_key", data.user.daytonaApiKey);
        if (data.user.daytonaServerUrl) localStorage.setItem("daytona_server_url", data.user.daytonaServerUrl);
      }
      if (data.activeSandbox?.daytonaSandboxId) {
        localStorage.setItem("daytona_sandbox_id", data.activeSandbox.daytonaSandboxId);
      }

      onAuthSuccess(data);
    } catch (err: any) {
      setError(err.message || "Unable to reach authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail("developer@example.com");
    setPassword("daytona2026");
    setMode("signin");
    setLoading(true);
    setError(null);

    try {
      // First try login
      let res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "developer@example.com", password: "daytona2026" }),
      });

      let data = await res.json();

      // If account doesn't exist, auto-register demo account
      if (!res.ok) {
        res = await fetch(apiUrl("/api/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "developer@example.com",
            password: "daytona2026",
            name: "Demo Developer",
            daytonaApiKey: daytonaApiKey || "dtn_demo_key",
            daytonaServerUrl: daytonaServerUrl,
          }),
        });
        data = await res.json();
      }

      if (data.token) {
        localStorage.setItem("auth_token", data.token);
        if (data.user) {
          localStorage.setItem("daytona_user_id", data.user.id);
          localStorage.setItem("user_email", data.user.email);
        }
        onAuthSuccess(data);
      } else {
        onContinueAsGuest();
      }
    } catch {
      onContinueAsGuest();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl space-y-6">
        {/* SaaS Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-1">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {mode === "signin" ? "Welcome back to AGY Cloud" : "Create your SaaS Account"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {mode === "signin"
              ? "Access your isolated Daytona sandbox microVM and persistent AI workspaces."
              : "Deploy autonomous AI agents in your own dedicated cloud sandbox container."}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 border border-border">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); }}
            className={`rounded-md py-1.5 text-xs font-semibold transition-all ${
              mode === "signin"
                ? "bg-card text-white shadow-sm"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`rounded-md py-1.5 text-xs font-semibold transition-all ${
              mode === "signup"
                ? "bg-card text-white shadow-sm"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="developer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              {mode === "signin" && (
                <span className="text-[11px] text-blue-400 cursor-pointer hover:underline">
                  Forgot password?
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-9 pr-9 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Optional Daytona Credentials on Sign Up */}
          {mode === "signup" && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Zap className="h-3 w-3" />
                {showAdvanced ? "Hide Daytona Sandbox Settings" : "Configure Daytona API Key (Optional)"}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-3 animate-in fade-in">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Key className="h-3 w-3 text-blue-400" /> Daytona API Key
                    </label>
                    <Input
                      type="password"
                      placeholder="dtn_xxxxxxxxxxxxxxxx"
                      value={daytonaApiKey}
                      onChange={(e) => setDaytonaApiKey(e.target.value)}
                      className="text-xs font-mono h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Server className="h-3 w-3 text-indigo-400" /> Daytona Server URL
                    </label>
                    <Input
                      type="text"
                      placeholder="https://app.daytona.io/api"
                      value={daytonaServerUrl}
                      onChange={(e) => setDaytonaServerUrl(e.target.value)}
                      className="text-xs font-mono h-8"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 text-xs gap-1.5 shadow-lg shadow-blue-600/20"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {mode === "signin" ? "Authenticating..." : "Creating Account & Provisioning..."}
              </>
            ) : (
              <>
                {mode === "signin" ? "Sign In to Workspace" : "Create Account & Start Building"}
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-border" />
          <span className="bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            or continue with
          </span>
        </div>

        {/* Alternative Quick Launch Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleDemoLogin}
            disabled={loading}
            className="h-9 text-xs border-border hover:bg-accent text-white gap-1.5"
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" /> Demo Account
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onContinueAsGuest}
            disabled={loading}
            className="h-9 text-xs border-border hover:bg-accent text-muted-foreground hover:text-white gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Guest Mode
          </Button>
        </div>
      </div>
    </div>
  );
};
