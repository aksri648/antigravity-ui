import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Key,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Database,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { apiUrl } from "../../config/api";
import { supabase, getSupabaseConfig, updateSupabaseClient } from "../../config/supabase";

interface AuthViewProps {
  initialMode?: "signin" | "signup";
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
  onClose?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialMode = "signin",
  onAuthSuccess,
  onContinueAsGuest,
  onClose,
}) => {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [daytonaApiKey, setDaytonaApiKey] = useState(() => localStorage.getItem("daytona_api_key") || "");
  const [daytonaServerUrl] = useState(() => localStorage.getItem("daytona_server_url") || "https://app.daytona.io/api");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase Custom Configuration
  const [supaConfig, setSupaConfig] = useState(getSupabaseConfig);
  const [supaUrlInput, setSupaUrlInput] = useState(supaConfig.url);
  const [supaKeyInput, setSupaKeyInput] = useState(supaConfig.anonKey);

  useEffect(() => {
    // Listen for Supabase auth state change (e.g., OAuth redirects)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const token = session.access_token;
        const userObj = {
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || "",
          daytonaApiKey: session.user.user_metadata?.daytona_api_key || daytonaApiKey || undefined,
          daytonaServerUrl: session.user.user_metadata?.daytona_server_url || daytonaServerUrl || undefined,
        };

        localStorage.setItem("auth_token", token);
        localStorage.setItem("daytona_user_id", userObj.id);
        localStorage.setItem("user_email", userObj.email);
        if (userObj.name) localStorage.setItem("user_name", userObj.name);
        if (userObj.daytonaApiKey) localStorage.setItem("daytona_api_key", userObj.daytonaApiKey);

        onAuthSuccess({ token, user: userObj });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [daytonaApiKey, daytonaServerUrl, onAuthSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Try Supabase Auth First if configured
    if (supaConfig.isConfigured) {
      try {
        if (mode === "signup") {
          const { data, error: supaErr } = await supabase.auth.signUp({
            email: email.trim(),
            password: password.trim(),
            options: {
              data: {
                name: name.trim(),
                daytona_api_key: daytonaApiKey.trim(),
                daytona_server_url: daytonaServerUrl.trim(),
              },
            },
          });
          if (supaErr) throw supaErr;

          if (data.session) {
            const userObj = {
              id: data.user?.id || `user-${Date.now()}`,
              email: data.user?.email || email.trim(),
              name: name.trim(),
              daytonaApiKey: daytonaApiKey.trim(),
              daytonaServerUrl: daytonaServerUrl.trim(),
            };
            localStorage.setItem("auth_token", data.session.access_token);
            localStorage.setItem("daytona_user_id", userObj.id);
            localStorage.setItem("user_email", userObj.email);
            if (userObj.name) localStorage.setItem("user_name", userObj.name);
            if (userObj.daytonaApiKey) localStorage.setItem("daytona_api_key", userObj.daytonaApiKey);

            onAuthSuccess({ token: data.session.access_token, user: userObj });
            return;
          }
        } else {
          const { data, error: supaErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });
          if (supaErr) throw supaErr;

          if (data.session && data.user) {
            const userObj = {
              id: data.user.id,
              email: data.user.email || email.trim(),
              name: data.user.user_metadata?.name || "",
              daytonaApiKey: data.user.user_metadata?.daytona_api_key || daytonaApiKey || undefined,
              daytonaServerUrl: data.user.user_metadata?.daytona_server_url || daytonaServerUrl || undefined,
            };
            localStorage.setItem("auth_token", data.session.access_token);
            localStorage.setItem("daytona_user_id", userObj.id);
            localStorage.setItem("user_email", userObj.email);
            if (userObj.name) localStorage.setItem("user_name", userObj.name);

            onAuthSuccess({ token: data.session.access_token, user: userObj });
            return;
          }
        }
      } catch (supaErr: any) {
        console.warn("Supabase auth error, falling back to backend REST endpoint:", supaErr);
      }
    }

    // 2. Backend REST API fallback
    const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
    const payload = mode === "signup"
      ? { email: email.trim(), password: password.trim(), name: name.trim(), daytonaApiKey, daytonaServerUrl }
      : { email: email.trim(), password: password.trim() };

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

  const handleGoogleOAuth = async () => {
    if (supaConfig.isConfigured) {
      try {
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (oauthErr) throw oauthErr;
      } catch (err: any) {
        setError(err.message || "Failed to start Google OAuth with Supabase.");
      }
    } else {
      setError("Please configure your Supabase URL & Anon Key under Advanced Settings to enable Google OAuth.");
    }
  };

  const handleSaveSupabaseConfig = () => {
    updateSupabaseClient(supaUrlInput.trim(), supaKeyInput.trim());
    setSupaConfig(getSupabaseConfig());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#141418] p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-black shadow-lg shadow-emerald-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-mono">
            {mode === "signup" ? "Create DELTA Account" : "Welcome Back"}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-400">
              <Database className="h-2.5 w-2.5 mr-1 inline" /> {supaConfig.isConfigured ? "Supabase Auth & DB" : "SQLite Cloud Hybrid"}
            </Badge>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex rounded-full bg-black/60 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              mode === "signin" ? "bg-white text-black shadow-md font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              mode === "signup" ? "bg-white text-black shadow-md font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-emerald-400" /> Full Name
              </label>
              <Input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-black/60 border-white/10 text-white text-xs h-10"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-emerald-400" /> Email Address *
            </label>
            <Input
              type="email"
              placeholder="developer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/60 border-white/10 text-white text-xs h-10"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-400" /> Password *
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/60 border-white/10 text-white text-xs h-10 pr-9"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Optional Daytona Key on Signup */}
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-emerald-400" /> Daytona API Key (Optional)
                </span>
                <span className="text-[10px] text-gray-500 font-normal">Can configure later</span>
              </label>
              <Input
                type="password"
                placeholder="daytona_sec_xxxxxxxxxxxx"
                value={daytonaApiKey}
                onChange={(e) => setDaytonaApiKey(e.target.value)}
                className="font-mono bg-black/60 border-white/10 text-white text-xs h-10"
              />
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-full shadow-lg shadow-emerald-500/20 text-xs transition-all gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {mode === "signup" ? "Create Account & Enter" : "Sign In to Workspace"}
          </Button>

          {/* Google OAuth Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleGoogleOAuth}
              className="w-full h-10 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        </form>

        {/* Collapsible Supabase Configuration */}
        <div className="border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-gray-400 hover:text-emerald-400 flex items-center justify-between w-full cursor-pointer"
          >
            <span>Supabase Cloud DB & Auth Settings</span>
            <span>{showAdvanced ? "▲" : "▼"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-black/50 p-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Supabase Project URL</label>
                <Input
                  placeholder="https://your-project.supabase.co"
                  value={supaUrlInput}
                  onChange={(e) => setSupaUrlInput(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-white/10 text-emerald-300 h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Supabase Anon / Public Key</label>
                <Input
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={supaKeyInput}
                  onChange={(e) => setSupaKeyInput(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-white/10 text-emerald-300 h-8"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveSupabaseConfig}
                className="w-full h-7 text-[11px] bg-white text-black hover:bg-gray-200 font-bold rounded-lg"
              >
                Apply Supabase Config
              </Button>
            </div>
          )}
        </div>

        {/* Guest Access Alternative */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="text-xs text-gray-400 hover:text-white transition-colors underline cursor-pointer"
          >
            Continue as Guest (Ephemeral Sandbox Session)
          </button>
        </div>
      </div>
    </div>
  );
};
