function requiredEnv(name: string) {
  const value = import.meta.env[name];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const SUPABASE_URL = requiredEnv("VITE_SUPABASE_URL");
export const SUPABASE_ANON_KEY = requiredEnv("VITE_SUPABASE_ANON_KEY");

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.1.0";
export const RELEASE_CHANNEL =
  import.meta.env.VITE_RELEASE_CHANNEL || import.meta.env.MODE || "development";
export const MONITORING_ENDPOINT =
  import.meta.env.VITE_MONITORING_ENDPOINT || "";
export const DELETE_ACCOUNT_FUNCTION =
  import.meta.env.VITE_DELETE_ACCOUNT_FUNCTION || "delete-account";
