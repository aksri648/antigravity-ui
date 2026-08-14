# DELTA Detailed Implementation & Operations Guide

> This guide is a detailed, implementation-first companion to the repository. It explains the code that exists, how the request path works, what the frontend expects, what Daytona owns, and where production hardening remains. It is intentionally not a speculative build plan.

## 0. Repository map

```text
.
├── backend/
│   ├── main.go
│   ├── handlers/
│   │   ├── auth.go
│   │   ├── chat_history.go
│   │   ├── secrets.go
│   │   ├── setup.go
│   │   ├── webhooks.go
│   │   ├── websocket.go
│   │   └── workspace.go
│   ├── services/
│   │   ├── agy.go
│   │   ├── daytona.go
│   │   ├── inactivity_manager.go
│   │   ├── supabase.go
│   │   └── user_service.go
│   ├── db/
│   └── models/
├── frontend/src/
│   ├── App.tsx
│   ├── config/
│   └── components/
│       ├── auth/
│       ├── marketing/
│       ├── onboarding/
│       └── workspace/
├── agents/
│   ├── orchestrator.py
│   ├── drivers.py
│   ├── app_developer.py
│   ├── llm_deployer.py
│   ├── app_deployer.py
│   └── app_maintainer.py
└── supabase/schema.sql
```

## 1. Runtime startup

`backend/main.go` performs the following sequence:

1. Resolve `PORT` (default `8080`).
2. Resolve `SQLITE_DB_PATH` (default `data/agy_cloud.db`).
3. Initialize SQLite through `db.InitDB`.
4. Build the Gin router.
5. Install CORS.
6. Construct `DaytonaService`, `AGYService`, `UserService`, and `SupabaseService`.
7. Start the WebSocket hub goroutine.
8. Start `InactivityManager` with `30*time.Minute`.
9. Register the `/api` group with `AuthMiddleware` plus activity recording.
10. Register the public `/ws` WebSocket endpoint.

The process then listens on `:<PORT>`.

## 2. Frontend startup and session restoration

`frontend/src/App.tsx` restores local state before the user does anything:

```text
localStorage
 ├── daytona_api_key
 ├── daytona_server_url
 ├── daytona_user_id
 ├── user_email
 ├── user_name
 ├── auth_token
 └── daytona_sandbox_id
```

When an auth token exists, the app calls `GET /api/auth/me`. On success it restores the user profile and active sandbox. When the workspace view opens it fetches persisted chat history.

A long-lived browser WebSocket is established through `getWsUrl()` and reconnects after a three-second delay when it closes.

## 3. Marketing and documentation page

`LandingPage.tsx` is the user-facing narrative layer. The docs section is designed as a source-linked UI: each section names concrete files, routes, and behavior instead of using the older plan's speculative architecture.

The page now presents four new current-code architecture visuals:

| Visual | File | Meaning |
|---|---|---|
| Runtime architecture | `frontend/public/images/docs/delta-runtime-architecture.jpg` | frontend → Go → Daytona → sandbox + persistence |
| Request lifecycle | `frontend/public/images/docs/delta-request-lifecycle.jpg` | prompt → execution → WebSocket → preview |
| Agent/CLI architecture | `frontend/public/images/docs/delta-agent-cli-architecture.jpg` | four Python personas + shared driver abstraction |
| Data/security model | `frontend/public/images/docs/delta-data-security-model.jpg` | auth middleware + SQLite/Supabase + Daytona isolation |

![Runtime architecture](/images/docs/delta-runtime-architecture.jpg)

## 4. Authentication flow

### 4.1 Browser

Auth UI lives under `frontend/src/components/auth/AuthView.tsx`. On success, `App.tsx` receives a token/user object and moves into the workspace.

### 4.2 Backend

`AuthMiddleware` checks:

1. `Authorization: Bearer <token>`.
2. fallback `?token=`.
3. Supabase verification when configured.
4. local JWT validation through `UserService`.

The middleware puts `userId`, email, name, and relevant Daytona configuration into Gin context.

### 4.3 Current hardening gap

The middleware does not reject every unauthenticated request. Several handlers also accept user/sandbox identifiers from query/path parameters. This means the route surface must be hardened before production multi-tenancy is claimed.

## 5. Workspace provisioning

`POST /api/env/provision` and `POST /api/workspace/create` call `CreateWorkspace`.

The Daytona service then:

1. checks for a usable API key;
2. lists sandboxes;
3. returns a usable sandbox when possible;
4. otherwise ensures a per-user volume named `vol-<userId>`;
5. attempts a sandbox create with the volume mounted at `/home/daytona/persist`;
6. falls back to alternate create payloads if the first request fails;
7. persists the active sandbox record through the user service.

The sandbox creation path sets `autoStopInterval: 30` in the request payload.

## 6. Agent execution

### 6.1 Prompt route

The current web path is:

```text
POST /api/workspace/prompt
        │
        ▼
handlers.SendPrompt
        │
        ▼
services.AGYService.StreamPromptExec
        │
        ├── cliEngine = agy
        │      └── agy ... --output-format stream-json
        │
        └── cliEngine = opencode
               └── opencode run ...
        │
        ▼
Daytona sandbox process execution
```

### 6.2 Persistent path

The intended and current runner path is:

```text
/home/daytona/persist/workspace
```

CLI processes change files in that workspace. The frontend does not execute shell commands on the host.

### 6.3 Stream event handling

`AGYService` emits `models.StreamEvent` payloads. The WebSocket hub serializes them to JSON and broadcasts to all connected clients.

`App.tsx` reacts as follows:

- `thought` → append to the last agent message's thought list.
- `tool_start` → add a tool card.
- `token` → append text to the agent response.
- `port_detected` → update preview URL/port state.
- `error` → mark the current agent message as failed.
- `done` → stop the processing indicator.

![Request lifecycle](/images/docs/delta-request-lifecycle.jpg)

## 7. File editing path

The backend exposes both a low-level `/api/fs/*` alias set and workspace-specific endpoints.

```text
FileTree / Editor
      │
      ├── GET  /api/workspace/files
      ├── GET  /api/workspace/file-content
      ├── POST /api/workspace/file-save
      └── /api/fs/list|read|write|mkdir|delete
             │
             ▼
        DaytonaService
             │
             ▼
       sandbox filesystem
```

This provides the Monaco/file-tree portion of the workspace without mounting the sandbox filesystem into the browser directly.

## 8. Preview, VNC, and telemetry

### 8.1 Preview

The Go backend provides a preview URL handler and a generic preview proxy route. When a port is detected during agent execution, the browser updates its preview state.

### 8.2 VNC

The backend exposes start/stop/status endpoints. The implementation delegates VNC lifecycle to Daytona; the frontend surfaces the state in the workspace.

### 8.3 Telemetry

The backend exposes `/api/workspace/telemetry` and `/api/telemetry/metrics`, both backed by Daytona sandbox telemetry retrieval.

## 9. Python agent orchestration layer

`agents/orchestrator.py` implements a clean interface for specialized agent routing. The four personas are deliberately separated:

### App Developer
Focus: requirements, architecture, code generation, and validation.

### LLM Deployer
Focus: traffic profile and model deployment decisions.

### App Deployer
Focus: inspection, containerization, and deployment workflow.

### App Maintainer
Focus: repository ingestion, branch-oriented changes, maintenance, and pull-request workflow.

`agents/drivers.py` keeps these agents independent of the underlying coding CLI. Today it includes AGY, OpenCode, and Claude Code drivers. Claude Code is future-ready rather than being a browser-visible engine in the current `ChatPane`.

![Agent and CLI architecture](/images/docs/delta-agent-cli-architecture.jpg)

## 10. Data model

### 10.1 Supabase

`supabase/schema.sql` defines:

```text
profiles
chat_messages
user_sandboxes
cloud_secrets
```

All four tables have RLS enabled. Ownership is enforced by policies based on `auth.uid()`.

### 10.2 SQLite

The Go backend initializes `backend/data/agy_cloud.db` and uses `db` + user-service code for local persistence/fallback operation.

![Data and isolation model](/images/docs/delta-data-security-model.jpg)

## 11. Secrets and configuration

### Browser configuration

`frontend/src/config/supabase.ts` obtains Supabase URL and anon key from Vite env vars or local storage. `frontend/src/config/api.ts` derives the backend base URL and WebSocket URL.

### Backend configuration

The most visible configuration values include:

- `PORT`
- `SQLITE_DB_PATH`
- Daytona API/server URL values supplied to requests/settings
- Supabase configuration used by `SupabaseService`

### Security posture

The repo contains explicit secret-handling code, but documentation should not imply that every current path is a hardened secret manager. In particular:

- Daytona settings are persisted through user configuration paths.
- the integration-secrets API exists and has an encrypted-value field in Supabase schema.
- CORS and WebSocket origin checks are permissive for development.
- authentication is not enforced uniformly enough for production tenant isolation.

## 12. API reference by subsystem

### Authentication

```text
POST /api/auth/register
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/settings
GET  /api/auth/google/callback
```

### Setup/environment

```text
POST /api/env/provision
GET  /api/env/status
POST /api/env/auth/start
GET  /api/env/auth/poll
POST /api/setup/verify-daytona
POST /api/setup/init-google-auth
POST /api/setup/submit-auth-code
POST /api/setup/save-google-key
GET  /api/setup/auth-status/:userId
```

### Workspace

```text
POST /api/workspace/create
GET  /api/workspace/status/:sandboxId
GET  /api/workspace/files
GET  /api/workspace/file-content
POST /api/workspace/file-save
POST /api/workspace/prompt
POST /api/workspace/stop
GET  /api/workspace/logs
POST /api/workspace/reset
GET  /api/workspace/env
POST /api/workspace/env
POST /api/workspace/recreate
GET  /api/workspace/preview-url
POST /api/workspace/vnc/start
POST /api/workspace/vnc/stop
GET  /api/workspace/vnc/status
GET  /api/workspace/telemetry
```

### Generic file aliases

```text
GET    /api/fs/list
GET    /api/fs/read
PUT    /api/fs/write
POST   /api/fs/mkdir
DELETE /api/fs/delete
```

### Preview/integrations/realtime

```text
GET  /api/preview/url
ANY  /api/preview/proxy/:sandboxId/:port/*path
GET  /api/telemetry/metrics
GET  /api/integrations/secrets
POST /api/integrations/secrets
POST /api/webhooks/daytona
GET  /ws
```

## 13. Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
```

### Backend

```bash
cd backend
go run .
```

Useful environment override:

```bash
PORT=8080 SQLITE_DB_PATH=data/agy_cloud.db go run .
```

### Python layer

The repository does not contain a separate top-level Python packaging/deployment workflow for the agent layer. Treat `agents/` as a reusable orchestration module unless/until it is wired into a service boundary.

## 14. Verification checklist

```text
[ ] frontend build passes
[ ] frontend lint reviewed (warnings addressed as appropriate)
[ ] Go tests/build run with a writable Go build cache
[ ] auth path verified against both configured-Supabase and local-JWT modes
[ ] Daytona sandbox creation verified against a real API key
[ ] volume mount verified at /home/daytona/persist
[ ] AGY stream events verified end-to-end
[ ] OpenCode runner verified end-to-end
[ ] file read/write verified
[ ] preview route verified against a running dev server
[ ] VNC start/status/stop verified in a real sandbox
[ ] telemetry endpoint verified in a real sandbox
[ ] Supabase RLS tested with multiple users before production use
```

## 15. Production hardening checklist

```text
[ ] reject unauthenticated /api requests except explicitly public endpoints
[ ] resolve sandbox ownership server-side instead of trusting client sandbox ids
[ ] narrow CORS to deployed origins
[ ] validate WebSocket origin and bind socket identity to authenticated user
[ ] keep Daytona credentials server-side; minimize browser exposure
[ ] define and test encryption/key management for cloud secrets
[ ] rate-limit agent execution and expensive Daytona actions
[ ] add structured request/audit logging without logging secrets
[ ] add focused Go handler/service tests
[ ] add frontend tests for stream-event state transitions
```

## 16. Source-of-truth hierarchy

When documents disagree, use this order:

1. current executable code,
2. `backend/main.go` route registration,
3. `supabase/schema.sql`,
4. current frontend components/config,
5. planning documents as historical intent.

That hierarchy is intentionally repeated because the repository has accumulated several older design plans that describe components that were never wired into the current runtime.
