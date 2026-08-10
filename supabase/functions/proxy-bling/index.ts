/**
 * proxy-bling — Supabase Edge Function
 * Proxy para https://api.bling.com.br/Api/v3 com refresh automático de token OAuth.
 *
 * Secrets:
 *   BLING_CLIENT_ID, BLING_CLIENT_SECRET, BLING_REFRESH_TOKEN (inicial), BLING_TOKEN (opcional)
 * Tokens correntes são persistidos em public.app_config (bling_access_token / bling_refresh_token).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
};

const clean = (v: string) => v.trim().replace(/^['"]|['"]$/g, "").replace(/^bearer\s+/i, "");
const CLIENT_ID = clean(Deno.env.get("BLING_CLIENT_ID") ?? "");
const CLIENT_SECRET = clean(Deno.env.get("BLING_CLIENT_SECRET") ?? "");
const TARGET = "https://api.bling.com.br/Api/v3";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function cfgGet(key: string): Promise<string> {
  const { data } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? "";
}
async function cfgSet(key: string, value: string) {
  await db.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

async function refreshToken(): Promise<string> {
  const refresh = (await cfgGet("bling_refresh_token")) || clean(Deno.env.get("BLING_REFRESH_TOKEN") ?? "");
  if (!refresh || !CLIENT_ID || !CLIENT_SECRET) return "";

  const res = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  if (!res.ok) {
    console.error("Bling refresh falhou", res.status, (await res.text()).slice(0, 300));
    return "";
  }
  const json = await res.json();
  if (json.access_token) await cfgSet("bling_access_token", json.access_token);
  if (json.refresh_token) await cfgSet("bling_refresh_token", json.refresh_token);
  return json.access_token ?? "";
}

async function currentToken(): Promise<string> {
  return (await cfgGet("bling_access_token")) || clean(Deno.env.get("BLING_TOKEN") ?? "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const path =
    url.pathname.replace(/^\/proxy-bling/, "").replace(/^\/functions\/v1\/proxy-bling/, "") || "/";
  const payload = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();

  const call = (token: string) =>
    fetch(`${TARGET}${path}${url.search}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: payload,
    });

  let token = await currentToken();
  let res = token ? await call(token) : new Response("", { status: 401 });

  if (res.status === 401) {
    const fresh = await refreshToken();
    if (fresh) {
      token = fresh;
      res = await call(token);
    }
  }

  if (res.status === 401) {
    return new Response(
      JSON.stringify({
        error: "BLING_INVALID_TOKEN",
        message:
          "Bling rejeitou o token e o refresh automático não funcionou. Configure BLING_CLIENT_ID, BLING_CLIENT_SECRET e BLING_REFRESH_TOKEN.",
        upstreamStatus: 401,
        data: [],
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...CORS, "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
});
