interface QueryState {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  data: unknown;
  dataUpdatedAt: number;
}

/** Configuration is not proof of a working integration. Display query evidence. */
export function SourceStatus({ source, period, configured, queries, unavailableReason }: {
  source: string;
  period: string;
  configured: boolean;
  queries: QueryState[];
  unavailableReason?: string;
}) {
  const hasError = queries.some((query) => query.isError);
  const pending = queries.some((query) => query.isLoading || query.isFetching);
  const hasData = queries.some((query) => query.data !== undefined);
  const complete = queries.every((query) => query.data !== undefined && !query.isError);
  const timestamps = queries.map((query) => query.dataUpdatedAt).filter((time) => time > 0);
  const lastUpdated = timestamps.length ? Math.min(...timestamps) : null;
  const status = unavailableReason ?? (!configured ? "Não configurado" :
    hasError ? "Indisponível: falha na consulta" : pending ? "Consultando…" :
    complete ? "Dados consultados" : hasData ? "Dados parciais" : "Sem dados disponíveis");

  return (
    <div role="status" className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
      <p><strong>{source}</strong> · {status}</p>
      <p className="text-muted-foreground">Período: {period}</p>
      <p className="text-muted-foreground">Consulta bem-sucedida mais antiga deste conjunto: {lastUpdated ? new Date(lastUpdated).toLocaleString("pt-BR") : "não disponível"}</p>
      {hasError && hasData && <p>Há dados em cache, ocultos até uma nova consulta bem-sucedida.</p>}
    </div>
  );
}
