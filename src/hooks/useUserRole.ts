import { useCallback } from 'react';
import { useModuleAccess } from '@/core/hooks/useModuleAccess';
import { FocusModeId } from '@/types/focus-mode';

export type AppRole = 'admin' | 'marketing' | 'operacional';

// Mapeamento de módulos para roles que podem acessá-los
const MODE_ROLE_MAP: Record<FocusModeId, AppRole[]> = {
  'financeiro': ['admin'],
  'marketing': ['admin', 'marketing'],
  'supplychain': ['admin'],
  'pre-reuniao-geral': ['admin'],
  'reuniao-ads': ['admin', 'marketing'],
  'pre-reuniao-verter': ['admin'],
  'tasks': ['admin', 'operacional'],
};

export function useUserRole() {
  const { roles, isLoading } = useModuleAccess();
  const isAdmin = !isLoading && roles.includes('admin');
  const canAccess = useCallback((modeId: FocusModeId): boolean => {
    if (isLoading) return false;
    if (isAdmin) return true;
    return (MODE_ROLE_MAP[modeId] ?? []).some(role => roles.includes(role));
  }, [roles, isLoading, isAdmin]);
  return { roles, isLoading, canAccess, isAdmin };
}
