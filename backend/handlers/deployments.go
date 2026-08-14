package handlers

import (
	"net/http"

	"backend/services"

	"github.com/gin-gonic/gin"
)

// ListLLMDeploymentsHandler returns active LLM inference deployments
func ListLLMDeploymentsHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		if userId == "" {
			c.JSON(http.StatusOK, gin.H{"deployments": []interface{}{}})
			return
		}
		projectId := c.Query("projectId")

		list, err := userSvc.ListLLMDeployments(userId, projectId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"deployments": list,
			"count":       len(list),
		})
	}
}

// ListAppDeploymentsHandler returns active application deployments
func ListAppDeploymentsHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		if userId == "" {
			c.JSON(http.StatusOK, gin.H{"deployments": []interface{}{}})
			return
		}
		projectId := c.Query("projectId")

		list, err := userSvc.ListAppDeployments(userId, projectId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"deployments": list,
			"count":       len(list),
		})
	}
}

// GetDeploymentSummaryHandler returns aggregated summary metrics for all deployments
func GetDeploymentSummaryHandler(userSvc *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := getUserId(c)
		if userId == "" {
			c.JSON(http.StatusOK, gin.H{
				"totalLlmDeployments": 0,
				"activeLlmCount":      0,
				"totalAppDeployments": 0,
				"activeAppCount":      0,
				"llmDeployments":      []interface{}{},
				"appDeployments":      []interface{}{},
			})
			return
		}
		projectId := c.Query("projectId")

		summary, err := userSvc.GetDeploymentSummary(userId, projectId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, summary)
	}
}
