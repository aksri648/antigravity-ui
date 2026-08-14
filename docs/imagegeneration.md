# DELTA Native Image Generation Pack

Use each prompt in a separate ChatGPT image-generation request. Download the result as a PNG and save it in `frontend/public/images/docs/` under the filename specified for that prompt. All images should use the same visual language so the documentation feels like one designed system.

## Shared visual direction

- Aspect ratio: 16:9 landscape.
- Style: premium developer-tool editorial illustration; dark glassmorphism panels, dimensional but diagrammatic, not a literal product screenshot.
- Palette: near-black charcoal background (`#0c0c0e`), emerald primary glow, cyan and violet supporting accents, restrained warm amber only for alerts/security.
- Typography: only a few large labels if needed. Avoid paragraphs, source code, tiny text, brand logos, watermarks, people, offices, or generic AI imagery.
- Composition: roomy, clear hierarchy, readable when displayed at 900px wide in the documentation panel.

## 1. Execution flow

**Save as:** `frontend/public/images/docs/delta-execution-flow.png`

```text
Use case: infographic-diagram
Asset type: technical documentation figure for a dark developer platform
Primary request: Create a refined conceptual architecture illustration titled with one small readable label “DELTA EXECUTION FLOW”. Show a clear left-to-right loop: developer request in the browser -> DELTA Go control plane -> Daytona micro-VM persistent workspace -> streaming events and live preview returning to the browser. Include a central emerald-lit routing core, a restrained prompt card, terminal execution card, persistent workspace storage, WebSocket signal particles, and a browser preview card. Do not show people. Use only a few large clean labels; do not create dense text or code.
Scene/backdrop: deep near-black charcoal canvas with spacious dark glass panels
Style/medium: premium 3D editorial technical illustration, crisp vector-like forms with real depth, not a screenshot
Composition/framing: 16:9 wide architecture flow; generous margins; readable at 900px wide
Lighting/mood: precise luminous emerald primary glow, cyan accents, subtle violet accents, calm high-end developer-tool mood
Color palette: #0c0c0e charcoal, emerald green, cyan, violet, soft off-white
Constraints: clear visual hierarchy; no brand logos; no watermark; no fake UI text; no clutter
Avoid: people, photorealistic office scenes, excessive arrows, tiny labels, illegible text
```

**Use in:** FDE System Workflow tab. It replaces the first large visual in `LandingPage.tsx` and should have the alt text `DELTA execution flow from prompt to live preview`.

## 2. Control plane and runtime boundary

**Save as:** `frontend/public/images/docs/delta-control-plane-runtime.png`

```text
Use case: infographic-diagram
Asset type: software system-design documentation figure
Primary request: Create a clean layered architectural illustration titled with one small readable label “CONTROL PLANE & RUNTIME”. Divide the composition into three connected zones: Browser UI on the left, DELTA Go/Gin control plane in the center, and isolated Daytona sandbox runtime on the right. In the control plane show small service tiles for auth, workspace/files, agent execution, preview proxy, telemetry, and WebSocket hub. In the sandbox show AGY/OpenCode terminal execution, a persistent mounted workspace, preview port, and VNC/telemetry signals. Make the browser-to-control-plane boundary and control-plane-to-sandbox boundary visually explicit.
Scene/backdrop: near-black charcoal canvas with dark translucent glass panels and fine grid texture
Style/medium: sophisticated editorial infrastructure illustration, semi-3D isometric but simple, not a literal UI screenshot
Composition/framing: 16:9, three broad vertical zones, clear directional data flow, generous negative space
Lighting/mood: central emerald control-plane glow; cyan runtime connections; subtle violet agent accents
Color palette: charcoal, emerald, cyan, violet, off-white
Constraints: only short large labels; no real company logos; no dense code; no watermark
Avoid: people, clouds with logos, generic circuit-board clutter, tiny unreadable text
```

**Use in:** System Design tab. Alt text: `DELTA browser, Go control plane, and Daytona runtime architecture`.

## 3. Data, identity, and isolation

**Save as:** `frontend/public/images/docs/delta-trust-boundaries.png`

```text
Use case: infographic-diagram
Asset type: security and persistence documentation figure
Primary request: Create a polished trust-boundary illustration titled with one small readable label “DATA & ISOLATION”. Show a user identity entering an authentication boundary, then a DELTA control plane, then separate protected storage and compute areas. Depict SQLite as local runtime storage, Supabase as cloud profiles/chat/sandbox/secrets storage with row-level ownership, and a per-user Daytona sandbox with a persistent volume. Use shield, key, storage, and isolated-container motifs. Make the ownership path visually obvious: user identity -> owned records -> owned sandbox -> persistent workspace.
Scene/backdrop: deep black graphite canvas, layered glass security compartments
Style/medium: premium technical editorial illustration, structured, calm, and high-clarity
Composition/framing: 16:9 wide; identity on left; secure control plane in center; storage and isolated sandbox on right
Lighting/mood: emerald protection glow, cyan data connections, small amber warning accent only where useful
Color palette: charcoal, emerald, cyan, muted violet, off-white
Constraints: no company logos, no watermark, no encrypted gibberish, only sparse readable labels
Avoid: people, locks floating without context, red alarm-heavy mood, dense database schemas, tiny text
```

**Use in:** DB Schema & RLS Policies tab. Alt text: `DELTA authentication, persistence, and per-user sandbox isolation model`.

## 4. Agent and CLI ecosystem

**Save as:** `frontend/public/images/docs/delta-agent-ecosystem.png`

```text
Use case: infographic-diagram
Asset type: AI engineering-agent documentation figure
Primary request: Create an elegant hub-and-spoke ecosystem illustration titled with one small readable label “DELTA AGENT ECOSYSTEM”. In the center, show an orchestration core. Around it, place four distinct but harmonious agent cards: App Developer, LLM Deployer, App Deployer, and App Maintainer. Beneath the core, show a pluggable driver layer with two clear options, AGY and OpenCode, leading into a shared Daytona persistent workspace. Convey that every agent can use the same driver contract and workspace context. Use visual metaphors for implementation, model deployment, container deployment, and repository maintenance rather than dense text.
Scene/backdrop: near-black charcoal with floating glass cards and subtle network lines
Style/medium: premium 3D editorial developer-tool art, crisp and spacious, not a screenshot
Composition/framing: 16:9 wide; centered orchestration hub; four agent cards balanced around it; driver layer and workspace across the bottom
Lighting/mood: emerald orchestration core, violet/cyan/blue agent distinctions, cohesive visual system
Color palette: charcoal, emerald, cyan, violet, blue, soft off-white
Constraints: sparse large labels only; no logos or watermark; no people; no fake UI code
Avoid: robot faces, generic brain imagery, cluttered networks, tiny unreadable captions
```

**Use in:** 4 Autonomous Agents tab. Alt text: `DELTA specialized agents, CLI drivers, and shared workspace`.

## Applying the generated files

After the four PNGs are saved, update the documentation image references in `frontend/src/components/marketing/LandingPage.tsx`:

| Documentation tab | Image path |
| --- | --- |
| FDE System Workflow | `/images/docs/delta-execution-flow.png` |
| System Design (HLD & LLD) | `/images/docs/delta-control-plane-runtime.png` |
| DB Schema & RLS Policies | `/images/docs/delta-trust-boundaries.png` |
| 4 Autonomous Agents | `/images/docs/delta-agent-ecosystem.png` |

Also update `system_design.md` if it embeds its corresponding older figures.

> **Note:** The project currently uses the existing JPG images in `frontend/public/images/docs/` rather than the planned PNG replacements. The Mermaid diagrams in the markdown files now serve as the primary architecture visuals.
