import { Package, ReceiptText } from "lucide-react";
import { FinanceiroMode } from "@/components/modes/FinanceiroMode";
import { SupplyChainMode } from "@/components/modes/SupplyChainMode";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFocusModes } from "@/hooks/useFocusModes";

export default function OperacoesPage() {
  const {
    modes,
    isLoading,
    saveStatus,
    flushSave,
    ritmoExpectativa,
    supplyExports,
    updateTimestamp,
    updateFinanceiroData,
    updateSupplyChainData,
    addSupplyItem,
    updateSupplyItem,
    removeSupplyItem,
  } = useFocusModes();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const saveLabel = saveStatus === "saving"
    ? "Salvando..."
    : saveStatus === "error"
      ? "Erro ao salvar"
      : "Alterações salvas";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Operações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite lançamentos, custos fixos e estoque. As alterações são gravadas automaticamente.
          </p>
        </div>
        <Badge variant={saveStatus === "error" ? "destructive" : "secondary"}>{saveLabel}</Badge>
      </header>

      <Tabs defaultValue="financeiro" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="financeiro" className="min-h-10 gap-2">
            <ReceiptText className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="estoque" className="min-h-10 gap-2">
            <Package className="h-4 w-4" />
            Estoque
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="mt-4">
          <FinanceiroMode
            mode={modes.financeiro}
            onUpdateFinanceiroData={updateFinanceiroData}
            ritmoExpectativa={ritmoExpectativa}
            onUpdateTimestamp={updateTimestamp}
            flushSave={flushSave}
            cmvSupply={supplyExports?.cmvMensal}
            supplyExports={supplyExports}
            reuniaoAdsData={modes.financeiro.reuniaoAdsData}
          />
        </TabsContent>

        <TabsContent value="estoque" className="mt-4">
          <SupplyChainMode
            mode={modes.supplychain}
            onUpdateSupplyChainData={updateSupplyChainData}
            onAddItem={addSupplyItem}
            onUpdateItem={updateSupplyItem}
            onRemoveItem={removeSupplyItem}
            flushSave={flushSave}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}