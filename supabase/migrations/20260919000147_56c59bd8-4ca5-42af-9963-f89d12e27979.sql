CREATE TABLE public.vendas_sync_state (
  source text PRIMARY KEY,
  next_month date,
  last_success_at timestamptz,
  status text NOT NULL DEFAULT 'idle',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.vendas_sync_state TO service_role;
ALTER TABLE public.vendas_sync_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vendas_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  mode text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL,
  invoices integer NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  products integer NOT NULL DEFAULT 0,
  channels integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.vendas_sync_runs TO service_role;
ALTER TABLE public.vendas_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX vendas_sync_runs_source_started_idx ON public.vendas_sync_runs (source, started_at DESC);

CREATE TRIGGER update_vendas_sync_state_updated_at
BEFORE UPDATE ON public.vendas_sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendas_sync_runs_updated_at
BEFORE UPDATE ON public.vendas_sync_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();