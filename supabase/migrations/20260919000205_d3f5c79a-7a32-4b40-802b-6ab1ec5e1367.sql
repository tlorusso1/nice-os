CREATE POLICY "Service role manages vendas sync state"
ON public.vendas_sync_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role manages vendas sync runs"
ON public.vendas_sync_runs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);