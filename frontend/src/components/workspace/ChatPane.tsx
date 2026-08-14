import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Bot,
  Brain,
  Wrench,
  Sparkles,
  Trash2,
  Loader2,
  Square,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FolderGit2,
  Activity,
  Zap,
  Plus,
  PanelRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { MarkdownMessageCard } from "./MarkdownMessageCard";

export type AgentMode = "app-developer" | "llm-deployer" | "app-deployer" | "app-maintainer";

export type ChatMessage = {
  id: string;
  sender: "user" | "agy";
  text: string;
  thoughts?: string[];
  tools?: { name: string; path?: string; status?: "running" | "done" }[];
  isError?: boolean;
  timestamp: number;
  agentMode?: AgentMode;
  isApprovalRequired?: boolean;
  approvalData?: {
    title: string;
    summary: string;
    costEstimate?: string;
    targetPlatform?: string;
  };
  questions?: string[];
};

export type CliEngine = "agy" | "opencode";

interface ChatPaneProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string, agentMode?: AgentMode, repoUrl?: string, approvalAction?: "approve" | "reject" | "amend", cliEngine?: CliEngine) => void;
  isProcessing: boolean;
  onClearChat: () => void;
  onStopGenerating?: () => void;
  currentAgentMode?: AgentMode;
  onAgentModeChange?: (mode: AgentMode) => void;
  cliEngine?: CliEngine;
  onCliEngineChange?: (engine: CliEngine) => void;
  activeConversationTitle?: string;
  activeProjectName?: string;
  onNewChat?: () => void;
  isRightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
  onOpenPreviewOnly?: () => void;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  messages,
  onSendMessage,
  isProcessing,
  onClearChat,
  onStopGenerating,
  currentAgentMode = "app-developer",
  onAgentModeChange,
  cliEngine = "agy",
  onCliEngineChange,
  activeConversationTitle,
  activeProjectName,
  onNewChat,
  isRightPanelOpen = true,
  onToggleRightPanel,
  onOpenPreviewOnly,
}) => {
  const [input, setInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<AgentMode>(currentAgentMode);
  const [selectedEngine, setSelectedEngine] = useState<CliEngine>(cliEngine);
  const [repoUrl, setRepoUrl] = useState("");
  const [trafficProfile, setTrafficProfile] = useState<string>("sporadic");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSelectedMode(currentAgentMode);
  }, [currentAgentMode]);

  useEffect(() => {
    setSelectedEngine(cliEngine);
  }, [cliEngine]);

  const handleModeSelect = (mode: AgentMode) => {
    setSelectedMode(mode);
    if (onAgentModeChange) onAgentModeChange(mode);
  };

  const handleEngineToggle = (engine: CliEngine) => {
    setSelectedEngine(engine);
    if (onCliEngineChange) onCliEngineChange(engine);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isProcessing) return;

    let fullPrompt = input.trim();
    if (selectedMode === "llm-deployer" && trafficProfile) {
      fullPrompt = `[Traffic Profile: ${trafficProfile.toUpperCase()}] ${fullPrompt}`;
    }

    onSendMessage(fullPrompt, selectedMode, repoUrl.trim(), undefined, selectedEngine);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleApproval = (action: "approve" | "reject" | "amend", customNote?: string) => {
    const prompt = customNote ? `${action.toUpperCase()}: ${customNote}` : `${action.toUpperCase()} action.`;
    onSendMessage(prompt, selectedMode, repoUrl.trim(), action, selectedEngine);
  };

  return (
    <div className="flex h-full flex-col bg-[#0e0e11] border-r border-white/10">
      {/* Top Header with Conversation Title & Controls */}
      <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between bg-[#141418] gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-[280px]" title={activeConversationTitle || "New Chat"}>
              {activeConversationTitle || "New Chat"}
            </span>
            {activeProjectName && (
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0 px-2 border-white/15 bg-white/5 text-gray-300 font-mono truncate max-w-[140px]">
                {activeProjectName}
              </Badge>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onNewChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNewChat}
              className="h-7 text-xs px-2.5 border-white/15 bg-white/5 hover:bg-white/10 text-gray-200 cursor-pointer hidden md:flex items-center gap-1.5 rounded-lg"
              title="Start a new chat thread"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" /> New Chat
            </Button>
          )}

          <div className="flex items-center bg-black/60 border border-white/15 rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleEngineToggle("agy")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                selectedEngine === "agy"
                  ? "bg-emerald-500 text-black font-extrabold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Execute using Antigravity CLI (agy) inside ~/workspace"
            >
              ⚡ AGY
            </button>
            <button
              type="button"
              onClick={() => handleEngineToggle("opencode")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                selectedEngine === "opencode"
                  ? "bg-cyan-500 text-black font-extrabold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Execute using OpenCode CLI inside ~/workspace"
            >
              💻 OpenCode
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white rounded-lg"
            onClick={onClearChat}
            title="Clear chat thread"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {!isRightPanelOpen && (onOpenPreviewOnly || onToggleRightPanel) && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenPreviewOnly || onToggleRightPanel}
              className="h-7 text-xs px-2.5 border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 cursor-pointer flex items-center gap-1.5 shadow-sm font-medium rounded-lg"
              title="Open Live Preview tab in right panel"
            >
              <PanelRight className="h-3.5 w-3.5 text-purple-400" />
              <span>Preview</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mode-Specific Context Fields */}
      {selectedMode === "app-maintainer" && (
        <div className="px-4 py-2 border-b border-white/10 bg-[#121216] flex items-center gap-2 shrink-0">
          <FolderGit2 className="h-4 w-4 text-amber-400 shrink-0" />
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="GitHub Repo URL (e.g. https://github.com/owner/repo)..."
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/60 font-mono"
          />
        </div>
      )}

      {selectedMode === "llm-deployer" && (
        <div className="px-4 py-2 border-b border-white/10 bg-[#121216] flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <Activity className="h-4 w-4 text-purple-400 shrink-0" />
          <span className="text-gray-400 shrink-0 text-[11px] uppercase font-semibold">Traffic Profile:</span>
          {[
            { id: "sporadic", label: "⚡ Serverless vLLM (Scale-to-Zero)", desc: "Lowest idle cost" },
            { id: "steady", label: "🏢 Dedicated GPU (Azure AKS / RunPod)", desc: "High throughput" },
            { id: "dev", label: "🧪 Spot GPU (Lowest Cost Dev)", desc: "Spot Pod" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTrafficProfile(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors shrink-0 ${
                trafficProfile === t.id
                  ? "bg-purple-900/50 border-purple-400 text-purple-200 font-semibold shadow-sm"
                  : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Claude-Style Spacious Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 scrollbar-thin">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {messages.length === 0 ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6 sm:p-10 text-gray-400 space-y-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-300 border border-purple-500/25 shadow-xl shadow-purple-950/30">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {selectedMode === "app-developer" && "Full-Stack App Developer"}
                  {selectedMode === "llm-deployer" && "Autonomous LLM Deployer"}
                  {selectedMode === "app-deployer" && "Production App Deployer"}
                  {selectedMode === "app-maintainer" && "Git App Maintainer"}
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {selectedMode === "app-developer" && "Ask questions, build modern web applications, generate full blueprinted code, and preview instantly in Daytona."}
                  {selectedMode === "llm-deployer" && "Size hardware, benchmark vLLM performance, and deploy open-source models onto RunPod or Azure."}
                  {selectedMode === "app-deployer" && "Containerize applications with multi-stage Docker builds and deploy to Azure VMs or Container Apps."}
                  {selectedMode === "app-maintainer" && "Audit repositories, resolve issues, write comprehensive tests, and open GitHub Pull Requests."}
                </p>
              </div>

              {/* Suggested Starters */}
              <div className="w-full max-w-lg grid grid-cols-1 gap-2 pt-2 text-left">
                <p className="text-[11px] uppercase font-bold tracking-wider text-gray-500 px-1 font-mono">Suggested Prompts:</p>
                {(selectedMode === "app-developer"
                  ? [
                      "Build a full-stack real-time analytics dashboard with React, Tailwind & Vite",
                      "Create a collaborative whiteboard canvas with drag-and-drop sticky notes",
                      "Build a complete Go REST API with Gin, SQLite and JWT authentication",
                    ]
                  : selectedMode === "llm-deployer"
                  ? [
                      "Deploy DeepSeek-R1-Distill-Qwen-14B on RunPod Serverless with vLLM",
                      "Deploy Llama-3.1-8B-Instruct with FP8 quantization for minimal latency",
                      "Provision an OpenAI-compatible GPU server for autonomous agent swarms",
                    ]
                  : selectedMode === "app-deployer"
                  ? [
                      "Dockerize this application with multi-stage builds and healthchecks",
                      "Deploy production Docker container to Azure Container App",
                      "Configure production Nginx reverse proxy with SSL certificate",
                    ]
                  : [
                      "Audit the repository for edge cases and open a Pull Request",
                      "Refactor database queries and add integration test suite",
                      "Implement dark mode with Tailwind CSS tokens and themes",
                    ]
                ).map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(s);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }}
                    className="w-full text-left text-xs bg-[#16161c] hover:bg-[#1f1f26] border border-white/10 hover:border-white/20 rounded-xl p-3 transition-all text-gray-300 hover:text-white shadow-sm cursor-pointer group"
                  >
                    <span className="text-purple-400 mr-2 group-hover:scale-110 inline-block transition-transform">✦</span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="w-full space-y-3">
                {/* AGY Thoughts Card */}
                {msg.thoughts && msg.thoughts.length > 0 && (
                  <div className="w-full rounded-2xl border border-purple-500/25 bg-purple-950/20 p-4 space-y-2 text-xs text-purple-200 shadow-md">
                    <div className="flex items-center gap-2 font-semibold text-xs text-purple-300">
                      <Brain className="h-4 w-4" /> AGY Reasoning & Step Execution
                    </div>
                    <div className="space-y-1 font-mono text-[12px] text-purple-200/80 leading-relaxed">
                      {msg.thoughts.map((thought, i) => (
                        <p key={i}>💭 {thought}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executed Tools Chips */}
                {msg.tools && msg.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 my-1.5">
                    {msg.tools.map((tool, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="gap-1.5 text-[11px] bg-black/60 border-emerald-500/30 text-emerald-400 font-mono py-1 px-2.5 rounded-lg"
                      >
                        <Wrench className="h-3 w-3" /> {tool.name} {tool.path ? `(${tool.path})` : ""}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Human Approval Gate Card */}
                {msg.isApprovalRequired && msg.approvalData && (
                  <div className="w-full my-3 rounded-2xl border border-amber-500/40 bg-amber-950/25 p-4 text-xs space-y-3 shadow-lg">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <Zap className="h-4 w-4" />
                      <span>Human Approval Required: {msg.approvalData.title}</span>
                    </div>
                    <p className="text-amber-200/90 leading-relaxed font-mono text-xs bg-black/50 p-3 rounded-xl border border-amber-500/20">
                      {msg.approvalData.summary}
                    </p>
                    {msg.approvalData.costEstimate && (
                      <div className="flex items-center justify-between text-xs text-amber-300 font-mono">
                        <span>Estimated Cost:</span>
                        <span className="font-bold">{msg.approvalData.costEstimate}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => handleApproval("approve")}
                        className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white h-8 px-3.5 rounded-lg font-medium"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Execute
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApproval("reject")}
                        className="gap-1.5 text-xs text-red-400 hover:bg-red-950/40 border border-red-500/30 h-8 px-3.5 rounded-lg font-medium"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {/* Error or Markdown Message Card */}
                {msg.isError ? (
                  <div className="rounded-2xl px-5 py-4 text-sm leading-relaxed w-full whitespace-pre-wrap font-mono bg-red-950/40 border border-red-500/40 text-red-300 shadow-md">
                    <div className="flex items-center gap-2 mb-2 text-red-400 font-semibold">
                      <AlertCircle className="h-4 w-4" /> Error Occurred
                    </div>
                    {msg.text}
                  </div>
                ) : (
                  <MarkdownMessageCard message={msg} isProcessing={isProcessing} />
                )}
              </div>
            ))
          )}

          {isProcessing && (
            <div className="flex items-center justify-between text-xs text-purple-300 bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 shadow-md">
              <div className="flex items-center gap-2.5 animate-pulse font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                <span>
                  {selectedMode === "app-developer" && "App Developer building inside Daytona sandbox..."}
                  {selectedMode === "llm-deployer" && "LLM Deployer provisioning serverless GPU..."}
                  {selectedMode === "app-deployer" && "App Deployer containerizing & deploying to Azure..."}
                  {selectedMode === "app-maintainer" && "App Maintainer working on GitHub branch..."}
                </span>
              </div>
              {onStopGenerating && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onStopGenerating}
                  className="h-7 gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-500/30 rounded-lg"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </Button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Claude Web UI Floating Input Container */}
      <div className="p-4 pt-1 pb-4 bg-gradient-to-t from-[#0e0e11] via-[#0e0e11] to-transparent shrink-0">
        <div className="max-w-4xl mx-auto w-full">
          <form
            onSubmit={handleSubmit}
            className="relative rounded-2xl sm:rounded-[24px] border border-white/15 bg-[#191920] focus-within:border-white/30 focus-within:ring-1 focus-within:ring-white/20 shadow-2xl shadow-black/60 p-3 sm:p-4 transition-all"
          >
            {/* Auto-Expanding Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 260)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedMode === "app-developer"
                  ? "Describe what you want to build or prompt your agent..."
                  : selectedMode === "llm-deployer"
                  ? "Specify model ID (e.g. meta-llama/Llama-3.1-8B-Instruct) & deployment requirements..."
                  : selectedMode === "app-deployer"
                  ? "Instructions for Dockerizing and deploying to Azure..."
                  : "Describe changes or code fixes for target repository..."
              }
              rows={2}
              className="w-full bg-transparent border-0 resize-none text-[15px] sm:text-base text-gray-100 placeholder:text-gray-500 focus:outline-none min-h-[64px] max-h-[260px] leading-relaxed scrollbar-thin selection:bg-purple-500/40 font-sans"
              disabled={isProcessing}
            />

            {/* Bottom Action Row inside Input Card */}
            <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-white/5 gap-2">
              {/* Left Controls: Agent Mode Pill */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 hover:border-white/20 rounded-xl px-2.5 py-1 text-xs transition-colors">
                  <span className="text-[11px] text-gray-400 font-medium">Agent:</span>
                  <select
                    value={selectedMode}
                    onChange={(e) => handleModeSelect(e.target.value as AgentMode)}
                    className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="app-developer" className="bg-[#18181f] text-white">⚡ App Developer</option>
                    <option value="llm-deployer" className="bg-[#18181f] text-white">🧠 LLM Deployer</option>
                    <option value="app-deployer" className="bg-[#18181f] text-white">🚀 App Deployer</option>
                    <option value="app-maintainer" className="bg-[#18181f] text-white">🛠️ App Maintainer</option>
                  </select>
                </div>
              </div>

              {/* Right Send / Stop Circle Button (Exact Claude shape & interaction) */}
              <div className="flex items-center gap-2 shrink-0">
                {isProcessing ? (
                  <button
                    type="button"
                    onClick={onStopGenerating}
                    className="h-8 w-8 rounded-full bg-white text-black hover:bg-gray-200 flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
                    title="Stop generating"
                  >
                    <Square className="h-3.5 w-3.5 fill-black" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className={`h-8 w-8 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer ${
                      input.trim()
                        ? "bg-white text-black hover:bg-gray-200"
                        : "bg-white/10 text-gray-500 cursor-not-allowed opacity-40"
                    }`}
                    title="Send message (Enter)"
                  >
                    <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Footnote */}
          <div className="text-center pt-2">
            <span className="text-[11px] text-gray-500 font-sans">
              Press <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 font-mono text-[10px]">Shift + Enter</kbd> for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

