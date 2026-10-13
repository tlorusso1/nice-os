import { format, parseISO, isToday, isTomorrow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conta {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status?: string;
  fonte?: string;
}

interface ContasListProps {
  title: string;
  contas: Conta[];
  tipo: "pagar" | "receber";
  isLoading?: boolean;
  isError?: boolean;
}

function getDateLabel(dateStr: string): { label: string; urgente: boolean } {
  try {
    const d = parseISO(dateStr);
    if (isPast(d) && !isToday(d)) return { label: "Vencida", urgente: true };
    if (isToday(d)) return { label: "Hoje", urgente: true };
    if (isTomorrow(d)) return { label: "Amanhã", urgente: false };
    return { label: format(d, "dd/MM", { locale: ptBR }), urgente: false };
  } catch {
    return { label: dateStr, urgente: false };
  }
}

export function ContasList({ title, contas, tipo, isLoading, isError }: ContasListProps) {
  const total = contas.reduce((s, c) => s + c.valor, 0);
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {!isLoading && !isError && (
            <p className="text-xs text-muted-foreground">{contas.length} lançamentos</p>
          )}
        </div>
        {!isLoading && !isError && (
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            tipo === "receber" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}>
            {fmt(total)}
          </span>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-border max-h-72 overflow-y-auto">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="h-3 bg-muted rounded flex-1" />
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-3 bg-muted rounded w-12" />
            </div>
          ))
        ) : isError ? (
          <div role="alert" className="px-4 py-6 text-sm text-muted-foreground">Consulta indisponível. Não é possível confirmar se há contas em aberto.</div>
        ) : contas.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-6 text-muted-foreground justify-center">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-sm">Nenhum em aberto</span>
          </div>
        ) : (
          contas.slice(0, 30).map((conta) => {
            const { label, urgente } = getDateLabel(conta.vencimento);
            const isVencida = label === "Vencida";
            return (
              <div key={conta.id} className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm",
                isVencida && "bg-red-50/50 dark:bg-red-950/20"
              )}>
                {isVencida ? (
                  <AlertCircle size={13} className="text-red-500 shrink-0" />
                ) : urgente ? (
                  <Clock size={13} className="text-amber-500 shrink-0" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}

                <span className="flex-1 truncate text-foreground">{conta.descricao}</span>

                {conta.fonte && (
                  <span className="text-[10px] px-1 py-0.5 bg-muted rounded text-muted-foreground shrink-0">
                    {conta.fonte}
                  </span>
                )}

                <span className={cn(
                  "text-xs shrink-0 font-medium",
                  urgente || isVencida ? "text-red-500" : "text-muted-foreground"
                )}>
                  {label}
                </span>

                <span className={cn(
                  "tabular-nums text-xs font-semibold shrink-0 w-20 text-right",
                  tipo === "receber" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                )}>
                  {fmt(conta.valor)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
