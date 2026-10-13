import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { authorizeAdmin } from "./authorization.ts";

/** Server-side authorization shared by privileged integration endpoints. */
export async function requireAdmin(
  request: Request,
  corsHeaders: Record<string, string>,
  options: { allowServiceRole?: boolean } = {},
): Promise<Response | null> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  let client: ReturnType<typeof createClient> | undefined;
  const userClient = (token: string) => {
    if (!url || !anonKey) throw new Error("Authorization configuration unavailable");
    client ??= createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return client;
  };

  const result = await authorizeAdmin(request, {
    allowServiceRole: options.allowServiceRole === true,
    serviceRoleKey: options.allowServiceRole ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : undefined,
    getUser: async (token) => {
      const { data, error } = await userClient(token).auth.getUser(token);
      if (error) return null;
      return data.user;
    },
    getRoles: async (userId, token) => {
      // The ID comes only from Auth.getUser; never from query/body/user metadata.
      const { data, error } = await userClient(token)
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error || !data) throw new Error("Role lookup unavailable");
      return data.map((row) => row.role as string);
    },
  });

  if (result.authorized) return null;
  return new Response(JSON.stringify({ error: result.error }), {
    status: result.status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
