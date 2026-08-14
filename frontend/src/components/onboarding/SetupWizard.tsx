import React, { useState } from "react";
import {
  Key,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Cpu,
  Server,
  FileText,
  Eye,
  EyeOff,
  Database,
  Lock,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { apiUrl } from "../../config/api";

interface SetupWizardProps {
  onComplete: (apiKey: string, userId: string, sandboxId?: string) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [userId] = useState(() => localStorage.getItem("daytona_user_id") || `user-${Math.random().toString(36).substring(2, 9)}`);

  // Step 1: Daytona
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("daytona_api_key") || "");
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("daytona_server_url") || "https://app.daytona.io/api");

  // Step 2: AI Keys
  const [googleApiKey, setGoogleApiKey] = useState(() => localStorage.getItem("google_api_key") || "");
  const [openaiApiKey, setOpenaiApiKey] = useState(() => localStorage.getItem("openai_api_key") || "");

  // Step 3: Cloud & Git Integrations
  const [githubToken, setGithubToken] = useState("");
  const [runpodApiKey, setRunpodApiKey] = useState("");
  const [azureClientId, setAzureClientId] = useState("");
  const [azureClientSecret, setAzureClientSecret] = useState("");
  const [azureTenantId, setAzureTenantId] = useState("");
  const [azureSubscriptionId, setAzureSubscriptionId] = useState("");
  const [hfToken, setHfToken] = useState("");

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showGithubKey, setShowGithubKey] = useState(false);
  const [showRunpodKey, setShowRunpodKey] = useState(false);
  const [showAzureSecret, setShowAzureSecret] = useState(false);
  const [showHfKey, setShowHfKey] = useState(false);

  // Step 1 Validation & Proceed
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please enter a valid Daytona API Key");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/setup/verify-daytona"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), serverUrl }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        localStorage.setItem("daytona_api_key", apiKey.trim());
        localStorage.setItem("daytona_server_url", serverUrl);
        setStep(2);
      } else {
        setError(data.message || "Invalid Daytona API Key or unreachable server.");
      }
    } catch (err: any) {
      localStorage.setItem("daytona_api_key", apiKey.trim());
      localStorage.setItem("daytona_server_url", serverUrl);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Proceed to Step 3
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleApiKey.trim() && !openaiApiKey.trim()) {
      setError("Please provide at least one AI API Key (Google AI or OpenAI).");
      return;
    }
    setError(null);
    if (googleApiKey.trim()) localStorage.setItem("google_api_key", googleApiKey.trim());
    if (openaiApiKey.trim()) localStorage.setItem("openai_api_key", openaiApiKey.trim());
    setStep(3);
  };

  // Step 3 Final Save to Daytona Secrets & Complete
  const handleFinalSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Provision / connect workspace
      let activeSandboxId = localStorage.getItem("daytona_sandbox_id") || undefined;
      try {
        const createRes = await fetch(apiUrl("/api/workspace/create"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: apiKey.trim(), serverUrl, userId }),
        });
        const createData = await createRes.json();
        if (createData.sandboxId) {
          activeSandboxId = createData.sandboxId;
          localStorage.setItem("daytona_sandbox_id", createData.sandboxId);
        }
      } catch (e) {
        console.warn("Workspace provision skipped or deferred", e);
      }

      // 2. Save all secrets to Daytona Secrets & Persistent Volume
      await fetch(apiUrl("/api/integrations/secrets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sandboxId: activeSandboxId || "",
          apiKey: apiKey.trim(),
          serverUrl,
          openaiApiKey: openaiApiKey.trim(),
          googleApiKey: googleApiKey.trim(),
          githubToken: githubToken.trim(),
          azureClientId: azureClientId.trim(),
          azureClientSecret: azureClientSecret.trim(),
          azureTenantId: azureTenantId.trim(),
          azureSubscriptionId: azureSubscriptionId.trim(),
          runpodApiKey: runpodApiKey.trim(),
          huggingfaceToken: hfToken.trim(),
        }),
      });

      // Mark setup as complete
      localStorage.setItem("daytona_user_id", userId);
      onComplete(apiKey.trim(), userId, activeSandboxId);
    } catch (err: any) {
      setError("Setup completed with warnings: " + err.message);
      onComplete(apiKey.trim(), userId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-[#161618] p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Antigravity Cloud Setup</h2>
              <p className="text-xs text-muted-foreground">Configure Daytona Sandboxes & Cloud Secrets for persistent SaaS access</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono text-blue-400 border-blue-500/40">
            Step {step} of 3
          </Badge>
        </div>

        {/* Step Indicators */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, label: "Daytona Cloud", icon: Server },
            { num: 2, label: "AI Models", icon: Cpu },
            { num: 3, label: "Cloud Integrations", icon: Database },
          ].map((s) => {
            const Icon = s.icon;
            const isCurrent = step === s.num;
            const isDone = step > s.num;
            return (
              <div
                key={s.num}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-all ${
                  isCurrent
                    ? "bg-blue-600/15 border-blue-500/50 text-blue-300 font-semibold"
                    : isDone
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                    : "border-border/40 text-muted-foreground"
                }`}
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isCurrent ? "bg-blue-600 text-white" : isDone ? "bg-emerald-600 text-white" : "bg-white/10 text-muted-foreground"
                }`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-2.5 w-2.5" />}
                </div>
                <span className="truncate">{s.label}</span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* STEP 1: DAYTONA CLOUD */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-blue-400" /> Daytona API Key *
              </label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="daytona_sec_xxxxxxxxxxxx..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-border text-white"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-2.5 border-border shrink-0"
                >
                  {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Get your key at <a href="https://app.daytona.io" target="_blank" rel="noreferrer" className="text-blue-400 underline">app.daytona.io</a>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-200">Daytona Server URL</label>
              <Input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="font-mono text-xs bg-black/60 border-border text-white"
              />
            </div>

            <Button type="submit" className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* STEP 2: AI PROVIDERS (GOOGLE / OPENAI) */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Google Gemini API Key
              </label>
              <div className="flex gap-2">
                <Input
                  type={showGoogleKey ? "text" : "password"}
                  placeholder="AIzaSy..."
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-border text-amber-300"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  className="px-2.5 border-border shrink-0"
                >
                  {showGoogleKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">Google AI Studio</a>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-emerald-400" /> OpenAI API Key (For OpenAI Agents SDK Layer)
              </label>
              <div className="flex gap-2">
                <Input
                  type={showOpenaiKey ? "text" : "password"}
                  placeholder="sk-proj-xxxxxxxxxxxx..."
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-border text-emerald-300"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="px-2.5 border-border shrink-0"
                >
                  {showOpenaiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Used by the 4 specialized agents for high-level reasoning and decision-making.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1.5 text-xs border-border">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button type="submit" className="flex-1 gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                Continue to Cloud Integrations <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: CLOUD & GIT INTEGRATIONS */}
        {step === 3 && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-xs text-muted-foreground">
              Optional cloud credentials. All configured secrets will be securely saved to <strong>Daytona Secrets Manager</strong> and automatically restored across all future sessions.
            </p>

            {/* GitHub */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-400" /> GitHub Personal Access Token (PAT)
              </label>
              <div className="flex gap-2">
                <Input
                  type={showGithubKey ? "text" : "password"}
                  placeholder="ghp_xxxxxxxxxxxx..."
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-border text-blue-300"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGithubKey(!showGithubKey)}
                  className="px-2.5 border-border shrink-0"
                >
                  {showGithubKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* RunPod */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-purple-400" /> RunPod API Key
              </label>
              <div className="flex gap-2">
                <Input
                  type={showRunpodKey ? "text" : "password"}
                  placeholder="rpa_xxxxxxxxxxxx..."
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
            </div>

            {/* Azure */}
            <div className="space-y-2 rounded-xl border border-border/80 bg-black/40 p-3">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-emerald-400" /> Azure Credentials (Optional for VM Deployments)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Azure Client ID"
                  value={azureClientId}
                  onChange={(e) => setAzureClientId(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-border text-gray-200"
                />
                <div className="flex gap-1.5">
                  <Input
                    type={showAzureSecret ? "text" : "password"}
                    placeholder="Azure Client Secret"
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
                <Input
                  placeholder="Azure Tenant ID"
                  value={azureTenantId}
                  onChange={(e) => setAzureTenantId(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-border text-gray-200"
                />
                <Input
                  placeholder="Azure Subscription ID"
                  value={azureSubscriptionId}
                  onChange={(e) => setAzureSubscriptionId(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-border text-gray-200"
                />
              </div>
            </div>

            {/* Hugging Face */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Hugging Face Token
              </label>
              <div className="flex gap-2">
                <Input
                  type={showHfKey ? "text" : "password"}
                  placeholder="hf_xxxxxxxxxxxx..."
                  value={hfToken}
                  onChange={(e) => setHfToken(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-border text-amber-300"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHfKey(!showHfKey)}
                  className="px-2.5 border-border shrink-0"
                >
                  {showHfKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Final Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-border/60">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="gap-1.5 text-xs border-border">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={loading}
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Save to Daytona Secrets & Launch Workspace
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
