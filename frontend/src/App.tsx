import { useState, useEffect, useRef, useCallback } from "react";
import { LandingPage } from "./components/marketing/LandingPage";
import { SetupWizard } from "./components/onboarding/SetupWizard";
import { AuthView } from "./components/auth/AuthView";
import { HeaderBar } from "./components/workspace/HeaderBar";
import { ProjectsSidebar } from "./components/workspace/ProjectsSidebar";
import { ChatPane } from "./components/workspace/ChatPane";
import type { ChatMessage, AgentMode, CliEngine } from "./components/workspace/ChatPane";
import { PreviewPane } from "./components/workspace/PreviewPane";
import { SettingsModal } from "./components/workspace/SettingsModal";
import type { Project, Conversation } from "./types";
import { apiUrl, getWsUrl } from "./config/api";

export function App() {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem("daytona_api_key"));
  const [serverUrl, setServerUrl] = useState<string>(() => localStorage.getItem("daytona_server_url") || "https://app.daytona.io/api");
  const [userId, setUserId] = useState<string>(() => localStorage.getItem("daytona_user_id") || `user-${Math.random().toString(36).substring(2, 8)}`);
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem("user_email") || "");
  const [userName, setUserName] = useState<string>(() => localStorage.getItem("user_name") || "");
  const [, setAuthToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  
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

  // Multi-Project and Multi-Chat State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("workspace_sidebar_open");
    return saved !== null ? saved === "true" : true;
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Adjustable Split Pane Width State (Left Panel %)
  const [leftPanePercent, setLeftPanePercent] = useState<number>(() => {
    const saved = localStorage.getItem("workspace_left_width_pct");
    return saved ? parseFloat(saved) : 32;
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);

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

  // Fetch projects from backend
  const fetchProjects = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(apiUrl("/api/projects", { userId }));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
          setActiveProject((prev) => {
            if (prev) {
              const stillExists = data.projects.find((p: Project) => p.id === prev.id);
              if (stillExists) return stillExists;
            }
            const savedProjId = localStorage.getItem(`active_project_id_${userId}`);
            const matched = data.projects.find((p: Project) => p.id === savedProjId);
            return matched || data.projects[0];
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch projects:", err);
    }
  }, [userId]);

  // Fetch conversations for the active project
  const fetchConversations = useCallback(async (projId?: string) => {
    if (!userId) return;
    const targetProjId = projId || activeProject?.id || "";
    try {
      const res = await fetch(apiUrl("/api/conversations", { userId, projectId: targetProjId }));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.conversations)) {
          setConversations(data.conversations);
          setActiveConversationId((prev) => {
            if (prev && data.conversations.some((c: Conversation) => c.id === prev)) {
              return prev;
            }
            return data.conversations.length > 0 ? data.conversations[0].id : null;
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch conversations:", err);
    }
  }, [userId, activeProject]);

  // Fetch chat history for the active conversation
  const fetchChatHistory = useCallback(async (convId?: string) => {
    const targetConvId = convId !== undefined ? convId : activeConversationId;
    try {
      const query: Record<string, string> = { userId };
      if (targetConvId) query.conversationId = targetConvId;
      if (activeProject?.id) query.projectId = activeProject.id;
      const res = await fetch(apiUrl("/api/chat/history", query));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          const formatted: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.id ? String(m.id) : `hist-${Math.random()}`,
            sender: m.sender === "user" ? "user" : "agy",
            text: m.text,
            thoughts: m.thoughts || [],
            tools: m.tools || [],
            timestamp: m.timestamp || Date.now(),
          }));
          setMessages(formatted);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.warn("Failed to load chat history:", err);
    }
  }, [userId, activeConversationId, activeProject]);

  // Load projects & conversations when entering workspace
  useEffect(() => {
    if (currentView === "workspace" && userId) {
      fetchProjects();
    }
  }, [currentView, userId, fetchProjects]);

  useEffect(() => {
    if (activeProject?.id) {
      fetchConversations(activeProject.id);
    }
  }, [activeProject?.id, fetchConversations]);

  useEffect(() => {
    if (activeConversationId) {
      fetchChatHistory(activeConversationId);
    } else if (conversations.length === 0) {
      setMessages([]);
    }
  }, [activeConversationId, fetchChatHistory, conversations.length]);

  // Handle Dragging Splitter for Workspace Panel Resizing
  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!workspaceContainerRef.current) return;
      const rect = workspaceContainerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const totalWidth = rect.width;
      if (totalWidth <= 0) return;

      const minPx = 280;
      const maxPx = Math.max(minPx, totalWidth - 340);
      const clampedPx = Math.min(Math.max(offsetX, minPx), maxPx);
      const pct = (clampedPx / totalWidth) * 100;

      setLeftPanePercent(pct);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      setLeftPanePercent((current) => {
        localStorage.setItem("workspace_left_width_pct", current.toFixed(2));
        return current;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSplitter]);

  // Initialize WebSocket connection to Go backend
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectWS = () => {
      if (!isMounted) return;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const wsEndpoint = getWsUrl();
        const socket = new WebSocket(wsEndpoint);
        wsRef.current = socket;

        socket.onopen = () => {
          if (!isMounted) return;
          console.log("Connected to AGY Cloud Go WebSocket:", wsEndpoint);
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const streamEvent = JSON.parse(event.data);
            handleStreamEvent(streamEvent);
          } catch (e) {
            console.error("Failed to parse WS stream event", e);
          }
        };

        socket.onerror = () => {
          // Handled gracefully without noisy cascade
        };

        socket.onclose = () => {
          if (!isMounted) return;
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            if (isMounted) connectWS();
          }, 3000);
        };
      } catch (err) {
        if (isMounted) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            if (isMounted) connectWS();
          }, 3000);
        }
      }
    };

    connectWS();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
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

    if (event.type === "done" || event.type === "error") {
      setIsProcessing(false);
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
        updatedMsg.text = (updatedMsg.text || "") + event.content;
      } else if (event.type === "error") {
        updatedMsg.text = event.content || "An error occurred during execution.";
        updatedMsg.isError = true;
      } else if (event.type === "done") {
        if (!updatedMsg.text.trim()) {
          if (updatedMsg.thoughts && updatedMsg.thoughts.length > 0) {
            updatedMsg.text = updatedMsg.thoughts[updatedMsg.thoughts.length - 1];
          } else {
            updatedMsg.text = "Hello! I am Antigravity AI, ready to assist you with your coding tasks in your Daytona cloud sandbox.";
          }
        }
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

  const [currentAgentMode, setCurrentAgentMode] = useState<AgentMode>("app-developer");
  const [cliEngine, setCliEngine] = useState<CliEngine>(() => (localStorage.getItem("preferred_cli_engine") as CliEngine) || "agy");

  // Send Prompt to AGY or OpenCode via Go Backend
  const handleSendMessage = async (
    promptText: string,
    agentMode?: AgentMode,
    repoUrl?: string,
    approvalAction?: "approve" | "reject" | "amend",
    cliEngineParam?: CliEngine
  ) => {
    let currentKey = apiKey || localStorage.getItem("daytona_api_key");
    if (!currentKey) {
      // Prompt user to provide credentials before executing prompt
      setIsSettingsOpen(true);
      return;
    }

    let currentSandbox = sandboxId;
    if (!currentSandbox) {
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

    const activeMode = agentMode || currentAgentMode;
    const activeEngine = cliEngineParam || cliEngine;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: promptText,
      timestamp: Date.now(),
      agentMode: activeMode,
    };

    const agyMsgPlaceholder: ChatMessage = {
      id: `agy-${Date.now()}`,
      sender: "agy",
      text: "",
      thoughts: [],
      tools: [],
      timestamp: Date.now(),
      agentMode: activeMode,
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
          conversationId: activeConversationId || "",
          projectId: activeProject?.id || "",
          prompt: promptText,
          agentMode: activeMode,
          repoUrl: repoUrl || "",
          approvalAction: approvalAction || "",
          cliEngine: activeEngine,
        }),
      });

      // Refresh conversations to reflect updated titles or message counts
      if (activeProject?.id) {
        fetchConversations(activeProject.id);
      }
    } catch (err) {
      console.error("Failed to send prompt to backend", err);
      setIsProcessing(false);
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    setTerminalLogs([]);
    try {
      const query: Record<string, string> = { userId };
      if (activeConversationId) query.conversationId = activeConversationId;
      if (sandboxId) query.sandboxId = sandboxId;
      await fetch(apiUrl("/api/chat/history", query), {
        method: "DELETE",
      });
      if (activeProject?.id) {
        fetchConversations(activeProject.id);
      }
    } catch {}
  };

  // Project & Conversation Handlers
  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    localStorage.setItem(`active_project_id_${userId}`, project.id);
    fetchConversations(project.id);
  };

  const handleCreateProject = async (name: string, description: string) => {
    try {
      const res = await fetch(apiUrl("/api/projects", { userId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          apiKey: apiKey || "",
          serverUrl: serverUrl || "",
          sandboxId: sandboxId || "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          await fetchProjects();
          setActiveProject(data.project);
          localStorage.setItem(`active_project_id_${userId}`, data.project.id);
          await fetchConversations(data.project.id);
        }
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const handleUpdateProject = async (projectId: string, name: string, description: string) => {
    try {
      await fetch(apiUrl(`/api/projects/${projectId}`, { userId }), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      fetchProjects();
    } catch (err) {
      console.error("Failed to update project:", err);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/projects/${projectId}`, { userId }), {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeProject?.id === projectId) {
          localStorage.removeItem(`active_project_id_${userId}`);
          setActiveProject(null);
          setConversations([]);
          setActiveConversationId(null);
          setMessages([]);
        }
        await fetchProjects();
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    fetchChatHistory(convId);
  };

  const handleCreateConversation = async (projectId?: string) => {
    const targetProjId = projectId || activeProject?.id;
    if (!targetProjId) return;
    try {
      const res = await fetch(apiUrl("/api/conversations", { userId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: targetProjId,
          sandboxId: sandboxId || "",
          title: "New Chat",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.conversation) {
          await fetchConversations(targetProjId);
          setActiveConversationId(data.conversation.id);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleUpdateConversationTitle = async (convId: string, title: string) => {
    try {
      await fetch(apiUrl(`/api/conversations/${convId}`, { userId }), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      fetchConversations(activeProject?.id);
    } catch (err) {
      console.error("Failed to update conversation title:", err);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await fetch(apiUrl(`/api/conversations/${convId}`, { userId }), {
        method: "DELETE",
      });
      if (activeConversationId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
          fetchChatHistory(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
      fetchConversations(activeProject?.id);
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
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

  // Sign out handler
  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user_email");
    localStorage.removeItem("auth_user_name");
    setUserEmail("");
    setUserName("");
    const newGuestId = `user-${Math.random().toString(36).substring(2, 8)}`;
    setUserId(newGuestId);
    localStorage.setItem("workspace_user_id", newGuestId);
    setProjects([]);
    setActiveProject(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
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
            const hasApiKey = apiKey || localStorage.getItem("daytona_api_key");
            if (hasApiKey) {
              setCurrentView("workspace");
            } else {
              setCurrentView("setup");
            }
          }}
          onLaunchWorkspace={() => {
            const hasApiKey = apiKey || localStorage.getItem("daytona_api_key");
            if (hasApiKey) {
              setCurrentView("workspace");
            } else {
              setCurrentView("setup");
            }
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
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => {
              setIsSidebarOpen((prev) => {
                const next = !prev;
                localStorage.setItem("workspace_sidebar_open", String(next));
                return next;
              });
            }}
            activeProjectName={activeProject?.name}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAuth={(mode) => {
              setAuthMode(mode);
              setIsAuthModalOpen(true);
            }}
            onStartSandbox={handleStartSandbox}
            onExitWorkspace={handleExitWorkspace}
          />

          {/* Main Adjustable Split Screen Workspace with Projects Sidebar */}
          <div
            ref={workspaceContainerRef}
            className={`flex flex-1 overflow-hidden relative ${isDraggingSplitter ? "select-none cursor-col-resize" : ""}`}
          >
            {/* Multi-Project & Multi-Chat Collapsible Sidebar */}
            <ProjectsSidebar
              isOpen={isSidebarOpen}
              onToggle={() => {
                setIsSidebarOpen((prev) => {
                  const next = !prev;
                  localStorage.setItem("workspace_sidebar_open", String(next));
                  return next;
                });
              }}
              projects={projects}
              activeProject={activeProject}
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onCreateConversation={handleCreateConversation}
              onUpdateConversationTitle={handleUpdateConversationTitle}
              onDeleteConversation={handleDeleteConversation}
              userId={userId}
              userEmail={userEmail}
              userName={userName}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenAuth={(mode) => {
                setAuthMode(mode);
                setIsAuthModalOpen(true);
              }}
              onLogout={handleLogout}
            />

            {/* Left Pane (Adjustable Width) */}
            <div
              style={{ width: `${leftPanePercent}%` }}
              className="h-full shrink-0 overflow-hidden flex flex-col min-w-[280px]"
            >
              <ChatPane
                messages={messages}
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                onClearChat={handleClearChat}
                onStopGenerating={handleStopGenerating}
                currentAgentMode={currentAgentMode}
                onAgentModeChange={setCurrentAgentMode}
                cliEngine={cliEngine}
                onCliEngineChange={(engine) => {
                  setCliEngine(engine);
                  localStorage.setItem("preferred_cli_engine", engine);
                }}
                activeConversationTitle={conversations.find((c) => c.id === activeConversationId)?.title}
                activeProjectName={activeProject?.name}
                onNewChat={() => handleCreateConversation(activeProject?.id)}
              />
            </div>

            {/* Interactive Resizable Divider Bar */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingSplitter(true);
              }}
              onDoubleClick={() => {
                setLeftPanePercent(32);
                localStorage.setItem("workspace_left_width_pct", "32");
              }}
              className={`group relative w-2 hover:w-2.5 bg-border/40 hover:bg-emerald-500/80 cursor-col-resize z-20 shrink-0 transition-all flex items-center justify-center border-x border-white/5 ${
                isDraggingSplitter ? "bg-emerald-500 w-2.5 shadow-[0_0_12px_rgba(16,185,129,0.6)]" : ""
              }`}
              title="Drag to resize panels (Double-click to reset to 32%)"
            >
              <div className="h-8 w-1 rounded-full bg-white/30 group-hover:bg-white transition-colors" />
            </div>

            {/* Right Pane (Dynamic Remaining Width) */}
            <div className="flex-1 h-full min-w-0 overflow-hidden relative">
              {/* Invisible overlay during drag to prevent iframes from swallowing mouse movements */}
              {isDraggingSplitter && <div className="absolute inset-0 z-50 cursor-col-resize bg-transparent" />}
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
