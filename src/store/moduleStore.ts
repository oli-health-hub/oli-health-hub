import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { reportError } from '../services/sentryService';
import type { ModuleId, UserModule } from '../models/modules';
import {
  MODULE_CATALOG,
  isModuleIncludedInPlan,
  getModuleFeatures,
} from '../models/modules';
import type { PlanType } from '../models/types';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleStore {
  /** Módulos contratados/ativos do profissional */
  activeModules: UserModule[];
  isLoaded: boolean;

  /** Carrega módulos do profissional a partir do Supabase */
  loadModules: (professionalId: string, plan: PlanType) => Promise<void>;

  /** Verifica se um módulo específico está ativo (contratado ou incluso no plano) */
  isModuleActive: (moduleId: ModuleId, plan: PlanType) => boolean;

  /** Verifica se uma feature específica está disponível */
  hasFeature: (featureId: string, plan: PlanType) => boolean;

  /** Adiciona um módulo localmente após ativação bem-sucedida */
  addModule: (module: UserModule) => void;

  /** Remove um módulo localmente após cancelamento */
  removeModule: (moduleId: ModuleId) => void;

  /** Reseta estado (logout) */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useModuleStore = create<ModuleStore>((set, get) => ({
  activeModules: [],
  isLoaded: false,

  loadModules: async (professionalId: string, plan: PlanType) => {
    try {
      // Join com modules para resolver slug → ModuleId
      const { data, error } = await supabase
        .from('user_modules')
        .select(`
          id,
          professional_id,
          module_id,
          status,
          activated_at,
          ativo_ate,
          config,
          contract_url,
          created_at,
          modules ( slug )
        `)
        .eq('professional_id', professionalId)
        .in('status', ['active', 'pending_config', 'pending_payment']);

      if (error) throw error;

      const modules: UserModule[] = (data ?? [])
        .filter((row) => row.modules && (row.modules as { slug: string }).slug)
        .map((row) => ({
          id:             row.id,
          professionalId: row.professional_id,
          moduleDbId:     row.module_id,
          moduleId:       (row.modules as { slug: string }).slug as ModuleId,
          status:         row.status as UserModule['status'],
          activatedAt:    row.activated_at ?? undefined,
          expiresAt:      row.ativo_ate ?? undefined,
          config:         (row.config as Record<string, unknown>) ?? {},
          contractUrl:    row.contract_url ?? undefined,
          createdAt:      row.created_at,
        }));

      // Adiciona módulos inclusos no plano que ainda não estão na lista
      const includedModules = getIncludedModulesForPlan(plan, professionalId, modules);

      set({ activeModules: [...modules, ...includedModules], isLoaded: true });
    } catch (err) {
      reportError(err as Error, { context: 'moduleStore.loadModules' });
      set({ isLoaded: true });
    }
  },

  isModuleActive: (moduleId: ModuleId, plan: PlanType) => {
    const { activeModules } = get();
    if (isModuleIncludedInPlan(moduleId, plan)) return true;
    return activeModules.some(
      (m) => m.moduleId === moduleId && m.status === 'active',
    );
  },

  hasFeature: (featureId: string, plan: PlanType) => {
    const { activeModules } = get();

    // Features de módulos contratados ativos
    for (const userModule of activeModules) {
      if (userModule.status !== 'active') continue;
      const features = getModuleFeatures(userModule.moduleId, plan);
      if (features.includes(featureId)) return true;
    }

    // Features de módulos inclusos no plano (sem contratação extra)
    for (const id of Object.keys(MODULE_CATALOG) as ModuleId[]) {
      if (isModuleIncludedInPlan(id, plan)) {
        const features = getModuleFeatures(id, plan);
        if (features.includes(featureId)) return true;
      }
    }

    return false;
  },

  addModule: (module: UserModule) => {
    set((state) => ({
      activeModules: [
        ...state.activeModules.filter((m) => m.moduleId !== module.moduleId),
        module,
      ],
    }));
  },

  removeModule: (moduleId: ModuleId) => {
    set((state) => ({
      activeModules: state.activeModules.filter((m) => m.moduleId !== moduleId),
    }));
  },

  reset: () => set({ activeModules: [], isLoaded: false }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera UserModule sintéticos para módulos inclusos no plano
 * (sem registro em user_modules — incluso automaticamente).
 */
function getIncludedModulesForPlan(
  plan: PlanType,
  professionalId: string,
  existing: UserModule[],
): UserModule[] {
  const existingIds = new Set(existing.map((m) => m.moduleId));
  const synthetic: UserModule[] = [];

  for (const id of Object.keys(MODULE_CATALOG) as ModuleId[]) {
    if (isModuleIncludedInPlan(id, plan) && !existingIds.has(id)) {
      synthetic.push({
        id:             `plan_included_${id}`,
        professionalId,
        moduleDbId:     '',
        moduleId:       id,
        status:         'active',
        config:         {},
        createdAt:      new Date().toISOString(),
      });
    }
  }

  return synthetic;
}
