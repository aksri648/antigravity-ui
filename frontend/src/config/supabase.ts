import { createClient } from "@supabase/supabase-js";

// Retrieve Supabase URL and Anon Key from environment variables or persistent localStorage
export const getSupabaseConfig = () => {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    localStorage.getItem("supabase_url") ||
    "https://your-project.supabase.co";

  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    localStorage.getItem("supabase_anon_key") ||
    "public-anon-key";

  const isConfigured =
    url !== "https://your-project.supabase.co" &&
    anonKey !== "public-anon-key" &&
    Boolean(url && anonKey);

  return { url, anonKey, isConfigured };
};

const config = getSupabaseConfig();

if (!config.isConfigured) {
  console.warn("[DELTA] Supabase is not configured. Auth features will be unavailable. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const updateSupabaseClient = (url: string, anonKey: string) => {
  if (url) localStorage.setItem("supabase_url", url);
  if (anonKey) localStorage.setItem("supabase_anon_key", anonKey);
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};
