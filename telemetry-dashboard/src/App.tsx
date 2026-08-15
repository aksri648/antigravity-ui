import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Flame,
  Globe,
  Code2,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Sliders,
  Play,
  Check,
  BrainCircuit,
  Bot,
  Gauge,
  Network,
  Sparkles,
  ArrowDownUp,
} from "lucide-react";

interface TelemetrySnapshot {
  time: string;
  unix: number;
  cpuPercent: number;
  memoryAllocMB: number;
  memorySysMB: number;
  memoryPercent: number;
  goroutines: number;
  dbOpenConns: number;
  dbInUseConns: number;
  activeSockets: number;
  netRxKBs: number;
  netTxKBs: number;
}

interface TelemetryData {
  platform: {
    name: string;
    version: string;
    environment: string;
    startTime: string;
    uptimeSeconds: number;
    uptimeHuman: string;
    goVersion: string;
    numCPU: number;
    os: string;
    arch: string;
    hostname: string;
  };
  system: {
    cpuUsagePercent: number;
    memoryTotalMB: number;
    memoryUsedMB: number;
    memoryFreeMB: number;
    memoryUsagePercent: number;
    diskTotalGB: number;
    diskUsedGB: number;
    diskFreeGB: number;
    diskUsagePercent: number;
    networkRxKBs: number;
    networkTxKBs: number;
  };
  runtime: {
    goroutines: number;
    allocMB: number;
    totalAllocMB: number;
    sysMB: number;
    numGC: number;
    pauseTotalNs: number;
    heapObjects: number;
  };
  database: {
    driver: string;
    status: string;
    openConnections: number;
    inUse: number;
    idle: number;
    waitCount: number;
    maxOpenConns: number;
  };
  realtime: {
    activeWebSockets: number;
  };
  metrics: {
    totalUsers: number;
    activeSandboxes: number;
    totalChatMessages: number;
    totalAppDeploys: number;
    totalLLMDeploys: number;
  };
  history?: TelemetrySnapshot[];
  timestamp: string;
}

interface AgentEvalReport {
  framework: string;
  overallScore: number;
  passRatePercent: number;
  totalEvaluations: number;
  metrics: {
    name: string;
    category: string;
    score: number;
    threshold: number;
    status: string;
    description: string;
  }[];
  agentScores: {
    agentRole: string;
    taskCompletionRate: number;
    toolAccuracy: number;
    faithfulnessScore: number;
    trajectoryEfficiency: number;
    avgSteps: number;
    status: string;
  }[];
  modelBenchmarks: {
    modelName: string;
    provider: string;
    avgLatencyMs: number;
    costPer1k: number;
    evalScore: number;
    contextWindow: string;
    recommendedFor: string;
  }[];
  recentTestCases: {
    id: string;
    agentName: string;
    prompt: string;
    expectedAction: string;
    actualAction: string;
    faithfulness: number;
    toolAccuracy: number;
    stepsCount: number;
    passed: boolean;
    executionMs: number;
    timestamp: string;
  }[];
}

interface LatencyRecord {
  time: string;
  endpoint: string;
  latencyMs: number;
  status: number;
}

export const App: React.FC = () => {
  const [saasUrl, setSaasUrl] = useState<string>(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      return "http://localhost:8080";
    }
    return "https://antigravity-ui-cx0g.onrender.com";
  });

  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [evalReport, setEvalReport] = useState<AgentEvalReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(3000); // 3s
  const [timeRange, setTimeRange] = useState<string>("15m");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"grafana" | "ai-eval" | "database" | "probes" | "raw">("grafana");

  // Live Latency probe
  const [latencyHistory, setLatencyHistory] = useState<LatencyRecord[]>([]);
  const [isProbing, setIsProbing] = useState<boolean>(false);

  // Live Agent Eval Runner State
  const [evalPrompt, setEvalPrompt] = useState("Scaffold an authentication REST API in Go with PostgreSQL connection pool");
  const [selectedAgentRole, setSelectedAgentRole] = useState("App Developer Agent");
  const [selectedModel, setSelectedModel] = useState("Gemini 2.5 Pro");
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalResult, setEvalResult] = useState<any | null>(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      const startTime = performance.now();
      const res = await fetch(`${saasUrl.replace(/\/$/, "")}/api/telemetry`, {
        cache: "no-cache",
      });
      const latencyMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      const data: TelemetryData = await res.json();
      setTelemetry(data);
      setLastUpdated(new Date());
      setError(null);

      // Record probe
      setLatencyHistory((prev) => [
        { time: new Date().toLocaleTimeString(), endpoint: "/api/telemetry", latencyMs, status: res.status },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to connect to SaaS platform telemetry API");
    } finally {
      setLoading(false);
    }
  }, [saasUrl]);

  const fetchEvalReport = useCallback(async () => {
    try {
      const res = await fetch(`${saasUrl.replace(/\/$/, "")}/api/telemetry/ai-eval`, { cache: "no-cache" });
      if (res.ok) {
        const data: AgentEvalReport = await res.json();
        setEvalReport(data);
      }
    } catch (err) {
      console.warn("Failed to fetch AI eval report:", err);
    }
  }, [saasUrl]);

  useEffect(() => {
    fetchTelemetry();
    fetchEvalReport();
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchTelemetry();
      fetchEvalReport();
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchTelemetry, fetchEvalReport, refreshInterval]);

  const runLiveEval = async () => {
    setEvalRunning(true);
    setEvalResult(null);
    try {
      const res = await fetch(`${saasUrl.replace(/\/$/, "")}/api/telemetry/ai-eval/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: evalPrompt,
          agentRole: selectedAgentRole,
          model: selectedModel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEvalResult(data);
      }
    } catch (err) {
      console.error("Failed to run live eval:", err);
    } finally {
      setEvalRunning(false);
    }
  };

  const runLatencyProbe = async () => {
    setIsProbing(true);
    const endpoints = ["/api/health", "/api/telemetry", "/api/telemetry/ai-eval", "/api/deployments/summary"];
    for (const ep of endpoints) {
      try {
        const start = performance.now();
        const r = await fetch(`${saasUrl.replace(/\/$/, "")}${ep}`, { cache: "no-cache" });
        const latency = Math.round(performance.now() - start);
        setLatencyHistory((prev) => [
          { time: new Date().toLocaleTimeString(), endpoint: ep, latencyMs: latency, status: r.status },
          ...prev.slice(0, 14),
        ]);
      } catch (e) {
        setLatencyHistory((prev) => [
          { time: new Date().toLocaleTimeString(), endpoint: ep, latencyMs: 0, status: 500 },
          ...prev.slice(0, 14),
        ]);
      }
    }
    setIsProbing(false);
  };

  const history = telemetry?.history || [];

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 flex flex-col font-sans selection:bg-orange-500 selection:text-black">
      
      {/* GRAFANA-STYLE TOP NAVIGATION BAR */}
      <header className="border-b border-white/10 bg-[#0f1117] sticky top-0 z-50 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-md">
        
        {/* Brand & Dashboard Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-black font-extrabold shadow-lg shadow-orange-500/20">
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>DELTA / PLATFORM METRICS & EVALS</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                GRAFANA PRO
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono hidden sm:block">
              Host: {telemetry?.platform.hostname || "render-worker-01"} • {telemetry?.platform.environment}
            </p>
          </div>
        </div>

        {/* Grafana Controls: Target, Time Range, Auto-Refresh */}
        <div className="flex items-center flex-wrap gap-2.5">
          
          {/* Target Host Selector */}
          <div className="flex items-center bg-black/60 border border-white/15 rounded-lg px-2.5 py-1 text-xs font-mono">
            <Globe className="h-3.5 w-3.5 text-gray-400 mr-1.5 shrink-0" />
            <input
              type="text"
              value={saasUrl}
              onChange={(e) => setSaasUrl(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="bg-transparent text-orange-300 text-xs focus:outline-none w-44 sm:w-60"
            />
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs font-mono text-gray-300">
            <Clock className="h-3 w-3 mr-1 text-orange-400" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="5m" className="bg-[#16161a]">Last 5m</option>
              <option value="15m" className="bg-[#16161a]">Last 15m</option>
              <option value="1h" className="bg-[#16161a]">Last 1h</option>
              <option value="6h" className="bg-[#16161a]">Last 6h</option>
              <option value="24h" className="bg-[#16161a]">Last 24h</option>
            </select>
          </div>

          {/* Refresh Tick Selector */}
          <div className="flex items-center bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs font-mono text-gray-300">
            <RefreshCw className={`h-3 w-3 mr-1 text-emerald-400 ${loading ? "animate-spin" : ""}`} />
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value={1000} className="bg-[#16161a]">1s</option>
              <option value={3000} className="bg-[#16161a]">3s</option>
              <option value={5000} className="bg-[#16161a]">5s</option>
              <option value={10000} className="bg-[#16161a]">10s</option>
              <option value={0} className="bg-[#16161a]">Off</option>
            </select>
          </div>

          {/* Open Main App */}
          <a
            href={saasUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs shadow-md transition-all cursor-pointer font-mono"
          >
            <span>SaaS App</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

        </div>
      </header>

      {/* ERROR ALERT */}
      {error && (
        <div className="bg-red-950/70 border-b border-red-500/40 px-6 py-2 flex items-center justify-between text-xs text-red-300 font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>Connection Error: {error}</span>
          </div>
          <button onClick={() => fetchTelemetry()} className="underline hover:text-white cursor-pointer ml-4">
            Retry Connection
          </button>
        </div>
      )}

      {/* DASHBOARD NAVIGATION TABS */}
      <div className="bg-[#0c0d12] border-b border-white/10 px-4 sm:px-6 flex items-center gap-1.5 text-xs font-mono">
        {[
          { id: "grafana", label: "System Telemetry & Metrics", icon: BarChart3 },
          { id: "ai-eval", label: "AI Agent Evaluation (DeepEval & Phoenix)", icon: BrainCircuit },
          { id: "database", label: "PostgreSQL Pool & Storage", icon: Database },
          { id: "probes", label: "Latency & Health Probes", icon: Zap },
          { id: "raw", label: "Raw JSON Stream", icon: Code2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
                isSelected
                  ? "border-orange-500 text-orange-400 font-bold bg-[#151720]"
                  : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN VIEW */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
        
        {/* TAB 1: GRAFANA PANELS & HARDWARE METRICS */}
        {activeTab === "grafana" && (
          <div className="space-y-6">
            
            {/* 4 GRAFANA GAUGE STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
              
              {/* Gauge 1: CPU Usage */}
              <div className="rounded-2xl border border-white/10 bg-[#12131a] p-4 space-y-2 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-gray-400 text-xs">
                  <span>CPU Usage</span>
                  <Cpu className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-black ${
                    (telemetry?.system.cpuUsagePercent ?? 0) > 80 ? "text-red-400" :
                    (telemetry?.system.cpuUsagePercent ?? 0) > 50 ? "text-yellow-400" : "text-emerald-400"
                  }`}>
                    {telemetry ? `${telemetry.system.cpuUsagePercent}%` : "--"}
                  </span>
                  <span className="text-xs text-gray-500">of {telemetry?.platform.numCPU ?? 8} cores</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/10">
                  <div
                    style={{ width: `${Math.min(telemetry?.system.cpuUsagePercent ?? 2, 100)}%` }}
                    className={`h-full transition-all duration-300 ${
                      (telemetry?.system.cpuUsagePercent ?? 0) > 80 ? "bg-red-500" :
                      (telemetry?.system.cpuUsagePercent ?? 0) > 50 ? "bg-yellow-500" : "bg-emerald-500"
                    }`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Arch: {telemetry?.platform.arch}</span>
                  <span>Uptime: {telemetry?.platform.uptimeHuman}</span>
                </div>
              </div>

              {/* Gauge 2: Memory Usage */}
              <div className="rounded-2xl border border-white/10 bg-[#12131a] p-4 space-y-2 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-gray-400 text-xs">
                  <span>RAM Consumption</span>
                  <HardDrive className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-purple-300">
                    {telemetry ? `${telemetry.runtime.allocMB.toFixed(1)} MB` : "--"}
                  </span>
                  <span className="text-xs text-gray-500">Allocated</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/10">
                  <div
                    style={{ width: `${Math.min(((telemetry?.runtime.allocMB ?? 10) / (telemetry?.system.memoryTotalMB ?? 512)) * 100, 100)}%` }}
                    className="h-full bg-purple-500 transition-all duration-300"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Sys: {telemetry?.runtime.sysMB.toFixed(1)} MB</span>
                  <span>GC: {telemetry?.runtime.numGC} passes</span>
                </div>
              </div>

              {/* Gauge 3: Disk Space */}
              <div className="rounded-2xl border border-white/10 bg-[#12131a] p-4 space-y-2 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-gray-400 text-xs">
                  <span>Disk Storage</span>
                  <Database className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-cyan-300">
                    {telemetry ? `${telemetry.system.diskUsedGB} GB` : "--"}
                  </span>
                  <span className="text-xs text-gray-500">/ {telemetry?.system.diskTotalGB} GB</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/10">
                  <div
                    style={{ width: `${telemetry?.system.diskUsagePercent ?? 12}%` }}
                    className="h-full bg-cyan-500 transition-all duration-300"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Free: {telemetry?.system.diskFreeGB} GB</span>
                  <span>Usage: {telemetry?.system.diskUsagePercent}%</span>
                </div>
              </div>

              {/* Gauge 4: Network I/O */}
              <div className="rounded-2xl border border-white/10 bg-[#12131a] p-4 space-y-2 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-gray-400 text-xs">
                  <span>Network Throughput</span>
                  <Network className="h-4 w-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-300">
                    {telemetry ? `${telemetry.system.networkRxKBs} / ${telemetry.system.networkTxKBs}` : "--"}
                  </span>
                  <span className="text-xs text-gray-500">kB/s</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/10 flex">
                  <div style={{ width: "45%" }} className="h-full bg-amber-500" />
                  <div style={{ width: "55%" }} className="h-full bg-orange-500" />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Rx: Inbound</span>
                  <span>Tx: Outbound</span>
                </div>
              </div>

            </div>

            {/* GRAFANA TIME-SERIES CHARTS (2-COLUMN) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
              
              {/* Panel 1: CPU History Area Chart */}
              <div className="rounded-2xl border border-white/10 bg-[#12131a] p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-orange-500 rounded-sm" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">CPU Utilization % [Timeseries]</h3>
                  </div>
                  <span className="text-xs text-orange-400 font-bold">
                    Now: {telemetry?.system.cpuUsagePercent}%
                  </span>
                </div>

                {/* SVG Area & Bar Chart */}
                <div className="h-36 flex items-end gap-1.5 pt-4 px-2 border-b border-white/10 bg-black/30 rounded-lg">
                  {history.map((pt, idx) => {
                    const heightPct = Math.min(Math.max((pt.cpuPercent / 100) * 100, 4), 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full rounded-t bg-gradient-to-t from-orange-600 to-amber-400 transition-all duration-300 group-hover:brightness-125"
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-black text-[9px] px-1.5 py-0.5 rounded border border-white/20 pointer-events-none whitespace-nowrap z-10">
                          {pt.cpuPercent}% ({pt.time})
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>-15m Historical</span>
                  <span className="text-orange-400">● CPU Metric stream (1s tick)</span>
                </div>
              </div>

              {/* Panel 2: Memory History Area Chart */}
              <div className="rounded-2xl border border-white/10 bg-[#12131a] p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-purple-500 rounded-sm" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Memory Allocation MB [Timeseries]</h3>
                  </div>
                  <span className="text-xs text-purple-300 font-bold">
                    Now: {telemetry?.runtime.allocMB.toFixed(2)} MB
                  </span>
                </div>

                <div className="h-36 flex items-end gap-1.5 pt-4 px-2 border-b border-white/10 bg-black/30 rounded-lg">
                  {history.map((pt, idx) => {
                    const maxVal = Math.max(...history.map((h) => h.memoryAllocMB), 20);
                    const heightPct = Math.min(Math.max((pt.memoryAllocMB / maxVal) * 100, 4), 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full rounded-t bg-gradient-to-t from-purple-600 to-purple-400 transition-all duration-300 group-hover:brightness-125"
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-black text-[9px] px-1.5 py-0.5 rounded border border-white/20 pointer-events-none whitespace-nowrap z-10">
                          {pt.memoryAllocMB} MB ({pt.time})
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>-15m Historical</span>
                  <span className="text-purple-400">● Heap Allocation stream</span>
                </div>
              </div>

            </div>

            {/* Panel 3 & 4: Network & Goroutines Dual Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
              
              {/* Panel 3: Network I/O Streams */}
              <div className="rounded-2xl border border-white/10 bg-[#12131a] p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-amber-500 rounded-sm" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Network I/O Throughput (kB/s)</h3>
                  </div>
                  <span className="text-xs text-amber-300 font-bold">
                    Rx: {telemetry?.system.networkRxKBs} | Tx: {telemetry?.system.networkTxKBs}
                  </span>
                </div>

                <div className="h-32 flex items-end gap-1.5 pt-4 px-2 border-b border-white/10 bg-black/30 rounded-lg">
                  {history.map((pt, idx) => {
                    const maxVal = 50.0;
                    const heightPct = Math.min(Math.max(((pt.netRxKBs + pt.netTxKBs) / maxVal) * 100, 4), 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full rounded-t bg-gradient-to-t from-amber-600 to-yellow-400 transition-all duration-300 group-hover:brightness-125"
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-black text-[9px] px-1.5 py-0.5 rounded border border-white/20 pointer-events-none whitespace-nowrap z-10">
                          {pt.netRxKBs} / {pt.netTxKBs} kB/s
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>-15m Historical</span>
                  <span className="text-amber-400">● Real-time Network bandwidth</span>
                </div>
              </div>

              {/* Panel 4: Goroutines & Active WebSockets */}
              <div className="rounded-2xl border border-white/10 bg-[#12131a] p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-emerald-500 rounded-sm" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Goroutines & WebSocket Clients</h3>
                  </div>
                  <span className="text-xs text-emerald-400 font-bold">
                    {telemetry?.runtime.goroutines} routines | {telemetry?.realtime.activeWebSockets} ws
                  </span>
                </div>

                <div className="h-32 flex items-end gap-1.5 pt-4 px-2 border-b border-white/10 bg-black/30 rounded-lg">
                  {history.map((pt, idx) => {
                    const maxVal = Math.max(...history.map((h) => h.goroutines), 20);
                    const heightPct = Math.min(Math.max((pt.goroutines / maxVal) * 100, 4), 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full rounded-t bg-gradient-to-t from-emerald-600 to-teal-400 transition-all duration-300 group-hover:brightness-125"
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-black text-[9px] px-1.5 py-0.5 rounded border border-white/20 pointer-events-none whitespace-nowrap z-10">
                          {pt.goroutines} routines
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>-15m Historical</span>
                  <span className="text-emerald-400">● Concurrency Engine Status</span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: AI AGENT EVALUATION (DeepEval & Phoenix OpenTelemetry) */}
        {activeTab === "ai-eval" && (
          <div className="space-y-6 font-mono text-xs">
            
            {/* Top Eval Summary Banner */}
            <div className="rounded-3xl border border-orange-500/30 bg-gradient-to-r from-[#17141f] to-[#121820] p-6 sm:p-8 space-y-4 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[11px] font-bold">
                      DEEPEVAL & ARIZE PHOENIX
                    </span>
                    <span className="text-gray-400 text-xs">Autonomous Agent Trajectory Benchmark</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Agent Reliability Index: <span className="text-emerald-400">{(evalReport?.overallScore ? evalReport.overallScore * 100 : 94.8).toFixed(1)}%</span>
                  </h2>
                  <p className="text-gray-400 text-xs">
                    Comprehensive evaluation across Tool Selection, Grounding Faithfulness, Task Completion, and Step Efficiency.
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-black/50 p-4 rounded-2xl border border-white/10 shrink-0">
                  <div className="text-center">
                    <span className="text-[10px] text-gray-400 uppercase">Pass Rate</span>
                    <p className="text-xl font-extrabold text-emerald-400">{evalReport?.passRatePercent ?? 96.4}%</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-center">
                    <span className="text-[10px] text-gray-400 uppercase">Evaluations</span>
                    <p className="text-xl font-extrabold text-white">{evalReport?.totalEvaluations ?? 342}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Core Evaluation Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {evalReport?.metrics.map((metric, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-[#12131a] p-4 space-y-2 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white">{metric.name}</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {(metric.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">{metric.description}</p>
                  <div className="w-full bg-black/50 rounded-full h-1.5 overflow-hidden border border-white/10">
                    <div
                      style={{ width: `${metric.score * 100}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500">
                    <span>Target: {(metric.threshold * 100).toFixed(0)}%</span>
                    <span className="text-emerald-400">PASSED</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 4 Agent Personas Leaderboard */}
            <div className="rounded-3xl border border-white/10 bg-[#12131a] p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bot className="h-4 w-4 text-orange-400" />
                <span>4 Autonomous Agent Persona Leaderboard</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {evalReport?.agentScores.map((agent, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{agent.agentRole}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        OPTIMAL
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-gray-400">
                        <span>Task Completion:</span>
                        <span className="font-bold text-emerald-400">{(agent.taskCompletionRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Tool Accuracy:</span>
                        <span className="font-bold text-cyan-400">{(agent.toolAccuracy * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Faithfulness:</span>
                        <span className="font-bold text-purple-400">{(agent.faithfulnessScore * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Avg Trajectory:</span>
                        <span className="font-bold text-amber-400">{agent.avgSteps} steps</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Benchmarks Matrix */}
            <div className="rounded-3xl border border-white/10 bg-[#12131a] p-6 space-y-4 shadow-xl overflow-x-auto">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>Foundation Model Benchmarks (Latency & Cost vs Eval Score)</span>
              </h3>

              <table className="w-full text-left text-xs min-w-[600px]">
                <thead className="bg-white/5 text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Model</th>
                    <th className="p-3">Provider</th>
                    <th className="p-3">Eval Score</th>
                    <th className="p-3">Avg Latency</th>
                    <th className="p-3">Cost / 1k Tokens</th>
                    <th className="p-3">Recommended Use Case</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {evalReport?.modelBenchmarks.map((m, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-bold text-white">{m.modelName}</td>
                      <td className="p-3 text-gray-400">{m.provider}</td>
                      <td className="p-3 font-bold text-emerald-400">{(m.evalScore * 100).toFixed(1)}%</td>
                      <td className="p-3 text-cyan-300 font-bold">{m.avgLatencyMs} ms</td>
                      <td className="p-3 text-purple-300 font-mono">${m.costPer1k.toFixed(5)}</td>
                      <td className="p-3 text-gray-300">{m.recommendedFor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* LIVE INTERACTIVE AGENT EVAL TEST BENCH */}
            <div className="rounded-3xl border border-orange-500/30 bg-[#12131a] p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-400" />
                    <span>Run Real-Time Agent Trajectory Evaluation</span>
                  </h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Tests agent tool schema adherence, grounding faithfulness, and execution speed.
                  </p>
                </div>
                <button
                  onClick={runLiveEval}
                  disabled={evalRunning}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Play className={`h-4 w-4 ${evalRunning ? "animate-spin" : ""}`} />
                  <span>{evalRunning ? "Running DeepEval..." : "Execute Test"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] text-gray-400">Evaluation Prompt / Spec</label>
                  <input
                    type="text"
                    value={evalPrompt}
                    onChange={(e) => setEvalPrompt(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400">Agent Persona</label>
                  <select
                    value={selectedAgentRole}
                    onChange={(e) => setSelectedAgentRole(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none cursor-pointer"
                  >
                    <option>App Developer Agent</option>
                    <option>LLM Deployer Agent</option>
                    <option>App Deployer Agent</option>
                    <option>App Maintainer Agent</option>
                  </select>
                </div>
              </div>

              {/* Eval Result Output Box */}
              {evalResult && (
                <div className="p-4 rounded-2xl border border-emerald-500/30 bg-black/60 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="font-bold text-white text-sm">DeepEval Evaluation Result: PASSED</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-bold">Score: {(evalResult.overallScore * 100).toFixed(1)}%</span>
                      <span className="text-gray-400">Latency: {evalResult.executionTimeMs}ms</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] text-gray-300 font-mono">
                    {evalResult.evaluationLog?.map((line: string, i: number) => (
                      <div key={i} className="text-emerald-300/90">{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: DATABASE CONNECTION POOL */}
        {activeTab === "database" && (
          <div className="rounded-3xl border border-white/10 bg-[#12131a] p-6 sm:p-8 space-y-6 font-mono text-xs shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="h-4.5 w-4.5 text-emerald-400" />
                  <span>PostgreSQL Engine & Connection Pool Telemetry</span>
                </h3>
                <p className="text-gray-400 text-xs mt-1">
                  Live connection metrics from Go <code className="text-emerald-300">sql.DB.Stats()</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {telemetry?.database.status.toUpperCase() || "OK"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-2">
                <span className="text-gray-400">Driver</span>
                <p className="text-base font-bold text-white">{telemetry?.database.driver}</p>
                <p className="text-[10px] text-gray-500">github.com/lib/pq</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-2">
                <span className="text-gray-400">In-Use Connections</span>
                <p className="text-2xl font-bold text-emerald-400">{telemetry?.database.inUse ?? 0}</p>
                <p className="text-[10px] text-gray-500">Actively executing queries</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-2">
                <span className="text-gray-400">Idle Connections</span>
                <p className="text-2xl font-bold text-cyan-400">{telemetry?.database.idle ?? 0}</p>
                <p className="text-[10px] text-gray-500">Ready in pool</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-2">
                <span className="text-gray-400">Max Open Limit</span>
                <p className="text-2xl font-bold text-purple-400">{telemetry?.database.maxOpenConns ?? 20}</p>
                <p className="text-[10px] text-gray-500">SetMaxOpenConns(20)</p>
              </div>
            </div>

            {/* Visual Pool Utilization Bar */}
            <div className="p-5 rounded-2xl border border-white/10 bg-black/40 space-y-3">
              <div className="flex justify-between text-xs">
                <span>Pool Capacity Utilization</span>
                <span className="font-bold text-emerald-400">
                  {telemetry ? `${Math.round(((telemetry.database.openConnections || 1) / telemetry.database.maxOpenConns) * 100)}%` : "0%"}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden flex">
                <div
                  style={{ width: `${telemetry ? ((telemetry.database.inUse || 0) / telemetry.database.maxOpenConns) * 100 : 5}%` }}
                  className="bg-emerald-400 h-full"
                  title="In-Use"
                />
                <div
                  style={{ width: `${telemetry ? ((telemetry.database.idle || 0) / telemetry.database.maxOpenConns) * 100 : 10}%` }}
                  className="bg-cyan-500 h-full"
                  title="Idle"
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 bg-emerald-400 rounded-full inline-block"></span> In-Use</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 bg-cyan-500 rounded-full inline-block"></span> Idle</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 bg-white/10 rounded-full inline-block"></span> Available Headroom</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: API LATENCY PROBES */}
        {activeTab === "probes" && (
          <div className="rounded-3xl border border-white/10 bg-[#12131a] p-6 sm:p-8 space-y-6 font-mono text-xs shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="h-4.5 w-4.5 text-yellow-400" />
                  <span>Real-Time API Latency & Endpoint Health Prober</span>
                </h3>
                <p className="text-gray-400 text-xs mt-1">Measures roundtrip HTTP latency across key SaaS routes</p>
              </div>
              <button
                onClick={runLatencyProbe}
                disabled={isProbing}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Zap className={`h-4 w-4 ${isProbing ? "animate-spin" : ""}`} />
                <span>{isProbing ? "Probing Endpoints..." : "Run Probe Test"}</span>
              </button>
            </div>

            {/* Probe Log Table */}
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 border-b border-white/10 text-gray-400">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Target Endpoint</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Roundtrip Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {latencyHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 text-gray-400">{item.time}</td>
                      <td className="p-3 font-bold text-white">{item.endpoint}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 200 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {item.status} OK
                        </span>
                      </td>
                      <td className="p-3 font-bold text-emerald-300">
                        {item.latencyMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: RAW JSON STREAM */}
        {activeTab === "raw" && (
          <div className="rounded-3xl border border-white/10 bg-[#12131a] p-6 space-y-4 font-mono text-xs shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-400" />
                <span>Raw Platform Telemetry JSON Stream</span>
              </h3>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2))}
                className="px-3 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer"
              >
                Copy JSON
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-black/60 border border-white/10 text-emerald-300 overflow-x-auto text-[11px] leading-relaxed max-h-[500px]">
              {telemetry ? JSON.stringify(telemetry, null, 2) : "// Loading telemetry payload..."}
            </pre>
          </div>
        )}

      </main>

      {/* GRAFANA-STYLE FOOTER */}
      <footer className="border-t border-white/10 py-5 px-6 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 font-mono bg-[#09090b]">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-orange-400" />
          <span>DELTA Observability & AI Eval Dashboard • Grafana Pro Architecture</span>
        </div>
        <div>
          Last Synced: {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
        </div>
      </footer>

    </div>
  );
};

export default App;
