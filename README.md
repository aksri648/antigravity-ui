# DELTA • Autonomous Forward Deployed Engineering (FDE) Platform

[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-emerald.svg)](#)
[![Stack: Go + React](https://img.shields.io/badge/Stack-Go%20%7C%20React%2019%20%7C%20PostgreSQL-blue.svg)](#)
[![Auth: Clerk](https://img.shields.io/badge/Auth-Clerk%20JWT-purple.svg)](#)
[![Observability: Grafana & DeepEval](https://img.shields.io/badge/Observability-Grafana%20%7C%20DeepEval-orange.svg)](#)

An enterprise-grade, autonomous multi-agent cloud IDE and Forward Deployed Engineering (FDE) platform. DELTA empowers developers to describe product requirements in natural language, decompose architectures, spin up isolated cloud micro-VM sandboxes via Daytona, and execute full-stack coding, real-time debugging, and cloud deployments with live telemetry and agent trajectory evaluations.

> **Note**: This project is **source-available** for viewing purposes only. All rights are reserved by the copyright holder. See [LICENSE](LICENSE) for details.

---

## 🌐 Live Production Deployments

| Component | Description | Live Endpoint |
|---|---|---|
| 🚀 **DELTA SaaS Platform** | Main Web IDE & Cloud Sandbox Orchestration | [https://antigravity-ui-cx0g.onrender.com](https://antigravity-ui-cx0g.onrender.com) |
| 📊 **Platform Telemetry & AI Eval** | Grafana System Observability & DeepEval Benchmarks | [https://delta-telemetry.onrender.com](https://delta-telemetry.onrender.com) |
| ⚡ **Keep-Alive Cron Worker** | Cloudflare Global Edge 13-Minute Ping Trigger | [https://delta-keepalive-worker.akshatsri648.workers.dev](https://delta-keepalive-worker.akshatsri648.workers.dev) |
| 🐘 **Managed Database** | PostgreSQL 16 Connection Pool on Render | Internal / Managed |

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Clients["Presentation & Observability Layer"]
        UI["Main SaaS IDE (React 19 / Vite / Tailwind)"]
        Telemetry["Telemetry Dashboard (Grafana Pro / DeepEval)"]
    end

    subgraph Edge["Global Edge & Keep-Alive"]
        CFWorker["Cloudflare Cron Worker<br/>(13-min */13 keep-alive ping)"]
        Clerk["Clerk Auth Provider<br/>(JWT & Session Tokens)"]
    end

    subgraph ControlPlane["Go 1.25 Control Plane (Render Web Service)"]
        AuthMiddleware["Universal CORS & Clerk Auth Validator"]
        API["Gin REST Endpoints<br/>(/api/telemetry, /api/workspace, /api/auth)"]
        WSHub["Gorilla WebSocket Hub<br/>(/ws real-time token stream)"]
        EvalEngine["DeepEval / Phoenix Trajectory Evaluator"]
        DaytonaOrchestrator["Daytona SDK Orchestrator"]
        InactivityWatchdog["30-Min Inactivity Auto-Persist Watchdog"]
    end

    subgraph DataStore["Data & Persistence Layer"]
        Postgres[(Render Managed PostgreSQL 16<br/>20-connection pool)]
        SQLite[(Local Embedded Cache)]
    end

    subgraph Sandboxes["Per-User Daytona Micro-VMs"]
        Volume["/home/daytona/persist<br/>(Persistent Project Volumes)"]
        Runtime["AGY & OpenCode CLI Swarm"]
        DevServer["Vite / Next.js / FastAPI Live Preview Proxy"]
    end

    UI -- "HTTPS / WSS" --> AuthMiddleware
    Telemetry -- "HTTPS (/api/telemetry)" --> AuthMiddleware
    CFWorker -- "GET /api/health" --> AuthMiddleware
    Clerk -.-> AuthMiddleware

    AuthMiddleware --> API
    AuthMiddleware --> WSHub
    API --> EvalEngine
    API --> Postgres
    API --> SQLite
    API --> DaytonaOrchestrator
    InactivityWatchdog --> DaytonaOrchestrator

    DaytonaOrchestrator -- "Daytona REST API" --> Volume
    Volume --> Runtime
    Runtime --> DevServer
```

---

## ⚡ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend IDE** | React 19, TypeScript, Vite 8, Tailwind CSS v3, Radix UI, Monaco Editor, Lucide Icons, Cytoscape, Mermaid.js |
| **Telemetry Dashboard** | Standalone React 19 SPA, Tailwind CSS v3, shadcn UI design system, Grafana Pro Dark Theme |
| **Backend Control Plane** | Go 1.25, Gin Router, Gorilla WebSockets, `lib/pq` PostgreSQL Driver, Pure-Go SQLite |
| **Authentication** | Clerk Authentication (`@clerk/react` & Backend API REST verification) |
| **Database** | Managed PostgreSQL 16 on Render (Connection pooling up to 20 conns, auto-migrations) |
| **Cloud Sandboxes** | Daytona Micro-VMs with attached persistent storage (`/home/daytona/persist`) |
| **Edge Keep-Alive** | Cloudflare Workers Cron Trigger (`*/13 * * * *`) |
| **AI Agent Evaluation** | DeepEval (v1.6.2) & Arize Phoenix OpenTelemetry trajectory benchmarks |

---

## 🤖 The 4 Autonomous Agent Personas

1. 💻 **App Developer Agent**:
   - Gathers product requirements, scaffolds multi-framework codebases, and executes sandbox builds.
   - *DeepEval Score: 96.5% Task Completion, 98.8% Tool Accuracy.*
2. 🚀 **LLM Deployer Agent**:
   - Collects throughput and latency SLAs, provisions serverless RunPod or Azure GPU nodes, and returns OpenAI-compatible endpoints.
   - *DeepEval Score: 95.2% Task Completion, 97.8% Tool Accuracy.*
3. 🐳 **App Deployer Agent**:
   - Generates production Dockerfiles, spins up cloud VMs, and deploys scalable web applications.
   - *DeepEval Score: 94.4% Task Completion, 98.1% Tool Accuracy.*
4. 🔧 **App Maintainer Agent**:
   - Clones GitHub repositories, isolates features on git branches, generates bugfixes with tests, and submits Pull Requests.
   - *DeepEval Score: 93.1% Task Completion, 98.2% Tool Accuracy.*

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Node.js 18+ and `npm`
- Go 1.25+
- A Daytona API Key ([daytona.io](https://daytona.io))
- A Clerk Publishable & Secret Key ([clerk.com](https://clerk.com))

### 1. Run Backend Server
```bash
cd backend
go run .
# Server starts on http://localhost:8080
```

### 2. Run Frontend IDE
```bash
cd frontend
npm install
npm run dev
# Vite dev server running on http://localhost:5173
```

### 3. Run Standalone Telemetry Dashboard
```bash
cd telemetry-dashboard
npm install
npm run dev
# Grafana Telemetry running on http://localhost:5174
```

---

## 🔐 Environment Variables

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Backend listen port | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/dbname` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `https://delta-telemetry.onrender.com,...` |
| `CLERK_PUBLISHABLE_KEY` | Clerk Frontend Publishable Key | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk Backend Secret Key | `sk_test_...` |
| `DAYTONA_SERVER_URL` | Daytona Cloud API endpoint | `https://app.daytona.io/api` |
| `DAYTONA_API_KEY` | Default Daytona API Key | `dtn_...` |
| `JWT_SECRET` | Fallback local JWT signing secret | `your-secret-key` |

---

## 📡 Key API Endpoints

### Platform Observability & Telemetry
- `GET  /api/health` - Container health and Daytona connection status
- `GET  /api/telemetry` - Real-time Linux `/proc/stat` CPU, RAM, Disk, and DB connection pool stats
- `GET  /api/telemetry/ai-eval` - DeepEval & Phoenix Agent reliability metrics and benchmarks
- `POST /api/telemetry/ai-eval/run` - Real-time agent trajectory evaluation runner

### SaaS Authentication & Workspace
- `POST /api/auth/register` - User registration (Clerk / Local JWT)
- `POST /api/auth/login` - User authentication
- `GET  /api/auth/me` - Authenticated user profile & Daytona credentials
- `POST /api/workspace/prompt` - Dispatch natural language prompt to autonomous agents
- `GET  /api/workspace/files` - List workspace directory file tree
- `GET  /api/deployments/summary` - Aggregate summary of deployed LLMs and applications
- `GET  /ws` - Gorilla WebSocket token streaming channel

---

## 📄 License

Proprietary. Source-available for evaluation and viewing purposes only.
