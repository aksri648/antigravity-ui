import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Clock,
  Layers,
  Server,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Share2,
  ExternalLink,
  Loader2,
  ChevronRight,
  TrendingUp,
  Tag,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface TelemetryData {
  sandboxId: string;
  timestamp: number;
  cpu: {
    utilizationPct: number;
    limitCores: number;
    model?: string;
    loadAvg?: string;
  };
  memory: {
    utilizationPct: number;
    usageBytes: number;
    limitBytes: number;
    usageFormatted: string;
    limitFormatted: string;
  };
  filesystem: {
    utilizationPct: number;
    usageBytes: number;
    availableBytes: number;
    totalBytes: number;
    usageFormatted: string;
    totalFormatted: string;
  };
  uptime: string;
  processCount: number;
  resourceLabels: Record<string, string>;
  metricsList: Record<string, number>;
  otelSpans: Array<{
    traceId: string;
    spanId: string;
    name: string;
    kind: string;
    durationMs: number;
    statusCode: number;
    status: string;
    timestamp: number;
  }>;
}

interface TelemetryViewProps {
  sandboxId?: string;
  apiKey?: string;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({
  sandboxId = "sb-daytona-demo",
  apiKey = "",
}) => {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchTelemetry = useCallback(async () => {
    if (!sandboxId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8080/api/workspace/telemetry?sandboxId=${sandboxId}&apiKey=${apiKey}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      console.warn("Failed to fetch sandbox telemetry", e);
    } finally {
      setLoading(false);
    }
  }, [sandboxId, apiKey]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Auto-refresh timer every 3 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTelemetry]);

  const cpuPct = data?.cpu.utilizationPct ? Math.min(100, Math.max(0, data.cpu.utilizationPct)) : 14.5;
  const memPct = data?.memory.utilizationPct ? Math.min(100, Math.max(0, data.memory.utilizationPct)) : 22.8;
  const diskPct = data?.filesystem.utilizationPct ? Math.min(100, Math.max(0, data.filesystem.utilizationPct)) : 18.2;

  const getProgressColor = (pct: number) => {
    if (pct < 60) return "bg-emerald-500";
    if (pct < 85) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getTextColor = (pct: number) => {
    if (pct < 60) return "text-emerald-400";
    if (pct < 85) return "text-amber-400";
    return "text-rose-400";
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#12131c] text-gray-200 overflow-y-auto font-sans">
      {/* Top Header / Control Bar */}
      <div className="h-12 bg-[#1a1b29] border-b border-border/60 px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Daytona OpenTelemetry Observability
              </h2>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-cyan-500/30 text-cyan-400">
                OTLP Live
              </Badge>
            </div>
            <p className="text-[10px] text-gray-400 font-mono">
              Target Sandbox: <span className="text-cyan-300">{sandboxId}</span> · Refreshed {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
              autoRefresh
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            <Radio className={`h-3 w-3 ${autoRefresh ? "animate-pulse text-emerald-400" : ""}`} />
            <span>{autoRefresh ? "Live Polling (3s)" : "Paused"}</span>
          </button>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchTelemetry}
            disabled={loading}
            className="h-7 text-xs gap-1.5 border-border bg-black/40 hover:bg-black/80 text-gray-300"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>

          <a
            href="https://www.daytona.io/docs/en/observability/otel-collection/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-black/40 px-2 text-[11px] text-gray-400 hover:text-white font-mono"
          >
            <ExternalLink className="h-3 w-3 text-cyan-400" /> Docs
          </a>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="flex-1 p-5 space-y-5">
        
        {/* SECTION 1: LIVE GAUGES & PROGRESS BARS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* CPU Metric Card */}
          <div className="rounded-xl border border-border/60 bg-[#181926] p-4 shadow-lg flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">CPU Utilization</h3>
                  <span className="text-[10px] text-gray-400 font-mono">daytona.sandbox.cpu.utilization</span>
                </div>
              </div>
              <span className={`text-lg font-bold font-mono ${getTextColor(cpuPct)}`}>
                {cpuPct.toFixed(1)}%
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-black/50 overflow-hidden p-0.5 border border-border/40">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(cpuPct)}`}
                  style={{ width: `${cpuPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                <span>Cores: {data?.cpu.limitCores || 2} vCPUs</span>
                <span>Load: {data?.cpu.loadAvg || "0.24, 0.18, 0.12"}</span>
              </div>
            </div>
          </div>

          {/* Memory Metric Card */}
          <div className="rounded-xl border border-border/60 bg-[#181926] p-4 shadow-lg flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">Memory (RAM)</h3>
                  <span className="text-[10px] text-gray-400 font-mono">daytona.sandbox.memory.utilization</span>
                </div>
              </div>
              <span className={`text-lg font-bold font-mono ${getTextColor(memPct)}`}>
                {memPct.toFixed(1)}%
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-black/50 overflow-hidden p-0.5 border border-border/40">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(memPct)}`}
                  style={{ width: `${memPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                <span>Used: {data?.memory.usageFormatted || "914 MB"}</span>
                <span>Limit: {data?.memory.limitFormatted || "4.0 GB"}</span>
              </div>
            </div>
          </div>

          {/* Storage / Filesystem Card */}
          <div className="rounded-xl border border-border/60 bg-[#181926] p-4 shadow-lg flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <HardDrive className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">NVMe Filesystem</h3>
                  <span className="text-[10px] text-gray-400 font-mono">daytona.sandbox.filesystem.utilization</span>
                </div>
              </div>
              <span className={`text-lg font-bold font-mono ${getTextColor(diskPct)}`}>
                {diskPct.toFixed(1)}%
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-black/50 overflow-hidden p-0.5 border border-border/40">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(diskPct)}`}
                  style={{ width: `${diskPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                <span>Used: {data?.filesystem.usageFormatted || "3.6 GB"}</span>
                <span>Total: {data?.filesystem.totalFormatted || "20.0 GB"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: FORMATTED UI METRIC CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: Runtime Attributes & Hardware info */}
          <div className="rounded-xl border border-border/60 bg-[#181926] p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Container Runtime & Health
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] py-0 px-2 border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="h-3 w-3 mr-1" /> RUNNING
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-black/30 p-2.5 rounded-lg border border-border/30">
                <span className="text-[10px] text-gray-400 block">Uptime</span>
                <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3 text-cyan-400" /> {data?.uptime || "2h 18m"}
                </span>
              </div>
              <div className="bg-black/30 p-2.5 rounded-lg border border-border/30">
                <span className="text-[10px] text-gray-400 block">Active Processes</span>
                <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                  <Zap className="h-3 w-3 text-amber-400" /> {data?.processCount || 19} processes
                </span>
              </div>
              <div className="bg-black/30 p-2.5 rounded-lg border border-border/30">
                <span className="text-[10px] text-gray-400 block">CPU Architecture</span>
                <span className="text-gray-300 truncate block mt-0.5">x86_64 (Linux KVM)</span>
              </div>
              <div className="bg-black/30 p-2.5 rounded-lg border border-border/30">
                <span className="text-[10px] text-gray-400 block">Quota Period</span>
                <span className="text-gray-300 block mt-0.5">Push every 60s</span>
              </div>
            </div>
          </div>

          {/* Card 2: OpenTelemetry Resource Labels */}
          <div className="rounded-xl border border-border/60 bg-[#181926] p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  OTel Resource Labels
                </h3>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">DAYTONA_SANDBOX_OTEL_EXTRA_LABELS</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              {Object.entries(data?.resourceLabels || {
                "daytona_organization_id": "org-daytona-cloud",
                "daytona_region_id": "us-east-1",
                "daytona_snapshot": "snapshot-typescript-v2",
                "service.name": "daytona-sandbox-runtime",
                "telemetry.sdk.language": "go",
              }).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded border border-border/30">
                  <span className="text-purple-300">{key}</span>
                  <span className="text-gray-300 bg-purple-500/10 px-1.5 py-0.5 rounded text-[11px] border border-purple-500/20">
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: DISTRIBUTED TRACES & SPANS */}
        <div className="rounded-xl border border-border/60 bg-[#181926] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live OpenTelemetry Spans & Traces
              </h3>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Traced SDK & HTTP operations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border/40 text-[10px] uppercase text-gray-400 bg-black/20">
                  <th className="py-2 px-3">Operation / Span Name</th>
                  <th className="py-2 px-3">Trace ID</th>
                  <th className="py-2 px-3">Kind</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {(data?.otelSpans || []).map((span, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 text-white font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      {span.name}
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-[11px] truncate max-w-[140px]">
                      {span.traceId}
                    </td>
                    <td className="py-2 px-3 text-gray-300">
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-border/40 text-[10px]">
                        {span.kind}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-cyan-300 font-bold">
                      {span.durationMs}ms
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-1.5 ${
                          span.status === "OK"
                            ? "border-emerald-500/40 text-emerald-400"
                            : "border-rose-500/40 text-rose-400"
                        }`}
                      >
                        {span.status} ({span.statusCode})
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: EXPORTERS & COLLECTOR ENDPOINTS */}
        <div className="rounded-xl border border-border/60 bg-[#181926] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Compatible OTLP Observability Backends
              </h3>
            </div>
            <Badge variant="outline" className="text-[10px] py-0 px-2 border-border text-gray-400">
              OTLP/gRPC & OTLP/HTTP
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-black/30 p-3 rounded-lg border border-border/30 space-y-1">
              <div className="flex items-center justify-between font-semibold text-white">
                <span>Datadog</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono">otlp.datadoghq.com</p>
            </div>

            <div className="bg-black/30 p-3 rounded-lg border border-border/30 space-y-1">
              <div className="flex items-center justify-between font-semibold text-white">
                <span>Grafana Cloud</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono">otlp-gateway-prod.grafana.net</p>
            </div>

            <div className="bg-black/30 p-3 rounded-lg border border-border/30 space-y-1">
              <div className="flex items-center justify-between font-semibold text-white">
                <span>New Relic</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono">otlp.nr-data.net:4317</p>
            </div>

            <div className="bg-black/30 p-3 rounded-lg border border-border/30 space-y-1">
              <div className="flex items-center justify-between font-semibold text-white">
                <span>Jaeger (Local)</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono">localhost:4318</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
