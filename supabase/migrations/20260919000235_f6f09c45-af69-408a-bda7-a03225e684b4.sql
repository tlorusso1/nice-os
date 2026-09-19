CREATE TABLE public.vendas_notas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_invoice_id text NOT NULL,
  access_key text,
  invoice_number text,
  series text,
  issued_at date NOT NULL,
  channel text NOT NULL,
  line_index integer NOT NULL,
  sku text,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_value numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_invoice_id, line_index)
);
GRANT ALL ON public.vendas_notas_itens TO service_role;
ALTER TABLE public.vendas_notas_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages fiscal sale items"
ON public.vendas_notas_itens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
CREATE INDEX vendas_notas_itens_issued_idx ON public.vendas_notas_itens (issued_at);
CREATE INDEX vendas_notas_itens_access_key_idx ON public.vendas_notas_itens (access_key) WHERE access_key IS NOT NULL;
CREATE INDEX vendas_notas_itens_sku_idx ON public.vendas_notas_itens (sku);
CREATE TRIGGER update_vendas_notas_itens_updated_at
BEFORE UPDATE ON public.vendas_notas_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();