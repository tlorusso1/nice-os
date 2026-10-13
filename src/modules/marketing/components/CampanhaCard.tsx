import { formatMoney as fmt, formatRate, formatNumber } from "../lib/dataQuality";
import { useState } from "react";
import { TrendingUp, TrendingDown, Pause, Play, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  classificarCampanha,
  CLASSIFICACAO_CONFIG,
  useUpdateMetaCampaign,
  type MetaCampaign,
} from "../hooks/useMarketingData";


interface Props {
  campanha: MetaCampaign & { channel?: "meta" | "google" };
}

type Acao = "escalar" | "matar" | "reativar" | null;

export function CampanhaCard({ campanha }: Props) {
  const { toast } = useToast();
  const { mutateAsync, isPending } = useUpdateMetaCampaign();
  const [acaoPendente, setAcaoPendente] = useState<Acao>(null);

  const classificacao = classificarCampanha(campanha);
  const config = CLASSIFICACAO_CONFIG[classificacao];
  const { insights, name, dailyBudget, status } = campanha;
  const novoBudget = dailyBudget === null ? null : Math.round(dailyBudget * 1.2 * 100) / 100;

  const DIALOGS: Record<NonNullable<Acao>, { titulo: string; desc: string; confirmLabel: string; confirmClass: string }> = {
    escalar: {
      titulo: `🚀 Escalar "${name}"?`,
      desc: `Budget diário: ${fmt(dailyBudget)} → ${fmt(novoBudget)} (+20%). A campanha continuará ativa com orçamento maior.`,
      confirmLabel: "Escalar agora",
      confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    matar: {
      titulo: `🔴 Pausar "${name}"?`,
      desc: `ROAS ${formatRate(insights.roas, "x")} com ${fmt(insights.spend)} investido. Isso pausará a campanha imediatamente no Meta Ads.`,
      confirmLabel: "Pausar campanha",
      confirmClass: "bg-red-600 hover:bg-red-700 text-white",
    },
    reativar: {
      titulo: `▶️ Reativar "${name}"?`,
      desc: `A campanha voltará a veicular com o budget de ${fmt(dailyBudget)}/dia.`,
      confirmLabel: "Reativar",
      confirmClass: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  };

  async function confirmar() {
    if (!acaoPendente || campanha.channel === "google") return;
    try {
      if (acaoPendente === "escalar" && novoBudget !== null) {
        await mutateAsync({ id: campanha.id, updates: { dailyBudget: novoBudget, status: "ACTIVE" } });
        toast({ title: "✅ Budget escalado!", description: `${name}: ${fmt(dailyBudget)} → ${fmt(novoBudget)}/dia` });
      } else if (acaoPendente === "matar") {
        await mutateAsync({ id: campanha.id, updates: { status: "PAUSED" } });
        toast({ title: "⏸ Campanha pausada", description: name });
      } else if (acaoPendente === "reativar") {
        await mutateAsync({ id: campanha.id, updates: { status: "ACTIVE" } });
        toast({ title: "▶️ Campanha reativada", description: name });
      }
    } catch {
      toast({ title: "Erro", description: "Não foi possível executar a ação.", variant: "destructive" });
    }
    setAcaoPendente(null);
  }

  return (
    <>
      <div className={cn(
        "bg-card border rounded-xl p-4 space-y-3",
        classificacao === "escalavel" && "border-emerald-200 dark:border-emerald-900",
        classificacao === "matar" && "border-red-200 dark:border-red-900",
        classificacao === "monitorar" && "border-amber-200 dark:border-amber-900",
        classificacao === "pausada" && "border-border opacity-70",
        classificacao === "sem_dados" && "border-border",
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{name}</p>
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border mt-1",
              config.color
            )}>
              {config.emoji} {config.label}
            </span>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-1.5 shrink-0">
            {campanha.channel !== "google" && <>
            {classificacao === "escalavel" && novoBudget !== null && (
              <button
                onClick={() => setAcaoPendente("escalar")}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap size={11} />
                Escalar
              </button>
            )}
            {classificacao === "matar" && (
              <button
                onClick={() => setAcaoPendente("matar")}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <TrendingDown size={11} />
                Matar
              </button>
            )}
            {classificacao === "monitorar" && status === "ACTIVE" && (
              <button
                onClick={() => setAcaoPendente("matar")}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-border text-muted-foreground hover:border-red-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
              >
                <Pause size={11} />
                Pausar
              </button>
            )}
            {classificacao === "pausada" && (
              <button
                onClick={() => setAcaoPendente("reativar")}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Play size={11} />
                Reativar
              </button>
            )}
            </>}
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Gasto</p>
            <p className="text-xs font-semibold tabular-nums">{fmt(insights.spend)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">ROAS</p>
            <p className={cn(
              "text-xs font-bold tabular-nums",
              insights.roas === null ? "text-muted-foreground" :
              insights.roas >= 3.5 ? "text-emerald-600 dark:text-emerald-400" :
              insights.roas >= 2 ? "text-amber-600 dark:text-amber-400" : "text-red-500"
            )}>
              {formatRate(insights.roas, "x")}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Compras</p>
            <p className="text-xs font-semibold tabular-nums">{formatNumber(insights.purchases)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">CPC</p>
            <p className="text-xs font-semibold tabular-nums">{fmt(insights.cpc)}</p>
          </div>
        </div>

        {/* Receita gerada */}
        {insights.purchaseValue > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={11} />
            <span>Receita atribuída: <strong>{fmt(insights.purchaseValue)}</strong></span>
          </div>
        )}
      </div>

      {/* AlertDialog de confirmação */}
      {acaoPendente && (
        <AlertDialog open onOpenChange={(o) => !o && setAcaoPendente(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{DIALOGS[acaoPendente].titulo}</AlertDialogTitle>
              <AlertDialogDescription>{DIALOGS[acaoPendente].desc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmar}
                disabled={isPending}
                className={DIALOGS[acaoPendente].confirmClass}
              >
                {isPending ? "Aguarde..." : DIALOGS[acaoPendente].confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
