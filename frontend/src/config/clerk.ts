// Clerk Configuration for DELTA React Client

export const getClerkPublishableKey = (): string => {
  const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (envKey && envKey.trim() !== "") {
    return envKey.trim();
  }

  const storedKey = localStorage.getItem("clerk_publishable_key");
  if (storedKey && storedKey.trim() !== "") {
    return storedKey.trim();
  }

  // Fallback demo/keyless key if not configured yet
  return "pk_test_Y2xlcmsuYWd5LmRlbHRhLmNsb3VkJAA";
};

export const setClerkPublishableKey = (key: string) => {
  if (key && key.trim() !== "") {
    localStorage.setItem("clerk_publishable_key", key.trim());
  } else {
    localStorage.removeItem("clerk_publishable_key");
  }
};

export const isClerkConfigured = (): boolean => {
  const key = getClerkPublishableKey();
  return Boolean(key && !key.includes("placeholder") && key.startsWith("pk_"));
};
