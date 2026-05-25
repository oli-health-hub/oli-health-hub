'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = getSupabaseBrowser();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError('E-mail ou senha incorretos.');
      setLoading(false);
      return;
    }

    // Verifica se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', data.user.id)
      .single();

    if (profile?.user_type !== 'admin') {
      await supabase.auth.signOut();
      setError('Acesso não autorizado para este painel.');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-oli-green flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
            OLI
          </div>
          <h1 className="text-2xl font-bold text-oli-dark">OLI Health Hub</h1>
          <p className="text-sm text-oli-gray mt-1">Painel Administrativo</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-oli-border p-6">
          <h2 className="text-lg font-bold text-oli-dark mb-5">Entrar</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-semibold text-oli-lgray uppercase tracking-wide block mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@olihealthhub.com.br"
                required
                className="w-full border border-oli-border rounded-xl px-4 py-3 text-sm text-oli-dark focus:outline-none focus:ring-2 focus:ring-oli-green/30 focus:border-oli-green transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-oli-lgray uppercase tracking-wide block mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
              disabled={loading}
              className="bg-oli-green text-white font-bold py-3 rounded-xl mt-1 hover:bg-oli-green-dk transition-colors disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-oli-lgray mt-6">
          Acesso restrito ao time OLI
        </p>
      </div>
    </div>
  );
}
