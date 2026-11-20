/** Rótulos e cores de lead compartilhados entre Leads e Conversas (fonte única). */

export interface RotuloCor {
  label: string;
  bg: string;
  text: string;
}

export const ORIGEM_LABEL: Record<string, string> = {
  site: 'Site',
  rd_station: 'RD Station',
  meta_ads: 'Meta Ads',
  whatsapp: 'WhatsApp',
  indicacao: 'Indicação',
  evento: 'Evento',
  outro: 'Outro',
};

/* Ordem = ordem da esteira. O `select` do formulário de Leads lê daqui, então mexer aqui
   muda a ordem na tela também. */
export const STATUS_LABEL: Record<string, RotuloCor> = {
  novo: { label: 'Novo', bg: 'bg-blue-50', text: 'text-blue-600' },
  contatado: { label: 'Contatado', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  sem_resposta: { label: 'Não consegui falar', bg: 'bg-orange-50', text: 'text-orange-700' },
  aguardando_retorno: { label: 'Aguardando retorno', bg: 'bg-amber-50', text: 'text-amber-700' },
  visita_agendada: { label: 'Visita agendada', bg: 'bg-purple-50', text: 'text-purple-600' },
  visita_realizada: { label: 'Visita realizada', bg: 'bg-indigo-50', text: 'text-indigo-600' },
  proposta_enviada: { label: 'Proposta enviada', bg: 'bg-teal-50', text: 'text-teal-700' },
  convertido: { label: 'Convertido', bg: 'bg-green-50', text: 'text-oli-green' },
  descartado: { label: 'Descartado', bg: 'bg-gray-100', text: 'text-gray-400' },
};

export const TEMPERATURA_LABEL: Record<string, RotuloCor> = {
  quente: { label: '🔥 Quente', bg: 'bg-red-50', text: 'text-red-600' },
  morno: { label: 'Morno', bg: 'bg-orange-50', text: 'text-orange-600' },
  frio: { label: 'Frio', bg: 'bg-sky-50', text: 'text-sky-600' },
};
