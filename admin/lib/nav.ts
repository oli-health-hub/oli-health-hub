/**
 * Navegação do Admin: 6 itens no menu e as abas de cada grupo.
 * Sem imports (testado com `node --test`); ícones ficam no Sidebar.
 */

export interface TabDef {
  href: string;
  label: string;
  /** Quando true, a aba só fica ativa na rota exata (a aba "base" do grupo). */
  exact?: boolean;
}

export const MAIN_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/', label: 'Hoje' },
  { href: '/reservas', label: 'Reservas' },
  { href: '/medicos', label: 'Profissionais' },
  { href: '/comercial', label: 'Comercial' },
  { href: '/financeiro', label: 'Financeiro' },
  { href: '/configuracoes', label: 'Configurações' },
];

export type GroupKey = 'reservas' | 'medicos' | 'comercial' | 'financeiro' | 'configuracoes';

export const GROUP_TABS: Record<GroupKey, TabDef[]> = {
  reservas: [
    { href: '/reservas', label: 'Mapa das salas', exact: true },
    { href: '/reservas/historico', label: 'Histórico' },
    { href: '/reservas/minutagem', label: 'Minutagem' },
  ],
  medicos: [
    { href: '/medicos', label: 'Profissionais', exact: true },
    { href: '/medicos/horas', label: 'Horas' },
    { href: '/medicos/assinaturas', label: 'Assinaturas' },
    { href: '/medicos/modulos', label: 'Módulos contratados' },
    { href: '/medicos/excluidos', label: 'Excluídas' },
  ],
  comercial: [
    { href: '/comercial', label: 'Leads', exact: true },
    { href: '/comercial/conversas', label: 'Conversas' },
    { href: '/comercial/cupons', label: 'Cupons' },
    { href: '/comercial/promocoes', label: 'Promoções' },
  ],
  financeiro: [
    { href: '/financeiro', label: 'Resumo', exact: true },
    { href: '/financeiro/recebimentos', label: 'Recebimentos' },
    { href: '/financeiro/contas', label: 'Contas' },
    { href: '/financeiro/fluxo', label: 'Fluxo de caixa' },
    { href: '/financeiro/fornecedores', label: 'Fornecedores' },
  ],
  configuracoes: [
    { href: '/configuracoes', label: 'Catálogo', exact: true },
    { href: '/configuracoes/usuarios', label: 'Usuários' },
    { href: '/configuracoes/equipe', label: 'Equipe' },
    { href: '/configuracoes/parceiros', label: 'Parceiros' },
    { href: '/configuracoes/notificacoes', label: 'Notificações' },
    { href: '/configuracoes/comunidade', label: 'Comunidade' },
    { href: '/configuracoes/totem', label: 'Totem QR' },
  ],
};

/** "Meu Recebimento": aba extra, só para o fundador. */
export const FOUNDER_TAB: TabDef = { href: '/configuracoes/meu-recebimento', label: 'Meu Recebimento' };

/** `/` só casa com `/`; os demais casam por segmento (`/medicos` ativa em `/medicos/abc`, não em `/medicosx`). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
