package main

import (
	"log"
	"os"

	"backend/handlers"
	"backend/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := gin.Default()

	// CORS configuration for React frontend
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "X-Daytona-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Services initialization
	daytonaSvc := services.NewDaytonaService()
	agySvc := services.NewAGYService(daytonaSvc)
	wsHub := handlers.NewHub()
	go wsHub.Run()

	// API Routes
	api := r.Group("/api")
	{
		// Health & Config status
		api.GET("/health", handlers.HealthCheck(daytonaSvc))

		// Setup Wizard Endpoints
		api.POST("/setup/verify-daytona", handlers.VerifyDaytonaKey(daytonaSvc))
		api.POST("/setup/init-google-auth", handlers.InitGoogleAuth(daytonaSvc, agySvc))
		api.POST("/setup/submit-auth-code", handlers.SubmitAuthCode(daytonaSvc, agySvc))
		api.GET("/setup/auth-status/:userId", handlers.CheckGoogleAuthStatus(daytonaSvc, agySvc))

		// Workspace & Agent Execution Endpoints
		api.POST("/workspace/create", handlers.CreateWorkspace(daytonaSvc))
		api.GET("/workspace/status/:sandboxId", handlers.GetWorkspaceStatus(daytonaSvc))
		api.GET("/workspace/files", handlers.ListWorkspaceFiles(daytonaSvc))
		api.GET("/workspace/file-content", handlers.GetFileContent(daytonaSvc))
		api.POST("/workspace/file-save", handlers.SaveFileContent(daytonaSvc))
		api.POST("/workspace/prompt", handlers.SendPrompt(daytonaSvc, agySvc, wsHub))
		api.POST("/workspace/stop", handlers.StopPrompt())
		api.GET("/workspace/logs", handlers.FetchSandboxLogs(daytonaSvc))
		api.POST("/workspace/reset", handlers.ResetApp(daytonaSvc))
		api.GET("/workspace/env", handlers.GetEnvVars(daytonaSvc))
		api.POST("/workspace/env", handlers.SaveEnvVars(daytonaSvc))
		api.POST("/workspace/recreate", handlers.RecreateWorkspace(daytonaSvc))
		api.GET("/workspace/preview-url", handlers.GetPreviewLinkHandler(daytonaSvc))
		api.POST("/workspace/vnc/start", handlers.StartVNCHandler(daytonaSvc))
		api.POST("/workspace/vnc/stop", handlers.StopVNCHandler(daytonaSvc))
		api.GET("/workspace/vnc/status", handlers.GetVNCStatusHandler(daytonaSvc))
		api.GET("/workspace/telemetry", handlers.GetTelemetryHandler(daytonaSvc))
	}

	// WebSocket Endpoint for Real-time Streaming
	r.GET("/ws", handlers.HandleWebSocket(wsHub))

	log.Printf("🚀 AGY Cloud Backend listening on http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
