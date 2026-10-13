import { fetchIntegration, sanitizeResponseBody } from "../_shared/sanitize-response.ts";
import { requireAdmin } from "../_shared/require-admin.ts";
/**
 * proxy-nuvemshop — Supabase Edge Function
 * Injeta NUVEMSHOP_TOKEN e faz proxy para https://api.nuvemshop.com.br/v1/{store_id}
 *
 * Secrets necessários:
 *   supabase secrets set NUVEMSHOP_TOKEN=<access_token>
 *   supabase secrets set NUVEMSHOP_STORE_ID=<user_id_da_loja>
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function cleanSecret(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function cleanBearerToken(value: string): string {
  return cleanSecret(value).replace(/^bearer\s+/i, "");
}

const NS_TOKEN = cleanBearerToken(Deno.env.get("NUVEMSHOP_TOKEN") ?? "");
const NS_STORE_ID = cleanSecret(Deno.env.get("NUVEMSHOP_STORE_ID") ?? "");
const TARGET = `https://api.nuvemshop.com.br/v1/${NS_STORE_ID}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authError = await requireAdmin(req, CORS);
  if (authError) return authError;

  if (!NS_TOKEN || !NS_STORE_ID) {
    return new Response(JSON.stringify({ error: "Nuvemshop credentials are not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname
    .replace(/^\/proxy-nuvemshop/, "")
    .replace(/^\/functions\/v1\/proxy-nuvemshop/, "") || "/";
  const targetUrl = `${TARGET}${path}${url.search}`;

  const headers = new Headers();
  headers.set("Authentication", `bearer ${NS_TOKEN}`);
  headers.set("User-Agent", "NiceOS/1.0 (thiago@nicefoods.com.br)");
  headers.set("Content-Type", "application/json");

  const res = await fetchIntegration(targetUrl, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
  });

  const body = await res.text();
  if (res.status === 401) {
    console.error("Nuvemshop rejected the configured access token", {
      status: res.status,
      path,
      storeConfigured: Boolean(NS_STORE_ID),
      tokenConfigured: Boolean(NS_TOKEN),
    });

    return new Response(JSON.stringify({
      error: "NUVEMSHOP_INVALID_TOKEN",
      message: "Nuvemshop rejected the configured access token. Reinstall the custom app and update NUVEMSHOP_TOKEN and NUVEMSHOP_STORE_ID from the same installation.",
      upstreamStatus: 401,
    }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response([204, 205, 304].includes(res.status) ? null : sanitizeResponseBody(body, [NS_TOKEN]), {
    status: res.status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
