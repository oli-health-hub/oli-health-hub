/** Quem vê "Meu Recebimento". Regra única, usada no menu, nas abas e na página. */
export const FOUNDER_EMAIL = 'guilherme.pasquetti@gmail.com';

export function isFounder(email: string | null | undefined): boolean {
  return email === FOUNDER_EMAIL;
}
