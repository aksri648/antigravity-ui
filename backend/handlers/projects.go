package handlers

import (
	"net/http"

	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
)

// Helper to extract userId
func getUserId(c *gin.Context) string {
	if u, exists := c.Get("userId"); exists {
		return u.(string)
	}
	return c.Query("userId")
}

// ----------------------------------------------------
// Project Handlers
// ----------------------------------------------------

func ListProjectsHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required"})
			return
		}

		projects, err := userSvc.ListProjects(userId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"projects": projects,
		})
	}
}

func CreateProjectHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required"})
			return
		}

		var req struct {
			Name        string `json:"name" binding:"required"`
			Description string `json:"description"`
			ApiKey      string `json:"apiKey"`
			ServerUrl   string `json:"serverUrl"`
			SandboxId   string `json:"sandboxId"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: name is required"})
			return
		}

		// Fallback to stored API key if not supplied
		if req.ApiKey == "" {
			if user, err := userSvc.GetUserByID(userId); err == nil && user != nil {
				req.ApiKey = user.DaytonaApiKey
				if req.ServerUrl == "" {
					req.ServerUrl = user.DaytonaServerUrl
				}
			}
		}

		project, err := userSvc.CreateProject(userId, req.Name, req.Description, req.ApiKey, req.ServerUrl, req.SandboxId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"project": project,
		})
	}
}

func UpdateProjectHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		projectId := c.Param("id")
		if userId == "" || projectId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId and projectId are required"})
			return
		}

		var req models.UpdateProjectRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		err := userSvc.UpdateProject(userId, projectId, req.Name, req.Description)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Project updated successfully",
		})
	}
}

func DeleteProjectHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		projectId := c.Param("id")
		if userId == "" || projectId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId and projectId are required"})
			return
		}

		err := userSvc.DeleteProject(userId, projectId)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Project deleted successfully",
		})
	}
}

// ----------------------------------------------------
// Conversation Handlers (Multi-Chat)
// ----------------------------------------------------

func ListConversationsHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required"})
			return
		}

		projectId := c.Query("projectId")
		convs, err := userSvc.ListConversations(userId, projectId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"conversations": convs,
		})
	}
}

func CreateConversationHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required"})
			return
		}

		var req models.CreateConversationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Title = "New Chat"
		}

		conv, err := userSvc.CreateConversation(userId, req.ProjectID, req.SandboxID, req.Title)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"conversation": conv,
		})
	}
}

func UpdateConversationHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		convId := c.Param("id")
		if userId == "" || convId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId and conversation id are required"})
			return
		}

		var req models.UpdateConversationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
			return
		}

		err := userSvc.UpdateConversationTitle(userId, convId, req.Title)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Conversation title updated",
		})
	}
}

func DeleteConversationHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		convId := c.Param("id")
		if userId == "" || convId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId and conversation id are required"})
			return
		}

		err := userSvc.DeleteConversation(userId, convId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Conversation deleted successfully",
		})
	}
}
