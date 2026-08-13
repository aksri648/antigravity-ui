// Centralized API Configuration & Dynamic URL Resolver
export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");

export const getWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  try {
    const url = new URL(API_BASE_URL);
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${url.host}/ws`;
  } catch {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${window.location.host}/ws`;
  }
};

export const getStoredServerUrl = (): string => {
  return localStorage.getItem("daytona_server_url") || "";
};

export const getStoredApiKey = (): string => {
  return localStorage.getItem("daytona_api_key") || "";
};

export const getStoredSandboxId = (): string => {
  return localStorage.getItem("daytona_sandbox_id") || "";
};

export const getStoredUserId = (): string => {
  return localStorage.getItem("daytona_user_id") || "default-user";
};

export const apiUrl = (
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE_URL.startsWith("http")
    ? `${API_BASE_URL}${cleanPath}`
    : `${window.location.origin}${API_BASE_URL}${cleanPath}`;
    
  const url = new URL(base);

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        url.searchParams.set(key, String(val));
      }
    });
  }
  return url.toString();
};
