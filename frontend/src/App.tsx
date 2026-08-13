import { useState, useEffect, useRef, useCallback } from "react";
import { LandingPage } from "./components/marketing/LandingPage";
import { SetupWizard } from "./components/onboarding/SetupWizard";
import { AuthView } from "./components/auth/AuthView";
import { HeaderBar } from "./components/workspace/HeaderBar";
import { ChatPane } from "./components/workspace/ChatPane";
import type { ChatMessage } from "./components/workspace/ChatPane";
import { PreviewPane } from "./components/workspace/PreviewPane";
import { SettingsModal } from "./components/workspace/SettingsModal";
import { apiUrl, getWsUrl } from "./config/api";

export function App() {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem("daytona_api_key"));
  const [serverUrl, setServerUrl] = useState<string>(() => localStorage.getItem("daytona_server_url") || "https://app.daytona.io/api");
  const [userId, setUserId] = useState<string>(() => localStorage.getItem("daytona_user_id") || `user-${Math.random().toString(36).substring(2, 8)}`);
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem("user_email") || "");
  const [userName, setUserName] = useState<string>(() => localStorage.getItem("user_name") || "");
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  
  // App Navigation Views: "marketing" | "auth" | "setup" | "workspace"
  const [currentView, setCurrentView] = useState<"marketing" | "auth" | "setup" | "workspace">("marketing");

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [sandboxId, setSandboxId] = useState<string | undefined>(() => localStorage.getItem("daytona_sandbox_id") || undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activePort, setActivePort] = useState<number>(3000);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Auto-verify session and fetch profile & active sandbox from SQLite
  useEffect(() => {
    const checkUserSession = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      try {
        const res = await fetch(apiUrl("/api/auth/me", { userId }), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUserEmail(data.user.email || "");
            setUserName(data.user.name || "");
            if (data.user.daytonaApiKey && !apiKey) {
              setApiKey(data.user.daytonaApiKey);
              localStorage.setItem("daytona_api_key", data.user.daytonaApiKey);
            }
            if (data.user.daytonaServerUrl) {
              setServerUrl(data.user.daytonaServerUrl);
            }
          }
          if (data.activeSandbox?.daytonaSandboxId) {
            setSandboxId(data.activeSandbox.daytonaSandboxId);
            localStorage.setItem("daytona_sandbox_id", data.activeSandbox.daytonaSandboxId);
            if (data.activeSandbox.previewUrl) {
              setPreviewUrl(data.activeSandbox.previewUrl);
            }
          }
        }
      } catch (err) {
        console.warn("Session check failed, continuing with local state", err);
      }
    };

    checkUserSession();
  }, [userId]);

  // Load persistent chat history from SQLite when entering workspace
  useEffect(() => {
    if (currentView === "workspace" && userId) {
      fetchChatHistory();
    }
  }, [currentView, userId, sandboxId]);

  const fetchChatHistory = async () => {
    try {
      const res = await fetch(apiUrl("/api/chat/history", { userId, sandboxId: sandboxId || "" }));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const parsedMessages: ChatMessage[] = data.map((m: any) => ({
            id: m.id || `msg-${Date.now()}`,
            sender: m.sender || "agy",
            text: m.text || "",
            thoughts: m.thoughts || [],
            tools: m.tools || [],
            isError: m.isError || false,
            timestamp: m.timestamp || Date.now(),
          }));
          setMessages(parsedMessages);
        }
      }
    } catch {
      // Keep existing in-memory messages if fetch fails
    }
  };

  // Initialize WebSocket connection to Go backend
  useEffect(() => {
    const connectWS = () => {
      const wsEndpoint = getWsUrl();
      const socket = new WebSocket(wsEndpoint);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("Connected to AGY Cloud Go WebSocket:", wsEndpoint);
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

  // Auth Success from SaaS Login / Registration
  const handleAuthSuccess = (authData: {
    token: string;
    user: {
      id: string;
      email: string;
      name?: string;
      daytonaApiKey?: string;
      daytonaServerUrl?: string;
    };
    activeSandbox?: {
      id: string;
      daytonaSandboxId: string;
      previewUrl?: string;
      activePort?: number;
    };
  }) => {
    setAuthToken(authData.token);
    setUserId(authData.user.id);
    setUserEmail(authData.user.email);
    if (authData.user.name) setUserName(authData.user.name);
    if (authData.user.daytonaApiKey) setApiKey(authData.user.daytonaApiKey);
    if (authData.user.daytonaServerUrl) setServerUrl(authData.user.daytonaServerUrl);

    if (authData.activeSandbox?.daytonaSandboxId) {
      setSandboxId(authData.activeSandbox.daytonaSandboxId);
      if (authData.activeSandbox.previewUrl) {
        setPreviewUrl(authData.activeSandbox.previewUrl);
      }
    }

    setIsAuthModalOpen(false);
    setCurrentView("workspace");
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

  // Exit Workspace — Instant 0ms response to return to SaaS Home / Login
  const handleExitWorkspace = useCallback(() => {
    setCurrentView("marketing");
    setIsProcessing(false);
  }, []);

  // Full reset app state & local storage — wipes Daytona volume + sandbox
  const handleResetApp = async () => {
    const currentKey = apiKey;
    const currentUid = userId;
    const currentSb = sandboxId;

    localStorage.clear();
    setApiKey(null);
    setAuthToken(null);
    setUserEmail("");
    setUserName("");
    setSandboxId(undefined);
    setMessages([]);
    setTerminalLogs([]);
    setPreviewUrl(null);
    setIsProcessing(false);
    setCurrentView("marketing");

    if (currentKey && currentSb) {
      fetch(apiUrl("/api/workspace/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: currentKey,
          serverUrl: serverUrl || "",
          userId: currentUid,
          sandboxId: currentSb,
        }),
      }).catch((e) => console.warn("Background reset notice:", e));
    }
  };

  // Create or Provision Daytona Workspace via Go Backend
  const createWorkspace = async (key: string, uid: string) => {
    setIsProvisioning(true);
    try {
      const res = await fetch(apiUrl("/api/workspace/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: key,
          serverUrl: serverUrl || localStorage.getItem("daytona_server_url") || "",
          userId: uid,
        }),
      });
      const data = await res.json();
      if (data.sandboxId) {
        setSandboxId(data.sandboxId);
        localStorage.setItem("daytona_sandbox_id", data.sandboxId);
        setPreviewUrl(`https://${data.sandboxId}-${activePort}.daytona.app`);
      } else if (data.error) {
        console.warn("Daytona provision error:", data.error);
        if (data.error.toLowerCase().includes("key") || data.error.toLowerCase().includes("auth") || data.error.includes("401")) {
          setIsSettingsOpen(true);
        }
      }
    } catch (err) {
      console.warn("Failed to provision Daytona sandbox", err);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Start Sandbox Handler — Triggered by "Start Sandbox" button in HeaderBar
  const handleStartSandbox = async () => {
    const currentKey = apiKey || localStorage.getItem("daytona_api_key");
    if (!currentKey) {
      // Credentials missing: Prompt user with settings modal to input Daytona API Key
      setIsSettingsOpen(true);
      return;
    }

    await createWorkspace(currentKey, userId);
  };

  // Send Prompt to AGY via Go Backend
  const handleSendMessage = async (promptText: string) => {
    let currentKey = apiKey || localStorage.getItem("daytona_api_key");
    if (!currentKey) {
      // Prompt user to provide credentials before executing prompt
      setIsSettingsOpen(true);
      return;
    }

    let currentSandbox = sandboxId;
    if (!currentSandbox || currentSandbox === "sb-daytona-demo") {
      setIsProvisioning(true);
      try {
        const res = await fetch(apiUrl("/api/workspace/create"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: currentKey,
            serverUrl: serverUrl || localStorage.getItem("daytona_server_url") || "",
            userId,
          }),
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
      } finally {
        setIsProvisioning(false);
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
      await fetch(apiUrl("/api/workspace/prompt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: currentKey,
          serverUrl: serverUrl || localStorage.getItem("daytona_server_url") || "",
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

  const handleClearChat = async () => {
    setMessages([]);
    setTerminalLogs([]);
    try {
      fetch(apiUrl("/api/chat/history", { userId, sandboxId: sandboxId || "" }), {
        method: "DELETE",
      });
    } catch {}
  };

  // Stop generating / cancel active prompt
  const handleStopGenerating = async () => {
    try {
      await fetch(apiUrl("/api/workspace/stop"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId: sandboxId || "" }),
      });
    } catch (err) {
      console.warn("Failed to stop generation", err);
    }
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
      // Auto-start sandbox if user just configured their key
      if (newConfig.apiKey.trim() && !sandboxId) {
        createWorkspace(newConfig.apiKey, userId);
      }
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
      localStorage.setItem("daytona_sandbox_id", newConfig.sandboxId);
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
    const currentKey = apiKey || localStorage.getItem("daytona_api_key") || "";
    if (!currentKey) {
      setIsSettingsOpen(true);
      return;
    }
    setIsProvisioning(true);
    try {
      const res = await fetch(apiUrl("/api/workspace/recreate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: currentKey,
          serverUrl: serverUrl || localStorage.getItem("daytona_server_url") || "",
          userId: userId,
        }),
      });
      const data = await res.json();
      if (data.sandboxId) {
        setSandboxId(data.sandboxId);
        localStorage.setItem("daytona_sandbox_id", data.sandboxId);
        setPreviewUrl(`https://${data.sandboxId}-${activePort}.daytona.app`);
      }
    } catch (err) {
      console.warn("Failed to recreate sandbox", err);
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* VIEW 1: MARKETING HOME PAGE */}
      {currentView === "marketing" && (
        <LandingPage
          onStartSetup={() => {
            setAuthMode("signup");
            setCurrentView("auth");
          }}
          onLaunchWorkspace={() => {
            setCurrentView("workspace");
          }}
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setCurrentView("auth");
          }}
          onResetApp={handleResetApp}
        />
      )}

      {/* VIEW 2: MULTI-USER SAAS AUTHENTICATION (FULL VIEW) */}
      {currentView === "auth" && (
        <AuthView
          initialMode={authMode}
          onAuthSuccess={handleAuthSuccess}
          onContinueAsGuest={() => setCurrentView("workspace")}
          onClose={() => setCurrentView("marketing")}
        />
      )}

      {/* VIEW 3: ONBOARDING SETUP WIZARD */}
      {currentView === "setup" && (
        <SetupWizard onComplete={handleSetupComplete} />
      )}

      {/* VIEW 4: MAIN 30/70 SPLIT CODING WORKSPACE */}
      {currentView === "workspace" && (
        <>
          {/* Main Workspace Navigation Header */}
          <HeaderBar
            sandboxId={sandboxId}
            isProvisioning={isProvisioning}
            userId={userId}
            userEmail={userEmail}
            userName={userName}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAuth={(mode) => {
              setAuthMode(mode);
              setIsAuthModalOpen(true);
            }}
            onStartSandbox={handleStartSandbox}
            onExitWorkspace={handleExitWorkspace}
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
                serverUrl={serverUrl}
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

          {/* In-Workspace Auth Modal for switching accounts / logging in */}
          {isAuthModalOpen && (
            <AuthView
              initialMode={authMode}
              onAuthSuccess={handleAuthSuccess}
              onContinueAsGuest={() => setIsAuthModalOpen(false)}
              onClose={() => setIsAuthModalOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
