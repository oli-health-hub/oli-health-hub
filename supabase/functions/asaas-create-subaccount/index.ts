/**
 * Edge Function: asaas-create-subaccount
 *
 * Cria a subconta Asaas de um médico (onboarding, chamado pelo admin) —
 * cobrança de paciente cai direto nela, nunca na conta master da OLI. Usa a
 * ASAAS_API_KEY master só para a CRIAÇÃO da subconta; a chave própria da
 * subconta (retornada pela Asaas) é o que create-patient-charge usa depois.
 *
 * ⚠️ NÃO DEPLOYADA — depende de confirmação com o comercial da Asaas sobre
 * qual produto de subconta está disponível pra essa conta (self-service via
 * API "Contas Automáticas" vs. onboarding assistido). O endpoint abaixo é o
 * documentado publicamente (`POST /v3/accounts`), mas pode não estar
 * habilitado até essa confirmação — ver "Decisões ainda em aberto" no plano
 * da sessão de 19/ago (docs/HANDOFF.md).
 *
 * Body: { professionalId, tipoPessoa, cpfCnpj, nomeCompleto, email, telefone, endereco? }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { asaasBase, asaasHeaders } from '../_shared/asaas.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  let body: {
    professionalId: string;
    tipoPessoa:     'pf' | 'pj';
    cpfCnpj:        string;
    nomeCompleto:   string;
    email:          string;
    telefone:       string;
    endereco?:      Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (!body.professionalId || !body.cpfCnpj || !body.nomeCompleto || !body.email) {
    return json({ error: 'professionalId, cpfCnpj, nomeCompleto e email são obrigatórios' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Documentação Asaas: POST /v3/accounts abre subconta vinculada à conta
  // master. companyType só se aplica a PJ; birthDate pode ser exigido pra PF
  // — ajustar assim que testado em sandbox contra a conta real.
  const asaasRes = await fetch(`${asaasBase()}/accounts`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify({
      name:        body.nomeCompleto,
      email:       body.email,
      cpfCnpj:     body.cpfCnpj.replace(/\D/g, ''),
      mobilePhone: body.telefone?.replace(/\D/g, ''),
      companyType: body.tipoPessoa === 'pj' ? 'LIMITED' : undefined,
    }),
  });
  const asaasData = await asaasRes.json();

  if (!asaasRes.ok || !asaasData.id) {
    return json({ error: `Asaas recusou a criação da subconta: ${JSON.stringify(asaasData)}` }, 502);
  }

  const { error } = await supabase.from('professional_asaas_accounts').upsert({
    professional_id:     body.professionalId,
    tipo_pessoa:          body.tipoPessoa,
    nome_completo:        body.nomeCompleto,
    email:                body.email,
    telefone:             body.telefone,
    endereco:             body.endereco ?? null,
    asaas_account_id:     asaasData.id,
    asaas_wallet_id:      asaasData.walletId ?? null,
    asaas_api_key_plain:  asaasData.apiKey ?? null, // trigger criptografa e zera este campo
    status:               'aguardando_aprovacao',
    submitted_at:         new Date().toISOString(),
  }, { onConflict: 'professional_id' });

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, asaasAccountId: asaasData.id });
});
