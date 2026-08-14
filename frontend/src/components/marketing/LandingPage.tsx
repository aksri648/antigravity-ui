import React, { useState } from "react";
import {
  Sparkles,
  Cpu,
  ArrowRight,
  Zap,
  Terminal,
  Layers,
  CheckCircle2,
  LogIn,
  Lock,
  Box,
  Database,
  ChevronRight,
  BookOpen,
  Radio,
  Workflow,
  HardDrive,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface LandingPageProps {
  onStartSetup: () => void;
  onLaunchWorkspace: () => void;
  onOpenAuth: (mode: "signin" | "signup") => void;
  onResetApp: () => void;
}

type ShowcaseTab = "ide" | "agents" | "opencode" | "preview";
type DocSection =
  | "fde"
  | "overview"
  | "database"
  | "quickstart"
  | "agents"
  | "cliswitcher"
  | "secrets"
  | "mcp"
  | "api";

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartSetup,
  onLaunchWorkspace,
  onOpenAuth,
  onResetApp,
}) => {
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseTab>("ide");
  const [activeDocSection, setActiveDocSection] = useState<DocSection>("fde");

  return (
    <div className="min-h-screen w-full bg-[#0c0c0e] text-[#f4f4f6] flex flex-col overflow-y-auto selection:bg-emerald-500 selection:text-black">
      {/* Top Banner Notice */}
      <div className="w-full bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 border-b border-white/10 py-2.5 px-4 text-center text-xs font-medium text-gray-300">
        <span className="inline-flex items-center gap-2">
          <Badge className="bg-emerald-500 text-black font-bold text-[10px] px-2 py-0.5 rounded-full">FDE SYSTEM</Badge>
          <span>DELTA: Autonomous Forward Deployed Engineering System with Pluggable CLI Swarm & Daytona Micro-VMs</span>
          <a href="#docs" className="text-emerald-400 font-semibold underline hover:text-emerald-300 ml-1">
            Read Docs →
          </a>
        </span>
      </div>

      {/* Floating Glass Navigation Header Container */}
      <div className="sticky top-0 z-50 pt-5 pb-2 px-4 sm:px-8 w-full max-w-7xl mx-auto pointer-events-none">
        <header className="pointer-events-auto mx-auto w-full rounded-full border border-white/15 bg-[#16161a]/90 backdrop-blur-2xl px-6 sm:px-8 h-20 flex items-center justify-between shadow-2xl shadow-black/60 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-black shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white font-mono">DELTA</span>
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0.5 px-2.5 border-emerald-500/40 text-emerald-400 font-mono">
                FDE Platform v2.4
              </Badge>
            </div>
          </div>

          {/* Center Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-gray-300">
            <a href="#showcase" className="hover:text-white transition-colors">Showcase</a>
            <a href="#manifesto" className="hover:text-white transition-colors">FDE Manifesto</a>
            <a href="#features" className="hover:text-white transition-colors">Agent Swarm</a>
            <a href="#docs" className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 font-bold">
              <BookOpen className="h-4 w-4" /> Documentation & LLD
            </a>
          </nav>

          {/* Right CTA Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenAuth("signin")}
              className="h-10 text-xs text-gray-300 hover:text-white hover:bg-white/10 gap-1.5 font-semibold rounded-full px-5"
            >
              <LogIn className="h-4 w-4 text-emerald-400" /> Sign In
            </Button>

            <Button
              size="sm"
              onClick={onLaunchWorkspace}
              className="h-10 text-xs gap-1.5 bg-white text-zinc-950 hover:bg-emerald-400 hover:text-black shadow-lg font-extrabold rounded-full px-6 transition-all cursor-pointer"
            >
              Launch Workspace <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </header>
      </div>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-24 px-6 max-w-7xl mx-auto text-center flex flex-col items-center">
        {/* Glow backdrop */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />

        <div className="flex items-center gap-2 mb-6">
          <span className="font-mono text-xs tracking-wider uppercase text-emerald-400 font-semibold px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1.5">
            <Workflow className="h-3.5 w-3.5" /> Forward Deployed Engineering (FDE) System
          </span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl leading-[1.08] text-balance font-mono">
          Know your code.<br />
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            So your agents can build anything.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-gray-400 max-w-3xl leading-relaxed">
          The ultimate intelligent assistant for <strong>Forward Deployed Engineers</strong>. DELTA automates end-to-end customer solution delivery—from technical requirements and code generation to cloud infrastructure deployment—using isolated <strong>Daytona micro-VM sandboxes</strong> and pluggable CLI swarms.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <Button
            size="lg"
            onClick={onStartSetup}
            className="h-12 px-8 text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-full shadow-lg shadow-emerald-500/25 transition-all gap-2 cursor-pointer"
          >
            Start Setup Wizard <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={onLaunchWorkspace}
            className="h-12 px-8 text-sm border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-full backdrop-blur-md gap-2 cursor-pointer"
          >
            Launch Live Workspace
          </Button>
        </div>

        {/* Micro Badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>4 Specialized Autonomous Agents</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Pluggable Drivers: AGY ⚡ & OpenCode 💻</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Daytona Micro-VMs & Persistent Volumes</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Supabase Cloud Auth & PostgREST DB</span>
          </div>
        </div>
      </section>

      {/* SHOWCASE SECTION */}
      <section id="showcase" className="px-6 py-16 max-w-7xl mx-auto w-full">
        {/* Showcase Switcher Pills */}
        <div className="flex justify-center mb-8">
          <div className="flex rounded-full bg-[#16161a] p-1.5 border border-white/10 gap-1 shadow-lg">
            <button
              onClick={() => setActiveShowcase("ide")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeShowcase === "ide"
                  ? "bg-white text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Split IDE & Preview
            </button>
            <button
              onClick={() => setActiveShowcase("agents")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeShowcase === "agents"
                  ? "bg-white text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              4 Specialized Agents
            </button>
            <button
              onClick={() => setActiveShowcase("opencode")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeShowcase === "opencode"
                  ? "bg-white text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Dual CLI Switcher
            </button>
            <button
              onClick={() => setActiveShowcase("preview")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeShowcase === "preview"
                  ? "bg-white text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Daytona Volume Sync
            </button>
          </div>
        </div>

        {/* Showcase Preview Box */}
        <div className="rounded-3xl border border-white/10 bg-[#121216] p-4 sm:p-6 shadow-2xl overflow-hidden relative">
          {activeShowcase === "ide" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                  <span className="text-xs font-mono text-gray-400 ml-2">delta-workspace / live-stream</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                  Split Workspace Active
                </Badge>
              </div>
              <img
                src="/images/hero_cloud_ide.jpg"
                alt="DELTA Autonomous IDE with Monaco editor, Daytona micro-VM terminal, and Live Web Preview"
                className="rounded-2xl w-full h-[480px] object-cover border border-white/10 shadow-inner"
              />
            </div>
          )}

          {activeShowcase === "agents" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
              <div className="space-y-6 flex flex-col justify-center">
                <Badge className="w-fit bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Autonomous Swarm
                </Badge>
                <h3 className="text-3xl font-extrabold text-white leading-tight font-mono">
                  4 AI Personas Built for Forward Deployed Engineers
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Rather than a generic chatbot, DELTA deploys 4 purpose-built engineering agents that conduct technical requirement interviews, recommend production clouds, package containers, and submit verified pull requests.
                </p>
                <div className="space-y-2 font-mono text-xs text-gray-400">
                  <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-400" /> App Developer: Spec interview & full-stack code</div>
                  <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-purple-400" /> LLM Deployer: Azure AKS vs RunPod Serverless</div>
                  <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-400" /> App Deployer: Dockerization & Azure Linux VM</div>
                  <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-cyan-400" /> App Maintainer: Repo clone, branch refactor & PR</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/60 p-4 flex items-center justify-center">
                <img
                  src="/images/delta_fde_flowchart.jpg"
                  alt="DELTA Forward Deployed Engineering System Flowchart"
                  className="rounded-xl w-full h-[380px] object-cover"
                />
              </div>
            </div>
          )}

          {activeShowcase === "opencode" && (
            <div className="p-6 space-y-6">
              <div className="max-w-2xl space-y-3">
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Pluggable CLI Engine</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">Switch Between AGY and OpenCode in the Same Workspace</h3>
                <p className="text-sm text-gray-300">
                  Prefer Google Antigravity CLI for deep project exploration, but want OpenCode CLI for multi-model OpenAI/Anthropic code modifications? Click the engine switcher in the chat header to swap drivers without restarting your sandbox.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black p-4 font-mono text-xs space-y-2 text-gray-300">
                <div className="text-emerald-400">$ delta-engine switch --to opencode</div>
                <div className="text-gray-500">Mounted workspace: /home/daytona/persist/workspace</div>
                <div className="text-cyan-400">[AGY Driver] Code modified in place. Dev server hot reloaded on port 3000.</div>
                <div className="text-purple-400">[OpenCode Driver] Attached to same directory. Zero context lost.</div>
              </div>
            </div>
          )}

          {activeShowcase === "preview" && (
            <div className="p-6 space-y-6">
              <div className="max-w-2xl space-y-3">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Persistence & Watchdog</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">Daytona Persistent Volumes with 30-Min Auto-Persist</h3>
                <p className="text-sm text-gray-300">
                  Every user workspace is backed by a persistent Daytona volume mounted at <code className="text-emerald-400">/home/daytona/persist</code>. When inactive for &gt;30 minutes, DELTA automatically flushes modified files and pauses the sandbox container to minimize cloud compute costs.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                  <div className="text-emerald-400 font-bold">1. Active Coding</div>
                  <div className="text-gray-400">Fast local micro-VM disk I/O with automatic symlink to persistent storage.</div>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                  <div className="text-yellow-400 font-bold">2. 30m Idle Watchdog</div>
                  <div className="text-gray-400">Inactivity manager flushes files to persistent volume and deletes container.</div>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                  <div className="text-blue-400 font-bold">3. Instant Restore</div>
                  <div className="text-gray-400">New prompt provisions fresh micro-VM and mounts volume with 100% state intact.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* MANIFESTO SECTION (SPOTIFY XIRP STYLE) */}
      <section id="manifesto" className="px-6 py-28 max-w-4xl mx-auto w-full">
        <div className="space-y-12 text-xl sm:text-3xl font-bold leading-snug text-gray-300">
          <p>
            AI coding tools solved the <span className="text-white">generation problem</span>. Code gets written faster, boilerplate disappears, and lines of code explode.
          </p>
          <p className="text-gray-500">
            For <strong>Forward Deployed Engineers</strong>, writing code is only 20% of the job. The real friction is understanding client constraints, managing ephemeral micro-VMs, provisioning cloud infrastructure, and maintaining live systems with persistent context.
          </p>
          <p>
            <span className="text-emerald-400">DELTA is different.</span> It is a comprehensive Forward Deployed Engineering system that connects your agents to real micro-VM sandboxes, persistent volumes, multi-model CLIs, Supabase data persistence, and automated cloud deployment pipelines.
          </p>
          <p className="text-white text-2xl sm:text-4xl font-extrabold leading-tight font-mono">
            Your agents don't guess in the dark. They architect, build, verify, deploy, and maintain.
          </p>
        </div>
      </section>

      {/* 4 SPECIALIZED AGENTS DEEP DIVE */}
      <section id="features" className="px-6 py-20 max-w-7xl mx-auto w-full space-y-24">
        {/* Agent 1 */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-4">
            <span className="font-mono text-xs text-emerald-400 uppercase font-bold tracking-wider">// AGENT 01</span>
            <h3 className="text-3xl font-extrabold text-white font-mono">App Developer Agent</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Conducts an interactive requirements interview, clarifies ambiguous specifications, recommends modern frameworks (React, Vite, Node, Go, Python), and constructs entire multi-file codebases inside the sandbox.
            </p>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Interactive clarification interview & tech stack selection</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Daytona filesystem workspace scaffolding</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Automatic dev server startup & port forwarding (Port 3000)</li>
            </ul>
          </div>
          <div className="flex-1 rounded-3xl border border-white/10 bg-[#141418] p-4 overflow-hidden">
            <img src="/images/hero_cloud_ide.jpg" alt="App Developer Agent" className="rounded-2xl w-full h-auto object-cover" />
          </div>
        </div>

        {/* Agent 2 */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
          <div className="flex-1 space-y-4">
            <span className="font-mono text-xs text-purple-400 uppercase font-bold tracking-wider">// AGENT 02</span>
            <h3 className="text-3xl font-extrabold text-white font-mono">LLM Deployer Agent</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Asks detailed traffic profiling questions (steady vs bursty QPS, latency SLAs, model weights) to determine the optimal production infrastructure: <strong>Azure AKS Dedicated GPU</strong> vs <strong>RunPod Serverless</strong>.
            </p>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Interactive traffic analysis & cost estimation</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Automated vLLM / Ollama deployment on Azure or RunPod</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Returns live OpenAI-compatible endpoint URLs and API keys</li>
            </ul>
          </div>
          <div className="flex-1 rounded-3xl border border-white/10 bg-[#141418] p-4 overflow-hidden">
            <img src="/images/delta_fde_flowchart.jpg" alt="LLM Deployer Agent" className="rounded-2xl w-full h-auto object-cover" />
          </div>
        </div>

        {/* Agent 3 */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-4">
            <span className="font-mono text-xs text-blue-400 uppercase font-bold tracking-wider">// AGENT 03</span>
            <h3 className="text-3xl font-extrabold text-white font-mono">App Deployer Agent</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Inspects your application codebase, generates production-grade multi-stage Dockerfiles and docker-compose files, provisions an Azure Linux VM, installs Docker, and runs your container with health-check monitoring.
            </p>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-400" /> Automatic Dockerfile & environment generation</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-400" /> Azure Compute Linux VM provisioning via Azure MCP</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-400" /> Automatic public IP assignment & TLS setup</li>
            </ul>
          </div>
          <div className="flex-1 rounded-3xl border border-white/10 bg-[#141418] p-4 overflow-hidden">
            <img src="/images/delta_lld_architecture.jpg" alt="App Deployer Agent" className="rounded-2xl w-full h-auto object-cover" />
          </div>
        </div>

        {/* Agent 4 */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
          <div className="flex-1 space-y-4">
            <span className="font-mono text-xs text-amber-400 uppercase font-bold tracking-wider">// AGENT 04</span>
            <h3 className="text-3xl font-extrabold text-white font-mono">App Maintainer Agent</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Takes any GitHub repository URL, clones it into your persistent volume, prompts you for required changes or bug fixes, tests modifications in the live sandbox, commits to a dedicated branch, and opens a GitHub Pull Request.
            </p>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> 1-click GitHub repository cloning & setup</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> Human-in-the-loop branch diff review gate</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> GitHub MCP & `gh pr create` automation</li>
            </ul>
          </div>
          <div className="flex-1 rounded-3xl border border-white/10 bg-[#141418] p-4 overflow-hidden">
            <img src="/images/delta_db_schema_flow.jpg" alt="App Maintainer Agent" className="rounded-2xl w-full h-auto object-cover" />
          </div>
        </div>
      </section>

      {/* COMPREHENSIVE DOCUMENTATION & LLD SPECIFICATION SECTION */}
      <section id="docs" className="px-6 py-24 max-w-7xl mx-auto w-full border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="font-mono text-xs uppercase text-emerald-400 font-semibold tracking-wider">// TECHNICAL DOCUMENTATION & SYSTEM DESIGN (LLD)</span>
          <h2 className="text-3xl sm:text-5xl font-black text-white font-mono">DELTA Technical Specifications</h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Detailed low-level architecture, Supabase DB schema, FDE workflows, CLI switcher mechanics, and API references.
          </p>
        </div>

        {/* Documentation Interactive Split */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Docs Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-1">
            {[
              { id: "fde", label: "FDE System Workflow", icon: Workflow },
              { id: "overview", label: "System Design (HLD & LLD)", icon: Layers },
              { id: "database", label: "DB Schema & RLS Policies", icon: Database },
              { id: "quickstart", label: "Quickstart Setup", icon: Zap },
              { id: "agents", label: "4 Autonomous Agents", icon: Cpu },
              { id: "cliswitcher", label: "CLI Switcher (AGY / OpenCode)", icon: Terminal },
              { id: "secrets", label: "Daytona Secrets & Volumes", icon: Lock },
              { id: "mcp", label: "MCP Integrations", icon: Box },
              { id: "api", label: "REST & WebSocket API", icon: Radio },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activeDocSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveDocSection(item.id as DocSection)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className={`h-3 w-3 transition-transform ${isSelected ? "text-emerald-400 translate-x-1" : "text-gray-600"}`} />
                </button>
              );
            })}
          </div>

          {/* Docs Content Viewer */}
          <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-[#121216] p-6 sm:p-8 space-y-6">
            
            {/* 1. Forward Deployed Engineering System */}
            {activeDocSection === "fde" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Current implementation</Badge>
                  <h3 className="text-2xl font-bold text-white font-mono">How DELTA actually executes an engineering task</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    The marketing docs mirror the code that ships: the React client calls a Gin API, the Go services provision and operate a Daytona sandbox, and the agent runner executes AGY or OpenCode against the persistent workspace. A WebSocket hub streams execution events back to the browser.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/60 p-3">
                  <img
                    src="/images/docs/delta-runtime-architecture.jpg"
                    alt="DELTA current runtime architecture"
                    className="rounded-xl w-full h-[360px] object-cover"
                  />
                  <p className="text-[11px] font-mono text-center text-gray-400 mt-2">
                    Fig 1: Runtime architecture derived from the current frontend, backend services, persistence, and Daytona integration.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                    <h5 className="font-bold text-white flex items-center gap-1.5"><Workflow className="h-4 w-4 text-emerald-400" /> 1. Request enters Go</h5>
                    <p className="text-gray-400">`POST /api/workspace/prompt` carries the prompt, selected CLI engine, and workspace context into the Go control plane.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                    <h5 className="font-bold text-white flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-cyan-400" /> 2. Sandbox execution</h5>
                    <p className="text-gray-400">`AGYService` uses Daytona process execution to run the chosen CLI inside the user sandbox and persistent workspace.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                    <h5 className="font-bold text-white flex items-center gap-1.5"><Radio className="h-4 w-4 text-blue-400" /> 3. Events return live</h5>
                    <p className="text-gray-400">Agent output is converted into stream events and broadcast through the Gorilla WebSocket hub to ChatPane and PreviewPane.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. System Design (HLD & LLD) */}
            {activeDocSection === "overview" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Architecture (LLD)</Badge>
                  <h3 className="text-2xl font-bold text-white font-mono">Control plane, sandbox boundary, and persistence</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    The implemented system is a small control plane with explicit service boundaries. The browser never runs the agent locally: it talks to Gin, which talks to Daytona. SQLite is the runtime fallback store; Supabase can back authentication and cloud persistence.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/60 p-3">
                  <img
                    src="/images/docs/delta-request-lifecycle.jpg"
                    alt="DELTA prompt to preview request lifecycle"
                    className="rounded-xl w-full h-[360px] object-cover"
                  />
                  <p className="text-[11px] font-mono text-center text-gray-400 mt-2">
                    Fig 2: Prompt-to-preview lifecycle across browser, Go API, Daytona process execution, streaming, and preview.
                  </p>
                </div>

                <div className="space-y-3 text-xs text-gray-300">
                  <div className="p-3 rounded-lg border border-white/10 bg-black/40">
                    <strong className="text-emerald-400">WebSocket hub (`/ws`):</strong> broadcasts `thought`, `tool_start`, `token`, `port_detected`, `error`, and `done` events to connected clients.
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/40">
                    <strong className="text-cyan-400">Preview path:</strong> the backend can mint/fetch a preview URL or proxy a sandbox port; the frontend stores the active port and updates the preview panel when a `port_detected` event arrives.
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/40">
                    <strong className="text-purple-400">Inactivity lifecycle:</strong> backend middleware records sandbox activity and the 30-minute inactivity manager handles idle sessions.
                  </div>
                </div>
              </div>
            )}

            {/* 3. Database Schema & RLS */}
            {activeDocSection === "database" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Data Layer</Badge>
                  <h3 className="text-2xl font-bold text-white font-mono">Supabase schema + SQLite runtime persistence</h3>
                  <p className="text-sm text-gray-300">
                    SQLite is initialized by the Go backend and stores runtime users, sandboxes, chat, and settings. The Supabase schema adds profiles, chat history, sandbox records, cloud secrets, and Row-Level Security policies for a cloud-backed deployment.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/60 p-3">
                  <img
                    src="/images/docs/delta-data-security-model.jpg"
                    alt="DELTA data, authentication, and isolation model"
                    className="rounded-xl w-full h-[360px] object-cover"
                  />
                  <p className="text-[11px] font-mono text-center text-gray-400 mt-2">
                    Fig 3: Current data and isolation model, including auth middleware, SQLite, Supabase RLS, and Daytona boundaries.
                  </p>
                </div>

                {/* Table Schema Breakdown */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-lg border border-white/10 bg-black/50 space-y-1">
                    <span className="text-emerald-400 font-bold">1. public.profiles</span>
                    <p className="text-[11px] text-gray-400">`id`, `email`, `name`, Daytona credentials, and timestamps. RLS is enabled and policies scope rows to `auth.uid()`.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/50 space-y-1">
                    <span className="text-cyan-400 font-bold">2. public.chat_messages</span>
                    <p className="text-[11px] text-gray-400">Per-user chat records with sandbox id, sender, text, thoughts/tools JSON, error flag, and timestamps.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/50 space-y-1">
                    <span className="text-purple-400 font-bold">3. public.user_sandboxes</span>
                    <p className="text-[11px] text-gray-400">Tracks the Daytona sandbox id plus preview URL, active port, last-activity timestamp, and ownership.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/50 space-y-1">
                    <span className="text-amber-400 font-bold">4. public.cloud_secrets</span>
                    <p className="text-[11px] text-gray-400">Provider/key-name pairs plus an `encrypted_value` column and per-user RLS. Runtime endpoints expose integrations/secrets operations.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Quickstart Setup */}
            {activeDocSection === "quickstart" && (
              <div className="space-y-4">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Getting Started</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">First-run path in the current app</h3>
                <p className="text-sm text-gray-300">The implemented UI starts at the marketing page, then moves through auth/setup before entering the live workspace.</p>
                <ol className="space-y-3 text-xs text-gray-300 list-decimal list-inside">
                  <li><strong>Authenticate:</strong> register/sign in; the backend uses Supabase auth when configured and a local JWT fallback otherwise.</li>
                  <li><strong>Verify/setup Daytona:</strong> the setup wizard calls backend verification/setup endpoints and creates or reuses a sandbox/volume.</li>
                  <li><strong>Launch workspace:</strong> App.tsx connects to the Go WebSocket, loads chat history, and exposes files, preview, telemetry, and agent controls.</li>
                </ol>
                <div className="p-4 rounded-xl border border-white/10 bg-black/60 font-mono text-xs text-emerald-400">
                  // Deployment note: audit secret storage/configuration before treating the current path as production-grade credential management.
                </div>
              </div>
            )}

            {/* 5. 4 Autonomous Agents */}
            {activeDocSection === "agents" && (
              <div className="space-y-4">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">Autonomous Swarm</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">The 4 agent personas in the repository</h3>
                <p className="text-sm text-gray-300">
                  The Python `AgentOrchestrator` routes a task to one of four specialized classes. They share the same driver interface and Daytona sandbox context.
                </p>
                <div className="rounded-2xl border border-white/10 bg-black/60 p-3">
                  <img src="/images/docs/delta-agent-cli-architecture.jpg" alt="DELTA agent and CLI architecture" className="rounded-xl w-full h-[360px] object-cover" />
                </div>
                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg border border-white/10 bg-black/30">
                    <span className="text-xs font-bold text-emerald-400">1. App Developer:</span>
                    <p className="text-[11px] text-gray-300 mt-1">Guides requirements, architecture, code generation, and validation inside the workspace.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/30">
                    <span className="text-xs font-bold text-purple-400">2. LLM Deployer:</span>
                    <p className="text-[11px] text-gray-300 mt-1">Focuses on model deployment planning and execution, with a traffic-profile input in the orchestrator.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/30">
                    <span className="text-xs font-bold text-blue-400">3. App Deployer:</span>
                    <p className="text-[11px] text-gray-300 mt-1">Inspects the workspace, containerizes the app, and follows the repository deployment workflow.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/30">
                    <span className="text-xs font-bold text-cyan-400">4. App Maintainer:</span>
                    <p className="text-[11px] text-gray-300 mt-1">Handles repository-oriented maintenance and feature work with branch/PR tooling.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 6. CLI Switcher */}
            {activeDocSection === "cliswitcher" && (
              <div className="space-y-4">
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Runtime Engine</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">Runtime CLI switcher: AGY and OpenCode</h3>
                <p className="text-sm text-gray-300">
                  The workspace chat exposes `agy` and `opencode` as the implemented UI engine choices. Both run inside the same persistent Daytona workspace path.
                </p>
                <ul className="space-y-2 text-xs text-gray-300">
                  <li>• `ChatPane.tsx` maintains the selected engine as `agy | opencode`.</li>
                  <li>• The prompt reaches `AGYService.StreamPromptExec`, which chooses the command runner.</li>
                  <li>• `agents/drivers.py` also defines a shared driver contract with AGY, OpenCode, and Claude Code.</li>
                </ul>
                <div className="rounded-xl border border-white/10 bg-black p-4 font-mono text-xs text-gray-300">
                  <div className="text-emerald-400">workspace: /home/daytona/persist/workspace</div>
                  <div className="text-cyan-400 mt-2">engine: agy</div>
                  <div className="text-purple-400">engine: opencode</div>
                  <div className="text-gray-500 mt-2">same sandbox · same files · different CLI process</div>
                </div>
              </div>
            )}

            {/* 7. Secrets & Persistence */}
            {activeDocSection === "secrets" && (
              <div className="space-y-4">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Persistence & Security</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">Credentials, volumes, and the inactivity lifecycle</h3>
                <p className="text-sm text-gray-300">
                  The implementation combines user settings, integration secrets, a persistent Daytona volume, and a 30-minute inactivity manager.
                </p>
                <ul className="space-y-2 text-xs text-gray-300">
                  <li>• <strong>Persistent volume:</strong> Daytona sandboxes mount `/home/daytona/persist` when a real volume is available.</li>
                  <li>• <strong>Activity tracking:</strong> backend middleware records recent sandbox activity and the inactivity manager uses a 30-minute threshold.</li>
                  <li>• <strong>Secrets endpoints:</strong> `/api/integrations/secrets` exposes status/save operations into the Daytona layer.</li>
                </ul>
              </div>
            )}

            {/* 8. MCP Integrations */}
            {activeDocSection === "mcp" && (
              <div className="space-y-4">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Model Context Protocol</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">MCP and agent integrations</h3>
                <p className="text-sm text-gray-300">
                  The repository's sandbox bootstrap writes integration skills into the persistent Gemini/agent configuration. The Python layer also exposes driver abstractions so more tooling can be added without rewriting agent routing.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-black/40 border border-white/10 text-blue-300">Azure MCP Server</div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/10 text-emerald-300">GitHub MCP Server</div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/10 text-purple-300">RunPod Serverless API</div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/10 text-amber-300">Hugging Face Hub MCP</div>
                </div>
              </div>
            )}

            {/* 9. REST & WebSocket APIs */}
            {activeDocSection === "api" && (
              <div className="space-y-4">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Developer API</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">REST & WebSocket API surface</h3>
                <p className="text-sm text-gray-300">These routes are registered in `backend/main.go` and are the source of truth for this page.</p>
                <div className="space-y-2 font-mono text-xs text-gray-300">
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>POST /api/auth/register|signup|login</code> - auth entry points</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>POST /api/env/provision</code> - sandbox/volume provisioning</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>POST /api/workspace/prompt</code> - dispatch agent execution</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>GET|PUT /api/fs/*</code> - workspace file operations</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>GET /api/workspace/preview-url</code> + <code>ANY /api/preview/proxy/:sandboxId/:port/*path</code> - live app preview</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>GET /api/workspace/telemetry</code> - sandbox metrics</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>GET /ws</code> - real-time stream events</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SPOTIFY-STYLE IMPACT CTA BANNER */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="relative rounded-3xl bg-[#1ed760] text-black p-10 sm:p-16 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden shadow-2xl">
          <div className="space-y-3 text-center md:text-left z-10 max-w-xl">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-black font-mono">
              Ready to code at lightning speed?
            </h2>
            <p className="text-black/80 font-medium text-sm sm:text-base">
              The premier Forward Deployed Engineering platform. Start with one project and experience autonomous agents with real cloud context.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 z-10 w-full md:w-auto">
            <Button
              size="lg"
              onClick={onStartSetup}
              className="h-12 px-8 text-sm bg-black hover:bg-zinc-900 text-white font-extrabold rounded-full shadow-xl cursor-pointer"
            >
              Start 3-Step Setup
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onLaunchWorkspace}
              className="h-12 px-8 text-sm border-2 border-black bg-transparent text-black hover:bg-black/10 font-extrabold rounded-full cursor-pointer"
            >
              Launch Live Workspace
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 py-10 px-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>DELTA • Autonomous Forward Deployed Engineering System • Powered by Daytona & Supabase</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#docs" className="hover:text-white transition-colors">Docs & LLD</a>
          <a href="https://app.daytona.io" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Daytona Cloud</a>
          <a href="https://supabase.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Supabase</a>
          <button onClick={onResetApp} className="hover:text-red-400 transition-colors cursor-pointer">Reset Data</button>
        </div>
      </footer>
    </div>
  );
};
