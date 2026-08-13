package services

import (
	"context"
	"encoding/json"
	"fmt"
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

// InitiateGoogleAuth executes agy CLI inside Daytona setup sandbox and extracts the live Google OAuth URL & Device Code
func (s *AGYService) InitiateGoogleAuth(apiKey string, serverUrl string, userId string, googleApiKey string, oauthClientId string) (*models.InitGoogleAuthResponse, error) {
	// 1. Ensure user volume exists
	vol, err := s.daytonaSvc.GetOrCreateUserVolume(apiKey, serverUrl, userId)
	if err != nil {
		return nil, fmt.Errorf("failed to create user auth volume: %v", err)
	}

	// 2. Create setup sandbox with mounted volume
	sb, err := s.daytonaSvc.CreateSandbox(apiKey, serverUrl, userId, vol.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create setup sandbox: %v", err)
	}

	// 3. Ensure agy CLI is installed inside Daytona sandbox
	installCmd := "mkdir -p /root/.gemini && (which agy || npm install -g @google-antigravity/cli || pip install google-antigravity || true)"
	s.daytonaSvc.ExecProcess(apiKey, serverUrl, sb.ID, installCmd)

	// 4. Run agy auth trigger command inside Daytona sandbox
	authCmd := "agy --prompt '/auth' --output-format text"
	res, err := s.daytonaSvc.ExecProcess(apiKey, serverUrl, sb.ID, authCmd)
	
	output := ""
	if res != nil {
		output = res.Result
	}

	// 5. Extract Google OAuth URL and Device Code from agy stdout inside Daytona sandbox
	urlRegex := regexp.MustCompile(`https://accounts\.google\.com/o/oauth2/[^\s"'\)]+`)
	codeRegex := regexp.MustCompile(`[A-Z0-9]{4}-[A-Z0-9]{4}`)

	authURL := urlRegex.FindString(output)
	deviceCode := codeRegex.FindString(output)

	return &models.InitGoogleAuthResponse{
		Success:    true,
		SandboxID:  sb.ID,
		AuthURL:    authURL,
		DeviceCode: deviceCode,
		Message:    output,
	}, nil
}

// SubmitAuthCode feeds the user's pasted Google Auth response code to agy inside Daytona sandbox & persists both keys to the Volume
func (s *AGYService) SubmitAuthCode(apiKey string, serverUrl string, sandboxId string, authCode string) (*models.SubmitAuthCodeResponse, error) {
	if authCode == "" {
		return nil, fmt.Errorf("authorization code cannot be empty")
	}

	// 1. Save Daytona API Key configuration directly into the persistent Volume
	saveConfigCmd := fmt.Sprintf("mkdir -p /root/.gemini/antigravity-cli && echo '{\"daytonaApiKey\":\"%s\",\"serverUrl\":\"%s\",\"updatedAt\":\"%s\"}' > /root/.gemini/daytona_config.json", apiKey, serverUrl, time.Now().Format(time.RFC3339))
	s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, saveConfigCmd)

	// 2. Submit pasted authorization code to agy CLI inside Daytona sandbox
	submitCmd := fmt.Sprintf("echo '%s' | agy --prompt '/auth' || agy --prompt 'login %s'", authCode, authCode)
	res, err := s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, submitCmd)

	out := ""
	if res != nil {
		out = res.Result
	}

	// 3. Ensure credentials in /root/.gemini are copied across persistent subdirectories
	syncVolCmd := "mkdir -p /root/.gemini/antigravity-cli && cp -r /root/.config/antigravity* /root/.gemini/ 2>/dev/null || true"
	s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, syncVolCmd)

	if err != nil && !strings.Contains(out, "success") {
		return nil, fmt.Errorf("failed to complete auth inside Daytona sandbox: %v", err)
	}

	return &models.SubmitAuthCodeResponse{
		Success: true,
		Message: "Daytona API Key & Google OAuth session permanently saved to user volume (/root/.gemini)!",
	}, nil
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

	// 1. Run agy command directly inside the Daytona sandbox
	cmdStr := fmt.Sprintf("agy --print %s --output-format stream-json --dangerously-skip-permissions", strconv.Quote(prompt))
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
			Content:   "🚫 Google Account Unauthenticated in Daytona Sandbox! agy requires you to authorize your Google Account first. Please click 'Config' to complete Google Login.",
			SandboxID: sandboxId,
			Timestamp: time.Now().UnixMilli(),
		})
		return fmt.Errorf("google account unauthenticated")
	}

	// 3. Detect dev server ports (e.g. 3000, 5173, 8080)
	portRegex := regexp.MustCompile(`(?:Local|Running at|http://localhost:)(\d{4,5})`)
	if match := portRegex.FindStringSubmatch(out); len(match) > 1 {
		if portNum, err := strconv.Atoi(match[1]); err == nil {
			previewURL := s.daytonaSvc.GetPreviewURL(sandboxId, portNum)
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
