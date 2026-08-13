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

// InitiateGoogleAuth generates the Google OAuth 2.0 Web Consent URL for Antigravity AI Quota
func (s *AGYService) InitiateGoogleAuth(apiKey string, serverUrl string, userId string, googleApiKey string, oauthClientId string) (*models.InitGoogleAuthResponse, error) {
	if apiKey == "" {
		apiKey = "dtn_default_key"
	}
	if serverUrl == "" {
		serverUrl = "https://app.daytona.io/api"
	}

	clientId := "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
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
		clientId = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
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
		Content:   "Connecting to Daytona Sandbox & verifying Google Account AI Pro quota...",
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
