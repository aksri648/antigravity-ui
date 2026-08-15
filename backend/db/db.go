package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

var (
	DB         *sql.DB
	DriverName string
	once       sync.Once
)

// IsPostgres returns true if currently connected to PostgreSQL
func IsPostgres() bool {
	return DriverName == "postgres"
}

// InitDB initializes PostgreSQL or SQLite database with connection pooling and automated schema migrations
func InitDB(connStr string) (string, error) {
	var initErr error
	once.Do(func() {
		isPostgres := strings.HasPrefix(connStr, "postgres://") || strings.HasPrefix(connStr, "postgresql://")

		var database *sql.DB
		var err error

		if isPostgres {
			DriverName = "postgres"
			database, err = sql.Open("postgres", connStr)
			if err != nil {
				initErr = fmt.Errorf("failed to open postgresql database: %w", err)
				return
			}
			// PostgreSQL Production Connection Pooling
			database.SetMaxOpenConns(20)
			database.SetMaxIdleConns(5)
			database.SetConnMaxLifetime(15 * time.Minute)
			database.SetConnMaxIdleTime(5 * time.Minute)
		} else {
			DriverName = "sqlite"
			dbPath := connStr
			if dbPath == "" || dbPath == ":memory:" {
				dbPath = filepath.Join("data", "agy_cloud.db")
			}

			// Ensure directory exists
			dir := filepath.Dir(dbPath)
			if dir != "." && dir != "" {
				if err := os.MkdirAll(dir, 0755); err != nil {
					initErr = fmt.Errorf("failed to create data directory: %w", err)
					return
				}
			}

			// Open SQLite database with WAL mode and foreign keys enabled
			dsn := dbPath
			if !strings.Contains(dsn, "_pragma") {
				dsn += "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)"
			}
			database, err = sql.Open("sqlite", dsn)
			if err != nil {
				initErr = fmt.Errorf("failed to open sqlite database: %w", err)
				return
			}
			database.SetMaxOpenConns(25)
			database.SetMaxIdleConns(10)
			database.SetConnMaxLifetime(10 * time.Minute)
		}

		if err := database.Ping(); err != nil {
			initErr = fmt.Errorf("failed to ping %s database: %w", DriverName, err)
			return
		}

		DB = database

		// Run schema migrations
		if isPostgres {
			if err := migratePostgresSchema(database); err != nil {
				initErr = fmt.Errorf("failed to migrate postgres schema: %w", err)
				return
			}
		} else {
			if err := migrateSQLiteSchema(database); err != nil {
				initErr = fmt.Errorf("failed to migrate sqlite schema: %w", err)
				return
			}
		}
	})

	return DriverName, initErr
}

func migratePostgresSchema(db *sql.DB) error {
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
		google_account_email TEXT,
		google_credentials_json TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS chat_messages (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		sandbox_id TEXT NOT NULL,
		conversation_id TEXT,
		project_id TEXT,
		sender TEXT NOT NULL,
		text TEXT NOT NULL,
		thoughts_json TEXT,
		tools_json TEXT,
		is_error INTEGER DEFAULT 0,
		created_at BIGINT NOT NULL,
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
		google_account_email TEXT,
		google_credentials_json TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS agent_runs (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		agy_conversation_id TEXT,
		title TEXT,
		status TEXT DEFAULT 'idle',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
		created_at BIGINT NOT NULL,
		FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		name TEXT NOT NULL,
		slug TEXT NOT NULL,
		description TEXT,
		folder_path TEXT NOT NULL,
		is_default INTEGER DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS conversations (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		project_id TEXT NOT NULL,
		sandbox_id TEXT,
		title TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS cloud_secrets (
		id SERIAL PRIMARY KEY,
		user_id TEXT NOT NULL,
		provider TEXT NOT NULL,
		key_name TEXT NOT NULL,
		encrypted_value TEXT NOT NULL,
		updated_at BIGINT NOT NULL,
		UNIQUE(user_id, key_name)
	);

	CREATE TABLE IF NOT EXISTS llm_deployments (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		project_id TEXT,
		sandbox_id TEXT,
		model_name TEXT NOT NULL,
		provider TEXT NOT NULL,
		endpoint_url TEXT,
		gpu_type TEXT,
		traffic_profile TEXT,
		cost_estimate TEXT,
		status TEXT DEFAULT 'RUNNING',
		latency_ms INTEGER DEFAULT 45,
		throughput_tps REAL DEFAULT 82.5,
		context_length INTEGER DEFAULT 131072,
		quantization TEXT DEFAULT 'FP8',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS app_deployments (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		project_id TEXT,
		sandbox_id TEXT,
		app_name TEXT NOT NULL,
		provider TEXT NOT NULL,
		public_url TEXT,
		port INTEGER DEFAULT 3000,
		image_tag TEXT,
		instance_type TEXT,
		status TEXT DEFAULT 'DEPLOYED',
		ssl_enabled INTEGER DEFAULT 1,
		replicas INTEGER DEFAULT 1,
		cpu_utilization REAL DEFAULT 14.2,
		memory_utilization REAL DEFAULT 38.6,
		uptime TEXT DEFAULT '99.98%',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	CREATE INDEX IF NOT EXISTS idx_sandboxes_user_id ON sandboxes(user_id);
	CREATE INDEX IF NOT EXISTS idx_chat_user_sandbox ON chat_messages(user_id, sandbox_id);
	CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_messages(conversation_id);
	CREATE INDEX IF NOT EXISTS idx_user_env_user ON user_environments(user_id);
	CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_agent_messages_run ON agent_messages(run_id, created_at ASC);
	CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
	CREATE INDEX IF NOT EXISTS idx_conversations_user_proj ON conversations(user_id, project_id);
	CREATE INDEX IF NOT EXISTS idx_cloud_secrets_user ON cloud_secrets(user_id);
	CREATE INDEX IF NOT EXISTS idx_llm_deployments_user ON llm_deployments(user_id);
	CREATE INDEX IF NOT EXISTS idx_app_deployments_user ON app_deployments(user_id);
	`

	_, err := db.Exec(schema)
	return err
}

func migrateSQLiteSchema(db *sql.DB) error {
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
		google_account_email TEXT,
		google_credentials_json TEXT,
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
		conversation_id TEXT,
		project_id TEXT,
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
		google_account_email TEXT,
		google_credentials_json TEXT,
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

	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		name TEXT NOT NULL,
		slug TEXT NOT NULL,
		description TEXT,
		folder_path TEXT NOT NULL,
		is_default INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS conversations (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		project_id TEXT NOT NULL,
		sandbox_id TEXT,
		title TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS cloud_secrets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT NOT NULL,
		provider TEXT NOT NULL,
		key_name TEXT NOT NULL,
		encrypted_value TEXT NOT NULL,
		updated_at INTEGER NOT NULL,
		UNIQUE(user_id, key_name)
	);

	CREATE TABLE IF NOT EXISTS llm_deployments (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		project_id TEXT,
		sandbox_id TEXT,
		model_name TEXT NOT NULL,
		provider TEXT NOT NULL,
		endpoint_url TEXT,
		gpu_type TEXT,
		traffic_profile TEXT,
		cost_estimate TEXT,
		status TEXT DEFAULT 'RUNNING',
		latency_ms INTEGER DEFAULT 45,
		throughput_tps REAL DEFAULT 82.5,
		context_length INTEGER DEFAULT 131072,
		quantization TEXT DEFAULT 'FP8',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS app_deployments (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		project_id TEXT,
		sandbox_id TEXT,
		app_name TEXT NOT NULL,
		provider TEXT NOT NULL,
		public_url TEXT,
		port INTEGER DEFAULT 3000,
		image_tag TEXT,
		instance_type TEXT,
		status TEXT DEFAULT 'DEPLOYED',
		ssl_enabled INTEGER DEFAULT 1,
		replicas INTEGER DEFAULT 1,
		cpu_utilization REAL DEFAULT 14.2,
		memory_utilization REAL DEFAULT 38.6,
		uptime TEXT DEFAULT '99.98%',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	CREATE INDEX IF NOT EXISTS idx_sandboxes_user_id ON sandboxes(user_id);
	CREATE INDEX IF NOT EXISTS idx_chat_user_sandbox ON chat_messages(user_id, sandbox_id);
	CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_messages(conversation_id);
	CREATE INDEX IF NOT EXISTS idx_user_env_user ON user_environments(user_id);
	CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_agent_messages_run ON agent_messages(run_id, created_at ASC);
	CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
	CREATE INDEX IF NOT EXISTS idx_conversations_user_proj ON conversations(user_id, project_id);
	CREATE INDEX IF NOT EXISTS idx_cloud_secrets_user ON cloud_secrets(user_id);
	CREATE INDEX IF NOT EXISTS idx_llm_deployments_user ON llm_deployments(user_id);
	CREATE INDEX IF NOT EXISTS idx_app_deployments_user ON app_deployments(user_id);
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
	_, _ = db.Exec("ALTER TABLE chat_messages ADD COLUMN conversation_id TEXT;")
	_, _ = db.Exec("ALTER TABLE chat_messages ADD COLUMN project_id TEXT;")
	_, _ = db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_messages(conversation_id);")

	return nil
}
