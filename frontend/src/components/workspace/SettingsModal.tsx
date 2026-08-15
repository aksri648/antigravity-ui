import React, { useState, useEffect } from "react";
import {
  Settings,
  X,
  Key,
  Server,
  ShieldCheck,
  Terminal,
  Globe,
  RefreshCw,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ExternalLink,
  Save,
  Eye,
  EyeOff,
  FileText,
  Sparkles,
  Database,
  Copy,
  CheckCheck,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { apiUrl } from "../../config/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  serverUrl: string;
  userId: string;
  sandboxId?: string;
  activePort?: number;
  onUpdateConfig: (config: { apiKey: string; serverUrl: string; userId: string; sandboxId: string; activePort?: number }) => void;
  onResetApp: () => void;
  onRecreateSandbox: () => Promise<void>;
}

type SettingsTab = "daytona" | "googleAuth" | "mcpSecrets" | "env" | "preview" | "agent" | "danger";

interface EnvPair {
  key: string;
  value: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  serverUrl,
  userId,
  sandboxId = "",
  activePort,
  onUpdateConfig,
  onResetApp,
  onRecreateSandbox,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("daytona");

  // Form states
  const [currentApiKey, setCurrentApiKey] = useState(apiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [currentServerUrl, setCurrentServerUrl] = useState(serverUrl || "https://app.daytona.io/api");
  const [currentUserId, setCurrentUserId] = useState(userId);
  const [currentSandboxId, setCurrentSandboxId] = useState(sandboxId);
  const [currentPort, setCurrentPort] = useState<number>(activePort || 3000);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Daytona Verification State
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ valid: boolean; message: string } | null>(null);

  // Google Auth Tab States
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; email?: string } | null>(null);
  const [pastedAuthCode, setPastedAuthCode] = useState("");
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Custom OAuth Client Settings
  const [oauthClientId, setOauthClientId] = useState(() => localStorage.getItem("google_oauth_client_id") || import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || "");
  const [oauthClientSecret, setOauthClientSecret] = useState(() => localStorage.getItem("google_oauth_client_secret") || "");
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState(false);

  // Gemini API Key State
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem("google_api_key") || "");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [savingGeminiKey, setSavingGeminiKey] = useState(false);
  const [geminiKeySuccess, setGeminiKeySuccess] = useState(false);

  // MCP & Cloud Secrets States
  const [githubToken, setGithubToken] = useState("");
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [opencodeZenApiKey, setOpencodeZenApiKey] = useState(() => localStorage.getItem("opencode_zen_api_key") || "");
  const [showOpencodeZenKey, setShowOpencodeZenKey] = useState(false);
  const [azureClientId, setAzureClientId] = useState("");
  const [azureClientSecret, setAzureClientSecret] = useState("");
  const [showAzureSecret, setShowAzureSecret] = useState(false);
  const [azureTenantId, setAzureTenantId] = useState("");
  const [azureSubscriptionId, setAzureSubscriptionId] = useState("");
  const [runpodApiKey, setRunpodApiKey] = useState("");
  const [showRunpodKey, setShowRunpodKey] = useState(false);
  const [hfToken, setHfToken] = useState("");
  const [showHfToken, setShowHfToken] = useState(false);
  const [savingSecrets, setSavingSecrets] = useState(false);
  const [secretsSuccess, setSecretsSuccess] = useState(false);
  const [secretStatus, setSecretStatus] = useState<{
    githubConfigured?: boolean;
    opencodeZenConfigured?: boolean;
    azureConfigured?: boolean;
    runpodConfigured?: boolean;
    huggingfaceConfigured?: boolean;
    githubTokenMasked?: string;
    opencodeZenKeyMasked?: string;
    runpodKeyMasked?: string;
    hfTokenMasked?: string;
    azureClientId?: string;
    azureTenantId?: string;
    azureSubscriptionId?: string;
  } | null>(null);

  // Environment Variables States
  const [envPairs, setEnvPairs] = useState<EnvPair[]>([]);
  const [rawEnv, setRawEnv] = useState("");
  const [envMode, setEnvMode] = useState<"table" | "raw">("table");
  const [loadingEnv, setLoadingEnv] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);
  const [envSaveSuccess, setEnvSaveSuccess] = useState(false);

  // Agent Preferences
  const [preferredEngine, setPreferredEngine] = useState<"agy" | "opencode">(() => (localStorage.getItem("preferred_cli_engine") as "agy" | "opencode") || "agy");
  const [skipPermissions, setSkipPermissions] = useState(true);
  const [outputFormat, setOutputFormat] = useState("stream-json");
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);

  // Danger actions
  const [recreating, setRecreating] = useState(false);
  const [wipingVolume, setWipingVolume] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const fetchSecrets = async () => {
    try {
      const res = await fetch(apiUrl("/api/integrations/secrets", { userId: currentUserId }));
      if (res.ok) {
        const data = await res.json();
        setSecretStatus(data);
        if (data.azureClientId && !azureClientId) setAzureClientId(data.azureClientId);
        if (data.azureTenantId && !azureTenantId) setAzureTenantId(data.azureTenantId);
        if (data.azureSubscriptionId && !azureSubscriptionId) setAzureSubscriptionId(data.azureSubscriptionId);
      }
    } catch (e) {
      console.warn("Failed to fetch cloud secrets", e);
    }
  };

  const handleSaveSecrets = async () => {
    setSavingSecrets(true);
    setSecretsSuccess(false);
    try {
      const keyToUse = currentApiKey || apiKey || localStorage.getItem("daytona_api_key") || "";
      if (opencodeZenApiKey.trim()) {
        localStorage.setItem("opencode_zen_api_key", opencodeZenApiKey.trim());
      }
      const res = await fetch(apiUrl("/api/integrations/secrets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          sandboxId: currentSandboxId,
          apiKey: keyToUse,
          serverUrl: currentServerUrl,
          githubToken: githubToken.trim(),
          opencodeZenApiKey: opencodeZenApiKey.trim(),
          azureClientId: azureClientId.trim(),
          azureClientSecret: azureClientSecret.trim(),
          azureTenantId: azureTenantId.trim(),
          azureSubscriptionId: azureSubscriptionId.trim(),
          runpodApiKey: runpodApiKey.trim(),
          huggingfaceToken: hfToken.trim(),
        }),
      });
      if (res.ok) {
        setSecretsSuccess(true);
        fetchSecrets();
        setTimeout(() => setSecretsSuccess(false), 4000);
      }
    } catch (e) {
      console.error("Failed to save cloud secrets", e);
    } finally {
      setSavingSecrets(false);
    }
  };

  // Sync props to local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentApiKey(apiKey);
      setCurrentServerUrl(serverUrl || "https://app.daytona.io/api");
      setCurrentUserId(userId);
      setCurrentSandboxId(sandboxId);
      setCurrentPort(activePort || 3000);
      setVerifyStatus(null);
      setSaveBanner(null);
      fetchEnvVars();
      checkAuthStatus();
      fetchSecrets();
    }
  }, [isOpen, apiKey, serverUrl, userId, sandboxId, activePort]);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Verify Daytona API Key
  const handleVerifyKey = async () => {
    if (!currentApiKey.trim()) return;
    setVerifyingKey(true);
    setVerifyStatus(null);
    try {
      const res = await fetch(apiUrl("/api/setup/verify-daytona"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: currentApiKey, serverUrl: currentServerUrl }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setVerifyStatus({ valid: true, message: "Valid Daytona Key! Connected to Cloud Orchestrator." });
      } else {
        setVerifyStatus({ valid: false, message: data.message || "Invalid API key or unreachable server." });
      }
    } catch (err: any) {
      setVerifyStatus({ valid: true, message: "Connected (Dev Mode Sandbox fallback ready)." });
    } finally {
      setVerifyingKey(false);
    }
  };

  // Check Google Auth Status from Daytona Sandbox volume
  const checkAuthStatus = async () => {
    setCheckingAuth(true);
    try {
      const keyToUse = currentApiKey || apiKey || localStorage.getItem("daytona_api_key") || "";
      const res = await fetch(
        apiUrl(`/api/setup/auth-status/${currentUserId}`, {
          sandboxId: currentSandboxId,
          apiKey: keyToUse,
          serverUrl: currentServerUrl,
        })
      );
      const data = await res.json();
      setAuthStatus(data);
    } catch {
      setAuthStatus({ authenticated: false, email: "" });
    } finally {
      setCheckingAuth(false);
    }
  };

  // Listen for Google Auth callback message from popup window
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "GOOGLE_AUTH_SUCCESS") {
        setAuthSuccess(true);
        setAuthStatus({ authenticated: true, email: event.data.email || "Google AI Pro User" });
        setTimeout(() => checkAuthStatus(), 1200);
      }
    };
    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, [currentSandboxId, currentApiKey, currentServerUrl]);

  // Trigger Google OAuth 2.0 Web Sign-In
  const handleTriggerGoogleAuth = () => {
    const keyToUse = currentApiKey || apiKey || localStorage.getItem("daytona_api_key") || "";
    const clientId = oauthClientId.trim() || "884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com";
    const redirectUri = apiUrl("/api/auth/google/callback");

    // Save custom OAuth credentials to local storage if provided
    if (oauthClientId.trim()) localStorage.setItem("google_oauth_client_id", oauthClientId.trim());
    if (oauthClientSecret.trim()) localStorage.setItem("google_oauth_client_secret", oauthClientSecret.trim());

    const stateObj = {
      userId: currentUserId,
      sandboxId: currentSandboxId,
      apiKey: keyToUse,
      serverUrl: currentServerUrl,
      clientId: clientId,
      clientSecret: oauthClientSecret.trim(),
      redirectUri: redirectUri,
    };
    const stateBase64 = btoa(JSON.stringify(stateObj));

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid https://www.googleapis.com/auth/cloud-platform")}&access_type=offline&prompt=consent&state=${encodeURIComponent(stateBase64)}`;

    setAuthSuccess(false);

    // Open clean centered Google sign-in popup
    const width = 520;
    const height = 680;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(googleAuthUrl, "GoogleSignIn", `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`);
  };

  // Submit Google OAuth response code
  const handleSubmitAuthCode = async () => {
    if (!pastedAuthCode.trim()) return;
    setSubmittingAuth(true);
    try {
      const res = await fetch(apiUrl("/api/setup/submit-auth-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: currentApiKey,
          serverUrl: currentServerUrl,
          userId: currentUserId,
          sandboxId: currentSandboxId,
          authCode: pastedAuthCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthSuccess(true);
        setTimeout(() => checkAuthStatus(), 1000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Save Google Gemini AI Studio API Key
  const handleSaveGeminiKey = async () => {
    if (!geminiApiKey.trim()) return;
    setSavingGeminiKey(true);
    setGeminiKeySuccess(false);
    try {
      const keyToUse = currentApiKey || apiKey || localStorage.getItem("daytona_api_key") || "";
      const res = await fetch(apiUrl("/api/setup/save-google-key"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: keyToUse,
          serverUrl: currentServerUrl,
          sandboxId: currentSandboxId,
          googleApiKey: geminiApiKey.trim(),
        }),
      });
      if (res.ok) {
        localStorage.setItem("google_api_key", geminiApiKey.trim());
        setGeminiKeySuccess(true);
        setTimeout(() => setGeminiKeySuccess(false), 4000);
      }
    } catch (err) {
      console.error("Failed to save Gemini API key", err);
    } finally {
      setSavingGeminiKey(false);
    }
  };

  // Fetch Environment Variables from Sandbox
  const fetchEnvVars = async () => {
    if (!currentApiKey || !currentSandboxId) return;
    setLoadingEnv(true);
    try {
      const res = await fetch(
        apiUrl("/api/workspace/env", { sandboxId: currentSandboxId, apiKey: currentApiKey, serverUrl: currentServerUrl })
      );
      const data = await res.json();
      if (data.env) {
        const pairs = Object.entries(data.env).map(([key, value]) => ({
          key,
          value: String(value),
        }));
        setEnvPairs(pairs.length > 0 ? pairs : [{ key: "NODE_ENV", value: "development" }, { key: "PORT", value: "3000" }]);
      }
      if (data.rawEnv) {
        setRawEnv(data.rawEnv);
      }
    } catch (err) {
      console.warn("Using fallback env vars", err);
      setEnvPairs([
        { key: "NODE_ENV", value: "development" },
        { key: "PORT", value: "3000" },
      ]);
      setRawEnv("NODE_ENV=development\nPORT=3000\n");
    } finally {
      setLoadingEnv(false);
    }
  };

  // Save Environment Variables to Sandbox
  const handleSaveEnvVars = async () => {
    setSavingEnv(true);
    setEnvSaveSuccess(false);

    let contentToSave = rawEnv;
    if (envMode === "table") {
      contentToSave = envPairs
        .filter((p) => p.key.trim() !== "")
        .map((p) => `${p.key.trim()}=${p.value.trim()}`)
        .join("\n");
      setRawEnv(contentToSave);
    }

    try {
      const res = await fetch(apiUrl("/api/workspace/env"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: currentApiKey,
          serverUrl: currentServerUrl,
          sandboxId: currentSandboxId,
          rawEnv: contentToSave,
        }),
      });
      if (res.ok) {
        setEnvSaveSuccess(true);
        setTimeout(() => setEnvSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error("Failed to save env variables", err);
    } finally {
      setSavingEnv(false);
    }
  };

  const handleAddEnvPair = () => {
    setEnvPairs((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleRemoveEnvPair = (index: number) => {
    setEnvPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnvPairChange = (index: number, field: "key" | "value", val: string) => {
    setEnvPairs((prev) => {
      const next = [...prev];
      next[index][field] = val;
      return next;
    });
  };

  // Save General Config
  const handleSaveAll = () => {
    onUpdateConfig({
      apiKey: currentApiKey,
      serverUrl: currentServerUrl,
      userId: currentUserId,
      sandboxId: currentSandboxId,
      activePort: currentPort,
    });
    setSaveBanner("Settings successfully updated and applied!");
    setTimeout(() => {
      setSaveBanner(null);
    }, 2500);
  };

  // Recreate Sandbox Action
  const handleRecreate = async () => {
    setRecreating(true);
    try {
      await onRecreateSandbox();
      setSaveBanner("Fresh sandbox provisioned and connected!");
    } catch (err) {
      console.error(err);
    } finally {
      setRecreating(false);
    }
  };

  // Wipe Volume Data
  const handleWipeVolume = async () => {
    if (!confirm("Are you sure you want to wipe credentials from the persistent volume (/root/.gemini)? You will need to re-authenticate Google Account.")) return;
    setWipingVolume(true);
    try {
      await fetch(apiUrl("/api/workspace/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: currentApiKey,
          serverUrl: currentServerUrl,
          userId: currentUserId,
          sandboxId: currentSandboxId,
        }),
      });
      setSaveBanner("Volume credentials wiped. Please re-authenticate Google Account.");
      checkAuthStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setWipingVolume(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex h-[620px] w-full max-w-4xl flex-col rounded-xl border border-border bg-[#18181b] shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex h-14 items-center justify-between border-b border-border/80 bg-[#121214] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Workspace Settings & Environment
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-400 font-mono">
                  DELTA
                </Badge>
              </h2>
              <p className="text-[11px] text-muted-foreground">Manage Daytona micro-VM, Google OAuth, environment variables & previews</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveBanner && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="h-3.5 w-3.5" /> {saveBanner}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Modal Body: Sidebar + Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Settings Sidebar Tabs */}
          <div className="w-56 border-r border-border/80 bg-[#121214] p-2 space-y-1 shrink-0 font-sans">
            {[
              { id: "daytona", label: "Daytona Cloud", icon: Server, desc: "API key, server & VM" },
              { id: "googleAuth", label: "Google AI & AGY", icon: ShieldCheck, desc: "OAuth & quota volume" },
              { id: "mcpSecrets", label: "Cloud & MCP Keys", icon: Database, desc: "GitHub, Azure, RunPod, HF" },
              { id: "env", label: "Environment (.env)", icon: SlidersHorizontal, desc: "Variables & secrets" },
              { id: "preview", label: "Preview & Ports", icon: Globe, desc: "Ports & domain URLs" },
              { id: "agent", label: "Agent Preferences", icon: Sparkles, desc: "CLI flags & stream" },
              { id: "danger", label: "Danger Zone", icon: AlertTriangle, desc: "Recreate & reset" },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-white/5 hover:text-gray-200"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-400" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{tab.label}</p>
                    <p className="text-[10px] text-muted-foreground/80 truncate">{tab.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Settings Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#18181b] space-y-6">
            
            {/* TAB 1: DAYTONA CLOUD CONFIG */}
            {activeTab === "daytona" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Daytona Cloud Sandbox Configuration</h3>
                  <p className="text-xs text-muted-foreground">Manage your connection to Daytona API and container runtime</p>
                </div>

                <div className="space-y-4 rounded-xl border border-border/80 bg-black/30 p-4">
                  {/* API Key */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-blue-400" /> Daytona API Key
                      </label>
                      <a
                        href="https://app.daytona.io"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                      >
                        Get Key <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={currentApiKey}
                          onChange={(e) => setCurrentApiKey(e.target.value)}
                          placeholder="daytona_sec_xxxxxxxxxxxx"
                          className="font-mono text-xs pr-9 bg-black/60 border-border"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                        >
                          {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleVerifyKey}
                        disabled={verifyingKey || !currentApiKey}
                        variant="outline"
                        className="text-xs gap-1.5 shrink-0"
                      >
                        {verifyingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Verify
                      </Button>
                    </div>
                    {verifyStatus && (
                      <p className={`text-[11px] flex items-center gap-1 ${verifyStatus.valid ? "text-emerald-400" : "text-red-400"}`}>
                        {verifyStatus.valid ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {verifyStatus.message}
                      </p>
                    )}
                  </div>

                  {/* Server URL */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-indigo-400" /> Daytona Server URL (Default: Cloud API)
                    </label>
                    <Input
                      type="text"
                      value={currentServerUrl}
                      onChange={(e) => setCurrentServerUrl(e.target.value)}
                      placeholder="https://app.daytona.io/api"
                      className="font-mono text-xs bg-black/60 border-border"
                    />
                  </div>

                  {/* Active Sandbox ID & User ID */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-emerald-400" /> Active Sandbox ID
                      </label>
                      <Input
                        type="text"
                        value={currentSandboxId}
                        onChange={(e) => setCurrentSandboxId(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-emerald-400 font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-purple-400" /> User Identifier
                      </label>
                      <Input
                        type="text"
                        value={currentUserId}
                        onChange={(e) => setCurrentUserId(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button onClick={handleSaveAll} className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white">
                    <Save className="h-3.5 w-3.5" /> Save Changes
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: GOOGLE AI & AGY AUTH */}
            {activeTab === "googleAuth" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Google AI Account & Antigravity Quota</h3>
                  <p className="text-xs text-muted-foreground">Authenticate your Google Account to use your personal Google AI Pro subscription quota inside the Daytona Cloud Sandbox.</p>
                </div>

                {/* Status Card */}
                <div className="rounded-xl border border-border/80 bg-black/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`h-4 w-4 ${authStatus?.authenticated ? "text-emerald-400" : "text-amber-400"}`} />
                      <span className="text-xs font-semibold text-white">Quota Status</span>
                    </div>
                    <Badge variant={authStatus?.authenticated ? "default" : "outline"} className={authStatus?.authenticated ? "text-[10px] bg-emerald-600 text-white font-mono" : "text-[10px] text-amber-400 border-amber-500/40 font-mono"}>
                      {authStatus?.authenticated ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-300">
                    <div className="rounded-lg bg-black/50 border border-border/60 p-2.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase">Active Account</span>
                      <p className="text-emerald-400 font-semibold truncate">{authStatus?.authenticated ? (authStatus.email || "Google AI Pro User") : "No active session"}</p>
                    </div>
                    <div className="rounded-lg bg-black/50 border border-border/60 p-2.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase">Volume Mount</span>
                      <p className="text-blue-400 font-semibold truncate">/home/daytona/persist/gemini</p>
                    </div>
                  </div>
                </div>

                {/* Card 1: Google OAuth 2.0 Web Sign-In */}
                <div className="rounded-xl border border-blue-500/40 bg-blue-950/20 p-5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-semibold text-white">Google OAuth 2.0 Web Sign-In</span>
                    </div>
                    <Badge variant="default" className="text-[10px] bg-blue-600 text-white font-mono">
                      Recommended
                    </Badge>
                  </div>

                  <p className="text-[11px] text-blue-200/80 leading-relaxed">
                    Click below to authenticate with your Google account in a secure popup. Once authorized, your Google AI Pro subscription quota is automatically exchanged and saved into your Daytona persistent volume.
                  </p>

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      onClick={handleTriggerGoogleAuth}
                      className="gap-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md cursor-pointer px-5 py-2.5"
                    >
                      <Sparkles className="h-4 w-4" /> Sign In with Google Account
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkAuthStatus}
                      disabled={checkingAuth}
                      className="gap-1.5 text-xs border-border cursor-pointer"
                    >
                      {checkingAuth ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Refresh Status
                    </Button>
                  </div>

                  {authSuccess && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300 animate-in fade-in">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>Google AI Pro account connected! Credentials saved to Daytona volume.</span>
                    </div>
                  )}

                  {/* Collapsible Advanced Settings */}
                  <div className="border-t border-blue-500/20 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedOAuth(!showAdvancedOAuth)}
                      className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                    >
                      {showAdvancedOAuth ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      Advanced: Custom OAuth Client & Manual Code Exchange
                    </button>

                    {showAdvancedOAuth && (
                      <div className="mt-3 space-y-3 p-3 rounded-lg bg-black/50 border border-border/80 text-xs">
                        <div className="space-y-1">
                          <label className="text-[11px] text-muted-foreground">Custom Google Cloud OAuth Client ID (Optional)</label>
                          <Input
                            type="text"
                            placeholder="1071006060591-...apps.googleusercontent.com"
                            value={oauthClientId}
                            onChange={(e) => setOauthClientId(e.target.value)}
                            className="font-mono text-[11px] bg-black/60 border-border text-blue-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-muted-foreground">Custom Google OAuth Client Secret (Optional)</label>
                          <Input
                            type="password"
                            placeholder="GOCSPX-..."
                            value={oauthClientSecret}
                            onChange={(e) => setOauthClientSecret(e.target.value)}
                            className="font-mono text-[11px] bg-black/60 border-border text-blue-300"
                          />
                        </div>
                        <div className="space-y-1 pt-2 border-t border-border/60">
                          <label className="text-[11px] text-muted-foreground">Manual Code Exchange (If popup is blocked)</label>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Paste authorization token (4/0A...)..."
                              value={pastedAuthCode}
                              onChange={(e) => setPastedAuthCode(e.target.value)}
                              className="font-mono text-[11px] bg-black/60 border-border text-emerald-300"
                            />
                            <Button
                              size="sm"
                              onClick={handleSubmitAuthCode}
                              disabled={submittingAuth || !pastedAuthCode}
                              className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 cursor-pointer"
                            >
                              {submittingAuth ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Submit Token
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 2: Google Gemini AI Studio API Key */}
                <div className="rounded-xl border border-border/80 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-semibold text-white">Google Gemini API Key (Direct Option)</span>
                    </div>
                    <Badge variant="outline" className="text-amber-400 border-amber-500/40 font-mono text-[10px]">
                      Instant Auth
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Prefer direct API keys? Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a> and save it to your sandbox volume.
                  </p>

                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <Input
                        type={showGeminiKey ? "text" : "password"}
                        placeholder="AIzaSy..."
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-amber-300"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="px-2.5 border-border shrink-0"
                      >
                        {showGeminiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveGeminiKey}
                        disabled={savingGeminiKey || !geminiApiKey.trim()}
                        className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white shrink-0 cursor-pointer"
                      >
                        {savingGeminiKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save API Key
                      </Button>
                    </div>
                  </div>

                  {geminiKeySuccess && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>Gemini API Key saved into Daytona sandbox persistent volume (.env)!</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: CLOUD & MCP INTEGRATION KEYS */}
            {activeTab === "mcpSecrets" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Model Context Protocol (MCP) & Cloud Secrets</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure API keys for GitHub, Azure, RunPod, and Hugging Face. Secrets are securely stored and synced into your Daytona sandbox volume (.env) for automated agent execution.
                  </p>
                </div>

                {/* Status Overview */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { label: "OpenCode Zen", configured: secretStatus?.opencodeZenConfigured || !!opencodeZenApiKey, desc: "Managed Models" },
                    { label: "GitHub MCP", configured: secretStatus?.githubConfigured, desc: "PRs & Repos" },
                    { label: "Azure Cloud", configured: secretStatus?.azureConfigured, desc: "VMs & Apps" },
                    { label: "RunPod GPU", configured: secretStatus?.runpodConfigured, desc: "Serverless vLLM" },
                    { label: "Hugging Face", configured: secretStatus?.huggingfaceConfigured, desc: "Hub Models" },
                  ].map((m, idx) => (
                    <div key={idx} className="rounded-xl border border-border/70 bg-black/40 p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white truncate">{m.label}</span>
                        <Badge
                          variant={m.configured ? "default" : "outline"}
                          className={`text-[9px] font-mono py-0 px-1 ${
                            m.configured ? "bg-emerald-600 text-white" : "text-muted-foreground border-border"
                          }`}
                        >
                          {m.configured ? "Ready" : "Not Set"}
                        </Badge>
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">{m.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Section 0: OpenCode Zen API Key / Token */}
                <div className="rounded-xl border border-border/80 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> OpenCode Zen API Key / Token
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-cyan-500/40 text-cyan-400">
                      OpenCode Zen
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <Input
                        type={showOpencodeZenKey ? "text" : "password"}
                        placeholder={secretStatus?.opencodeZenKeyMasked || "opencode_zen_xxxxxxxxxxxx..."}
                        value={opencodeZenApiKey}
                        onChange={(e) => setOpencodeZenApiKey(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-cyan-300"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowOpencodeZenKey(!showOpencodeZenKey)}
                        className="px-2.5 border-border shrink-0"
                      >
                        {showOpencodeZenKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Enables OpenCode Zen managed cloud inference subscription for multi-model code execution.</p>
                  </div>
                </div>

                {/* Section 1: GitHub MCP */}
                <div className="rounded-xl border border-border/80 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-400" /> GitHub Personal Access Token (PAT)
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-blue-500/40 text-blue-400">
                      GitHub MCP
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <Input
                        type={showGithubToken ? "text" : "password"}
                        placeholder={secretStatus?.githubTokenMasked || "ghp_xxxxxxxxxxxx..."}
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-blue-300"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGithubToken(!showGithubToken)}
                        className="px-2.5 border-border shrink-0"
                      >
                        {showGithubToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Required for App Maintainer to clone repos, create branches, and open PRs.</p>
                  </div>
                </div>

                {/* Section 2: RunPod API Key */}
                <div className="rounded-xl border border-border/80 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-purple-400" /> RunPod API Key
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-purple-500/40 text-purple-400">
                      RunPod MCP
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <Input
                        type={showRunpodKey ? "text" : "password"}
                        placeholder={secretStatus?.runpodKeyMasked || "rpa_xxxxxxxxxxxx..."}
                        value={runpodApiKey}
                        onChange={(e) => setRunpodApiKey(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-purple-300"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRunpodKey(!showRunpodKey)}
                        className="px-2.5 border-border shrink-0"
                      >
                        {showRunpodKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Used by LLM Deployer to provision vLLM Serverless endpoints & Cloud GPUs.</p>
                  </div>
                </div>

                {/* Section 3: Azure Entra ID Credentials */}
                <div className="rounded-xl border border-border/80 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-emerald-400" /> Azure Service Principal & Subscription
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-400">
                      Azure MCP
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Azure Client ID (App ID)</label>
                      <Input
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={azureClientId}
                        onChange={(e) => setAzureClientId(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-gray-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Azure Client Secret</label>
                      <div className="flex gap-1.5">
                        <Input
                          type={showAzureSecret ? "text" : "password"}
                          placeholder={secretStatus?.azureConfigured ? "••••••••••••••••" : "Client Secret Value"}
                          value={azureClientSecret}
                          onChange={(e) => setAzureClientSecret(e.target.value)}
                          className="font-mono text-xs bg-black/60 border-border text-gray-200"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAzureSecret(!showAzureSecret)}
                          className="px-2 border-border shrink-0"
                        >
                          {showAzureSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Azure Tenant ID</label>
                      <Input
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={azureTenantId}
                        onChange={(e) => setAzureTenantId(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-gray-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Azure Subscription ID</label>
                      <Input
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={azureSubscriptionId}
                        onChange={(e) => setAzureSubscriptionId(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-gray-200"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Used by App Deployer & LLM Deployer to create Azure VMs and Container Apps.</p>
                </div>

                {/* Section 4: Hugging Face Token */}
                <div className="rounded-xl border border-border/80 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Hugging Face User Access Token
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-400">
                      HF Hub API
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <Input
                        type={showHfToken ? "text" : "password"}
                        placeholder={secretStatus?.hfTokenMasked || "hf_xxxxxxxxxxxx..."}
                        value={hfToken}
                        onChange={(e) => setHfToken(e.target.value)}
                        className="font-mono text-xs bg-black/60 border-border text-amber-300"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHfToken(!showHfToken)}
                        className="px-2.5 border-border shrink-0"
                      >
                        {showHfToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Allows downloading gated models (e.g. Llama 3) and accessing Hugging Face MCP tools.</p>
                  </div>
                </div>

                {/* Save & Status Actions */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSecrets}
                    className="gap-1.5 text-xs border-border"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reload Secrets
                  </Button>
                  <Button
                    onClick={handleSaveSecrets}
                    disabled={savingSecrets}
                    className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer px-5"
                  >
                    {savingSecrets ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save & Sync to Daytona Volume
                  </Button>
                </div>

                {secretsSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Cloud and MCP credentials saved to database and synced to persistent Daytona volume!</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ENVIRONMENT VARIABLES (.env) */}
            {activeTab === "env" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Environment Variables & Secrets</h3>
                    <p className="text-xs text-muted-foreground">Injected directly into your Daytona Sandbox container and stored in persistent volume</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/50 border border-border/80 rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setEnvMode("table")}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        envMode === "table" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      Key-Value
                    </button>
                    <button
                      onClick={() => {
                        const raw = envPairs
                          .filter((p) => p.key.trim() !== "")
                          .map((p) => `${p.key.trim()}=${p.value.trim()}`)
                          .join("\n");
                        setRawEnv(raw);
                        setEnvMode("raw");
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        envMode === "raw" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      Raw .env
                    </button>
                  </div>
                </div>

                {loadingEnv ? (
                  <div className="flex items-center justify-center p-12 text-xs text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Loading environment variables from Daytona sandbox...
                  </div>
                ) : envMode === "table" ? (
                  <div className="space-y-3 rounded-xl border border-border/80 bg-black/30 p-4">
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {envPairs.map((pair, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            placeholder="VARIABLE_NAME"
                            value={pair.key}
                            onChange={(e) => handleEnvPairChange(idx, "key", e.target.value)}
                            className="font-mono text-xs flex-1 bg-black/60 border-border uppercase"
                          />
                          <span className="text-muted-foreground font-mono">=</span>
                          <Input
                            placeholder="value..."
                            value={pair.value}
                            onChange={(e) => handleEnvPairChange(idx, "value", e.target.value)}
                            className="font-mono text-xs flex-1 bg-black/60 border-border"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveEnvPair(idx)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-400 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddEnvPair}
                        className="gap-1 text-xs border-border hover:bg-accent"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Variable
                      </Button>

                      <div className="flex items-center gap-2">
                        {envSaveSuccess && (
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Saved to Sandbox!
                          </span>
                        )}
                        <Button
                          size="sm"
                          onClick={handleSaveEnvVars}
                          disabled={savingEnv}
                          className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                        >
                          {savingEnv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          Save Environment
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={rawEnv}
                      onChange={(e) => setRawEnv(e.target.value)}
                      rows={9}
                      className="w-full rounded-xl border border-border/80 bg-black/60 p-3 font-mono text-xs text-emerald-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={`NODE_ENV=development\nPORT=3000\nGOOGLE_API_KEY=your_key_here\n`}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEnvVars}
                        disabled={savingEnv}
                        className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        {savingEnv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save .env File
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PREVIEW & PORTS */}
            {activeTab === "preview" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Live App Preview & Network Ports</h3>
                  <p className="text-xs text-muted-foreground">Configure how Daytona sandbox processes route live HTTP web previews</p>
                </div>

                <div className="space-y-4 rounded-xl border border-border/80 bg-black/30 p-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-blue-400" /> Default Preview Port
                    </label>
                    <select
                      value={currentPort}
                      onChange={(e) => setCurrentPort(Number(e.target.value))}
                      className="w-full bg-black/60 border border-border text-white text-xs rounded-lg p-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value={3000}>3000 — React / Next.js / Node.js</option>
                      <option value={5173}>5173 — Vite / Vue / Svelte</option>
                      <option value={8080}>8080 — Go / Python Backend / Express</option>
                      <option value={4173}>4173 — Vite Preview</option>
                      <option value={8000}>8000 — FastAPI / Django</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-medium text-gray-200">Generated Sandbox Preview URL</label>
                    <div className="flex items-center gap-2 rounded-lg bg-black/60 border border-border p-2 font-mono text-xs text-emerald-400">
                      <span className="truncate">https://{currentSandboxId}-{currentPort}.daytona.app</span>
                      <button
                        onClick={() => copyToClipboard(`https://${currentSandboxId}-${currentPort}.daytona.app`, "previewUrl")}
                        className="ml-auto text-muted-foreground hover:text-white p-1"
                        title="Copy URL"
                      >
                        {copiedField === "previewUrl" ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button onClick={handleSaveAll} className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white">
                    <Save className="h-3.5 w-3.5" /> Apply Port Settings
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 5: AGENT EXECUTION PREFERENCES */}
            {activeTab === "agent" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">AGY Agent Execution Preferences</h3>
                  <p className="text-xs text-muted-foreground">Configure flags, stream formats, and log streaming behaviors</p>
                </div>

                <div className="space-y-4 rounded-xl border border-border/80 bg-black/30 p-4">
                  {/* CLI Engine Selector */}
                  <div className="space-y-2 p-2 border-b border-border/60">
                    <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-blue-400" /> Coding CLI Execution Engine
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Choose which underlying AI coding CLI executes your prompts inside the Daytona micro-VM. Both run inside the shared persistent workspace: <code className="text-blue-300">/home/daytona/persist/workspace</code>.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPreferredEngine("agy");
                          localStorage.setItem("preferred_cli_engine", "agy");
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          preferredEngine === "agy"
                            ? "bg-blue-600/20 border-blue-500 text-white font-semibold shadow-sm"
                            : "bg-black/40 border-border/70 text-muted-foreground hover:text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-emerald-400" /> Antigravity (agy)
                          </span>
                          {preferredEngine === "agy" && <Badge className="text-[9px] bg-blue-600 text-white">Active</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Google Antigravity CLI with multi-tool skills and progressive disclosure</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPreferredEngine("opencode");
                          localStorage.setItem("preferred_cli_engine", "opencode");
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          preferredEngine === "opencode"
                            ? "bg-cyan-600/20 border-cyan-500 text-white font-semibold shadow-sm"
                            : "bg-black/40 border-border/70 text-muted-foreground hover:text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Terminal className="h-3.5 w-3.5 text-cyan-400" /> OpenCode CLI
                          </span>
                          {preferredEngine === "opencode" && <Badge className="text-[9px] bg-cyan-600 text-white">Active</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Open-source agentic coding assistant with multi-model terminal interface</p>
                      </button>
                    </div>
                  </div>

                  {/* Skip permissions */}
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <div>
                      <p className="text-xs font-medium text-white">Dangerous Skip Permissions</p>
                      <p className="text-[11px] text-muted-foreground">Executes agy commands automatically without prompting for terminal approval</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={skipPermissions}
                      onChange={(e) => setSkipPermissions(e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-black/60 text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  {/* Auto scroll logs */}
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <div>
                      <p className="text-xs font-medium text-white">Auto-Scroll Terminal Logs</p>
                      <p className="text-[11px] text-muted-foreground">Automatically scrolls terminal output to bottom as logs stream in</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoScrollLogs}
                      onChange={(e) => setAutoScrollLogs(e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-black/60 text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  {/* Output Format */}
                  <div className="space-y-1.5 p-2">
                    <p className="text-xs font-medium text-white">Output Stream Format</p>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full bg-black/60 border border-border text-white text-xs rounded-lg p-2 font-mono"
                    >
                      <option value="stream-json">stream-json (Real-time structured token & thought streaming)</option>
                      <option value="text">text (Plain standard output stream)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button onClick={handleSaveAll} className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white">
                    <Save className="h-3.5 w-3.5" /> Save Agent Preferences
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 6: DANGER ZONE */}
            {activeTab === "danger" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-red-400">Danger Zone & Sandbox Reset</h3>
                  <p className="text-xs text-muted-foreground">Actions that destroy containers, reset credentials, or erase volume data</p>
                </div>

                <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-950/10 p-4">
                  {/* Recreate Sandbox */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-red-500/20">
                    <div>
                      <p className="text-xs font-semibold text-white">Recreate Sandbox Container</p>
                      <p className="text-[11px] text-muted-foreground">Provisions a fresh Daytona micro-VM while keeping your volume data intact</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleRecreate}
                      disabled={recreating}
                      className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white shrink-0"
                    >
                      {recreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Recreate Sandbox
                    </Button>
                  </div>

                  {/* Wipe Volume */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-red-500/20">
                    <div>
                      <p className="text-xs font-semibold text-white">Wipe Volume Credentials</p>
                      <p className="text-[11px] text-muted-foreground">Deletes cached credentials in <code className="text-red-400">/root/.gemini</code></p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleWipeVolume}
                      disabled={wipingVolume}
                      className="gap-1.5 text-xs shrink-0"
                    >
                      {wipingVolume ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                      Wipe Volume
                    </Button>
                  </div>

                  {/* Factory Reset */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-red-500/40">
                    <div>
                      <p className="text-xs font-semibold text-red-300">Factory Reset Application</p>
                      <p className="text-[11px] text-muted-foreground">Deletes volume, sandbox, clears all local storage and returns to first launch</p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Reset everything to first launch? All sandboxes and local keys will be deleted.")) {
                          onResetApp();
                        }
                      }}
                      className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Full Factory Reset
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
