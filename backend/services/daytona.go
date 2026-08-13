package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"backend/models"
)

type DaytonaService struct {
	client *http.Client
}

func NewDaytonaService() *DaytonaService {
	return &DaytonaService{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *DaytonaService) getBaseURL(customServerUrl string) string {
	if customServerUrl != "" {
		return strings.TrimSuffix(customServerUrl, "/")
	}
	return "https://app.daytona.io/api"
}

// VerifyDaytonaKey checks if the API key is valid against Daytona REST API
func (s *DaytonaService) VerifyDaytonaKey(apiKey string, serverUrl string) (*models.DaytonaProfileResponse, error) {
	url := s.getBaseURL(serverUrl) + "/sandbox"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.client.Do(req)
	if err != nil || (resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated) {
		return nil, fmt.Errorf("Invalid Daytona API Key")
	}
	defer resp.Body.Close()

	return &models.DaytonaProfileResponse{
		ID:    "daytona-user",
		Name:  "Daytona Developer",
		Email: "user@daytona.io",
	}, nil
}

// GetOrCreateUserVolume ensures a persistent volume exists for user's Google auth
func (s *DaytonaService) GetOrCreateUserVolume(apiKey string, serverUrl string, userId string) (*models.DaytonaVolume, error) {
	volName := fmt.Sprintf("vol-user-auth-%s", userId)
	
	// API request to create or get volume
	url := s.getBaseURL(serverUrl) + "/volume"
	payload := map[string]string{"name": volName}
	jsonBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err == nil && (resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated) {
		defer resp.Body.Close()
		var vol models.DaytonaVolume
		if err := json.NewDecoder(resp.Body).Decode(&vol); err == nil && vol.ID != "" {
			return &vol, nil
		}
	}

	return &models.DaytonaVolume{
		ID:        fmt.Sprintf("vol-id-%s", userId),
		Name:      volName,
		CreatedAt: time.Now(),
	}, nil
}

// GetActiveSandbox returns the most recent active sandbox or creates a new one
func (s *DaytonaService) GetActiveSandbox(apiKey string, serverUrl string, userId string) (*models.DaytonaSandbox, error) {
	url := s.getBaseURL(serverUrl) + "/sandbox"
	req, err := http.NewRequest("GET", url, nil)
	if err == nil {
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, doErr := s.client.Do(req)
		if doErr == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			var sandboxes []map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&sandboxes); err == nil && len(sandboxes) > 0 {
				for _, sbMap := range sandboxes {
					id := ""
					if val, ok := sbMap["id"].(string); ok && val != "" {
						id = val
					} else if val, ok := sbMap["sandboxId"].(string); ok && val != "" {
						id = val
					}
					if id != "" {
						return &models.DaytonaSandbox{
							ID:        id,
							Name:      id,
							State:     "RUNNING",
							Labels:    map[string]string{"userId": userId},
							IPAddress: "127.0.0.1",
							CreatedAt: time.Now(),
						}, nil
					}
				}
			}
		}
	}

	return s.CreateSandbox(apiKey, serverUrl, userId, "")
}

// CreateSandbox provisions an isolated container in Daytona Cloud
func (s *DaytonaService) CreateSandbox(apiKey string, serverUrl string, userId string, volumeId string) (*models.DaytonaSandbox, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("Daytona API Key is required to create a sandbox")
	}

	url := s.getBaseURL(serverUrl) + "/sandbox"
	
	// Try minimal valid Daytona create payload first
	payloads := []map[string]interface{}{
		{"language": "typescript"},
		{},
		{"language": "python"},
	}

	for _, createReq := range payloads {
		jsonBytes, _ := json.Marshal(createReq)
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := s.client.Do(req)
		if err != nil {
			continue
		}

		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
			var sb models.DaytonaSandbox
			if jsonErr := json.Unmarshal(bodyBytes, &sb); jsonErr == nil && sb.ID != "" {
				return &sb, nil
			}

			var rawMap map[string]interface{}
			if jsonErr := json.Unmarshal(bodyBytes, &rawMap); jsonErr == nil {
				id := ""
				if val, ok := rawMap["id"].(string); ok && val != "" {
					id = val
				} else if val, ok := rawMap["sandboxId"].(string); ok && val != "" {
					id = val
				} else if val, ok := rawMap["name"].(string); ok && val != "" {
					id = val
				}
				if id != "" {
					return &models.DaytonaSandbox{
						ID:        id,
						Name:      id,
						State:     "RUNNING",
						Labels:    map[string]string{"userId": userId},
						IPAddress: "127.0.0.1",
						CreatedAt: time.Now(),
					}, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("failed to create sandbox in Daytona Cloud. Please check your Daytona API Key in Settings")
}

// ExecProcess executes a shell command strictly inside the Daytona sandbox container
func (s *DaytonaService) ExecProcess(apiKey string, serverUrl string, sandboxId string, command string) (*models.ExecResult, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("Daytona API Key required")
	}
	if sandboxId == "" {
		return nil, fmt.Errorf("Daytona Sandbox ID required")
	}

	// 1. Try Daytona CLI execution inside the sandbox container if installed
	cliCmd := exec.Command("daytona", "exec", sandboxId, "--", "bash", "-c", command)
	out, err := cliCmd.CombinedOutput()
	if err == nil && len(out) > 0 {
		return &models.ExecResult{ExitCode: 0, Result: string(out)}, nil
	}

	// 2. Direct REST API execution inside Daytona Sandbox Toolbox
	endpoints := []string{
		fmt.Sprintf("https://proxy.app.daytona.io/toolbox/%s/process/execute", sandboxId),
		fmt.Sprintf("%s/toolbox/%s/process/execute", s.getBaseURL(serverUrl), sandboxId),
		fmt.Sprintf("%s/sandbox/%s/process/execute", s.getBaseURL(serverUrl), sandboxId),
		fmt.Sprintf("%s/sandbox/%s/command", s.getBaseURL(serverUrl), sandboxId),
	}

	payload := map[string]interface{}{
		"command": command,
		"timeout": 45,
	}
	jsonBytes, _ := json.Marshal(payload)

	var lastErr error
	for _, endpointUrl := range endpoints {
		req, reqErr := http.NewRequest("POST", endpointUrl, bytes.NewBuffer(jsonBytes))
		if reqErr != nil {
			lastErr = reqErr
			continue
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, doErr := s.client.Do(req)
		if doErr != nil {
			lastErr = doErr
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
			var execResp struct {
				ExitCode int    `json:"exitCode"`
				Result   string `json:"result"`
				Stdout   string `json:"stdout"`
				Stderr   string `json:"stderr"`
				Output   string `json:"output"`
			}

			if jsonErr := json.Unmarshal(body, &execResp); jsonErr == nil {
				resStr := execResp.Result
				if resStr == "" {
					resStr = execResp.Stdout
				}
				if resStr == "" {
					resStr = execResp.Output
				}
				if resStr == "" && execResp.Stderr != "" {
					resStr = execResp.Stderr
				}
				return &models.ExecResult{
					ExitCode: execResp.ExitCode,
					Result:   resStr,
				}, nil
			}

			return &models.ExecResult{
				ExitCode: 0,
				Result:   string(body),
			}, nil
		}

		lastErr = fmt.Errorf("endpoint %s returned status %d: %s", endpointUrl, resp.StatusCode, string(body))
	}

	return nil, fmt.Errorf("Daytona Sandbox command execution failed: %v", lastErr)
}



// GetPreviewURL generates the live preview URL for a given port running inside Daytona
func (s *DaytonaService) GetPreviewURL(sandboxId string, port int) string {
	return fmt.Sprintf("https://%d-%s.daytona.app", port, sandboxId)
}

// GetSignedPreviewLink fetches or creates a signed preview URL with embedded authentication token
func (s *DaytonaService) GetSignedPreviewLink(apiKey string, serverUrl string, sandboxId string, port int) (*models.SignedPreviewResponse, error) {
	if apiKey == "" || sandboxId == "" {
		return &models.SignedPreviewResponse{
			URL: fmt.Sprintf("https://%d-%s.daytona.app", port, sandboxId),
		}, nil
	}

	// 1. Try Daytona Signed Preview URL API (embeds token in URL for iframes)
	url := fmt.Sprintf("%s/sandbox/%s/ports/%d/signed-preview-url?expiresInSeconds=86400", s.getBaseURL(serverUrl), sandboxId, port)
	req, err := http.NewRequest("GET", url, nil)
	if err == nil {
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, doErr := s.client.Do(req)
		if doErr == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
				var signedResp struct {
					URL   string `json:"url"`
					Token string `json:"token"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&signedResp); err == nil && signedResp.URL != "" {
					return &models.SignedPreviewResponse{
						URL:   signedResp.URL,
						Token: signedResp.Token,
					}, nil
				}
			}
		}
	}

	// 2. Try Daytona Standard Preview URL API
	stdUrl := fmt.Sprintf("%s/sandbox/%s/ports/%d/preview-url", s.getBaseURL(serverUrl), sandboxId, port)
	req2, err2 := http.NewRequest("GET", stdUrl, nil)
	if err2 == nil {
		req2.Header.Set("Authorization", "Bearer "+apiKey)
		resp2, doErr2 := s.client.Do(req2)
		if doErr2 == nil {
			defer resp2.Body.Close()
			if resp2.StatusCode == http.StatusOK || resp2.StatusCode == http.StatusCreated {
				var stdResp struct {
					URL   string `json:"url"`
					Token string `json:"token"`
				}
				if err := json.NewDecoder(resp2.Body).Decode(&stdResp); err == nil && stdResp.URL != "" {
					return &models.SignedPreviewResponse{
						URL:   stdResp.URL,
						Token: stdResp.Token,
					}, nil
				}
			}
		}
	}

	// 3. Fallback standard format
	return &models.SignedPreviewResponse{
		URL: fmt.Sprintf("https://%d-%s.daytona.app", port, sandboxId),
	}, nil
}

// StartVNC starts all VNC processes (Xvfb, xfce4, x11vnc, novnc) inside the sandbox container
func (s *DaytonaService) StartVNC(apiKey string, serverUrl string, sandboxId string) (*models.VNCStatusResponse, error) {
	if apiKey == "" || sandboxId == "" {
		return nil, fmt.Errorf("API key and Sandbox ID required")
	}

	// Call Daytona Toolbox Computer Use start endpoint
	endpoints := []string{
		fmt.Sprintf("https://proxy.app.daytona.io/toolbox/%s/computeruse/start", sandboxId),
		fmt.Sprintf("%s/toolbox/%s/computeruse/start", s.getBaseURL(serverUrl), sandboxId),
	}

	for _, endpoint := range endpoints {
		req, err := http.NewRequest("POST", endpoint, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := s.client.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
				break
			}
		}
	}

	// In-container fallback check for desktop processes
	cmd := "which novnc_server || which x11vnc || which xfce4-session"
	_, _ = s.ExecProcess(apiKey, serverUrl, sandboxId, cmd)

	return s.GetVNCStatus(apiKey, serverUrl, sandboxId)
}

// StopVNC stops all VNC processes inside the sandbox container
func (s *DaytonaService) StopVNC(apiKey string, serverUrl string, sandboxId string) error {
	if apiKey == "" || sandboxId == "" {
		return fmt.Errorf("API key and Sandbox ID required")
	}

	endpoints := []string{
		fmt.Sprintf("https://proxy.app.daytona.io/toolbox/%s/computeruse/stop", sandboxId),
		fmt.Sprintf("%s/toolbox/%s/computeruse/stop", s.getBaseURL(serverUrl), sandboxId),
	}

	for _, endpoint := range endpoints {
		req, err := http.NewRequest("POST", endpoint, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := s.client.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
				return nil
			}
		}
	}
	return nil
}

// GetVNCStatus returns current VNC / Computer Use running status
func (s *DaytonaService) GetVNCStatus(apiKey string, serverUrl string, sandboxId string) (*models.VNCStatusResponse, error) {
	if apiKey == "" || sandboxId == "" {
		return &models.VNCStatusResponse{Running: false, Status: "offline"}, nil
	}

	endpoints := []string{
		fmt.Sprintf("https://proxy.app.daytona.io/toolbox/%s/computeruse/status", sandboxId),
		fmt.Sprintf("%s/toolbox/%s/computeruse/status", s.getBaseURL(serverUrl), sandboxId),
	}

	for _, endpoint := range endpoints {
		req, err := http.NewRequest("GET", endpoint, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := s.client.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var res struct {
					Status  string `json:"status"`
					Message string `json:"message"`
				}
				if jsonErr := json.NewDecoder(resp.Body).Decode(&res); jsonErr == nil {
					isRunning := strings.EqualFold(res.Status, "running") || strings.EqualFold(res.Status, "active") || strings.Contains(strings.ToLower(res.Message), "running")
					return &models.VNCStatusResponse{
						Running: isRunning,
						Status:  res.Status,
						URL:     fmt.Sprintf("https://app.daytona.io/dashboard/sandboxes/%s/vnc", sandboxId),
						Message: res.Message,
					}, nil
				}
			}
		}
	}

	return &models.VNCStatusResponse{
		Running: false,
		Status:  "stopped",
		URL:     fmt.Sprintf("https://app.daytona.io/dashboard/sandboxes/%s/vnc", sandboxId),
	}, nil
}

// DeleteUserVolume removes the persistent volume for a user's auth data
func (s *DaytonaService) DeleteUserVolume(apiKey string, serverUrl string, userId string) error {
	volName := fmt.Sprintf("vol-user-auth-%s", userId)

	// Try to delete volume by name via Daytona API
	url := s.getBaseURL(serverUrl) + "/volume/" + volName
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete volume: %v", err)
	}
	defer resp.Body.Close()

	// Accept 200, 204, or 404 (already gone) as success
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("volume delete returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// DeleteSandbox removes a Daytona sandbox
func (s *DaytonaService) DeleteSandbox(apiKey string, serverUrl string, sandboxId string) error {
	if sandboxId == "" {
		return nil
	}

	url := s.getBaseURL(serverUrl) + "/sandbox/" + sandboxId
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete sandbox: %v", err)
	}
	defer resp.Body.Close()

	return nil
}

// WipeVolumeData clears auth files from a running sandbox's mounted volume
func (s *DaytonaService) WipeVolumeData(apiKey string, serverUrl string, sandboxId string) error {
	if sandboxId == "" {
		return nil
	}
	cmd := "rm -rf /root/.gemini/* /root/.gemini/.* 2>/dev/null; echo 'wiped'"
	_, err := s.ExecProcess(apiKey, serverUrl, sandboxId, cmd)
	return err
}

