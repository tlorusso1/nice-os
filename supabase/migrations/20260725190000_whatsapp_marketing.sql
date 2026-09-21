-- WhatsApp marketing (zap-marketing) — camada compartilhada no Supabase.
-- O worker local (Baileys) sincroniza pra cá e o módulo marketing do NICE OS lê/controla:
--   whatsapp_envios              — log de tudo que saiu (réguas + campanha manual)
--   whatsapp_reguas              — config das réguas de relacionamento (editável no NICE OS)
--   whatsapp_config              — limites por instância (teto seguro / reserva manual)
--   whatsapp_segmento_snapshots  — tamanho de cada segmento no tempo (funil de propensão)
--   whatsapp_status              — estado da conexão de cada número (b2c/b2b)

-- 1) Log de envios (audit trail, no padrão do email_send_log)
CREATE TABLE IF NOT EXISTS public.whatsapp_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia TEXT NOT NULL DEFAULT 'b2c',          -- b2c | b2b
  numero TEXT NOT NULL,
  nome TEXT,
  origem TEXT NOT NULL,                            -- ex: regua:winback-60 | campanha:<nome>
  tipo TEXT NOT NULL CHECK (tipo IN ('regua','campanha')),
  status TEXT NOT NULL,                            -- ok | optout | sem-whatsapp | erro
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_envios_created ON public.whatsapp_envios(created_at);
CREATE INDEX IF NOT EXISTS idx_wa_envios_instancia ON public.whatsapp_envios(instancia);
CREATE INDEX IF NOT EXISTS idx_wa_envios_origem ON public.whatsapp_envios(origem);
GRANT SELECT ON public.whatsapp_envios TO authenticated;
GRANT ALL ON public.whatsapp_envios TO service_role;
ALTER TABLE public.whatsapp_envios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "authenticated read whatsapp_envios" ON public.whatsapp_envios
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Config das réguas (o NICE OS edita, o worker lê)
CREATE TABLE IF NOT EXISTS public.whatsapp_reguas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia TEXT NOT NULL DEFAULT 'b2c',
  regua_key TEXT NOT NULL,                         -- reposicao | segunda-compra | winback-60 | winback-90
  nome TEXT NOT NULL,
  prioridade INTEGER NOT NULL DEFAULT 100,
  ativa BOOLEAN NOT NULL DEFAULT true,
  filtro JSONB NOT NULL DEFAULT '{}'::jsonb,
  oferta JSONB NOT NULL DEFAULT '{}'::jsonb,
  mensagens JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instancia, regua_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_reguas TO authenticated;
GRANT ALL ON public.whatsapp_reguas TO service_role;
ALTER TABLE public.whatsapp_reguas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "authenticated manage whatsapp_reguas" ON public.whatsapp_reguas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TRIGGER update_whatsapp_reguas_updated_at BEFORE UPDATE ON public.whatsapp_reguas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Config por instância (limites de envio)
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  instancia TEXT PRIMARY KEY,
  limite_seguro_dia INTEGER NOT NULL DEFAULT 50,
  reserva_manual INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_config TO authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "authenticated manage whatsapp_config" ON public.whatsapp_config
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Snapshots de segmento (funil de propensão no tempo)
CREATE TABLE IF NOT EXISTS public.whatsapp_segmento_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia TEXT NOT NULL DEFAULT 'b2c',
  regua_key TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_seg_instancia ON public.whatsapp_segmento_snapshots(instancia);
CREATE INDEX IF NOT EXISTS idx_wa_seg_gerado ON public.whatsapp_segmento_snapshots(gerado_em);
GRANT SELECT ON public.whatsapp_segmento_snapshots TO authenticated;
GRANT ALL ON public.whatsapp_segmento_snapshots TO service_role;
ALTER TABLE public.whatsapp_segmento_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "authenticated read whatsapp_segmento_snapshots" ON public.whatsapp_segmento_snapshots
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Status da conexão por número
CREATE TABLE IF NOT EXISTS public.whatsapp_status (
  instancia TEXT PRIMARY KEY,
  estado TEXT NOT NULL DEFAULT 'close',            -- open | connecting | close
  numero TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_status TO authenticated;
GRANT ALL ON public.whatsapp_status TO service_role;
ALTER TABLE public.whatsapp_status ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "authenticated read whatsapp_status" ON public.whatsapp_status
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
