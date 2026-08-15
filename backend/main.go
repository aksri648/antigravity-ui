package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"backend/db"
	"backend/handlers"
	"backend/services"

	"github.com/gin-gonic/gin"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 1. Initialize Database (PostgreSQL if DATABASE_URL/POSTGRES_URL is set, fallback to SQLite)
	dbConnStr := os.Getenv("DATABASE_URL")
	if dbConnStr == "" {
		dbConnStr = os.Getenv("POSTGRES_URL")
	}
	if dbConnStr == "" {
		dbConnStr = os.Getenv("SQLITE_DB_PATH")
	}
	if dbConnStr == "" {
		dbConnStr = "data/agy_cloud.db"
	}
	driverName, err := db.InitDB(dbConnStr)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	log.Printf("📦 Database connected (%s) and schema migrations applied", driverName)

	r := gin.Default()

	// 2. Robust Universal CORS Middleware (reflects origin & handles preflight OPTIONS with 204 No Content)
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Daytona-Key")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH, HEAD")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length, Access-Control-Allow-Origin")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// 3. Services initialization
	daytonaSvc := services.NewDaytonaService()
	agySvc := services.NewAGYService(daytonaSvc)
	userSvc := services.NewUserService(daytonaSvc)
	clerkSvc := services.NewClerkService()
	if clerkSvc.IsConfigured() {
		log.Printf("🔒 Clerk authentication integration active and connected")
	}

	wsHub := handlers.NewHub()
	go wsHub.Run()

	inactivityMgr := services.NewInactivityManager(daytonaSvc, wsHub, 30*time.Minute)

	// 4. API Routes
	api := r.Group("/api")
	api.Use(handlers.AuthMiddleware(userSvc, clerkSvc))
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
		// Health & Telemetry status
		api.GET("/health", handlers.HealthCheck(daytonaSvc))
		api.GET("/telemetry", handlers.GetPlatformTelemetry(userSvc, wsHub))
		api.GET("/telemetry/ai-eval", handlers.GetAIAgentEvalReport())
		api.POST("/telemetry/ai-eval/run", handlers.RunLiveAIEvalTest())

		// Multi-User SaaS Authentication Endpoints (Clerk & Local Auth)
		api.POST("/auth/register", handlers.Register(userSvc, clerkSvc))
		api.POST("/auth/signup", handlers.Register(userSvc, clerkSvc))
		api.POST("/auth/login", handlers.Login(userSvc, clerkSvc))
		api.POST("/auth/logout", func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
		api.GET("/auth/me", handlers.GetMe(userSvc, clerkSvc))
		api.POST("/auth/settings", handlers.UpdateSettings(userSvc))
		api.GET("/auth/google/callback", handlers.GoogleOAuthCallback(daytonaSvc, agySvc, userSvc))

		// Multi-Project Management Endpoints
		api.GET("/projects", handlers.ListProjectsHandler(userSvc))
		api.POST("/projects", handlers.CreateProjectHandler(userSvc))
		api.PUT("/projects/:id", handlers.UpdateProjectHandler(userSvc))
		api.DELETE("/projects/:id", handlers.DeleteProjectHandler(userSvc))

		// Multi-Chat Conversations Endpoints
		api.GET("/conversations", handlers.ListConversationsHandler(userSvc))
		api.POST("/conversations", handlers.CreateConversationHandler(userSvc))
		api.PUT("/conversations/:id", handlers.UpdateConversationHandler(userSvc))
		api.DELETE("/conversations/:id", handlers.DeleteConversationHandler(userSvc))

		// Persistent Chat & Runs History
		api.GET("/chat/history", handlers.GetChatHistoryHandler(userSvc))
		api.POST("/chat/history", handlers.SaveChatMessageHandler(userSvc))
		api.DELETE("/chat/history", handlers.ClearChatHistoryHandler(userSvc))
		api.GET("/runs", handlers.ListRunsHandler(userSvc))

		// Environment & Setup Endpoints (Dynamic lookups)
		api.POST("/env/provision", handlers.CreateWorkspace(daytonaSvc, userSvc))
		api.GET("/env/status", func(c *gin.Context) {
			userId := ""
			if u, exists := c.Get("userId"); exists {
				userId = u.(string)
			}
			if userId == "" {
				userId = c.Query("userId")
			}

			sandboxState := "none"
			isGoogleAuth := false
			if userId != "" && userSvc != nil {
				if sb, err := userSvc.GetActiveUserSandbox(userId); err == nil && sb != nil {
					sandboxState = sb.State
				}
				if user, err := userSvc.GetUserByID(userId); err == nil && user != nil {
					isGoogleAuth = user.IsGoogleAuthenticated
				}
			}

			c.JSON(200, gin.H{
				"sandbox_state":     sandboxState,
				"agy_authenticated": isGoogleAuth,
			})
		})
		api.POST("/env/auth/start", handlers.InitGoogleAuth(daytonaSvc, agySvc))
		api.GET("/env/auth/poll", func(c *gin.Context) {
			userId := ""
			if u, exists := c.Get("userId"); exists {
				userId = u.(string)
			}
			if userId == "" {
				userId = c.Query("userId")
			}

			isAuth := false
			if userId != "" && userSvc != nil {
				if user, err := userSvc.GetUserByID(userId); err == nil && user != nil {
					isAuth = user.IsGoogleAuthenticated
				}
			}
			c.JSON(200, gin.H{"authenticated": isAuth})
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

		// LLM & Application Deployments (Observability & Management)
		api.GET("/deployments/llm", handlers.ListLLMDeploymentsHandler(userSvc))
		api.GET("/deployments/app", handlers.ListAppDeploymentsHandler(userSvc))
		api.GET("/deployments/summary", handlers.GetDeploymentSummaryHandler(userSvc))

		// Daytona Webhooks
		api.POST("/webhooks/daytona", handlers.DaytonaWebhookHandler(daytonaSvc, wsHub))
	}

	// WebSocket Endpoint for Real-time Streaming
	r.GET("/ws", handlers.HandleWebSocket(wsHub))

	// Serve production React frontend if built
	distPaths := []string{"../frontend/dist", "frontend/dist", "./dist"}
	for _, distPath := range distPaths {
		if stat, err := os.Stat(distPath); err == nil && stat.IsDir() {
			r.Static("/assets", distPath+"/assets")
			r.StaticFile("/favicon.ico", distPath+"/favicon.ico")
			r.NoRoute(func(c *gin.Context) {
				if !strings.HasPrefix(c.Request.URL.Path, "/api") && !strings.HasPrefix(c.Request.URL.Path, "/ws") {
					c.File(distPath + "/index.html")
					return
				}
				c.JSON(404, gin.H{"error": "Endpoint not found"})
			})
			log.Printf("🌐 Serving production frontend static bundle from: %s", distPath)
			break
		}
	}

	log.Printf("🚀 DELTA SaaS Backend listening on http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
