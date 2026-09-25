/**
 * send-push — Supabase Edge Function
 * Dispara um Web Push pra todas as inscrições do usuário (ou de todos, se sem user_id).
 * Usado pela máquina de conteúdo pra avisar "tem post pra aprovar".
 *
 * Body: { title, body, url?, user_id? }
 * Secrets necessários:
 *   supabase secrets set VAPID_PUBLIC_KEY=<chave pública base64url>
 *   supabase secrets set VAPID_PRIVATE_KEY=<chave privada base64url>
 *   supabase secrets set VAPID_SUBJECT=mailto:thiago@nicefoods.com.br
 * (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm do ambiente da função.)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:thiago@nicefoods.com.br";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID keys não configuradas" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const { title, body, url, user_id } = await req.json().catch(() => ({}));
  if (!title) {
    return new Response(JSON.stringify({ error: "faltou title" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let q = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (user_id) q = q.eq("user_id", user_id);
  const { data: subs, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/marketing" });
  let ok = 0, remove: string[] = [];
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      ok++;
    } catch (e) {
      // 404/410 = inscrição morta → remove
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) remove.push(s.id);
    }
  }
  if (remove.length) await supabase.from("push_subscriptions").delete().in("id", remove);

  return new Response(JSON.stringify({ enviados: ok, total: subs?.length ?? 0, removidas: remove.length }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
