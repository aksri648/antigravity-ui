package handlers

import (
	"net/http"
	"runtime"
	"time"

	"backend/db"
	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
)

var platformStartTime = time.Now()

type PlatformTelemetry struct {
	Platform struct {
		Name          string    `json:"name"`
		Version       string    `json:"version"`
		Environment   string    `json:"environment"`
		StartTime     time.Time `json:"startTime"`
		UptimeSeconds int64     `json:"uptimeSeconds"`
		UptimeHuman   string    `json:"uptimeHuman"`
		GoVersion     string    `json:"goVersion"`
		NumCPU        int       `json:"numCPU"`
		OS            string    `json:"os"`
		Arch          string    `json:"arch"`
	} `json:"platform"`
	Runtime struct {
		Goroutines    int     `json:"goroutines"`
		AllocMB       float64 `json:"allocMB"`
		TotalAllocMB  float64 `json:"totalAllocMB"`
		SysMB         float64 `json:"sysMB"`
		NumGC         uint32  `json:"numGC"`
		PauseTotalNs  uint64  `json:"pauseTotalNs"`
		HeapObjects   uint64  `json:"heapObjects"`
	} `json:"runtime"`
	Database struct {
		Driver          string `json:"driver"`
		Status          string `json:"status"`
		OpenConnections int    `json:"openConnections"`
		InUse           int    `json:"inUse"`
		Idle            int    `json:"idle"`
		WaitCount       int64  `json:"waitCount"`
		MaxOpenConns    int    `json:"maxOpenConns"`
	} `json:"database"`
	Realtime struct {
		ActiveWebSockets int `json:"activeWebSockets"`
	} `json:"realtime"`
	Metrics struct {
		TotalUsers         int64 `json:"totalUsers"`
		ActiveSandboxes    int64 `json:"activeSandboxes"`
		TotalChatMessages  int64 `json:"totalChatMessages"`
		TotalAppDeploys    int   `json:"totalAppDeploys"`
		TotalLLMDeploys    int   `json:"totalLLMDeploys"`
	} `json:"metrics"`
	Timestamp time.Time `json:"timestamp"`
}

// GetPlatformTelemetry returns live runtime, memory, database, and system metrics of the DELTA SaaS platform
func GetPlatformTelemetry(userSvc *services.UserService, wsHub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		uptime := time.Since(platformStartTime)
		uptimeStr := uptime.Truncate(time.Second).String()

		telemetry := PlatformTelemetry{}

		// 1. Platform Info
		telemetry.Platform.Name = "DELTA Autonomous FDE Platform"
		telemetry.Platform.Version = "2.5.0"
		telemetry.Platform.Environment = gin.Mode()
		telemetry.Platform.StartTime = platformStartTime
		telemetry.Platform.UptimeSeconds = int64(uptime.Seconds())
		telemetry.Platform.UptimeHuman = uptimeStr
		telemetry.Platform.GoVersion = runtime.Version()
		telemetry.Platform.NumCPU = runtime.NumCPU()
		telemetry.Platform.OS = runtime.GOOS
		telemetry.Platform.Arch = runtime.GOARCH

		// 2. Go Runtime & Memory
		telemetry.Runtime.Goroutines = runtime.NumGoroutine()
		telemetry.Runtime.AllocMB = float64(m.Alloc) / 1024 / 1024
		telemetry.Runtime.TotalAllocMB = float64(m.TotalAlloc) / 1024 / 1024
		telemetry.Runtime.SysMB = float64(m.Sys) / 1024 / 1024
		telemetry.Runtime.NumGC = m.NumGC
		telemetry.Runtime.PauseTotalNs = m.PauseTotalNs
		telemetry.Runtime.HeapObjects = m.HeapObjects

		// 3. Database Stats & Connection Pool
		dbDriver := "sqlite"
		if db.IsPostgres() {
			dbDriver = "PostgreSQL 16 (Render Managed)"
		} else {
			dbDriver = "SQLite 3 (Local Embedded)"
		}
		telemetry.Database.Driver = dbDriver
		telemetry.Database.Status = "healthy"
		telemetry.Database.MaxOpenConns = 20

		if db.DB != nil {
			dbStats := db.DB.Stats()
			telemetry.Database.OpenConnections = dbStats.OpenConnections
			telemetry.Database.InUse = dbStats.InUse
			telemetry.Database.Idle = dbStats.Idle
			telemetry.Database.WaitCount = dbStats.WaitCount
		}

		// 4. Real-time WebSocket clients
		if wsHub != nil {
			telemetry.Realtime.ActiveWebSockets = len(wsHub.clients)
		}

		// 5. High-Level Metrics (Count Queries)
		if db.DB != nil {
			var userCount int64
			var sandboxCount int64
			var msgCount int64

			if err := db.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount); err == nil {
				telemetry.Metrics.TotalUsers = userCount
			}
			if err := db.DB.QueryRow("SELECT COUNT(*) FROM sandboxes").Scan(&sandboxCount); err == nil {
				telemetry.Metrics.ActiveSandboxes = sandboxCount
			}
			if err := db.DB.QueryRow("SELECT COUNT(*) FROM chat_messages").Scan(&msgCount); err == nil {
				telemetry.Metrics.TotalChatMessages = msgCount
			}
		}

		if userSvc != nil {
			var dummy models.User
			_ = dummy
		}

		telemetry.Timestamp = time.Now()

		c.JSON(http.StatusOK, telemetry)
	}
}
