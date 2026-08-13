import { useState, useEffect, useRef } from "react";
import { LandingPage } from "./components/marketing/LandingPage";
import { SetupWizard } from "./components/onboarding/SetupWizard";
import { HeaderBar } from "./components/workspace/HeaderBar";
import { ChatPane } from "./components/workspace/ChatPane";
import type { ChatMessage } from "./components/workspace/ChatPane";
import { PreviewPane } from "./components/workspace/PreviewPane";
import { SettingsModal } from "./components/workspace/SettingsModal";

export function App() {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem("daytona_api_key"));
  const [serverUrl, setServerUrl] = useState<string>(() => localStorage.getItem("daytona_server_url") || "https://app.daytona.io/api");
  const [userId, setUserId] = useState<string>(() => localStorage.getItem("daytona_user_id") || `user-${Math.random().toString(36).substring(2, 8)}`);
  
  // App Navigation View: "marketing" (Home Page) | "setup" (Setup Wizard) | "workspace" (Coding View)
  const [currentView, setCurrentView] = useState<"marketing" | "setup" | "workspace">(() => {
    return localStorage.getItem("daytona_api_key") ? "workspace" : "marketing";
  });

  const [sandboxId, setSandboxId] = useState<string | undefined>(() => localStorage.getItem("daytona_sandbox_id") || undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activePort, setActivePort] = useState<number>(3000);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Auto-provision or verify real Daytona sandbox when entering workspace
  useEffect(() => {
    if (apiKey && currentView === "workspace" && (!sandboxId || sandboxId === "sb-daytona-demo")) {
      createWorkspace(apiKey, userId);
    }
  }, [apiKey, currentView, sandboxId, userId]);

  // Initialize WebSocket connection to Go backend
  useEffect(() => {
    const connectWS = () => {
      const socket = new WebSocket("ws://localhost:8080/ws");
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("Connected to AGY Cloud Go WebSocket");
      };

      socket.onmessage = (event) => {
        try {
          const streamEvent = JSON.parse(event.data);
          handleStreamEvent(streamEvent);
        } catch (e) {
          console.error("Failed to parse WS stream event", e);
        }
      };

      socket.onclose = () => {
        setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Handle incoming real-time stream events from Go Backend
  const handleStreamEvent = (event: {
    type: string;
    content: string;
    sandboxId?: string;
    metadata?: any;
  }) => {
    // Append to raw terminal log stream
    setTerminalLogs((prev) => [...prev, `[${event.type.toUpperCase()}] ${event.content}`]);

    if (event.type === "port_detected" && event.metadata?.previewUrl) {
      setPreviewUrl(event.metadata.previewUrl);
      if (event.metadata.port) {
        setActivePort(event.metadata.port);
      }
    }

    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const lastMsgIndex = prev.length - 1;
      const lastMsg = prev[lastMsgIndex];

      if (lastMsg.sender !== "agy") return prev;

      const updatedMsg = { ...lastMsg };

      if (event.type === "thought") {
        updatedMsg.thoughts = [...(updatedMsg.thoughts || []), event.content];
      } else if (event.type === "tool_start") {
        updatedMsg.tools = [
          ...(updatedMsg.tools || []),
          { name: event.metadata?.tool || "tool_execution", path: event.metadata?.path },
        ];
      } else if (event.type === "token") {
        updatedMsg.text += event.content + "\n";
      } else if (event.type === "error") {
        updatedMsg.text = event.content || "An error occurred during execution.";
        updatedMsg.isError = true;
        setIsProcessing(false);
      } else if (event.type === "done") {
        setIsProcessing(false);
      }

      const newMessages = [...prev];
      newMessages[lastMsgIndex] = updatedMsg;
      return newMessages;
    });
  };

  // Complete setup wizard
  const handleSetupComplete = (key: string, uid: string, initialSandboxId?: string) => {
    localStorage.setItem("daytona_api_key", key);
    localStorage.setItem("daytona_user_id", uid);
    setApiKey(key);
    setUserId(uid);
    setCurrentView("workspace");

    if (initialSandboxId) {
      setSandboxId(initialSandboxId);
      localStorage.setItem("daytona_sandbox_id", initialSandboxId);
      setPreviewUrl(`https://${initialSandboxId}-${activePort}.daytona.app`);
    } else {
      createWorkspace(key, uid);
    }
  };

  // Full reset app state & local storage — wipes Daytona volume + sandbox
  const handleResetApp = async () => {
    // Call backend to wipe Daytona volume data and delete sandbox
    try {
      await fetch("http://localhost:8080/api/workspace/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || localStorage.getItem("daytona_api_key") || "",
          userId: userId,
          sandboxId: sandboxId || "",
        }),
      });
    } catch (err) {
      console.warn("Backend reset call failed (continuing local reset)", err);
    }

    // Clear all local state
    localStorage.clear();
    setApiKey(null);
    setSandboxId(undefined);
    setMessages([]);
    setTerminalLogs([]);
    setPreviewUrl(null);
    setIsProcessing(false);
    setCurrentView("marketing");
  };

  // Create Daytona Workspace via Go Backend
  const createWorkspace = async (key: string, uid: string) => {
    try {
      const res = await fetch("http://localhost:8080/api/workspace/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, userId: uid }),
      });
      const data = await res.json();
      if (data.sandboxId) {
        setSandboxId(data.sandboxId);
        localStorage.setItem("daytona_sandbox_id", data.sandboxId);
        setPreviewUrl(`https://${data.sandboxId}-${activePort}.daytona.app`);
      }
    } catch (err) {
      console.warn("Failed to provision Daytona sandbox", err);
    }
  };

  // Send Prompt to AGY via Go Backend
  const handleSendMessage = async (promptText: string) => {
    let currentSandbox = sandboxId;
    if (!currentSandbox || currentSandbox === "sb-daytona-demo") {
      try {
        const res = await fetch("http://localhost:8080/api/workspace/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: apiKey || "", userId }),
        });
        const data = await res.json();
        if (data.sandboxId) {
          currentSandbox = data.sandboxId;
          setSandboxId(data.sandboxId);
          localStorage.setItem("daytona_sandbox_id", data.sandboxId);
          setPreviewUrl(`https://${data.sandboxId}-${activePort}.daytona.app`);
        }
      } catch (e) {
        console.warn("Failed to auto-provision sandbox", e);
      }
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: promptText,
      timestamp: Date.now(),
    };

    const agyMsgPlaceholder: ChatMessage = {
      id: `agy-${Date.now()}`,
      sender: "agy",
      text: "",
      thoughts: [],
      tools: [],
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, agyMsgPlaceholder]);
    setIsProcessing(true);

    try {
      await fetch("http://localhost:8080/api/workspace/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || "",
          userId,
          sandboxId: currentSandbox || "",
          prompt: promptText,
        }),
      });
    } catch (err) {
      console.error("Failed to send prompt to backend", err);
      setIsProcessing(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setTerminalLogs([]);
  };

  // Stop generating / cancel active prompt
  const handleStopGenerating = async () => {
    try {
      await fetch("http://localhost:8080/api/workspace/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId: sandboxId || "sb-daytona-demo" }),
      });
    } catch (err) {
      console.warn("Failed to stop generation", err);
    }
    // Immediately reset UI so user isn't stuck
    setIsProcessing(false);
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const lastMsg = prev[prev.length - 1];
      if (lastMsg.sender === "agy" && !lastMsg.text.trim()) {
        const updated = { ...lastMsg, text: "Generation stopped by user." };
        return [...prev.slice(0, -1), updated];
      }
      return prev;
    });
  };

  // Update configuration from Settings Modal
  const handleUpdateConfig = (newConfig: {
    apiKey?: string;
    serverUrl?: string;
    userId?: string;
    sandboxId?: string;
    activePort?: number;
  }) => {
    if (newConfig.apiKey !== undefined) {
      setApiKey(newConfig.apiKey);
      localStorage.setItem("daytona_api_key", newConfig.apiKey);
    }
    if (newConfig.serverUrl !== undefined) {
      setServerUrl(newConfig.serverUrl);
      localStorage.setItem("daytona_server_url", newConfig.serverUrl);
    }
    if (newConfig.userId !== undefined) {
      setUserId(newConfig.userId);
      localStorage.setItem("daytona_user_id", newConfig.userId);
    }
    if (newConfig.sandboxId !== undefined) {
      setSandboxId(newConfig.sandboxId);
      if (newConfig.activePort || activePort) {
        setPreviewUrl(`https://${newConfig.sandboxId}-${newConfig.activePort || activePort}.daytona.app`);
      }
    }
    if (newConfig.activePort !== undefined) {
      setActivePort(newConfig.activePort);
      if (sandboxId || newConfig.sandboxId) {
        setPreviewUrl(`https://${newConfig.sandboxId || sandboxId}-${newConfig.activePort}.daytona.app`);
      }
    }
  };

  // Recreate Sandbox Container (fresh VM attached to persistent volume)
  const handleRecreateSandbox = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/workspace/recreate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || "dev-key",
          userId: userId,
        }),
      });
      const data = await res.json();
      if (data.sandboxId) {
        setSandboxId(data.sandboxId);
        setPreviewUrl(`https://${data.sandboxId}-${activePort}.daytona.app`);
      }
    } catch (err) {
      console.warn("Failed to recreate sandbox", err);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* VIEW 1: MARKETING HOME PAGE */}
      {currentView === "marketing" && (
        <LandingPage
          onStartSetup={() => setCurrentView("setup")}
          onResetApp={handleResetApp}
        />
      )}

      {/* VIEW 2: ONBOARDING SETUP WIZARD */}
      {currentView === "setup" && (
        <SetupWizard onComplete={handleSetupComplete} />
      )}

      {/* VIEW 3: MAIN 30/70 SPLIT CODING WORKSPACE */}
      {currentView === "workspace" && (
        <>
          {/* Main Workspace Navigation Header */}
          <HeaderBar
            sandboxId={sandboxId}
            userId={userId}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onExitWorkspace={handleResetApp}
          />

          {/* Main 30 / 70 Split Screen Workspace */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Pane (30% Width) */}
            <div className="w-[30%] min-w-[320px] max-w-[480px]">
              <ChatPane
                messages={messages}
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                onClearChat={handleClearChat}
                onStopGenerating={handleStopGenerating}
              />
            </div>

            {/* Right Pane (70% Width) */}
            <div className="flex-1">
              <PreviewPane
                sandboxId={sandboxId}
                apiKey={apiKey || ""}
                previewUrl={previewUrl}
                activePort={activePort}
                terminalLogs={terminalLogs}
                onPortChange={(port) => {
                  setActivePort(port);
                  if (sandboxId) {
                    setPreviewUrl(`https://${sandboxId}-${port}.daytona.app`);
                  }
                }}
              />
            </div>
          </div>

          {/* Workspace & Environment Settings Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            apiKey={apiKey || ""}
            serverUrl={serverUrl}
            userId={userId}
            sandboxId={sandboxId}
            activePort={activePort}
            onUpdateConfig={handleUpdateConfig}
            onResetApp={() => {
              setIsSettingsOpen(false);
              handleResetApp();
            }}
            onRecreateSandbox={handleRecreateSandbox}
          />
        </>
      )}
    </div>
  );
}

export default App;
