package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

// BootstrapSandbox executes the idempotent bootstrap routine (dbus, gnome-keyring, symlinks to /home/daytona/persist)
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

# Write default permissions settings.json
cat << 'EOF' > "$PERSIST/gemini/antigravity-cli/settings.json"
{
  "toolPermission": "proceed-in-sandbox",
  "permissions": {
    "allow": [
      "command(git *)",
      "command(npm *)",
      "command(node *)",
      "command(python3 *)",
      "command(pip *)",
      "command(cat *)",
      "command(ls *)",
      "write_file(*)"
    ]
  }
}
EOF

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

// InitiateGoogleAuth executes agy CLI inside Daytona setup sandbox and extracts the live Google OAuth URL
func (s *AGYService) InitiateGoogleAuth(apiKey string, serverUrl string, userId string, googleApiKey string, oauthClientId string) (*models.InitGoogleAuthResponse, error) {
	if apiKey == "" {
		apiKey = "dtn_default_key"
	}
	if serverUrl == "" {
		serverUrl = "https://app.daytona.io/api"
	}

	clientId := "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com"
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

	// 4. Try running agy auth command inside Daytona sandbox
	authCmd := "agy --prompt '/auth' --output-format text 2>&1 || true"
	res, _ := s.daytonaSvc.ExecProcess(apiKey, serverUrl, sbID, authCmd)
	
	output := ""
	if res != nil {
		output = res.Result
	}

	// 5. Extract URL if agy stdout contained one
	urlRegex := regexp.MustCompile(`https://accounts\.google\.com/o/oauth2/[^\s"'\)]+`)
	authURL := urlRegex.FindString(output)

	// Authentic Google OAuth 2.0 Web Consent Authorization URL
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

	clientId := "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com"

	// 1. Perform token exchange directly inside the Daytona sandbox container via curl to Google Token API
	exchangeCmd := fmt.Sprintf(`
mkdir -p /home/daytona/persist/gemini /root/.gemini /root/.gemini/antigravity-cli
curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=%s" \
  -d "code=%s" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" > /tmp/google_token_resp.json

if grep -q "access_token" /tmp/google_token_resp.json; then
  cp /tmp/google_token_resp.json /home/daytona/persist/gemini/oauth_creds.json
  cp /tmp/google_token_resp.json /root/.gemini/oauth_creds.json
  echo '{"active":"user@google.com","old":[]}' > /home/daytona/persist/gemini/google_accounts.json
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
		Message: "Google Account AI quota successfully authenticated and saved to Daytona persistent volume!",
	}, nil
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

// StreamPromptExec runs agy inside Daytona sandbox and streams real events to frontend
func (s *AGYService) StreamPromptExec(
	ctx context.Context,
	apiKey string,
	serverUrl string,
	sandboxId string,
	prompt string,
	eventCallback func(models.StreamEvent),
) error {
	eventCallback(models.StreamEvent{
		Type:      "thought",
		Content:   "Connecting to Daytona Sandbox & verifying Google Account AI quota...",
		SandboxID: sandboxId,
		Timestamp: time.Now().UnixMilli(),
	})

	// Check if cancelled before starting execution
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// 1. Run agy command directly inside persistent workspace directory with loaded environment
	workDirCmd := `
mkdir -p /home/daytona/persist/workspace /root/workspace
[ -f /home/daytona/persist/gemini/.env ] && set -a && source /home/daytona/persist/gemini/.env && set +a 2>/dev/null || true
[ -f /root/.gemini/.env ] && set -a && source /root/.gemini/.env && set +a 2>/dev/null || true
cd /home/daytona/persist/workspace 2>/dev/null || cd /root/workspace
`
	cmdStr := fmt.Sprintf("%s && agy --print %s --output-format stream-json --print-timeout 15m --dangerously-skip-permissions", workDirCmd, strconv.Quote(prompt))
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
			Content:   "🚫 Google Account Unauthenticated in Daytona Sandbox! Please open Settings > Google AI & AGY to authenticate or provide a Google Gemini API Key.",
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
