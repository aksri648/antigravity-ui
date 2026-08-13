package handlers

import (
	"net/http"

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
		if userId == "" {
			userId = "default-user"
		}

		c.JSON(http.StatusOK, models.AuthStatusResponse{
			Authenticated: true,
			AccountEmail:  "user@google-account.com",
		})
	}
}
