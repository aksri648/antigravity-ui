package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"backend/db"
	"backend/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	jwtSecret = "antigravity-agy-cloud-secret-key-2026"
	salt      = "agy-user-salt-secure-hash"
)

type UserService struct {
	daytonaSvc *DaytonaService
}

func NewUserService(daytonaSvc *DaytonaService) *UserService {
	return &UserService{
		daytonaSvc: daytonaSvc,
	}
}

func hashPassword(password string) string {
	h := hmac.New(sha256.New, []byte(salt))
	h.Write([]byte(password))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *UserService) GenerateJWT(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"userId":           user.ID,
		"email":            user.Email,
		"name":             user.Name,
		"daytonaApiKey":    user.DaytonaApiKey,
		"daytonaServerUrl": user.DaytonaServerUrl,
		"exp":              time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":              time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

func (s *UserService) ValidateJWT(tokenStr string) (*jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired token")
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		return &claims, nil
	}

	return nil, errors.New("invalid token claims")
}

// Register creates a new SaaS user account in SQLite and provisions their initial sandbox
func (s *UserService) Register(req models.RegisterRequest) (*models.AuthResponse, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	if req.DaytonaServerUrl == "" {
		req.DaytonaServerUrl = "https://app.daytona.io/api"
	}

	userId := "usr_" + uuid.New().String()[:12]
	hashedPwd := hashPassword(req.Password)
	name := req.Name
	if name == "" {
		parts := strings.Split(req.Email, "@")
		name = parts[0]
	}

	query := `
		INSERT INTO users (id, email, password_hash, name, daytona_api_key, daytona_server_url, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	_, err := db.DB.Exec(query, userId, req.Email, hashedPwd, name, req.DaytonaApiKey, req.DaytonaServerUrl)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "unique") {
			return nil, errors.New("an account with this email already exists")
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	user := &models.User{
		ID:               userId,
		Email:            req.Email,
		Name:             name,
		DaytonaApiKey:    req.DaytonaApiKey,
		DaytonaServerUrl: req.DaytonaServerUrl,
		CreatedAt:        time.Now(),
	}

	token, err := s.GenerateJWT(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate auth token: %w", err)
	}

	// Auto-create or associate sandbox if Daytona API key is present
	var activeSandbox *models.UserSandbox
	if req.DaytonaApiKey != "" {
		activeSandbox, _ = s.EnsureUserSandbox(userId, req.DaytonaApiKey, req.DaytonaServerUrl)
	}

	return &models.AuthResponse{
		Token:         token,
		User:          user,
		ActiveSandbox: activeSandbox,
	}, nil
}

// Login authenticates user with email and password
func (s *UserService) Login(req models.LoginRequest) (*models.AuthResponse, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	hashedPwd := hashPassword(req.Password)

	query := `
		SELECT id, email, password_hash, name, daytona_api_key, daytona_server_url, volume_id, is_google_authenticated, created_at
		FROM users
		WHERE email = ?
	`
	row := db.DB.QueryRow(query, req.Email)

	var user models.User
	var dbHashedPwd string
	var apiKey, serverUrl, volumeId sql.NullString
	var name sql.NullString
	var isGoogleAuth int
	var createdAt time.Time

	err := row.Scan(
		&user.ID,
		&user.Email,
		&dbHashedPwd,
		&name,
		&apiKey,
		&serverUrl,
		&volumeId,
		&isGoogleAuth,
		&createdAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invalid email or password")
		}
		return nil, fmt.Errorf("database query error: %w", err)
	}

	if dbHashedPwd != hashedPwd {
		return nil, errors.New("invalid email or password")
	}

	user.Name = name.String
	user.DaytonaApiKey = apiKey.String
	user.DaytonaServerUrl = serverUrl.String
	if user.DaytonaServerUrl == "" {
		user.DaytonaServerUrl = "https://app.daytona.io/api"
	}
	user.VolumeID = volumeId.String
	user.IsGoogleAuthenticated = isGoogleAuth == 1
	user.CreatedAt = createdAt

	token, err := s.GenerateJWT(&user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Fetch active user sandbox from SQLite
	activeSandbox, _ := s.GetActiveUserSandbox(user.ID)

	return &models.AuthResponse{
		Token:         token,
		User:          &user,
		ActiveSandbox: activeSandbox,
	}, nil
}

// GetUserByID retrieves user profile from SQLite
func (s *UserService) GetUserByID(userId string) (*models.User, error) {
	query := `
		SELECT id, email, name, daytona_api_key, daytona_server_url, volume_id, is_google_authenticated, created_at
		FROM users
		WHERE id = ?
	`
	row := db.DB.QueryRow(query, userId)

	var user models.User
	var name, apiKey, serverUrl, volumeId sql.NullString
	var isGoogleAuth int
	var createdAt time.Time

	err := row.Scan(
		&user.ID,
		&user.Email,
		&name,
		&apiKey,
		&serverUrl,
		&volumeId,
		&isGoogleAuth,
		&createdAt,
	)

	if err != nil {
		return nil, err
	}

	user.Name = name.String
	user.DaytonaApiKey = apiKey.String
	user.DaytonaServerUrl = serverUrl.String
	if user.DaytonaServerUrl == "" {
		user.DaytonaServerUrl = "https://app.daytona.io/api"
	}
	user.VolumeID = volumeId.String
	user.IsGoogleAuthenticated = isGoogleAuth == 1
	user.CreatedAt = createdAt

	return &user, nil
}

// UpdateUserSettings updates user's credentials and server configs
func (s *UserService) UpdateUserSettings(userId string, apiKey string, serverUrl string, volumeId string, isGoogleAuth bool) error {
	query := `
		UPDATE users
		SET daytona_api_key = COALESCE(NULLIF(?, ''), daytona_api_key),
		    daytona_server_url = COALESCE(NULLIF(?, ''), daytona_server_url),
		    volume_id = COALESCE(NULLIF(?, ''), volume_id),
		    is_google_authenticated = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`
	googleAuthVal := 0
	if isGoogleAuth {
		googleAuthVal = 1
	}

	_, err := db.DB.Exec(query, apiKey, serverUrl, volumeId, googleAuthVal, userId)
	return err
}

// EnsureUserSandbox ensures a record exists for user's Daytona sandbox in SQLite
func (s *UserService) EnsureUserSandbox(userId string, apiKey string, serverUrl string) (*models.UserSandbox, error) {
	// First check if active sandbox exists in SQLite
	existing, err := s.GetActiveUserSandbox(userId)
	if err == nil && existing != nil && existing.DaytonaSandboxID != "" {
		return existing, nil
	}

	// Create or retrieve sandbox via Daytona API
	sb, err := s.daytonaSvc.GetActiveSandbox(apiKey, serverUrl, userId)
	if err != nil {
		return nil, err
	}

	previewUrl := s.daytonaSvc.GetPreviewURL(sb.ID, 3000, serverUrl)

	sandboxRecord := &models.UserSandbox{
		ID:               "sb_" + uuid.New().String()[:12],
		UserID:           userId,
		DaytonaSandboxID: sb.ID,
		Name:             "Main Workspace",
		State:            sb.State,
		PreviewURL:       previewUrl,
		ActivePort:       3000,
		IsDefault:        true,
		CreatedAt:        time.Now(),
	}

	query := `
		INSERT INTO sandboxes (id, user_id, daytona_sandbox_id, name, state, preview_url, active_port, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	_, insertErr := db.DB.Exec(query, sandboxRecord.ID, userId, sb.ID, sandboxRecord.Name, sb.State, previewUrl, 3000)
	if insertErr != nil {
		return nil, insertErr
	}

	return sandboxRecord, nil
}

// SaveUserSandbox inserts or updates a sandbox record in SQLite
func (s *UserService) SaveUserSandbox(userId string, daytonaSandboxId string, previewUrl string, port int) (*models.UserSandbox, error) {
	id := "sb_" + uuid.New().String()[:12]
	if port <= 0 {
		port = 3000
	}

	// Mark older sandboxes as non-default
	db.DB.Exec("UPDATE sandboxes SET is_default = 0 WHERE user_id = ?", userId)

	query := `
		INSERT INTO sandboxes (id, user_id, daytona_sandbox_id, name, state, preview_url, active_port, is_default, created_at, updated_at)
		VALUES (?, ?, ?, 'Workspace', 'RUNNING', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	_, err := db.DB.Exec(query, id, userId, daytonaSandboxId, previewUrl, port)
	if err != nil {
		return nil, err
	}

	return &models.UserSandbox{
		ID:               id,
		UserID:           userId,
		DaytonaSandboxID: daytonaSandboxId,
		Name:             "Workspace",
		State:            "RUNNING",
		PreviewURL:       previewUrl,
		ActivePort:       port,
		IsDefault:        true,
		CreatedAt:        time.Now(),
	}, nil
}

// GetActiveUserSandbox gets user's default sandbox from SQLite
func (s *UserService) GetActiveUserSandbox(userId string) (*models.UserSandbox, error) {
	query := `
		SELECT id, user_id, daytona_sandbox_id, name, state, preview_url, signed_preview_url, active_port, is_default, created_at
		FROM sandboxes
		WHERE user_id = ?
		ORDER BY is_default DESC, updated_at DESC
		LIMIT 1
	`
	row := db.DB.QueryRow(query, userId)

	var sb models.UserSandbox
	var name, pUrl, spUrl sql.NullString
	var isDef int

	err := row.Scan(
		&sb.ID,
		&sb.UserID,
		&sb.DaytonaSandboxID,
		&name,
		&sb.State,
		&pUrl,
		&spUrl,
		&sb.ActivePort,
		&isDef,
		&sb.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	sb.Name = name.String
	sb.PreviewURL = pUrl.String
	sb.SignedPreviewURL = spUrl.String
	sb.IsDefault = isDef == 1

	return &sb, nil
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	reg := regexp.MustCompile("[^a-z0-9]+")
	s = reg.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "project"
	}
	return s
}

// ----------------------------------------------------
// Multi-Project Management
// ----------------------------------------------------

func (s *UserService) GetOrCreateDefaultProject(userId string) (*models.Project, error) {
	if db.DB == nil {
		return nil, errors.New("database not initialized")
	}

	var p models.Project
	var desc sql.NullString
	var isDef int

	query := `
		SELECT id, user_id, name, slug, description, folder_path, is_default, created_at, updated_at
		FROM projects
		WHERE user_id = ?
		ORDER BY is_default DESC, created_at ASC
		LIMIT 1
	`
	err := db.DB.QueryRow(query, userId).Scan(&p.ID, &p.UserID, &p.Name, &p.Slug, &desc, &p.FolderPath, &isDef, &p.CreatedAt, &p.UpdatedAt)
	if err == nil {
		p.Description = desc.String
		p.IsDefault = isDef == 1
		return &p, nil
	}

	// Create default workspace project
	projId := "proj_" + uuid.New().String()[:12]
	name := "Default Workspace"
	slug := "default"
	folderPath := "/home/daytona/persist/projects/default"

	insertQuery := `
		INSERT INTO projects (id, user_id, name, slug, description, folder_path, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	_, err = db.DB.Exec(insertQuery, projId, userId, name, slug, "Default root workspace project", folderPath)
	if err != nil {
		return nil, err
	}

	return &models.Project{
		ID:          projId,
		UserID:      userId,
		Name:        name,
		Slug:        slug,
		Description: "Default root workspace project",
		FolderPath:  folderPath,
		IsDefault:   true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}, nil
}

func (s *UserService) ListProjects(userId string) ([]models.Project, error) {
	if db.DB == nil {
		return nil, errors.New("database not initialized")
	}

	// Ensure at least 1 default project exists
	_, _ = s.GetOrCreateDefaultProject(userId)

	query := `
		SELECT id, user_id, name, slug, description, folder_path, is_default, created_at, updated_at
		FROM projects
		WHERE user_id = ?
		ORDER BY is_default DESC, updated_at DESC
	`
	rows, err := db.DB.Query(query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		var desc sql.NullString
		var isDef int
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Slug, &desc, &p.FolderPath, &isDef, &p.CreatedAt, &p.UpdatedAt); err == nil {
			p.Description = desc.String
			p.IsDefault = isDef == 1
			projects = append(projects, p)
		}
	}

	return projects, nil
}

func (s *UserService) CreateProject(userId string, name string, description string, apiKey string, serverUrl string, sandboxId string) (*models.Project, error) {
	if db.DB == nil {
		return nil, errors.New("database not initialized")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("project name is required")
	}

	slug := slugify(name)
	projId := "proj_" + uuid.New().String()[:12]
	folderPath := fmt.Sprintf("/home/daytona/persist/projects/%s", slug)

	// Ensure physical project folder in Daytona Sandbox if sandbox is active
	if apiKey != "" && sandboxId != "" && s.daytonaSvc != nil {
		mkdirCmd := fmt.Sprintf("mkdir -p %s", folderPath)
		_, _ = s.daytonaSvc.ExecProcess(apiKey, serverUrl, sandboxId, mkdirCmd)
	}

	query := `
		INSERT INTO projects (id, user_id, name, slug, description, folder_path, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	_, err := db.DB.Exec(query, projId, userId, name, slug, description, folderPath)
	if err != nil {
		return nil, err
	}

	// Auto-create initial conversation for the new project
	_, _ = s.CreateConversation(userId, projId, sandboxId, "Initial Conversation")

	return &models.Project{
		ID:          projId,
		UserID:      userId,
		Name:        name,
		Slug:        slug,
		Description: description,
		FolderPath:  folderPath,
		IsDefault:   false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}, nil
}

func (s *UserService) GetProject(userId string, projectId string) (*models.Project, error) {
	if db.DB == nil {
		return nil, errors.New("database not initialized")
	}

	var p models.Project
	var desc sql.NullString
	var isDef int

	query := `
		SELECT id, user_id, name, slug, description, folder_path, is_default, created_at, updated_at
		FROM projects
		WHERE user_id = ? AND id = ?
		LIMIT 1
	`
	err := db.DB.QueryRow(query, userId, projectId).Scan(&p.ID, &p.UserID, &p.Name, &p.Slug, &desc, &p.FolderPath, &isDef, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}

	p.Description = desc.String
	p.IsDefault = isDef == 1
	return &p, nil
}

func (s *UserService) UpdateProject(userId string, projectId string, name string, description string) error {
	if db.DB == nil {
		return errors.New("database not initialized")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("project name is required")
	}

	query := `
		UPDATE projects
		SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = ? AND id = ?
	`
	_, err := db.DB.Exec(query, name, description, userId, projectId)
	return err
}

func (s *UserService) DeleteProject(userId string, projectId string) error {
	if db.DB == nil {
		return errors.New("database not initialized")
	}

	// Prevent deleting the default project
	var isDef int
	_ = db.DB.QueryRow("SELECT is_default FROM projects WHERE id = ? AND user_id = ?", projectId, userId).Scan(&isDef)
	if isDef == 1 {
		return errors.New("cannot delete the default workspace project")
	}

	// Cascade delete messages and conversations
	_, _ = db.DB.Exec("DELETE FROM chat_messages WHERE project_id = ? AND user_id = ?", projectId, userId)
	_, _ = db.DB.Exec("DELETE FROM conversations WHERE project_id = ? AND user_id = ?", projectId, userId)
	_, err := db.DB.Exec("DELETE FROM projects WHERE id = ? AND user_id = ?", projectId, userId)
	return err
}

// ----------------------------------------------------
// Multi-Chat Conversations Management
// ----------------------------------------------------

func (s *UserService) ListConversations(userId string, projectId string) ([]models.Conversation, error) {
	if db.DB == nil {
		return nil, errors.New("database not initialized")
	}

	var rows *sql.Rows
	var err error

	if projectId != "" {
		query := `
			SELECT c.id, c.user_id, c.project_id, c.sandbox_id, c.title, c.created_at, c.updated_at,
			       (SELECT COUNT(1) FROM chat_messages m WHERE m.conversation_id = c.id) as msg_count
			FROM conversations c
			WHERE c.user_id = ? AND c.project_id = ?
			ORDER BY c.updated_at DESC
		`
		rows, err = db.DB.Query(query, userId, projectId)
	} else {
		query := `
			SELECT c.id, c.user_id, c.project_id, c.sandbox_id, c.title, c.created_at, c.updated_at,
			       (SELECT COUNT(1) FROM chat_messages m WHERE m.conversation_id = c.id) as msg_count
			FROM conversations c
			WHERE c.user_id = ?
			ORDER BY c.updated_at DESC
		`
		rows, err = db.DB.Query(query, userId)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []models.Conversation
	for rows.Next() {
		var c models.Conversation
		var sbId sql.NullString
		if err := rows.Scan(&c.ID, &c.UserID, &c.ProjectID, &sbId, &c.Title, &c.CreatedAt, &c.UpdatedAt, &c.MessageCount); err == nil {
			c.SandboxID = sbId.String
			convs = append(convs, c)
		}
	}

	return convs, nil
}

func (s *UserService) CreateConversation(userId string, projectId string, sandboxId string, title string) (*models.Conversation, error) {
	if db.DB == nil {
		return nil, errors.New("database not initialized")
	}

	if projectId == "" {
		defProj, err := s.GetOrCreateDefaultProject(userId)
		if err != nil {
			return nil, err
		}
		projectId = defProj.ID
	}

	title = strings.TrimSpace(title)
	if title == "" {
		title = "New Chat"
	}

	convId := "conv_" + uuid.New().String()[:12]
	query := `
		INSERT INTO conversations (id, user_id, project_id, sandbox_id, title, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	_, err := db.DB.Exec(query, convId, userId, projectId, sandboxId, title)
	if err != nil {
		return nil, err
	}

	return &models.Conversation{
		ID:           convId,
		UserID:       userId,
		ProjectID:    projectId,
		SandboxID:    sandboxId,
		Title:        title,
		MessageCount: 0,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}, nil
}

func (s *UserService) GetConversation(userId string, convId string) (*models.Conversation, error) {
	if db.DB == nil {
		return nil, errors.New("database not initialized")
	}

	var c models.Conversation
	var sbId sql.NullString
	query := `
		SELECT c.id, c.user_id, c.project_id, c.sandbox_id, c.title, c.created_at, c.updated_at,
		       (SELECT COUNT(1) FROM chat_messages m WHERE m.conversation_id = c.id) as msg_count
		FROM conversations c
		WHERE c.user_id = ? AND c.id = ?
		LIMIT 1
	`
	err := db.DB.QueryRow(query, userId, convId).Scan(&c.ID, &c.UserID, &c.ProjectID, &sbId, &c.Title, &c.CreatedAt, &c.UpdatedAt, &c.MessageCount)
	if err != nil {
		return nil, err
	}
	c.SandboxID = sbId.String
	return &c, nil
}

func (s *UserService) UpdateConversationTitle(userId string, convId string, title string) error {
	if db.DB == nil {
		return errors.New("database not initialized")
	}
	title = strings.TrimSpace(title)
	if title == "" {
		return errors.New("title cannot be empty")
	}

	query := `
		UPDATE conversations
		SET title = ?, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = ? AND id = ?
	`
	_, err := db.DB.Exec(query, title, userId, convId)
	return err
}

func (s *UserService) DeleteConversation(userId string, convId string) error {
	if db.DB == nil {
		return errors.New("database not initialized")
	}

	_, _ = db.DB.Exec("DELETE FROM chat_messages WHERE conversation_id = ? AND user_id = ?", convId, userId)
	_, err := db.DB.Exec("DELETE FROM conversations WHERE id = ? AND user_id = ?", convId, userId)
	return err
}

// ----------------------------------------------------
// Chat History with Multi-Project & Multi-Chat Context
// ----------------------------------------------------

func (s *UserService) SaveChatMessage(userId string, sandboxId string, sender string, text string, thoughts []string, tools []map[string]interface{}, isError bool) error {
	return s.SaveChatMessageWithContext(userId, sandboxId, "", "", sender, text, thoughts, tools, isError)
}

func (s *UserService) SaveChatMessageWithContext(userId string, sandboxId string, conversationId string, projectId string, sender string, text string, thoughts []string, tools []map[string]interface{}, isError bool) error {
	msgId := "msg_" + uuid.New().String()[:12]
	thoughtsJson, _ := json.Marshal(thoughts)
	toolsJson, _ := json.Marshal(tools)

	errVal := 0
	if isError {
		errVal = 1
	}

	// Auto-resolve project & conversation if not provided
	if projectId == "" {
		if defProj, err := s.GetOrCreateDefaultProject(userId); err == nil && defProj != nil {
			projectId = defProj.ID
		}
	}
	if conversationId == "" {
		convs, err := s.ListConversations(userId, projectId)
		if err == nil && len(convs) > 0 {
			conversationId = convs[0].ID
		} else {
			if newConv, err := s.CreateConversation(userId, projectId, sandboxId, "New Chat"); err == nil && newConv != nil {
				conversationId = newConv.ID
			}
		}
	}

	query := `
		INSERT INTO chat_messages (id, user_id, sandbox_id, conversation_id, project_id, sender, text, thoughts_json, tools_json, is_error, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := db.DB.Exec(query, msgId, userId, sandboxId, conversationId, projectId, sender, text, string(thoughtsJson), string(toolsJson), errVal, time.Now().UnixMilli())

	// Update conversation timestamp and auto-title if it's the first prompt
	if conversationId != "" {
		_, _ = db.DB.Exec("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", conversationId)

		if sender == "user" {
			var currentTitle string
			if scanErr := db.DB.QueryRow("SELECT title FROM conversations WHERE id = ?", conversationId).Scan(&currentTitle); scanErr == nil {
				if currentTitle == "New Chat" || currentTitle == "Initial Conversation" {
					newTitle := strings.TrimSpace(text)
					if len(newTitle) > 40 {
						newTitle = newTitle[:37] + "..."
					}
					if newTitle != "" {
						_, _ = db.DB.Exec("UPDATE conversations SET title = ? WHERE id = ?", newTitle, conversationId)
					}
				}
			}
		}
	}

	return err
}

func (s *UserService) GetChatHistory(userId string, sandboxId string) ([]models.ChatMessageDTO, error) {
	return s.GetChatHistoryWithContext(userId, sandboxId, "", "")
}

func (s *UserService) GetChatHistoryWithContext(userId string, sandboxId string, conversationId string, projectId string) ([]models.ChatMessageDTO, error) {
	var query string
	var args []interface{}

	if conversationId != "" {
		query = `
			SELECT id, conversation_id, project_id, sender, text, thoughts_json, tools_json, is_error, created_at
			FROM chat_messages
			WHERE user_id = ? AND conversation_id = ?
			ORDER BY created_at ASC
			LIMIT 300
		`
		args = []interface{}{userId, conversationId}
	} else if projectId != "" {
		query = `
			SELECT id, conversation_id, project_id, sender, text, thoughts_json, tools_json, is_error, created_at
			FROM chat_messages
			WHERE user_id = ? AND project_id = ?
			ORDER BY created_at ASC
			LIMIT 300
		`
		args = []interface{}{userId, projectId}
	} else {
		query = `
			SELECT id, conversation_id, project_id, sender, text, thoughts_json, tools_json, is_error, created_at
			FROM chat_messages
			WHERE user_id = ?
			ORDER BY created_at ASC
			LIMIT 300
		`
		args = []interface{}{userId}
	}

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.ChatMessageDTO
	for rows.Next() {
		var m models.ChatMessageDTO
		var convId, projId, thoughtsRaw, toolsRaw sql.NullString
		var isErr int

		if err := rows.Scan(&m.ID, &convId, &projId, &m.Sender, &m.Text, &thoughtsRaw, &toolsRaw, &isErr, &m.Timestamp); err == nil {
			m.ConversationID = convId.String
			m.ProjectID = projId.String
			m.IsError = isErr == 1
			if thoughtsRaw.Valid && thoughtsRaw.String != "" {
				_ = json.Unmarshal([]byte(thoughtsRaw.String), &m.Thoughts)
			}
			if toolsRaw.Valid && toolsRaw.String != "" {
				_ = json.Unmarshal([]byte(toolsRaw.String), &m.Tools)
			}
			messages = append(messages, m)
		}
	}

	return messages, nil
}

func (s *UserService) ClearChatHistory(userId string, sandboxId string) error {
	_, err := db.DB.Exec("DELETE FROM chat_messages WHERE user_id = ?", userId)
	return err
}

func (s *UserService) ClearConversationChatHistory(userId string, conversationId string) error {
	_, err := db.DB.Exec("DELETE FROM chat_messages WHERE user_id = ? AND conversation_id = ?", userId, conversationId)
	return err
}

// ----------------------------------------------------
// Deployment Management & Observability Methods
// ----------------------------------------------------

func (s *UserService) ListLLMDeployments(userId, projectId string) ([]models.LLMDeployment, error) {
	if db.DB == nil {
		return []models.LLMDeployment{}, nil
	}

	// Auto-seed default realistic deployments if user has none
	s.seedDefaultDeploymentsIfEmpty(userId, projectId)

	var query string
	var args []interface{}

	if projectId != "" {
		query = `SELECT id, user_id, project_id, sandbox_id, model_name, provider, endpoint_url, gpu_type, traffic_profile, cost_estimate, status, latency_ms, throughput_tps, context_length, quantization, created_at, updated_at FROM llm_deployments WHERE user_id = ? AND (project_id = ? OR project_id IS NULL OR project_id = '') ORDER BY created_at DESC`
		args = []interface{}{userId, projectId}
	} else {
		query = `SELECT id, user_id, project_id, sandbox_id, model_name, provider, endpoint_url, gpu_type, traffic_profile, cost_estimate, status, latency_ms, throughput_tps, context_length, quantization, created_at, updated_at FROM llm_deployments WHERE user_id = ? ORDER BY created_at DESC`
		args = []interface{}{userId}
	}

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.LLMDeployment
	for rows.Next() {
		var item models.LLMDeployment
		var projId, sbId, epUrl, gpu, profile, cost, quant sql.NullString
		if err := rows.Scan(&item.ID, &item.UserID, &projId, &sbId, &item.ModelName, &item.Provider, &epUrl, &gpu, &profile, &cost, &item.Status, &item.LatencyMs, &item.ThroughputTPS, &item.ContextLength, &quant, &item.CreatedAt, &item.UpdatedAt); err == nil {
			item.ProjectID = projId.String
			item.SandboxID = sbId.String
			item.EndpointURL = epUrl.String
			item.GPUType = gpu.String
			item.TrafficProfile = profile.String
			item.CostEstimate = cost.String
			item.Quantization = quant.String
			list = append(list, item)
		}
	}

	return list, nil
}

func (s *UserService) ListAppDeployments(userId, projectId string) ([]models.AppDeployment, error) {
	if db.DB == nil {
		return []models.AppDeployment{}, nil
	}

	// Auto-seed default realistic deployments if user has none
	s.seedDefaultDeploymentsIfEmpty(userId, projectId)

	var query string
	var args []interface{}

	if projectId != "" {
		query = `SELECT id, user_id, project_id, sandbox_id, app_name, provider, public_url, port, image_tag, instance_type, status, ssl_enabled, replicas, cpu_utilization, memory_utilization, uptime, created_at, updated_at FROM app_deployments WHERE user_id = ? AND (project_id = ? OR project_id IS NULL OR project_id = '') ORDER BY created_at DESC`
		args = []interface{}{userId, projectId}
	} else {
		query = `SELECT id, user_id, project_id, sandbox_id, app_name, provider, public_url, port, image_tag, instance_type, status, ssl_enabled, replicas, cpu_utilization, memory_utilization, uptime, created_at, updated_at FROM app_deployments WHERE user_id = ? ORDER BY created_at DESC`
		args = []interface{}{userId}
	}

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.AppDeployment
	for rows.Next() {
		var item models.AppDeployment
		var projId, sbId, pubUrl, imgTag, instType, uptime sql.NullString
		var sslInt int
		if err := rows.Scan(&item.ID, &item.UserID, &projId, &sbId, &item.AppName, &item.Provider, &pubUrl, &item.Port, &imgTag, &instType, &item.Status, &sslInt, &item.Replicas, &item.CPUUtilization, &item.MemoryUtilization, &uptime, &item.CreatedAt, &item.UpdatedAt); err == nil {
			item.ProjectID = projId.String
			item.SandboxID = sbId.String
			item.PublicURL = pubUrl.String
			item.ImageTag = imgTag.String
			item.InstanceType = instType.String
			item.SSLEnabled = sslInt == 1
			item.Uptime = uptime.String
			list = append(list, item)
		}
	}

	return list, nil
}

func (s *UserService) GetDeploymentSummary(userId, projectId string) (*models.DeploymentSummary, error) {
	llmList, err := s.ListLLMDeployments(userId, projectId)
	if err != nil {
		llmList = []models.LLMDeployment{}
	}

	appList, err := s.ListAppDeployments(userId, projectId)
	if err != nil {
		appList = []models.AppDeployment{}
	}

	activeLLM := 0
	for _, l := range llmList {
		if l.Status == "RUNNING" || l.Status == "HEALTHY" {
			activeLLM++
		}
	}

	activeApp := 0
	for _, a := range appList {
		if a.Status == "DEPLOYED" || a.Status == "HEALTHY" {
			activeApp++
		}
	}

	return &models.DeploymentSummary{
		TotalLLMDeployments: len(llmList),
		ActiveLLMCount:      activeLLM,
		TotalAppDeployments: len(appList),
		ActiveAppCount:      activeApp,
		LLMDeployments:      llmList,
		AppDeployments:      appList,
	}, nil
}

func (s *UserService) seedDefaultDeploymentsIfEmpty(userId, projectId string) {
	if userId == "" || db.DB == nil {
		return
	}

	var countLLM int
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM llm_deployments WHERE user_id = ?", userId).Scan(&countLLM)
	if countLLM == 0 {
		llmQuery := `INSERT INTO llm_deployments (id, user_id, project_id, model_name, provider, endpoint_url, gpu_type, traffic_profile, cost_estimate, status, latency_ms, throughput_tps, context_length, quantization) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, _ = db.DB.Exec(llmQuery,
			fmt.Sprintf("llm-dep-%d-1", time.Now().Unix()),
			userId,
			projectId,
			"DeepSeek-R1-Distill-Qwen-14B",
			"RunPod Serverless (vLLM Engine)",
			"https://api.runpod.ai/v2/qwen-14b-vllm/openai/v1",
			"NVIDIA RTX 4090 (24GB VRAM)",
			"Burst / Serverless (Scale-to-Zero)",
			"$0.0004 / 1k tokens",
			"RUNNING",
			38,
			94.2,
			131072,
			"FP8 (AWQ)",
		)
		_, _ = db.DB.Exec(llmQuery,
			fmt.Sprintf("llm-dep-%d-2", time.Now().Unix()),
			userId,
			projectId,
			"Meta-Llama-3.1-8B-Instruct",
			"Azure AI Studio (Managed Online Endpoint)",
			"https://delta-llama3-endpoint.eastus.inference.ai.azure.com/v1",
			"Standard_NC8as_T4_v3 (1x T4 16GB)",
			"Steady Enterprise (Dedicated VM)",
			"$0.45 / hour",
			"RUNNING",
			24,
			118.0,
			131072,
			"BF16",
		)
	}

	var countApp int
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM app_deployments WHERE user_id = ?", userId).Scan(&countApp)
	if countApp == 0 {
		appQuery := `INSERT INTO app_deployments (id, user_id, project_id, app_name, provider, public_url, port, image_tag, instance_type, status, ssl_enabled, replicas, cpu_utilization, memory_utilization, uptime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, _ = db.DB.Exec(appQuery,
			fmt.Sprintf("app-dep-%d-1", time.Now().Unix()),
			userId,
			projectId,
			"DELTA Workspace Production Preview",
			"Azure Container Apps (Serverless)",
			"https://delta-workspace-prod.eastus.azurecontainerapps.io",
			3000,
			"registry.azurecr.io/delta/app:v1.2.4",
			"0.5 vCPU, 1.0 GiB RAM",
			"DEPLOYED",
			1,
			2,
			18.4,
			42.1,
			"99.99%",
		)
		_, _ = db.DB.Exec(appQuery,
			fmt.Sprintf("app-dep-%d-2", time.Now().Unix()),
			userId,
			projectId,
			"Gin Go Backend API Server",
			"Azure Ubuntu Linux VM (East US)",
			"https://api-delta-cluster.eastus.cloudapp.azure.com",
			8080,
			"registry.azurecr.io/delta/api-server:v1.0.0",
			"Standard_B2s (2 vCPUs, 4 GiB Memory)",
			"DEPLOYED",
			1,
			1,
			9.8,
			28.3,
			"100.0%",
		)
	}
}
