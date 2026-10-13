import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationBadgeProps {
  name: string;
  status: "connected" | "error" | "loading" | "unknown";
}

export function IntegrationBadge({ name, status }: IntegrationBadgeProps) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border",
      status === "connected" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
      status === "error" && "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
      status === "loading" && "bg-muted text-muted-foreground border-border",
    )}>
      {status === "loading" && <Loader2 size={10} className="animate-spin" />}
      {status === "connected" && <Wifi size={10} />}
      {status === "error" && <WifiOff size={10} />}
      {name}{status === "unknown" ? " · não verificado" : ""}
    </div>
  );
}
