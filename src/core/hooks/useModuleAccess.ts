import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ModuleId } from "../store/navigation";

type AppRole = "admin" | "marketing" | "operacional" | "comercial";

// Map of role → allowed modules
export const ROLE_MODULES: Record<AppRole, ModuleId[]> = {
  admin:       ["dashboard", "financeiro", "ecommerce", "canais", "marketing", "atendimento", "supply", "produtos", "operacoes", "b2b"],
  marketing:   ["marketing", "ecommerce", "canais", "produtos"],
  operacional: ["supply", "operacoes", "b2b"],
  comercial:   ["b2b", "canais"],
};

// Default redirect path per role (first module in their list)
export const ROLE_DEFAULT_PATH: Record<AppRole, string> = {
  admin:       "/dashboard",
  marketing:   "/marketing",
  operacional: "/supply",
  comercial:   "/b2b",
};

interface ModuleAccessState {
  roles: AppRole[];
  allowedModules: ModuleId[];
  defaultPath: string;
  isLoading: boolean;
  canAccess: (mod: ModuleId) => boolean;
}

export function useModuleAccess(): ModuleAccessState {
  const { user } = useAuth();
  const { data: roles = [], isLoading, isError } = useQuery({
    queryKey: ['access', 'roles', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []).map(row => String(row.role)).filter((role): role is AppRole => role in ROLE_MODULES);
    },
    retry: 1,
    staleTime: 60_000,
  });

  // admin always sees everything
  const isAdmin = Boolean(user) && !isLoading && !isError && roles.includes("admin");
  const allowedModules: ModuleId[] = isAdmin
    ? ROLE_MODULES.admin
    : !user || isError || isLoading ? [] : [...new Set(roles.flatMap((r) => ROLE_MODULES[r] ?? []))];

  // Missing roles grant no access; the route boundary displays an explicit denial.
  const primaryRole = roles[0];
  const defaultPath = ROLE_DEFAULT_PATH[primaryRole] ?? "/dashboard";

  const canAccess = (mod: ModuleId) => isAdmin || allowedModules.includes(mod);

  return { roles: !user || isError ? [] : roles, allowedModules, defaultPath, isLoading, canAccess };
}
