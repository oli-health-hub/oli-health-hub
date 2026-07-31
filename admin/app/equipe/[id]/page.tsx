import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DeleteTeamProfileButton } from './DeleteTeamProfileButton';
import { TeamProfileForm } from './TeamProfileForm';
import { updatePartnerCommissionConfig, ensurePartnerReferralCode } from '@/app/actions';

export const dynamic = 'force-dynamic';

const TEAM_TYPES = ['founder', 'specialist', 'partner', 'team'];

export default async function EquipeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServer();

  const { data: p } = await supabase
    .from('profiles')
    .select('id, nome, especialidade, bio, foto_url, instagram, linkedin, website, whatsapp, user_type, admin_notes, created_at, referral_code')
    .eq('id', params.id)
    .single();

  if (!p || !TEAM_TYPES.includes(p.user_type)) return notFound();

  const { data: commissionConfig } = p.user_type === 'partner'
    ? await supabase.from('partner_commission_config').select('*').eq('partner_id', p.id).maybeSingle()
    : { data: null };

  return (
    <div className="p-7 max-w-2xl">
      <Link href="/equipe" className="inline-flex items-center gap-1.5 text-sm text-oli-gray hover:text-oli-dark mb-4">
        <ArrowLeft size={14} /> Voltar pra Equipe
      </Link>

      <h1 className="text-xl font-bold text-oli-dark mb-1">{p.nome}</h1>
      <p className="text-sm text-oli-gray mb-6">
        Cadastrado em {new Date(p.created_at).toLocaleDateString('pt-BR')}
      </p>

      <TeamProfileForm
        userId={p.id}
        nome={p.nome ?? ''}
        userType={p.user_type}
        especialidade={p.especialidade}
        bio={p.bio}
        fotoUrl={p.foto_url}
        instagram={p.instagram}
        linkedin={p.linkedin}
        website={p.website}
        whatsapp={p.whatsapp}
        adminNotes={p.admin_notes}
      />

      {p.user_type === 'partner' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Indicação</p>
          {p.referral_code ? (
            <p className="text-sm text-oli-dark mb-4">
              Código <span className="font-mono font-semibold">{p.referral_code}</span> — link{' '}
              <span className="font-mono text-xs text-gray-500">olihealthhub.com.br/baixar?ref={p.referral_code}</span>
            </p>
          ) : (
            <form action={ensurePartnerReferralCode} className="mb-4">
              <input type="hidden" name="partner_id" value={p.id} />
              <p className="text-sm text-gray-500 mb-2">Este parceiro ainda não tem código de indicação.</p>
              <button type="submit" className="text-xs text-oli-green font-semibold underline">Gerar código agora</button>
            </form>
          )}

          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Comissão de indicação</p>
          <form action={updatePartnerCommissionConfig} className="grid grid-cols-2 gap-4">
            <input type="hidden" name="partner_id" value={p.id} />
            <label className="flex items-center gap-2 text-sm text-gray-700 col-span-2">
              <input type="checkbox" name="comissiona" value="true" defaultChecked={commissionConfig?.comissiona ?? true} />
              Este parceiro recebe comissão (desmarque se ele só traz leads, sem comissionamento)
            </label>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">1ª hora no START (%)</label>
              <input name="primeira_hora_pct" type="number" step="1" min="0" max="100" defaultValue={commissionConfig?.primeira_hora_pct ?? 100} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Carência plano mensal (dias)</label>
              <input name="carencia_dias_mensal" type="number" step="1" min="0" defaultValue={commissionConfig?.carencia_dias_mensal ?? 60} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">BASE anual (R$)</label>
              <input name="valor_base_anual" type="number" step="0.01" min="0" defaultValue={commissionConfig?.valor_base_anual ?? 359} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">PRO anual (R$)</label>
              <input name="valor_pro_anual" type="number" step="0.01" min="0" defaultValue={commissionConfig?.valor_pro_anual ?? 719} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">BASE mensal (R$)</label>
              <input name="valor_base_mensal" type="number" step="0.01" min="0" defaultValue={commissionConfig?.valor_base_mensal ?? 179} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">PRO mensal (R$)</label>
              <input name="valor_pro_mensal" type="number" step="0.01" min="0" defaultValue={commissionConfig?.valor_pro_mensal ?? 359} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <button type="submit" className="bg-oli-green text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition">
                Salvar comissão
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-red-50 rounded-2xl border border-red-200 p-5 mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Zona de perigo</p>
        <p className="text-sm font-bold text-red-800 mb-1">Apagar permanentemente</p>
        <p className="text-[12px] text-red-700 mb-4 leading-relaxed">
          Remove o perfil inteiro do banco de dados. Irreversível.
        </p>
        <DeleteTeamProfileButton userId={p.id} nome={p.nome ?? ''} />
      </div>
    </div>
  );
}
