import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const defaultAllowedOrigins = [
  "https://ciaranengelbrecht.com",
  "https://www.ciaranengelbrecht.com",
  "https://ciaranimcc.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "ionic://localhost",
];

const baseCorsHeaders = {
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "vary": "Origin",
};
const fallbackCorsHeaders = {
  ...baseCorsHeaders,
  "access-control-allow-origin": defaultAllowedOrigins[0],
};

const tables = ["exercises", "sessions", "measurements", "templates", "settings"] as const;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(req)) {
      return json({ error: "Origin not allowed" }, 403, corsHeaders);
    }
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Deletion function is not configured" }, 500, corsHeaders);
  }
  if (!authHeader) {
    return json({ error: "Missing authorization header" }, 401, corsHeaders);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "Invalid or expired session" }, 401, corsHeaders);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("owner", user.id);
    if (error) return json({ error: `Failed to delete ${table}` }, 500, corsHeaders);
  }

  await admin.from("profiles").delete().eq("id", user.id);

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    return json({ error: "Failed to delete auth user" }, 500, corsHeaders);
  }

  return json({ ok: true }, 200, corsHeaders);
});

function getAllowedOrigins() {
  const configured = Deno.env.get("DELETE_ACCOUNT_ALLOWED_ORIGINS");
  if (!configured) return defaultAllowedOrigins;
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowedOrigin =
    origin && getAllowedOrigins().includes(origin)
      ? origin
      : defaultAllowedOrigins[0];
  return {
    ...baseCorsHeaders,
    "access-control-allow-origin": allowedOrigin,
  };
}

function isAllowedOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || getAllowedOrigins().includes(origin);
}

function json(body: unknown, status = 200, corsHeaders = fallbackCorsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
