import React from "react";
import {
  Sparkles,
  Cpu,
  ShieldCheck,
  ArrowRight,
  Zap,
  Code,
  Terminal,
  Globe,
  Layers,
  Play,
  CheckCircle2,
  LogIn,
  UserPlus,
  Server,
  Activity,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface LandingPageProps {
  onStartSetup: () => void;
  onOpenAuth: (mode: "signin" | "signup") => void;
  onResetApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartSetup, onOpenAuth, onResetApp }) => {
  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col overflow-y-auto selection:bg-blue-500 selection:text-white">
      
      {/* Navigation Header with SaaS Sign In / Sign Up */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white">AGY Cloud</span>
            <Badge variant="outline" className="text-[10px] py-0 px-2 border-blue-500/40 text-blue-400 font-mono">
              Multi-User SaaS
            </Badge>
          </div>
        </div>

        {/* Top Navbar Links & Auth Action Buttons */}
        <div className="flex items-center gap-3">
          <a href="#features" className="hidden sm:inline-block text-xs text-muted-foreground hover:text-white transition-colors">
            Features
          </a>
          <a href="#architecture" className="hidden sm:inline-block text-xs text-muted-foreground hover:text-white transition-colors">
            Architecture
          </a>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenAuth("signin")}
            className="h-8 text-xs text-gray-200 hover:text-white hover:bg-accent gap-1.5 font-medium cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5 text-blue-400" /> Log In
          </Button>

          <Button
            size="sm"
            onClick={() => onOpenAuth("signup")}
            className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 font-medium cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" /> Sign Up Free
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onResetApp}
            className="hidden md:inline-flex h-8 text-xs border-border text-muted-foreground hover:text-white"
            title="Reset cached configuration"
          >
            Reset
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-6 max-w-6xl mx-auto text-center space-y-8 flex flex-col items-center">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

        <Badge variant="default" className="gap-2 px-3 py-1 bg-blue-600/10 border border-blue-500/30 text-blue-400 text-xs shadow-inner">
          <Sparkles className="h-3.5 w-3.5" /> Multi-User SaaS Platform • Powered by Google AI Quota & Daytona MicroVMs
        </Badge>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15]">
          Cloud Software Development with <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Your Google AI Quota</span>
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
          Execute Google Antigravity CLI (<code className="text-blue-400">agy</code>) headlessly inside isolated per-user Daytona micro-VM sandboxes. $0 LLM infrastructure costs, SQLite session persistence, Monaco IDE, and real-time live preview.
        </p>

        {/* Primary Call-To-Action SaaS Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            size="lg"
            onClick={() => onOpenAuth("signup")}
            className="h-12 px-8 text-sm gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xl shadow-blue-600/25 transition-all hover:scale-105 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Create Free Account <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenAuth("signin")}
            className="h-12 px-7 text-sm gap-2 border-border bg-card/70 text-white hover:bg-accent transition-all cursor-pointer"
          >
            <LogIn className="h-4 w-4 text-blue-400" /> Sign In to Workspace
          </Button>

          <Button
            variant="ghost"
            size="lg"
            onClick={onStartSetup}
            className="h-12 px-5 text-sm gap-1.5 text-muted-foreground hover:text-white"
          >
            <Zap className="h-4 w-4 text-amber-400" /> Guest Setup
          </Button>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-muted-foreground border-t border-border/40 w-full max-w-3xl">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Multi-User Isolation</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> BYOQ (Bring Your Own Quota)</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Persistent SQLite Database</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Signed Preview &amp; VNC</span>
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
            <span className="font-mono text-[11px] text-gray-400">AGY Cloud SaaS — 30/70 Split Coding Workspace</span>
            <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-400">
              Live SaaS Active
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
                <div className="rounded-lg bg-muted/60 p-2.5 text-gray-300 text-[11px] border border-border/40">
                  <p className="font-semibold text-white mb-1">User Prompt</p>
                  "Build a full-stack real-time analytics dashboard with React &amp; Tailwind"
                </div>
                <div className="rounded-lg bg-blue-950/40 p-2.5 text-blue-200 text-[11px] border border-blue-500/20">
                  <p className="font-semibold text-blue-400 mb-1 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> AGY Agent Stream
                  </p>
                  Provisioned microVM container • Generated frontend &amp; backend • Port 3000 detected
                </div>
              </div>
              <div className="border border-border/60 rounded-md p-2 bg-black/40 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Ask AGY agent...</span>
                <Badge variant="default" className="text-[9px] py-0">Enter</Badge>
              </div>
            </div>

            {/* Right 70% Preview Pane */}
            <div className="md:col-span-8 bg-card/40 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[11px]">
                <div className="flex items-center gap-2 font-semibold text-gray-200">
                  <Globe className="h-4 w-4 text-emerald-400" /> Daytona Sandbox Preview (70% Width)
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-400">
                    Live HTTPS Preview
                  </Badge>
                </div>
              </div>
              <div className="flex-1 rounded-lg border border-border/60 bg-black/60 flex items-center justify-center p-6 text-center space-y-2">
                <div className="space-y-1">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Globe className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Live App Running in Daytona MicroVM</h4>
                  <p className="text-[11px] text-muted-foreground font-mono">https://3000-sb-user-workspace.daytona.app</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Tabs: Live Preview • VNC Desktop • Monaco Code • Terminal • OpenTelemetry</span>
                <span className="text-emerald-400 flex items-center gap-1">● MicroVM Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture & SaaS Highlights */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3">
          <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-xs">
            Platform Capabilities
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Enterprise Architecture for Autonomous Code Agents
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto">
            Combining Daytona's microVM orchestrator with Google Antigravity CLI and multi-user SQLite persistence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
            <div className="h-10 w-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Multi-User Authentication</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              JWT-authenticated user sessions, dedicated SQLite sandbox databases, persistent chat history, and isolated environments per developer.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
            <div className="h-10 w-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Daytona MicroVM Sandboxes</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sub-200ms isolated Linux container environments with cgroup-v2 boundaries, native OpenTelemetry collection, and signed preview URLs.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-blue-500/50 transition-all">
            <div className="h-10 w-10 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">OpenTelemetry &amp; VNC Desktop</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time CPU, RAM, and NVMe telemetry progress cards alongside interactive XFCE graphical desktop access for computer use.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="mt-auto border-t border-border/60 py-12 px-6 bg-card text-center space-y-6">
        <div className="max-w-xl mx-auto space-y-3">
          <h3 className="text-2xl font-bold text-white">Ready to Start Cloud Coding?</h3>
          <p className="text-xs text-muted-foreground">
            Sign up for your free account or sign in to access your Daytona sandbox microVM.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => onOpenAuth("signup")}
              className="gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer shadow-lg shadow-blue-600/20"
            >
              <UserPlus className="h-4 w-4" /> Create Free Account
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => onOpenAuth("signin")}
              className="gap-2 border-border text-white hover:bg-accent cursor-pointer"
            >
              <LogIn className="h-4 w-4 text-blue-400" /> Sign In
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground pt-6 border-t border-border/40">
          AGY Cloud SaaS Platform • Powered by Antigravity CLI &amp; Daytona Micro-VMs
        </p>
      </footer>

    </div>
  );
};
