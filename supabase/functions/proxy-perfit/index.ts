import { fetchIntegration, sanitizeResponseBody } from "../_shared/sanitize-response.ts";
import { requireAdmin } from "../_shared/require-admin.ts";
/**
 * proxy-perfit — Supabase Edge Function
 * Injeta PERFIT_API_KEY e faz proxy para https://api.myperfit.com/v2/{account}
 *
 * Secrets necessários:
 *   supabase secrets set PERFIT_API_KEY=<key>
 *   supabase secrets set PERFIT_ACCOUNT=nicefoods
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PERFIT_KEY = Deno.env.get("PERFIT_API_KEY") ?? "";
const PERFIT_ACCOUNT = Deno.env.get("PERFIT_ACCOUNT") ?? "";
const TARGET = `https://api.myperfit.com/v2/${PERFIT_ACCOUNT}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authError = await requireAdmin(req, CORS);
  if (authError) return authError;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/proxy-perfit/, "").replace(/^\/functions\/v1\/proxy-perfit/, "") || "/";
  const targetUrl = `${TARGET}${path}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${PERFIT_KEY}`);
  headers.delete("host");
  headers.delete("apikey");

  const res = await fetchIntegration(targetUrl, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
  });

  const body = await res.text();
  return new Response([204, 205, 304].includes(res.status) ? null : sanitizeResponseBody(body, [PERFIT_KEY]), {
    status: res.status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
