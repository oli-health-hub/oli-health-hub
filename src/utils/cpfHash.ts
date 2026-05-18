import * as Crypto from 'expo-crypto';

// Salt fixo por app — lido do ambiente de build.
// NUNCA alterar após dados existirem em produção (quebra todas as buscas).
const SALT = process.env.CPF_HASH_SALT ?? 'oli-health-hub-cpf-salt-2026';

/**
 * Gera hash SHA-256 do CPF para armazenamento seguro.
 *
 * LGPD Art. 11: CPF é dado pessoal sensível quando ligado a saúde.
 * O hash é determinístico (mesmo CPF → mesmo hash), permitindo busca por
 * duplicatas sem armazenar o número real.
 *
 * @param cpfDigits - CPF limpo, apenas dígitos (11 caracteres)
 * @returns hash hex de 64 caracteres
 */
export async function hashCPF(cpfDigits: string): Promise<string> {
  const input = `${SALT}:${cpfDigits}`;
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

/**
 * Extrai os últimos 3 dígitos do CPF para identificação humana.
 * Exibido como "***.***.***-XX X" para confirmação sem expor o dado completo.
 */
export function cpfLastDigits(cpfDigits: string): string {
  return cpfDigits.slice(-3);
}

/**
 * Mascara o CPF para exibição: "***.***.***-XX"
 */
export function maskCPFDisplay(cpfDigits: string): string {
  if (cpfDigits.length !== 11) return '***.***.***-**';
  return `***.***.***.${cpfDigits.slice(9)}`;
}
