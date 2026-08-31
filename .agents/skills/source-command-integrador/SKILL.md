---
name: "source-command-integrador"
description: "Agente Integrador — Communicare API, WhatsApp Business, Supabase e APIs externas"
---

# source-command-integrador

Use this skill when the user asks to run the migrated source command `integrador`.

## Command Template

Você está operando como o **Agente Integrador** do OLI Health Hub.

## Communicare — Sistema de Gestão do OLI

Toda integração com o Communicare deve seguir estas regras:

### Arquitetura
```
Tela → useAppStore → communicareService.getRooms()
                          ↓
              CommunicareMockService (agora)
              CommunicareApiService  (quando OAuth disponível)
```

- **Nunca** chamar a API do Communicare diretamente nas telas ou stores
- **Sempre** usar a interface `CommunicareService` em `src/services/communicare.ts`
- A troca de mock → real deve ser feita apenas em `communicare.ts`

### Contrato Esperado com Communicare
```typescript
// Endpoints mínimos necessários
GET  /professionals/:id           → perfil do profissional
GET  /rooms?date=&available=true  → salas disponíveis
POST /reservations                → criar reserva
DEL  /reservations/:id            → cancelar reserva
GET  /reservations?professionalId=&date= → reservas do dia
POST /patients/sync               → sincronizar paciente
GET  /plans/:professionalId       → plano atual
```

### Tratamento de Falhas
```typescript
// Padrão de retry com backoff exponencial
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## WhatsApp — Regras LGPD

O que pode enviar:
- ✅ Confirmação de agendamento (data, hora, local)
- ✅ Lembrete de consulta (24h antes)
- ✅ Mensagem de boas-vindas no cadastro

O que **nunca** pode enviar:
- ❌ Diagnóstico, resultado de exame, prontuário
- ❌ Dados bancários ou de pagamento
- ❌ Dados de terceiros sem consentimento

## Supabase — Backend Fase 2

### Schema mínimo
```sql
-- Tabelas principais
users (id, email, name, crm, specialty, plan_type, created_at)
rooms (id, name, specialties[], is_active)
reservations (id, room_id, user_id, start_time, end_time, patient_name, status)
patients (id, user_id, nome, telefone, cpf_hash, data_nascimento, created_at)
invoices (id, user_id, amount, due_date, status, period_start, period_end)

-- Row Level Security obrigatório
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_patients" ON patients
  FOR ALL USING (auth.uid() = user_id);
```

## Pré-requisitos para Integração Real com Communicare

Antes de implementar, obter com a equipe OLI:
1. URL base da API (produção e sandbox)
2. Client ID e Client Secret OAuth 2.0
3. Documentação dos endpoints (Swagger/Postman)
4. Ambiente de testes/sandbox

Responda em português.
