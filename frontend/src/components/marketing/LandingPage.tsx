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
import { MermaidDiagram } from "../common/MermaidDiagram";

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

// Mermaid diagram definitions with dark theme styling
const ideDiagram = `flowchart LR
    subgraph Browser ["Client Presentation"]
        direction TB
        Editor["Monaco Code Editor<br/>(Live syntax & AST)"]
        TerminalUI["Terminal Console<br/>(xterm.js / stream)"]
        PreviewUI["Web Preview Iframe<br/>(Port 3000 forward)"]
    end
    
    subgraph HostEngine ["Go Backend (:8080)"]
        direction TB
        WSHandler["WebSocket Stream Hub"]
        ProxyRouter["Preview Reverse Proxy"]
    end

    subgraph DaytonaVM ["Daytona Micro-VM Sandbox"]
        direction TB
        VMRoot["/home/daytona/persist/workspace"]
        DevSrv["Vite / Next.js Dev Server"]
    end

    Editor <--> WSHandler
    TerminalUI <--> WSHandler
    PreviewUI <--> ProxyRouter
    WSHandler <--> VMRoot
    ProxyRouter <--> DevSrv`;

const fdeFlowDiagram = `graph TD
    Client["Client Problem / Feature Request"] --> Ingestion["1. Requirement Interview<br/>(Spec Scoping & SLA Profiling)"]
    
    Ingestion --> Swarm{"DELTA Agent Swarm"}
    
    Swarm -->|"Full-Stack Scaffold"| AppDev["App Developer Agent<br/>• React / Vite / Go / Python<br/>• File Scaffolding & Live Server"]
    Swarm -->|"QPS & Latency Profiling"| LLMDep["LLM Deployer Agent<br/>• Azure AKS (Dedicated GPU)<br/>• RunPod Serverless vLLM"]
    Swarm -->|"Docker & Cloud VM"| AppDep["App Deployer Agent<br/>• Multi-Stage Dockerfile<br/>• Azure Linux VM Provisioning"]
    Swarm -->|"Repo Clone & Fixes"| AppMaint["App Maintainer Agent<br/>• Git Branch Isolation<br/>• Human Review Gate & PR"]
    
    AppDev --> CLI["Pluggable CLI Engine<br/>⚡ AGY (Antigravity) | 💻 OpenCode"]
    LLMDep --> CLI
    AppDep --> CLI
    AppMaint --> CLI
    
    CLI --> Daytona["Daytona Cloud Micro-VM<br/>• Volume: /home/daytona/persist<br/>• 30-Min Inactivity Watchdog"]`;

const lldDiagram = `flowchart TD
    subgraph ClientLayer ["1. Presentation Layer (Browser)"]
        Browser["React 19 SPA (Monaco + Terminal + Web Preview)"]
    end

    subgraph BackendLayer ["2. Orchestration Layer (Go Gin on Port 8080)"]
        Gin["Go Gin API Router"]
        WS["Gorilla WebSocket Hub (/ws)"]
        Auth["Supabase / JWT Auth Middleware"]
        Watchdog["Inactivity Watchdog (30m Auto-Persist)"]
        Proxy["Live Preview Reverse Proxy"]
    end

    subgraph StorageLayer ["3. Cloud & Data Layer"]
        SupaDB[("Supabase PostgreSQL<br/>• profiles & chat_messages<br/>• user_sandboxes & cloud_secrets")]
        LocalDB[("SQLite Local Cache<br/>• data/agy_cloud.db")]
    end

    subgraph SandboxLayer ["4. Sandbox Compute Layer (Daytona Cloud)"]
        DaytonaAPI["Daytona REST API Client"]
        MicroVM["Isolated Linux Micro-VM Sandbox"]
        Volume[("Persistent Storage Volume<br/>/home/daytona/persist/workspace")]
        DevServer["Active Dev Server (Port 3000)"]
    end

    Browser <-->|"HTTP REST API (Port 8080)"| Gin
    Browser <-->|"Bidirectional Stream (/ws)"| WS
    Browser <-->|"Live Preview Proxy (/api/preview/proxy)"| Proxy

    Gin --> Auth
    Auth --> SupaDB
    Auth --> LocalDB

    Gin --> DaytonaAPI
    DaytonaAPI --> MicroVM
    MicroVM --- Volume
    MicroVM --> DevServer
    Proxy <-->|"Internal HTTP Port Forward"| DevServer
    Watchdog -->|"Flush Files & Pause VM"| MicroVM`;

const dbSchemaDiagram = `erDiagram
    PROFILES ||--o{ CHAT_MESSAGES : "owns"
    PROFILES ||--o{ USER_SANDBOXES : "provisions"
    PROFILES ||--o{ CLOUD_SECRETS : "stores"

    PROFILES {
        UUID id PK "auth.users.id reference"
        TEXT email "User email address"
        TEXT name "Display name"
        TEXT daytona_api_key "Encrypted Daytona API Token"
        TEXT daytona_server_url "Custom Server URL or Cloud"
        TIMESTAMPTZ created_at "Account creation timestamp"
    }

    CHAT_MESSAGES {
        BIGSERIAL id PK "Message ID"
        UUID user_id FK "Owner profile reference"
        TEXT sandbox_id "Target Daytona Sandbox ID"
        TEXT sender "user / assistant / system"
        TEXT text "Markdown message text"
        JSONB thoughts "Model reasoning token log"
        JSONB tools "CLI tool invocations & outputs"
        BIGINT timestamp "Unix epoch timestamp"
    }

    USER_SANDBOXES {
        UUID id PK "Record ID"
        UUID user_id FK "Owner profile reference"
        TEXT daytona_sandbox_id "Active Daytona container ID"
        TEXT preview_url "Public / proxy preview link"
        INT active_port "Forwarded web port (e.g. 3000)"
        TIMESTAMPTZ last_active "Activity timestamp for Watchdog"
    }

    CLOUD_SECRETS {
        UUID id PK "Secret ID"
        UUID user_id FK "Owner profile reference"
        TEXT provider "github / azure / runpod / huggingface"
        TEXT key_name "Secret variable identifier"
        TEXT encrypted_value "Vault-encrypted secret payload"
        TIMESTAMPTZ updated_at "Last sync timestamp"
    }`;

const cliSwitcherDiagram = `flowchart LR
    subgraph FrontendControl ["Workspace UI"]
        SwitchBtn["CLI Toggle Button<br/>⚡ AGY  /  💻 OpenCode"]
    end

    subgraph BackendRouter ["Go Orchestrator"]
        EngineSelect["Engine Selector Logic<br/>(services/agy.go)"]
    end

    subgraph SharedDisk ["Shared Persistent Volume (/home/daytona/persist)"]
        CodeFiles["Workspace Source Code<br/>(Git repo, node_modules, .env)"]
    end

    subgraph CLIRuntimes ["Pluggable CLI Binaries"]
        AGYBin["Antigravity CLI (agy)<br/>• Google AI Studio Quota<br/>• stream-json output"]
        OpenCodeBin["OpenCode CLI (opencode)<br/>• OpenAI & Anthropic Models<br/>• Direct AST edits"]
    end

    SwitchBtn -->|"Active Engine Payload"| EngineSelect
    EngineSelect -->|"Mode: AGY"| AGYBin
    EngineSelect -->|"Mode: OpenCode"| OpenCodeBin
    AGYBin <--> CodeFiles
    OpenCodeBin <--> CodeFiles`;

const watchdogDiagram = `sequenceDiagram
    autonumber
    actor Dev as Engineer
    participant API as Go Backend API
    participant Watchdog as 30-Min Inactivity Watchdog
    participant VM as Daytona Micro-VM
    participant Vol as Persistent Volume (/home/daytona/persist)

    Dev->>API: Performs edits / prompts
    API->>Watchdog: Reset idle timer (T = 0 min)
    Dev-->>Dev: Engineer idle (no requests for 30 min)
    Watchdog->>Watchdog: Threshold reached (T >= 30 min)
    Watchdog->>VM: Flush dirty disk buffers to volume
    VM->>Vol: Sync files & database state
    Watchdog->>VM: Pause / delete container (Zero compute cost)
    
    Note over Dev,Vol: Later: Engineer returns & sends prompt
    Dev->>API: Sends new prompt
    API->>VM: Spin up fresh micro-VM & attach persistent volume
    Vol-->>VM: Mount /home/daytona/persist (100% state restored)
    API-->>Dev: Resume coding immediately with zero context loss`;

const appDevDiagram = `flowchart TD
    Prompt["Customer Feature Specification"] --> Spec["Interactive Clarification Interview"]
    Spec --> Stack["Framework Selection (React / Vite / Go / Python)"]
    Stack --> Scaffold["Daytona Micro-VM Scaffolding"]
    Scaffold --> LiveDev["Dev Server Auto-Start (Port 3000)"]
    LiveDev --> Preview["Live Web Preview Synced"]`;

const llmDeployerDiagram = `flowchart TD
    Profile["Traffic & SLA Profiling"] --> Decision{"Evaluate Latency & QPS"}
    Decision -->|"High Steady QPS / Low Latency"| AKS["Azure AKS Dedicated GPU<br/>(vLLM Container Deployment)"]
    Decision -->|"Bursty QPS / Variable Traffic"| RunPod["RunPod Serverless<br/>(Auto-scaling Endpoint)"]
    AKS --> Credentials["OpenAI-Compatible Endpoint & Key"]
    RunPod --> Credentials`;

const appDeployerDiagram = `flowchart TD
    Source["Workspace Source Files"] --> DockerGen["Multi-Stage Dockerfile Generation"]
    DockerGen --> AzureVM["Provision Azure Linux Compute VM"]
    AzureVM --> DockerRun["Install Engine & Run Container"]
    DockerRun --> TLS["Assign Public IP & SSL Reverse Proxy"]
    TLS --> Production["Live Production URL & Health Check"]`;

const appMaintainerDiagram = `flowchart TD
    Repo["GitHub Repository URL"] --> Clone["1-Click Clone to /home/daytona/persist"]
    Clone --> Branch["Create Isolated Feature / Bugfix Branch"]
    Branch --> SandboxTest["Execute Changes & Verify in Micro-VM"]
    SandboxTest --> DiffGate["Human-in-the-Loop Diff Approval"]
    DiffGate --> PR["Automated GitHub PR (gh pr create)"]`;

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
            Read Docs & Architecture →
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
              <BookOpen className="h-4 w-4" /> Documentation & Diagrams
            </a>
          </nav>

          {/* Right CTA Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenAuth("signin")}
              className="h-10 text-xs text-gray-300 hover:text-white hover:bg-white/10 gap-1.5 font-semibold rounded-full px-5 cursor-pointer"
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
              <MermaidDiagram
                chart={ideDiagram}
                id="ide-showcase"
                title="DELTA Real-time Workspace & Reverse Proxy Pipeline"
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
              <div className="rounded-2xl border border-white/10 bg-black/60 p-2 flex items-center justify-center overflow-hidden">
                <MermaidDiagram
                  chart={fdeFlowDiagram}
                  id="agents-showcase"
                  title="FDE Agent Specialization & Execution Pipeline"
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
              <MermaidDiagram
                chart={cliSwitcherDiagram}
                id="cli-showcase"
                title="Pluggable CLI Runtime Architecture"
              />
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
              <MermaidDiagram
                chart={watchdogDiagram}
                id="watchdog-showcase"
                title="30-Minute Inactivity Watchdog Sequence"
              />
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
            <MermaidDiagram
              chart={appDevDiagram}
              id="agent1-flow"
              title="App Developer Workflow"
            />
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
            <MermaidDiagram
              chart={llmDeployerDiagram}
              id="agent2-flow"
              title="LLM Deployment & Infrastructure Decision Flow"
            />
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
            <MermaidDiagram
              chart={appDeployerDiagram}
              id="agent3-flow"
              title="Containerization & Cloud VM Deployment Pipeline"
            />
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
            <MermaidDiagram
              chart={appMaintainerDiagram}
              id="agent4-flow"
              title="Repository Cloning & Pull Request Workflow"
            />
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
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">FDE System Specification</Badge>
                  <h3 className="text-2xl font-bold text-white font-mono">The Forward Deployed Engineering (FDE) Assistant</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Forward Deployed Engineers work on the front lines of customer deployments. DELTA acts as an autonomous execution co-pilot that ingests ambiguous client problems, scaffolds clean solutions, executes live sandbox verification, and coordinates cloud deployments.
                  </p>
                </div>

                <MermaidDiagram
                  chart={fdeFlowDiagram}
                  id="doc-fde-flow"
                  title="DELTA Forward Deployed Engineering (FDE) Multi-Agent Swarm Pipeline"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                    <h5 className="font-bold text-white flex items-center gap-1.5"><Workflow className="h-4 w-4 text-emerald-400" /> 1. Requirement Scoping</h5>
                    <p className="text-gray-400">Automated Q&A loop extracts client data formats, latency limits, cloud vendor requirements, and authentication mechanisms.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                    <h5 className="font-bold text-white flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-cyan-400" /> 2. Persistent Sandbox Execution</h5>
                    <p className="text-gray-400">Agents execute in isolated Daytona micro-VMs with zero host pollution, auto-persisting code to long-term volumes.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. System Design (HLD & LLD) */}
            {activeDocSection === "overview" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Architecture (LLD)</Badge>
                  <h3 className="text-2xl font-bold text-white font-mono">Low-Level System Design & Network Data Flow</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    DELTA combines a high-concurrency Go Gin backend, real-time WebSocket hub, Daytona SDK orchestrator, and reverse-proxy preview servers:
                  </p>
                </div>

                <MermaidDiagram
                  chart={lldDiagram}
                  id="doc-lld-flow"
                  title="DELTA Low-Level System Design (LLD), Micro-VM Proxy & Storage Pipeline"
                />

                <div className="space-y-3 text-xs text-gray-300">
                  <div className="p-3 rounded-lg border border-white/10 bg-black/40">
                    <strong className="text-emerald-400">WebSocket Dispatcher (`/ws`):</strong> Pushes stdout, stderr, thinking tokens, and tool invocations with sub-10ms latency.
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/40">
                    <strong className="text-cyan-400">Live Preview Reverse Proxy (`/api/preview/proxy/:id/:port/*`):</strong> Transparently routes HTTP/WebSocket traffic to sandbox dev servers on port 3000.
                  </div>
                </div>
              </div>
            )}

            {/* 3. Database Schema & RLS */}
            {activeDocSection === "database" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Data Layer</Badge>
                  <h3 className="text-2xl font-bold text-white font-mono">Supabase PostgreSQL Schema & RLS Policies</h3>
                  <p className="text-sm text-gray-300">
                    DELTA utilizes a dual-database model: Supabase Cloud PostgreSQL with Row-Level Security (RLS) as the primary cloud store, backed by an embedded SQLite database for zero-latency local caching.
                  </p>
                </div>

                <MermaidDiagram
                  chart={dbSchemaDiagram}
                  id="doc-db-schema"
                  title="DELTA Relational Entity Model with Supabase Auth & RLS"
                />

                {/* Table Schema Breakdown */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-lg border border-white/10 bg-black/50 space-y-1">
                    <span className="text-emerald-400 font-bold">1. public.profiles</span>
                    <p className="text-[11px] text-gray-400">`id (UUID, PK ref auth.users.id)`, `email (TEXT)`, `name (TEXT)`, `daytona_api_key (TEXT)`, `daytona_server_url (TEXT)`, `created_at (TIMESTAMPTZ)`</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/50 space-y-1">
                    <span className="text-cyan-400 font-bold">2. public.chat_messages</span>
                    <p className="text-[11px] text-gray-400">`id (BIGSERIAL, PK)`, `user_id (UUID, FK)`, `sandbox_id (TEXT)`, `sender (TEXT)`, `text (TEXT)`, `thoughts (JSONB)`, `tools (JSONB)`, `timestamp (BIGINT)`</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/50 space-y-1">
                    <span className="text-purple-400 font-bold">3. public.user_sandboxes</span>
                    <p className="text-[11px] text-gray-400">`id (UUID, PK)`, `user_id (UUID, FK)`, `daytona_sandbox_id (TEXT)`, `preview_url (TEXT)`, `active_port (INT)`, `last_active (TIMESTAMPTZ)`</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/50 space-y-1">
                    <span className="text-amber-400 font-bold">4. public.cloud_secrets</span>
                    <p className="text-[11px] text-gray-400">`id (UUID, PK)`, `user_id (UUID, FK)`, `provider (TEXT)`, `key_name (TEXT)`, `encrypted_value (TEXT)`, `updated_at (TIMESTAMPTZ)`</p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Quickstart Setup */}
            {activeDocSection === "quickstart" && (
              <div className="space-y-4">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Getting Started</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">3-Step First-Run Onboarding</h3>
                <p className="text-sm text-gray-300">Setting up your DELTA environment takes under 60 seconds:</p>
                <ol className="space-y-3 text-xs text-gray-300 list-decimal list-inside">
                  <li><strong>Enter Daytona API Key:</strong> Get your key from <code className="text-emerald-400">app.daytona.io</code>.</li>
                  <li><strong>Provide AI Model Credentials:</strong> Enter your Google AI Studio key or OpenAI API key.</li>
                  <li><strong>Configure Cloud Integrations:</strong> Add optional GitHub Token, Azure Service Principal, RunPod API Key, or Hugging Face token.</li>
                </ol>
                <div className="p-4 rounded-xl border border-white/10 bg-black/60 font-mono text-xs text-emerald-400">
                  // Credentials automatically saved to Daytona Secrets Manager and restored on all future runs!
                </div>
              </div>
            )}

            {/* 5. 4 Autonomous Agents */}
            {activeDocSection === "agents" && (
              <div className="space-y-4">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">Autonomous Swarm</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">The 4 Autonomous Agent Personas</h3>
                <p className="text-sm text-gray-300">
                  Each agent operates independently to guide you through complex software lifecycles:
                </p>
                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg border border-white/10 bg-black/30">
                    <span className="text-xs font-bold text-emerald-400">1. App Developer Agent:</span>
                    <p className="text-[11px] text-gray-300 mt-1">Gathers full product specifications, recommends modern stacks, and produces complete production code.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/30">
                    <span className="text-xs font-bold text-purple-400">2. LLM Deployer Agent:</span>
                    <p className="text-[11px] text-gray-300 mt-1">Interviews for latency and QPS requirements, chooses Azure vs RunPod Serverless, and returns live connection details.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/30">
                    <span className="text-xs font-bold text-blue-400">3. App Deployer Agent:</span>
                    <p className="text-[11px] text-gray-300 mt-1">Reads workspace files, produces production Dockerfiles, provisions Azure VMs, and deploys containers.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-white/10 bg-black/30">
                    <span className="text-xs font-bold text-cyan-400">4. App Maintainer Agent:</span>
                    <p className="text-[11px] text-gray-300 mt-1">Clones GitHub repos into persistent volumes, applies bugfixes/features on isolated branches, and submits PRs.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 6. CLI Switcher */}
            {activeDocSection === "cliswitcher" && (
              <div className="space-y-4">
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Runtime Engine</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">Runtime CLI Switcher (AGY & OpenCode)</h3>
                <p className="text-sm text-gray-300">
                  Both CLI engines run in the exact same persistent workspace folder (<code className="text-emerald-400">/home/daytona/persist/workspace</code>):
                </p>
                <MermaidDiagram
                  chart={cliSwitcherDiagram}
                  id="doc-cli-switcher"
                  title="Dual CLI Switcher Data Pipeline"
                />
                <ul className="space-y-2 text-xs text-gray-300">
                  <li>• Click the <strong>⚡ AGY</strong> or <strong>💻 OpenCode</strong> button in the Chat header.</li>
                  <li>• You can switch at any moment during development — all files and git histories remain intact.</li>
                  <li>• OpenCode automatically leverages the keys stored in your persistent <code className="text-gray-400">.env</code>.</li>
                </ul>
              </div>
            )}

            {/* 7. Secrets & Persistence */}
            {activeDocSection === "secrets" && (
              <div className="space-y-4">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Persistence & Security</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">Daytona Secrets & Volume Inactivity Watchdog</h3>
                <p className="text-sm text-gray-300">
                  How DELTA protects your credentials and minimizes cloud costs:
                </p>
                <MermaidDiagram
                  chart={watchdogDiagram}
                  id="doc-watchdog"
                  title="30-Minute Auto-Persist Watchdog Flow"
                />
                <ul className="space-y-2 text-xs text-gray-300">
                  <li>• <strong>Daytona Secrets API:</strong> Sensitive tokens are saved to Daytona Cloud Secrets Manager without plaintext exposure.</li>
                  <li>• <strong>Persistent Volumes:</strong> <code className="text-emerald-400">/home/daytona/persist</code> is attached to your micro-VM.</li>
                  <li>• <strong>30-Minute Auto-Teardown:</strong> Sandboxes inactive for &gt;30m automatically sync to persistent volume and delete the container.</li>
                </ul>
              </div>
            )}

            {/* 8. MCP Integrations */}
            {activeDocSection === "mcp" && (
              <div className="space-y-4">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Model Context Protocol</Badge>
                <h3 className="text-2xl font-bold text-white font-mono">MCP Integration Recipes</h3>
                <p className="text-sm text-gray-300">
                  Built-in recipes installed directly in your persistent Daytona sandbox volume:
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
                <h3 className="text-2xl font-bold text-white font-mono">REST & WebSocket API Endpoints</h3>
                <div className="space-y-2 font-mono text-xs text-gray-300">
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>POST /api/auth/register</code> - SaaS User Signup</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>POST /api/auth/login</code> - SaaS User Login</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>POST /api/workspace/prompt</code> - Dispatch Agent Prompt</div>
                  <div className="p-2 rounded bg-black/50 border border-white/10"><code>GET  /ws</code> - Real-time Execution & Telemetry Stream</div>
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
          <a href="#docs" className="hover:text-white transition-colors">Docs & Diagrams</a>
          <a href="https://app.daytona.io" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Daytona Cloud</a>
          <a href="https://supabase.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Supabase</a>
          <button onClick={onResetApp} className="hover:text-red-400 transition-colors cursor-pointer">Reset Data</button>
        </div>
      </footer>
    </div>
  );
};
