import { createSupabaseServer } from '@/lib/supabase-server';
import { CatalogoClient } from './CatalogoClient';

export const dynamic = 'force-dynamic';

export default async function CatalogoPage() {
  const supabase = await createSupabaseServer();

  const [plansRes, modulesRes, hoursRes] = await Promise.all([
    supabase.from('plans').select('id, name, preco_mensal, preco_anual, taxa_min, ativo').order('preco_mensal'),
    supabase.from('modules').select('id, nome, descricao, valor, tipo, categoria, ativo').order('nome'),
    supabase.from('hour_packages').select('id, nome, horas, bonus_horas, validade_dias, ativo').order('horas'),
  ]);

  return (
    <CatalogoClient
      plans={(plansRes.data ?? []) as never[]}
      modules={(modulesRes.data ?? []) as never[]}
      hours={(hoursRes.data ?? []) as never[]}
    />
  );
}
