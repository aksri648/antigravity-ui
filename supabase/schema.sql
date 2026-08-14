-- Supabase Database Schema for AGY Cloud SaaS

-- 1. Users / Profiles Table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    daytona_api_key TEXT,
    daytona_server_url TEXT DEFAULT 'https://app.daytona.io/api',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    folder_path TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Conversations Table (Multi-Chats)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    sandbox_id TEXT,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    sandbox_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'agy', 'opencode', 'system')),
    text TEXT NOT NULL,
    thoughts JSONB DEFAULT '[]'::JSONB,
    tools JSONB DEFAULT '[]'::JSONB,
    is_error BOOLEAN DEFAULT FALSE,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Sandboxes Table
CREATE TABLE IF NOT EXISTS public.user_sandboxes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    daytona_sandbox_id TEXT NOT NULL,
    preview_url TEXT,
    active_port INT DEFAULT 3000,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, daytona_sandbox_id)
);

-- 6. Cloud Secrets Table (Encrypted API keys & credentials)
CREATE TABLE IF NOT EXISTS public.cloud_secrets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    key_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider, key_name)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sandboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_secrets ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users
CREATE POLICY "Users can view and update own profile" 
    ON public.profiles FOR ALL 
    USING (auth.uid() = id);

CREATE POLICY "Users can manage own projects" 
    ON public.projects FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own conversations" 
    ON public.conversations FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat messages" 
    ON public.chat_messages FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own sandboxes" 
    ON public.user_sandboxes FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own secrets" 
    ON public.cloud_secrets FOR ALL 
    USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_proj ON public.conversations(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_sandbox ON public.chat_messages(user_id, sandbox_id);
CREATE INDEX IF NOT EXISTS idx_user_sandboxes_user ON public.user_sandboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_secrets_user ON public.cloud_secrets(user_id);
