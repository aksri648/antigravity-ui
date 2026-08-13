import React from "react";
import { Sparkles, Cpu, ShieldCheck, ArrowRight, Zap, Code, Terminal, Globe, Layers, Play, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface LandingPageProps {
  onStartSetup: () => void;
  onResetApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartSetup, onResetApp }) => {
  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col overflow-y-auto selection:bg-blue-500 selection:text-white">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white">AGY Cloud Workspace</span>
            <Badge variant="outline" className="text-[10px] py-0 px-2 border-blue-500/40 text-blue-400 font-mono">
              v1.0
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a href="#features" className="text-xs text-muted-foreground hover:text-white transition-colors">Features</a>
          <a href="#architecture" className="text-xs text-muted-foreground hover:text-white transition-colors">Architecture</a>
          <Button
            variant="outline"
            size="sm"
            onClick={onResetApp}
            className="h-8 text-xs border-border text-muted-foreground hover:text-white"
            title="Reset all cached configuration and local storage"
          >
            Reset Config
          </Button>
          <Button
            size="sm"
            onClick={onStartSetup}
            className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 font-medium"
          >
            Launch Workspace <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-6 max-w-6xl mx-auto text-center space-y-8 flex flex-col items-center">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

        <Badge variant="default" className="gap-2 px-3 py-1 bg-blue-600/10 border border-blue-500/30 text-blue-400 text-xs shadow-inner">
          <Sparkles className="h-3.5 w-3.5" /> Autonomous Cloud Coding Powered by Google AI Quota & Daytona
        </Badge>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15]">
          Build Software in the Cloud with <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Your Google AI Quota</span>
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
          Execute Google Antigravity CLI (<code className="text-blue-400">agy</code>) headlessly inside isolated Daytona micro-VM sandboxes. $0 LLM infrastructure costs, 200ms container spin-up, Monaco IDE, and real-time live preview.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            size="lg"
            onClick={onStartSetup}
            className="h-12 px-8 text-sm gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xl shadow-blue-600/25 transition-all hover:scale-105"
          >
            Start First-Time Setup <ArrowRight className="h-4 w-4" />
          </Button>

          <a href="#features">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-6 text-sm gap-2 border-border bg-card/60 text-gray-200 hover:bg-accent"
            >
              Explore Architecture <Play className="h-3.5 w-3.5 text-blue-400" />
            </Button>
          </a>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-muted-foreground border-t border-border/40 w-full max-w-3xl">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> BYOQ (Bring Your Own Quota)</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Daytona Micro-VMs &lt;200ms</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Persistent Volume (~/.gemini)</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> 30/70 Resizable Split UI</span>
        </div>
      </section>

      {/* Product UI Wireframe Showcase */}
      <section className="px-6 max-w-6xl mx-auto w-full pb-20">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-2xl space-y-2">
          {/* Window Header */}
          <div className="h-8 bg-black/60 rounded-t-xl border-b border-border/60 px-4 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="font-mono text-[11px] text-gray-400">AGY Cloud Workspace — 30/70 Split UI</span>
            <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-400">
              Active Session
            </Badge>
          </div>

          {/* Interactive Split Mockup */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 h-96 rounded-b-xl overflow-hidden bg-black/80 font-sans text-xs">
            {/* Left 30% Chat Pane */}
            <div className="md:col-span-4 border-r border-border bg-card/60 p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-400 font-semibold border-b border-border/60 pb-2">
                  <Sparkles className="h-4 w-4" /> AGY Assistant (30% Width)
                </div>
                <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-2.5 text-blue-200">
                  <p className="font-semibold text-[11px] text-blue-300">💭 Thinking:</p>
                  <p className="text-[11px] font-mono">Editing src/App.tsx & starting dev server on port 3000...</p>
                </div>
                <div className="bg-black/60 border border-border p-2.5 rounded-lg text-gray-300 text-[11px] font-mono">
                  🛠️ Executed tool: replace_file_content (src/App.tsx)
                </div>
              </div>
              <div className="bg-black/50 border border-border p-2 rounded-lg text-muted-foreground flex justify-between items-center text-[11px]">
                <span>Type prompt...</span>
                <Button size="sm" className="h-6 text-[10px] bg-blue-600 text-white">Send</Button>
              </div>
            </div>

            {/* Right 70% Live Preview & IDE */}
            <div className="md:col-span-8 bg-black/90 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex gap-2">
                  <Badge variant="default" className="text-[10px]">🌐 Live Preview</Badge>
                  <Badge variant="outline" className="text-[10px]">💻 VS Code IDE</Badge>
                  <Badge variant="outline" className="text-[10px]">📟 Terminal Logs</Badge>
                </div>
                <span className="font-mono text-[11px] text-emerald-400">https://sb-daytona-demo-3000.daytona.app</span>
              </div>

              <div className="flex-1 rounded-xl bg-slate-900 border border-slate-800 p-6 flex flex-col items-center justify-center text-center space-y-2">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">Live Daytona Sandbox App Running</h3>
                <p className="text-xs text-slate-400">Serving on port :3000 inside isolated container</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section id="features" className="px-6 py-16 bg-card/30 border-t border-border/60">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-xs">Features Overview</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-white">Designed for Cloud-Native AI Workflows</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Bring Your Own Quota (BYOQ)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your Google account via device OAuth. All AI reasoning and code generation utilize your personal Google account quota with zero platform markup.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Daytona Micro-VM Sandboxes</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ephemeral Linux container sandboxes provisioned in under 200ms with dedicated vCPU, memory, and FUSE storage volume mounts per session.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Persistent Volume (~/.gemini)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                OAuth refresh tokens, Daytona keys, and CLI settings persist indefinitely inside your dedicated volume at <code className="text-purple-300">/root/.gemini</code>.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Globe className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Daytona Subdomain Previews</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apps generated by <code className="text-amber-300">agy</code> are automatically exposed via Daytona preview URLs (<code className="text-amber-300">https://sb-3000.daytona.app</code>) inside the 70% Right Pane iframe.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Code className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">VS Code Monaco IDE</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Full-featured VS Code Monaco editor with syntax highlighting, line numbers, file explorer, and live REST file saving directly into Daytona.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Terminal className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Real Daytona Terminal Logs</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Stream real-time terminal stdout/stderr logs from Daytona process execution over WebSockets directly to the Terminal tab.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="mt-auto border-t border-border/60 py-12 px-6 bg-card text-center space-y-6">
        <div className="max-w-xl mx-auto space-y-3">
          <h3 className="text-2xl font-bold text-white">Ready to Start Cloud Coding?</h3>
          <p className="text-xs text-muted-foreground">Set up your Daytona API Key & Google Account Auth once, and launch your workspace.</p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Button size="lg" onClick={onStartSetup} className="gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              Get Started Now <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={onResetApp} className="border-border text-muted-foreground hover:text-white">
              Reset Application State
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground pt-6 border-t border-border/40">
          AGY Cloud Workspace • Powered by Antigravity CLI & Daytona Micro-VMs
        </p>
      </footer>

    </div>
  );
};
