# Implementation Plan: "AgentCloud" — A Codex-Cloud-style SaaS wrapper around Antigravity CLI + Daytona Sandboxes

> Audience note: this document is written so that a junior engineer or a "weak" coding model can implement the product end‑to‑end without having to make architectural judgment calls. Every external fact (Daytona behavior, Antigravity CLI behavior) is cited with the exact doc URL it came from. Where the underlying product does not publish a detail (e.g. an internal port number), this is called out explicitly as **"VERIFY AT BUILD TIME"** so the implementer tests it in a real sandbox instead of guessing.

---

## 0. What we are building

A multi-tenant SaaS product where each signed-up user gets **exactly one persistent Daytona Sandbox + one persistent Daytona Volume**. Inside that sandbox we run **Antigravity CLI (`agy`)** — Google's terminal coding agent — driven headlessly by our own Go backend. The React/Vite frontend gives the user a Codex-Cloud/Cursor-Background-Agent-style UI with 5 panels:

1. **Live Preview** — iframes the app running inside the sandbox via a Daytona preview URL.
2. **VNC Access** — embeds a noVNC session so the user can see/drive the sandbox's desktop.
3. **Terminal / Logs** — real-time streamed shell + agent logs via WebSocket.
4. **Telemetry Dashboard** — Grafana-style charts of sandbox CPU/RAM/disk + agent token usage, sourced from Daytona's own metrics/OTel endpoints.
5. **Code Editor** — a VS-Code-like Monaco editor with a collapsible file tree, backed by the Daytona filesystem API.

The single hardest engineering problem in this whole project is **making Antigravity CLI's Google OAuth login survive sandbox restarts** without asking the user to re-authenticate every time. Section 8.3 solves this in detail — read it before writing any other backend code.

---

## 1. High-level architecture

```
┌──────────────────────────┐        HTTPS/WSS        ┌───────────────────────────────┐
│  React + Vite Frontend    │◄────────────────────────►│   Go Backend (single service)  │
│  (Vercel/Netlify/Nginx)   │                          │   - REST API (net/http+chi)    │
│                            │                          │   - WebSocket hub (gorilla/ws) │
│  Panels:                  │                          │   - Postgres (users, sandboxes,│
│   - Chat/Agent runner     │                          │     runs, messages)            │
│   - Live Preview (iframe) │                          │   - Daytona Go SDK client       │
│   - VNC (iframe/noVNC)    │                          │   - JWT auth (users)            │
│   - Terminal (xterm.js)   │                          └───────────────┬────────────────┘
│   - Code editor (Monaco)  │                                          │ Daytona API (HTTPS)
│   - Telemetry (Recharts)  │                                          ▼
└──────────────────────────┘                          ┌───────────────────────────────┐
                                                        │   Daytona Cloud / Self-hosted  │
                                                        │                                │
                                                        │  Per-user Sandbox (Docker VM): │
                                                        │   - agy (Antigravity CLI)      │
                                                        │   - dbus + gnome-keyring       │
                                                        │   - project workspace          │
                                                        │   - Xvfb/xfce4/x11vnc/novnc    │
                                                        │   - dev server (vite/next/etc) │
                                                        │                                │
                                                        │  Per-user Volume (persisted):  │
                                                        │   - ~/.gemini (agy settings +  │
                                                        │     credentials cache)         │
                                                        │   - ~/.local/share/keyrings    │
                                                        │   - /workspace (project code)  │
                                                        └───────────────────────────────┘
```

**Golden rule of the whole architecture:** the frontend **never** talks to Daytona directly and never sees a Daytona API key. Every Daytona operation (create sandbox, run command, stream logs, read/write files, get preview URL, start VNC, fetch metrics) is proxied through the Go backend. This is required for security (Daytona API keys and per-user OAuth credentials must never reach the browser) and is also how Daytona's own preview-URL auth model expects things to work — the backend mints short-lived signed preview URLs for the frontend to embed in iframes. (Source: Daytona Preview & Authentication docs — https://www.daytona.io/docs/en/preview-and-authentication/ and https://www.daytona.io/docs/en/preview/)

---

## 2. Tech stack decisions (explicit, so nobody has to guess)

| Layer | Choice | Why |
|---|---|---|
| Backend language | Go 1.22+ | Requested by user; Daytona ships an official Go SDK (`github.com/daytonaio/daytona/libs/sdk-go`) |
| Backend HTTP router | `chi` (`github.com/go-chi/chi/v5`) | Lightweight, idiomatic, easy for a junior dev/LLM to extend |
| Backend WebSocket | `github.com/gorilla/websocket` | Standard, well documented |
| Backend DB | PostgreSQL 15+ via `pgx` + `sqlc` (or plain `database/sql`) | Needed for users, sessions, sandbox/volume mapping, run history |
| Backend Auth | Email+password (bcrypt) + JWT access/refresh tokens, cookie-based | Simplest correct multi-tenant auth; swap for OAuth later if needed |
| Frontend | React 18 + Vite + TypeScript | Requested by user |
| Frontend styling | Tailwind CSS | Fast to build a VS-Code-like dark UI |
| Code editor | `@monaco-editor/react` | Gives VS Code's actual editor component, incl. syntax highlighting |
| Terminal UI | `xterm.js` + `xterm-addon-fit` + `xterm-addon-attach` | Standard browser terminal, pairs naturally with a WebSocket byte stream |
| Charts | `recharts` | Already available in this environment's component ecosystem; simple line/area/gauge charts for a "Grafana-style" dashboard |
| Realtime transport | WebSocket (one connection per sandbox "workspace" tab, multiplexed by message `type`) | Simpler ops than SSE+WS mix; xterm.js and log tail both want bidirectional/streaming semantics |
| Sandbox provider | Daytona Cloud (`app.daytona.io`) — or self-hosted Daytona per "Bring Your Own Compute" docs if the team wants to run it on their own infra | Requested by user |
| Agent | Antigravity CLI (`agy`) running **inside** the sandbox, invoked by the backend over Daytona's Process/Session API | Requested by user |

---

## 3. Research summary — the load-bearing facts

These are the facts the rest of this plan depends on. Each is cited so you can re-verify if the product changes (both Daytona and Antigravity CLI are actively shipping new releases).

### 3.1 Antigravity CLI (`agy`)

- Installed with `curl -fsSL https://antigravity.google/cli/install.sh | bash` on macOS/Linux, which puts the binary at `~/.local/bin/agy`. Windows has a PowerShell/CMD installer instead. (https://antigravity.google/docs/cli/install)
- **Auth has exactly two flows, no API-key flow exists today:**
  1. *Local keyring sign-in*: on launch, `agy` looks in the OS secret store (Secret Service/dbus on Linux, i.e. gnome-keyring or equivalent) for a cached token. If found, it signs in silently. If not found, it opens a browser for Google Sign-In. (https://antigravity.google/docs/cli/install)
  2. *Remote/SSH OAuth device flow*: when `agy` detects it's running over SSH / in a headless session with no local browser, it prints an authorization URL + one-time code to `stderr`. You open the URL on **any** device, sign in, get shown an alphanumeric code, and paste that code back into the remote terminal to complete the handshake. (https://antigravity.google/docs/cli/install, corroborated by https://dev.to/arindam_1729/antigravity-cli-a-hands-on-guide-to-googles-terminal-coding-agent-5bc7)
  3. **There is no supported `GEMINI_API_KEY` / API-key headless auth today.** This was explicitly requested by the community and explicitly declined by the Antigravity team as of the referenced GitHub issue: *"Gemini API Key is not supported currently... For using an API key in Antigravity you can use the SDK."* (https://github.com/google-antigravity/antigravity-cli/issues/78). Some low-quality blog posts claim env vars like `AV_API_KEY`/`ANTIGRAVITY_API_KEY` exist — treat these as unverified/likely wrong and **do not build the auth pipeline around them**. Always re-check `antigravity.google/docs/cli/install` at build time in case this changes.
  4. Credentials are cleared with the in-TUI `/logout` command. (https://antigravity.google/docs/cli/reference)
- **Headless ("print") mode** is the interface our backend drives:
  - `agy -p "<prompt>"` runs one prompt non-interactively and exits. `stdout` carries only the response; all diagnostics/permission notices go to `stderr`.
  - `--output-format stream-json` emits NDJSON (one JSON object per line): one `init` event, N `step_update` events (types include `user_input`, `agent_response` with incremental `text_delta`, `tool` with `tool_info.name/parameters/output`, `checkpoint`, and `subagent_info` for delegated work), then exactly one terminal `result` event containing `status`, `response`, `usage` (token counts), `duration_seconds`.
  - `--output-format json` gives a single JSON envelope after completion (same fields as the terminal `result` event) — useful for simple fire-and-forget calls, but `stream-json` is what you want for a live "agent is thinking / running commands" UI.
  - `--continue` / `-c` resumes the most recent conversation; `--conversation <id>` resumes a specific one (the id comes from a prior run's `conversation_id`). This is exactly the mechanism to implement multi-turn chat with the agent across separate headless invocations.
  - `--model <slug>`, `--effort low|medium|high`, `--agent <name>` select model/effort/subagent; list available models with `agy models`.
  - Headless mode **does not prompt** for tool permission approval; it consults `permissions.allow` rules in `~/.gemini/antigravity-cli/settings.json`, or you can pass `--dangerously-skip-permissions` to auto-approve everything for that run (only do this inside the sandbox's own isolated filesystem — never on a shared host).
  - `--print-timeout` (default `5m`) bounds how long a single headless run waits.
  - Exit code `0` = success; non-zero + `status: "ERROR"`/`"INTERRUPTED"`/etc. on failure. Full status enum: `SUCCESS, ERROR, CANCELED, INTERRUPTED, INVALID, WAITING, RUNNING`.
  - (All of the above: https://antigravity.google/docs/cli/headless)
- **Settings/permissions file** lives at `~/.gemini/antigravity-cli/settings.json` (note: still under the legacy `~/.gemini` path inherited from Gemini CLI). Key fields we care about: `toolPermission` (`request-review` default, `proceed-in-sandbox`, `always-proceed`, `strict`), `artifactReviewPolicy`, `permissions.allow` (array of rules like `"command(git)"`, `"command(npm run (build|lint|test))"`, `"write_file(src/)"`), `enableTerminalSandbox`. (https://antigravity.google/docs/cli/reference)
- The CLI's own background self-updater writes a debounce/lock file at `~/.gemini/antigravity-cli/updater/`. Set `AGY_CLI_DISABLE_AUTO_UPDATE=true` to stop it from mutating the binary mid-session inside a sandbox (you want a pinned, reproducible version in your base image). (https://antigravity.google/docs/cli/troubleshooting)
- On Linux, credentials are stored via the Secret Service D-Bus API (typically backed by `gnome-keyring`), and the troubleshooting docs explicitly describe a failure mode where *"the background daemon is locked or headless, the CLI cannot read credentials"* — confirming this is a real, common issue we must solve deliberately (see §8.3). (https://antigravity.google/docs/cli/troubleshooting)

### 3.2 Daytona

- **Sandboxes** are Docker/OCI-based isolated compute environments, created/managed via SDKs (Python/TS/Go/Ruby/Java), CLI, or REST API. (https://www.daytona.io/docs/en/, https://www.daytona.io/docs/en/sandboxes/)
- **Go SDK**: `github.com/daytonaio/daytona/libs/sdk-go`. Client construction reads `DAYTONA_API_KEY` (or `DAYTONA_JWT_TOKEN` + `DAYTONA_ORGANIZATION_ID`), `DAYTONA_API_URL` (default `https://app.daytona.io/api`), `DAYTONA_TARGET` (`us`/`eu`) from env, or accepts an explicit config struct. (https://www.daytona.io/docs/en/go-sdk/, https://www.daytona.io/docs/en/api-keys/)
- **API keys**: created per-organization in the dashboard; support **Managed API keys**, where one "manager" key can mint scoped **child keys** (e.g. permissions `write:sandboxes`, `delete:sandboxes`) programmatically without a user JWT — a good fit if you ever want per-tenant-scoped Daytona credentials instead of one shared key. For MVP, one org-wide `DAYTONA_API_KEY` held only by the backend is sufficient since the frontend never calls Daytona directly. (https://www.daytona.io/docs/en/api-keys/)
- **Volumes**: persistent, reusable, S3-backed, FUSE-mounted storage, independent of any sandbox's lifecycle. Create with `daytona.volumes.create(name)` (or the Go equivalent), attach at sandbox-creation time via a `VolumeMount{VolumeId, MountPath}` (optionally with a `Subpath`). Multiple sandboxes *can* mount the same volume, but writes are **not transactional** — concurrent writers can clobber each other ("last write wins"). Since our design gives each user exactly one sandbox at a time, this is a non-issue for us. Free tier: up to 100 volumes per organization, no storage-quota penalty. (https://www.daytona.io/docs/en/volumes/)
- **Sandbox creation params** you'll use: `name`, `image` (or `snapshot`), `resources` (cpu/memory/disk), `envVars`, `labels`, `volumes`, `autoStopInterval` (minutes of inactivity before auto-stop; `0` disables), `autoArchiveInterval`, `autoDeleteInterval`, `networkAllowList`/`networkBlockAll`, `public` (controls whether preview links are publicly reachable without a token). CLI equivalent: `daytona create --snapshot <name> --cpu --memory --disk --env K=V --volume <volId>:<mountPath> --auto-stop <mins>`. (https://mintlify.wiki/daytonaio/daytona/cli/sandbox-commands, https://www.daytona.io/docs/en/typescript-sdk/daytona/)
- **Snapshots** are reusable pre-built base images (think "our own golden AMI") — build one once with `agy`, dbus/gnome-keyring, Node/Python/Go toolchains, git, etc. pre-installed, then create every user sandbox `--snapshot our-agentcloud-base:vX` for fast, predictable cold starts instead of `apt install`-ing on every boot. (https://www.daytona.io/docs/en/snapshots/, https://www.daytona.io/docs/en/declarative-builder/)
- **Preview URLs**: any process listening for HTTP on ports 1–65535 inside the sandbox can be given a preview URL of the form `https://{port}-{sandboxId}.proxy.daytona.works` (or the org's proxy domain). Two variants:
  - *Standard preview URL*: sandbox ID in the URL, a **separate** bearer-style token (`X-Daytona-Preview-Token` header) that resets on every sandbox restart — good for backend-to-backend or `fetch()` calls where you control headers.
  - *Signed preview URL*: the token is embedded directly in the URL (`https://{port}-{token}.{domain}`), persists across restarts until it expires or is revoked, and is exactly what you want for `<iframe src="...">` embedding (Live Preview panel, VNC panel) since an iframe can't attach custom headers. **Always pass `expiresInSeconds` explicitly** (default is a dangerously-short 60s). Port `22222` is reserved for Daytona's own web terminal. If `sandbox.public = true`, no token is required at all (only use this for the Live Preview of genuinely public/demo apps, never for VNC). (https://www.daytona.io/docs/en/preview/, https://www.daytona.io/docs/en/preview-and-authentication/)
- **VNC / Computer Use**: the **default** Daytona sandbox image ships `xvfb`, `xfce4`, `xfce4-terminal`, `x11vnc`, `novnc`, `dbus-x11` and the X11 client libs pre-installed — no extra setup needed as long as you don't switch to a from-scratch custom image without these packages. Programmatically: `sandbox.ComputerUse.Start(ctx)` boots all four VNC processes (Xvfb, xfce4, x11vnc, novnc); `Stop`, `GetStatus`, `GetProcessStatus("novnc")`, `GetProcessLogs`, `RestartProcess` manage them. Desktop resolution is fixed at sandbox-creation time via the `VNC_RESOLUTION` env var (`"1920x1080"` format, default `1024x768`) — it **cannot** be changed on a running sandbox. `Computer Use` also exposes programmatic mouse/keyboard/screenshot/screen-recording control, which is optional bonus functionality (e.g. "let the agent literally click around a GUI app") beyond what was asked for. (https://www.daytona.io/docs/en/vnc-access/, https://www.daytona.io/docs/en/computer-use/)
  - **noVNC's web port**: Daytona does not publish the exact internal port for `novnc` in its public docs. `novnc`/`websockify`'s own upstream convention is port **6080** (this is the default the `novnc_proxy`/`websockify` tooling uses everywhere, confirmed by the noVNC project itself: https://github.com/novnc/novnc, https://github.com/ustcweizhou/noVNC), and third-party write-ups of Daytona's own source (`apps/daemon/pkg/toolbox/computeruse/manager/manager.go`) describe the same 6080 convention. **Treat 6080 as the default to try, but VERIFY AT BUILD TIME**: after calling `ComputerUse.Start`, call `GetProcessStatus("novnc")`/`GetProcessLogs("novnc")` and/or just try `sandbox.GetPreviewLink(ctx, 6080, nil)` and load it — if it 404s, grep the logs for the actual bound port and hard-code that instead.
- **Web Terminal**: Daytona ships its own built-in browser terminal, served through the reserved preview port `22222`. This is a nice-to-have fallback/debug path but our product implements its **own** terminal panel via PTY sessions (see below) so we can theme it and multiplex it with agent output. (https://www.daytona.io/docs/en/preview/)
- **Process & Session API** (this is the backbone of the whole "Terminal / Logs" feature and of how we drive `agy`):
  - `sandbox.Process.ExecuteCommand(ctx, cmd)` — one-shot, blocking, stateless.
  - `sandbox.Process.CreateSession(ctx, sessionID)` then `ExecuteSessionCommand(ctx, sessionID, cmd, runAsync=true)` — a **persistent shell session** you can run multiple commands against and that supports **real-time log streaming** via `GetSessionCommandLogsStream(ctx, sessionID, cmdID, stdoutChan, stderrChan)` (separate stdout/stderr streams since SDK v0.27.0) or a one-shot `GetSessionCommandLogs` snapshot. **This is exactly how we run `agy -p ... --output-format stream-json` and tail its NDJSON output live.** (https://www.daytona.io/docs/en/process-code-execution/, https://www.daytona.io/docs/en/log-streaming/)
  - `sandbox.Process.CreatePty(ctx, id, opts...)` / `ConnectPty(ctx, id)` — full interactive pseudo-terminal with `SendInput`, a `DataChan()`/`onData` callback, `Resize(cols, rows)`, `Kill`, `Wait`. **This is what backs the "real" interactive Terminal panel** (the one the human can type into directly, VS-Code-terminal-style), as distinct from the read-only agent-log tail. (https://www.daytona.io/docs/en/pty/)
- **File System API** (`sandbox.FileSystem` / `sandbox.fs`): `ListFiles(path)`, `GetFileInfo(path)`, `CreateFolder(path, mode)`, `UploadFile`/`UploadFileStream`, `DownloadFile`/`DownloadFileStream`, `DeleteFile(path, recursive)`, `SetFilePermissions`, `SearchFiles(path, globPattern)` (find by filename), `FindFiles(path, contentPattern)` (grep-style content search + line numbers), `ReplaceInFiles`, `MoveFiles`. All operations run through the Daytona API against the sandbox daemon — no shell command execution needed. **This is the entire backend for the file tree + Monaco editor.** (https://www.daytona.io/docs/en/file-system-operations/)
- **Metrics/Telemetry** (backbone of the Telemetry Dashboard panel):
  - `sandbox.GetMetrics(ctx, from, to)` returns a time series of `{timestamp, cpu_used_pct, ...}` samples directly from the SDK — the fastest path to a CPU/RAM/disk chart with zero extra infra. (https://www.daytona.io/docs/en/computer-use/ example + https://www.daytona.io/docs/en/observability/otel-collection/)
  - Organization-level OTel export: configure a sandbox-collection OTLP endpoint once (`PUT /organizations/{orgId}/otel-config` with `endpoint` + `headers`, or via the dashboard's Settings → OpenTelemetry section), and **every sandbox** automatically exports CPU/mem/filesystem metrics, HTTP-span traces, and stdout/stderr logs to that endpoint. Daytona also pushes org-level quota metrics (`daytona.sandbox.used_cpu`, `used_ram`, `used_storage`, `total_cpu`, `total_ram`, `total_storage`) every 60s. Without a configured endpoint, Daytona still retains 3 days of sandbox telemetry queryable via REST: `GET /sandbox/{id}/telemetry/{logs|traces|metrics}?from=...&to=...`. Exact per-sandbox metric names: `daytona.sandbox.cpu.utilization`, `cpu.limit`, `memory.utilization`, `memory.usage`, `memory.limit`, `filesystem.utilization`, `filesystem.usage`, `filesystem.available`, `filesystem.total`. Tag sandboxes with `DAYTONA_SANDBOX_OTEL_EXTRA_LABELS="team=...,env=..."` for extra filter dimensions. (https://www.daytona.io/docs/en/observability/otel-collection/)
  - **MVP recommendation**: poll `GetMetrics` + the `telemetry/metrics` REST endpoint from the Go backend every few seconds and push over the same WebSocket used for logs; skip standing up a real OTel Collector/Prometheus/Grafana stack until you actually need cross-sandbox aggregate dashboards or >3-day retention.

---

## 4. Data model (PostgreSQL)

```sql
-- users of OUR SaaS product
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- exactly one row per user once they've provisioned their environment
CREATE TABLE user_environments (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    daytona_volume_id   TEXT NOT NULL,           -- Daytona Volume ID (persists forever)
    daytona_sandbox_id  TEXT,                    -- Daytona Sandbox ID (nullable: recreated on demand)
    sandbox_state       TEXT NOT NULL DEFAULT 'none', -- none|creating|running|stopped|error
    agy_authenticated   BOOLEAN NOT NULL DEFAULT false, -- has this user completed the one-time agy OAuth flow?
    vnc_resolution      TEXT NOT NULL DEFAULT '1280x800',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one row per agent "task"/conversation (mirrors agy's own conversation_id)
CREATE TABLE agent_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agy_conversation_id TEXT,                    -- filled in after first `agy -p` call returns it
    title             TEXT,
    status            TEXT NOT NULL DEFAULT 'idle', -- idle|running|success|error|interrupted
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one row per turn (both user prompts and agent responses/tool calls), for chat history + audit
CREATE TABLE agent_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,        -- user|agent|tool|system
    step_type   TEXT,                 -- mirrors agy's step_type: user_input|agent_response|tool|checkpoint
    tool_name   TEXT,
    content     TEXT,
    raw_event   JSONB,                -- full raw stream-json event, for debugging/replay
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON agent_messages (run_id, created_at);
CREATE INDEX ON agent_runs (user_id, created_at DESC);
```

Design notes:
- `user_environments` is 1:1 with `users`, enforcing "one sandbox, one volume per user" at the schema level.
- `daytona_sandbox_id` is **nullable** because Daytona sandboxes should auto-stop (and can be fully deleted/recreated) after inactivity to save cost — the **volume** is the durable thing; the sandbox is disposable/recreatable as long as we always mount the same volume back onto a fresh sandbox. Never delete `daytona_volume_id`.
- `agy_authenticated` is the flag the backend checks before attempting any headless `agy -p` call; if false, the UI must first walk the user through the one-time OAuth device-code flow (§8.3.4).

---

## 5. Phase 0 — Prerequisites

1. Create a Daytona account/organization at https://app.daytona.io, create an **API key** (Dashboard → Organization → API Keys — https://www.daytona.io/docs/en/api-keys/). Store it as `DAYTONA_API_KEY` in the backend's secret manager. Never expose it to the frontend.
2. Decide your Daytona `DAYTONA_TARGET` region (`us` or `eu`).
3. Install `go`, `node`+`pnpm`/`npm`, `docker` locally for development.
4. Provision a Postgres instance (local Docker for dev; managed Postgres — RDS/Cloud SQL/Supabase — for prod).
5. Read the Antigravity CLI docs once yourself in a throwaway local VM (not inside Daytona yet) to see the real OAuth prompts before automating them: `curl -fsSL https://antigravity.google/cli/install.sh | bash`, run `agy`, note exactly what the SSH/device-flow output looks like on your CLI version, since the exact wording can change between releases and your regex/parsing in §8.3.4 needs to match the real output.

---

## 6. Phase 1 — Build the base Daytona Snapshot

Building a custom Snapshot avoids re-installing `agy` and desktop packages on every sandbox cold start (Daytona sandboxes otherwise start from a stock image in well under a second — see https://www.daytona.io/docs/en/sandboxes/ — but downloading/installing `agy` and toolchains on every boot would add tens of seconds and unnecessary egress).

Use Daytona's **Declarative Builder** (https://www.daytona.io/docs/en/declarative-builder/) or a plain Dockerfile. Start `FROM` Daytona's own default sandbox image (documented in https://www.daytona.io/docs/en/vnc-access/ as already containing all VNC/Computer-Use packages) so you don't have to hand-install `xvfb/xfce4/x11vnc/novnc/dbus-x11` and the X11 libs yourself — check the current default snapshot name in the Daytona dashboard ("Snapshots" tab) at build time, e.g. `daytonaio/sandbox:<latest-tag>` (the observability doc example uses `daytonaio/sandbox:0.6.0` as an illustrative tag — confirm the current tag in your dashboard before pinning it).

```dockerfile
# agentcloud-base.Dockerfile
FROM daytonaio/sandbox:<CURRENT_TAG>   # VERIFY current tag in Daytona dashboard → Snapshots

USER root

# --- Antigravity CLI ---
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash \
    && ln -sf /root/.local/bin/agy /usr/local/bin/agy

# --- headless keyring stack (see section 8.3) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        dbus-x11 gnome-keyring libsecret-1-0 libsecret-tools \
        git curl ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

# --- common language/runtime toolchains the agent will likely need ---
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- disable agy's own self-updater so the pinned version is reproducible ---
ENV AGY_CLI_DISABLE_AUTO_UPDATE=true

USER daytona
WORKDIR /home/daytona
```

Build it with the Daytona CLI/dashboard and publish it as e.g. `agentcloud-base:1`. Every user sandbox is created with `snapshot: "agentcloud-base:1"` (see §8.2).

---

## 7. Phase 2 — Backend (Go) project layout

```
/backend
  /cmd/server/main.go
  /internal
    /auth        // signup/login/JWT middleware
    /db          // pgx pool, migrations (golang-migrate), sqlc-generated queries
    /daytona     // thin wrapper around the Daytona Go SDK: create/start/stop sandbox, volumes
    /agy         // Antigravity CLI orchestration: bootstrap script, headless invocation, stream-json parser
    /ws          // WebSocket hub: one connection per active browser tab, multiplexed by message "channel"
    /api         // HTTP handlers (chi routers) wiring the above together
  /migrations
  go.mod
```

### 7.1 REST + WebSocket API surface

All routes below are behind the JWT auth middleware (`Authorization: Bearer <token>` or an httpOnly cookie) and scoped to `req.user_id` — a user can only ever touch their own `user_environments` row.

| Method & Path | Purpose |
|---|---|
| `POST /api/auth/signup` | create user, hash password (bcrypt), issue JWT |
| `POST /api/auth/login` | verify password, issue JWT |
| `POST /api/auth/logout` | clear cookie |
| `POST /api/env/provision` | idempotent: create the user's Daytona Volume if missing, create+start a Sandbox from `agentcloud-base` mounting that volume if missing/stopped, run the bootstrap script (§8.3.2). Returns `{sandbox_id, sandbox_state, agy_authenticated}` |
| `GET  /api/env/status` | poll current `sandbox_state` / `agy_authenticated` |
| `POST /api/env/stop` | stop the sandbox (keeps the volume; saves cost) |
| `POST /api/env/auth/start` | kicks off the one-time Antigravity OAuth device-code flow (§8.3.4), returns `{url, code}` for the frontend to show the user |
| `GET  /api/env/auth/poll` | polls whether the OAuth handshake completed |
| `POST /api/runs` | start a new agent run/conversation: `{prompt, model?, effort?}` → creates `agent_runs` row, kicks off headless `agy -p ... --output-format stream-json` in a Daytona session, streams results over WS |
| `POST /api/runs/:id/continue` | send a follow-up prompt in the same conversation (`agy -p ... --continue`) |
| `GET  /api/runs` / `GET /api/runs/:id` | list / fetch run history + messages from Postgres |
| `GET  /api/fs/list?path=` | proxy to `sandbox.FileSystem.ListFiles` |
| `GET  /api/fs/read?path=` | proxy to `DownloadFile`, returns text content for Monaco |
| `PUT  /api/fs/write` `{path, content}` | proxy to `UploadFile` |
| `POST /api/fs/mkdir` / `DELETE /api/fs/delete` / `POST /api/fs/move` | proxy to the matching FS calls |
| `GET  /api/preview/url?port=` | mint a **signed** preview URL (`expiresInSeconds` ~3600) for the given port, for the Live Preview iframe |
| `POST /api/vnc/start` | call `sandbox.ComputerUse.Start`; then mint a signed preview URL for the noVNC port (see §3.2 caveat) |
| `POST /api/vnc/stop` | call `sandbox.ComputerUse.Stop` |
| `GET  /api/telemetry/metrics` | proxy to `sandbox.GetMetrics` (+ optionally the `telemetry/metrics` REST endpoint) for the last N minutes |
| `GET  /ws/terminal` | WebSocket upgrade; backs the interactive Terminal panel via a Daytona PTY session |
| `GET  /ws/run/:id` | WebSocket upgrade; streams stream-json events for a live agent run |

### 7.2 The Daytona wrapper (`internal/daytona`)

```go
package daytona

import (
    "context"
    "github.com/daytonaio/daytona/libs/sdk-go/pkg/daytona"
    "github.com/daytonaio/daytona/libs/sdk-go/pkg/types"
)

type Client struct{ sdk *daytona.Client }

func New() (*Client, error) {
    // reads DAYTONA_API_KEY / DAYTONA_API_URL / DAYTONA_TARGET from env automatically
    c, err := daytona.NewClient()
    if err != nil {
        return nil, err
    }
    return &Client{sdk: c}, nil
}

// EnsureVolume returns the user's persistent volume, creating it on first call.
func (c *Client) EnsureVolume(ctx context.Context, userID string) (string, error) {
    name := "vol-user-" + userID
    if v, err := c.sdk.Volumes.GetByName(ctx, name); err == nil {
        return v.Id, nil
    }
    v, err := c.sdk.Volumes.Create(ctx, name)
    if err != nil {
        return "", err
    }
    return v.Id, nil
}

// EnsureSandbox creates (or reuses/starts) the user's single sandbox, with the
// persistent volume mounted at /home/daytona/persist.
func (c *Client) EnsureSandbox(ctx context.Context, userID, volumeID string) (*daytona.Sandbox, error) {
    sb, err := c.sdk.Get(ctx, "sandbox-user-"+userID) // reuse by deterministic name if it still exists
    if err == nil {
        if sb.State == "stopped" {
            if err := sb.Start(ctx); err != nil {
                return nil, err
            }
        }
        return sb, nil
    }

    return c.sdk.Create(ctx, &types.CreateSandboxFromSnapshotParams{
        SandboxBaseParams: types.SandboxBaseParams{
            Name: "sandbox-user-" + userID,
            EnvVars: map[string]string{
                "AGY_CLI_DISABLE_AUTO_UPDATE": "true",
                "VNC_RESOLUTION":              "1280x800",
            },
            Volumes: []types.VolumeMount{
                {VolumeId: volumeID, MountPath: "/home/daytona/persist"},
            },
            AutoStopInterval: intPtr(30), // auto-stop after 30 min idle to save cost
        },
        Snapshot: "agentcloud-base:1",
    })
}
```

> `sb.State`, method names, and the exact struct field spellings above follow the documented Go SDK shapes (`Create`, `Process.ExecuteCommand`, `FileSystem.*`, `ComputerUse.*`, `GetPreviewLink`/signed preview, `GetMetrics`) as shown across https://www.daytona.io/docs/en/go-sdk/, https://www.daytona.io/docs/en/getting-started/, https://www.daytona.io/docs/en/volumes/, and https://www.daytona.io/docs/en/vnc-access/. **Re-check exact method names against `pkg.go.dev/github.com/daytonaio/daytona` at implementation time** since this is a young, fast-moving SDK — treat the snippets in this plan as "shape of the call," not copy-paste-guaranteed-compiling code.

### 7.3 The `/home/daytona/persist` layout on the volume

This is the single most important directory in the whole system. Everything that must survive a sandbox being stopped/deleted-and-recreated lives here:

```
/home/daytona/persist/
  gemini/                 # -> symlinked to ~/.gemini (agy settings.json, permissions, credential cache refs)
  keyrings/               # -> symlinked to ~/.local/share/keyrings (the actual encrypted secret file)
  workspace/              # the user's actual project code (git repo, node_modules, etc.)
```

We deliberately do **not** mount the volume directly over `/home/daytona` (that would shadow files baked into the Snapshot image, like the `agy` binary install location under `~/.local/bin`, on every mount). Instead the bootstrap script (next section) creates the above three folders on the volume and **symlinks** the relevant dotfile locations into them, every single time the sandbox boots. This is idempotent and safe to re-run.

---

## 8. Phase 2 continued — the Antigravity bootstrap & persistent-auth subsystem

This is the core hard problem: **Antigravity CLI's OAuth token is cached in the Linux Secret Service keyring (gnome-keyring), which normally only exists inside a logged-in desktop session — not in a headless Docker container.** If we do nothing, every sandbox restart would force the user to re-authenticate. We solve this with the standard "headless keyring" pattern used broadly across CI/Docker tooling (see e.g. https://alex-ber.medium.com/using-gnome-keyring-in-docker-container-2c8a56a894f7 and https://bbs.archlinux.org/viewtopic.php?id=283812 for the general technique this section adapts), combined with persisting the keyring's on-disk file on the Daytona Volume.

### 8.1 The trick, in one paragraph

`gnome-keyring-daemon` needs (a) a D-Bus session to talk over, and (b) an unlock passphrase the very first time a keyring is created. Once created, the keyring file (`~/.local/share/keyrings/login.keyring`) is just an encrypted file on disk — **if we persist that file and always unlock it with the same passphrase on every boot, `agy`'s cached OAuth token survives forever**, exactly like a real desktop session that never logs out. We generate one random passphrase per user, store it encrypted in our own Postgres (or a secrets manager), and feed it to `gnome-keyring-daemon --unlock` on every sandbox boot before starting `agy`.

### 8.2 `bootstrap.sh` — runs on every sandbox start (idempotent)

The backend uploads and executes this script (via `sandbox.Process.ExecuteCommand`) immediately after `EnsureSandbox` returns a running sandbox, and before any `agy -p` call.

```bash
#!/usr/bin/env bash
# bootstrap.sh — idempotent, safe to re-run on every sandbox start.
# Invoked as: bootstrap.sh "$KEYRING_PASSPHRASE"
set -euo pipefail
KEYRING_PASS="$1"
PERSIST=/home/daytona/persist
HOME=/home/daytona

mkdir -p "$PERSIST/gemini" "$PERSIST/keyrings" "$PERSIST/workspace"

# --- link the persisted state into the paths agy/gnome-keyring expect ---
mkdir -p "$HOME/.local/share"
rm -rf "$HOME/.gemini"
ln -s "$PERSIST/gemini" "$HOME/.gemini"
rm -rf "$HOME/.local/share/keyrings"
ln -s "$PERSIST/keyrings" "$HOME/.local/share/keyrings"

# --- start a D-Bus session bus (idempotent: skip if already exported by a prior run in this boot) ---
if [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
  eval "$(dbus-launch --sh-syntax)"
  echo "export DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS" >> "$HOME/.bashrc"
fi

# --- unlock (or, on first-ever boot, silently create-and-unlock) the login keyring ---
# printf without newline avoids the trailing \n becoming part of the passphrase.
eval "$(printf '%s' "$KEYRING_PASS" | gnome-keyring-daemon --unlock)"
# also start it as a full daemon so the Secret Service D-Bus name stays registered
gnome-keyring-daemon --start --components=secrets,pkcs11,ssh >/dev/null 2>&1 || true

echo "BOOTSTRAP_OK"
```

Notes tying back to §3.1:
- This exact `dbus-launch` + `printf PASSWORD | gnome-keyring-daemon --unlock` pattern is the documented community workaround for running gnome-keyring headlessly in Docker (see the citations at the top of §8). It is **not** an official Antigravity/Daytona-published recipe — it is standard Linux Secret-Service tooling that `agy` transparently benefits from because `agy` just talks to whatever Secret Service implementation is registered on the session bus (per Antigravity's own troubleshooting doc description of "Linux secret-service via dbus" — https://antigravity.google/docs/cli/troubleshooting).
- **VERIFY AT BUILD TIME**: run this script by hand in a real Daytona sandbox first, then run `agy` interactively and confirm it silently reuses the keyring on a second `stop`/`start` cycle, before wiring it into the automated pipeline. If your Daytona base image's `gnome-keyring-daemon` refuses to run without `--cap-add=IPC_LOCK` (a known Docker gotcha per https://bbs.archlinux.org/viewtopic.php?id=283812), check whether Daytona sandboxes grant this by default; if not, fall back to the `dbus-run-session` variant (also documented in the same thread) which avoids needing that capability for most keyring operations.

### 8.3 Generating and storing the per-user keyring passphrase

```go
// on first-ever provisioning for a user:
pass := generateRandomPassphrase(32) // crypto/rand
encrypted := encryptWithServerKMSKey(pass) // never store plaintext
db.SaveKeyringPassphrase(userID, encrypted)

// on every subsequent sandbox boot:
pass := decryptWithServerKMSKey(db.GetKeyringPassphrase(userID))
daytonaClient.RunBootstrap(ctx, sandbox, pass)
```

Use your cloud provider's KMS (AWS KMS / GCP KMS / age/sops for self-hosted) to encrypt this at rest — it is functionally as sensitive as a password, because whoever holds it can unlock that user's Google OAuth session inside their sandbox.

### 8.4 The one-time Antigravity OAuth flow (device-code / SSH flow)

The very first time a user's sandbox boots, the keyring is empty, so `agy` has nothing to sign in with silently. Because our backend drives `agy` non-interactively over Daytona's Process API (which is effectively an SSH-like remote/headless session with no local browser), **Antigravity CLI will automatically take the remote/SSH OAuth device-code path** described in §3.1 — it prints an authorization URL and one-time code instead of trying to launch a browser. (https://antigravity.google/docs/cli/install)

Implementation:

1. `POST /api/env/auth/start` → backend opens a Daytona **PTY session** (not a one-shot command, because we must send input into the middle of it — see https://www.daytona.io/docs/en/pty/) running plain interactive `agy` (or whatever explicit login sub-command the installed version exposes — check `agy --help` / `agy login` at build time).
2. The backend's `onData` callback buffers PTY output and regex-matches for the authorization URL and code the CLI prints (exact wording must be captured once by hand per the Phase-0 step 5 dry run, since the docs show the *shape* — "prints a unique, secure authorization URL" + "displays a unique alphanumeric authorization code" — but not the literal string template).
3. Backend returns `{url, code}` to the frontend, which shows a modal: *"Open this link and enter the code to connect your Google account."* The user does this on their **own** device/browser (their existing session's browser is Google's UI, wholly outside our app).
4. Frontend polls `GET /api/env/auth/poll`. Backend's PTY `onData` callback watches for the CLI's post-success message (again, capture the exact string once by hand) or simply watches for the interactive prompt to become ready for a normal chat message; either way, treat completion as: PTY still alive, no more "waiting for code" text, and a subsequent test call `agy -p "ping" --output-format json` returns `status: SUCCESS` instead of an auth error.
5. On confirmed success: kill the PTY (`handle.Kill`), set `agy_authenticated = true` in Postgres, and from now on every `agy -p` headless call on this user's sandbox works silently (because the token is now cached in the persisted, unlockable keyring).
6. If the user's sandbox is later fully deleted and recreated (not just stopped/started) against the **same volume**, this whole flow is skipped automatically — the keyring file is still there and still unlocks with the same stored passphrase, so `agy` signs in silently again exactly like a returning desktop user. **This is the entire point of putting `~/.gemini` and `~/.local/share/keyrings` on the persistent Volume instead of the ephemeral sandbox filesystem.**

### 8.5 Driving headless agent runs (the "Chat/Agent" feature, wiring `agy` end to end)

```go
func (s *AgentService) StartRun(ctx context.Context, userID, prompt, model string) (<-chan StreamEvent, error) {
    sandbox, _ := s.daytona.EnsureSandbox(ctx, userID, ...)
    sessionID := "run-" + uuid.NewString()
    s.daytona.CreateSession(ctx, sandbox, sessionID)

    cmd := fmt.Sprintf(
        "cd /home/daytona/persist/workspace && agy -p %s --output-format stream-json --print-timeout 15m",
        shellQuote(prompt),
    )
    if model != "" {
        cmd += " --model " + shellQuote(model)
    }

    cmdResult, _ := s.daytona.ExecuteSessionCommandAsync(ctx, sandbox, sessionID, cmd)

    out := make(chan StreamEvent, 64)
    stdout := make(chan string, 256)
    stderr := make(chan string, 256)
    go s.daytona.StreamSessionLogs(ctx, sandbox, sessionID, cmdResult.CmdID, stdout, stderr)

    go func() {
        defer close(out)
        for line := range stdout {
            var evt StreamEvent // matches agy's {event, init|step_update|result} shape
            if err := json.Unmarshal([]byte(line), &evt); err == nil {
                s.persistEvent(ctx, userID, evt) // write to agent_messages
                out <- evt                        // fan out to the WS hub for this run
            }
        }
    }()
    return out, nil
}
```

- Every `step_update` with `step_type == "tool"` is exactly the data to render as a "🔧 running `npm install`..." line in the Terminal/Logs panel.
- The terminal `result` event's `conversation_id` gets written back onto the `agent_runs` row so the **next** user message in the same run can be sent as `agy -p "<follow-up>" --continue --output-format stream-json` (or `--conversation <id>` if you want to be explicit rather than relying on "most recent").
- Never pass `--dangerously-skip-permissions` by default; instead pre-populate `~/.gemini/antigravity-cli/settings.json`'s `permissions.allow` (via `FileSystem.UploadFile`, written once during bootstrap) with a scoped rule set appropriate for a coding agent, e.g.:

```json
{
  "toolPermission": "proceed-in-sandbox",
  "permissions": {
    "allow": [
      "command(git)",
      "command(npm *)",
      "command(node *)",
      "command(python3 *)",
      "write_file(/home/daytona/persist/workspace/)"
    ]
  }
}
```

  (Schema per https://antigravity.google/docs/cli/reference and the headless-permissions section of https://antigravity.google/docs/cli/headless.) Because the whole sandbox *is* the isolation boundary for this one user, `proceed-in-sandbox` + a scoped allow-list is a reasonable default; tighten or loosen per your own risk tolerance.

### 8.6 Interactive Terminal panel

Distinct from the agent's own log stream: this is a real shell the human can type into. Backend opens `sandbox.Process.CreatePty(ctx, "terminal-"+userID, cols, rows)`, wires `SendInput`/`onData` straight through a WebSocket (`/ws/terminal`) to `xterm.js` + `xterm-addon-attach` on the frontend, and calls `Resize` whenever `xterm-addon-fit` reports a size change. (https://www.daytona.io/docs/en/pty/)

### 8.7 Live Preview panel

Backend detects (or lets the user configure) which port the dev server runs on (e.g. Vite's default `5173`, or whatever the agent's project uses), calls `sandbox.GetSignedPreviewLink(ctx, port, expiresInSeconds=3600)`, and returns that URL to the frontend to drop straight into an `<iframe src=...>`. Because it's a *signed* URL, no custom header is needed and the iframe just works. Re-mint before expiry (poll every ~50 minutes if you used a 1h TTL). If the dev server needs to accept the Daytona proxy's `Host` header (common with Vite/Next dev servers that validate `Host`), configure `server.allowedHosts` (Vite) or equivalent to include the sandbox's proxy domain — exactly as shown in the community walkthrough at https://www.computesdk.com/blog/how-to-run-a-daytona-sandbox/, which sets `allowedHosts: ['.proxy.daytona.work', 'localhost', '127.0.0.1']` in `vite.config.js` for this exact reason. (https://www.daytona.io/docs/en/preview/)

### 8.8 VNC panel

```go
sandbox.ComputerUse.Start(ctx)
status, _ := sandbox.ComputerUse.GetProcessStatus(ctx, "novnc")
url, _ := sandbox.GetSignedPreviewLink(ctx, 6080 /* VERIFY */, 3600)
```

Frontend embeds `url + "/vnc.html?autoconnect=true&resize=scale"` (standard noVNC query params — https://novnc.com/noVNC/docs/EMBEDDING.html) in an iframe. Provide a "Start Desktop" button that calls `POST /api/vnc/start` on demand rather than always running VNC processes (saves sandbox resources when the user only needs the other 4 panels).

### 8.9 Telemetry Dashboard panel

Backend endpoint polls `sandbox.GetMetrics(ctx, time.Now().Add(-15*time.Minute), time.Now())` every 5–10s and relays samples over the run's WebSocket (or a dedicated `/ws/telemetry` channel) as `{timestamp, cpu_pct, mem_pct, mem_bytes, disk_pct}`. Frontend renders with `recharts` `<AreaChart>`/`<LineChart>` (CPU % and Memory % over time) plus simple gauge/stat cards for current values — a lightweight but real "Grafana-style" dashboard with no extra infrastructure. If/when you outgrow this, flip on the org-level OTLP export (§3.2) into a self-hosted OpenTelemetry Collector + Prometheus + Grafana, and either embed real Grafana panels via iframe (Grafana's own embedding/share-panel feature) or keep using Recharts fed by Grafana's HTTP API — both are drop-in upgrades that don't change anything else in this plan.

Also chart the **agent's own token usage** (from each headless run's `result.usage.{input_tokens,output_tokens,thinking_tokens,total_tokens}`) as a second "AI Usage" tab in the same panel — pure Postgres aggregation (`SUM`/`GROUP BY day` over `agent_messages.raw_event->'result'->'usage'`), no external service needed.

---

## 9. Phase 3 — Frontend (React + Vite) structure

```
/frontend
  /src
    /api            // typed fetch/WebSocket client wrapping every backend route in §7.1
    /pages
      Login.tsx
      Signup.tsx
      Dashboard.tsx        // list of past agent_runs, "New Task" button
      Workspace.tsx        // the main IDE-like screen, tabbed panels
    /components
      /workspace
        AgentChatPanel.tsx     // prompt box + streaming step_update timeline (uses /ws/run/:id)
        LivePreviewPanel.tsx   // <iframe> wrapper, refresh button, port selector
        VNCPanel.tsx           // <iframe> wrapper around the noVNC URL, "Start Desktop" button
        TerminalPanel.tsx      // xterm.js bound to /ws/terminal
        TelemetryPanel.tsx     // recharts CPU/RAM/disk + token-usage charts
        EditorPanel.tsx        // FileTree.tsx (collapsible, lazy-loaded via /api/fs/list) + Monaco
      ProvisioningGate.tsx     // shown until /api/env/provision + agy auth flow (§8.4) complete
    /hooks
      useWorkspaceSocket.ts    // one shared WS connection per open workspace, message-type router
    App.tsx
    main.tsx
```

Key UX flow:

1. On first login, `Dashboard.tsx` shows a "Set up your workspace" CTA if `user_environments` doesn't exist yet → calls `POST /api/env/provision`.
2. While `agy_authenticated == false`, `ProvisioningGate.tsx` calls `POST /api/env/auth/start`, shows the returned `{url, code}` in a modal with a "Copy code" button and an "Open link" button (`target=_blank`), and polls `GET /api/env/auth/poll` every 2s until true.
3. Once ready, `Workspace.tsx` renders the 5-tab layout (Chat is the default/home tab, matching Codex Cloud's task-first UX; Preview/VNC/Terminal/Editor/Telemetry are tabs or a resizable split, implementer's choice — Tailwind + a simple flex/grid layout is enough, no need for a heavy docking library for v1).
4. `AgentChatPanel` posts to `/api/runs`, then opens `/ws/run/:id` and renders each `step_update` as a chat bubble or collapsible "tool call" card (mirrors how Antigravity's own IDE renders trajectories — see the `prompt.toggle_trajectory` keybinding concept in https://antigravity.google/docs/cli/reference for UX inspiration).
5. `EditorPanel` lazy-loads the file tree from `/api/fs/list`, opens files into Monaco tabs via `/api/fs/read`, and PUTs back to `/api/fs/write` on save (Ctrl+S) or on a debounce, your choice — ship "Save on Ctrl+S" first, it's simpler to reason about than autosave conflicting with the agent editing the same files.

---

## 10. Phase 4 — End-to-end flows

**Flow A — brand-new user's first task**
1. Signup → `provision` → volume created, sandbox created from `agentcloud-base`, `bootstrap.sh` run, `agy_authenticated=false`.
2. Frontend shows the OAuth modal (§8.4); user completes Google sign-in in their own tab; poll flips `agy_authenticated=true`.
3. User types a prompt in `AgentChatPanel` → `POST /api/runs` → backend runs `agy -p "..." --output-format stream-json` in a Daytona session → events stream to the UI in real time → agent edits files in `/home/daytona/persist/workspace` → `EditorPanel`'s file tree (re-fetched on each `tool` event where `tool_name` looks like a write) shows new/changed files → if the agent started a dev server, `LivePreviewPanel` shows it.

**Flow B — returning user, next day**
1. Login → `Dashboard` shows past runs. User opens the workspace.
2. Backend's `EnsureSandbox` finds no live sandbox (auto-stopped or deleted) → creates a fresh one from `agentcloud-base` mounting the **same** volume → runs `bootstrap.sh` → because the keyring file already exists on the volume and is unlocked with the same stored passphrase, `agy` is **silently authenticated** — no OAuth modal this time. User's `workspace/` files are exactly as they left them (they were on the volume too).

**Flow C — VNC debugging session**
1. User clicks "Start Desktop" in `VNCPanel` → `POST /api/vnc/start` → `ComputerUse.Start` → signed preview URL for the noVNC port → iframe loads a full XFCE desktop the user can click around in real time, e.g. to visually debug a GUI/browser rendering issue the agent introduced.

---

## 11. Phase 5 — Deployment

- **Backend**: single Go binary, containerized, deployed to any container host (Fly.io / Cloud Run / ECS / a plain VM behind nginx). Needs outbound HTTPS to `app.daytona.io` (or your self-hosted Daytona control-plane URL) and to your Postgres instance.
- **Frontend**: static Vite build (`vite build`) served from any static host/CDN (Netlify/Vercel/S3+CloudFront/nginx) or by the Go backend itself for simplicity in v1.
- **WebSockets**: make sure your reverse proxy/load balancer has WS upgrade support and sane idle timeouts (agent runs can legitimately sit "thinking" for minutes — align proxy idle timeout with `--print-timeout`, e.g. both at 15 minutes).
- **Secrets**: `DAYTONA_API_KEY`, Postgres DSN, JWT signing key, and the KMS key used to encrypt per-user keyring passphrases all live in your platform's secret manager — never in source control, never sent to the frontend.
- **Self-hosting Daytona itself** (optional, later): Daytona supports "Bring Your Own Compute" (https://www.daytona.io/docs/en/bring-your-own-compute/) if you eventually want sandboxes running on your own infra instead of Daytona Cloud — the Go SDK usage above is unchanged, you just point `DAYTONA_API_URL` at your own control plane.

---

## 12. Security & multi-tenancy checklist

- [ ] Every `/api/*` handler resolves the target `sandbox_id`/`volume_id` from the **authenticated user's own** `user_environments` row — never from a client-supplied ID. This is the #1 way multi-tenant sandbox products leak data across tenants.
- [ ] `DAYTONA_API_KEY` (and the KMS key) only ever live server-side.
- [ ] Preview URLs handed to the frontend are always **signed, short-TTL** links minted per-request, never the raw Daytona API key or a standing unsigned token.
- [ ] Per-user keyring passphrases are encrypted at rest (KMS) and are never logged.
- [ ] `permissions.allow` in `agy`'s `settings.json` is scoped as tightly as your product needs (§8.5) — don't reach for `--dangerously-skip-permissions` as a first resort.
- [ ] Consider `networkAllowList`/`networkBlockAll` on sandbox creation if you want to restrict what the agent's shell commands can reach on the open internet (https://mastra.ai/reference/workspace/daytona-sandbox documents these Daytona sandbox fields).
- [ ] Rate-limit `POST /api/runs` per user to control Daytona/agent spend.
- [ ] Set a sane `autoStopInterval` (e.g. 30 min) on every sandbox so idle users don't burn compute indefinitely.

---

## 13. Build-order checklist (milestones)

- **M0** — Repo scaffolding: Go module + chi server skeleton; Vite+React+TS+Tailwind skeleton; Postgres + migrations from §4; JWT auth (signup/login) end to end.
- **M1** — Daytona wrapper: `EnsureVolume`, `EnsureSandbox`, run `bootstrap.sh` by hand against a real sandbox, confirm files land correctly on the mounted volume.
- **M2** — Solve auth persistence in isolation: manually run the keyring unlock sequence + one interactive `agy` OAuth login inside a test sandbox, stop/start it, confirm `agy -p "hi" --output-format json` succeeds silently on the second boot **before** writing any of the automated device-code-parsing code.
- **M3** — Automate the OAuth device-code capture (§8.4) end to end through `/api/env/auth/start|poll` + the frontend modal.
- **M4** — Headless agent runs: `/api/runs` + `/ws/run/:id` + `AgentChatPanel`, persisting `agent_messages`.
- **M5** — File System panel: `/api/fs/*` + `FileTree.tsx` + Monaco `EditorPanel`.
- **M6** — Terminal panel: PTY + `/ws/terminal` + `xterm.js`.
- **M7** — Live Preview panel: signed preview URL plumbing + iframe, test against a real Vite dev server started by the agent.
- **M8** — VNC panel: `ComputerUse.Start` + noVNC preview URL (confirm the real port per the §3.2 VERIFY note) + iframe.
- **M9** — Telemetry panel: `GetMetrics` polling + Recharts + token-usage aggregation.
- **M10** — Hardening pass against the §12 checklist, then deploy.

---

## Appendix A — Environment variables

| Var | Consumer | Notes |
|---|---|---|
| `DAYTONA_API_KEY` | Go backend | from Daytona dashboard, org-scoped |
| `DAYTONA_API_URL` | Go backend | default `https://app.daytona.io/api` |
| `DAYTONA_TARGET` | Go backend | `us` or `eu` |
| `DATABASE_URL` | Go backend | Postgres DSN |
| `JWT_SIGNING_KEY` | Go backend | random 256-bit secret |
| `KEYRING_KMS_KEY_ID` | Go backend | used to encrypt per-user gnome-keyring passphrases |
| `AGY_CLI_DISABLE_AUTO_UPDATE` | inside each sandbox | `true`, set at sandbox creation |
| `VNC_RESOLUTION` | inside each sandbox | e.g. `1280x800`, set at sandbox creation (fixed for sandbox lifetime) |
| `DAYTONA_SANDBOX_OTEL_EXTRA_LABELS` | inside each sandbox, optional | e.g. `user_id=...` for telemetry filtering |

## Appendix B — Daytona Go SDK cheat-sheet (method → doc source)

| Need | Call | Source |
|---|---|---|
| Client | `daytona.NewClient()` / `NewClientWithConfig` | go-sdk docs |
| Create sandbox from snapshot | `client.Create(ctx, &types.CreateSandboxFromSnapshotParams{...})` | getting-started, vnc-access |
| Volumes | `client.Volumes.Create/GetByName/List/Delete` | volumes |
| One-shot exec | `sandbox.Process.ExecuteCommand(ctx, cmd)` | process-code-execution |
| Persistent shell + streaming | `CreateSession` → `ExecuteSessionCommand(..., true)` → `GetSessionCommandLogsStream` | process-code-execution, log-streaming |
| Interactive terminal | `Process.CreatePty` / `ConnectPty` / `SendInput` / `Resize` / `Kill` | pty |
| File tree/editor | `FileSystem.ListFiles/GetFileInfo/UploadFile/DownloadFile/DeleteFile/SearchFiles/FindFiles/MoveFiles` | file-system-operations |
| Live Preview URL | `sandbox.GetPreviewLink(ctx, port)` (standard) / signed variant with `expiresInSeconds` | preview, preview-and-authentication |
| VNC | `sandbox.ComputerUse.Start/Stop/GetStatus/GetProcessStatus/GetProcessLogs` | vnc-access, computer-use |
| Metrics | `sandbox.GetMetrics(ctx, from, to)` | observability/otel-collection |

## Appendix C — Antigravity CLI cheat-sheet (flag/file → doc source)

| Need | Flag/Path | Source |
|---|---|---|
| Install | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` | cli/install |
| One-shot prompt | `agy -p "<prompt>"` | cli/headless |
| Streaming machine output | `--output-format stream-json` | cli/headless |
| Continue conversation | `--continue` / `--conversation <id>` | cli/headless |
| Pick model | `--model <slug>` (list via `agy models`) | cli/headless |
| Auto-approve tools (sandboxed only) | `--dangerously-skip-permissions` | cli/headless |
| Timeout | `--print-timeout 15m` | cli/headless |
| Settings/permissions file | `~/.gemini/antigravity-cli/settings.json` | cli/reference |
| Disable self-updater | `AGY_CLI_DISABLE_AUTO_UPDATE=true` | cli/troubleshooting |
| Logout | `/logout` (in-TUI) | cli/reference |

---

## Sources consulted

- Antigravity CLI — Overview: https://antigravity.google/docs/cli/overview
- Antigravity CLI — Installation & Auth: https://antigravity.google/docs/cli/install
- Antigravity CLI — Headless mode: https://antigravity.google/docs/cli/headless
- Antigravity CLI — Reference (slash commands, keybindings, settings.json): https://antigravity.google/docs/cli/reference
- Antigravity CLI — Troubleshooting (keyring/dbus failure modes, self-updater): https://antigravity.google/docs/cli/troubleshooting
- Antigravity CLI GitHub — API-key auth explicitly not supported: https://github.com/google-antigravity/antigravity-cli/issues/78
- Antigravity CLI GitHub Releases: https://github.com/google-antigravity/antigravity-cli/releases
- Antigravity CLI hands-on walkthrough (context/corroboration only): https://dev.to/arindam_1729/antigravity-cli-a-hands-on-guide-to-googles-terminal-coding-agent-5bc7
- Daytona — Docs home: https://www.daytona.io/docs/en/
- Daytona — Getting Started (SDK language support incl. Go): https://www.daytona.io/docs/en/getting-started/
- Daytona — Go SDK reference: https://www.daytona.io/docs/en/go-sdk/ and https://www.daytona.io/docs/en/go-sdk/daytona/
- Daytona — Volumes: https://www.daytona.io/docs/en/volumes/
- Daytona — Preview & Authentication: https://www.daytona.io/docs/en/preview-and-authentication/
- Daytona — Preview (ports, signed vs standard URLs, port 22222): https://www.daytona.io/docs/en/preview/
- Daytona — Custom Preview Proxy: https://www.daytona.io/docs/en/custom-preview-proxy/
- Daytona — VNC Access: https://www.daytona.io/docs/en/vnc-access/
- Daytona — Computer Use: https://www.daytona.io/docs/en/computer-use/
- Daytona — File System Operations: https://www.daytona.io/docs/en/file-system-operations/
- Daytona — Process & Code Execution: https://www.daytona.io/docs/en/process-code-execution/
- Daytona — Pseudo Terminal (PTY): https://www.daytona.io/docs/en/pty/
- Daytona — Log Streaming: https://www.daytona.io/docs/en/log-streaming/
- Daytona — OpenTelemetry Collection (metrics/traces/logs, org OTel config, `GetMetrics`): https://www.daytona.io/docs/en/observability/otel-collection/
- Daytona — API Keys (env vars, Managed API keys): https://www.daytona.io/docs/en/api-keys/
- Daytona — Organizations (OTel config endpoints): https://www.daytona.io/docs/en/organizations/
- Daytona — Sandboxes overview: https://www.daytona.io/docs/en/sandboxes/
- Daytona — Sandbox CLI commands (`--volume`, `--auto-stop`, etc.): https://mintlify.wiki/daytonaio/daytona/cli/sandbox-commands
- Daytona TypeScript SDK — Sandbox creation params reference: https://www.daytona.io/docs/en/typescript-sdk/daytona/
- Daytona via Mastra integration docs (sandbox param shapes, network allow/block lists): https://mastra.ai/reference/workspace/daytona-sandbox
- Daytona via ComputeSDK walkthrough (Vite `allowedHosts` for preview proxy): https://www.computesdk.com/blog/how-to-run-a-daytona-sandbox/
- Daytona GitHub repo (Go SDK usage example): https://github.com/daytonaio/daytona
- noVNC project (default 6080 convention, embedding/query params): https://github.com/novnc/novnc, https://github.com/ustcweizhou/noVNC, https://novnc.com/noVNC/docs/EMBEDDING.html
- Headless gnome-keyring-in-Docker technique (general Linux pattern, not Daytona/Antigravity-specific): https://alex-ber.medium.com/using-gnome-keyring-in-docker-container-2c8a56a894f7, https://bbs.archlinux.org/viewtopic.php?id=283812
