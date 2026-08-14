package handlers

import (
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"backend/db"
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
		serverUrl := c.Query("serverUrl")

		if sandboxId == "" || apiKey == "" {
			c.JSON(http.StatusOK, []*models.FileNode{})
			return
		}

		cmd := "find . -maxdepth 4 -not -path '*/.*' -not -path '*/node_modules*' -not -path '*/dist*' -printf '%y %p\\n' | sort -k2"
		res, err := daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, cmd)

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
		trimmed := strings.TrimSpace(line)
		if len(trimmed) < 3 {
			continue
		}
		typeChar := trimmed[0:1]  // 'd' for directory, 'f' for file
		clean := strings.TrimPrefix(trimmed[2:], "./")
		if clean == "" || clean == "." {
			continue
		}

		parts := strings.Split(clean, "/")
		name := parts[len(parts)-1]
		isDir := typeChar == "d"

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

// CreateWorkspace provisions an isolated Daytona sandbox for coding session and records in SQLite
func CreateWorkspace(daytonaSvc *services.DaytonaService, userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CreateWorkspaceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		if req.UserId == "" {
			if u, exists := c.Get("userId"); exists {
				req.UserId = u.(string)
			} else {
				req.UserId = "default-user"
			}
		}

		// Fallback to stored API key in SQLite if not passed in body
		if req.ApiKey == "" && userSvc != nil {
			if user, err := userSvc.GetUserByID(req.UserId); err == nil && user != nil && user.DaytonaApiKey != "" {
				req.ApiKey = user.DaytonaApiKey
				if req.ServerUrl == "" && user.DaytonaServerUrl != "" {
					req.ServerUrl = user.DaytonaServerUrl
				}
			}
		}

		if req.ApiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Daytona API Key is required to create a workspace sandbox. Please configure your API key in Settings."})
			return
		}

		// Provision or retrieve active sandbox from Daytona
		sb, err := daytonaSvc.GetActiveSandbox(req.ApiKey, req.ServerUrl, req.UserId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sandbox in Daytona: " + err.Error()})
			return
		}

		previewUrl := daytonaSvc.GetPreviewURL(sb.ID, 3000, req.ServerUrl)
		if userSvc != nil {
			userSvc.SaveUserSandbox(req.UserId, sb.ID, previewUrl, 3000)
		}

		c.JSON(http.StatusOK, models.CreateWorkspaceResponse{
			Success:   "true",
			SandboxID: sb.ID,
			State:     sb.State,
			Message:   "Daytona workspace provisioned successfully with persistent volume.",
		})
	}
}

// GetWorkspaceStatus fetches state & current listening preview ports of sandbox
func GetWorkspaceStatus(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Param("sandboxId")
		serverUrl := c.Query("serverUrl")
		c.JSON(http.StatusOK, gin.H{
			"sandboxId":  sandboxId,
			"state":      "RUNNING",
			"previewUrl": daytonaSvc.GetPreviewURL(sandboxId, 3000, serverUrl),
		})
	}
}

// GetFileContent reads a file directly from inside the Daytona sandbox
func GetFileContent(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Query("sandboxId")
		filePath := c.Query("path")
		apiKey := c.Query("apiKey")
		serverUrl := c.Query("serverUrl")

		if filePath == "" {
			filePath = "src/App.tsx"
		}

		res, err := daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, fmt.Sprintf("cat %s", filePath))
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
			ServerUrl string `json:"serverUrl,omitempty"`
			SandboxID string `json:"sandboxId"`
			Path      string `json:"path"`
			Content   string `json:"content"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		encoded := base64.StdEncoding.EncodeToString([]byte(req.Content))
		cmd := fmt.Sprintf("mkdir -p $(dirname '%s') && echo '%s' | base64 -d > '%s'", req.Path, encoded, req.Path)
		_, err := daytonaSvc.ExecProcess(req.ApiKey, req.ServerUrl, req.SandboxID, cmd)
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
func SendPrompt(daytonaSvc *services.DaytonaService, agySvc *services.AGYService, userSvc *services.UserService, hub *Hub) gin.HandlerFunc {
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

		if req.UserId == "" {
			if u, exists := c.Get("userId"); exists {
				req.UserId = u.(string)
			} else {
				req.UserId = "default-user"
			}
		}

		// If sandbox ID is missing, ensure a real Daytona sandbox is created
		if req.SandboxID == "" {
			var activeSb *models.DaytonaSandbox
			activeSb, err := daytonaSvc.GetActiveSandbox(req.ApiKey, req.ServerUrl, req.UserId)
			if err != nil || activeSb == nil {
				vol, _ := daytonaSvc.GetOrCreateUserVolume(req.ApiKey, req.ServerUrl, req.UserId)
				volID := ""
				if vol != nil {
					volID = vol.ID
				}
				activeSb, err = daytonaSvc.CreateSandbox(req.ApiKey, req.ServerUrl, req.UserId, volID)
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Daytona sandbox: " + err.Error()})
				return
			}
			req.SandboxID = activeSb.ID
			if userSvc != nil {
				previewUrl := daytonaSvc.GetPreviewURL(activeSb.ID, 3000, req.ServerUrl)
				userSvc.SaveUserSandbox(req.UserId, activeSb.ID, previewUrl, 3000)
			}
		}

		// Persist user prompt in SQLite
		if userSvc != nil {
			userSvc.SaveChatMessage(req.UserId, req.SandboxID, "user", req.Prompt, nil, nil, false)
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
		currentCancel := cancel  // capture before goroutine
		go func() {
			defer func() {
				activePromptMu.Lock()
				// Only clean up if we're still the active prompt
				if storedCancel, exists := activePromptCancel[req.SandboxID]; exists {
					// Compare function pointers — if a newer prompt replaced ours, don't delete
					if fmt.Sprintf("%p", storedCancel) == fmt.Sprintf("%p", currentCancel) {
						delete(activePromptCancel, req.SandboxID)
					}
				}
				activePromptMu.Unlock()
			}()

			var accumulatedResponse strings.Builder
			var thoughts []string
			var tools []map[string]interface{}

			err := agySvc.StreamPromptExec(
				ctx,
				req.ApiKey,
				req.ServerUrl,
				req.SandboxID,
				req.Prompt,
				req.AgentMode,
				req.RepoURL,
				req.ApprovalAction,
				req.CliEngine,
				func(event models.StreamEvent) {
					hub.BroadcastEvent(event)
					if event.Type == "token" {
						accumulatedResponse.WriteString(event.Content)
					} else if event.Type == "thought" {
						thoughts = append(thoughts, event.Content)
					} else if event.Type == "tool_start" {
						if m, ok := event.Metadata.(map[string]interface{}); ok {
							tools = append(tools, m)
						}
					}
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

			// Persist AGY response to SQLite
			if userSvc != nil && accumulatedResponse.Len() > 0 {
				userSvc.SaveChatMessage(req.UserId, req.SandboxID, "agy", accumulatedResponse.String(), thoughts, tools, err != nil && ctx.Err() != context.Canceled)
			}
		}()

		c.JSON(http.StatusOK, gin.H{
			"status":    "processing",
			"sandboxId": req.SandboxID,
			"message":   "Prompt submitted to agy agent inside Daytona sandbox.",
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
		serverUrl := c.Query("serverUrl")

		if sandboxId == "" || apiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sandboxId and apiKey are required"})
			return
		}

		// Fetch recent sandbox process logs
		cmd := "(cat /tmp/agy_*.log 2>/dev/null || true) && (journalctl --no-pager -n 50 2>/dev/null || dmesg --human -n 50 2>/dev/null || tail -n 50 /var/log/syslog 2>/dev/null || echo 'No system logs available') && echo '---PROCESS_LIST---' && ps aux --sort=-%cpu 2>/dev/null | head -20"
		res, err := daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, cmd)

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
			ServerUrl string `json:"serverUrl,omitempty"`
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
			if err := daytonaSvc.WipeVolumeData(req.ApiKey, req.ServerUrl, req.SandboxID); err != nil {
				errors = append(errors, "wipe volume data: "+err.Error())
			}
		}

		// 2. Delete the sandbox
		if req.SandboxID != "" && req.ApiKey != "" {
			if err := daytonaSvc.DeleteSandbox(req.ApiKey, req.ServerUrl, req.SandboxID); err != nil {
				errors = append(errors, "delete sandbox: "+err.Error())
			}
		}

		// 3. Delete the persistent volume
		if req.UserId != "" && req.ApiKey != "" {
			if err := daytonaSvc.DeleteUserVolume(req.ApiKey, req.ServerUrl, req.UserId); err != nil {
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
		serverUrl := c.Query("serverUrl")

		if sandboxId == "" || apiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sandboxId and apiKey are required"})
			return
		}

		cmd := "cat /root/.gemini/.env 2>/dev/null || cat .env 2>/dev/null || true"
		res, err := daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, cmd)

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
		_, err := daytonaSvc.ExecProcess(req.ApiKey, req.ServerUrl, req.SandboxID, cmd)
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
		vol, err := daytonaSvc.GetOrCreateUserVolume(req.ApiKey, req.ServerUrl, req.UserId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to access user volume: " + err.Error()})
			return
		}

		// Create fresh sandbox
		sb, err := daytonaSvc.CreateSandbox(req.ApiKey, req.ServerUrl, req.UserId, vol.ID)
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

// GetPreviewLinkHandler returns the signed preview URL for embedding in an iframe
func GetPreviewLinkHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Query("sandboxId")
		apiKey := c.Query("apiKey")
		serverUrl := c.Query("serverUrl")
		portStr := c.DefaultQuery("port", "3000")
		port, _ := strconv.Atoi(portStr)
		if port <= 0 {
			port = 3000
		}

		res, err := daytonaSvc.GetSignedPreviewLink(apiKey, serverUrl, sandboxId, port)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}

// StartVNCHandler triggers VNC desktop environment inside the sandbox
func StartVNCHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.VNCActionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		res, err := daytonaSvc.StartVNC(req.ApiKey, req.ServerUrl, req.SandboxID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}

// StopVNCHandler terminates VNC processes
func StopVNCHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.VNCActionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		if err := daytonaSvc.StopVNC(req.ApiKey, req.ServerUrl, req.SandboxID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "VNC processes stopped"})
	}
}

// GetVNCStatusHandler returns current VNC process status
func GetVNCStatusHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Query("sandboxId")
		apiKey := c.Query("apiKey")
		serverUrl := c.Query("serverUrl")

		res, err := daytonaSvc.GetVNCStatus(apiKey, serverUrl, sandboxId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}

// CreateFolderHandler creates a directory inside the Daytona sandbox
func CreateFolderHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			ApiKey    string `json:"apiKey"`
			ServerUrl string `json:"serverUrl,omitempty"`
			SandboxID string `json:"sandboxId"`
			Path      string `json:"path"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		cmd := fmt.Sprintf("mkdir -p %s", req.Path)
		_, err := daytonaSvc.ExecProcess(req.ApiKey, req.ServerUrl, req.SandboxID, cmd)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Directory created"})
	}
}

// DeleteFileHandler deletes a file or directory inside the Daytona sandbox
func DeleteFileHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.Query("apiKey")
		serverUrl := c.Query("serverUrl")
		sandboxId := c.Query("sandboxId")
		path := c.Query("path")

		if path == "" || sandboxId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "path and sandboxId are required"})
			return
		}

		cmd := fmt.Sprintf("rm -rf %s", path)
		_, err := daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, cmd)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "File deleted"})
	}
}

// ListRunsHandler returns past agent runs from SQLite
func ListRunsHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.DefaultQuery("userId", "default-user")
		if u, exists := c.Get("userId"); exists {
			userId = u.(string)
		}

		query := `SELECT id, user_id, agy_conversation_id, title, status, created_at, updated_at FROM agent_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
		rows, err := db.DB.Query(query, userId)
		if err != nil {
			c.JSON(http.StatusOK, []gin.H{})
			return
		}
		defer rows.Close()

		var runs []gin.H
		for rows.Next() {
			var id, uId, status string
			var convId, title sql.NullString
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&id, &uId, &convId, &title, &status, &createdAt, &updatedAt); err == nil {
				runs = append(runs, gin.H{
					"id":                id,
					"userId":            uId,
					"agyConversationId": convId.String,
					"title":             title.String,
					"status":            status,
					"createdAt":         createdAt,
					"updatedAt":         updatedAt,
				})
			}
		}

		c.JSON(http.StatusOK, runs)
	}
}

// GetTelemetryHandler returns OpenTelemetry metrics and traces for the sandbox
func GetTelemetryHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Query("sandboxId")
		apiKey := c.Query("apiKey")
		serverUrl := c.Query("serverUrl")

		data, err := daytonaSvc.GetSandboxTelemetry(apiKey, serverUrl, sandboxId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, data)
	}
}

// PreviewProxyHandler proxies requests to Daytona Sandbox ports and strips restrictive iframe/CSP headers
func PreviewProxyHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sandboxId := c.Param("sandboxId")
		portStr := c.Param("port")
		path := c.Param("path")
		apiKey := c.Query("apiKey")

		port, _ := strconv.Atoi(portStr)
		if port <= 0 {
			port = 3000
		}

		targetURL := fmt.Sprintf("https://%s-%d.daytona.app%s", sandboxId, port, path)
		if c.Request.URL.RawQuery != "" {
			targetURL += "?" + c.Request.URL.RawQuery
		}

		remoteURL, err := url.Parse(targetURL)
		if err != nil {
			c.String(http.StatusBadRequest, "Invalid proxy target")
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(remoteURL)
		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Host = remoteURL.Host
			if apiKey != "" {
				req.Header.Set("Authorization", "Bearer "+apiKey)
			}
		}

		proxy.ModifyResponse = func(resp *http.Response) error {
			// Strip restrictive headers to allow seamless iframe embedding
			resp.Header.Del("X-Frame-Options")
			resp.Header.Del("Content-Security-Policy")
			resp.Header.Set("Access-Control-Allow-Origin", "*")
			return nil
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}




