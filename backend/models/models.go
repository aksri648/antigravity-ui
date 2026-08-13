package models

import "time"

// Daytona API Models
type DaytonaProfileResponse struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type CreateSandboxRequest struct {
	Language string            `json:"language"`
	Image    string            `json:"image,omitempty"`
	Labels   map[string]string `json:"labels,omitempty"`
	Volumes  []VolumeMount     `json:"volumes,omitempty"`
}

type VolumeMount struct {
	VolumeID  string `json:"volumeId"`
	MountPath string `json:"mountPath"`
}

type DaytonaVolume struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

type DaytonaSandbox struct {
	ID        string            `json:"id"`
	Name      string            `json:"name,omitempty"`
	State     string            `json:"state"`
	Labels    map[string]string `json:"labels,omitempty"`
	IPAddress string            `json:"ipAddress,omitempty"`
	CreatedAt time.Time         `json:"createdAt"`
}

type ExecResult struct {
	ExitCode int    `json:"exitCode"`
	Result   string `json:"result"`
}

// API Request/Response DTOs
type VerifyDaytonaRequest struct {
	ApiKey    string `json:"apiKey"`
	ServerUrl string `json:"serverUrl,omitempty"`
}

type VerifyDaytonaResponse struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
	User    string `json:"user,omitempty"`
}

type InitGoogleAuthRequest struct {
	ApiKey        string `json:"apiKey"`
	UserId        string `json:"userId"`
	GoogleApiKey  string `json:"googleApiKey,omitempty"`
	OAuthClientId string `json:"oauthClientId,omitempty"`
}

type InitGoogleAuthResponse struct {
	Success    bool   `json:"success"`
	SandboxID  string `json:"sandboxId,omitempty"`
	AuthURL    string `json:"authUrl"`
	DeviceCode string `json:"deviceCode,omitempty"`
	Message    string `json:"message,omitempty"`
}

type SubmitAuthCodeRequest struct {
	ApiKey    string `json:"apiKey"`
	UserId    string `json:"userId"`
	SandboxID string `json:"sandboxId"`
	AuthCode  string `json:"authCode"`
}

type SubmitAuthCodeResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type AuthStatusResponse struct {
	Authenticated bool   `json:"authenticated"`
	AccountEmail  string `json:"accountEmail,omitempty"`
}

type CreateWorkspaceRequest struct {
	ApiKey    string `json:"apiKey"`
	UserId    string `json:"userId"`
	RepoURL   string `json:"repoUrl,omitempty"`
	ProjectID string `json:"projectId,omitempty"`
}

type CreateWorkspaceResponse struct {
	Success   string `json:"success"`
	SandboxID string `json:"sandboxId"`
	State     string `json:"state"`
	Message   string `json:"message,omitempty"`
}

type SendPromptRequest struct {
	ApiKey    string `json:"apiKey"`
	UserId    string `json:"userId"`
	SandboxID string `json:"sandboxId"`
	Prompt    string `json:"prompt"`
}

// Real-Time WebSocket Streaming Payload
type StreamEvent struct {
	Type      string      `json:"type"`      // "thought", "tool_start", "tool_end", "token", "port_detected", "error", "done"
	Content   string      `json:"content"`   // Text snippet or log line
	SandboxID string      `json:"sandboxId"` // Target sandbox ID
	Metadata  interface{} `json:"metadata,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

type PortDetectedMetadata struct {
	Port       int    `json:"port"`
	PreviewURL string `json:"previewUrl"`
}

type ToolExecutionMetadata struct {
	Tool string                 `json:"tool"`
	Path string                 `json:"path,omitempty"`
	Args map[string]interface{} `json:"args,omitempty"`
}
