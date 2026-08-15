import React, { useState } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { apiUrl } from "../../config/api";
import { getClerkPublishableKey, setClerkPublishableKey, isClerkConfigured } from "../../config/clerk";
import { useSignIn, useSignUp, useUser, useClerk } from "@clerk/clerk-react";

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

  // Clerk Configuration State
  const [clerkKeyInput, setClerkKeyInput] = useState(getClerkPublishableKey());
  const isClerkActive = isClerkConfigured();

  // Clerk Hooks
  const { signIn, isLoaded: isSignInLoaded, setActive: setSignInActive } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded, setActive: setSignUpActive } = useSignUp();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const { openSignIn } = useClerk();

  // Auto-sync when signed in with Clerk
  React.useEffect(() => {
    if (isUserLoaded && clerkUser) {
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress || "";
      const fullName = clerkUser.fullName || clerkUser.firstName || "";
      const userObj = {
        id: clerkUser.id,
        email: primaryEmail,
        name: fullName,
        daytonaApiKey: (clerkUser.publicMetadata?.daytonaApiKey as string) || daytonaApiKey || undefined,
        daytonaServerUrl: (clerkUser.publicMetadata?.daytonaServerUrl as string) || daytonaServerUrl || undefined,
      };

      const token = `clerk_${clerkUser.id}_${Date.now()}`;
      localStorage.setItem("auth_token", token);
      localStorage.setItem("daytona_user_id", userObj.id);
      localStorage.setItem("user_email", userObj.email);
      if (userObj.name) localStorage.setItem("user_name", userObj.name);
      if (userObj.daytonaApiKey) localStorage.setItem("daytona_api_key", userObj.daytonaApiKey);

      onAuthSuccess({ token, user: userObj });
    }
  }, [clerkUser, isUserLoaded, daytonaApiKey, daytonaServerUrl, onAuthSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Try Clerk Authentication first if loaded
    if (mode === "signin" && isSignInLoaded && signIn) {
      try {
        const result = await signIn.create({
          identifier: email.trim(),
          password: password.trim(),
        });

        if (result.status === "complete" && result.createdSessionId) {
          if (setSignInActive) {
            await setSignInActive({ session: result.createdSessionId });
          }
          return;
        }
      } catch (clerkErr: any) {
        console.warn("Clerk sign in error, checking backend fallback:", clerkErr);
      }
    } else if (mode === "signup" && isSignUpLoaded && signUp) {
      try {
        const result = await signUp.create({
          emailAddress: email.trim(),
          password: password.trim(),
          firstName: name.trim(),
        });

        if (result.status === "complete" && result.createdSessionId) {
          if (setSignUpActive) {
            await setSignUpActive({ session: result.createdSessionId });
          }
          return;
        }
      } catch (clerkErr: any) {
        console.warn("Clerk sign up error, checking backend fallback:", clerkErr);
      }
    }

    // 2. Fallback to Backend REST API (PostgreSQL / Local Auth)
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

  const handleClerkModal = () => {
    if (openSignIn) {
      openSignIn();
    }
  };

  const handleSaveClerkKey = () => {
    setClerkPublishableKey(clerkKeyInput.trim());
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md px-6 py-10 sm:px-12 sm:py-16 md:px-24 md:py-20 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-[380px] my-auto rounded-2xl border border-white/10 bg-[#121216] p-5 sm:p-6 shadow-2xl shadow-black/90 space-y-4 font-sans">
        
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Compact Header */}
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-black shadow-md shadow-emerald-500/20">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white font-mono">
            {mode === "signup" ? "Create DELTA Account" : "Welcome Back"}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-400 py-0 px-1.5">
              <ShieldCheck className="h-2.5 w-2.5 mr-1 inline" /> {isClerkActive ? "Clerk Security & Auth" : "DELTA Cloud Auth"}
            </Badge>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex rounded-lg bg-black/50 p-0.5 border border-white/10">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); }}
            className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              mode === "signin" ? "bg-white text-black shadow-sm font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              mode === "signup" ? "bg-white text-black shadow-sm font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-2.5 text-[11px] text-red-300 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {/* Primary Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-300 flex items-center gap-1">
                <UserIcon className="h-3 w-3 text-emerald-400" /> Full Name
              </label>
              <Input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono text-xs bg-black/50 border-white/10 text-white placeholder:text-gray-600 h-8.5 rounded-lg focus:border-emerald-500/50"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-300 flex items-center gap-1">
              <Mail className="h-3 w-3 text-emerald-400" /> Email Address
            </label>
            <Input
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-mono text-xs bg-black/50 border-white/10 text-white placeholder:text-gray-600 h-8.5 rounded-lg focus:border-emerald-500/50"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-emerald-400" /> Password
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-gray-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer font-mono"
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPassword ? "Hide" : "Show"}
              </button>
            </label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono text-xs bg-black/50 border-white/10 text-white placeholder:text-gray-600 h-8.5 rounded-lg focus:border-emerald-500/50"
              required
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="h-3 w-3 text-emerald-400" /> Daytona API Key (Optional)
                </span>
              </label>
              <Input
                type="password"
                placeholder="daytona_api_key_..."
                value={daytonaApiKey}
                onChange={(e) => setDaytonaApiKey(e.target.value)}
                className="font-mono text-xs bg-black/50 border-white/10 text-emerald-300 placeholder:text-gray-600 h-8.5 rounded-lg focus:border-emerald-500/50"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-bold h-9 text-xs shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 rounded-lg cursor-pointer transition-all"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-1.5" />
            )}
            {mode === "signup" ? "Create Account" : "Sign In to DELTA"}
          </Button>
        </form>

        {/* Social / Clerk Quick Auth Button */}
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleClerkModal}
            className="w-full h-8 text-[11px] font-mono border-white/10 bg-black/40 text-gray-200 hover:bg-white/5 hover:text-white rounded-lg cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
            Sign In with Clerk / Google / GitHub
          </Button>
        </div>

        {/* Collapsible Clerk Publishable Key Settings */}
        <div className="border-t border-white/10 pt-2.5">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[10px] text-gray-400 hover:text-emerald-400 flex items-center justify-between w-full cursor-pointer font-mono"
          >
            <span>Clerk Auth Key Settings</span>
            <span className="text-[9px]">{showAdvanced ? "▲" : "▼"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/40 p-2.5 text-[11px]">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Clerk Publishable Key (pk_test_... or pk_live_...)</label>
                <Input
                  placeholder="pk_test_..."
                  value={clerkKeyInput}
                  onChange={(e) => setClerkKeyInput(e.target.value)}
                  className="font-mono text-[11px] bg-black/50 border-white/10 text-emerald-300 h-7.5 rounded"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveClerkKey}
                className="w-full h-7 text-[10px] bg-white text-black hover:bg-gray-200 font-bold rounded cursor-pointer"
              >
                Apply Clerk Key
              </Button>
            </div>
          )}
        </div>

        {/* Guest Access Alternative */}
        <div className="text-center pt-0.5">
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="text-[11px] text-gray-400 hover:text-white transition-colors underline cursor-pointer font-mono"
          >
            Continue as Guest (Offline Mode)
          </button>
        </div>

      </div>
    </div>
  );
};
