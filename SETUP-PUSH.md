# Setup — Web Push + aprovação de conteúdo no NICE OS

Notificação no celular + fila "Pra aprovar" (`/aprovar`) pra a máquina de conteúdo. Substitui
o WhatsApp (Baileys instável) como canal de aprovação.

## Arquitetura
```
máquina local ──escreve──▶ Supabase (content_aprovacoes) ──▶ NICE OS /aprovar (celular)
      │                                                            │ botões
      └──chama send-push──▶ edge function ──Web Push──▶ 🔔 celular  ▼
                                                        Supabase (status: aprovado)
      máquina local ◀──lê a decisão──────────────────────────────────┘ ──▶ publica
```

## Passos (uma vez)

1. **Aplicar a migration** `supabase/migrations/20260725201000_push_e_aprovacao.sql`
   (cria `push_subscriptions` e `content_aprovacoes`). Via Lovable/Supabase.

2. **Chave VAPID pública → env do frontend** (Lovable → Project Settings → env):
   ```
   VITE_VAPID_PUBLIC_KEY=BKIkXK7JCV-h6R8d9zWIgzpH1zlrONVfEYIF_raBrWCmTCIIJoW2oL-hY9mcJ0l3l4ilU--dQyjwyaa3--gpCsY
   ```

3. **VAPID → secrets da edge function** (a privada é SECRETA — Thiago tem no chat/arquivo):
   ```
   supabase secrets set VAPID_PUBLIC_KEY=BKIkXK7JCV-h6R8d9zWIgzpH1zlrONVfEYIF_raBrWCmTCIIJoW2oL-hY9mcJ0l3l4ilU--dQyjwyaa3--gpCsY
   supabase secrets set VAPID_PRIVATE_KEY=<a chave privada>
   supabase secrets set VAPID_SUBJECT=mailto:thiago@nicefoods.com.br
   supabase functions deploy send-push
   ```

4. **Deploy do app** (Lovable rebuilda ao dar merge no main) — o `push-handler.js` entra no
   service worker via `importScripts` (vite.config.ts).

5. **No NICE OS**, abrir `/aprovar` no celular e tocar **"Ativar notificações"** (uma vez por device).

## Testar
- Inserir uma linha em `content_aprovacoes` (status `pendente`) → aparece em `/aprovar`.
- Chamar a função `send-push` com `{title:"teste", body:"tem post", url:"/aprovar"}` → chega o push.

## Lado do worker (repo nice-foods, a fazer)
A máquina local (zap/rodada-artes) vai: hospedar os slides (Netlify) → INSERT em
`content_aprovacoes` → chamar `send-push` → esperar `status` virar `aprovado` → publicar.
Precisa de `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no `.env` do zap.
