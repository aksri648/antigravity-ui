package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates JWT token from Authorization header or query param via Supabase or SQLite
func AuthMiddleware(userSvc *services.UserService, supabaseSvc *services.SupabaseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		tokenStr := ""

		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		} else if qToken := c.Query("token"); qToken != "" {
			tokenStr = qToken
		}

		if tokenStr != "" {
			// 1. Try Supabase Token Verification if configured
			if supabaseSvc != nil && supabaseSvc.IsConfigured() {
				if supaUser, err := supabaseSvc.VerifyToken(tokenStr); err == nil && supaUser != nil {
					c.Set("userId", supaUser.ID)
					c.Set("email", supaUser.Email)
					c.Set("name", supaUser.Name)
					if supaUser.DaytonaApiKey != "" {
						c.Set("daytonaApiKey", supaUser.DaytonaApiKey)
					}
					if supaUser.DaytonaServerUrl != "" {
						c.Set("daytonaServerUrl", supaUser.DaytonaServerUrl)
					}
					c.Next()
					return
				}
			}

			// 2. Fallback to local JWT verification
			claims, err := userSvc.ValidateJWT(tokenStr)
			if err == nil && claims != nil {
				c.Set("userId", (*claims)["userId"])
				c.Set("email", (*claims)["email"])
				c.Set("name", (*claims)["name"])
				if apiKey, ok := (*claims)["daytonaApiKey"].(string); ok {
					c.Set("daytonaApiKey", apiKey)
				}
				if serverUrl, ok := (*claims)["daytonaServerUrl"].(string); ok {
					c.Set("daytonaServerUrl", serverUrl)
				}
			}
		}

		// Allow request to continue
		c.Next()
	}
}

// Register handles SaaS user signup via Supabase Auth or SQLite
func Register(userSvc *services.UserService, supabaseSvc *services.SupabaseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		// If Supabase Auth is configured, sign up through Supabase
		if supabaseSvc != nil && supabaseSvc.IsConfigured() {
			supaResp, err := supabaseSvc.SignUp(req.Email, req.Password, req.Name, req.DaytonaApiKey, req.DaytonaServerUrl)
			if err == nil && supaResp != nil {
				// Mirror to local SQLite database
				_, _ = userSvc.Register(req)
				c.JSON(http.StatusCreated, supaResp)
				return
			}
		}

		resp, err := userSvc.Register(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, resp)
	}
}

// Login handles SaaS user sign in via Supabase Auth or SQLite
func Login(userSvc *services.UserService, supabaseSvc *services.SupabaseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid login credentials"})
			return
		}

		// If Supabase Auth is configured, authenticate through Supabase
		if supabaseSvc != nil && supabaseSvc.IsConfigured() {
			supaResp, err := supabaseSvc.SignIn(req.Email, req.Password)
			if err == nil && supaResp != nil {
				c.JSON(http.StatusOK, supaResp)
				return
			}
		}

		resp, err := userSvc.Login(req)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// GetMe returns current authenticated user profile and their active Daytona sandbox
func GetMe(userSvc *services.UserService, supabaseSvc *services.SupabaseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIdVal, exists := c.Get("userId")
		if !exists {
			userIdVal = c.DefaultQuery("userId", "")
		}

		userId, ok := userIdVal.(string)
		if !ok || userId == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized session"})
			return
		}

		user, err := userSvc.GetUserByID(userId)
		if err != nil {
			// Construct profile from context if created via Supabase
			email, _ := c.Get("email")
			name, _ := c.Get("name")
			daytonaApiKey, _ := c.Get("daytonaApiKey")
			daytonaServerUrl, _ := c.Get("daytonaServerUrl")

			user = &models.User{
				ID:               userId,
				Email:            fmt.Sprintf("%v", email),
				Name:             fmt.Sprintf("%v", name),
				DaytonaApiKey:    fmt.Sprintf("%v", daytonaApiKey),
				DaytonaServerUrl: fmt.Sprintf("%v", daytonaServerUrl),
			}
		}

		activeSandbox, _ := userSvc.GetActiveUserSandbox(userId)

		c.JSON(http.StatusOK, gin.H{
			"user":          user,
			"activeSandbox": activeSandbox,
		})
	}
}

// UpdateSettings updates user settings including Daytona credentials
func UpdateSettings(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIdVal, exists := c.Get("userId")
		if !exists {
			userIdVal = c.DefaultQuery("userId", "")
		}

		userId, ok := userIdVal.(string)
		if !ok || userId == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized session"})
			return
		}

		var req models.UpdateSettingsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		if err := userSvc.UpdateUserSettings(userId, req.ApiKey, req.ServerUrl, "", false); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Settings updated successfully"})
	}
}
