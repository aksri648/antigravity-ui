package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

var (
	DB   *sql.DB
	once sync.Once
)

// InitDB initializes SQLite database with WAL mode and tables
func InitDB(dbPath string) (*sql.DB, error) {
	var initErr error
	once.Do(func() {
		if dbPath == "" {
			dbPath = filepath.Join("data", "agy_cloud.db")
		}

		// Ensure directory exists
		dir := filepath.Dir(dbPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			initErr = fmt.Errorf("failed to create data directory: %w", err)
			return
		}

		// Open SQLite database with WAL mode and foreign keys enabled
		database, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)")
		if err != nil {
			initErr = fmt.Errorf("failed to open sqlite database: %w", err)
			return
		}

		// Connection pool settings for high throughput
		database.SetMaxOpenConns(25)
		database.SetMaxIdleConns(10)
		database.SetConnMaxLifetime(10 * time.Minute)

		if err := database.Ping(); err != nil {
			initErr = fmt.Errorf("failed to ping sqlite database: %w", err)
			return
		}

		DB = database

		// Run schema migrations
		if err := migrateSchema(database); err != nil {
			initErr = fmt.Errorf("failed to migrate schema: %w", err)
			return
		}
	})

	return DB, initErr
}

func migrateSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		name TEXT,
		daytona_api_key TEXT,
		daytona_server_url TEXT DEFAULT 'https://app.daytona.io/api',
		volume_id TEXT,
		is_google_authenticated INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sandboxes (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		daytona_sandbox_id TEXT NOT NULL,
		name TEXT,
		state TEXT DEFAULT 'RUNNING',
		preview_url TEXT,
		signed_preview_url TEXT,
		active_port INTEGER DEFAULT 3000,
		is_default INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS chat_messages (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		sandbox_id TEXT NOT NULL,
		sender TEXT NOT NULL,
		text TEXT NOT NULL,
		thoughts_json TEXT,
		tools_json TEXT,
		is_error INTEGER DEFAULT 0,
		created_at INTEGER NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS user_environments (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL UNIQUE,
		sandbox_id TEXT NOT NULL,
		daytona_volume_id TEXT,
		daytona_sandbox_id TEXT,
		sandbox_state TEXT DEFAULT 'none',
		agy_authenticated INTEGER DEFAULT 0,
		vnc_resolution TEXT DEFAULT '1280x800',
		keyring_passphrase TEXT,
		raw_env TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS agent_runs (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		agy_conversation_id TEXT,
		title TEXT,
		status TEXT DEFAULT 'idle',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS agent_messages (
		id TEXT PRIMARY KEY,
		run_id TEXT NOT NULL,
		user_id TEXT,
		role TEXT NOT NULL,
		step_type TEXT,
		tool_name TEXT,
		content TEXT,
		raw_event TEXT,
		created_at INTEGER NOT NULL,
		FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	CREATE INDEX IF NOT EXISTS idx_sandboxes_user_id ON sandboxes(user_id);
	CREATE INDEX IF NOT EXISTS idx_chat_user_sandbox ON chat_messages(user_id, sandbox_id);
	CREATE INDEX IF NOT EXISTS idx_user_env_user ON user_environments(user_id);
	CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_agent_messages_run ON agent_messages(run_id, created_at ASC);

	CREATE TABLE IF NOT EXISTS cloud_secrets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT NOT NULL,
		provider TEXT NOT NULL,
		key_name TEXT NOT NULL,
		encrypted_value TEXT NOT NULL,
		updated_at INTEGER NOT NULL,
		UNIQUE(user_id, key_name)
	);
	CREATE INDEX IF NOT EXISTS idx_cloud_secrets_user ON cloud_secrets(user_id);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return err
	}

	// Schema alterations for existing DB files
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN google_account_email TEXT;")
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN google_credentials_json TEXT;")
	_, _ = db.Exec("ALTER TABLE user_environments ADD COLUMN google_account_email TEXT;")
	_, _ = db.Exec("ALTER TABLE user_environments ADD COLUMN google_credentials_json TEXT;")

	return nil
}
