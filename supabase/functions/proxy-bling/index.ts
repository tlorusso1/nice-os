/**
 * proxy-bling — Supabase Edge Function
 * Injeta BLING_TOKEN (Bearer) e faz proxy para https://api.bling.com.br/Api/v3
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
};

const TOKEN = (Deno.env.get("BLING_TOKEN") ?? "").trim().replace(/^['"]|['"]$/g, "").replace(/^bearer\s+/i, "");
const TARGET = "https://api.bling.com.br/Api/v3";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (!TOKEN) {
    return new Response(JSON.stringify({ error: "BLING_TOKEN não configurado" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const path =
    url.pathname.replace(/^\/proxy-bling/, "").replace(/^\/functions\/v1\/proxy-bling/, "") || "/";

  const res = await fetch(`${TARGET}${path}${url.search}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
  });

  const body = await res.text();
  if (res.status === 401) {
    console.error("Bling rejeitou o token", { path, status: res.status });
    return new Response(
      JSON.stringify({
        error: "BLING_INVALID_TOKEN",
        message: "Bling rejeitou o access token. Renove o BLING_TOKEN (OAuth expira em 6h).",
        upstreamStatus: 401,
        data: [],
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  return new Response(body, {
    status: res.status,
    headers: { ...CORS, "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
});
