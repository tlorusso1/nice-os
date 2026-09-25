import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, Check, X, Pencil, Loader2 } from "lucide-react";
import { ativarNotificacoes, notificacoesAtivas } from "@/lib/push";
import { toast } from "sonner";

type Aprovacao = {
  id: string;
  tipo: string;
  serie: string | null;
  titulo: string;
  slug: string;
  review_url: string | null;
  slides: string[];
  legenda: string | null;
  status: string;
  created_at: string;
};

export default function AprovacoesPage() {
  const [itens, setItens] = useState<Aprovacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushOn, setPushOn] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("content_aprovacoes")
      .select("*")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    setItens((data as Aprovacao[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    notificacoesAtivas().then(setPushOn);
    // realtime: recarrega quando entra pendência nova
    const ch = supabase
      .channel("content_aprovacoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_aprovacoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  async function decidir(item: Aprovacao, status: "aprovado" | "reprovado" | "ajuste", ajuste?: string) {
    const { error } = await supabase
      .from("content_aprovacoes")
      .update({ status, ajuste_texto: ajuste ?? null, decided_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(
      status === "aprovado" ? "Aprovado! Vai ser publicado." :
      status === "reprovado" ? "Reprovado." : "Ajuste enviado.",
    );
    setItens((prev) => prev.filter((x) => x.id !== item.id));
  }

  async function ativar() {
    const r = await ativarNotificacoes();
    if (r.ok) { setPushOn(true); toast.success("Notificações ativadas neste device 🔔"); }
    else toast.error(r.motivo ?? "Não deu pra ativar.");
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pra aprovar</h1>
        <Button variant={pushOn ? "secondary" : "default"} size="sm" onClick={ativar} disabled={pushOn}>
          {pushOn ? <BellRing className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
          {pushOn ? "Notificações on" : "Ativar notificações"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">Nada pendente. 🎉</p>
      ) : (
        itens.map((item) => (
          <div key={item.id} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              {item.serie ?? item.tipo}
            </div>
            <h2 className="font-semibold">{item.titulo}</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(item.slides ?? []).map((url, i) => (
                <img key={i} src={url} alt={`slide ${i + 1}`} className="h-56 rounded-lg border flex-shrink-0" loading="lazy" />
              ))}
            </div>
            {item.legenda && (
              <p className="text-sm whitespace-pre-wrap bg-muted rounded-lg p-3">{item.legenda}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={() => decidir(item, "aprovado")}>
                <Check className="mr-2 h-4 w-4" /> Aprovar
              </Button>
              <Button variant="secondary" onClick={() => {
                const t = window.prompt("O que ajustar? (ex: slide 3, foto mais clara)");
                if (t) decidir(item, "ajuste", t);
              }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => decidir(item, "reprovado")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {item.review_url && (
              <a href={item.review_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                ver a página de review completa
              </a>
            )}
          </div>
        ))
      )}
    </div>
  );
}
