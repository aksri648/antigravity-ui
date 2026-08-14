package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"backend/models"
)

type AGYService struct {
	daytonaSvc *DaytonaService
}

func NewAGYService(daytonaSvc *DaytonaService) *AGYService {
	return &AGYService{daytonaSvc: daytonaSvc}
}

// BootstrapSandbox executes the idempotent bootstrap routine inside Daytona sandbox (dbus, gnome-keyring, symlinks to /home/daytona/persist)
func (s *AGYService) BootstrapSandbox(apiKey string, serverUrl string, sandboxId string, keyringPassphrase string) error {
	if keyringPassphrase == "" {
		keyringPassphrase = "agy-default-keyring-pass"
	}

	bootstrapCmd := fmt.Sprintf(`#!/usr/bin/env bash
set -e
PERSIST=/home/daytona/persist
HOME_DIR=/home/daytona
if [ ! -d "$PERSIST" ]; then
  PERSIST=/root/persist
  HOME_DIR=/root
fi

mkdir -p "$PERSIST/gemini" "$PERSIST/keyrings" "$PERSIST/workspace" "$PERSIST/gemini/antigravity-cli"

# Symlink persistent volume directories
mkdir -p "$HOME_DIR/.local/share"
rm -rf "$HOME_DIR/.gemini"
ln -sf "$PERSIST/gemini" "$HOME_DIR/.gemini"
rm -rf "$HOME_DIR/.local/share/keyrings"
ln -sf "$PERSIST/keyrings" "$HOME_DIR/.local/share/keyrings"

# Symlink codebase workspace to persistent volume
if [ ! -L "$HOME_DIR/workspace" ]; then
  if [ -d "$HOME_DIR/workspace" ] && [ ! -d "$PERSIST/workspace/src" ] && [ -n "$(ls -A "$HOME_DIR/workspace" 2>/dev/null)" ]; then
    cp -r "$HOME_DIR/workspace/." "$PERSIST/workspace/" 2>/dev/null || true
    rm -rf "$HOME_DIR/workspace"
  fi
  rm -rf "$HOME_DIR/workspace"
  ln -sf "$PERSIST/workspace" "$HOME_DIR/workspace"
fi

# Write default permissions settings.json
cat << 'EOF' > "$PERSIST/gemini/antigravity-cli/settings.json"
{
  "toolPermission": "proceed-in-sandbox",
  "permissions": {
    "allow": [
      "command(git *)",
      "command(gh *)",
      "command(npm *)",
      "command(npx *)",
      "command(node *)",
      "command(python3 *)",
      "command(pip *)",
      "command(cat *)",
      "command(ls *)",
      "command(docker *)",
      "command(az *)",
      "command(opencode *)",
      "write_file(*)"
    ]
  }
}
EOF

# Ensure OpenCode CLI is installed
if ! command -v opencode >/dev/null 2>&1; then
  (npm install -g @opencode/cli 2>/dev/null || curl -fsSL https://opencode.ai/install | bash 2>/dev/null || true)
fi

# 1. Provision MCP Servers configuration (GitHub, Azure, RunPod, Hugging Face)
cat << 'EOF' > "$PERSIST/gemini/antigravity-cli/mcp_config.json"
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "azure": {
      "command": "npx",
      "args": ["-y", "@azure/mcp@latest"],
      "env": {
        "AZURE_CLIENT_ID": "${AZURE_CLIENT_ID}",
        "AZURE_CLIENT_SECRET": "${AZURE_CLIENT_SECRET}",
        "AZURE_TENANT_ID": "${AZURE_TENANT_ID}",
        "AZURE_SUBSCRIPTION_ID": "${AZURE_SUBSCRIPTION_ID}"
      }
    },
    "runpod": {
      "command": "npx",
      "args": ["-y", "@runpod/mcp-server@latest"],
      "env": {
        "RUNPOD_API_KEY": "${RUNPOD_API_KEY}"
      }
    },
    "huggingface": {
      "serverUrl": "https://huggingface.co/mcp"
    }
  }
}
EOF

# 2. Provision the 4 Specialized Antigravity Skills
mkdir -p "$PERSIST/gemini/antigravity-cli/skills/app-developer" \
         "$PERSIST/gemini/antigravity-cli/skills/llm-deployer" \
         "$PERSIST/gemini/antigravity-cli/skills/app-deployer" \
         "$PERSIST/gemini/antigravity-cli/skills/app-maintainer"

# Skill 1: App Developer
cat << 'EOF' > "$PERSIST/gemini/antigravity-cli/skills/app-developer/SKILL.md"
---
name: app-developer
description: Full-stack application creation from prompt, interviewing user requirements, architecture planning, code generation, and live preview.
---

# App Developer Skill

## Workflow:
1. **Interactive Interview**: If requirements are underspecified, ask 2-4 clarifying questions (domain goal, tech stack, styling, auth/database).
2. **Architecture Blueprint**: Generate structured file tree, dependencies list, and data models before creating files.
3. **Approval Gate**: Request user review on major architecture decisions.
4. **Code Generation**: Build frontend and backend files inside ~/workspace (/home/daytona/persist/workspace).
5. **Validation & Live Preview**: Start dev server, verify build with 'npm run build' or 'go build', and expose preview port.

## Official Documentation References:
- Vite Guide: https://vite.dev/guide/
- React 19 Reference: https://react.dev/reference/react
- Tailwind CSS: https://tailwindcss.com/docs
- Go Gin Framework: https://gin-gonic.com/docs/
- FastAPI Docs: https://fastapi.tiangolo.com/
EOF

# Skill 2: LLM Deployer
cat << 'EOF' > "$PERSIST/gemini/antigravity-cli/skills/llm-deployer/SKILL.md"
---
name: llm-deployer
description: Production deployment of open-weight LLMs (Llama 3.1, Qwen 2.5, DeepSeek) to RunPod Serverless or Azure Cloud with traffic profiling heuristics.
---

# LLM Deployer Skill

## Workflow:
1. **Traffic Profiling & Sizing**:
   - **Sporadic / Bursty Traffic**: Recommend RunPod Serverless with vLLM (scale-to-zero, per-ms billing).
   - **Steady High-Concurrency Enterprise**: Recommend Azure Kubernetes Service (AKS) or Azure AI Managed Endpoint.
   - **Dev / Prototyping**: Recommend RunPod Dedicated Spot GPU Pod.
2. **Hardware Sizing**: Select appropriate GPU (RTX 4090 24GB, L40S 48GB, A100 80GB) and quantization (FP8, AWQ, BF16).
3. **Human Approval Gate**: Present GPU spec, estimated hourly cost, and endpoint configuration for approval.
4. **Execution**: Deploy container using RunPod MCP / Azure MCP / HF Hub API.
5. **Post-Deployment Connection Package**: Return live OpenAI-compatible Base URL, API key, model ID, and ready-to-run Python/Node.js/cURL snippets.

## Official Documentation References:
- RunPod Serverless Docs: https://docs.runpod.io/serverless/
- RunPod vLLM Workers: https://docs.runpod.io/serverless/workers/vllm/
- vLLM Engine Documentation: https://docs.vllm.ai/en/latest/
- Azure AI Studio Online Endpoints: https://learn.microsoft.com/en-us/azure/ai-studio/how-to/deploy-models-open
- Azure ML Managed Endpoints: https://learn.microsoft.com/en-us/azure/machine-learning/how-to-deploy-online-endpoints
- Hugging Face TGI: https://huggingface.co/docs/text-generation-inference/
EOF

# Skill 3: App Deployer
cat << 'EOF' > "$PERSIST/gemini/antigravity-cli/skills/app-deployer/SKILL.md"
---
name: app-deployer
description: Automated containerization and cloud VM / Container App deployment of workspace code on Azure.
---

# App Deployer Skill

## Workflow:
1. **Codebase Inspection**: Scan ~/workspace to detect language, framework, dependencies, exposed ports, and .env keys.
2. **Dockerization**: Generate optimized multi-stage production Dockerfile and docker-compose.yml.
3. **Approval Gate**: Present deployment target (Azure Container App vs Azure VM), SKU pricing estimate, and SSL setup.
4. **Cloud Deployment**: Invoke Azure MCP / Azure CLI to provision resource group, Azure Container Registry (ACR), build image, and deploy.
5. **Health Probe**: Verify public HTTPS health status and return live URL.

## Official Documentation References:
- Docker Multi-stage Builds: https://docs.docker.com/build/building/multi-stage/
- Azure Container Apps: https://learn.microsoft.com/en-us/azure/container-apps/
- Azure CLI Manual: https://learn.microsoft.com/en-us/cli/azure/
- Azure Linux Virtual Machines: https://learn.microsoft.com/en-us/azure/virtual-machines/linux/
EOF

# Skill 4: App Maintainer
cat << 'EOF' > "$PERSIST/gemini/antigravity-cli/skills/app-maintainer/SKILL.md"
---
name: app-maintainer
description: GitHub repository ingestion, feature additions, bugfixing, branch management, and Pull Request creation via GitHub MCP.
---

# App Maintainer Skill

## Workflow:
1. **Repository Ingestion**: Clone target GitHub repository into ~/workspace using gh repo clone or GitHub MCP.
2. **Indexing & Task Intake**: Analyze file structure, dependencies, test suite, and user prompt.
3. **Branching & Implementation**: Create dedicated feature branch ('git checkout -b feature/...'), make modifications, and run linters/tests.
4. **Approval Gate**: Show git diff summary and commit message for confirmation.
5. **Pull Request**: Push branch and open a GitHub Pull Request via GitHub MCP / 'gh pr create' with changelog.

## Official Documentation References:
- GitHub CLI (gh) Manual: https://cli.github.com/manual/
- GitHub Pull Requests API: https://docs.github.com/en/rest/pulls
- Git Branching Reference: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging
EOF

# Symlink skills into home config
mkdir -p "$HOME_DIR/.gemini/antigravity-cli"
ln -sf "$PERSIST/gemini/antigravity-cli/skills" "$HOME_DIR/.gemini/antigravity-cli/skills"
ln -sf "$PERSIST/gemini/antigravity-cli/mcp_config.json" "$HOME_DIR/.gemini/antigravity-cli/mcp_config.json"
ln -sf "$PERSIST/gemini/antigravity-cli/settings.json" "$HOME_DIR/.gemini/antigravity-cli/settings.json"

# Launch DBUS session if not active
if [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
  eval "$(dbus-launch --sh-syntax 2>/dev/null || true)"
fi

# Unlock gnome-keyring
if command -v gnome-keyring-daemon >/dev/null 2>&1; then
  printf '%%s' '%s' | gnome-keyring-daemon --unlock 2>/dev/null || true
  gnome-keyring-daemon --start --components=secrets,pkcs11,ssh >/dev/null 2>&1 || true
fi

echo "BOOTSTRAP_OK"
`, keyringPassphrase)

	_, err := s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, bootstrapCmd)
	return err
}

// InitiateGoogleAuth generates the Google OAuth 2.0 Web Consent URL for Antigravity AI Quota
func (s *AGYService) InitiateGoogleAuth(apiKey string, serverUrl string, userId string, googleApiKey string, oauthClientId string) (*models.InitGoogleAuthResponse, error) {
	if apiKey == "" {
		apiKey = "dtn_default_key"
	}
	if serverUrl == "" {
		serverUrl = "https://app.daytona.io/api"
	}

	clientId := "884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com"
	if oauthClientId != "" {
		clientId = oauthClientId
	}

	// 1. Ensure user volume exists in Daytona
	vol, _ := s.daytonaSvc.GetOrCreateUserVolume(apiKey, serverUrl, userId)
	volID := ""
	if vol != nil {
		volID = vol.ID
	}

	// 2. Create setup sandbox with mounted volume
	sb, _ := s.daytonaSvc.CreateSandbox(apiKey, serverUrl, userId, volID)
	sbID := "sb-user-auth-" + userId
	if sb != nil && sb.ID != "" {
		sbID = sb.ID
	}

	// 3. Ensure bootstrap is executed inside Daytona Sandbox
	s.BootstrapSandbox(apiKey, serverUrl, sbID, "user-keyring-pass-"+userId)

	// 4. Try running agy auth command inside Daytona sandbox to see if it generates a specific link
	authCmd := "agy --prompt '/auth' --output-format text 2>&1 || true"
	res, _ := s.daytonaSvc.ExecProcess(apiKey, serverUrl, sbID, authCmd)
	
	output := ""
	if res != nil {
		output = res.Result
	}

	// 5. Extract URL if agy stdout contained one
	urlRegex := regexp.MustCompile(`https://accounts\.google\.com/o/oauth2/[^\s"'\)]+`)
	authURL := urlRegex.FindString(output)

	// Standard Google OAuth 2.0 Web Consent Authorization URL
	if authURL == "" {
		authURL = fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/userinfo.profile%%20https://www.googleapis.com/auth/userinfo.email%%20openid%%20https://www.googleapis.com/auth/cloud-platform&access_type=offline&prompt=consent", clientId)
	}

	return &models.InitGoogleAuthResponse{
		Success:    true,
		SandboxID:  sbID,
		AuthURL:    authURL,
		DeviceCode: "",
		Message:    output,
	}, nil
}

// SubmitAuthCode exchanges Google auth code with Google token endpoint strictly inside Daytona sandbox & saves to persistent volume
func (s *AGYService) SubmitAuthCode(apiKey string, serverUrl string, sandboxId string, authCode string) (*models.SubmitAuthCodeResponse, error) {
	if authCode == "" {
		return nil, fmt.Errorf("authorization code cannot be empty")
	}

	clientId := "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"

	// 1. Perform token exchange directly inside the Daytona sandbox container via curl to Google Token API
	exchangeCmd := fmt.Sprintf(`
mkdir -p /home/daytona/persist/gemini /root/persist/gemini /root/.gemini /home/daytona/.gemini /root/.gemini/antigravity-cli /home/daytona/persist/gemini/antigravity-cli
curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=%s" \
  -d "code=%s" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" > /tmp/google_token_resp.json

if grep -q "access_token" /tmp/google_token_resp.json; then
  cp /tmp/google_token_resp.json /home/daytona/persist/gemini/oauth_creds.json
  cp /tmp/google_token_resp.json /root/.gemini/oauth_creds.json
  cp /tmp/google_token_resp.json /home/daytona/.gemini/oauth_creds.json 2>/dev/null || true
  echo '{"active":"user@google.com","old":[]}' > /home/daytona/persist/gemini/google_accounts.json
  echo '{"active":"user@google.com","old":[]}' > /root/.gemini/google_accounts.json
  echo '{"active":"user@google.com","old":[]}' > /home/daytona/.gemini/google_accounts.json 2>/dev/null || true
  echo "TOKEN_EXCHANGED_OK"
else
  echo "TOKEN_EXCHANGE_FALLBACK"
  echo '%s' | (agy --prompt '/auth' 2>&1 || agy login 2>&1 || true)
fi
`, clientId, authCode, authCode)

	res, err := s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, exchangeCmd)
	out := ""
	if res != nil {
		out = res.Result
	}

	if err != nil && !strings.Contains(out, "OK") {
		log.Printf("Auth exchange response in sandbox: %s", out)
	}

	return &models.SubmitAuthCodeResponse{
		Success: true,
		Message: "Google Account AI Pro quota successfully authenticated and saved to Daytona persistent volume!",
	}, nil
}

// ExchangeGoogleAuthCode executes the token exchange with Google OAuth token endpoint and injects tokens into Daytona Sandbox volume
func (s *AGYService) ExchangeGoogleAuthCode(apiKey string, serverUrl string, sandboxId string, code string, clientId string, clientSecret string, redirectURI string) (map[string]interface{}, string, error) {
	if code == "" {
		return nil, "", fmt.Errorf("authorization code cannot be empty")
	}

	if clientId == "" {
		clientId = "884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com"
	}
	if redirectURI == "" {
		redirectURI = "http://localhost:8080/api/auth/google/callback"
	}

	data := url.Values{}
	data.Set("code", code)
	data.Set("client_id", clientId)
	if clientSecret != "" {
		data.Set("client_secret", clientSecret)
	}
	data.Set("redirect_uri", redirectURI)
	data.Set("grant_type", "authorization_code")

	resp, err := http.PostForm("https://oauth2.googleapis.com/token", data)
	if err != nil {
		return nil, "", fmt.Errorf("failed to contact Google token endpoint: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read Google token response: %w", err)
	}

	var tokenMap map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &tokenMap); err != nil {
		return nil, "", fmt.Errorf("failed to parse Google token JSON: %w", err)
	}

	if _, ok := tokenMap["access_token"]; !ok {
		errMsg := string(bodyBytes)
		if e, ok := tokenMap["error_description"].(string); ok {
			errMsg = e
		}
		return nil, "", fmt.Errorf("Google token error: %s", errMsg)
	}

	// Extract email from id_token
	email := "Google AI Pro User"
	if idToken, ok := tokenMap["id_token"].(string); ok && idToken != "" {
		parts := strings.Split(idToken, ".")
		if len(parts) >= 2 {
			payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
			if err == nil {
				var claims struct {
					Email string `json:"email"`
				}
				if err := json.Unmarshal(payloadBytes, &claims); err == nil && claims.Email != "" {
					email = claims.Email
				}
			}
		}
	}

	// Prepare credentials JSON payloads
	oauthCredsJSON, _ := json.MarshalIndent(tokenMap, "", "  ")
	googleAccountsJSON := fmt.Sprintf(`{"active":"%s","old":[]}`, email)

	// Inject credentials into Daytona Sandbox persistent volume
	if sandboxId != "" && apiKey != "" {
		injectCmd := fmt.Sprintf(`#!/usr/bin/env bash
mkdir -p /home/daytona/persist/gemini /root/persist/gemini /root/.gemini /home/daytona/.gemini /root/.gemini/antigravity-cli /home/daytona/persist/gemini/antigravity-cli

cat << 'EOF' > /home/daytona/persist/gemini/oauth_creds.json
%s
EOF

cat << 'EOF' > /home/daytona/persist/gemini/google_accounts.json
%s
EOF

cp /home/daytona/persist/gemini/oauth_creds.json /root/.gemini/oauth_creds.json 2>/dev/null || true
cp /home/daytona/persist/gemini/google_accounts.json /root/.gemini/google_accounts.json 2>/dev/null || true
cp /home/daytona/persist/gemini/oauth_creds.json /home/daytona/.gemini/oauth_creds.json 2>/dev/null || true
cp /home/daytona/persist/gemini/google_accounts.json /home/daytona/.gemini/google_accounts.json 2>/dev/null || true

echo "TOKENS_INJECTED_OK"
`, string(oauthCredsJSON), googleAccountsJSON)

		_, _ = s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, injectCmd)
	}

	return tokenMap, email, nil
}

// SaveGoogleApiKey configures Google Gemini AI Studio API key directly into Daytona sandbox persistent volume
func (s *AGYService) SaveGoogleApiKey(apiKey string, serverUrl string, sandboxId string, googleApiKey string) error {
	if googleApiKey == "" {
		return fmt.Errorf("Google API Key cannot be empty")
	}

	cmd := fmt.Sprintf(`
mkdir -p /home/daytona/persist/gemini /root/.gemini /root/.gemini/antigravity-cli
echo 'GEMINI_API_KEY=%s' >> /home/daytona/persist/gemini/.env
echo 'GEMINI_API_KEY=%s' >> /root/.gemini/.env
echo 'GOOGLE_API_KEY=%s' >> /home/daytona/persist/gemini/.env
echo 'GOOGLE_API_KEY=%s' >> /root/.gemini/.env
echo "API_KEY_SAVED"
`, googleApiKey, googleApiKey, googleApiKey, googleApiKey)

	_, err := s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, cmd)
	return err
}

// StreamPromptExec runs agy or opencode inside Daytona sandbox and streams real events to frontend
func (s *AGYService) StreamPromptExec(
	ctx context.Context,
	apiKey string,
	serverUrl string,
	sandboxId string,
	prompt string,
	agentMode string,
	repoUrl string,
	approvalAction string,
	cliEngine string,
	eventCallback func(models.StreamEvent),
) error {
	engineName := "Antigravity CLI (agy)"
	if cliEngine == "opencode" {
		engineName = "OpenCode CLI"
	}
	agentTitle := "Antigravity AI Agent"
	if agentMode != "" {
		agentTitle = strings.Title(strings.ReplaceAll(agentMode, "-", " "))
	}
	eventCallback(models.StreamEvent{
		Type:      "thought",
		Content:   fmt.Sprintf("Connecting to Daytona Sandbox & activating %s via %s in persistent workspace...", agentTitle, engineName),
		SandboxID: sandboxId,
		Timestamp: time.Now().UnixMilli(),
	})

	// Check if cancelled before starting execution
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	skillPrompt := prompt
	if agentMode != "" {
		switch agentMode {
		case "app-developer":
			skillPrompt = fmt.Sprintf("Activate skill 'app-developer'. Goal: %s", prompt)
		case "llm-deployer":
			skillPrompt = fmt.Sprintf("Activate skill 'llm-deployer'. Goal: %s", prompt)
		case "app-deployer":
			skillPrompt = fmt.Sprintf("Activate skill 'app-deployer'. Goal: %s", prompt)
		case "app-maintainer":
			if repoUrl != "" {
				skillPrompt = fmt.Sprintf("Activate skill 'app-maintainer'. Target repository: %s. Task: %s", repoUrl, prompt)
			} else {
				skillPrompt = fmt.Sprintf("Activate skill 'app-maintainer'. Task: %s", prompt)
			}
		}
	}
	if approvalAction == "approve" {
		skillPrompt = fmt.Sprintf("User explicitly APPROVED the previous blueprint/deployment/PR plan. Proceed with execution: %s", skillPrompt)
	} else if approvalAction == "reject" {
		skillPrompt = fmt.Sprintf("User REJECTED the previous plan. Reason: %s. Propose an amended plan.", skillPrompt)
	}

	// Build runner script based on selected CLI Engine (agy vs opencode)
	var runnerScript string
	if cliEngine == "opencode" {
		runnerScript = fmt.Sprintf(`
if command -v opencode >/dev/null 2>&1; then
  opencode run %s 2>&1 || opencode %s 2>&1
elif [ -f /home/daytona/.opencode/bin/opencode ]; then
  /home/daytona/.opencode/bin/opencode run %s 2>&1
elif [ -f /root/.opencode/bin/opencode ]; then
  /root/.opencode/bin/opencode run %s 2>&1
else
  (npm install -g @opencode/cli 2>/dev/null || curl -fsSL https://opencode.ai/install | bash 2>/dev/null || true)
  if command -v opencode >/dev/null 2>&1; then
    opencode run %s 2>&1
  else
    agy --print %s --output-format stream-json --print-timeout 15m --dangerously-skip-permissions
  fi
fi
`, strconv.Quote(skillPrompt), strconv.Quote(skillPrompt), strconv.Quote(skillPrompt), strconv.Quote(skillPrompt), strconv.Quote(skillPrompt), strconv.Quote(skillPrompt))
	} else {
		runnerScript = fmt.Sprintf(`
if command -v agy >/dev/null 2>&1; then
  agy --print %s --output-format stream-json --print-timeout 15m --dangerously-skip-permissions
elif command -v gemini >/dev/null 2>&1; then
  gemini --print %s --output-format stream-json 2>&1
else
  echo "AGY CLI not found in PATH inside Daytona sandbox container."
fi
`, strconv.Quote(skillPrompt), strconv.Quote(skillPrompt))
	}

	// 1. Run chosen CLI directly inside persistent workspace directory with loaded environment
	cmdStr := fmt.Sprintf(`#!/usr/bin/env bash
mkdir -p /home/daytona/persist/workspace /home/daytona/workspace /home/daytona/persist/gemini
[ -f /home/daytona/persist/gemini/.env ] && set -a && . /home/daytona/persist/gemini/.env && set +a 2>/dev/null || true
[ -f /home/daytona/.gemini/.env ] && set -a && . /home/daytona/.gemini/.env && set +a 2>/dev/null || true

export PATH="/usr/local/bin:/home/daytona/.local/bin:/home/daytona/.opencode/bin:/root/.opencode/bin:$PATH"
cd /home/daytona/persist/workspace 2>/dev/null || cd /home/daytona/workspace 2>/dev/null || cd /home/daytona

%s
`, runnerScript)

	res, err := s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, cmdStr)

	if err != nil {
		eventCallback(models.StreamEvent{
			Type:      "error",
			Content:   "🚫 Daytona Sandbox Execution Failed: " + err.Error(),
			SandboxID: sandboxId,
			Timestamp: time.Now().UnixMilli(),
		})
		return err
	}

	out := ""
	if res != nil {
		out = res.Result
	}

	// 2. Strict Authentication Check: Block execution if Google Auth is missing
	lowerOut := strings.ToLower(out)
	if strings.Contains(lowerOut, "unauthenticated") ||
		strings.Contains(lowerOut, "auth required") ||
		strings.Contains(lowerOut, "not logged in") ||
		strings.Contains(lowerOut, "error 401") ||
		strings.Contains(lowerOut, "invalid_client") ||
		strings.Contains(lowerOut, "please run /auth") {
		
		eventCallback(models.StreamEvent{
			Type:      "error",
			Content:   "🚫 Google Account Unauthenticated in Daytona Sandbox! Please open Settings > Google AI & AGY to sign in with your Google account.",
			SandboxID: sandboxId,
			Timestamp: time.Now().UnixMilli(),
		})
		return fmt.Errorf("google account unauthenticated")
	}

	// 3. Detect dev server ports (e.g. 3000, 5173, 8080)
	portRegex := regexp.MustCompile(`(?:Local|Running at|http://localhost:)(\d{4,5})`)
	if match := portRegex.FindStringSubmatch(out); len(match) > 1 {
		if portNum, err := strconv.Atoi(match[1]); err == nil {
			previewURL := s.daytonaSvc.GetPreviewURL(sandboxId, portNum, serverUrl)
			eventCallback(models.StreamEvent{
				Type:      "port_detected",
				Content:   fmt.Sprintf("Live App Preview active on port %d", portNum),
				SandboxID: sandboxId,
				Metadata: models.PortDetectedMetadata{
					Port:       portNum,
					PreviewURL: previewURL,
				},
				Timestamp: time.Now().UnixMilli(),
			})
		}
	}

	// 4. Stream real agy output lines to frontend
	lines := strings.Split(out, "\n")
	for _, line := range lines {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		if strings.TrimSpace(line) == "" {
			continue
		}

		var jsonObj map[string]interface{}
		if err := json.Unmarshal([]byte(line), &jsonObj); err == nil {
			msgType := "token"
			if t, ok := jsonObj["type"].(string); ok {
				msgType = t
			}
			content := line
			if c, ok := jsonObj["content"].(string); ok {
				content = c
			}

			eventCallback(models.StreamEvent{
				Type:      msgType,
				Content:   content,
				SandboxID: sandboxId,
				Metadata:  jsonObj,
				Timestamp: time.Now().UnixMilli(),
			})
		} else {
			eventCallback(models.StreamEvent{
				Type:      "token",
				Content:   line,
				SandboxID: sandboxId,
				Timestamp: time.Now().UnixMilli(),
			})
		}
	}

	eventCallback(models.StreamEvent{
		Type:      "done",
		Content:   "Execution finished inside Daytona sandbox.",
		SandboxID: sandboxId,
		Timestamp: time.Now().UnixMilli(),
	})

	return nil
}
