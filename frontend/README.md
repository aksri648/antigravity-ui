# DELTA Frontend

React 19 + Vite 8 + Tailwind CSS frontend for the DELTA cloud IDE.

## Tech Stack

| Dependency | Version | Purpose |
|---|---|---|
| React | 19.2.8 | UI framework |
| TypeScript | 6.0 | Type safety |
| Vite | 8.2.0 | Build tool and dev server |
| Tailwind CSS | 3.4.19 | Utility-first styling |
| Radix UI | various | Headless primitives (dialog, dropdown, tabs, tooltip) |
| Monaco Editor | 4.7.0 | Code editing |
| Supabase JS | 2.112.3 | Auth and cloud persistence client |
| Lucide React | 1.31.0 | Icons |
| Oxlint | 1.75.0 | Linter (replaces ESLint) |

## Commands

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:5173
npm run build     # typecheck + production build to dist/
npm run lint      # run Oxlint
npm run preview   # preview production build locally
```

## Project Structure

```
src/
├── main.tsx                          # React entry point
├── App.tsx                           # Root component (view state machine)
├── App.css                           # Component styles
├── index.css                         # Tailwind + dark theme CSS variables
├── config/
│   ├── api.ts                        # REST/WebSocket URL derivation
│   └── supabase.ts                   # Supabase client init
├── lib/
│   └── utils.ts                      # cn() utility (clsx + tailwind-merge)
├── components/
│   ├── auth/
│   │   └── AuthView.tsx              # Sign in / sign up
│   ├── marketing/
│   │   └── LandingPage.tsx           # Public landing page + docs
│   ├── onboarding/
│   │   └── SetupWizard.tsx           # First-time setup wizard
│   ├── workspace/
│   │   ├── ChatPane.tsx              # Left pane: prompt, messages, tools
│   │   ├── PreviewPane.tsx           # Right pane: iframe, editor, terminal
│   │   ├── HeaderBar.tsx             # Status bar and controls
│   │   ├── FileTree.tsx              # File navigation
│   │   ├── SettingsModal.tsx         # Credentials and preferences
│   │   └── TelemetryView.tsx         # Runtime metrics
│   └── ui/
│       ├── badge.tsx                 # Badge primitive
│       ├── button.tsx                # Button primitive (CVA variants)
│       └── input.tsx                 # Input primitive
├── assets/
│   └── hero.png                      # Landing page hero image
```

## View State Machine

`App.tsx` manages navigation through four views:

```
marketing → auth → setup → workspace
```

- **marketing**: public landing page with interactive architecture documentation
- **auth**: sign in / sign up form
- **setup**: onboarding wizard for Daytona API key and Google Auth
- **workspace**: 30/70 split-screen coding environment

## Environment Variables

Set in `.env` file at `frontend/` root:

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Backend API base URL |
| `VITE_WS_URL` | (derived) | WebSocket URL |
| `VITE_SUPABASE_URL` | (localStorage fallback) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | (localStorage fallback) | Supabase anonymous key |

## UI Components

Reusable primitives in `components/ui/` follow the shadcn/ui pattern:
- Built on Radix UI headless primitives
- Styled with Tailwind CSS + `class-variance-authority`
- Use `cn()` from `lib/utils.ts` for className merging

## Linting

Oxlint is configured in `.oxlintrc.json`. Run `npm run lint` to check. The linter covers React hooks rules, TypeScript patterns, and OXC plugin rules.
