import { StyleSheet } from 'react-native';

// ─── Paleta OLI — única fonte de verdade de cores ────────────────────────────
export const colors = {
  oliGreen:     '#5F7D67',
  oliGold:      '#B8893C',
  oliBackground:'#F4EFEA',
  oliDarkGray:  '#2F2F2F',
  oliLightGray: '#6B6B6B',
  oliRed:       '#D9534F',
  // Soluções OLI
  oliNavy:      '#1E3A6E',  // OLI Jurídico — Azul Navy
  oliCyan:      '#0891B2',  // OLI Contábil — Azul Cyan
  oliMint:      '#3DAA7A',  // OLI Crescimento — Verde Menta
  oliCoral:     '#C0714A',  // OLI Convênios — Terracota (AR Soluções)
  oliPurple:    '#7B6EA8',  // OLI Carreira — Roxo suave (AR Soluções)
  white:        '#FFFFFF',
  black:        '#000000',
  gray:         '#9E9E9E',
  border:       '#E5E5E5',
} as const;

// ─── Tipografia ───────────────────────────────────────────────────────────────
export const typography = {
  title1:   { fontSize: 28, fontWeight: '700' as const },
  title2:   { fontSize: 22, fontWeight: '600' as const },
  headline: { fontSize: 18, fontWeight: '600' as const },
  body:     { fontSize: 16, fontWeight: '400' as const },
  caption:  { fontSize: 14, fontWeight: '400' as const },
  small:    { fontSize: 12, fontWeight: '500' as const },
} as const;

// ─── Espaçamento ─────────────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// ─── Raio de borda ────────────────────────────────────────────────────────────
export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 9999,
} as const;

// ─── Opacidades em hex (para usar como sufixo de cor: `${color}${alpha.x10}`) ─
export const alpha = {
  x05: '0D',  // 5%
  x10: '1A',  // 10%
  x15: '26',  // 15%
  x20: '33',  // 20%
  x30: '4D',  // 30%
  x50: '80',  // 50%
  x70: 'B3',  // 70%
  x80: 'CC',  // 80%
  x87: 'DE',  // 87%
} as const;

// ─── Sombras (iOS shadow + Android elevation juntos) ─────────────────────────
export const shadows = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
});
