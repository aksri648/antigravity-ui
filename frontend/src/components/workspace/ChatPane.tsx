import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  Brain,
  Wrench,
  Sparkles,
  Trash2,
  Loader2,
  Code2,
  Square,
  AlertCircle,
  Cpu,
  Server,
  GitPullRequest,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    let fullPrompt = input.trim();
    if (selectedMode === "llm-deployer" && trafficProfile) {
      fullPrompt = `[Traffic Profile: ${trafficProfile.toUpperCase()}] ${fullPrompt}`;
    }

    onSendMessage(fullPrompt, selectedMode, repoUrl.trim(), undefined, selectedEngine);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  const handleApproval = (action: "approve" | "reject" | "amend", customNote?: string) => {
    const prompt = customNote ? `${action.toUpperCase()}: ${customNote}` : `${action.toUpperCase()} action.`;
    onSendMessage(prompt, selectedMode, repoUrl.trim(), action, selectedEngine);
  };

  return (
    <div className="flex h-full flex-col bg-[#0f0f12] border-r border-white/10">
      {/* Top Header with Conversation Title & CLI Switcher */}
      <div className="h-12 px-3 border-b border-white/10 flex items-center justify-between bg-[#141418] gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[220px]" title={activeConversationTitle || "New Chat"}>
              {activeConversationTitle || "New Chat"}
            </span>
            {activeProjectName && (
              <Badge variant="outline" className="hidden sm:inline-flex text-[9px] py-0 px-1.5 border-white/15 bg-white/5 text-gray-400 font-mono truncate max-w-[120px]">
                {activeProjectName}
              </Badge>
            )}
          </div>
        </div>

        {/* Action Controls: New Chat, Switch CLI, Clear Chat */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onNewChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNewChat}
              className="h-7 text-xs px-2 border-white/15 bg-white/5 hover:bg-white/10 text-gray-200 cursor-pointer hidden md:flex items-center gap-1"
              title="Start a new chat thread"
            >
              <Plus className="h-3 w-3 text-emerald-400" /> New Chat
            </Button>
          )}

          <div className="flex items-center bg-black/60 border border-white/15 rounded-lg p-0.5 text-[10px]">
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
            className="h-7 w-7 text-muted-foreground hover:text-white"
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
              className="h-7 text-xs px-2.5 border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 cursor-pointer flex items-center gap-1.5 shadow-sm font-medium"
              title="Open Live Preview tab in right panel"
            >
              <PanelRight className="h-3.5 w-3.5 text-purple-400" />
              <span>Preview</span>
            </Button>
          )}
        </div>
      </div>

      {/* Agent Selector Bar */}
      <div className="p-2 border-b border-border/60 bg-[#101012] flex gap-1.5 overflow-x-auto scrollbar-none">
        {[
          { id: "app-developer", label: "App Developer", icon: Code2, color: "text-blue-400 border-blue-500/40 bg-blue-950/30" },
          { id: "llm-deployer", label: "LLM Deployer", icon: Cpu, color: "text-purple-400 border-purple-500/40 bg-purple-950/30" },
          { id: "app-deployer", label: "App Deployer", icon: Server, color: "text-emerald-400 border-emerald-500/40 bg-emerald-950/30" },
          { id: "app-maintainer", label: "App Maintainer", icon: GitPullRequest, color: "text-amber-400 border-amber-500/40 bg-amber-950/30" },
        ].map((mode) => {
          const Icon = mode.icon;
          const isActive = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => handleModeSelect(mode.id as AgentMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all shrink-0 ${
                isActive
                  ? `${mode.color} text-white font-semibold shadow-sm`
                  : "border-border/40 text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mode-Specific Context Fields */}
      {selectedMode === "app-maintainer" && (
        <div className="px-3 py-2 border-b border-border/40 bg-[#121215] flex items-center gap-2">
          <FolderGit2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="GitHub Repo URL (e.g. https://github.com/owner/repo)..."
            className="w-full bg-black/40 border border-border/60 rounded px-2 py-1 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/60"
          />
        </div>
      )}

      {selectedMode === "llm-deployer" && (
        <div className="px-3 py-2 border-b border-border/40 bg-[#121215] flex items-center gap-2 overflow-x-auto text-[11px]">
          <Activity className="h-3.5 w-3.5 text-purple-400 shrink-0" />
          <span className="text-muted-foreground shrink-0 text-[10px] uppercase font-semibold">Traffic:</span>
          {[
            { id: "sporadic", label: "⚡ Burst / Serverless (RunPod vLLM)", desc: "Scale-to-zero" },
            { id: "steady", label: "🏢 Steady Enterprise (Azure AKS / AI)", desc: "Dedicated GPU" },
            { id: "dev", label: "🧪 Dev / Spot GPU (Lowest Cost)", desc: "Spot Pod" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTrafficProfile(t.id)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-colors shrink-0 ${
                trafficProfile === t.id
                  ? "bg-purple-900/40 border-purple-500 text-purple-200 font-semibold"
                  : "border-border/40 text-muted-foreground hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 mb-3 border border-blue-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold text-white mb-1">
              {selectedMode === "app-developer" && "💻 App Developer Agent Ready"}
              {selectedMode === "llm-deployer" && "⚡ LLM Deployer Agent Ready"}
              {selectedMode === "app-deployer" && "🐳 App Deployer Agent Ready"}
              {selectedMode === "app-maintainer" && "🛠️ App Maintainer Agent Ready"}
            </p>
            <p className="text-[11px] leading-relaxed max-w-xs mb-4">
              {selectedMode === "app-developer" && "Ask questions, generate blueprints, build code, and live preview apps in Daytona."}
              {selectedMode === "llm-deployer" && "Profile traffic, size GPUs, and deploy open-weight LLMs to RunPod Serverless or Azure."}
              {selectedMode === "app-deployer" && "Dockerize the workspace and deploy production containers to Azure VMs or Container Apps."}
              {selectedMode === "app-maintainer" && "Clone GitHub repos, implement bugfixes/features on dedicated branches, and create PRs."}
            </p>

            <div className="w-full space-y-2 text-left">
              <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Suggested Tasks:</p>
              {(selectedMode === "app-developer"
                ? ["Build a full-stack React + Tailwind AI Dashboard", "Create a real-time collaborative Whiteboard with Canvas", "Build a REST API with Go Gin & SQLite"]
                : selectedMode === "llm-deployer"
                ? ["Deploy DeepSeek-R1-Distill-Qwen-14B on RunPod Serverless with vLLM", "Deploy Llama-3.1-8B-Instruct on Azure AI Managed Endpoint", "Deploy Qwen2.5-Coder-32B with FP8 quantization"]
                : selectedMode === "app-deployer"
                ? ["Dockerize this app with multi-stage builds & deploy to Azure Container App", "Deploy production container to Ubuntu VM with SSL on Azure", "Generate production Dockerfile & healthcheck endpoint"]
                : ["Fix responsiveness bugs and open a Pull Request", "Add dark mode support and create feature branch", "Upgrade dependencies and run test suite"]
              ).map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(s)}
                  className="w-full text-left text-xs bg-black/40 hover:bg-accent border border-border/80 rounded-md p-2 transition-colors text-muted-foreground hover:text-white"
                >
                  ✨ {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="w-full space-y-2">
              {/* Thoughts */}
              {msg.thoughts && msg.thoughts.length > 0 && (
                <div className="w-full rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-1.5 text-xs text-purple-200 shadow-md">
                  <div className="flex items-center gap-1.5 font-semibold text-[11px] text-purple-300">
                    <Brain className="h-3.5 w-3.5" /> AGY Reasoning & Step Plan
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-purple-300/80 leading-relaxed">
                    {msg.thoughts.map((thought, i) => (
                      <p key={i}>💭 {thought}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Executed Tools Chips */}
              {msg.tools && msg.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 my-1">
                  {msg.tools.map((tool, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="gap-1 text-[10px] bg-black/50 border-emerald-500/30 text-emerald-400 font-mono py-0.5"
                    >
                      <Wrench className="h-3 w-3" /> {tool.name} {tool.path ? `(${tool.path})` : ""}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Approval Gate Card */}
              {msg.isApprovalRequired && msg.approvalData && (
                <div className="w-full my-2 rounded-xl border border-amber-500/40 bg-amber-950/25 p-3.5 text-xs space-y-2.5 shadow-lg">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold">
                    <Zap className="h-4 w-4" />
                    <span>Human Approval Required: {msg.approvalData.title}</span>
                  </div>
                  <p className="text-amber-200/90 leading-relaxed font-mono text-[11px] bg-black/40 p-2.5 rounded border border-amber-500/20">
                    {msg.approvalData.summary}
                  </p>
                  {msg.approvalData.costEstimate && (
                    <div className="flex items-center justify-between text-[11px] text-amber-300 font-mono">
                      <span>Estimated Cost:</span>
                      <span className="font-bold">{msg.approvalData.costEstimate}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleApproval("approve")}
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white h-7 px-3"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Execute
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleApproval("reject")}
                      className="gap-1.5 text-xs text-red-400 hover:bg-red-950/40 border border-red-500/30 h-7 px-3"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Error or Markdown Message Card */}
              {msg.isError ? (
                <div className="rounded-xl px-4 py-3 text-xs leading-relaxed w-full whitespace-pre-wrap font-mono bg-red-950/40 border border-red-500/40 text-red-300 shadow-md">
                  <div className="flex items-center gap-1.5 mb-1.5 text-red-400 font-semibold">
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
          <div className="flex items-center justify-between text-xs text-blue-400 bg-blue-950/20 border border-blue-500/30 rounded-md p-2.5">
            <div className="flex items-center gap-2 animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                className="h-7 gap-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-500/30"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop
              </Button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border/80 bg-[#161618] space-y-2">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedMode === "app-developer"
                ? "Describe the web app you want to build... (Cmd+Enter to send)"
                : selectedMode === "llm-deployer"
                ? "Specify model ID (e.g. meta-llama/Llama-3.1-8B-Instruct) & requirements..."
                : selectedMode === "app-deployer"
                ? "Instructions for Dockerizing and deploying to Azure..."
                : "Describe changes/fixes for target repository..."
            }
            rows={3}
            className="w-full resize-none rounded-lg border border-border/80 bg-black/60 p-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Code2 className="h-3 w-3" /> Cmd+Enter to send
          </span>
          {isProcessing ? (
            <Button
              type="button"
              size="sm"
              onClick={onStopGenerating}
              className="gap-1.5 text-xs h-8 bg-red-600 hover:bg-red-500 text-white"
            >
              <Square className="h-3 w-3 fill-current" />
              Stop Generating
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim()}
              className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Send className="h-3.5 w-3.5" />
              Dispatch Prompt
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
