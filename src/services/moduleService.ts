/**
 * moduleService.ts
 *
 * Busca preços de módulos do DB (fonte única: Admin → tabela `modules`).
 * O MODULE_CATALOG do TypeScript mantém metadados (ativação, features, logos).
 * Este serviço sobrescreve apenas os campos de preço em runtime.
 */

import { supabase } from './supabase';
import type { ModuleId } from '../models/modules';

export interface ModulePriceOverride {
  slug:   ModuleId;
  nome:   string;
  valor:  number;
  tipo:   string;  // 'mensal' | 'unico' | 'incluido'
  ativo:  boolean;
}

export async function fetchModulePricing(): Promise<ModulePriceOverride[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('slug, nome, valor, tipo, ativo')
    .not('slug', 'is', null);
  if (error) throw error;
  return (data ?? []) as ModulePriceOverride[];
}
