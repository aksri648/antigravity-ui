package handlers

import (
	"net/http"

	"backend/services"

	"github.com/gin-gonic/gin"
)

// GetChatHistoryHandler returns persisted chat history for a user
func GetChatHistoryHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.DefaultQuery("userId", "")
		if u, exists := c.Get("userId"); exists && userId == "" {
			userId = u.(string)
		}
		if userId == "" {
			userId = "default-user"
		}
		sandboxId := c.DefaultQuery("sandboxId", "")

		messages, err := userSvc.GetChatHistory(userId, sandboxId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"messages": messages,
		})
	}
}

// SaveChatMessageHandler stores a chat message for a user
func SaveChatMessageHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserId    string                   `json:"userId"`
			SandboxId string                   `json:"sandboxId"`
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

		if req.UserId == "" {
			if u, exists := c.Get("userId"); exists {
				req.UserId = u.(string)
			} else {
				req.UserId = "default-user"
			}
		}

		err := userSvc.SaveChatMessage(req.UserId, req.SandboxId, req.Sender, req.Text, req.Thoughts, req.Tools, req.IsError)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// ClearChatHistoryHandler clears chat history for a user
func ClearChatHistoryHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.DefaultQuery("userId", "")
		if u, exists := c.Get("userId"); exists && userId == "" {
			userId = u.(string)
		}
		if userId == "" {
			userId = "default-user"
		}
		sandboxId := c.DefaultQuery("sandboxId", "")

		err := userSvc.ClearChatHistory(userId, sandboxId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Chat history cleared"})
	}
}
