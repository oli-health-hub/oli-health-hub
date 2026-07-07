// Formatadores criados uma única vez (DateTimeFormat é caro) — reutilizados em toda a app

const hourFormatter   = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFormatter   = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** "14:30" */
export function formatHour(value: Date | string): string {
  return hourFormatter.format(toDate(value));
}

/** "07/05/2026" */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(toDate(value));
}

/** "R$ 1.240,00" */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** "01:23:45" ou "23:45" se menos de 1 hora */
export function formatElapsedTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** "14:30" — tempo restante no formato MM:SS */
export function formatRemainingTime(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** "agora" / "há 5min" / "há 3h" / "há 2d" / "07/05" — tempo relativo curto pro feed */
export function timeAgo(value: Date | string): string {
  const diffMs = Date.now() - toDate(value).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD}d`;
  return formatDate(value);
}
