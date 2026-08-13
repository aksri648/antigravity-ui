# System Design Document: AGY Cloud Agent Workspace

The **AGY Cloud Agent Workspace** is an autonomous cloud-based AI code agent platform (similar to Devin / Codex Cloud / Replit Agent). It allows users to execute **Antigravity CLI (`agy`)** inside isolated **Daytona Sandboxes**, using their **personal Google Account AI quota**, and interact with code/previews via a **30/70 split-screen Web UI**.

---

## 1. High-Level Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Browser)"]
        UI["React + Vite + Tailwind CSS v3"]
        SetupModal["Setup Wizard (Daytona Key & Google Auth)"]
        LeftPane["Left 30% Pane: Chat & Tool Logs"]
        RightPane["Right 70% Pane: Live Iframe / Monaco IDE / Terminal"]
        WSClient["WebSocket Client Subscriber"]
    end

    subgraph ControlPlane ["Control Plane Backend (Golang)"]
        GinAPI["Gin HTTP REST API (:8080)"]
        WSHub["Gorilla WebSocket Hub"]
        DaytonaSvc["Daytona Service Controller"]
        AGYSvc["AGY Execution Engine"]
    end

    subgraph Infrastructure ["Cloud Infrastructure Layer"]
        DaytonaAPI["Daytona Cloud API (app.daytona.io)"]
        
        subgraph Sandbox ["Isolated Daytona Micro-VM / Container"]
            Vol["Persistent Volume (/root/.gemini)"]
            AGYProcess["agy CLI Engine (stream-json)"]
            AppServer["Dev Server (Vite / Express on :3000)"]
        end
    end

    SetupModal -->|1. Verify API Key & Init Auth| GinAPI
    GinAPI -->|2. Create Volume & Provision Sandbox| DaytonaAPI
    DaytonaAPI -->|3. Attach Volume & Launch Container| Sandbox
    
    LeftPane -->|4. Submit Prompt| GinAPI
    GinAPI -->|5. Exec agy inside Sandbox| AGYSvc
    AGYSvc -->|6. Execute Command via Daytona REST API| AGYProcess
    AGYProcess -->|7. Write Code & Run npm run dev| AppServer
    
    AGYProcess -->|8. Stream Output Tokens, Thoughts & Ports| WSHub
    WSHub -->|9. WebSocket Events| WSClient
    WSClient --> LeftPane & RightPane
    AppServer -->|10. Live Subdomain Proxy (https://sb-port.daytona.app)| RightPane
```

---

## 2. Core Subsystems

### Subsystem A: Client Layer (Frontend)
* **Framework**: React 18 + Vite + TypeScript.
* **Styling**: Tailwind CSS v3 + Shadcn UI design primitives.
* **Code Editor**: `@monaco-editor/react` (VS Code Dark Plus theme with file tree explorer & file save REST integration).
* **Communication**: REST API for setup/file operations + WebSocket (`ws://localhost:8080/ws`) for real-time streaming.
* **Layout**: Resizable 30% / 70% Split Workspace.
  * **30% Left Pane**: Interactive chat thread, collapsible AGY reasoning/thoughts dropdown, tool execution badges (`[replace_file_content]`, `[run_command]`), and prompt input box (`Cmd+Enter`).
  * **70% Right Pane**: Mode selector tabs:
    1. **Live Preview**: Embedded `<iframe>` pointing to Daytona Preview URL (`https://<sandboxId>-<port>.daytona.app`).
    2. **VS Code IDE**: File explorer sidebar + Monaco Editor connected to Daytona filesystem APIs.
    3. **Terminal**: Live stream of raw Daytona sandbox process logs (stdout/stderr).

---

### Subsystem B: Control Plane Layer (Golang Backend)
* **Framework**: Golang (Gin Framework + Gorilla WebSockets).
* **Architecture**: Decoupled service architecture (`services/daytona.go`, `services/agy.go`, `handlers/setup.go`, `handlers/workspace.go`, `handlers/websocket.go`).
* **Responsibility**:
  1. Verify Daytona API credentials.
  2. Orchestrate Daytona Volume creation (`vol-user-auth-{userId}`) and sandbox container lifecycle.
  3. Execute `agy` commands inside Daytona sandboxes via Daytona API (`/sandbox/{id}/exec`).
  4. Parse `stream-json` events (thinking, tokens, tool starts/ends, dev server port binding).
  5. Relay real-time events to connected browser clients via WebSocket Hub.
  6. Serve file content reading/writing APIs (`/api/workspace/file-content` and `/api/workspace/file-save`).

---

### Subsystem C: Infrastructure Layer (Daytona Sandboxes)
* **Compute Engine**: Ephemeral Linux micro-VM containers provisioned in <200ms by Daytona SDK.
* **Security Isolation**: Dedicated kernel, vCPU, RAM, and filesystem boundaries per user session.
* **Persistence Volume**: Persistent storage volume attached at `/root/.gemini` per user.
* **Network & Port Forwarding**: Automatic subdomains (`https://<sandboxId>-<port>.daytona.app`) for exposed dev server ports (3000, 5173, 8080).

---

### Subsystem D: Google Quota & Agent Engine (`agy`)
* **Execution**: Headless execution mode (`agy --print "<prompt>" --output-format stream-json --dangerously-skip-permissions`).
* **Authentication**: Device OAuth flow initiated via `agy --prompt '/auth'` inside Daytona.
* **Quota Source**: User's personal Google Account AI quota (BYOQ model).
* **Session Persistence**: OAuth refresh tokens, conversation histories, and settings saved directly to `/root/.gemini` inside the Daytona Volume.

---

## 3. Key Design Patterns & Flows

### 1. Bring Your Own Quota (BYOQ) & Volume Persistence
```
User Auth Flow:
[Setup Wizard] -> [Exec agy /auth in Daytona] -> [Extract Live OAuth URL & Device Code]
   -> [User Authorizes in Google] -> [User Pastes Code in UI] -> [Submit Code to agy]
   -> [Tokens Cached to /root/.gemini in Daytona Volume]
```
* **Why this matters**: Platform operators incur **$0 in LLM API costs**. Every request utilizes the user's personal Google AI quota.
* **Long-Term Persistence**: Because `/root/.gemini` is stored inside a Daytona Volume (`vol-user-auth-{userId}`), stopping or recreating sandboxes does not log the user out. `agy` automatically uses the cached refresh token to renew access tokens indefinitely.

---

### 2. Real-Time Event Streaming Protocol
WebSockets push strongly-typed JSON events to the frontend:

```typescript
type StreamEvent = {
  type: "thought" | "tool_start" | "tool_end" | "token" | "port_detected" | "error" | "done";
  content: string;
  sandboxId: string;
  metadata?: {
    tool?: string;
    path?: string;
    port?: number;
    previewUrl?: string;
  };
  timestamp: number;
};
```

---

### 3. Strict Sandbox Execution Boundary
* **No Host Execution**: All shell execution (`agy`, `git`, `npm`, `python`, file writes) is strictly routed through the Daytona Sandbox API (`/sandbox/{id}/exec`).
* **No Dummy Fallbacks**: If Daytona Sandbox is unauthenticated or unreachable, execution is halted immediately with an error badge rather than generating mock code on the host machine.

---

## 4. API Reference Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & service status. |
| `POST` | `/api/setup/verify-daytona` | Validates Daytona API key. |
| `POST` | `/api/setup/init-google-auth` | Provisions setup sandbox & runs `agy /auth` to extract live login URL/code. |
| `POST` | `/api/setup/submit-auth-code` | Feeds manually pasted Google authorization code to `agy` inside Daytona. |
| `POST` | `/api/workspace/create` | Provisions coding sandbox with mounted `/root/.gemini` volume. |
| `GET` | `/api/workspace/file-content` | Reads file content directly from Daytona sandbox (`cat <path>`). |
| `POST` | `/api/workspace/file-save` | Writes file content directly into Daytona sandbox (`cat << 'EOF' > <path>`). |
| `POST` | `/api/workspace/prompt` | Submits prompt to `agy` inside Daytona in `stream-json` mode. |
| `WS` | `/ws` | Gorilla WebSocket stream endpoint for live thoughts, tokens & preview URLs. |

---

## 5. Security & Isolation Matrix

* **Compute Boundary**: Micro-VM container isolation per tenant.
* **Storage Boundary**: Per-user Daytona Volume (`vol-user-auth-{userId}`).
* **Credential Isolation**: Google OAuth tokens stay inside `/root/.gemini` within the user's isolated volume.
* **CORS & Access Control**: Express/Gin CORS configured with explicit origin & header authorization rules.
