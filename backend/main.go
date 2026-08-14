package main

import (
	"log"
	"os"
	"time"

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
		AllowOrigins: []string{"http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "X-Daytona-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// 3. Services initialization
	daytonaSvc := services.NewDaytonaService()
	agySvc := services.NewAGYService(daytonaSvc)
	userSvc := services.NewUserService(daytonaSvc)
	supabaseSvc := services.NewSupabaseService()
	if supabaseSvc.IsConfigured() {
		log.Printf("⚡ Supabase integration active and connected for DB & Auth")
	}

	wsHub := handlers.NewHub()
	go wsHub.Run()

	inactivityMgr := services.NewInactivityManager(daytonaSvc, wsHub, 30*time.Minute)

	// 4. API Routes
	api := r.Group("/api")
	api.Use(handlers.AuthMiddleware(userSvc, supabaseSvc))
	api.Use(func(c *gin.Context) {
		sandboxId := c.Param("sandboxId")
		if sandboxId == "" {
			sandboxId = c.Query("sandboxId")
		}
		apiKey := c.Query("apiKey")
		serverUrl := c.Query("serverUrl")
		userId := ""
		if u, exists := c.Get("userId"); exists {
			userId = u.(string)
		}
		if sandboxId != "" {
			inactivityMgr.RecordActivity(sandboxId, apiKey, serverUrl, userId)
		}
		c.Next()
	})
	{
		// Health status
		api.GET("/health", handlers.HealthCheck(daytonaSvc))

		// Multi-User SaaS Authentication Endpoints (Supabase & SQLite)
		api.POST("/auth/register", handlers.Register(userSvc, supabaseSvc))
		api.POST("/auth/signup", handlers.Register(userSvc, supabaseSvc))
		api.POST("/auth/login", handlers.Login(userSvc, supabaseSvc))
		api.POST("/auth/logout", func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
		api.GET("/auth/me", handlers.GetMe(userSvc, supabaseSvc))
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
		api.Any("/preview/proxy/:sandboxId/:port/*path", handlers.PreviewProxyHandler(daytonaSvc))
		api.Any("/preview/proxy/:sandboxId/:port", handlers.PreviewProxyHandler(daytonaSvc))
		api.POST("/workspace/vnc/start", handlers.StartVNCHandler(daytonaSvc))
		api.POST("/workspace/vnc/stop", handlers.StopVNCHandler(daytonaSvc))
		api.GET("/workspace/vnc/status", handlers.GetVNCStatusHandler(daytonaSvc))
		api.POST("/vnc/start", handlers.StartVNCHandler(daytonaSvc))
		api.GET("/workspace/telemetry", handlers.GetTelemetryHandler(daytonaSvc))
		api.GET("/telemetry/metrics", handlers.GetTelemetryHandler(daytonaSvc))

		// Cloud & MCP Integration Secrets
		api.GET("/integrations/secrets", handlers.GetSecretsStatusHandler(daytonaSvc))
		api.POST("/integrations/secrets", handlers.SaveSecretsHandler(daytonaSvc))

		// Daytona Webhooks
		api.POST("/webhooks/daytona", handlers.DaytonaWebhookHandler(daytonaSvc, wsHub))
	}

	// WebSocket Endpoint for Real-time Streaming
	r.GET("/ws", handlers.HandleWebSocket(wsHub))

	log.Printf("🚀 DELTA SaaS Backend listening on http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
