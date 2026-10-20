/**
 * Utilitários compartilhados para integração com a API Asaas.
 * Usado pelas Edge Functions create-charge, create-subscription e asaas-webhook.
 */

export function asaasBase(): string {
  return Deno.env.get('ASAAS_ENV') === 'production'
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

export function asaasHeaders(): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'access_token':  Deno.env.get('ASAAS_API_KEY')!,
    'User-Agent':    'OLIHealthHub/1.0',
  };
}

/**
 * Retorna o ID do cliente Asaas para o profissional.
 * Busca por externalReference (professionalId) antes de criar.
 * cpfCnpj é opcional — obrigatório em produção para PIX/boleto.
 */
export async function findOrCreateCustomer(
  professionalId: string,
  name:           string,
  email:          string,
  cpfCnpj?:       string,
): Promise<string> {
  const base    = asaasBase();
  const headers = asaasHeaders();

  // Tenta encontrar cliente existente pelo externalReference
  const searchRes  = await fetch(`${base}/customers?externalReference=${professionalId}&limit=1`, { headers });
  const searchData = await searchRes.json();
  if (searchData.data?.length > 0) {
    const existing = searchData.data[0] as { id: string; cpfCnpj?: string | null };
    // Cliente criado numa tentativa anterior sem CPF/CNPJ: Asaas recusa a
    // cobrança até o documento ser preenchido, então completa o cadastro.
    if (!existing.cpfCnpj && cpfCnpj) {
      const updateRes = await fetch(`${base}/customers/${existing.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ cpfCnpj }),
      });
      const updated = await updateRes.json();
      if (!updated.id) {
        throw new Error(`Asaas: falha ao atualizar cliente — ${JSON.stringify(updated)}`);
      }
    }
    return existing.id;
  }

  // Cria novo cliente
  const body: Record<string, string> = { name, email, externalReference: professionalId };
  if (cpfCnpj) body.cpfCnpj = cpfCnpj;

  const createRes = await fetch(`${base}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const customer = await createRes.json();
  if (!customer.id) {
    throw new Error(`Asaas: falha ao criar cliente — ${JSON.stringify(customer)}`);
  }
  return customer.id as string;
}

/**
 * Busca o QR Code PIX de um pagamento Asaas.
 * Retorna null se não disponível (boleto, cartão, etc.).
 */
export async function getPixQrCode(
  paymentId: string,
): Promise<{ pixQrCode: string; pixCopiaECola: string } | null> {
  const res  = await fetch(`${asaasBase()}/payments/${paymentId}/pixQrCode`, { headers: asaasHeaders() });
  const data = await res.json();
  if (!data.encodedImage) return null;
  return { pixQrCode: data.encodedImage as string, pixCopiaECola: data.payload as string };
}
