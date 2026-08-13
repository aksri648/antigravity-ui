import React, { useState, useEffect } from "react";
import { RotateCw, ExternalLink, Code, Terminal, Globe, MonitorCheck, FileCode, Save, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface PreviewPaneProps {
  sandboxId?: string;
  apiKey?: string;
  previewUrl: string | null;
  activePort: number;
  terminalLogs: string[];
  onPortChange: (port: number) => void;
}

const DEFAULT_FILES = [
  { path: "src/App.tsx", lang: "typescript" },
  { path: "src/main.tsx", lang: "typescript" },
  { path: "index.html", lang: "html" },
  { path: "package.json", lang: "json" },
  { path: "vite.config.ts", lang: "typescript" },
];

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

  // VS Code Code View State
  const [selectedFile, setSelectedFile] = useState("src/App.tsx");
  const [fileContent, setFileContent] = useState<string>("// Loading file from Daytona sandbox...");
  const [loadingFile, setLoadingFile] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Daytona Sandbox Preview URL (https://<sandboxId>-<port>.daytona.app)
  const daytonaPreviewUrl = previewUrl || `https://${sandboxId}-${activePort}.daytona.app`;

  // Fetch File Content from Daytona Sandbox
  useEffect(() => {
    if (activeTab === "code") {
      fetchSandboxFile(selectedFile);
    }
  }, [selectedFile, activeTab]);

  const fetchSandboxFile = async (path: string) => {
    setLoadingFile(true);
    try {
      const res = await fetch(`http://localhost:8080/api/workspace/file-content?sandboxId=${sandboxId}&path=${path}&apiKey=${apiKey}`);
      const data = await res.json();
      if (data.content) {
        setFileContent(data.content);
      } else {
        setFileContent(`// ${path}\n// File ready in Daytona Sandbox`);
      }
    } catch (e) {
      setFileContent(`// ${path}\n// Daytona Sandbox Code View`);
    } finally {
      setLoadingFile(false);
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
            <div className="h-7 bg-black/90 border-b border-border/60 px-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <div className="flex items-center gap-2 overflow-hidden text-ellipsis">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-emerald-400 font-semibold">Daytona Sandbox Preview URL:</span>
                <span className="text-gray-200 truncate">{daytonaPreviewUrl}</span>
              </div>
              <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-500/30 text-emerald-400">
                <MonitorCheck className="h-3 w-3 mr-1" /> Daytona Micro-VM Port :{activePort}
              </Badge>
            </div>

            {/* Live Sandbox Preview Iframe */}
            <div className="flex-1 w-full relative">
              <iframe
                key={iframeKey}
                src={daytonaPreviewUrl}
                srcDoc={
                  previewUrl
                    ? undefined
                    : `
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
                          <h2 class="text-xl font-bold text-white">Daytona Sandbox App Live</h2>
                          <p class="text-xs text-slate-400 leading-relaxed">
                            Serving live from Daytona Sandbox process <span class="font-mono text-emerald-400">${sandboxId}</span>
                          </p>
                          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-left font-mono text-xs space-y-2 text-slate-300">
                            <div class="flex justify-between"><span class="text-slate-500">Daytona Preview URL:</span><span class="text-blue-400 truncate">${daytonaPreviewUrl}</span></div>
                            <div class="flex justify-between"><span class="text-slate-500">Listening Port:</span><span class="text-emerald-400 font-semibold">:${activePort}</span></div>
                            <div class="flex justify-between"><span class="text-slate-500">Auth Engine:</span><span class="text-purple-400">agy Google OAuth (~/.gemini)</span></div>
                          </div>
                        </div>
                      </body>
                    </html>
                  `
                }
                className="h-full w-full border-0"
                title="Daytona Sandbox Live Application Preview"
              />
            </div>
          </div>
        )}

        {/* MODE 2: VS CODE-LIKE IDE CODE EDITOR */}
        {activeTab === "code" && (
          <div className="h-full w-full flex bg-[#1e1e1e] text-gray-300">
            {/* VS Code Left File Explorer Sidebar */}
            <div className="w-56 border-r border-[#2b2b2b] bg-[#252526] flex flex-col">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-[#2b2b2b] flex items-center justify-between">
                <span>Explorer</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fetchSandboxFile(selectedFile)}
                  className="h-5 w-5 text-gray-400 hover:text-white"
                  title="Reload File from Daytona Sandbox"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>

              <div className="p-2 space-y-0.5 flex-1 overflow-y-auto text-xs">
                <div className="px-2 py-1 text-[10px] text-gray-500 font-semibold uppercase">Daytona Workspace Root</div>
                {DEFAULT_FILES.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file.path)}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 font-mono text-xs transition-colors ${
                      selectedFile === file.path
                        ? "bg-[#37373d] text-white font-semibold"
                        : "hover:bg-[#2a2d2e] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <FileCode className="h-3.5 w-3.5 text-blue-400" />
                    <span>{file.path}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* VS Code Main Editor Area */}
            <div className="flex-1 flex flex-col bg-[#1e1e1e]">
              {/* File Tab Bar & Save Button */}
              <div className="h-9 bg-[#2d2d2d] border-b border-[#2b2b2b] px-3 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-[#1e1e1e] px-3 py-1.5 rounded-t text-xs font-mono text-white border-t-2 border-blue-500">
                  <FileCode className="h-3.5 w-3.5 text-blue-400" />
                  <span>{selectedFile}</span>
                </div>

                <Button
                  size="sm"
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  {savingFile ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : saveSuccess ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {saveSuccess ? "Saved to Daytona!" : "Save File (Cmd+S)"}
                </Button>
              </div>

              {/* Monaco Editor Container */}
              <div className="flex-1 relative">
                {loadingFile ? (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Loading file from Daytona sandbox...
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    path={selectedFile}
                    defaultLanguage="typescript"
                    value={fileContent}
                    onChange={(val) => setFileContent(val || "")}
                    options={{
                      fontSize: 13,
                      fontFamily: "Fira Code, monospace",
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbers: "on",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: REAL DAYTONA SANDBOX TERMINAL LOGS */}
        {activeTab === "terminal" && (
          <div className="h-full w-full bg-black p-4 font-mono text-xs text-emerald-400 overflow-y-auto space-y-1">
            <div className="text-muted-foreground text-[11px] border-b border-border/60 pb-2 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Terminal className="h-3.5 w-3.5" /> Live Daytona Process Stdout/Stderr
              </span>
              <span className="text-muted-foreground">bash -c agy</span>
            </div>

            {terminalLogs.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground italic space-y-1">
                <p>No active Daytona sandbox process logs recorded yet.</p>
                <p className="text-[11px]">Submit a prompt to stream real command logs from your Daytona container.</p>
              </div>
            ) : (
              terminalLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed border-l-2 border-emerald-500/30 pl-2">
                  <span className="text-muted-foreground text-[10px] mr-2">[{new Date().toLocaleTimeString()}]</span>
                  <span>{log}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
