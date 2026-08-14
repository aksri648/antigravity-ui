package handlers

import (
	"log"
	"net/http"
	"time"

	"backend/db"
	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
)

type DaytonaWebhookEvent struct {
	Event     string                 `json:"event"`
	SandboxID string                 `json:"sandboxId,omitempty"`
	VolumeID  string                 `json:"volumeId,omitempty"`
	UserID    string                 `json:"userId,omitempty"`
	State     string                 `json:"state,omitempty"`
	Timestamp int64                  `json:"timestamp,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// DaytonaWebhookHandler handles incoming lifecycle webhooks from Daytona Cloud
func DaytonaWebhookHandler(daytonaSvc *services.DaytonaService, wsHub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		var event DaytonaWebhookEvent
		if err := c.ShouldBindJSON(&event); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook payload"})
			return
		}

		log.Printf("🔔 Daytona Webhook Received: Event=%s, SandboxID=%s, State=%s", event.Event, event.SandboxID, event.State)

		// 1. Update database state based on event
		if db.DB != nil && event.SandboxID != "" {
			if event.State != "" {
				_, _ = db.DB.Exec("UPDATE sandboxes SET state = ?, updated_at = ? WHERE daytona_sandbox_id = ?", event.State, time.Now().Unix(), event.SandboxID)
			}
			if event.Event == "sandbox.deleted" {
				_, _ = db.DB.Exec("UPDATE sandboxes SET state = 'DELETED', updated_at = ? WHERE daytona_sandbox_id = ?", time.Now().Unix(), event.SandboxID)
			}
		}

		// 2. Broadcast real-time event to connected WebSocket clients
		if wsHub != nil {
			msgContent := "Daytona Cloud update: " + event.Event
			if event.State != "" {
				msgContent = "Daytona Sandbox " + event.SandboxID + " status changed to: " + event.State
			}
			wsHub.BroadcastEvent(models.StreamEvent{
				Type:      "system",
				Content:   msgContent,
				SandboxID: event.SandboxID,
				Metadata:  event.Data,
				Timestamp: time.Now().UnixMilli(),
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"received":  true,
			"event":     event.Event,
			"sandboxId": event.SandboxID,
		})
	}
}
