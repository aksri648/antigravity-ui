import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, AlertCircle } from "lucide-react";

interface MermaidDiagramProps {
  chart: string;
  id?: string;
  title?: string;
  className?: string;
}

let mermaidInstance: any = null;
let isInitialized = false;

async function getMermaid() {
  if (mermaidInstance) return mermaidInstance;
  try {
    const mod = await import("mermaid");
    mermaidInstance = mod.default || mod;
  } catch (err) {
    console.warn("Failed to import mermaid locally, trying browser global", err);
    if (typeof window !== "undefined" && (window as any).mermaid) {
      mermaidInstance = (window as any).mermaid;
    } else {
      // Dynamic ESM loader via Function constructor to avoid TS URL import complaints
      const importDynamic = new Function("moduleUrl", "return import(moduleUrl)");
      const cdnMod = await importDynamic("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs");
      mermaidInstance = cdnMod.default || cdnMod;
    }
  }

  if (mermaidInstance && !isInitialized) {
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
      themeVariables: {
        darkMode: true,
        background: "#0c0c0e",
        primaryColor: "#10b981",
        primaryTextColor: "#ffffff",
        primaryBorderColor: "#34d399",
        lineColor: "#10b981",
        secondaryColor: "#06b6d4",
        tertiaryColor: "#8b5cf6",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "13px",
      },
      flowchart: {
        htmlLabels: true,
        curve: "basis",
        useMaxWidth: true,
        padding: 16,
        nodeSpacing: 40,
        rankSpacing: 40,
      },
      sequence: {
        useMaxWidth: true,
        actorFontSize: 13,
        noteFontSize: 12,
        messageFontSize: 12,
      },
      er: {
        useMaxWidth: true,
        fontSize: 12,
      },
    });
    isInitialized = true;
  }
  return mermaidInstance;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  id = `mermaid-${Math.random().toString(36).substring(2, 9)}`,
  title,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      if (!chart.trim()) return;
      try {
        setError(null);
        const m = await getMermaid();
        if (!m) throw new Error("Mermaid engine unavailable");

        const renderId = `${id.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}`;
        const { svg } = await m.render(renderId, chart);
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error("Mermaid Render Error:", err);
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`w-full rounded-2xl border border-white/10 bg-[#0f0f13] overflow-hidden shadow-2xl ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#141419] border-b border-white/10 text-xs text-gray-400 font-mono">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60 inline-block" />
          </div>
          {title && <span className="font-semibold text-gray-200 ml-1">{title}</span>}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] transition-colors cursor-pointer"
          title="Copy Mermaid source"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" /> <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> <span>Source</span>
            </>
          )}
        </button>
      </div>

      {/* Diagram Render Area */}
      <div className="p-4 sm:p-6 overflow-x-auto flex items-center justify-center min-h-[160px]">
        {error ? (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Diagram error: {error}</span>
          </div>
        ) : svgContent ? (
          <div
            ref={containerRef}
            className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="text-xs font-mono text-gray-500 animate-pulse">
            Rendering architectural diagram...
          </div>
        )}
      </div>
    </div>
  );
};
