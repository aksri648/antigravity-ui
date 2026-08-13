package handlers

import (
	"net/http"
	"strings"

	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates JWT token from Authorization header or query param
func AuthMiddleware(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		tokenStr := ""

		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		} else if qToken := c.Query("token"); qToken != "" {
			tokenStr = qToken
		}

		if tokenStr != "" {
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

		// Allow request to continue (handlers check for userId or fallback to default)
		c.Next()
	}
}

// Register handles SaaS user signup
func Register(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		resp, err := userSvc.Register(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, resp)
	}
}

// Login handles SaaS user sign in
func Login(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid login credentials"})
			return
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
func GetMe(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIdVal, exists := c.Get("userId")
		if !exists {
			// Check query or param
			userIdVal = c.DefaultQuery("userId", "")
		}

		userId, ok := userIdVal.(string)
		if !ok || userId == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized session"})
			return
		}

		user, err := userSvc.GetUserByID(userId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		activeSandbox, _ := userSvc.GetActiveUserSandbox(userId)

		c.JSON(http.StatusOK, gin.H{
			"user":          user,
			"activeSandbox": activeSandbox,
		})
	}
}

// UpdateSettings updates user credentials in SQLite
func UpdateSettings(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIdVal, exists := c.Get("userId")
		userId := ""
		if exists {
			userId = userIdVal.(string)
		} else {
			userId = c.DefaultQuery("userId", "default-user")
		}

		var req models.UpdateSettingsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		err := userSvc.UpdateUserSettings(userId, req.ApiKey, req.ServerUrl, "", false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "User settings updated in SQLite database",
		})
	}
}

// GetChatHistoryHandler returns chat history from SQLite for user's sandbox
func GetChatHistoryHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.DefaultQuery("userId", "default-user")
		sandboxId := c.Query("sandboxId")

		if u, exists := c.Get("userId"); exists {
			userId = u.(string)
		}

		messages, err := userSvc.GetChatHistory(userId, sandboxId)
		if err != nil {
			c.JSON(http.StatusOK, []models.ChatMessageDTO{})
			return
		}

		c.JSON(http.StatusOK, messages)
	}
}

// SaveChatMessageHandler stores user or agy messages in SQLite
func SaveChatMessageHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserId    string                   `json:"userId"`
			SandboxID string                   `json:"sandboxId"`
			Sender    string                   `json:"sender"`
			Text      string                   `json:"text"`
			Thoughts  []string                 `json:"thoughts,omitempty"`
			Tools     []map[string]interface{} `json:"tools,omitempty"`
			IsError   bool                     `json:"isError,omitempty"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		if u, exists := c.Get("userId"); exists {
			req.UserId = u.(string)
		}
		if req.UserId == "" {
			req.UserId = "default-user"
		}

		err := userSvc.SaveChatMessage(req.UserId, req.SandboxID, req.Sender, req.Text, req.Thoughts, req.Tools, req.IsError)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// ClearChatHistoryHandler deletes chat history for the user's sandbox
func ClearChatHistoryHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.DefaultQuery("userId", "default-user")
		sandboxId := c.Query("sandboxId")

		if u, exists := c.Get("userId"); exists {
			userId = u.(string)
		}

		userSvc.ClearChatHistory(userId, sandboxId)
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Chat history cleared"})
	}
}
