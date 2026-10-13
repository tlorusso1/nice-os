import { fetchIntegration, sanitizeResponseBody } from "../_shared/sanitize-response.ts";
import { requireAdmin } from "../_shared/require-admin.ts";
/**
 * proxy-meta — Supabase Edge Function
 * Injeta META_ADS_TOKEN e faz proxy para https://graph.facebook.com
 *
 * Secret necessário:
 *   supabase secrets set META_ADS_TOKEN=<token>
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const META_TOKEN = Deno.env.get("META_ADS_TOKEN") ?? "";
const TARGET = "https://graph.facebook.com";

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
  const path = url.pathname.replace(/^\/proxy-meta/, "").replace(/^\/functions\/v1\/proxy-meta/, "") || "/";

  // Meta usa access_token como query param (não header)
  url.searchParams.set("access_token", META_TOKEN);
  const targetUrl = `${TARGET}${path}?${url.searchParams.toString()}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("authorization");
  headers.delete("apikey");

  const res = await fetchIntegration(targetUrl, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
  });

  const body = await res.text();
  return new Response([204, 205, 304].includes(res.status) ? null : sanitizeResponseBody(body, [META_TOKEN]), {
    status: res.status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
