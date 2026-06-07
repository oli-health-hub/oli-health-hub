# Integração OLI Health Hub ↔ Communicare

> Descritivo funcional para alinhamento técnico com a equipe Communicare.
> Versão: 1.0 — junho/2026
> Contato OLI: Guilherme Pasquetti — guilherme.pasquetti@gmail.com

---

## 1. Visão geral

O OLI Health Hub é um app multiplataforma (iOS + Android) usado por médicos do
coworking médico OLI. Funcionalidades principais:

- Reserva de salas físicas + Sala Digital (telemedicina)
- Timer de sessão com cobrança por minuto + pacotes de horas
- CRM básico de pacientes (cadastro, busca, encaixe)
- Comunidade, eventos, módulos de IA, financeiro

A integração com o Communicare é **invisível ao usuário final** (médico).
A interface OLI permanece, mas todo cadastro de paciente espelha o
Communicare em tempo real. Médico vê apenas um indicador discreto de
status ("Sincronizado" ou "Sincronizando XX%"), nunca decide sobre
sincronizar ou não.

**Diretrizes acordadas:**

1. Communicare é **master** de cadastro de pacientes.
2. Quando o médico cadastra paciente pelo App, o form do OLI usa exatamente
   os mesmos campos do Communicare → evita duplicidade.
3. Dedup obrigatório por CPF antes de qualquer `POST /patient`.
4. Erro de sync **nunca é mostrado** ao médico — vira retry interno.
5. UI mostra somente: `Sincronizado` ✓ ou `Sincronizando %`.

---

## 2. Endpoints utilizados (do Swagger CC atual)

### API Integrações (`https://api-integrations-staging.communicare.com.br/api`)

| Método | Rota | Uso OLI |
|---|---|---|
| GET    | `/v1/sso/{cpf}` | Login transparente do médico (após Supabase auth) |
| GET    | `/v1/agenda/professionals` | Lista profissionais (cache local) |
| GET    | `/v1/agenda/professional-procedures?professionalId=X` | Procedimentos por médico |
| GET    | `/v1/agenda/professions-and-specialties` | Onboarding |
| GET    | `/v1/health-plans` | Dropdown de convênios estruturado |
| GET    | `/v1/history?patientId=X` | Histórico do paciente na aba de detalhes |
| POST   | `/v1/queue` | Encaixe de paciente |
| GET    | `/v1/clinics` | Identificar clínica OLI |

### API Pacientes (`https://api-patients-staging.communicare.com.br/api`)

| Método | Rota | Uso OLI |
|---|---|---|
| GET    | `/v1/patient?cpf=X` | Dedup antes de criar |
| POST   | `/v1/patient` | Criar paciente cadastrado no App |
| PUT    | `/v1/patient/{id}` | Editar paciente |
| DELETE | `/v1/patient/{id}` | Soft delete (LGPD Art. 18) |
| POST   | `/v1/patient-import/upload` | Importação Excel via admin |

### Agenda de PACIENTES (CC é master — prioridade de sincronização)

A agenda de pacientes (consultas) já existe no CC. O App precisa exibir,
em tempo real, os atendimentos do médico no dia, agrupados por status:

- **Em atendimento** — consulta em curso
- **Em espera** — paciente fez check-in, aguardando
- **Próximos** — agendados/confirmados ainda não chegaram
- **Atendidos** — concluídos no dia

| Método | Rota | Uso OLI |
|---|---|---|
| GET    | `/v1/schedule/{id}` | Detalhe de um agendamento |
| GET    | `/v1/history` | Histórico + status de atendimento (1 por filtro) |
| POST   | `/v1/queue` | Adicionar paciente à fila |
| GET    | `/v1/agenda/times` | Horários disponíveis por profissional |

> **🔴 LACUNA CRÍTICA (confirmar com Heitor):**
> O Swagger de staging **não expõe** um endpoint de **LISTA de agenda do
> dia por profissional** (com nome do paciente + horário + status), nem
> um **GET de fila** (`/v1/queue` só tem POST). Sem isso, o App não
> consegue montar as colunas "Em espera / Em atendimento / Atendidos".
>
> Precisamos de algo como:
> `GET /v1/agenda?professionalId=X&clinicId=Y&data=YYYY-MM-DD`
> retornando array de `{ scheduleId, patientId, patientName, startTime,
> procedure, status }`.
>
> O App **já está pronto** para consumir esse endpoint (ver §3.5) — basta
> Heitor confirmar a rota e o shape de resposta.

### Agenda de SALAS / Mapa de salas (STANDBY — CC ainda vai construir)

O **mapa de salas** (reservas de sala física, independente de paciente)
ainda **não existe** no Communicare. Até o CC liberar, o **OLI permanece
master** das reservas de sala. Quando CC tiver o mapa de salas:

| Necessário no CC | Uso OLI futuro |
|---|---|
| Criar/cancelar reserva de sala sem paciente | Espelhar reservas OLI ↔ CC |
| Listar ocupação de salas por horário | Evitar double-booking cruzado |
| Webhook de reserva alterada | Sync bidirecional de salas |

---

## 3. Fluxos implementados

### 3.1 Cadastro de paciente (OLI → CC)

```
[Médico no App] → AddPacienteModal
   │
   ├─ Valida CPF, telefone, nascimento
   ├─ Salva em Supabase (sync_status='pending', sync_progress=0)
   │
   ▼ async (não bloqueia UI)
[Edge Function communicare-proxy]
   │
   ├─ 20% Valida CPF
   ├─ 40% GET /v1/patient?cpf=X         ← dedup
   ├─ 70% Se não existe: POST /v1/patient
   ├─ 90% Grava patients.communicare_id
   └─ 100% sync_status='synced'
```

**Falha em qualquer etapa:**
- Job enfileirado em `communicare_sync_queue`
- Worker (`communicare-sync-worker`) reprocessa com backoff exponencial:
  30s → 2 min → 10 min → 1h → 6h (máx 5 tentativas)
- UI permanece "Sincronizando X%" até resolver

### 3.2 SSO Médico

```
[Login Supabase] → success
   │
   ▼ async paralelo (silencioso)
GET /v1/sso/{cpf} → { jwt, expiresAt, professionalId }
   │
   ├─ JWT salvo em SecureStore + profiles.communicare_jwt
   └─ Renovado automaticamente quando expira
```

Sem botão "Conectar Communicare", sem fluxo manual. JWT viaja
server-side via Edge Function nas chamadas seguintes.

### 3.3 Histórico do paciente (read-only)

Aba de detalhes do paciente chama `GET /v1/history?patientCPF=X` e
mostra atendimentos passados misturados com atendimentos OLI (não
identificados pela origem).

### 3.5 Agenda de pacientes do dia (CC → App) — IMPLEMENTADO, aguarda endpoint

App-side já pronto:

- `src/services/communicareAgenda.ts` — `listDaySchedule()` + `bucketize()`
- `src/hooks/useCommunicareAgenda.ts` — polling 60s + refresh ao voltar do background
- `src/components/CommunicareAgendaCard.tsx` — card no dashboard com 4 colunas
- Mapeamento de status: `AttendanceHistoricalItemDto.status` → normalizado
  (`em_atendimento | em_espera | proximo | atendido | cancelado`)

```
[Dashboard do médico]
   │ a cada 60s + ao abrir
   ▼
GET /v1/agenda?professionalId=X&data=YYYY-MM-DD   ← AGUARDA Heitor confirmar rota
   │
   ▼ array de agendamentos com status
[Card "Agenda de Pacientes"]
   ├─ Em atendimento  (verde)
   ├─ Em espera       (dourado)
   ├─ Próximos        (cinza escuro)
   └─ Atendidos       (cinza)
```

Enquanto o endpoint de lista não existir, `listDaySchedule()` retorna `[]`
e o card mostra "Nenhum atendimento agendado" — sem quebrar nada.
Quando Heitor confirmar a rota: ajustar `AGENDA_LIST_PATH` + o parser de
status, e a agenda passa a popular automaticamente.

### 3.4 Convênios estruturados

`GET /v1/health-plans` cacheado a cada 24h. Dropdown no
AddPacienteModal usa essa lista — substitui o campo texto livre atual.

---

## 4. Schema do paciente alinhado

Form do OLI mapeia para `PatientAgendaDto` do CC:

| OLI                  | CC (`PatientAgendaDto`) | Obrigatório |
|---|---|---|
| `nome`               | `name`                  | ✓ |
| `cpf` (cleartext)    | `cpf`                   | ✓ |
| `telefone`           | `phone`                 | ✓ |
| `dataNascimento`     | `birthDate` (YYYY-MM-DD)| ✓ |
| `email`              | `email`                 | opcional |
| `convenioTipo+nome`  | `healthPlanId`          | opcional |
| —                    | `gender`                | opcional |
| —                    | `address`               | opcional |

**Atenção LGPD:**
- CPF cleartext **só trafega via HTTPS** para o CC (na chamada inicial).
- No Supabase OLI persistimos **apenas o hash SHA-256** (Art. 11 da LGPD).
- Edge Function não loga CPF.

---

## 5. Webhooks (pendente)

**Único webhook listado no Swagger CC atual:**
- `form_response`

**Webhooks desejados pelo OLI** (perguntas pra Heitor):

1. `patient.updated` — quando paciente editado no CC pela secretária
2. `patient.deleted`
3. `schedule.created`, `schedule.updated`, `schedule.cancelled` — para
   quando a API de agenda CC ficar pronta
4. `appointment.finalized` — confirmação de que atendimento terminou
   (Heitor mencionou na reunião; não está no Swagger)

Enquanto não existem, OLI faz polling a cada 5 min em `GET /v1/history`.

---

## 6. Arquitetura técnica

```
┌──────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  App OLI (RN)    │────▶│ Supabase Edge Funcs  │────▶│  Communicare    │
│                  │ JWT │ communicare-proxy    │ API │  APIs           │
│  - patientStore  │  ◀──│ communicare-sync-    │ key │                 │
│  - communicareApi│     │ worker (cron 5min)   │     │                 │
└──────────────────┘     └──────────────────────┘     └─────────────────┘
        │                          │                           ▲
        │                          │ x-sso-api-key             │
        ▼                          │ Bearer JWT CC             │
┌──────────────────┐               └───────────────────────────┘
│ Supabase DB      │
│ - patients       │
│ - profiles       │
│ - reservations   │
│ - communicare_   │
│   sync_queue     │
└──────────────────┘
```

**Por que Edge Function como proxy?**
1. `x-sso-api-key` nunca chega ao cliente
2. Possibilita refresh de JWT centralizado
3. Logs de auditoria centralizados
4. Permite circuit breaker se CC ficar fora

---

## 7. Tabelas Supabase relevantes

```sql
-- Acrescentadas em 20260601_communicare_sync.sql

patients:
  + sync_status            'synced' | 'pending'
  + sync_progress          int 0-100
  + sync_attempt_count     int
  + synced_at              timestamptz
  + last_sync_error        text (interno)
  + communicare_id         text

profiles:
  + communicare_id         text
  + communicare_jwt        text
  + communicare_jwt_exp    timestamptz

reservations:
  + communicare_schedule_id text
  + sync_status            'synced' | 'pending'

communicare_sync_queue (nova):
  - id, entity_type, entity_id, action
  - payload, attempt_count, next_attempt_at
  - last_error, created_at, processed_at
```

---

## 8. Configuração necessária (ambiente)

**Para ativar a integração** basta configurar as variáveis abaixo no
Supabase Edge Function environment:

```env
CC_BASE_URL=https://api-integrations-staging.communicare.com.br/api
CC_PATIENTS_BASE_URL=https://api-patients-staging.communicare.com.br/api
CC_API_KEY=<x-sso-api-key fornecido pela Communicare>
```

E no app (`.env.production`):
```env
EXPO_PUBLIC_COMMUNICARE_PROXY_URL=https://<projeto>.supabase.co/functions/v1/communicare-proxy
```

Edge functions a fazer deploy:
```bash
supabase functions deploy communicare-proxy
supabase functions deploy communicare-sync-worker
supabase functions deploy communicare-webhook
supabase functions deploy communicare-migrate-patients
```

Sem essas variáveis, app continua funcionando 100% — apenas não sincroniza
(badges de sync ocultos, dropdown de convênio cai pra texto livre, agenda
de pacientes não aparece). Quando configurar, sync passa a rodar
automaticamente para todos os pacientes existentes (status = pending).

---

## 9. Perguntas em aberto pra Heitor

### 🔴 Bloqueadores (impedem a funcionalidade principal)

1. **Endpoint de LISTA de agenda do dia por profissional** — existe?
   Precisamos de `GET /v1/agenda?professionalId=X&clinicId=Y&data=YYYY-MM-DD`
   retornando array com `{ scheduleId, patientId, patientName, startTime,
   procedure, status }`. **Sem isso não há "Em espera / Em atendimento /
   Atendidos".**
2. **GET de fila** (`/v1/queue` só tem POST no Swagger). Como o App lê os
   pacientes aguardando?
3. **Valores reais do campo `status`** em `AttendanceHistoricalItemDto`
   e `action` em `AgendaHistoricalItemDto` — quais strings exatas? (ex:
   "aguardando", "em atendimento", "atendido"...)
4. **Webhook de mudança de status do atendimento** (check-in, início, fim).
   Hoje só existe `form_response`. Sem webhook, fazemos polling a cada 60s.
5. **Token `x-sso-api-key`** — staging + produção, quando enviar?

### 🟡 Importantes

6. **Endpoint SSO**: confirmar shape da resposta — `{ jwt, expiresAt, professionalId }`?
7. **`clinicId` da OLI**: valor fixo? (o App precisa passar em várias chamadas)
8. **Importação Excel**: paciente importado fica `synced` imediato ou async?
9. **Soft delete vs hard delete** em `DELETE /v1/patient/{id}`?
10. **Rate limits** das APIs (req/seg)?
11. **Como mapear convênio "particular"** no `healthPlanName`?

### 🟢 Futuro (mapa de salas)

12. **Mapa de salas** — prazo de release? OLI é master até lá.
13. **Reserva de sala sem paciente** — haverá endpoint?
14. **Webhook de reserva de sala alterada** — para sync bidirecional.

---

## 10. Roadmap de ativação

| Fase | Conteúdo | Status |
|---|---|---|
| 1 | Sync paciente create + dedup (externalId) | ✅ Pronto |
| 2 | SSO médico | ✅ Pronto |
| 3 | Agenda de pacientes do dia no dashboard | ✅ App pronto — **aguarda endpoint de LISTA** |
| 4 | Convênios estruturados (dropdown `/health-plans`) | ✅ Pronto |
| 5 | Histórico read-only (aba PacienteDetail) | ✅ Pronto |
| 6 | Edit/delete sync paciente | ✅ Pronto |
| 7 | Retry automático de pendentes | ✅ Pronto |
| 8 | Webhook receiver (`form_response` + futuros) | ✅ Pronto |
| 9 | Worker cron (create/update/delete + retry) | ✅ Pronto |
| 10 | Job migração pacientes existentes | ✅ Pronto (edge function, dispara via admin/curl) |
| 11 | **Simulador CC (mock)** — testar tudo sem token | ✅ Pronto |
| 12 | Webhook de status de atendimento | 🔒 Depende de CC criar webhook (hoje polling 60s) |
| 13 | Mapa de salas (reservas ↔ CC) | 🔒 Standby — CC ainda vai construir |

### Como testar AGORA sem token (simulador)

```bash
# app: ativar mock
echo "EXPO_PUBLIC_COMMUNICARE_MOCK=true" >> .env

# Roda o app — agenda de pacientes popula com fixtures,
# cadastro de paciente "sincroniza", convênios aparecem no dropdown,
# histórico carrega. Tudo in-memory, sem rede.
```

### Disparar migração de pacientes existentes (quando token chegar)

```bash
curl -X POST https://<proj>.supabase.co/functions/v1/communicare-migrate-patients \
  -H "Authorization: Bearer <jwt_admin>"
# Repetir até remaining=0 (processa lotes de 50)
```

**Pronto = código mergeado, testado, basta setar env vars.**

---

## 11. Garantias técnicas

- **Offline-first**: OLI sempre funciona; sync é eventual consistency
- **Idempotência**: dedup por CPF em toda operação
- **Sem PII em logs**: Sentry filtra CPF, JWT, sync errors
- **Retry exponencial automático**
- **Audit interno** em `audit_logs` por LGPD Art. 37
- **Token CC nunca no cliente** (server-side only via proxy)
- **JWT médico expira** + renovação automática

---

Última atualização: 01/06/2026
