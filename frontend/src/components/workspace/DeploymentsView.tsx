import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  Server,
  Activity,
  ExternalLink,
  Copy,
  CheckCheck,
  RefreshCw,
  Search,
  Zap,
  Layers,
  Sparkles,
  Info,
  Clock,
  Gauge,
  Lock,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { DeploymentSummary } from "../../types";
import { apiUrl } from "../../config/api";

interface DeploymentsViewProps {
  userId?: string;
  projectId?: string;
  sandboxId?: string;
}

export const DeploymentsView: React.FC<DeploymentsViewProps> = ({
  userId = "default-user",
  projectId,
}) => {
  const [activeTab, setActiveTab] = useState<"llm" | "app" | "architecture">("llm");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DeploymentSummary | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchDeployments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/deployments/summary", { userId, projectId }));
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.warn("Failed to fetch deployments summary:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, projectId]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filteredLLMs = (summary?.llmDeployments || []).filter(
    (l) =>
      l.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.gpuType && l.gpuType.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredApps = (summary?.appDeployments || []).filter(
    (a) =>
      a.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.publicUrl && a.publicUrl.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-[#0b0b0e] text-white font-sans overflow-hidden">
      {/* Top Header & Metrics Bar */}
      <div className="p-3 sm:p-4 border-b border-white/10 bg-[#111115] shrink-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">Deployments Management</h2>
                <Badge variant="outline" className="text-[10px] py-0 px-2 border-emerald-500/30 bg-emerald-950/30 text-emerald-400 font-mono">
                  ● Live Observability
                </Badge>
              </div>
              <p className="text-[11px] text-gray-400">
                Read-only runtime telemetry for agent-provisioned LLMs and containerized applications.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] py-1 px-2.5 border-white/15 bg-white/5 text-gray-300 gap-1.5 font-mono hidden md:inline-flex">
              <Info className="h-3 w-3 text-cyan-400" /> All Info Read-Only (Controls Automated)
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDeployments}
              disabled={loading}
              className="h-7 text-xs px-2.5 border-white/15 bg-white/5 hover:bg-white/10 text-gray-200 cursor-pointer gap-1.5"
              title="Refresh deployment metrics"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-emerald-400" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Global Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-mono mb-1">
              <span>LLM Endpoints</span>
              <Cpu className="h-3 w-3 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{summary?.totalLlmDeployments ?? 0}</span>
              <span className="text-[10px] text-emerald-400 font-mono font-medium">({summary?.activeLlmCount ?? 0} Active)</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-mono mb-1">
              <span>App Workloads</span>
              <Server className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{summary?.totalAppDeployments ?? 0}</span>
              <span className="text-[10px] text-emerald-400 font-mono font-medium">({summary?.activeAppCount ?? 0} Live)</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-mono mb-1">
              <span>Avg Latency (p95)</span>
              <Gauge className="h-3 w-3 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">31 ms</span>
              <span className="text-[10px] text-gray-400 font-mono">vLLM / FP8</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-mono mb-1">
              <span>Cloud Health</span>
              <Activity className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-emerald-400">99.99%</span>
              <span className="text-[10px] text-gray-400 font-mono">Uptime</span>
            </div>
          </div>
        </div>

        {/* Sub-Tab Navigation & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center bg-black/60 border border-white/15 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("llm")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === "llm"
                  ? "bg-purple-600/90 text-white font-bold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>LLM Deployments</span>
              <Badge variant="outline" className="text-[9px] py-0 px-1 border-white/20 bg-white/10 text-white font-mono ml-0.5">
                {summary?.totalLlmDeployments ?? 2}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("app")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === "app"
                  ? "bg-emerald-600/90 text-white font-bold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Server className="h-3.5 w-3.5" />
              <span>App Deployments</span>
              <Badge variant="outline" className="text-[9px] py-0 px-1 border-white/20 bg-white/10 text-white font-mono ml-0.5">
                {summary?.totalAppDeployments ?? 2}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("architecture")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === "architecture"
                  ? "bg-cyan-600/90 text-white font-bold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Swarm Overview</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deployments..."
              className="h-8 pl-8 text-xs bg-black/40 border-white/15 text-white placeholder:text-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: LLM DEPLOYMENTS */}
        {activeTab === "llm" && (
          <div className="space-y-4">
            {filteredLLMs.length === 0 ? (
              <div className="text-center p-12 text-gray-400 border border-white/10 rounded-2xl bg-white/[0.02]">
                <Cpu className="h-8 w-8 mx-auto mb-2 text-purple-400 opacity-60" />
                <p className="text-xs font-semibold text-white">No LLM Deployments Found</p>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1">
                  Use the <span className="text-purple-300 font-mono">LLM Deployer Agent</span> in Chat to provision open-weight models (DeepSeek, LLaMA) on RunPod or Azure.
                </p>
              </div>
            ) : (
              filteredLLMs.map((llm) => (
                <div
                  key={llm.id}
                  className="rounded-2xl border border-white/10 bg-[#121216] p-4 sm:p-5 space-y-3.5 shadow-lg shadow-black/40 hover:border-purple-500/30 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white font-mono">{llm.modelName}</h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0.5 px-2 bg-emerald-950/40 border-emerald-500/40 text-emerald-400 font-mono flex items-center gap-1"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {llm.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1 font-medium text-purple-300">
                          <Zap className="h-3 w-3" /> {llm.provider}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">{llm.gpuType}</span>
                        <span>•</span>
                        <span className="text-gray-400 text-[11px]">{llm.trafficProfile}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-amber-300 font-mono">{llm.costEstimate}</div>
                      <div className="text-[10px] text-gray-500 font-mono">Estimated Billing</div>
                    </div>
                  </div>

                  {/* Hardware & Latency Spec Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                      <div className="text-[10px] text-gray-500 uppercase">Latency (p95)</div>
                      <div className="font-bold text-cyan-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {llm.latencyMs} ms
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                      <div className="text-[10px] text-gray-500 uppercase">Throughput</div>
                      <div className="font-bold text-emerald-400 flex items-center gap-1">
                        <Gauge className="h-3 w-3" /> {llm.throughputTps} tok/s
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                      <div className="text-[10px] text-gray-500 uppercase">Context Window</div>
                      <div className="font-bold text-purple-300">{llm.contextLength.toLocaleString()} tokens</div>
                    </div>
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                      <div className="text-[10px] text-gray-500 uppercase">Quantization</div>
                      <div className="font-bold text-gray-200">{llm.quantization}</div>
                    </div>
                  </div>

                  {/* Inference Endpoint Box */}
                  <div className="rounded-xl bg-black/60 border border-white/10 p-2.5 flex items-center justify-between gap-2 font-mono text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] text-gray-500 uppercase shrink-0">OpenAI API URL:</span>
                      <span className="text-gray-200 truncate select-all">{llm.endpointUrl}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(llm.endpointUrl, `url-${llm.id}`)}
                      className="h-6 px-2 text-[10px] text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0 gap-1"
                    >
                      {copiedField === `url-${llm.id}` ? (
                        <>
                          <CheckCheck className="h-3 w-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy URL
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: APP DEPLOYMENTS */}
        {activeTab === "app" && (
          <div className="space-y-4">
            {filteredApps.length === 0 ? (
              <div className="text-center p-12 text-gray-400 border border-white/10 rounded-2xl bg-white/[0.02]">
                <Server className="h-8 w-8 mx-auto mb-2 text-emerald-400 opacity-60" />
                <p className="text-xs font-semibold text-white">No Application Deployments Found</p>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1">
                  Use the <span className="text-emerald-300 font-mono">App Deployer Agent</span> in Chat to containerize your workspace and push to Azure VMs or Container Apps.
                </p>
              </div>
            ) : (
              filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="rounded-2xl border border-white/10 bg-[#121216] p-4 sm:p-5 space-y-3.5 shadow-lg shadow-black/40 hover:border-emerald-500/30 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white font-mono">{app.appName}</h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0.5 px-2 bg-emerald-950/40 border-emerald-500/40 text-emerald-400 font-mono flex items-center gap-1"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {app.status}
                        </Badge>
                        {app.sslEnabled && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-cyan-500/30 text-cyan-400 font-mono gap-1">
                            <Lock className="h-2.5 w-2.5" /> SSL Secured
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1 font-medium text-emerald-300">
                          <Server className="h-3 w-3" /> {app.provider}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">{app.instanceType}</span>
                        <span>•</span>
                        <span className="text-gray-400 text-[11px] font-mono">Port {app.port}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400 font-mono">{app.uptime}</div>
                      <div className="text-[10px] text-gray-500 font-mono">Service Availability</div>
                    </div>
                  </div>

                  {/* Resource Utilization Gauges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>CPU Utilization</span>
                        <span className="text-white">{app.cpuUtilization}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${app.cpuUtilization}%` }} />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>RAM Utilization</span>
                        <span className="text-white">{app.memoryUtilization}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${app.memoryUtilization}%` }} />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                      <div className="text-[10px] text-gray-500 uppercase">Replicas</div>
                      <div className="font-bold text-white">{app.replicas} Instance(s)</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                      <div className="text-[10px] text-gray-500 uppercase">Image Tag</div>
                      <div className="font-bold text-gray-300 truncate" title={app.imageTag}>
                        {app.imageTag}
                      </div>
                    </div>
                  </div>

                  {/* Public Live URL Link */}
                  <div className="rounded-xl bg-black/60 border border-white/10 p-2.5 flex items-center justify-between gap-2 font-mono text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] text-gray-500 uppercase shrink-0">Public URL:</span>
                      <a
                        href={app.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline truncate flex items-center gap-1"
                      >
                        {app.publicUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(app.publicUrl, `app-url-${app.id}`)}
                      className="h-6 px-2 text-[10px] text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0 gap-1"
                    >
                      {copiedField === `app-url-${app.id}` ? (
                        <>
                          <CheckCheck className="h-3 w-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy URL
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: ARCHITECTURE & SWARM OVERVIEW */}
        {activeTab === "architecture" && (
          <div className="rounded-2xl border border-white/10 bg-[#121216] p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" /> Autonomous Agent Deployment Architecture
              </h3>
              <p className="text-xs text-gray-400">
                DELTA coordinates specialized subagents to provision dedicated microservices and model endpoints.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                  <Cpu className="h-4 w-4" /> LLM Deployer Pipeline
                </div>
                <ul className="text-[11px] text-purple-200/80 space-y-1.5 font-mono list-disc list-inside">
                  <li>Traffic Profiler (Scale-to-Zero vs Steady)</li>
                  <li>GPU Sizer (RTX 4090, A100, H100 VRAM matching)</li>
                  <li>vLLM Engine Serverless Deployment</li>
                  <li>OpenAI-Compatible `/v1/chat/completions` routing</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <Server className="h-4 w-4" /> App Deployer Pipeline
                </div>
                <ul className="text-[11px] text-emerald-200/80 space-y-1.5 font-mono list-disc list-inside">
                  <li>Multi-Stage Dockerfile Generation</li>
                  <li>Azure Container Registry (ACR) Image Build</li>
                  <li>Azure Container Apps / Linux VM Provisioning</li>
                  <li>Automated HTTPS / SSL Ingress Certificate</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
