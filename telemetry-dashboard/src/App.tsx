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
} from "lucide-react";

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
  timestamp: string;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(3000); // 3s
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "database" | "runtime" | "probes" | "raw">("overview");

  // Latency probe history
  const [latencyHistory, setLatencyHistory] = useState<LatencyRecord[]>([]);
  const [isProbing, setIsProbing] = useState<boolean>(false);

  // Goroutines & Memory sparkline buffers
  const [memoryHistory, setMemoryHistory] = useState<{ time: string; mb: number }[]>([]);
  const [goroutineHistory, setGoroutineHistory] = useState<{ time: string; count: number }[]>([]);

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

      // Append to time-series history
      const timeStr = new Date().toLocaleTimeString();
      setMemoryHistory((prev) => [...prev.slice(-19), { time: timeStr, mb: Number(data.runtime.allocMB.toFixed(2)) }]);
      setGoroutineHistory((prev) => [...prev.slice(-19), { time: timeStr, count: data.runtime.goroutines }]);

      // Record probe latency
      setLatencyHistory((prev) => [
        { time: timeStr, endpoint: "/api/telemetry", latencyMs, status: res.status },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to connect to SaaS platform telemetry API");
    } finally {
      setLoading(false);
    }
  }, [saasUrl]);

  useEffect(() => {
    fetchTelemetry();
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchTelemetry, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchTelemetry, refreshInterval]);

  const runLatencyProbe = async () => {
    setIsProbing(true);
    const endpoints = ["/api/health", "/api/telemetry", "/api/deployments/summary"];
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

  return (
    <div className="min-h-screen bg-[#09090c] text-gray-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      
      {/* TOP STATUS BAR */}
      <header className="border-b border-white/10 bg-[#121216]/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & Live Pulse */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-black shadow-lg shadow-emerald-500/20">
            <Activity className="h-4.5 w-4.5" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-sm sm:text-base font-bold text-white tracking-tight">
                DELTA PLATFORM TELEMETRY
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                LIVE PULSE
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono hidden sm:block">
              SaaS Backend Runtime • PostgreSQL Connection Pool • Concurrency
            </p>
          </div>
        </div>

        {/* Target SaaS URL & Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          
          {/* Target Host URL Selector */}
          <div className="flex items-center bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono">
            <Globe className="h-3.5 w-3.5 text-gray-400 mr-1.5 shrink-0" />
            <input
              type="text"
              value={saasUrl}
              onChange={(e) => setSaasUrl(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="bg-transparent text-emerald-300 text-xs focus:outline-none w-48 sm:w-64"
            />
          </div>

          {/* Auto Refresh Selector */}
          <div className="flex items-center bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-gray-300">
            <Clock className="h-3 w-3 mr-1 text-emerald-400" />
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value={1000} className="bg-[#16161a]">1s tick</option>
              <option value={3000} className="bg-[#16161a]">3s tick</option>
              <option value={5000} className="bg-[#16161a]">5s tick</option>
              <option value={10000} className="bg-[#16161a]">10s tick</option>
              <option value={0} className="bg-[#16161a]">Paused</option>
            </select>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchTelemetry()}
            disabled={loading}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Now"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          {/* Back to SaaS Platform Button */}
          <a
            href={saasUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-bold text-xs shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer font-mono"
          >
            <span>Open DELTA SaaS</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {/* ERROR ALERT BANNER */}
      {error && (
        <div className="bg-red-950/50 border-b border-red-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-red-300 font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>Connection Error: {error}</span>
          </div>
          <button
            onClick={() => fetchTelemetry()}
            className="underline hover:text-white cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 space-y-6">
        
        {/* TOP KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 font-mono">
          
          {/* Card 1: Platform Status */}
          <div className="rounded-2xl border border-white/10 bg-[#141418] p-4 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Platform Health</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {telemetry ? "ONLINE" : "SYNCING"}
            </div>
            <div className="text-[10px] text-gray-400 truncate">
              {telemetry?.platform.environment || "production"} mode
            </div>
          </div>

          {/* Card 2: Platform Uptime */}
          <div className="rounded-2xl border border-white/10 bg-[#141418] p-4 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>System Uptime</span>
              <Clock className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-cyan-300 truncate">
              {telemetry?.platform.uptimeHuman || "0s"}
            </div>
            <div className="text-[10px] text-gray-400 truncate">
              {telemetry ? `${telemetry.platform.uptimeSeconds}s total` : "Calculating..."}
            </div>
          </div>

          {/* Card 3: Memory Allocation */}
          <div className="rounded-2xl border border-white/10 bg-[#141418] p-4 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Heap Allocated</span>
              <HardDrive className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-purple-300">
              {telemetry ? `${telemetry.runtime.allocMB.toFixed(1)} MB` : "--"}
            </div>
            <div className="text-[10px] text-gray-400 truncate">
              Sys: {telemetry ? `${telemetry.runtime.sysMB.toFixed(1)} MB` : "--"}
            </div>
          </div>

          {/* Card 4: Goroutines */}
          <div className="rounded-2xl border border-white/10 bg-[#141418] p-4 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Goroutines</span>
              <Cpu className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-300">
              {telemetry?.runtime.goroutines ?? "--"}
            </div>
            <div className="text-[10px] text-gray-400 truncate">
              CPUs: {telemetry?.platform.numCPU ?? "--"} cores
            </div>
          </div>

          {/* Card 5: Database Connections */}
          <div className="rounded-2xl border border-white/10 bg-[#141418] p-4 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>DB Pool (In-Use)</span>
              <Database className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-300">
              {telemetry ? `${telemetry.database.inUse} / ${telemetry.database.maxOpenConns}` : "--"}
            </div>
            <div className="text-[10px] text-gray-400 truncate">
              Idle: {telemetry?.database.idle ?? 0} conns
            </div>
          </div>

          {/* Card 6: Active WebSockets */}
          <div className="rounded-2xl border border-white/10 bg-[#141418] p-4 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Live WebSockets</span>
              <Radio className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-300">
              {telemetry?.realtime.activeWebSockets ?? 0}
            </div>
            <div className="text-[10px] text-gray-400 truncate">
              Hub clients (/ws)
            </div>
          </div>

        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center border-b border-white/10 gap-2 pb-1 text-xs font-mono">
          {[
            { id: "overview", label: "Overview & Charts", icon: BarChart3 },
            { id: "database", label: "Database Connection Pool", icon: Database },
            { id: "runtime", label: "Go Runtime & Memory", icon: Cpu },
            { id: "probes", label: "API Latency Probes", icon: Zap },
            { id: "raw", label: "Raw JSON Stream", icon: Code2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#141418] text-emerald-400 border-t-2 border-emerald-500 font-bold"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW & CHARTS */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            
            {/* 2-Column Live Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
              
              {/* Chart 1: Memory Trend */}
              <div className="rounded-3xl border border-white/10 bg-[#121216] p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-purple-400" />
                    <h3 className="font-bold text-sm text-white">Memory Allocation Trend (MB)</h3>
                  </div>
                  <span className="text-xs text-purple-300 font-bold">
                    {telemetry ? `${telemetry.runtime.allocMB.toFixed(2)} MB` : ""}
                  </span>
                </div>

                {/* Simple SVG Bar Sparkline */}
                <div className="h-32 flex items-end gap-1.5 pt-4 px-2 border-b border-white/10">
                  {memoryHistory.map((item, idx) => {
                    const maxVal = Math.max(...memoryHistory.map((m) => m.mb), 20);
                    const heightPercent = Math.max((item.mb / maxVal) * 100, 5);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-t bg-gradient-to-t from-purple-600 to-purple-400 transition-all duration-300 group-hover:brightness-125"
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-black text-[9px] px-1.5 py-0.5 rounded border border-white/20 pointer-events-none whitespace-nowrap z-10">
                          {item.mb} MB ({item.time})
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>T-20 intervals</span>
                  <span>Live Current</span>
                </div>
              </div>

              {/* Chart 2: Goroutine Concurrency Trend */}
              <div className="rounded-3xl border border-white/10 bg-[#121216] p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-amber-400" />
                    <h3 className="font-bold text-sm text-white">Active Goroutines Concurrency</h3>
                  </div>
                  <span className="text-xs text-amber-300 font-bold">
                    {telemetry ? `${telemetry.runtime.goroutines} routines` : ""}
                  </span>
                </div>

                <div className="h-32 flex items-end gap-1.5 pt-4 px-2 border-b border-white/10">
                  {goroutineHistory.map((item, idx) => {
                    const maxVal = Math.max(...goroutineHistory.map((g) => g.count), 30);
                    const heightPercent = Math.max((item.count / maxVal) * 100, 5);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-t bg-gradient-to-t from-amber-600 to-amber-400 transition-all duration-300 group-hover:brightness-125"
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-black text-[9px] px-1.5 py-0.5 rounded border border-white/20 pointer-events-none whitespace-nowrap z-10">
                          {item.count} ({item.time})
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>T-20 intervals</span>
                  <span>Live Current</span>
                </div>
              </div>

            </div>

            {/* Platform Specifications Grid */}
            <div className="rounded-3xl border border-white/10 bg-[#121216] p-6 space-y-4 font-mono text-xs shadow-xl">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-400" />
                <span>DELTA SaaS Server Environment</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl border border-white/10 bg-black/40 space-y-1">
                  <span className="text-gray-400 text-[11px]">Go Runtime</span>
                  <p className="font-bold text-white">{telemetry?.platform.goVersion || "--"}</p>
                </div>
                <div className="p-3 rounded-xl border border-white/10 bg-black/40 space-y-1">
                  <span className="text-gray-400 text-[11px]">Operating System / Arch</span>
                  <p className="font-bold text-white">
                    {telemetry ? `${telemetry.platform.os} / ${telemetry.platform.arch}` : "--"}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-white/10 bg-black/40 space-y-1">
                  <span className="text-gray-400 text-[11px]">Database Driver</span>
                  <p className="font-bold text-emerald-400">{telemetry?.database.driver || "--"}</p>
                </div>
                <div className="p-3 rounded-xl border border-white/10 bg-black/40 space-y-1">
                  <span className="text-gray-400 text-[11px]">Platform Start Timestamp</span>
                  <p className="font-bold text-gray-300 truncate">
                    {telemetry ? new Date(telemetry.platform.startTime).toLocaleString() : "--"}
                  </p>
                </div>
              </div>
            </div>

            {/* Business & Database Metrics Summary */}
            <div className="rounded-3xl border border-white/10 bg-[#121216] p-6 space-y-4 font-mono text-xs shadow-xl">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <span>SaaS Entity & Aggregate Metrics</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-1">
                  <span className="text-gray-400">Total Registered Users</span>
                  <p className="text-2xl font-bold text-white">{telemetry?.metrics.totalUsers ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-1">
                  <span className="text-gray-400">Active Daytona Sandboxes</span>
                  <p className="text-2xl font-bold text-emerald-400">{telemetry?.metrics.activeSandboxes ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-1">
                  <span className="text-gray-400">Total Chat Messages Logged</span>
                  <p className="text-2xl font-bold text-cyan-400">{telemetry?.metrics.totalChatMessages ?? 0}</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: DATABASE CONNECTION POOL */}
        {activeTab === "database" && (
          <div className="rounded-3xl border border-white/10 bg-[#121216] p-6 sm:p-8 space-y-6 font-mono text-xs shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="h-4.5 w-4.5 text-emerald-400" />
                  <span>Database Engine & Connection Pool Telemetry</span>
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

        {/* TAB 3: RUNTIME & MEMORY */}
        {activeTab === "runtime" && (
          <div className="rounded-3xl border border-white/10 bg-[#121216] p-6 sm:p-8 space-y-6 font-mono text-xs shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="h-4.5 w-4.5 text-purple-400" />
              <span>Go Runtime & Garbage Collector (runtime.MemStats)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-1">
                <span className="text-gray-400">Current Alloc</span>
                <p className="text-2xl font-bold text-purple-300">{telemetry?.runtime.allocMB.toFixed(2)} MB</p>
                <p className="text-[10px] text-gray-500">Bytes allocated and in use</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-1">
                <span className="text-gray-400">Total Alloc (Cumulative)</span>
                <p className="text-2xl font-bold text-purple-400">{telemetry?.runtime.totalAllocMB.toFixed(2)} MB</p>
                <p className="text-[10px] text-gray-500">Cumulative bytes allocated</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-1">
                <span className="text-gray-400">System Memory Reserved</span>
                <p className="text-2xl font-bold text-cyan-300">{telemetry?.runtime.sysMB.toFixed(2)} MB</p>
                <p className="text-[10px] text-gray-500">Memory obtained from OS</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-1">
                <span className="text-gray-400">Garbage Collector Cycles</span>
                <p className="text-2xl font-bold text-amber-300">{telemetry?.runtime.numGC ?? 0}</p>
                <p className="text-[10px] text-gray-500">Completed GC passes</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-1">
                <span className="text-gray-400">Heap Objects</span>
                <p className="text-2xl font-bold text-emerald-300">{telemetry?.runtime.heapObjects.toLocaleString() ?? 0}</p>
                <p className="text-[10px] text-gray-500">Active allocated objects</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-1">
                <span className="text-gray-400">GC Pause Total</span>
                <p className="text-2xl font-bold text-rose-300">
                  {telemetry ? `${(telemetry.runtime.pauseTotalNs / 1000000).toFixed(2)} ms` : "0 ms"}
                </p>
                <p className="text-[10px] text-gray-500">Total stop-the-world pause</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: API LATENCY PROBES */}
        {activeTab === "probes" && (
          <div className="rounded-3xl border border-white/10 bg-[#121216] p-6 sm:p-8 space-y-6 font-mono text-xs shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="h-4.5 w-4.5 text-yellow-400" />
                  <span>Real-time API Latency & Endpoint Health Prober</span>
                </h3>
                <p className="text-gray-400 text-xs mt-1">Measures roundtrip HTTP latency across key SaaS routes</p>
              </div>
              <button
                onClick={runLatencyProbe}
                disabled={isProbing}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
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
                  {latencyHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-500">
                        No latency tests executed yet. Click "Run Probe Test" or wait for live polling.
                      </td>
                    </tr>
                  ) : (
                    latencyHistory.map((item, idx) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: RAW JSON STREAM */}
        {activeTab === "raw" && (
          <div className="rounded-3xl border border-white/10 bg-[#121216] p-6 space-y-4 font-mono text-xs shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-400" />
                <span>Raw /api/telemetry JSON Stream</span>
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

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-6 px-6 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 font-mono">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <span>DELTA Platform Telemetry Dashboard • Standalone Web Service</span>
        </div>
        <div>
          Last Synced: {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
        </div>
      </footer>

    </div>
  );
};

export default App;
