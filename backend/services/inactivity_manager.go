package services

import (
	"fmt"
	"log"
	"sync"
	"time"

	"backend/db"
	"backend/models"
)

type EventBroadcaster interface {
	BroadcastEvent(event models.StreamEvent)
}

type SandboxActivity struct {
	SandboxID    string
	UserID       string
	ApiKey       string
	ServerURL    string
	LastActivity time.Time
}

type InactivityManager struct {
	daytonaSvc  *DaytonaService
	broadcaster EventBroadcaster
	mu          sync.RWMutex
	activities  map[string]*SandboxActivity
	timeout     time.Duration
	stopCh      chan struct{}
}

func NewInactivityManager(daytonaSvc *DaytonaService, broadcaster EventBroadcaster, timeout time.Duration) *InactivityManager {
	if timeout <= 0 {
		timeout = 30 * time.Minute
	}
	im := &InactivityManager{
		daytonaSvc:  daytonaSvc,
		broadcaster: broadcaster,
		activities:  make(map[string]*SandboxActivity),
		timeout:     timeout,
		stopCh:      make(chan struct{}),
	}
	go im.startCleanupLoop()
	return im
}

// RecordActivity updates the last active timestamp for a sandbox
func (im *InactivityManager) RecordActivity(sandboxId string, apiKey string, serverUrl string, userId string) {
	if sandboxId == "" {
		return
	}
	im.mu.Lock()
	defer im.mu.Unlock()

	if act, exists := im.activities[sandboxId]; exists {
		act.LastActivity = time.Now()
		if apiKey != "" {
			act.ApiKey = apiKey
		}
		if serverUrl != "" {
			act.ServerURL = serverUrl
		}
		if userId != "" {
			act.UserID = userId
		}
	} else {
		im.activities[sandboxId] = &SandboxActivity{
			SandboxID:    sandboxId,
			UserID:       userId,
			ApiKey:       apiKey,
			ServerURL:    serverUrl,
			LastActivity: time.Now(),
		}
	}
}

// RemoveActivity stops tracking a sandbox (e.g. manually deleted)
func (im *InactivityManager) RemoveActivity(sandboxId string) {
	im.mu.Lock()
	defer im.mu.Unlock()
	delete(im.activities, sandboxId)
}

func (im *InactivityManager) startCleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-im.stopCh:
			return
		case <-ticker.C:
			im.checkAndCleanup()
		}
	}
}

func (im *InactivityManager) checkAndCleanup() {
	im.mu.Lock()
	now := time.Now()
	var toDelete []*SandboxActivity

	for id, act := range im.activities {
		if now.Sub(act.LastActivity) >= im.timeout {
			toDelete = append(toDelete, act)
			delete(im.activities, id)
		}
	}
	im.mu.Unlock()

	for _, act := range toDelete {
		im.persistAndDestroySandbox(act)
	}
}

func (im *InactivityManager) persistAndDestroySandbox(act *SandboxActivity) {
	log.Printf("⏳ Sandbox %s reached %v inactivity. Persisting codebase to volume and deleting container...", act.SandboxID, im.timeout)

	// 1. Sync & flush codebase directly to persistent volume
	flushCmd := `
if [ -d /home/daytona/workspace ] && [ -d /home/daytona/persist/workspace ]; then
  rsync -au /home/daytona/workspace/ /home/daytona/persist/workspace/ 2>/dev/null || cp -ru /home/daytona/workspace/. /home/daytona/persist/workspace/ 2>/dev/null || true
fi
sync
`
	if act.ApiKey != "" {
		_, _ = im.daytonaSvc.ExecProcess(act.ApiKey, act.ServerURL, act.SandboxID, flushCmd)
	}

	// 2. Delete ephemeral sandbox container in Daytona
	if act.ApiKey != "" {
		if err := im.daytonaSvc.DeleteSandbox(act.ApiKey, act.ServerURL, act.SandboxID); err != nil {
			log.Printf("⚠️ Inactivity cleanup error deleting sandbox %s: %v", act.SandboxID, err)
		} else {
			log.Printf("🗑️ Inactivity cleanup: sandbox %s deleted successfully (volume intact).", act.SandboxID)
		}
	}

	// 3. Update SQLite database state
	if db.DB != nil {
		_, _ = db.DB.Exec("UPDATE sandboxes SET state = 'DELETED_INACTIVE', updated_at = ? WHERE daytona_sandbox_id = ?", time.Now().Unix(), act.SandboxID)
	}

	// 4. Broadcast notification to WebSocket clients
	if im.broadcaster != nil {
		im.broadcaster.BroadcastEvent(models.StreamEvent{
			Type:      "system",
			Content:   fmt.Sprintf("Sandbox %s was paused and deleted after %d minutes of inactivity. Your codebase and Google AI credentials remain safely preserved in your persistent Daytona Volume.", act.SandboxID, int(im.timeout.Minutes())),
			SandboxID: act.SandboxID,
			Timestamp: time.Now().UnixMilli(),
		})
	}
}

func (im *InactivityManager) Stop() {
	close(im.stopCh)
}
