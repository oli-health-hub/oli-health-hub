'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-client';

export default function DefinirSenhaPage() {
  const [status,   setStatus]   = useState<'loading' | 'ready' | 'invalid' | 'role' | 'done'>('loading');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [isHealthProfessional, setIsHealthProfessional] = useState<boolean | null>(null);

  // O link de convite/reset chega com os tokens no fragmento (#) da URL —
  // extrai manualmente e abre a sessão antes de permitir definir a senha.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setStatus('invalid');
      return;
    }

    getSupabaseBrowser().auth.setSession({
      access_token:  accessToken,
      refresh_token: refreshToken,
    }).then(({ error: sessionError }) => {
      setStatus(sessionError ? 'invalid' : 'ready');
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha precisa ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await getSupabaseBrowser().auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError('Não foi possível salvar a senha. Tente novamente.');
      return;
    }

    setStatus('role');
  }

  async function handleRoleSubmit() {
    if (isHealthProfessional === null) return;
    setSaving(true);

    // Só agora o convite é considerado aceito — profile e subscription são
    // criados aqui, não no envio do convite (evita "usuário fantasma" na base).
    // Se for profissional de saúde, entra direto na base clínica; senão fica
    // pendente em Usuários até alguém classificar.
    const { error: acceptError } = await getSupabaseBrowser().rpc('accept_invite', {
      p_is_health_professional: isHealthProfessional,
    });
    setSaving(false);

    if (acceptError) {
      setError('Houve um erro ao ativar sua conta. Avise quem te convidou.');
      return;
    }
    setStatus('done');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-oli-green flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
            OLI
          </div>
          <h1 className="text-2xl font-bold text-oli-dark">OLI Health Hub</h1>
          <p className="text-sm text-oli-gray mt-1">Painel Administrativo</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-oli-border p-6">
          {status === 'loading' && (
            <p className="text-sm text-oli-gray text-center py-4">Validando convite...</p>
          )}

          {status === 'invalid' && (
            <div className="text-center py-2">
              <h2 className="text-lg font-bold text-oli-dark mb-2">Link inválido ou expirado</h2>
              <p className="text-sm text-oli-gray">
                Peça pra quem te convidou enviar um novo convite pelo painel.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <h2 className="text-lg font-bold text-oli-dark mb-5">Criar sua senha</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-oli-lgray uppercase tracking-wide block mb-1.5">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    className="w-full border border-oli-border rounded-xl px-4 py-3 text-sm text-oli-dark focus:outline-none focus:ring-2 focus:ring-oli-green/30 focus:border-oli-green transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-oli-lgray uppercase tracking-wide block mb-1.5">
                    Confirmar senha
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full border border-oli-border rounded-xl px-4 py-3 text-sm text-oli-dark focus:outline-none focus:ring-2 focus:ring-oli-green/30 focus:border-oli-green transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-sm text-oli-red bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-oli-green text-white font-bold py-3 rounded-xl mt-1 hover:bg-oli-green-dk transition-colors disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Salvar senha'}
                </button>
              </form>
            </>
          )}

          {status === 'role' && (
            <>
              <h2 className="text-lg font-bold text-oli-dark mb-2">Só mais uma coisa</h2>
              <p className="text-sm text-oli-gray mb-5">Você é um profissional de saúde (atende pacientes)?</p>

              <div className="flex flex-col gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setIsHealthProfessional(true)}
                  className={`text-left border rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isHealthProfessional === true
                      ? 'border-oli-green bg-oli-green/5 text-oli-dark'
                      : 'border-oli-border text-oli-gray hover:border-oli-green/40'
                  }`}
                >
                  Sim, sou profissional de saúde
                </button>
                <button
                  type="button"
                  onClick={() => setIsHealthProfessional(false)}
                  className={`text-left border rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isHealthProfessional === false
                      ? 'border-oli-green bg-oli-green/5 text-oli-dark'
                      : 'border-oli-border text-oli-gray hover:border-oli-green/40'
                  }`}
                >
                  Não, sou da equipe/admin
                </button>
              </div>

              {error && (
                <p className="text-sm text-oli-red bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
              )}

              <button
                type="button"
                onClick={handleRoleSubmit}
                disabled={saving || isHealthProfessional === null}
                className="w-full bg-oli-green text-white font-bold py-3 rounded-xl hover:bg-oli-green-dk transition-colors disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Concluir'}
              </button>
            </>
          )}

          {status === 'done' && (
            <div className="text-center py-2">
              <h2 className="text-lg font-bold text-oli-dark mb-2">Senha criada!</h2>
              <p className="text-sm text-oli-gray">
                Peça pra quem te convidou liberar seu acesso ao painel. Depois disso, é só entrar com seu e-mail e a senha que você acabou de criar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
