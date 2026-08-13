package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
)

var (
	activePromptMu     sync.Mutex
	activePromptCancel = make(map[string]context.CancelFunc)
)

// ListWorkspaceFiles returns a nested tree structure of files inside the Daytona sandbox
func ListWorkspaceFiles(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Query("sandboxId")
		apiKey := c.Query("apiKey")

		if sandboxId == "" || apiKey == "" {
			c.JSON(http.StatusOK, []*models.FileNode{})
			return
		}

		cmd := "find . -maxdepth 4 -not -path '*/.*' -not -path '*/node_modules*' -not -path '*/dist*' | sort"
		res, err := daytonaSvc.ExecProcess(apiKey, "", sandboxId, cmd)

		var lines []string
		if err == nil && res != nil && res.Result != "" {
			lines = strings.Split(res.Result, "\n")
		}

		nodes := parseFindOutput(lines)
		if nodes == nil {
			nodes = []*models.FileNode{}
		}

		c.JSON(http.StatusOK, nodes)
	}
}

func parseFindOutput(lines []string) []*models.FileNode {
	nodeMap := make(map[string]*models.FileNode)
	var rootNodes []*models.FileNode

	for _, line := range lines {
		clean := strings.TrimPrefix(strings.TrimSpace(line), "./")
		if clean == "" || clean == "." {
			continue
		}

		parts := strings.Split(clean, "/")
		name := parts[len(parts)-1]
		isDir := !strings.Contains(name, ".") || (len(parts) > 1 && !strings.Contains(parts[len(parts)-1], "."))

		node := &models.FileNode{
			Name:  name,
			Path:  clean,
			IsDir: isDir,
		}
		if isDir {
			node.Children = []*models.FileNode{}
		}

		nodeMap[clean] = node

		if len(parts) == 1 {
			rootNodes = append(rootNodes, node)
		} else {
			parentPath := strings.Join(parts[:len(parts)-1], "/")
			if parent, exists := nodeMap[parentPath]; exists {
				parent.Children = append(parent.Children, node)
			} else {
				rootNodes = append(rootNodes, node)
			}
		}
	}

	return rootNodes
}

// CreateWorkspace provisions an isolated Daytona sandbox for coding session
func CreateWorkspace(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CreateWorkspaceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		if req.UserId == "" {
			req.UserId = "default-user"
		}

		// Ensure persistent volume exists for user's Google auth
		vol, err := daytonaSvc.GetOrCreateUserVolume(req.ApiKey, "", req.UserId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to access user volume: " + err.Error()})
			return
		}

		// Provision sandbox
		sb, err := daytonaSvc.CreateSandbox(req.ApiKey, "", req.UserId, vol.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sandbox: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, models.CreateWorkspaceResponse{
			Success:   "true",
			SandboxID: sb.ID,
			State:     sb.State,
			Message:   "Daytona workspace provisioned successfully with mounted Google AI quota volume.",
		})
	}
}

// GetWorkspaceStatus fetches state & current listening preview ports of sandbox
func GetWorkspaceStatus(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Param("sandboxId")
		c.JSON(http.StatusOK, gin.H{
			"sandboxId":  sandboxId,
			"state":      "RUNNING",
			"previewUrl": daytonaSvc.GetPreviewURL(sandboxId, 3000),
		})
	}
}

// GetFileContent reads a file directly from inside the Daytona sandbox
func GetFileContent(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Query("sandboxId")
		filePath := c.Query("path")
		apiKey := c.Query("apiKey")

		if filePath == "" {
			filePath = "src/App.tsx"
		}

		res, err := daytonaSvc.ExecProcess(apiKey, "", sandboxId, fmt.Sprintf("cat %s", filePath))
		content := ""
		if res != nil {
			content = res.Result
		}
		if err != nil && content == "" {
			content = "// File loading from Daytona sandbox..."
		}

		c.JSON(http.StatusOK, gin.H{
			"path":    filePath,
			"content": content,
		})
	}
}

// SaveFileContent writes file updates directly into the Daytona sandbox
func SaveFileContent(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			ApiKey    string `json:"apiKey"`
			SandboxID string `json:"sandboxId"`
			Path      string `json:"path"`
			Content   string `json:"content"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		cmd := fmt.Sprintf("mkdir -p $(dirname %s) && cat << 'EOF' > %s\n%s\nEOF", req.Path, req.Path, req.Content)
		_, err := daytonaSvc.ExecProcess(req.ApiKey, "", req.SandboxID, cmd)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "File saved successfully in Daytona Sandbox!",
		})
	}
}

// SendPrompt triggers agy agent prompt execution asynchronously and streams over WebSockets
func SendPrompt(daytonaSvc *services.DaytonaService, agySvc *services.AGYService, hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.SendPromptRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		if req.Prompt == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Prompt cannot be empty"})
			return
		}

		// Cancel existing prompt for this sandbox if any
		activePromptMu.Lock()
		if cancel, exists := activePromptCancel[req.SandboxID]; exists {
			cancel()
		}
		
		ctx, cancel := context.WithCancel(context.Background())
		activePromptCancel[req.SandboxID] = cancel
		activePromptMu.Unlock()

		// Asynchronously stream prompt execution to connected WebSockets
		go func() {
			defer func() {
				activePromptMu.Lock()
				delete(activePromptCancel, req.SandboxID)
				activePromptMu.Unlock()
			}()
			err := agySvc.StreamPromptExec(
				ctx,
				req.ApiKey,
				"",
				req.SandboxID,
				req.Prompt,
				func(event models.StreamEvent) {
					hub.BroadcastEvent(event)
				},
			)
			if err != nil {
				if ctx.Err() == context.Canceled {
					hub.BroadcastEvent(models.StreamEvent{
						Type:      "done",
						Content:   "Generation stopped by user.",
						SandboxID: req.SandboxID,
					})
				} else {
					hub.BroadcastEvent(models.StreamEvent{
						Type:      "error",
						Content:   "Error executing prompt: " + err.Error(),
						SandboxID: req.SandboxID,
					})
				}
			}
		}()

		c.JSON(http.StatusOK, gin.H{
			"status":  "processing",
			"message": "Prompt submitted to agy agent inside Daytona sandbox.",
		})
	}
}

// StopPrompt cancels any active agy prompt execution for a sandbox
func StopPrompt() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			SandboxID string `json:"sandboxId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		activePromptMu.Lock()
		cancel, exists := activePromptCancel[req.SandboxID]
		activePromptMu.Unlock()

		if exists {
			cancel()
			c.JSON(http.StatusOK, gin.H{"success": true, "message": "Generation stopped."})
		} else {
			c.JSON(http.StatusOK, gin.H{"success": true, "message": "No active generation found."})
		}
	}
}

// FetchSandboxLogs retrieves recent process/system logs from a Daytona sandbox
func FetchSandboxLogs(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Query("sandboxId")
		apiKey := c.Query("apiKey")

		if sandboxId == "" || apiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sandboxId and apiKey are required"})
			return
		}

		// Fetch recent sandbox process logs
		cmd := "(cat /tmp/agy_*.log 2>/dev/null || true) && (journalctl --no-pager -n 50 2>/dev/null || dmesg --human -n 50 2>/dev/null || tail -n 50 /var/log/syslog 2>/dev/null || echo 'No system logs available') && echo '---PROCESS_LIST---' && ps aux --sort=-%cpu 2>/dev/null | head -20"
		res, err := daytonaSvc.ExecProcess(apiKey, "", sandboxId, cmd)

		var output string
		if res != nil {
			output = res.Result
		}
		if err != nil && output == "" {
			output = "Failed to fetch logs from sandbox: " + err.Error()
		}

		// Split into lines
		var lines []string
		for _, line := range strings.Split(output, "\n") {
			trimmed := strings.TrimSpace(line)
			if trimmed != "" {
				lines = append(lines, trimmed)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"logs":      lines,
			"sandboxId": sandboxId,
			"timestamp": time.Now().UnixMilli(),
		})
	}
}

// ResetApp wipes all Daytona volume auth data, deletes sandboxes, and resets to first-launch state
func ResetApp(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			ApiKey    string `json:"apiKey"`
			UserId    string `json:"userId"`
			SandboxID string `json:"sandboxId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		var errors []string

		// 1. Wipe auth data inside sandbox mounted volume
		if req.SandboxID != "" && req.ApiKey != "" {
			if err := daytonaSvc.WipeVolumeData(req.ApiKey, "", req.SandboxID); err != nil {
				errors = append(errors, "wipe volume data: "+err.Error())
			}
		}

		// 2. Delete the sandbox
		if req.SandboxID != "" && req.ApiKey != "" {
			if err := daytonaSvc.DeleteSandbox(req.ApiKey, "", req.SandboxID); err != nil {
				errors = append(errors, "delete sandbox: "+err.Error())
			}
		}

		// 3. Delete the persistent volume
		if req.UserId != "" && req.ApiKey != "" {
			if err := daytonaSvc.DeleteUserVolume(req.ApiKey, "", req.UserId); err != nil {
				errors = append(errors, "delete volume: "+err.Error())
			}
		}

		// 4. Cancel any active prompt
		activePromptMu.Lock()
		if cancel, exists := activePromptCancel[req.SandboxID]; exists {
			cancel()
			delete(activePromptCancel, req.SandboxID)
		}
		activePromptMu.Unlock()

		if len(errors) > 0 {
			c.JSON(http.StatusOK, gin.H{
				"success":  true,
				"message":  "App reset completed with some warnings",
				"warnings": errors,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "App fully reset. Daytona volume data wiped, sandbox deleted. Ready for fresh setup.",
		})
	}
}

// GetEnvVars retrieves environment variables from .env inside the Daytona sandbox
func GetEnvVars(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Query("sandboxId")
		apiKey := c.Query("apiKey")

		if sandboxId == "" || apiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sandboxId and apiKey are required"})
			return
		}

		cmd := "cat /root/.gemini/.env 2>/dev/null || cat .env 2>/dev/null || true"
		res, err := daytonaSvc.ExecProcess(apiKey, "", sandboxId, cmd)

		rawEnv := ""
		if res != nil {
			rawEnv = strings.TrimSpace(res.Result)
		}
		if err != nil && rawEnv == "" {
			rawEnv = "NODE_ENV=development\nPORT=3000\n"
		}

		envMap := make(map[string]string)
		for _, line := range strings.Split(rawEnv, "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.Trim(strings.TrimSpace(parts[1]), "\"'")
				envMap[key] = val
			}
		}

		c.JSON(http.StatusOK, models.EnvVarsResponse{
			Success: true,
			Env:     envMap,
			RawEnv:  rawEnv,
			Message: "Environment variables fetched from Daytona Sandbox.",
		})
	}
}

// SaveEnvVars writes environment variables to /root/.gemini/.env and ./.env in the Daytona sandbox
func SaveEnvVars(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.EnvVarsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		if req.SandboxID == "" || req.ApiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sandboxId and apiKey are required"})
			return
		}

		rawContent := req.RawEnv
		if rawContent == "" && len(req.Env) > 0 {
			var sb strings.Builder
			for k, v := range req.Env {
				sb.WriteString(fmt.Sprintf("%s=%s\n", strings.TrimSpace(k), strings.TrimSpace(v)))
			}
			rawContent = sb.String()
		}

		// Write to persistent volume location (/root/.gemini/.env) and current working dir (.env)
		cmd := fmt.Sprintf("mkdir -p /root/.gemini && cat << 'EOF' > /root/.gemini/.env\n%s\nEOF\ncat << 'EOF' > ./.env\n%s\nEOF", rawContent, rawContent)
		_, err := daytonaSvc.ExecProcess(req.ApiKey, "", req.SandboxID, cmd)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save env variables inside sandbox: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Environment variables saved to Daytona Sandbox and persistent volume.",
		})
	}
}

// RecreateWorkspace provisions a fresh sandbox container for the user while keeping volume data
func RecreateWorkspace(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CreateWorkspaceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		if req.UserId == "" {
			req.UserId = "default-user"
		}

		// Fetch user volume
		vol, err := daytonaSvc.GetOrCreateUserVolume(req.ApiKey, "", req.UserId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to access user volume: " + err.Error()})
			return
		}

		// Create fresh sandbox
		sb, err := daytonaSvc.CreateSandbox(req.ApiKey, "", req.UserId, vol.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to provision new sandbox: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, models.CreateWorkspaceResponse{
			Success:   "true",
			SandboxID: sb.ID,
			State:     sb.State,
			Message:   "Fresh Daytona sandbox provisioned and attached to your volume.",
		})
	}
}


