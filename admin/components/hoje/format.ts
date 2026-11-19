const SP = 'America/Sao_Paulo';

export function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP });
}

export function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: SP });
}

export function fmtDiaHora(iso: string): string {
  return `${fmtDia(iso)} às ${fmtHora(iso)}`;
}

export function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

/** "Quinta-feira, 19 de novembro" no fuso de São Paulo. */
export function fmtDiaPorExtenso(date: Date): string {
  const texto = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: SP });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
