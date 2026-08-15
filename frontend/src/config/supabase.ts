import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Retrieve Supabase URL and Publishable Key (sb_publishable_... or legacy anon) from environment variables or persistent localStorage
export const getSupabaseConfig = () => {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    localStorage.getItem("supabase_url") ||
    "https://your-project.supabase.co";

  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    localStorage.getItem("supabase_publishable_key") ||
    localStorage.getItem("supabase_anon_key") ||
    "sb_publishable_placeholder";

  const isConfigured =
    url !== "https://your-project.supabase.co" &&
    publishableKey !== "sb_publishable_placeholder" &&
    publishableKey !== "public-anon-key" &&
    Boolean(url && publishableKey);

  return {
    url,
    publishableKey,
    anonKey: publishableKey, // Backward-compatible alias
    isConfigured,
  };
};

const initialConfig = getSupabaseConfig();

if (!initialConfig.isConfigured) {
  console.warn("[DELTA] Supabase is not configured. Auth features will be unavailable. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
}

let activeClient: SupabaseClient = createClient(initialConfig.url, initialConfig.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const getSupabaseClient = (): SupabaseClient => activeClient;
export const supabase = activeClient;

export const updateSupabaseClient = (url: string, key: string) => {
  if (url) localStorage.setItem("supabase_url", url);
  if (key) {
    localStorage.setItem("supabase_publishable_key", key);
    localStorage.setItem("supabase_anon_key", key);
  }
  activeClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return activeClient;
};

