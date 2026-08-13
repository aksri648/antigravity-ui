import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  RotateCw,
  ExternalLink,
  Code,
  Terminal,
  Globe,
  MonitorCheck,
  FileCode,
  Save,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  ChevronRight,
  Folder,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FileTree } from "./FileTree";
import type { FileNode } from "./FileTree";

interface PreviewPaneProps {
  sandboxId?: string;
  apiKey?: string;
  previewUrl: string | null;
  activePort: number;
  terminalLogs: string[];
  onPortChange: (port: number) => void;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  sandboxId = "sb-daytona-demo",
  apiKey = "",
  previewUrl,
  activePort,
  terminalLogs,
  onPortChange,
}) => {
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "terminal">("preview");
  const [iframeKey, setIframeKey] = useState(0);

  // VS Code Code View State (Strictly loaded from Daytona Sandbox)
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Live Terminal Logs State
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Daytona Sandbox Preview URL (https://<sandboxId>-<port>.daytona.app)
  const daytonaPreviewUrl = previewUrl || `https://${sandboxId}-${activePort}.daytona.app`;

  // Fetch Directory File Tree from Daytona Sandbox
  useEffect(() => {
    if (activeTab === "code" && sandboxId && apiKey) {
      fetchFileTree();
    }
  }, [sandboxId, apiKey, activeTab]);

  const fetchFileTree = async () => {
    if (!sandboxId || !apiKey) return;
    try {
      const res = await fetch(`http://localhost:8080/api/workspace/files?sandboxId=${sandboxId}&apiKey=${apiKey}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setFileTree(data);
        // If tabs are empty and files exist, open first file
        if (openTabs.length === 0 && data.length > 0) {
          const findFirstFile = (nodes: FileNode[]): string | null => {
            for (const n of nodes) {
              if (!n.isDir) return n.path;
              if (n.children) {
                const f = findFirstFile(n.children);
                if (f) return f;
              }
            }
            return null;
          };
          const first = findFirstFile(data);
          if (first) {
            setOpenTabs([first]);
            setSelectedFile(first);
          }
        }
      }
    } catch (e) {
      setFileTree([]);
    }
  };

  // Fetch Selected File Content from Daytona Sandbox
  useEffect(() => {
    if (activeTab === "code" && selectedFile && sandboxId && apiKey) {
      fetchSandboxFile(selectedFile);
    }
  }, [selectedFile, activeTab, sandboxId, apiKey]);

  const fetchSandboxFile = async (path: string) => {
    if (!path || !sandboxId || !apiKey) return;
    setLoadingFile(true);
    try {
      const res = await fetch(`http://localhost:8080/api/workspace/file-content?sandboxId=${sandboxId}&path=${path}&apiKey=${apiKey}`);
      const data = await res.json();
      if (data.content !== undefined) {
        setFileContent(data.content);
      } else {
        setFileContent(`// ${path}\n// File content in Daytona Sandbox`);
      }
    } catch (e) {
      setFileContent(`// Failed to fetch ${path} from Daytona Sandbox`);
    } finally {
      setLoadingFile(false);
    }
  };

  // Handle Opening File Tabs
  const handleSelectFile = (path: string) => {
    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
    setSelectedFile(path);
  };

  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const filtered = openTabs.filter((t) => t !== path);
    setOpenTabs(filtered);
    if (selectedFile === path && filtered.length > 0) {
      setSelectedFile(filtered[filtered.length - 1]);
    }
  };

  // Save Code Edits Back to Daytona Sandbox
  const handleSaveFile = async () => {
    setSavingFile(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("http://localhost:8080/api/workspace/file-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          sandboxId,
          path: selectedFile,
          content: fileContent,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save file in Daytona", e);
    } finally {
      setSavingFile(false);
    }
  };

  const handleRefreshPreview = () => {
    setIframeKey((prev) => prev + 1);
  };

  // Detect editor language from extension
  const getLanguage = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext === "tsx" || ext === "ts") return "typescript";
    if (ext === "jsx" || ext === "js") return "javascript";
    if (ext === "json") return "json";
    if (ext === "html") return "html";
    if (ext === "css") return "css";
    if (ext === "md" || ext === "mdx") return "markdown";
    return "plaintext";
  };

  // ===== LIVE TERMINAL LOGS =====
  // Combine WebSocket logs with polled sandbox logs
  const allLogs = [...terminalLogs, ...liveLogs];

  // Poll live logs from Daytona sandbox
  const fetchLiveLogs = useCallback(async () => {
    if (!sandboxId || !apiKey) return;
    setFetchingLogs(true);
    try {
      const res = await fetch(
        `http://localhost:8080/api/workspace/logs?sandboxId=${sandboxId}&apiKey=${apiKey}`
      );
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        const cleaned = data.logs.filter((l: string) => !l.includes('"statusCode":404') && !l.includes('Cannot POST'));
        setLiveLogs(cleaned);
      }
    } catch (e) {
      // Silently fail — will retry on next poll
    } finally {
      setFetchingLogs(false);
    }
  }, [sandboxId, apiKey]);

  // Auto-poll when terminal tab is active
  useEffect(() => {
    if (activeTab !== "terminal") return;

    // Fetch immediately
    fetchLiveLogs();

    // Poll every 5 seconds
    const interval = setInterval(fetchLiveLogs, 5000);
    return () => clearInterval(interval);
  }, [activeTab, fetchLiveLogs]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allLogs]);

  // Placeholder HTML for when no Daytona preview URL is available yet
  const placeholderHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6 font-sans">
        <div class="max-w-lg w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center space-y-4">
          <div class="inline-flex p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h2 class="text-xl font-bold text-white">Waiting for Daytona Sandbox</h2>
          <p class="text-xs text-slate-400 leading-relaxed">
            Submit a prompt to start a dev server inside Daytona sandbox <span class="font-mono text-emerald-400">${sandboxId}</span>
          </p>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-left font-mono text-xs space-y-2 text-slate-300">
            <div class="flex justify-between"><span class="text-slate-500">Sandbox ID:</span><span class="text-blue-400 truncate">${sandboxId}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Target Port:</span><span class="text-emerald-400 font-semibold">:${activePort}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Status:</span><span class="text-amber-400">Waiting for dev server...</span></div>
          </div>
        </div>
      </body>
    </html>
  `;

  return (
    <div className="flex h-full flex-col bg-card/40">
      {/* 70% Right Pane Top Navigation Toolbar */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between bg-card/90">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1">
          <Button
            variant={activeTab === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("preview")}
            className="h-7 text-xs gap-1.5 px-2.5 font-medium"
          >
            <Globe className="h-3.5 w-3.5 text-blue-400" /> Live Preview
          </Button>
          <Button
            variant={activeTab === "code" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("code")}
            className="h-7 text-xs gap-1.5 px-2.5 font-medium"
          >
            <Code className="h-3.5 w-3.5 text-emerald-400" /> VS Code IDE
          </Button>
          <Button
            variant={activeTab === "terminal" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("terminal")}
            className="h-7 text-xs gap-1.5 px-2.5 font-medium"
          >
            <Terminal className="h-3.5 w-3.5 text-amber-400" /> Daytona Terminal
          </Button>
        </div>

        {/* Address Bar & Sandbox Port Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground text-[11px]">Port:</span>
            <select
              value={activePort}
              onChange={(e) => onPortChange(Number(e.target.value))}
              className="bg-black/60 border border-border text-white text-xs rounded px-1.5 py-0.5 font-mono focus:outline-none"
            >
              <option value={3000}>:3000 (React/Next)</option>
              <option value={5173}>:5173 (Vite)</option>
              <option value={8080}>:8080 (Backend)</option>
            </select>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshPreview}
            className="h-7 w-7 text-muted-foreground hover:text-white"
            title="Refresh Daytona Preview"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>

          <a
            href={daytonaPreviewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-black/40 px-2 text-[11px] text-muted-foreground hover:text-white hover:bg-accent font-mono"
            title="Open Daytona preview URL in new tab"
          >
            <ExternalLink className="h-3 w-3 text-blue-400" /> Open External
          </a>
        </div>
      </div>

      {/* Main Right Pane Content */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* MODE 1: DAYTONA SANDBOX LIVE PREVIEW */}
        {activeTab === "preview" && (
          <div className="h-full w-full flex flex-col bg-black">
            {/* Live Daytona URL Bar */}
            <div className="h-8 bg-[#1a1a2e] border-b border-border/60 px-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <div className="flex items-center gap-2 overflow-hidden text-ellipsis flex-1 min-w-0">
                <span className={`h-2 w-2 rounded-full shrink-0 ${previewUrl ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                <div className="flex items-center gap-1.5 bg-black/40 rounded px-2 py-0.5 flex-1 min-w-0 border border-border/40">
                  <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-gray-300 truncate">{daytonaPreviewUrl}</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400 ml-2 shrink-0">
                <MonitorCheck className="h-3 w-3 mr-1" /> Port :{activePort}
              </Badge>
            </div>

            {/* Live Sandbox Preview Iframe */}
            <div className="flex-1 w-full relative">
              {previewUrl ? (
                <iframe
                  key={iframeKey}
                  src={daytonaPreviewUrl}
                  className="h-full w-full border-0"
                  title="Daytona Sandbox Live Application Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              ) : (
                <iframe
                  key={`placeholder-${iframeKey}`}
                  srcDoc={placeholderHtml}
                  className="h-full w-full border-0"
                  title="Waiting for Daytona Preview"
                />
              )}
            </div>
          </div>
        )}

        {/* MODE 2: VS CODE-LIKE IDE CODE EDITOR */}
        {activeTab === "code" && (
          <div className="h-full w-full flex bg-[#1e1e1e] text-gray-300">
            {/* VS Code Left Nested File Explorer Sidebar */}
            <div className="w-60 border-r border-[#333333] bg-[#252526] flex flex-col shrink-0">
              <div className="h-[35px] px-4 text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb] border-b border-[#333333] flex items-center justify-between">
                <span>Explorer</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchFileTree}
                  className="h-5 w-5 text-[#bbbbbb] hover:text-white"
                  title="Reload File Tree from Daytona Sandbox"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>

              {/* Project Root Label */}
              <div className="h-[22px] px-2 flex items-center text-[11px] font-bold text-[#cccccc] bg-[#2d2d2d] border-b border-[#333333] uppercase tracking-wider">
                <Folder className="h-3 w-3 text-[#dcb67a] mr-1.5 shrink-0" />
                <span className="truncate">Sandbox: {sandboxId?.substring(0, 20)}</span>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden py-0.5">
                {fileTree.length === 0 ? (
                  <div className="p-4 text-center text-[#888] space-y-1.5 font-sans">
                    <p className="text-xs font-semibold text-[#bbb]">Sandbox Empty</p>
                    <p className="text-[11px] text-[#777] leading-relaxed">
                      No files found in Daytona Sandbox. Submit a prompt to create code.
                    </p>
                  </div>
                ) : (
                  <FileTree
                    nodes={fileTree}
                    selectedPath={selectedFile}
                    onSelectFile={handleSelectFile}
                  />
                )}
              </div>
            </div>

            {/* VS Code Main Editor Area */}
            <div className="flex-1 flex flex-col bg-[#1e1e1e] min-w-0">
              {/* File Tab Bar & Save Button */}
              <div className="h-[35px] bg-[#252526] border-b border-[#333333] flex items-center justify-between px-0 overflow-x-auto">
                {/* File Tabs */}
                <div className="flex items-center overflow-x-auto h-full">
                  {openTabs.map((tabPath) => (
                    <div
                      key={tabPath}
                      onClick={() => setSelectedFile(tabPath)}
                      className={`group flex items-center gap-1.5 px-3 h-full text-[13px] font-sans cursor-pointer select-none border-r border-[#252526] transition-colors ${
                        selectedFile === tabPath
                          ? "bg-[#1e1e1e] text-white border-t-2 border-t-[#0078d4]"
                          : "bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d] border-t-2 border-t-transparent"
                      }`}
                    >
                      <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span className="truncate max-w-[120px] text-[13px]">{tabPath.split("/").pop()}</span>
                      {openTabs.length > 1 && (
                        <button
                          onClick={(e) => handleCloseTab(e, tabPath)}
                          className="h-4 w-4 rounded hover:bg-white/10 flex items-center justify-center text-[#969696] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {openTabs.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleSaveFile}
                    disabled={savingFile}
                    className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium shrink-0 mx-2"
                  >
                    {savingFile ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : saveSuccess ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {saveSuccess ? "Saved!" : "Save"}
                  </Button>
                )}
              </div>

              {/* Breadcrumb Path */}
              {selectedFile && (
                <div className="h-[22px] bg-[#1e1e1e] border-b border-[#333333] px-3 flex items-center text-[11px] text-[#969696] font-mono">
                  {selectedFile.split("/").map((part, i, arr) => (
                    <React.Fragment key={i}>
                      <span className={i === arr.length - 1 ? "text-[#cccccc]" : ""}>{part}</span>
                      {i < arr.length - 1 && <ChevronRight className="h-3 w-3 mx-0.5 text-[#666666]" />}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Monaco Editor Container */}
              <div className="flex-1 relative">
                {loadingFile ? (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Loading file from Daytona sandbox...
                  </div>
                ) : !selectedFile || openTabs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-xs text-[#888] space-y-3 p-6">
                    <Code className="h-10 w-10 text-[#444]" />
                    <div>
                      <p className="font-semibold text-sm text-[#ccc]">VS Code Daytona Editor</p>
                      <p className="text-xs text-[#777] max-w-sm mt-1 leading-relaxed">
                        Files generated in your Daytona sandbox will appear here. Select a file from the explorer on the left or prompt the AGY assistant to create files.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    path={selectedFile}
                    language={getLanguage(selectedFile)}
                    value={fileContent}
                    onChange={(val) => setFileContent(val || "")}
                    options={{
                      fontSize: 13,
                      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
                      fontLigatures: true,
                      minimap: { enabled: true, maxColumn: 80, renderCharacters: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbers: "on",
                      renderLineHighlight: "line",
                      bracketPairColorization: { enabled: true },
                      cursorBlinking: "smooth",
                      smoothScrolling: true,
                      padding: { top: 8 },
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: REAL DAYTONA SANDBOX TERMINAL LOGS */}
        {activeTab === "terminal" && (
          <div className="h-full w-full flex flex-col bg-[#1e1e1e]">
            {/* Terminal Header */}
            <div className="h-[35px] bg-[#252526] border-b border-[#333333] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-[#cccccc]">
                <Terminal className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-semibold">Terminal</span>
                <span className="text-[#969696]">—</span>
                <span className="text-[#969696] font-mono">bash · {sandboxId}</span>
                {fetchingLogs && (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-400 ml-1" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400"
                >
                  Live
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchLiveLogs}
                  className="h-6 w-6 text-[#969696] hover:text-white"
                  title="Refresh logs"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Terminal Output */}
            <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[13px] text-[#cccccc] leading-[1.6]">
              {allLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#969696] text-center space-y-3">
                  <Terminal className="h-8 w-8 text-[#555]" />
                  <div>
                    <p className="text-[13px] font-medium text-[#cccccc]">No logs yet</p>
                    <p className="text-[11px] mt-1">
                      Submit a prompt to start streaming real terminal output from your Daytona sandbox.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {allLogs.map((log, idx) => {
                    // Color-code log lines
                    let textColor = "text-[#cccccc]";
                    const logLower = log.toLowerCase();
                    if (logLower.includes("[error]") || logLower.includes("error") || logLower.includes("fail")) {
                      textColor = "text-red-400";
                    } else if (logLower.includes("[warning]") || logLower.includes("warn")) {
                      textColor = "text-amber-400";
                    } else if (logLower.includes("[thought]") || logLower.includes("thought")) {
                      textColor = "text-purple-400";
                    } else if (logLower.includes("[done]") || logLower.includes("success") || logLower.includes("✓")) {
                      textColor = "text-emerald-400";
                    } else if (logLower.includes("[token]")) {
                      textColor = "text-gray-300";
                    } else if (log.startsWith("$") || log.startsWith("#")) {
                      textColor = "text-cyan-400";
                    }

                    return (
                      <div key={idx} className={`${textColor} whitespace-pre-wrap break-all`}>
                        <span className="text-[#555] select-none mr-3 inline-block w-[32px] text-right text-[11px]">
                          {idx + 1}
                        </span>
                        {log}
                      </div>
                    );
                  })}
                  <div ref={terminalEndRef} />
                </>
              )}
            </div>

            {/* Terminal Status Bar */}
            <div className="h-[22px] bg-[#007acc] px-3 flex items-center justify-between text-[11px] text-white">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                Daytona Sandbox: {sandboxId}
              </span>
              <span className="font-mono">{allLogs.length} lines</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
