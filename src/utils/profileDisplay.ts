import type { Profile } from '../services/auth';

export function getInitials(nome: string): string {
  const parts = nome.trim().split(' ').filter(w => w.length > 1);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

/** Nome com tratamento (Dr./Dra.) — não duplica se o nome já começar com Dr/Dra. */
export function displayName(nome: string, tratamento: string | null): string {
  const nomeJaTemTratamento = /^\s*dra?\.?\s/i.test(nome ?? '');
  return tratamento && !nomeJaTemTratamento ? `${tratamento} ${nome}` : nome;
}

export function displayNameFromProfile(profile: Profile): string {
  return displayName(profile.nome, profile.tratamento);
}

const AVATAR_COLORS = [
  '#5F7D67', '#B8893C', '#6B8CAE', '#8C6BAE', '#AE6B6B',
  '#6BAE8C', '#AE8C6B', '#6B6BAE', '#8CAE6B', '#AE6B8C',
];

export function avatarColor(nome: string): string {
  let hash = 0;
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
