import type { ModuleId } from '../models/modules';
import { useModuleStore } from '../store/moduleStore';
import { useAppStore } from '../store/appStore';

/**
 * Hook de feature gate — verifica se uma feature está disponível
 * para o profissional considerando plano + módulos contratados.
 *
 * Uso:
 *   const temCommunicare = useFeature('communicare.prontuario_basico');
 *   const temCredenciamento = useFeature('ar.credenciamento_analise');
 *
 * Retorna `false` enquanto os módulos ainda estiverem carregando.
 */
export function useFeature(featureId: string): boolean {
  const plan = useAppStore((s) => s.userPlan);
  const hasFeature = useModuleStore((s) => s.hasFeature);
  const isLoaded = useModuleStore((s) => s.isLoaded);

  if (!isLoaded) return false;

  return hasFeature(featureId, plan);
}

/**
 * Variante que verifica se um módulo inteiro está ativo
 * (útil para mostrar/esconder seções de UI inteiras).
 *
 * Uso:
 *   const moduloAR = useModuleActive('ar_credenciamento');
 */
export function useModuleActive(moduleId: ModuleId): boolean {
  const plan = useAppStore((s) => s.userPlan);
  const isModuleActive = useModuleStore((s) => s.isModuleActive);
  const isLoaded = useModuleStore((s) => s.isLoaded);

  if (!isLoaded) return false;

  return isModuleActive(moduleId, plan);
}
