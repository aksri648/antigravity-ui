package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"backend/models"
)

type SupabaseService struct {
	client  *http.Client
	url     string
	apiKey  string
}

func NewSupabaseService() *SupabaseService {
	url := os.Getenv("SUPABASE_URL")
	if url == "" {
		url = os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	}

	// 1. Support new Supabase Key format (sb_secret_... and sb_publishable_...)
	key := os.Getenv("SUPABASE_SECRET_KEY")
	if key == "" {
		key = os.Getenv("SUPABASE_PUBLISHABLE_KEY")
	}
	// 2. Backward compatibility with legacy anon / service_role keys
	if key == "" {
		key = os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	}
	if key == "" {
		key = os.Getenv("SUPABASE_ANON_KEY")
	}
	if key == "" {
		key = os.Getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
	}
	if key == "" {
		key = os.Getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
	}

	return &SupabaseService{
		client: &http.Client{Timeout: 15 * time.Second},
		url:    strings.TrimRight(url, "/"),
		apiKey: key,
	}
}

func (s *SupabaseService) IsConfigured() bool {
	return s.url != "" && s.apiKey != ""
}

// SignUp creates a user via Supabase Auth REST API
func (s *SupabaseService) SignUp(email, password, name, daytonaApiKey, daytonaServerUrl string) (*models.AuthResponse, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("Supabase not configured")
	}

	url := fmt.Sprintf("%s/auth/v1/signup", s.url)
	payload := map[string]interface{}{
		"email":    email,
		"password": password,
		"data": map[string]interface{}{
			"name":              name,
			"daytona_api_key":   daytonaApiKey,
			"daytona_server_url": daytonaServerUrl,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		var errData map[string]interface{}
		_ = json.Unmarshal(respBytes, &errData)
		msg, _ := errData["msg"].(string)
		if msg == "" {
			msg, _ = errData["error_description"].(string)
		}
		if msg == "" {
			msg = string(respBytes)
		}
		return nil, fmt.Errorf("Supabase Auth error: %s", msg)
	}

	var data struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		User         struct {
			ID       string `json:"id"`
			Email    string `json:"email"`
			UserMeta struct {
				Name             string `json:"name"`
				DaytonaApiKey    string `json:"daytona_api_key"`
				DaytonaServerUrl string `json:"daytona_server_url"`
			} `json:"user_metadata"`
		} `json:"user"`
	}

	if err := json.Unmarshal(respBytes, &data); err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token: data.AccessToken,
		User: &models.User{
			ID:               data.User.ID,
			Email:            data.User.Email,
			Name:             data.User.UserMeta.Name,
			DaytonaApiKey:    data.User.UserMeta.DaytonaApiKey,
			DaytonaServerUrl: data.User.UserMeta.DaytonaServerUrl,
		},
	}, nil
}

// SignIn authenticates a user via Supabase Auth REST API
func (s *SupabaseService) SignIn(email, password string) (*models.AuthResponse, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("Supabase not configured")
	}

	url := fmt.Sprintf("%s/auth/v1/token?grant_type=password", s.url)
	payload := map[string]interface{}{
		"email":    email,
		"password": password,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		var errData map[string]interface{}
		_ = json.Unmarshal(respBytes, &errData)
		msg, _ := errData["error_description"].(string)
		if msg == "" {
			msg, _ = errData["msg"].(string)
		}
		if msg == "" {
			msg = string(respBytes)
		}
		return nil, fmt.Errorf("Invalid credentials: %s", msg)
	}

	var data struct {
		AccessToken string `json:"access_token"`
		User        struct {
			ID       string `json:"id"`
			Email    string `json:"email"`
			UserMeta struct {
				Name             string `json:"name"`
				DaytonaApiKey    string `json:"daytona_api_key"`
				DaytonaServerUrl string `json:"daytona_server_url"`
			} `json:"user_metadata"`
		} `json:"user"`
	}

	if err := json.Unmarshal(respBytes, &data); err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token: data.AccessToken,
		User: &models.User{
			ID:               data.User.ID,
			Email:            data.User.Email,
			Name:             data.User.UserMeta.Name,
			DaytonaApiKey:    data.User.UserMeta.DaytonaApiKey,
			DaytonaServerUrl: data.User.UserMeta.DaytonaServerUrl,
		},
	}, nil
}

// VerifyToken verifies a Supabase access token via Supabase Auth API
func (s *SupabaseService) VerifyToken(token string) (*models.User, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("Supabase not configured")
	}

	url := fmt.Sprintf("%s/auth/v1/user", s.url)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", s.apiKey)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Token verification failed with status: %d", resp.StatusCode)
	}

	var data struct {
		ID       string `json:"id"`
		Email    string `json:"email"`
		UserMeta struct {
			Name             string `json:"name"`
			DaytonaApiKey    string `json:"daytona_api_key"`
			DaytonaServerUrl string `json:"daytona_server_url"`
		} `json:"user_metadata"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	return &models.User{
		ID:               data.ID,
		Email:            data.Email,
		Name:             data.UserMeta.Name,
		DaytonaApiKey:    data.UserMeta.DaytonaApiKey,
		DaytonaServerUrl: data.UserMeta.DaytonaServerUrl,
	}, nil
}

// SaveChatMessage stores chat records in Supabase PostgREST table
func (s *SupabaseService) SaveChatMessage(userId, sandboxId, sender, text string, thoughts []string, tools []map[string]interface{}, isError bool) error {
	if !s.IsConfigured() {
		return nil
	}

	url := fmt.Sprintf("%s/rest/v1/chat_messages", s.url)
	payload := map[string]interface{}{
		"user_id":    userId,
		"sandbox_id": sandboxId,
		"sender":     sender,
		"text":       text,
		"thoughts":   thoughts,
		"tools":      tools,
		"is_error":   isError,
		"timestamp":  time.Now().UnixMilli(),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.apiKey)
	if strings.HasPrefix(s.apiKey, "ey") {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// SaveSecret stores cloud secrets in Supabase PostgREST table
func (s *SupabaseService) SaveSecret(userId, provider, keyName, encryptedValue string) error {
	if !s.IsConfigured() {
		return nil
	}

	url := fmt.Sprintf("%s/rest/v1/cloud_secrets", s.url)
	payload := map[string]interface{}{
		"user_id":         userId,
		"provider":        provider,
		"key_name":        keyName,
		"encrypted_value": encryptedValue,
		"updated_at":      time.Now().Unix(),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.apiKey)
	if strings.HasPrefix(s.apiKey, "ey") {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
