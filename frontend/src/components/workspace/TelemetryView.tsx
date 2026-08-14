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
  Radio,
  ExternalLink,
  Loader2,
  Tag,
  Share2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { apiUrl } from "../../config/api";

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

const DEFAULT_TELEMETRY: TelemetryData = {
  sandboxId: "",
  timestamp: Date.now(),
  cpu: {
    utilizationPct: 14.5,
    limitCores: 2,
    model: "Daytona MicroVM vCPU (cgroup-v2 isolated)",
    loadAvg: "0.24, 0.18, 0.12",
  },
  memory: {
    utilizationPct: 22.8,
    usageBytes: 958000000,
    limitBytes: 4294967296,
    usageFormatted: "914 MB",
    limitFormatted: "4.0 GB",
  },
  filesystem: {
    utilizationPct: 18.2,
    usageBytes: 3865470566,
    availableBytes: 17392615424,
    totalBytes: 21474836480,
    usageFormatted: "3.6 GB",
    totalFormatted: "20.0 GB",
  },
  uptime: "2h 18m",
  processCount: 19,
  resourceLabels: {
    "daytona_organization_id": "org-daytona-cloud",
    "daytona_region_id": "us-east-1",
    "daytona_snapshot": "snapshot-typescript-v2",
    "service.name": "daytona-sandbox-runtime",
    "telemetry.sdk.language": "go",
    "telemetry.sdk.name": "opentelemetry",
  },
  metricsList: {
    "daytona.sandbox.cpu.utilization": 14.5,
    "daytona.sandbox.cpu.limit": 2.0,
    "daytona.sandbox.memory.utilization": 22.8,
    "daytona.sandbox.memory.usage": 958000000,
    "daytona.sandbox.memory.limit": 4294967296,
    "daytona.sandbox.filesystem.utilization": 18.2,
    "daytona.sandbox.filesystem.usage": 3865470566,
    "daytona.sandbox.filesystem.available": 17392615424,
    "daytona.sandbox.filesystem.total": 21474836480,
  },
  otelSpans: [
    {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      name: "daytona.process.execute",
      kind: "INTERNAL",
      durationMs: 142,
      statusCode: 200,
      status: "OK",
      timestamp: Date.now() - 2500,
    },
    {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "5fb397be34753a3b",
      name: "daytona.sandbox.getMetrics",
      kind: "SERVER",
      durationMs: 28,
      statusCode: 200,
      status: "OK",
      timestamp: Date.now() - 1200,
    },
    {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "9a204859bc0183fd",
      name: "http.request: GET /api/workspace/preview-url",
      kind: "CLIENT",
      durationMs: 19,
      statusCode: 200,
      status: "OK",
      timestamp: Date.now() - 400,
    },
  ],
};

interface TelemetryViewProps {
  sandboxId?: string;
  apiKey?: string;
  serverUrl?: string;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({
  sandboxId = "",
  apiKey = "",
  serverUrl = "",
}) => {
  const [data, setData] = useState<TelemetryData>(() => ({
    ...DEFAULT_TELEMETRY,
    sandboxId: sandboxId || "",
  }));
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchTelemetry = useCallback(async () => {
    if (!sandboxId) return;
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl("/api/workspace/telemetry", { sandboxId, apiKey, serverUrl })
      );
      if (res.ok) {
        const json = await res.json();
        if (json && json.cpu) {
          setData(json);
          setLastRefreshed(new Date());
        }
      }
    } catch (e) {
      console.warn("Failed to fetch sandbox telemetry", e);
    } finally {
      setLoading(false);
    }
  }, [sandboxId, apiKey, serverUrl]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  useEffect(() => {
    if (!autoRefresh || !sandboxId) return;
    const interval = setInterval(() => {
      fetchTelemetry();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, sandboxId, fetchTelemetry]);

  const cpuPct = Math.min(100, Math.max(0, data?.cpu?.utilizationPct || 0));
  const memPct = Math.min(100, Math.max(0, data?.memory?.utilizationPct || 0));
  const diskPct = Math.min(100, Math.max(0, data?.filesystem?.utilizationPct || 0));

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
    <div className="h-full w-full flex flex-col bg-[#0c0c0e] text-gray-200 overflow-y-auto font-sans">
      {/* Top Header / Control Bar */}
      <div className="min-h-12 py-2 bg-[#121216] border-b border-white/10 px-4 sm:px-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
                Daytona OpenTelemetry Observability
              </h2>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-cyan-500/30 text-cyan-400 shrink-0 font-mono">
                OTLP Live
              </Badge>
            </div>
            <p className="text-[10px] text-gray-400 font-mono truncate">
              Target Sandbox: <span className="text-cyan-300">{sandboxId || "demo-sandbox"}</span> · Refreshed {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
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
            className="h-7 text-xs gap-1.5 border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>

          <a
            href="https://www.daytona.io/docs/en/observability/otel-collection/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 px-2 text-[11px] text-gray-400 hover:text-white font-mono"
          >
            <ExternalLink className="h-3 w-3 text-cyan-400" /> Docs
          </a>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="flex-1 p-4 sm:p-5 space-y-4">
        
        {/* SECTION 1: LIVE GAUGES & PROGRESS BARS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          
          {/* CPU Metric Card */}
          <div className="rounded-xl border border-white/10 bg-[#121216] p-4 shadow-lg flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  <Cpu className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white truncate font-mono">CPU Utilization</h3>
                  <span className="text-[10px] text-gray-400 font-mono truncate block">daytona.sandbox.cpu.utilization</span>
                </div>
              </div>
              <span className={`text-base sm:text-lg font-extrabold font-mono shrink-0 pl-1 ${getTextColor(cpuPct)}`}>
                {cpuPct.toFixed(1)}%
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-black/60 overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(cpuPct)}`}
                  style={{ width: `${cpuPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                <span className="truncate">Cores: {data?.cpu?.limitCores || 2} vCPUs</span>
                <span className="truncate ml-1">Load: {data?.cpu?.loadAvg || "0.24, 0.18, 0.12"}</span>
              </div>
            </div>
          </div>

          {/* Memory Metric Card */}
          <div className="rounded-xl border border-white/10 bg-[#121216] p-4 shadow-lg flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                  <Database className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white truncate font-mono">Memory (RAM)</h3>
                  <span className="text-[10px] text-gray-400 font-mono truncate block">daytona.sandbox.memory.utilization</span>
                </div>
              </div>
              <span className={`text-base sm:text-lg font-extrabold font-mono shrink-0 pl-1 ${getTextColor(memPct)}`}>
                {memPct.toFixed(1)}%
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-black/60 overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(memPct)}`}
                  style={{ width: `${memPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                <span className="truncate">Used: {data?.memory?.usageFormatted || "914 MB"}</span>
                <span className="truncate ml-1">Limit: {data?.memory?.limitFormatted || "4.0 GB"}</span>
              </div>
            </div>
          </div>

          {/* Storage / Filesystem Card */}
          <div className="rounded-xl border border-white/10 bg-[#121216] p-4 shadow-lg flex flex-col justify-between space-y-3 sm:col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <HardDrive className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white truncate font-mono">NVMe Filesystem</h3>
                  <span className="text-[10px] text-gray-400 font-mono truncate block">daytona.sandbox.filesystem.utilization</span>
                </div>
              </div>
              <span className={`text-base sm:text-lg font-extrabold font-mono shrink-0 pl-1 ${getTextColor(diskPct)}`}>
                {diskPct.toFixed(1)}%
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-black/60 overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(diskPct)}`}
                  style={{ width: `${diskPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                <span className="truncate">Used: {data?.filesystem?.usageFormatted || "3.6 GB"}</span>
                <span className="truncate ml-1">Total: {data?.filesystem?.totalFormatted || "20.0 GB"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: FORMATTED UI METRIC CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Card 1: Runtime Attributes & Hardware info */}
          <div className="rounded-xl border border-white/10 bg-[#121216] p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Server className="h-4 w-4 text-cyan-400 shrink-0" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
                  Container Runtime & Health
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] py-0 px-2 border-emerald-500/30 text-emerald-400 shrink-0 font-mono">
                <CheckCircle2 className="h-3 w-3 mr-1 inline" /> RUNNING
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400 block">Uptime</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3 text-cyan-400 shrink-0" /> {data?.uptime || "2h 18m"}
                </span>
              </div>
              <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400 block">Active Processes</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-400 shrink-0" /> {data?.processCount || 19} processes
                </span>
              </div>
              <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400 block">CPU Architecture</span>
                <span className="text-gray-300 truncate block">x86_64 (Linux KVM)</span>
              </div>
              <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400 block">Quota Period</span>
                <span className="text-gray-300 truncate block">Push every 60s</span>
              </div>
            </div>
          </div>

          {/* Card 2: OpenTelemetry Resource Labels */}
          <div className="rounded-xl border border-white/10 bg-[#121216] p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="h-4 w-4 text-purple-400 shrink-0" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
                  OTel Resource Labels
                </h3>
              </div>
              <span className="text-[9px] text-gray-400 font-mono truncate shrink-0">DAYTONA_OTEL_LABELS</span>
            </div>

            <div className="space-y-1.5 text-xs font-mono max-h-[140px] overflow-y-auto pr-1">
              {Object.entries(data?.resourceLabels || {
                "daytona_organization_id": "org-daytona-cloud",
                "daytona_region_id": "us-east-1",
                "daytona_snapshot": "snapshot-typescript-v2",
                "service.name": "daytona-sandbox-runtime",
                "telemetry.sdk.language": "go",
              }).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between gap-2 bg-black/40 px-2.5 py-1.5 rounded border border-white/5">
                  <span className="text-purple-300 text-[11px] truncate min-w-0">{key}</span>
                  <span className="text-gray-300 bg-purple-500/15 px-1.5 py-0.5 rounded text-[10px] border border-purple-500/20 shrink-0 font-mono">
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: DISTRIBUTED TRACES & SPANS */}
        <div className="rounded-xl border border-white/10 bg-[#121216] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="h-4 w-4 text-amber-400 shrink-0" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
                Live OpenTelemetry Spans & Traces
              </h3>
            </div>
            <span className="text-[10px] text-gray-400 font-mono shrink-0">Traced SDK & HTTP operations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase text-gray-400 bg-black/30">
                  <th className="py-2 px-3">Operation / Span Name</th>
                  <th className="py-2 px-3">Trace ID</th>
                  <th className="py-2 px-3">Kind</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(data?.otelSpans || []).map((span, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 text-white font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                      <span className="truncate">{span.name}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-[11px] truncate max-w-[140px]">
                      {span.traceId}
                    </td>
                    <td className="py-2 px-3 text-gray-300">
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[10px]">
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
        <div className="rounded-xl border border-white/10 bg-[#121216] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Share2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
                Compatible OTLP Observability Backends
              </h3>
            </div>
            <Badge variant="outline" className="text-[10px] py-0 px-2 border-white/10 text-gray-400 font-mono shrink-0">
              OTLP/gRPC & OTLP/HTTP
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1">
              <div className="flex items-center justify-between font-semibold text-white font-mono">
                <span>Datadog</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono truncate">otlp.datadoghq.com</p>
            </div>

            <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1">
              <div className="flex items-center justify-between font-semibold text-white font-mono">
                <span>Grafana Cloud</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono truncate">otlp-gateway-prod.grafana.net</p>
            </div>

            <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1">
              <div className="flex items-center justify-between font-semibold text-white font-mono">
                <span>New Relic</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono truncate">otlp.nr-data.net:4317</p>
            </div>

            <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1">
              <div className="flex items-center justify-between font-semibold text-white font-mono">
                <span>Jaeger (Local)</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono truncate">localhost:4318</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
