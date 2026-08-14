# DELTA Development Guide

Practical guide for local development, data model reference, and production hardening.

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to frontend/dist/
npm run lint     # Oxlint
npm run preview  # preview production build
```

### Backend

```bash
cd backend
go run .         # http://localhost:8080

# with explicit config:
PORT=8080 SQLITE_DB_PATH=data/agy_cloud.db go run .
```

The backend requires no external database for local development. SQLite is created automatically at the configured path.

### Python Agent Layer

The `agents/` directory is a Python package, not a standalone service. Use it as a library:

```python
from agents import AgentOrchestrator

orchestrator = AgentOrchestrator()
result = orchestrator.run(
    agent_mode="app_developer",
    prompt="Build a todo app",
    sandbox_id="abc123",
    api_key="...",
    server_url="https://api.daytona.io"
)
```

No separate deployment or packaging workflow exists for the agent layer currently.

## Data Model

### SQLite Schema

Initialized by `backend/db/db.go` with WAL mode and connection pooling:

| Table | Columns | Purpose |
|---|---|---|
| `users` | id, email, name, password_hash, daytona_* | User accounts + Daytona config |
| `sandboxes` | id, user_id, sandbox_id, status, preview_url | Active sandbox records |
| `chat_messages` | id, user_id, role, content, timestamp | Chat history |
| `user_environments` | id, user_id, key, value | Environment variables |
| `agent_runs` | id, user_id, sandbox_id, prompt, status | Execution history |
| `agent_messages` | id, run_id, role, content, metadata | Agent message records |
| `cloud_secrets` | id, user_id, provider, key_name, encrypted_value | Integration secrets |

### Supabase Schema

Defined in `supabase/schema.sql`. Apply to a Supabase project for cloud persistence:

```sql
-- 4 tables with RLS enabled
profiles          -- auth.uid() = id
chat_messages     -- auth.uid() = user_id
user_sandboxes    -- auth.uid() = user_id
cloud_secrets     -- auth.uid() = user_id
```

All policies enforce `auth.uid() = user_id` (or profile id) as the ownership predicate.

## Environment Variables

### Backend

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server listen port |
| `SQLITE_DB_PATH` | `data/agy_cloud.db` | SQLite database file path |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Backend REST API base URL |
| `VITE_WS_URL` | (derived from API URL) | WebSocket URL |
| `VITE_SUPABASE_URL` | (from localStorage) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | (from localStorage) | Supabase anonymous key |

## Key Source Files

### Backend (`backend/`)

| File | Lines | Purpose |
|---|---|---|
| `main.go` | 157 | Server entry, service init, route registration |
| `db/db.go` | -- | SQLite init, WAL mode, schema migrations |
| `models/models.go` | 288 | All DTOs, request/response structs, StreamEvent |
| `handlers/auth.go` | -- | Auth middleware, register, login, settings |
| `handlers/workspace.go` | -- | Workspace CRUD, file ops, prompt, preview |
| `handlers/websocket.go` | -- | Gorilla WebSocket broadcast hub |
| `handlers/chat_history.go` | -- | Chat message CRUD |
| `handlers/setup.go` | -- | Daytona verification, Google auth flow |
| `handlers/secrets.go` | -- | Integration secrets management |
| `handlers/webhooks.go` | -- | Daytona webhook handler |
| `services/daytona.go` | 770 | Daytona REST API client |
| `services/agy.go` | 673 | Sandbox bootstrap, CLI execution, stream parsing |
| `services/user_service.go` | -- | User and sandbox record CRUD |
| `services/supabase.go` | -- | Supabase client integration |
| `services/inactivity_manager.go` | -- | 30-min idle sandbox timeout |

### Frontend (`frontend/src/`)

| File | Lines | Purpose |
|---|---|---|
| `main.tsx` | -- | React entry point |
| `App.tsx` | 689 | Root component, view state machine, WebSocket, all top-level state |
| `components/auth/AuthView.tsx` | -- | Sign in / sign up |
| `components/marketing/LandingPage.tsx` | -- | Public landing page + interactive docs |
| `components/onboarding/SetupWizard.tsx` | -- | First-time setup wizard |
| `components/workspace/ChatPane.tsx` | -- | Left pane: prompt, messages, thoughts, tools |
| `components/workspace/PreviewPane.tsx` | -- | Right pane: iframe, editor, terminal |
| `components/workspace/HeaderBar.tsx` | -- | Workspace status and controls |
| `components/workspace/FileTree.tsx` | -- | File navigation tree |
| `components/workspace/SettingsModal.tsx` | -- | Credentials and preferences |
| `components/workspace/TelemetryView.tsx` | -- | Runtime metrics display |
| `config/api.ts` | -- | REST and WebSocket URL config |
| `config/supabase.ts` | -- | Supabase client initialization |
| `lib/utils.ts` | -- | `cn()` className merge utility |

### Agents (`agents/`)

| File | Purpose |
|---|---|
| `__init__.py` | Package exports |
| `orchestrator.py` | Central dispatch to agent personas |
| `drivers.py` | Abstract `CodingCliDriver` + 3 implementations |
| `app_developer.py` | Requirements, architecture, code generation |
| `llm_deployer.py` | Traffic profiling, model deployment |
| `app_deployer.py` | Containerization and cloud deployment |
| `app_maintainer.py` | Repo ingestion, branch management, PRs |

## Verification Checklist

```
Frontend
  [ ] npm run build passes
  [ ] npm run lint reviewed (warnings addressed)
  [ ] Auth flow works (login → workspace)
  [ ] Setup wizard completes (Daytona key + Google Auth)
  [ ] WebSocket connects and receives events
  [ ] Preview iframe updates on port_detected

Backend
  [ ] go run . starts without errors
  [ ] SQLite migrations apply cleanly
  [ ] Auth middleware validates tokens
  [ ] Daytona sandbox creation succeeds
  [ ] Volume mount verified at /home/daytona/persist
  [ ] AGY stream events flow end-to-end
  [ ] OpenCode runner works end-to-end
  [ ] File read/write operations work
  [ ] Preview proxy routes traffic to sandbox port

Integration
  [ ] Supabase RLS tested with multiple users
  [ ] Chat history persists across sessions
  [ ] Inactivity manager stops idle sandboxes
```

## Production Hardening Checklist

```
Security
  [ ] Reject unauthenticated /api requests except public endpoints
  [ ] Resolve sandbox ownership server-side (don't trust client IDs)
  [ ] Narrow CORS to deployed origins
  [ ] Validate WebSocket origin; bind socket to authenticated user
  [ ] Keep Daytona credentials server-side only
  [ ] Define encryption/key management for cloud_secrets
  [ ] Rate-limit agent execution and expensive Daytona operations

Reliability
  [ ] Add structured request/audit logging (no secret logging)
  [ ] Add focused Go handler/service tests
  [ ] Add frontend tests for stream-event state transitions
  [ ] Add error recovery for Daytona API failures
  [ ] Add WebSocket reconnection with exponential backoff
```

## Source-of-Truth Hierarchy

When documentation and code disagree, trust in this order:

1. Executable code
2. Route registration in `backend/main.go`
3. Schema in `supabase/schema.sql`
4. Frontend components and config
5. Planning documents (historical intent only)
