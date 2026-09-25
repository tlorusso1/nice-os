// push.ts — inscrição de Web Push do NICE OS (guarda a subscription no Supabase).
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSuportado(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function notificacoesAtivas(): Promise<boolean> {
  if (!pushSuportado() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

export async function ativarNotificacoes(): Promise<{ ok: boolean; motivo?: string }> {
  if (!pushSuportado()) return { ok: false, motivo: "Este device não suporta notificações push." };
  if (!VAPID_PUBLIC) return { ok: false, motivo: "VAPID não configurado (VITE_VAPID_PUBLIC_KEY)." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, motivo: "Permissão de notificação negada." };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  const json = sub.toJSON();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user?.id ?? null,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, motivo: error.message };
  return { ok: true };
}

export async function desativarNotificacoes(): Promise<void> {
  if (!pushSuportado()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
