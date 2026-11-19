/**
 * Endereços antigos do Admin → endereços novos (reorganização de 19/11/2026).
 * Usado por `next.config.mjs` e pelo teste de redirects. Mantém links salvos funcionando.
 * `/` e `/financeiro` não aparecem: não mudaram de endereço. `/fila` entra na Task 9.
 *
 * @type {ReadonlyArray<{ source: string; destination: string }>}
 */
export const LEGACY_REDIRECTS = [
  // Reservas
  { source: '/salas', destination: '/reservas' },
  { source: '/historico', destination: '/reservas/historico' },
  { source: '/pagamentos', destination: '/reservas/minutagem' },
  // Profissionais
  { source: '/horas', destination: '/medicos/horas' },
  { source: '/planos', destination: '/medicos/assinaturas' },
  { source: '/modulos', destination: '/medicos/modulos' },
  // Comercial
  { source: '/leads', destination: '/comercial' },
  { source: '/conversas', destination: '/comercial/conversas' },
  { source: '/cupons', destination: '/comercial/cupons' },
  { source: '/promocoes', destination: '/comercial/promocoes' },
  // Financeiro
  { source: '/recebimentos', destination: '/financeiro/recebimentos' },
  { source: '/contas', destination: '/financeiro/contas' },
  { source: '/fluxo-de-caixa', destination: '/financeiro/fluxo' },
  { source: '/fornecedores', destination: '/financeiro/fornecedores' },
  // Configurações
  { source: '/catalogo', destination: '/configuracoes' },
  { source: '/usuarios', destination: '/configuracoes/usuarios' },
  { source: '/equipe', destination: '/configuracoes/equipe' },
  { source: '/equipe/:path*', destination: '/configuracoes/equipe/:path*' },
  { source: '/parceiros', destination: '/configuracoes/parceiros' },
  { source: '/notificacoes', destination: '/configuracoes/notificacoes' },
  { source: '/comunidade', destination: '/configuracoes/comunidade' },
  { source: '/totem', destination: '/configuracoes/totem' },
  { source: '/meu-recebimento', destination: '/configuracoes/meu-recebimento' },
];
