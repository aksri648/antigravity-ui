package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
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

// SaveChatMessage records message history in SQLite
func (s *UserService) SaveChatMessage(userId string, sandboxId string, sender string, text string, thoughts []string, tools []map[string]interface{}, isError bool) error {
	msgId := "msg_" + uuid.New().String()[:12]
	thoughtsJson, _ := json.Marshal(thoughts)
	toolsJson, _ := json.Marshal(tools)

	errVal := 0
	if isError {
		errVal = 1
	}

	query := `
		INSERT INTO chat_messages (id, user_id, sandbox_id, sender, text, thoughts_json, tools_json, is_error, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := db.DB.Exec(query, msgId, userId, sandboxId, sender, text, string(thoughtsJson), string(toolsJson), errVal, time.Now().UnixMilli())
	return err
}

// GetChatHistory fetches chat messages from SQLite
func (s *UserService) GetChatHistory(userId string, sandboxId string) ([]models.ChatMessageDTO, error) {
	query := `
		SELECT id, sender, text, thoughts_json, tools_json, is_error, created_at
		FROM chat_messages
		WHERE user_id = ?
		ORDER BY created_at ASC
		LIMIT 200
	`
	rows, err := db.DB.Query(query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.ChatMessageDTO
	for rows.Next() {
		var m models.ChatMessageDTO
		var thoughtsRaw, toolsRaw sql.NullString
		var isErr int

		if err := rows.Scan(&m.ID, &m.Sender, &m.Text, &thoughtsRaw, &toolsRaw, &isErr, &m.Timestamp); err == nil {
			m.IsError = isErr == 1
			if thoughtsRaw.Valid && thoughtsRaw.String != "" {
				json.Unmarshal([]byte(thoughtsRaw.String), &m.Thoughts)
			}
			if toolsRaw.Valid && toolsRaw.String != "" {
				json.Unmarshal([]byte(toolsRaw.String), &m.Tools)
			}
			messages = append(messages, m)
		}
	}

	return messages, nil
}

// ClearChatHistory deletes chat messages for user
func (s *UserService) ClearChatHistory(userId string, sandboxId string) error {
	_, err := db.DB.Exec("DELETE FROM chat_messages WHERE user_id = ?", userId)
	return err
}
