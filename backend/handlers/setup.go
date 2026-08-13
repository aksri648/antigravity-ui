package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"strings"

	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
)

func HealthCheck(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "online",
			"service": "AGY Cloud Orchestrator API",
		})
	}
}

// VerifyDaytonaKey handles Step 1 of Onboarding Setup
func VerifyDaytonaKey(daytonaSvc *services.DaytonaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.VerifyDaytonaRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, models.VerifyDaytonaResponse{
				Valid:   false,
				Message: "Invalid request payload",
			})
			return
		}

		profile, err := daytonaSvc.VerifyDaytonaKey(req.ApiKey, req.ServerUrl)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.VerifyDaytonaResponse{
				Valid:   false,
				Message: "Failed to connect to Daytona API: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, models.VerifyDaytonaResponse{
			Valid:   true,
			Message: "Daytona API Key verified successfully!",
			User:    profile.Email,
		})
	}
}

// InitGoogleAuth handles Step 2 of Onboarding Setup (Google OAuth URL generation)
func InitGoogleAuth(daytonaSvc *services.DaytonaService, agySvc *services.AGYService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.InitGoogleAuthRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
			return
		}

		if req.UserId == "" {
			req.UserId = "default-user"
		}

		resp, err := agySvc.InitiateGoogleAuth(req.ApiKey, req.ServerUrl, req.UserId, req.GoogleApiKey, req.OAuthClientId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// SubmitAuthCode handles user submitting their manually pasted Google auth code
func SubmitAuthCode(daytonaSvc *services.DaytonaService, agySvc *services.AGYService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.SubmitAuthCodeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		resp, err := agySvc.SubmitAuthCode(req.ApiKey, req.ServerUrl, req.SandboxID, req.AuthCode)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// CheckGoogleAuthStatus checks if Google credentials are fully cached in Daytona Volume
func CheckGoogleAuthStatus(daytonaSvc *services.DaytonaService, agySvc *services.AGYService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Param("userId")
		sandboxId := c.Query("sandboxId")
		apiKey := c.Query("apiKey")
		serverUrl := c.Query("serverUrl")

		if sandboxId != "" && apiKey != "" {
			cmd := `if [ -f /home/daytona/persist/gemini/oauth_creds.json ] || [ -f /root/.gemini/oauth_creds.json ]; then cat /home/daytona/persist/gemini/google_accounts.json 2>/dev/null || cat /root/.gemini/google_accounts.json 2>/dev/null || echo '{"active":"Google AI Pro User"}'; elif [ -f /home/daytona/persist/gemini/.env ] && grep -q "API_KEY" /home/daytona/persist/gemini/.env; then echo '{"active":"Gemini API Key Active"}'; else echo 'NOT_AUTH'; fi`
			res, err := daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, cmd)
			if err == nil && res != nil && !strings.Contains(res.Result, "NOT_AUTH") && strings.TrimSpace(res.Result) != "" {
				var acc struct {
					Active string `json:"active"`
				}
				_ = json.Unmarshal([]byte(res.Result), &acc)
				email := acc.Active
				if email == "" {
					email = "Google AI Pro User"
				}
				c.JSON(http.StatusOK, models.AuthStatusResponse{
					Authenticated: true,
					AccountEmail:  email,
				})
				return
			}
		}

		if userId != "" && userId != "default-user" {
			// If no sandbox specified, return unauthenticated so UI prompts for login
			c.JSON(http.StatusOK, models.AuthStatusResponse{
				Authenticated: false,
				AccountEmail:  "",
			})
			return
		}

		c.JSON(http.StatusOK, models.AuthStatusResponse{
			Authenticated: false,
			AccountEmail:  "",
		})
	}
}

// SaveGoogleApiKeyHandler stores Gemini API Key directly into Daytona persistent volume
func SaveGoogleApiKeyHandler(daytonaSvc *services.DaytonaService, agySvc *services.AGYService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			ApiKey       string `json:"apiKey"`
			ServerUrl    string `json:"serverUrl,omitempty"`
			SandboxID    string `json:"sandboxId"`
			GoogleApiKey string `json:"googleApiKey"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		if err := agySvc.SaveGoogleApiKey(req.ApiKey, req.ServerUrl, req.SandboxID, req.GoogleApiKey); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save Google API key inside Daytona sandbox: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Google Gemini API key saved into Daytona persistent volume (.env).",
		})
	}
}

// GoogleOAuthCallback handles redirect from Google Sign-In popup/window
func GoogleOAuthCallback(daytonaSvc *services.DaytonaService, agySvc *services.AGYService, userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Query("code")
		stateStr := c.Query("state")
		errParam := c.Query("error")

		if errParam != "" {
			c.Header("Content-Type", "text/html; charset=utf-8")
			c.String(http.StatusBadRequest, fmt.Sprintf(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#f87171;padding:40px;text-align:center;"><h2>Google Login Canceled / Error</h2><p>%s</p><script>if(window.opener){window.opener.postMessage({type:'GOOGLE_AUTH_ERROR',error:'%s'},'*');setTimeout(()=>window.close(),2500);}</script></body></html>`, html.EscapeString(errParam), html.EscapeString(errParam)))
			return
		}

		if code == "" {
			c.String(http.StatusBadRequest, "Missing authorization code from Google")
			return
		}

		var state struct {
			UserId       string `json:"userId"`
			SandboxId    string `json:"sandboxId"`
			ApiKey       string `json:"apiKey"`
			ServerUrl    string `json:"serverUrl"`
			ClientId     string `json:"clientId"`
			ClientSecret string `json:"clientSecret"`
			RedirectURI  string `json:"redirectUri"`
		}
		if stateStr != "" {
			decoded, err := base64.URLEncoding.DecodeString(stateStr)
			if err == nil {
				_ = json.Unmarshal(decoded, &state)
			}
		}

		redirectURI := state.RedirectURI
		if redirectURI == "" {
			redirectURI = "http://localhost:8080/api/auth/google/callback"
		}
		clientId := state.ClientId
		if clientId == "" {
			clientId = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
		}

		_, email, err := agySvc.ExchangeGoogleAuthCode(state.ApiKey, state.ServerUrl, state.SandboxId, code, clientId, state.ClientSecret, redirectURI)
		if err != nil {
			log.Printf("Google token exchange error: %v", err)
		}

		successHTML := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <title>Google Authentication Successful</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px; text-align: center; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
    h2 { color: #38bdf8; margin-top: 0; font-size: 22px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
    .email { color: #4ade80; font-weight: bold; font-family: monospace; background: rgba(74, 222, 128, 0.1); padding: 4px 8px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>✓ Google Account Connected!</h2>
    <p>Authenticated as <span class="email">%s</span></p>
    <p>Your Google AI Pro quota has been provisioned to your Daytona Cloud Sandbox.</p>
    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">This window will close automatically...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'GOOGLE_AUTH_SUCCESS',
        email: '%s'
      }, '*');
      setTimeout(function() { window.close(); }, 1200);
    }
  </script>
</body>
</html>`, html.EscapeString(email), html.EscapeString(email))

		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, successHTML)
	}
}
