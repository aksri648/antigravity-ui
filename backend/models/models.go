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

// Multi-User SaaS Models
type User struct {
	ID                    string    `json:"id"`
	Email                 string    `json:"email"`
	Name                  string    `json:"name"`
	DaytonaApiKey         string    `json:"daytonaApiKey,omitempty"`
	DaytonaServerUrl      string    `json:"daytonaServerUrl,omitempty"`
	VolumeID              string    `json:"volumeId,omitempty"`
	IsGoogleAuthenticated bool      `json:"isGoogleAuthenticated"`
	CreatedAt             time.Time `json:"createdAt"`
}

type UserSandbox struct {
	ID               string    `json:"id"`
	UserID           string    `json:"userId"`
	DaytonaSandboxID string    `json:"daytonaSandboxId"`
	Name             string    `json:"name"`
	State            string    `json:"state"`
	PreviewURL       string    `json:"previewUrl,omitempty"`
	SignedPreviewURL string    `json:"signedPreviewUrl,omitempty"`
	ActivePort       int       `json:"activePort"`
	IsDefault        bool      `json:"isDefault"`
	CreatedAt        time.Time `json:"createdAt"`
}

type RegisterRequest struct {
	Email            string `json:"email"`
	Password         string `json:"password"`
	Name             string `json:"name,omitempty"`
	DaytonaApiKey    string `json:"daytonaApiKey,omitempty"`
	DaytonaServerUrl string `json:"daytonaServerUrl,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token         string       `json:"token"`
	User          *User        `json:"user"`
	ActiveSandbox *UserSandbox `json:"activeSandbox,omitempty"`
}

type UpdateSettingsRequest struct {
	ApiKey        string `json:"apiKey,omitempty"`
	ServerUrl     string `json:"serverUrl,omitempty"`
	ActivePort    int    `json:"activePort,omitempty"`
	OAuthClientId string `json:"oauthClientId,omitempty"`
	GoogleApiKey  string `json:"googleApiKey,omitempty"`
}

type ChatMessageDTO struct {
	ID        string                   `json:"id"`
	Sender    string                   `json:"sender"`
	Text      string                   `json:"text"`
	Thoughts  []string                 `json:"thoughts,omitempty"`
	Tools     []map[string]interface{} `json:"tools,omitempty"`
	IsError   bool                     `json:"isError,omitempty"`
	Timestamp int64                    `json:"timestamp"`
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
	ServerUrl     string `json:"serverUrl,omitempty"`
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
	ServerUrl string `json:"serverUrl,omitempty"`
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
	ServerUrl string `json:"serverUrl,omitempty"`
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
	ApiKey         string `json:"apiKey"`
	ServerUrl      string `json:"serverUrl,omitempty"`
	UserId         string `json:"userId"`
	SandboxID      string `json:"sandboxId"`
	Prompt         string `json:"prompt"`
	AgentMode      string `json:"agentMode,omitempty"`      // "app-developer", "llm-deployer", "app-deployer", "app-maintainer"
	ApprovalAction string `json:"approvalAction,omitempty"` // "approve", "reject", "amend"
	RepoURL        string `json:"repoUrl,omitempty"`
	CliEngine      string `json:"cliEngine,omitempty"`      // "agy", "opencode"
}

type FileNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	IsDir    bool        `json:"isDir"`
	Children []*FileNode `json:"children,omitempty"`
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

type EnvVarsRequest struct {
	ApiKey    string            `json:"apiKey"`
	ServerUrl string            `json:"serverUrl,omitempty"`
	SandboxID string            `json:"sandboxId"`
	Env       map[string]string `json:"env"`
	RawEnv    string            `json:"rawEnv,omitempty"`
}

type EnvVarsResponse struct {
	Success bool              `json:"success"`
	Env     map[string]string `json:"env"`
	RawEnv  string            `json:"rawEnv"`
	Message string            `json:"message,omitempty"`
}

type SignedPreviewResponse struct {
	URL   string `json:"url"`
	Token string `json:"token,omitempty"`
}

type VNCStatusResponse struct {
	Running bool   `json:"running"`
	Status  string `json:"status"`
	URL     string `json:"url,omitempty"`
	Message string `json:"message,omitempty"`
}

type VNCActionRequest struct {
	ApiKey    string `json:"apiKey"`
	ServerUrl string `json:"serverUrl,omitempty"`
	SandboxID string `json:"sandboxId"`
	Action    string `json:"action"` // "start" | "stop" | "status"
}

// OpenTelemetry & Observability Models (https://www.daytona.io/docs/en/observability/otel-collection/)
type SandboxTelemetryData struct {
	SandboxID      string              `json:"sandboxId"`
	Timestamp      int64               `json:"timestamp"`
	CPU            CPUTelemetry        `json:"cpu"`
	Memory         MemoryTelemetry     `json:"memory"`
	Filesystem     FilesystemTelemetry `json:"filesystem"`
	Uptime         string              `json:"uptime"`
	ProcessCount   int                 `json:"processCount"`
	ResourceLabels map[string]string   `json:"resourceLabels"`
	OTelSpans      []OTelSpan          `json:"otelSpans"`
	MetricsList    map[string]float64  `json:"metricsList"`
}

type CPUTelemetry struct {
	UtilizationPct float64 `json:"utilizationPct"` // daytona.sandbox.cpu.utilization (0-100%)
	LimitCores     int     `json:"limitCores"`     // daytona.sandbox.cpu.limit
	Model          string  `json:"model,omitempty"`
	LoadAvg        string  `json:"loadAvg,omitempty"`
}

type MemoryTelemetry struct {
	UtilizationPct float64 `json:"utilizationPct"` // daytona.sandbox.memory.utilization (0-100%)
	UsageBytes     int64   `json:"usageBytes"`     // daytona.sandbox.memory.usage
	LimitBytes     int64   `json:"limitBytes"`     // daytona.sandbox.memory.limit
	UsageFormatted string  `json:"usageFormatted"`
	LimitFormatted string  `json:"limitFormatted"`
}

type FilesystemTelemetry struct {
	UtilizationPct float64 `json:"utilizationPct"` // daytona.sandbox.filesystem.utilization (0-100%)
	UsageBytes     int64   `json:"usageBytes"`     // daytona.sandbox.filesystem.usage
	AvailableBytes int64   `json:"availableBytes"` // daytona.sandbox.filesystem.available
	TotalBytes     int64   `json:"totalBytes"`     // daytona.sandbox.filesystem.total
	UsageFormatted string  `json:"usageFormatted"`
	TotalFormatted string  `json:"totalFormatted"`
}

type OTelSpan struct {
	TraceID    string `json:"traceId"`
	SpanID     string `json:"spanId"`
	Name       string `json:"name"` // "daytona.process.execute", "daytona.sandbox.create", "http.request"
	Kind       string `json:"kind"` // "INTERNAL", "SERVER", "CLIENT"
	DurationMs int64  `json:"durationMs"`
	StatusCode int    `json:"statusCode"`
	Status     string `json:"status"` // "OK", "ERROR"
	Timestamp  int64  `json:"timestamp"`
}

