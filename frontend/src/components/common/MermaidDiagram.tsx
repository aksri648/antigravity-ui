import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Check,
  Copy,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Move,
} from "lucide-react";

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
        useMaxWidth: false,
        padding: 16,
        nodeSpacing: 40,
        rankSpacing: 40,
      },
      sequence: {
        useMaxWidth: false,
        actorFontSize: 13,
        noteFontSize: 12,
        messageFontSize: 12,
      },
      er: {
        useMaxWidth: false,
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Zoom & Pan state
  const [scale, setScale] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.4));
  };

  const handleResetZoom = () => {
    setScale(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Wheel zoom with Ctrl or inside viewport
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.1 : -0.1;
      setScale((prev) => Math.min(Math.max(prev + zoomFactor, 0.4), 3.5));
    }
  };

  return (
    <div
      className={`w-full rounded-2xl border border-white/10 bg-[#0f0f13] overflow-hidden shadow-2xl transition-all ${
        isFullscreen
          ? "fixed inset-4 sm:inset-10 z-[100] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.9)] bg-[#0b0b0e]"
          : className
      }`}
    >
      {/* Header bar with Zoom controls, Title, and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#141419] border-b border-white/10 text-xs text-gray-400 font-mono">
        {/* Left: Window Dots & Title */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex gap-1.5 flex-shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60 inline-block" />
          </div>
          {title && (
            <span className="font-semibold text-gray-200 truncate ml-1 text-[11px] sm:text-xs">
              {title}
            </span>
          )}
        </div>

        {/* Right: Zoom + Pan Controls & Action Buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Zoom Controls Pill */}
          <div className="flex items-center bg-black/60 border border-white/15 rounded-lg p-0.5 text-xs text-gray-300">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.4}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 h-6 flex items-center justify-center text-[10px] font-mono font-bold text-emerald-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="Reset Zoom to 100%"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 3.5}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            {(scale !== 1.0 || pan.x !== 0 || pan.y !== 0) && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer ml-0.5 border-l border-white/10 pl-1"
                title="Reset View"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Source Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 h-7 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-[11px] transition-colors cursor-pointer"
            title="Copy Mermaid source"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" /> <span className="text-emerald-400 hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> <span className="hidden sm:inline">Source</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Diagram Render & Interactive Pan/Zoom Canvas */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        className={`relative flex-1 p-4 sm:p-6 overflow-hidden flex items-center justify-center min-h-[220px] select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${isFullscreen ? "h-[calc(100%-48px)]" : ""}`}
      >
        {/* Subtle grid backdrop for interactive canvas feel */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Floating Pan Hint */}
        {scale > 1.0 && !isDragging && (
          <div className="absolute bottom-2 right-2 z-10 px-2 py-1 rounded bg-black/70 border border-white/10 text-[10px] text-gray-400 font-mono flex items-center gap-1 pointer-events-none">
            <Move className="h-2.5 w-2.5 text-emerald-400" /> Drag to pan
          </div>
        )}

        {error ? (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Diagram error: {error}</span>
          </div>
        ) : svgContent ? (
          <div
            ref={containerRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
            className="w-full flex justify-center items-center [&>svg]:max-w-none [&>svg]:h-auto [&>svg]:mx-auto"
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
