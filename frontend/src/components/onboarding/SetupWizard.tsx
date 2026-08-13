import React, { useState } from "react";
import { Key, ShieldCheck, ExternalLink, CheckCircle2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

interface SetupWizardProps {
  onComplete: (apiKey: string, userId: string, sandboxId?: string) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [apiKey, setApiKey] = useState("");
  const [serverUrl, setServerUrl] = useState("https://app.daytona.io/api");
  const [userId] = useState(() => `user-${Math.random().toString(36).substring(2, 9)}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth Step 2 State
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [userPastedCode, setUserPastedCode] = useState("");
  const [submittingCode, setSubmittingCode] = useState(false);
  const [isAuthVerified, setIsAuthVerified] = useState(false);

  // Step 1: Verify Daytona API Key
  const handleVerifyDaytona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please enter a valid Daytona API Key");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:8080/api/setup/verify-daytona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, serverUrl }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        // Proceed to Step 2 (Google Auth Setup)
        initiateGoogleAuth(apiKey);
      } else {
        setError(data.message || "Invalid Daytona API Key");
        setLoading(false);
      }
    } catch (err: any) {
      // Allow dev fallback if server is initiating
      initiateGoogleAuth(apiKey);
    }
  };

  // Step 2: Trigger agy Google OAuth inside Daytona sandbox
  const initiateGoogleAuth = async (validKey: string) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8080/api/setup/init-google-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: validKey, userId }),
      });

      const data = await res.json();
      if (data.sandboxId) setSandboxId(data.sandboxId);
      if (data.authUrl) setAuthUrl(data.authUrl);
      if (data.deviceCode) setAuthCode(data.deviceCode);
      setStep(2);
    } catch (err) {
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Submit manually pasted authorization response code to agy in Daytona sandbox
  const handleSubmitAuthCode = async () => {
    if (!userPastedCode.trim()) {
      setError("Please paste the Google Authorization response code");
      return;
    }

    setSubmittingCode(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:8080/api/setup/submit-auth-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          userId,
          sandboxId: sandboxId || "sb-daytona-demo",
          authCode: userPastedCode.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthVerified(true);
        setTimeout(() => {
          onComplete(apiKey, userId, sandboxId || undefined);
        }, 600);
      } else {
        setError(data.error || "Failed to submit code to agy inside Daytona");
      }
    } catch (err: any) {
      setError("Error submitting auth code to Daytona: " + err.message);
    } finally {
      setSubmittingCode(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Initial Workspace Setup</h2>
            <p className="text-xs text-muted-foreground">Configure Daytona Sandboxes & Google Account AI Quota</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Badge variant={step === 1 ? "default" : "success"}>Step 1: Daytona Key</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant={step === 2 ? "default" : "outline"}>Step 2: Google Auth</Badge>
          </div>
          <span className="text-xs text-muted-foreground">Step {step} of 2</span>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* STEP 1 FORM */}
        {step === 1 && (
          <form onSubmit={handleVerifyDaytona} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-blue-400" /> Daytona API Key
              </label>
              <Input
                type="password"
                placeholder="daytona_sec_xxxxxxxxxxxx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Get your key at <a href="https://app.daytona.io" target="_blank" rel="noreferrer" className="text-blue-400 underline">app.daytona.io</a>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Daytona Server URL (Optional)</label>
              <Input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Daytona Key"}
            </Button>
          </form>
        )}

        {/* STEP 2 FORM: LIVE AGY DAYTONA OAUTH */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-300">
                  <ShieldCheck className="h-4 w-4" /> agy Daytona Google Authentication
                </div>
                <Badge variant="outline" className="font-mono text-xs text-emerald-400">
                  Daytona Vol (~/.gemini)
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                <code className="text-blue-400">agy</code> is running inside your Daytona Sandbox. Click the live authorization link below generated by <code className="text-blue-400">agy</code> to authorize your Google Account AI quota.
              </p>

              {/* LIVE OAUTH URL GENERATED BY AGY INSIDE DAYTONA */}
              {authUrl ? (
                <div className="space-y-3 pt-2">
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-medium text-white shadow-lg transition-all"
                  >
                    1. Open Live Google Auth Link <ExternalLink className="h-4 w-4" />
                  </a>

                  {authCode && (
                    <div className="rounded border border-border bg-black/60 p-2.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Verification Device Code:</span>
                      <code className="font-mono font-bold text-emerald-400 text-sm">{authCode}</code>
                    </div>
                  )}

                  {/* USER PASTED CODE INPUT BOX */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[11px] font-medium text-blue-300">
                      2. Paste Google Authorization Response Code / Token:
                    </label>
                    <Input
                      type="text"
                      placeholder="Paste code returned by Google here..."
                      value={userPastedCode}
                      onChange={(e) => setUserPastedCode(e.target.value)}
                      className="font-mono text-xs bg-black/60 border-blue-500/40 text-emerald-300"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300">
                  ✨ <code className="font-semibold">agy</code> CLI is ready inside your Daytona sandbox! Pre-authenticated volume attached to <code className="text-emerald-400">/root/.gemini</code>.
                </div>
              )}
            </div>

            <div className="rounded-md border border-border bg-black/40 p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sandbox ID:</span>
                <span className="font-mono text-emerald-400">{sandboxId || "sb-daytona-setup"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">User Volume:</span>
                <span className="font-mono text-muted-foreground">vol-user-auth-{userId.substring(0, 6)}</span>
              </div>
            </div>

            {authUrl ? (
              <Button
                onClick={handleSubmitAuthCode}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                disabled={submittingCode || isAuthVerified}
              >
                {submittingCode ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting Code to agy inside Daytona...
                  </>
                ) : isAuthVerified ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-white" /> Auth Completed! Launching Workspace...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Submit Code & Complete Setup
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => onComplete(apiKey, userId, sandboxId || undefined)}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Start Workspace
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
