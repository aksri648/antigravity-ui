package handlers

import (
	"net/http"

	"backend/services"

	"github.com/gin-gonic/gin"
)

// GetChatHistoryHandler returns persisted chat history for a user
func GetChatHistoryHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Query("userId")
		if u, exists := c.Get("userId"); exists && userId == "" {
			userId = u.(string)
		}
		if userId == "" {
			c.JSON(http.StatusOK, gin.H{"messages": []interface{}{}})
			return
		}
		sandboxId := c.DefaultQuery("sandboxId", "")
		conversationId := c.Query("conversationId")
		projectId := c.Query("projectId")

		messages, err := userSvc.GetChatHistoryWithContext(userId, sandboxId, conversationId, projectId)
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
			UserId         string                   `json:"userId"`
			SandboxId      string                   `json:"sandboxId"`
			ConversationId string                   `json:"conversationId"`
			ProjectId      string                   `json:"projectId"`
			Sender         string                   `json:"sender"`
			Text           string                   `json:"text"`
			Thoughts       []string                 `json:"thoughts,omitempty"`
			Tools          []map[string]interface{} `json:"tools,omitempty"`
			IsError        bool                     `json:"isError,omitempty"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
			return
		}

		if req.UserId == "" {
			if u, exists := c.Get("userId"); exists {
				req.UserId = u.(string)
			}
		}
		if req.UserId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required to save chat message"})
			return
		}

		err := userSvc.SaveChatMessageWithContext(req.UserId, req.SandboxId, req.ConversationId, req.ProjectId, req.Sender, req.Text, req.Thoughts, req.Tools, req.IsError)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// ClearChatHistoryHandler clears chat history for a user or specific conversation
func ClearChatHistoryHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Query("userId")
		if u, exists := c.Get("userId"); exists && userId == "" {
			userId = u.(string)
		}
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required to clear history"})
			return
		}
		conversationId := c.Query("conversationId")

		var err error
		if conversationId != "" {
			err = userSvc.ClearConversationChatHistory(userId, conversationId)
		} else {
			sandboxId := c.DefaultQuery("sandboxId", "")
			err = userSvc.ClearChatHistory(userId, sandboxId)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Chat history cleared"})
	}
}
