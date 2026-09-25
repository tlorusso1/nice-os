-- Web Push + fila de aprovação de conteúdo no NICE OS.
-- A máquina de conteúdo (worker local) escreve pendências aqui e dispara um push;
-- o NICE OS mostra a fila, o usuário aprova/ajusta no celular, o worker lê a decisão.

-- 1) Inscrições de Web Push (uma por device do usuário)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "user manages own push subs" ON public.push_subscriptions
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Fila de aprovação de conteúdo (a máquina escreve; o NICE OS mostra + decide)
CREATE TABLE IF NOT EXISTS public.content_aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'carrossel',          -- carrossel | reel | card
  serie TEXT,
  titulo TEXT NOT NULL,
  slug TEXT NOT NULL,
  review_url TEXT,                                  -- página pública de review
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,         -- urls públicas dos slides, na ordem
  legenda TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovado','ajuste','reprovado','publicado')),
  ajuste_texto TEXT,
  media_id TEXT,                                     -- id do post publicado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_aprov_status ON public.content_aprovacoes(status);
CREATE INDEX IF NOT EXISTS idx_content_aprov_created ON public.content_aprovacoes(created_at);
GRANT SELECT, INSERT, UPDATE ON public.content_aprovacoes TO authenticated;
GRANT ALL ON public.content_aprovacoes TO service_role;
ALTER TABLE public.content_aprovacoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "authenticated manage content_aprovacoes" ON public.content_aprovacoes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TRIGGER update_content_aprovacoes_updated_at BEFORE UPDATE ON public.content_aprovacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
