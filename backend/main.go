package main

import (
	"log"
	"os"

	"backend/db"
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

	// 1. Initialize SQLite Database
	dbPath := os.Getenv("SQLITE_DB_PATH")
	if dbPath == "" {
		dbPath = "data/agy_cloud.db"
	}
	_, err := db.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize SQLite database: %v", err)
	}
	log.Printf("📦 SQLite database connected and migrations applied at: %s", dbPath)

	r := gin.Default()

	// 2. CORS configuration for React frontend
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "X-Daytona-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// 3. Services initialization
	daytonaSvc := services.NewDaytonaService()
	agySvc := services.NewAGYService(daytonaSvc)
	userSvc := services.NewUserService(daytonaSvc)

	wsHub := handlers.NewHub()
	go wsHub.Run()

	// 4. API Routes
	api := r.Group("/api")
	api.Use(handlers.AuthMiddleware(userSvc))
	{
		// Health status
		api.GET("/health", handlers.HealthCheck(daytonaSvc))

		// Multi-User SaaS Authentication Endpoints
		api.POST("/auth/register", handlers.Register(userSvc))
		api.POST("/auth/signup", handlers.Register(userSvc))
		api.POST("/auth/login", handlers.Login(userSvc))
		api.POST("/auth/logout", func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
		api.GET("/auth/me", handlers.GetMe(userSvc))
		api.POST("/auth/settings", handlers.UpdateSettings(userSvc))
		api.GET("/auth/google/callback", handlers.GoogleOAuthCallback(daytonaSvc, agySvc, userSvc))

		// Persistent Chat & Runs History
		api.GET("/chat/history", handlers.GetChatHistoryHandler(userSvc))
		api.POST("/chat/history", handlers.SaveChatMessageHandler(userSvc))
		api.DELETE("/chat/history", handlers.ClearChatHistoryHandler(userSvc))
		api.GET("/runs", handlers.ListRunsHandler(userSvc))

		// Environment & Setup Endpoints (Plan Spec §7.1)
		api.POST("/env/provision", handlers.CreateWorkspace(daytonaSvc, userSvc))
		api.GET("/env/status", func(c *gin.Context) {
			c.JSON(200, gin.H{"sandbox_state": "running", "agy_authenticated": true})
		})
		api.POST("/env/auth/start", handlers.InitGoogleAuth(daytonaSvc, agySvc))
		api.GET("/env/auth/poll", func(c *gin.Context) {
			c.JSON(200, gin.H{"authenticated": true})
		})
		api.POST("/setup/verify-daytona", handlers.VerifyDaytonaKey(daytonaSvc))
		api.POST("/setup/init-google-auth", handlers.InitGoogleAuth(daytonaSvc, agySvc))
		api.POST("/setup/submit-auth-code", handlers.SubmitAuthCode(daytonaSvc, agySvc))
		api.POST("/setup/save-google-key", handlers.SaveGoogleApiKeyHandler(daytonaSvc, agySvc))
		api.GET("/setup/auth-status/:userId", handlers.CheckGoogleAuthStatus(daytonaSvc, agySvc))

		// File System API (Plan Spec §7.1)
		api.GET("/fs/list", handlers.ListWorkspaceFiles(daytonaSvc))
		api.GET("/fs/read", handlers.GetFileContent(daytonaSvc))
		api.PUT("/fs/write", handlers.SaveFileContent(daytonaSvc))
		api.POST("/fs/mkdir", handlers.CreateFolderHandler(daytonaSvc))
		api.DELETE("/fs/delete", handlers.DeleteFileHandler(daytonaSvc))

		// Workspace & Execution Endpoints
		api.POST("/workspace/create", handlers.CreateWorkspace(daytonaSvc, userSvc))
		api.GET("/workspace/status/:sandboxId", handlers.GetWorkspaceStatus(daytonaSvc))
		api.GET("/workspace/files", handlers.ListWorkspaceFiles(daytonaSvc))
		api.GET("/workspace/file-content", handlers.GetFileContent(daytonaSvc))
		api.POST("/workspace/file-save", handlers.SaveFileContent(daytonaSvc))
		api.POST("/workspace/prompt", handlers.SendPrompt(daytonaSvc, agySvc, userSvc, wsHub))
		api.POST("/workspace/stop", handlers.StopPrompt())
		api.GET("/workspace/logs", handlers.FetchSandboxLogs(daytonaSvc))
		api.POST("/workspace/reset", handlers.ResetApp(daytonaSvc))
		api.GET("/workspace/env", handlers.GetEnvVars(daytonaSvc))
		api.POST("/workspace/env", handlers.SaveEnvVars(daytonaSvc))
		api.POST("/workspace/recreate", handlers.RecreateWorkspace(daytonaSvc))
		api.GET("/workspace/preview-url", handlers.GetPreviewLinkHandler(daytonaSvc))
		api.GET("/preview/url", handlers.GetPreviewLinkHandler(daytonaSvc))
		api.POST("/workspace/vnc/start", handlers.StartVNCHandler(daytonaSvc))
		api.POST("/workspace/vnc/stop", handlers.StopVNCHandler(daytonaSvc))
		api.GET("/workspace/vnc/status", handlers.GetVNCStatusHandler(daytonaSvc))
		api.POST("/vnc/start", handlers.StartVNCHandler(daytonaSvc))
		api.POST("/vnc/stop", handlers.StopVNCHandler(daytonaSvc))
		api.GET("/workspace/telemetry", handlers.GetTelemetryHandler(daytonaSvc))
		api.GET("/telemetry/metrics", handlers.GetTelemetryHandler(daytonaSvc))
	}

	// WebSocket Endpoint for Real-time Streaming
	r.GET("/ws", handlers.HandleWebSocket(wsHub))

	log.Printf("🚀 AGY Cloud SaaS Backend listening on http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
