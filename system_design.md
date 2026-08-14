# DELTA System Design — Implementation-First Architecture

> This document describes the repository that exists today. It intentionally prefers executable code and registered routes over older planning documents. When a capability is present only as a future-ready abstraction, it is labeled as such.

## 1. Executive overview

DELTA is a React/Vite workspace front end backed by a single Go/Gin control-plane service. The control plane owns authentication middleware, local SQLite persistence, optional Supabase integration, Daytona sandbox lifecycle, agent execution, preview/VNC/telemetry APIs, and a Gorilla WebSocket broadcast hub.

A user request follows this path:

```text
Browser (React)
   │ HTTPS / WSS
   ▼
Go + Gin control plane
   ├── auth middleware + user service
   ├── workspace/file/preview handlers
   ├── AGY service
   ├── Daytona service
   ├── inactivity manager
   ├── SQLite runtime store
   └── optional Supabase auth/data
   │
   │ Daytona REST API
   ▼
Per-user Daytona sandbox
   ├── /home/daytona/persist
   ├── AGY / OpenCode runtime
   ├── generated workspace
   └── dev server / preview / VNC / telemetry
```

The repository also contains a Python agent layer under `agents/`. `AgentOrchestrator` routes four specialized agent personas through a shared `CodingCliDriver` interface; the current Go workspace path is the production-facing execution path used by the main web application.

![DELTA current runtime architecture](/images/docs/delta-runtime-architecture.jpg)

## 2. Frontend architecture

### 2.1 Application entry and view state

`frontend/src/App.tsx` owns top-level navigation and workspace state. The current views are:

- `marketing`
- `auth`
- `setup`
- `workspace`

The app keeps practical workspace state in React and local storage: Daytona API/server hints, user id/email/name, auth token, sandbox id, active preview URL/port, chat messages, terminal logs, and the selected workspace settings.

### 2.2 Marketing/docs surface

`frontend/src/components/marketing/LandingPage.tsx` is the public marketing page. Its docs section is interactive rather than a separate route and now covers implementation-backed sections for:

- FDE/runtime flow
- current HLD/LLD boundaries
- database and RLS model
- first-run setup
- the four Python agent personas
- AGY/OpenCode switching
- persistence/secrets lifecycle
- MCP/agent integrations
- REST + WebSocket API surface

The page uses architecture visuals stored under `frontend/public/images/docs/`.

### 2.3 Workspace components

The implemented workspace is split into focused components:

- `HeaderBar.tsx` — workspace chrome and status controls.
- `ChatPane.tsx` — prompt entry, agent messages, tool/thought rendering, and AGY/OpenCode selector.
- `FileTree.tsx` — workspace file navigation.
- `PreviewPane.tsx` — preview/editor/terminal-style workspace display.
- `SettingsModal.tsx` — workspace credentials, integrations, and preferences.
- `TelemetryView.tsx` — runtime telemetry presentation.

`frontend/src/config/api.ts` centralizes REST and WebSocket URL derivation. `frontend/src/config/supabase.ts` creates a Supabase client from Vite env vars or persisted configuration.

## 3. Backend control plane

### 3.1 Server initialization

`backend/main.go` initializes:

1. SQLite at `data/agy_cloud.db` unless `SQLITE_DB_PATH` overrides it.
2. Gin + permissive CORS configuration.
3. `DaytonaService`.
4. `AGYService`.
5. `UserService`.
6. `SupabaseService`.
7. a Gorilla WebSocket hub.
8. an inactivity manager with a 30-minute threshold.

All `/api/*` routes are wrapped by `AuthMiddleware`; a second middleware records sandbox activity when a sandbox id is present.

### 3.2 Authentication

`backend/handlers/auth.go` supports a hybrid model:

- Supabase token verification when Supabase is configured.
- local JWT validation through `UserService` as a fallback.
- user context propagation through Gin request state.

The implementation currently allows requests to continue when no token is present, so production authorization hardening is still required. This is documented here explicitly rather than presenting the middleware as a complete tenant boundary.

### 3.3 Daytona service

`backend/services/daytona.go` is an HTTP client wrapper around the Daytona REST surface. It handles:

- API-key verification.
- volume lookup/creation using a deterministic `vol-<userId>` name.
- sandbox lookup/creation.
- optional persistent volume mounting at `/home/daytona/persist`.
- sandbox command/process execution.
- workspace file operations.
- preview URL/proxy helpers.
- VNC controls.
- telemetry retrieval.

Sandbox creation uses a 30-minute auto-stop interval and labels sandbox resources with the application/user context.

### 3.4 AGY service and CLI execution

`backend/services/agy.go` owns bootstrap and agent execution. The main streaming entry point supports two UI-selected engines:

```text
cliEngine = agy        → AGY command runner
cliEngine = opencode   → OpenCode command runner
```

Both target the persistent workspace path:

```text
/home/daytona/persist/workspace
```

The service also installs/bootstrap-configures CLI support in the sandbox, initializes persisted Gemini/agent state, and turns command output into structured `StreamEvent` values.

### 3.5 WebSocket event path

`backend/handlers/websocket.go` implements a broadcast hub. `GET /ws` upgrades a browser connection and subscribes it to the hub.

Frontend code in `App.tsx` consumes these event types directly:

```text
thought
 tool_start
token
port_detected
error
done
```

`port_detected` carries the information that lets the frontend update the active preview port and URL; `thought`, `tool_start`, and `token` enrich the last agent message.

![Prompt-to-preview request lifecycle](/images/docs/delta-request-lifecycle.jpg)

## 4. Agent layer

The Python package under `agents/` is a separate modular orchestration layer:

```text
AgentOrchestrator
 ├── AppDeveloperAgent
 ├── LLMDeployerAgent
 ├── AppDeployerAgent
 └── AppMaintainerAgent
         │
         ▼
    CodingCliDriver
      ├── AgyCliDriver
      ├── OpenCodeCliDriver
      └── ClaudeCodeCliDriver (future-ready)
```

The orchestrator accepts `agent_mode`, `prompt`, `sandbox_id`, `api_key`, optional repository information, traffic profile, and server URL. It resolves the requested persona and delegates execution through the shared driver contract.

![Agent and CLI architecture](/images/docs/delta-agent-cli-architecture.jpg)

Important distinction: the Python layer is present and internally coherent, while `backend/services/agy.go` is the primary execution path reached by the current web workspace API. Documentation should not imply that the web UI directly calls the Python orchestrator unless that wiring is added later.

## 5. Persistence model

### 5.1 SQLite runtime persistence

`backend/db/db.go` initializes the local database used by the current Go process. This path supports local/fallback operation and is the first persistence layer visible in the running server.

### 5.2 Supabase cloud persistence

`supabase/schema.sql` defines four cloud tables:

| Table | Purpose |
|---|---|
| `public.profiles` | user profile and Daytona configuration |
| `public.chat_messages` | persisted chat/tool/thought payloads |
| `public.user_sandboxes` | Daytona sandbox identity and preview state |
| `public.cloud_secrets` | provider/key-name secret records |

RLS is enabled on all four tables and policies use `auth.uid() = user_id` (or profile id) as the ownership predicate.

![Data, authentication, and isolation model](/images/docs/delta-data-security-model.jpg)

## 6. Workspace lifecycle

### Provision

`POST /api/env/provision` and `POST /api/workspace/create` both resolve to the workspace creation path. The Daytona service attempts to reuse an existing sandbox, otherwise it ensures a per-user volume and creates a sandbox, optionally mounting that volume at `/home/daytona/persist`.

### Activity and idle handling

A 30-minute `InactivityManager` is created at backend startup. API middleware records sandbox activity so the manager can act on idle sandboxes.

### File operations

The backend proxies file list/read/write/mkdir/delete operations through the Daytona service. The frontend uses these handlers to back the file tree and editor UI.

### Preview

The backend exposes both:

- `GET /api/workspace/preview-url`
- `GET /api/preview/url`
- `ANY /api/preview/proxy/:sandboxId/:port/*path`

The frontend listens for `port_detected` events and updates the preview state accordingly.

### VNC and telemetry

The backend exposes VNC start/stop/status routes and telemetry routes that read from the Daytona sandbox. These are surfaced by the workspace UI rather than being standalone services.

## 7. API reference

### Auth

| Method | Path | Implementation |
|---|---|---|
| POST | `/api/auth/register` | `handlers.Register` |
| POST | `/api/auth/signup` | alias of register |
| POST | `/api/auth/login` | `handlers.Login` |
| POST | `/api/auth/logout` | lightweight success response |
| GET | `/api/auth/me` | user/profile + active sandbox |
| POST | `/api/auth/settings` | update user Daytona settings |
| GET | `/api/auth/google/callback` | Google/AGY callback integration |

### Setup and environment

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/env/provision` | provision/reuse workspace |
| GET | `/api/env/status` | sandbox/auth status |
| POST | `/api/env/auth/start` | start Google/AGY auth flow |
| GET | `/api/env/auth/poll` | poll auth state |
| POST | `/api/setup/verify-daytona` | verify Daytona credentials |
| POST | `/api/setup/init-google-auth` | start Google/AGY auth setup |
| POST | `/api/setup/submit-auth-code` | submit auth code |
| POST | `/api/setup/save-google-key` | save Google credential/key data |
| GET | `/api/setup/auth-status/:userId` | check auth state |

### Workspace and files

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/workspace/create` | create workspace |
| GET | `/api/workspace/status/:sandboxId` | sandbox status |
| GET | `/api/workspace/files` | list files |
| GET | `/api/workspace/file-content` | read file |
| POST | `/api/workspace/file-save` | save file |
| POST | `/api/workspace/prompt` | run AGY/OpenCode prompt |
| POST | `/api/workspace/stop` | stop current prompt |
| GET | `/api/workspace/logs` | sandbox logs |
| POST | `/api/workspace/reset` | reset app state |
| GET/POST | `/api/workspace/env` | read/write workspace env |
| POST | `/api/workspace/recreate` | recreate workspace |
| GET | `/api/workspace/preview-url` | preview link |
| POST | `/api/workspace/vnc/start` | start VNC |
| POST | `/api/workspace/vnc/stop` | stop VNC |
| GET | `/api/workspace/vnc/status` | VNC status |
| GET | `/api/workspace/telemetry` | sandbox metrics |

### Low-level file aliases

`/api/fs/list`, `/api/fs/read`, `/api/fs/write`, `/api/fs/mkdir`, and `/api/fs/delete` expose the same underlying workspace file operations.

### Integrations and webhooks

- `GET/POST /api/integrations/secrets`
- `POST /api/webhooks/daytona`

### Realtime

`GET /ws` is the single WebSocket upgrade endpoint used by the frontend to receive real-time events.

## 8. Security and isolation assessment

The design has a useful sandbox boundary, but the current implementation should be described honestly as an MVP:

1. **Strong boundary:** agent shell/process execution is routed to Daytona instead of the local browser host.
2. **Tenant context exists:** request middleware populates `userId` when a token is accepted and activity records include user context.
3. **RLS exists:** the Supabase schema includes per-user policies.
4. **Development looseness remains:** CORS permits `*`, WebSocket origin checks return `true`, and the auth middleware currently allows unauthenticated requests to continue. Client-supplied ids are accepted by multiple endpoints. These are production-hardening items, not features to hide behind marketing copy.
5. **Credential handling needs an audit:** the runtime stores Daytona settings locally and exposes secret-related endpoints. Before production, ensure keys are never returned to the browser unnecessarily and that encrypted secret records have a well-defined key-management path.

## 9. Validation status

The implementation has previously passed the frontend production build. Lint completed with warnings. `go test ./...` was not cleanly verified because the Go build cache under `/home/akshat/.cache/go-build` was read-only in the environment. Backend packages themselves reported no test files during that attempt.

## 10. Source-of-truth rule

When this file conflicts with `implementation_plan.md` or older sections of `detailed-implementation-plan.md`, prefer:

1. current executable code,
2. current route registration in `backend/main.go`,
3. current schema in `supabase/schema.sql`,
4. then planning documents as historical intent.
