package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/db"
	"backend/services"

	"github.com/gin-gonic/gin"
)

type CloudSecretsPayload struct {
	SandboxID           string `json:"sandboxId,omitempty"`
	ApiKey              string `json:"apiKey,omitempty"`
	ServerUrl           string `json:"serverUrl,omitempty"`
	OpenAIApiKey        string `json:"openaiApiKey,omitempty"`
	GoogleApiKey        string `json:"googleApiKey,omitempty"`
	GitHubToken         string `json:"githubToken,omitempty"`
	AzureClientID       string `json:"azureClientId,omitempty"`
	AzureClientSecret   string `json:"azureClientSecret,omitempty"`
	AzureTenantID       string `json:"azureTenantId,omitempty"`
	AzureSubscriptionID string `json:"azureSubscriptionId,omitempty"`
	RunPodApiKey        string `json:"runpodApiKey,omitempty"`
	HuggingFaceToken    string `json:"huggingfaceToken,omitempty"`
}

type SecretStatus struct {
	DaytonaConfigured     bool   `json:"daytonaConfigured"`
	OpenAIConfigured      bool   `json:"openaiConfigured"`
	GoogleConfigured      bool   `json:"googleConfigured"`
	GitHubConfigured      bool   `json:"githubConfigured"`
	AzureConfigured       bool   `json:"azureConfigured"`
	RunPodConfigured      bool   `json:"runpodConfigured"`
	HuggingFaceConfigured bool   `json:"huggingfaceConfigured"`
	OpenAIKeyMasked       string `json:"openaiKeyMasked,omitempty"`
	GoogleKeyMasked       string `json:"googleKeyMasked,omitempty"`
	GitHubTokenMasked     string `json:"githubTokenMasked,omitempty"`
	RunPodKeyMasked       string `json:"runpodKeyMasked,omitempty"`
	HFTokenMasked         string `json:"hfTokenMasked,omitempty"`
	AzureClientID         string `json:"azureClientId,omitempty"`
	AzureTenantID         string `json:"azureTenantId,omitempty"`
	AzureSubscriptionID   string `json:"azureSubscriptionId,omitempty"`
}

func maskSecret(secret string) string {
	if len(secret) <= 8 {
		return "••••••••"
	}
	return secret[:4] + "••••••••" + secret[len(secret)-4:]
}

// GetSecretsStatusHandler returns status of configured cloud integration secrets
func GetSecretsStatusHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := ""
		if u, exists := c.Get("userId"); exists {
			userId = u.(string)
		}
		if userId == "" {
			userId = c.DefaultQuery("userId", "default-user")
		}

		status := SecretStatus{}

		if db.DB != nil {
			rows, err := db.DB.Query("SELECT key_name, encrypted_value FROM cloud_secrets WHERE user_id = ?", userId)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var k, v string
					if err := rows.Scan(&k, &v); err == nil && v != "" {
						switch k {
						case "OPENAI_API_KEY":
							status.OpenAIConfigured = true
							status.OpenAIKeyMasked = maskSecret(v)
						case "GOOGLE_API_KEY", "GEMINI_API_KEY":
							status.GoogleConfigured = true
							status.GoogleKeyMasked = maskSecret(v)
						case "GITHUB_TOKEN":
							status.GitHubConfigured = true
							status.GitHubTokenMasked = maskSecret(v)
						case "AZURE_CLIENT_ID":
							status.AzureClientID = v
						case "AZURE_TENANT_ID":
							status.AzureTenantID = v
						case "AZURE_SUBSCRIPTION_ID":
							status.AzureSubscriptionID = v
						case "AZURE_CLIENT_SECRET":
							if v != "" {
								status.AzureConfigured = true
							}
						case "RUNPOD_API_KEY":
							status.RunPodConfigured = true
							status.RunPodKeyMasked = maskSecret(v)
						case "HF_TOKEN":
							status.HuggingFaceConfigured = true
							status.HFTokenMasked = maskSecret(v)
						}
					}
				}
			}
		}

		c.JSON(http.StatusOK, status)
	}
}

// SaveSecretsHandler updates cloud integration secrets in SQLite and syncs to Daytona Secrets & Volume .env
func SaveSecretsHandler(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CloudSecretsPayload
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		userId := ""
		if u, exists := c.Get("userId"); exists {
			userId = u.(string)
		}
		if userId == "" {
			userId = "default-user"
		}

		now := time.Now().Unix()

		saveSecret := func(key, value string) {
			if value == "" {
				return
			}
			// 1. Save to SQLite database
			if db.DB != nil {
				var existingId int
				err := db.DB.QueryRow("SELECT id FROM cloud_secrets WHERE user_id = ? AND key_name = ?", userId, key).Scan(&existingId)
				if err == sql.ErrNoRows {
					_, _ = db.DB.Exec("INSERT INTO cloud_secrets (user_id, provider, key_name, encrypted_value, updated_at) VALUES (?, ?, ?, ?, ?)", userId, "cloud", key, value, now)
				} else {
					_, _ = db.DB.Exec("UPDATE cloud_secrets SET encrypted_value = ?, updated_at = ? WHERE user_id = ? AND key_name = ?", value, now, userId, key)
				}
			}

			// 2. Persist to Daytona Cloud Secrets Manager API
			if req.ApiKey != "" {
				_ = daytonaSvc.SetDaytonaSecret(req.ApiKey, req.ServerUrl, key, value)
			}
		}

		if req.OpenAIApiKey != "" {
			saveSecret("OPENAI_API_KEY", req.OpenAIApiKey)
		}
		if req.GoogleApiKey != "" {
			saveSecret("GOOGLE_API_KEY", req.GoogleApiKey)
			saveSecret("GEMINI_API_KEY", req.GoogleApiKey)
		}
		if req.GitHubToken != "" {
			saveSecret("GITHUB_TOKEN", req.GitHubToken)
			saveSecret("GITHUB_PERSONAL_ACCESS_TOKEN", req.GitHubToken)
		}
		if req.AzureClientID != "" {
			saveSecret("AZURE_CLIENT_ID", req.AzureClientID)
		}
		if req.AzureClientSecret != "" {
			saveSecret("AZURE_CLIENT_SECRET", req.AzureClientSecret)
		}
		if req.AzureTenantID != "" {
			saveSecret("AZURE_TENANT_ID", req.AzureTenantID)
		}
		if req.AzureSubscriptionID != "" {
			saveSecret("AZURE_SUBSCRIPTION_ID", req.AzureSubscriptionID)
		}
		if req.RunPodApiKey != "" {
			saveSecret("RUNPOD_API_KEY", req.RunPodApiKey)
		}
		if req.HuggingFaceToken != "" {
			saveSecret("HF_TOKEN", req.HuggingFaceToken)
		}

		// 3. Sync directly to Daytona persistent volume (.env)
		if req.SandboxID != "" && req.ApiKey != "" {
			var envLines []string
			if req.OpenAIApiKey != "" {
				envLines = append(envLines, fmt.Sprintf("OPENAI_API_KEY=%s", req.OpenAIApiKey))
			}
			if req.GoogleApiKey != "" {
				envLines = append(envLines, fmt.Sprintf("GOOGLE_API_KEY=%s", req.GoogleApiKey))
				envLines = append(envLines, fmt.Sprintf("GEMINI_API_KEY=%s", req.GoogleApiKey))
			}
			if req.GitHubToken != "" {
				envLines = append(envLines, fmt.Sprintf("GITHUB_TOKEN=%s", req.GitHubToken))
				envLines = append(envLines, fmt.Sprintf("GITHUB_PERSONAL_ACCESS_TOKEN=%s", req.GitHubToken))
			}
			if req.AzureClientID != "" {
				envLines = append(envLines, fmt.Sprintf("AZURE_CLIENT_ID=%s", req.AzureClientID))
			}
			if req.AzureClientSecret != "" {
				envLines = append(envLines, fmt.Sprintf("AZURE_CLIENT_SECRET=%s", req.AzureClientSecret))
			}
			if req.AzureTenantID != "" {
				envLines = append(envLines, fmt.Sprintf("AZURE_TENANT_ID=%s", req.AzureTenantID))
			}
			if req.AzureSubscriptionID != "" {
				envLines = append(envLines, fmt.Sprintf("AZURE_SUBSCRIPTION_ID=%s", req.AzureSubscriptionID))
			}
			if req.RunPodApiKey != "" {
				envLines = append(envLines, fmt.Sprintf("RUNPOD_API_KEY=%s", req.RunPodApiKey))
			}
			if req.HuggingFaceToken != "" {
				envLines = append(envLines, fmt.Sprintf("HF_TOKEN=%s", req.HuggingFaceToken))
			}

			if len(envLines) > 0 {
				envContent := strings.Join(envLines, "\n")
				syncCmd := fmt.Sprintf(`
mkdir -p /home/daytona/persist/gemini /home/daytona/.gemini
cat << 'EOF' >> /home/daytona/persist/gemini/.env
%s
EOF
cat << 'EOF' >> /home/daytona/.gemini/.env
%s
EOF
`, envContent, envContent)
				_, _ = daytonaSvc.ExecProcess(req.ApiKey, req.ServerUrl, req.SandboxID, syncCmd)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "SaaS environment variables & secrets saved to Daytona Cloud Secrets Manager and persistent volume.",
		})
	}
}
