/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function allSameDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function cpfCheckDigit(base: string, factor: number): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

function cnpjCheckDigit(base: string): number {
  const weights = base.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < base.length; i++) sum += Number(base[i]) * weights[i];
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** CPF (11 dígitos) ou CNPJ (14 dígitos) com dígitos verificadores corretos. */
export function isValidCpfCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (allSameDigit(d)) return false;

  if (d.length === 11) {
    return cpfCheckDigit(d.slice(0, 9), 10) === Number(d[9])
      && cpfCheckDigit(d.slice(0, 10), 11) === Number(d[10]);
  }
  if (d.length === 14) {
    return cnpjCheckDigit(d.slice(0, 12)) === Number(d[12])
      && cnpjCheckDigit(d.slice(0, 13)) === Number(d[13]);
  }
  return false;
}
