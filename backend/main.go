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
		api.POST("/auth/login", handlers.Login(userSvc))
		api.GET("/auth/me", handlers.GetMe(userSvc))
		api.POST("/auth/settings", handlers.UpdateSettings(userSvc))

		// Persistent Chat History
		api.GET("/chat/history", handlers.GetChatHistoryHandler(userSvc))
		api.POST("/chat/history", handlers.SaveChatMessageHandler(userSvc))
		api.DELETE("/chat/history", handlers.ClearChatHistoryHandler(userSvc))

		// Setup Wizard Endpoints
		api.POST("/setup/verify-daytona", handlers.VerifyDaytonaKey(daytonaSvc))
		api.POST("/setup/init-google-auth", handlers.InitGoogleAuth(daytonaSvc, agySvc))
		api.POST("/setup/submit-auth-code", handlers.SubmitAuthCode(daytonaSvc, agySvc))
		api.GET("/setup/auth-status/:userId", handlers.CheckGoogleAuthStatus(daytonaSvc, agySvc))

		// Workspace & Agent Execution Endpoints
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
		api.POST("/workspace/vnc/start", handlers.StartVNCHandler(daytonaSvc))
		api.POST("/workspace/vnc/stop", handlers.StopVNCHandler(daytonaSvc))
		api.GET("/workspace/vnc/status", handlers.GetVNCStatusHandler(daytonaSvc))
		api.GET("/workspace/telemetry", handlers.GetTelemetryHandler(daytonaSvc))
	}

	// WebSocket Endpoint for Real-time Streaming
	r.GET("/ws", handlers.HandleWebSocket(wsHub))

	log.Printf("🚀 AGY Cloud SaaS Backend listening on http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
