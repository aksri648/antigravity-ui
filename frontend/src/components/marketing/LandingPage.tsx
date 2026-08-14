import React, { useState } from "react";
import {
  Sparkles,
  Cpu,
  ArrowRight,
  Zap,
  Code,
  Terminal,
  Globe,
  Layers,
  CheckCircle2,
  LogIn,
  Server,
  Lock,
  Box,
  Database,
  ChevronRight,
  BookOpen,
  Radio,
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
type DocSection = "overview" | "quickstart" | "agents" | "cliswitcher" | "secrets" | "mcp" | "api";

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartSetup,
  onLaunchWorkspace,
  onOpenAuth,
  onResetApp,
}) => {
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseTab>("ide");
  const [activeDocSection, setActiveDocSection] = useState<DocSection>("overview");

  return (
    <div className="min-h-screen w-full bg-[#0c0c0e] text-[#f4f4f6] flex flex-col overflow-y-auto selection:bg-emerald-500 selection:text-black">
      {/* Top Banner Notice */}
      <div className="w-full bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 border-b border-white/10 py-2.5 px-4 text-center text-xs font-medium text-gray-300">
        <span className="inline-flex items-center gap-2">
          <Badge className="bg-emerald-500 text-black font-bold text-[10px] px-2 py-0.5 rounded-full">NEW</Badge>
          <span>Multi-Agent Swarm with Pluggable CLI Drivers (Antigravity & OpenCode) and Daytona Secrets</span>
          <a href="#docs" className="text-emerald-400 font-semibold underline hover:text-emerald-300 ml-1">
            Read Docs →
          </a>
        </span>
      </div>

      {/* Floating Glass Navigation Header Container with generous top gap and padding */}
      <div className="sticky top-0 z-50 pt-5 pb-2 px-4 sm:px-8 w-full max-w-7xl mx-auto pointer-events-none">
        <header className="pointer-events-auto mx-auto w-full rounded-full border border-white/15 bg-[#16161a]/90 backdrop-blur-2xl px-6 sm:px-8 h-20 flex items-center justify-between shadow-2xl shadow-black/60 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-black shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white font-mono">DELTA</span>
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0.5 px-2.5 border-emerald-500/40 text-emerald-400 font-mono">
                v2.4 Production
              </Badge>
            </div>
          </div>

          {/* Center Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-gray-300">
            <a href="#showcase" className="hover:text-white transition-colors">Showcase</a>
            <a href="#manifesto" className="hover:text-white transition-colors">Manifesto</a>
            <a href="#features" className="hover:text-white transition-colors">Architecture</a>
            <a href="#docs" className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 font-bold">
              <BookOpen className="h-4 w-4" /> Documentation
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
          <span className="font-mono text-xs tracking-wider uppercase text-emerald-400 font-semibold px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10">
            Autonomous Multi-Agent Cloud Platform
          </span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl leading-[1.08] text-balance">
          Know your code.<br />
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            So your agents can build anything.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-gray-400 max-w-3xl leading-relaxed">
          The next-generation Agentic Development Environment powered by isolated <strong>Daytona micro-VM sandboxes</strong>, persistent long-term storage volumes, zero-cost Google AI Quota, and 4 specialized autonomous agents.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <Button
            size="lg"
            onClick={onStartSetup}
            className="h-12 px-8 text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-full shadow-lg shadow-emerald-500/25 transition-all gap-2"
          >
            Start Setup Wizard <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={onLaunchWorkspace}
            className="h-12 px-8 text-sm border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-full backdrop-blur-md gap-2"
          >
            <Sparkles className="h-4 w-4 text-emerald-400" /> Open Web IDE
          </Button>

          <a
            href="#docs"
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white px-4 py-2"
          >
            <BookOpen className="h-4 w-4" /> Explore System Docs →
          </a>
        </div>

        {/* Hero Image Showcase Card */}
        <div className="relative mt-14 w-full max-w-6xl rounded-2xl border border-white/15 bg-black/60 p-2 shadow-2xl overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0e] via-transparent to-transparent z-10 pointer-events-none" />
          <img
            src="/images/hero_cloud_ide.jpg"
            alt="AGY Cloud Autonomous IDE with Monaco editor, Daytona micro-VM terminal, and Live Web Preview"
            className="w-full h-auto rounded-xl object-cover border border-white/10 shadow-inner"
          />
        </div>
      </section>

      {/* SHOWCASE TABBED SECTION */}
      <section id="showcase" className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="font-mono text-xs uppercase text-emerald-400 font-semibold tracking-wider">// INTERACTIVE CAPABILITIES</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">Engineered for Autonomous Execution</h2>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-full">
            {[
              { id: "ide", label: "Split IDE & Preview", icon: Code },
              { id: "agents", label: "4 Specialized Agents", icon: Cpu },
              { id: "opencode", label: "Dual CLI Switcher", icon: Terminal },
              { id: "preview", label: "Daytona Volume Sync", icon: Database },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeShowcase === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveShowcase(tab.id as ShowcaseTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-black shadow-md font-bold"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-[#141418] p-6 space-y-4">
            {activeShowcase === "ide" && (
              <div className="space-y-3">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 font-mono">30 / 70 Responsive Split View</Badge>
                <h3 className="text-2xl font-bold text-white">Full-Stack Cloud Development with Zero Context Loss</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Interact with autonomous coding agents on the left pane while viewing real-time Monaco file trees, live multi-port web previews (ports 3000, 5173, 8080), and full X11/VNC graphical desktops on the right.
                </p>
                <div className="rounded-xl border border-white/10 overflow-hidden mt-4">
                  <img src="/images/hero_cloud_ide.jpg" alt="IDE Preview" className="w-full h-auto object-cover" />
                </div>
              </div>
            )}

            {activeShowcase === "agents" && (
              <div className="space-y-3">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 font-mono">OpenAI Agents SDK Architecture</Badge>
                <h3 className="text-2xl font-bold text-white">Decoupled Reasoning with Human-In-The-Loop Approvals</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Four specialized agents interview you for requirements, draft structural blueprints, ask for approval before critical modifications, and generate comprehensive post-deployment connection snippets.
                </p>
                <div className="rounded-xl border border-white/10 overflow-hidden mt-4">
                  <img src="/images/multi_agent_flow.jpg" alt="Agent Swarm Flow" className="w-full h-auto object-cover" />
                </div>
              </div>
            )}

            {activeShowcase === "opencode" && (
              <div className="space-y-3">
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 font-mono">Pluggable Coding CLI Drivers</Badge>
                <h3 className="text-2xl font-bold text-white">Switch Between AGY and OpenCode in the Same Workspace</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Toggle your underlying AI CLI execution runner with 1 click. Both engines operate inside the shared persistent directory (<code className="text-cyan-300 font-mono">/home/daytona/persist/workspace</code>), preserving every commit and edit seamlessly.
                </p>
                <div className="p-4 rounded-xl border border-white/10 bg-black/60 font-mono text-xs text-gray-300 space-y-2">
                  <div className="text-emerald-400">$ opencode run "Add Stripe checkout webhook handler"</div>
                  <div className="text-gray-400">[OpenCode] Analyzing workspace dependencies in /home/daytona/persist/workspace...</div>
                  <div className="text-cyan-400">[AGY Driver] Code modified in place. Dev server hot reloaded on port 5173.</div>
                </div>
              </div>
            )}

            {activeShowcase === "preview" && (
              <div className="space-y-3">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-mono">Encrypted Persistent Storage</Badge>
                <h3 className="text-2xl font-bold text-white">30-Minute Inactivity Auto-Save & Cost Protection</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Your codebase is continuously mirrored from the micro-VM sandbox to long-term persistent Daytona volumes. Inactive sandboxes pause and tear down after 30 minutes, restoring instantaneously on your next prompt.
                </p>
                <div className="p-4 rounded-xl border border-white/10 bg-black/60 font-mono text-xs text-emerald-400 space-y-1">
                  <div>✓ Volume: vol-user-892f3a mounted to /home/daytona/persist</div>
                  <div>✓ Inactivity Watchdog: 30m countdown active</div>
                  <div>✓ Daytona Secrets: API keys restored from cloud manager</div>
                </div>
              </div>
            )}
          </div>

          {/* Right Highlights Column */}
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-white/10 bg-[#141418] p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-bold text-white">$0 AI Quota Cost</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Connect your existing Google Account to execute unlimited high-speed Antigravity prompts with zero additional API subscription fees.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#141418] p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Lock className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-bold text-white">Daytona Cloud Secrets</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Configure your GitHub, Azure, RunPod, and Hugging Face tokens once. They are encrypted in Daytona Secrets Manager and restored forever.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#141418] p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                <Globe className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-bold text-white">Multi-Port Live Proxy</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Automatic port discovery with signed iframe URLs and built-in reverse proxy routing for instant, CORS-free web app previewing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MANIFESTO / EDITORIAL SECTION (SPOTIFY XIRP STYLE) */}
      <section id="manifesto" className="px-6 py-28 max-w-4xl mx-auto w-full">
        <div className="space-y-12 text-xl sm:text-3xl font-bold leading-snug text-gray-300">
          <p>
            AI coding tools solved the <span className="text-white">generation problem</span>. Code gets written faster, boilerplate disappears, and lines of code explode.
          </p>
          <p className="text-gray-500">
            But something else happened. AI agents made confident decisions inside ephemeral containers that lacked persistent memory, real cloud tools, or live verification.
          </p>
          <p>
            <span className="text-emerald-400">DELTA is different.</span> It is an autonomous development platform that connects your agents to real micro-VM sandboxes, persistent volumes, multi-model CLIs, and cloud deployment pipelines.
          </p>
          <p className="text-white text-2xl sm:text-4xl font-extrabold leading-tight">
            Your agents don't guess in the dark. They build, verify, deploy, and maintain.
          </p>
        </div>
      </section>

      {/* 4 SPECIALIZED AGENTS DEEP DIVE */}
      <section id="features" className="px-6 py-20 max-w-7xl mx-auto w-full space-y-24">
        {/* Agent 1 */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-4">
            <span className="font-mono text-xs uppercase text-blue-400 font-semibold tracking-wider">// AGENT 01: APP DEVELOPER</span>
            <h3 className="text-3xl sm:text-4xl font-black text-white">Full-Stack Scaffolding & Requirements Interview</h3>
            <p className="text-base text-gray-400 leading-relaxed">
              Takes your high-level product idea, asks structured follow-up questions to nail down technical choices, drafts an architectural blueprint, and scaffolds complete full-stack web applications with hot-reloading dev servers.
            </p>
            <ul className="space-y-2 text-sm text-gray-300 pt-2">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-400" /> Interactive requirements clarifying interview</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-400" /> Vite, React 19, Tailwind CSS, Go Gin, and FastAPI recipes</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-400" /> Automatic dev server startup & live preview routing</li>
            </ul>
          </div>
          <div className="flex-1 rounded-3xl border border-white/10 bg-[#141418] p-4 overflow-hidden">
            <img src="/images/hero_cloud_ide.jpg" alt="App Developer Agent" className="rounded-2xl w-full h-auto object-cover" />
          </div>
        </div>

        {/* Agent 2 */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
          <div className="flex-1 space-y-4">
            <span className="font-mono text-xs uppercase text-purple-400 font-semibold tracking-wider">// AGENT 02: LLM DEPLOYER</span>
            <h3 className="text-3xl sm:text-4xl font-black text-white">Intelligent Cloud GPU & Serverless LLM Deployment</h3>
            <p className="text-base text-gray-400 leading-relaxed">
              Analyzes your model traffic characteristics (bursty vs steady enterprise vs dev) to deploy open-source models (vLLM, Ollama, TGI) across Azure AI Studio or RunPod Serverless, outputting client connection code snippets.
            </p>
            <ul className="space-y-2 text-sm text-gray-300 pt-2">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Burst traffic → RunPod Serverless vLLM ($0 idle scale-to-zero)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Steady traffic → Azure Managed Online Endpoint & AKS</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400" /> Generates ready-to-use Python and TypeScript SDK connection snippets</li>
            </ul>
          </div>
          <div className="flex-1 rounded-3xl border border-white/10 bg-[#141418] p-4 overflow-hidden">
            <img src="/images/multi_agent_flow.jpg" alt="LLM Deployer Agent" className="rounded-2xl w-full h-auto object-cover" />
          </div>
        </div>

        {/* Agent 3 */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-4">
            <span className="font-mono text-xs uppercase text-emerald-400 font-semibold tracking-wider">// AGENT 03: APP DEPLOYER</span>
            <h3 className="text-3xl sm:text-4xl font-black text-white">Automated Dockerization & Azure Cloud Deployment</h3>
            <p className="text-base text-gray-400 leading-relaxed">
              Inspects your project code, generates multi-stage production Dockerfiles with non-root security standards, provisions Azure Linux VMs or Azure Container Apps, and configures TLS domain certificates.
            </p>
            <ul className="space-y-2 text-sm text-gray-300 pt-2">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Minimal multi-stage Docker build files</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Azure CLI (`az vm`, `az containerapp`) automation</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Production healthchecks and live verification testing</li>
            </ul>
          </div>
          <div className="flex-1 rounded-3xl border border-white/10 bg-[#141418] p-4 overflow-hidden">
            <img src="/images/hero_cloud_ide.jpg" alt="App Deployer Agent" className="rounded-2xl w-full h-auto object-cover" />
          </div>
        </div>

        {/* Agent 4 */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
          <div className="flex-1 space-y-4">
            <span className="font-mono text-xs uppercase text-amber-400 font-semibold tracking-wider">// AGENT 04: APP MAINTAINER</span>
            <h3 className="text-3xl sm:text-4xl font-black text-white">Git Repository Ingestion & Automated Pull Requests</h3>
            <p className="text-base text-gray-400 leading-relaxed">
              Clones any GitHub repository URL into the sandbox, creates an isolated feature/fix branch, executes modifications based on your prompt, runs test suites, and opens an automated GitHub Pull Request with structured diff summaries.
            </p>
            <ul className="space-y-2 text-sm text-gray-300 pt-2">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> 1-click GitHub repository cloning & setup</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> Human-in-the-loop branch diff review gate</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> GitHub MCP & `gh pr create` automation</li>
            </ul>
          </div>
          <div className="flex-1 rounded-3xl border border-white/10 bg-[#141418] p-4 overflow-hidden">
            <img src="/images/multi_agent_flow.jpg" alt="App Maintainer Agent" className="rounded-2xl w-full h-auto object-cover" />
          </div>
        </div>
      </section>

      {/* COMPREHENSIVE DOCUMENTATION SECTION */}
      <section id="docs" className="px-6 py-24 max-w-7xl mx-auto w-full border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="font-mono text-xs uppercase text-emerald-400 font-semibold tracking-wider">// DEVELOPER DOCUMENTATION & SPECIFICATION</span>
          <h2 className="text-3xl sm:text-5xl font-black text-white">Everything You Need to Build & Scale</h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Comprehensive architectural specs, quickstart guides, CLI driver references, and API endpoint documentation.
          </p>
        </div>

        {/* Documentation Interactive Split */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Docs Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-1">
            {[
              { id: "overview", label: "Architecture Overview", icon: Layers },
              { id: "quickstart", label: "Quickstart Setup", icon: Zap },
              { id: "agents", label: "4 Autonomous Agents", icon: Cpu },
              { id: "cliswitcher", label: "CLI Switcher (AGY / OpenCode)", icon: Terminal },
              { id: "secrets", label: "Daytona Secrets & Volumes", icon: Database },
              { id: "mcp", label: "MCP Server Integrations", icon: Box },
              { id: "api", label: "REST & WebSocket API", icon: Radio },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activeDocSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveDocSection(item.id as DocSection)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all text-left ${
                    isSelected
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm"
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
            {activeDocSection === "overview" && (
              <div className="space-y-4">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">System Architecture</Badge>
                <h3 className="text-2xl font-bold text-white">Decoupled Agentic Micro-VM Architecture</h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  DELTA uses a three-tier decoupled architecture:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-purple-400" /> Tier 1: Agent Layer</h5>
                    <p className="text-[11px] text-gray-400">OpenAI Agents SDK logic for requirements interview, reasoning, traffic analysis, and HITL approvals.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5 text-cyan-400" /> Tier 2: CLI Drivers</h5>
                    <p className="text-[11px] text-gray-400">Pluggable coding drivers for Antigravity (`agy`) and OpenCode (`opencode`) operating on shared workspace.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-emerald-400" /> Tier 3: Daytona Micro-VM</h5>
                    <p className="text-[11px] text-gray-400">Isolated Linux micro-VM container with persistent volume symlinks, port routing, and Daytona Secrets.</p>
                  </div>
                </div>
              </div>
            )}

            {activeDocSection === "quickstart" && (
              <div className="space-y-4">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Getting Started</Badge>
                <h3 className="text-2xl font-bold text-white">3-Step First-Run Onboarding</h3>
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

            {activeDocSection === "agents" && (
              <div className="space-y-4">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">Autonomous Swarm</Badge>
                <h3 className="text-2xl font-bold text-white">The 4 Autonomous Agent Personas</h3>
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

            {activeDocSection === "cliswitcher" && (
              <div className="space-y-4">
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Runtime Engine</Badge>
                <h3 className="text-2xl font-bold text-white">Runtime CLI Switcher (AGY & OpenCode)</h3>
                <p className="text-sm text-gray-300">
                  Both CLI engines run in the exact same persistent workspace folder (<code className="text-emerald-400">/home/daytona/persist/workspace</code>):
                </p>
                <ul className="space-y-2 text-xs text-gray-300">
                  <li>• Click the <strong>⚡ AGY</strong> or <strong>💻 OpenCode</strong> button in the Chat header.</li>
                  <li>• You can switch at any moment during development — all files and git histories remain intact.</li>
                  <li>• OpenCode automatically leverages the keys stored in your persistent <code className="text-gray-400">.env</code>.</li>
                </ul>
              </div>
            )}

            {activeDocSection === "secrets" && (
              <div className="space-y-4">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Persistence & Security</Badge>
                <h3 className="text-2xl font-bold text-white">Daytona Secrets & Volume Inactivity Watchdog</h3>
                <p className="text-sm text-gray-300">
                  How DELTA protects your credentials and minimizes cloud costs:
                </p>
                <ul className="space-y-2 text-xs text-gray-300">
                  <li>• <strong>Daytona Secrets API:</strong> Sensitive tokens are saved to Daytona Cloud Secrets Manager without plaintext exposure.</li>
                  <li>• <strong>Persistent Volumes:</strong> <code className="text-emerald-400">/home/daytona/persist</code> is attached to your micro-VM.</li>
                  <li>• <strong>30-Minute Auto-Teardown:</strong> Sandboxes inactive for &gt;30m automatically sync to persistent volume and delete the container.</li>
                </ul>
              </div>
            )}

            {activeDocSection === "mcp" && (
              <div className="space-y-4">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Model Context Protocol</Badge>
                <h3 className="text-2xl font-bold text-white">MCP Integration Recipes</h3>
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

            {activeDocSection === "api" && (
              <div className="space-y-4">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Developer API</Badge>
                <h3 className="text-2xl font-bold text-white">REST & WebSocket API Endpoints</h3>
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

      {/* FINAL HIGH-IMPACT SPOTIFY-STYLE CTA BANNER */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="relative rounded-3xl bg-[#1ed760] text-black p-10 sm:p-16 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden shadow-2xl">
          <div className="space-y-3 text-center md:text-left z-10 max-w-xl">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-black font-mono">
              Ready to code at lightning speed?
            </h2>
            <p className="text-black/80 font-medium text-sm sm:text-base">
              Start with one project. See what your agents can build when they have real context, persistent volumes, and cloud sandboxes.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 z-10 w-full md:w-auto">
            <Button
              size="lg"
              onClick={onStartSetup}
              className="h-12 px-8 text-sm bg-black hover:bg-zinc-900 text-white font-extrabold rounded-full shadow-xl"
            >
              Start 3-Step Setup
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onLaunchWorkspace}
              className="h-12 px-8 text-sm border-2 border-black bg-transparent text-black hover:bg-black/10 font-extrabold rounded-full"
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
          <span>DELTA • Autonomous Cloud IDE & Swarm • Built with Daytona Micro-VMs</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#docs" className="hover:text-white transition-colors">Docs</a>
          <a href="https://app.daytona.io" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Daytona Cloud</a>
          <a href="https://github.com/aksri648/antigravity-ui" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          <button onClick={onResetApp} className="hover:text-red-400 transition-colors">Reset Data</button>
        </div>
      </footer>
    </div>
  );
};
