# OLI Health Hub — Documentação do Projeto

## Visão Geral
App multiplataforma (iOS + Android) para médicos que utilizam o OLI Health Hub.
Permite gerenciar reservas de salas, pacientes, finanças e acesso ao ecossistema OLI.
Desenvolvido com React Native + Expo para publicação simultânea na App Store e Google Play.

## Stack Tecnológica
| Camada | Tecnologia | Notas |
|--------|-----------|-------|
| UI | React Native + Expo SDK 54 | Cross-platform iOS + Android |
| Linguagem | TypeScript | Sem `any` — tipagem estrita |
| Navegação | Expo Router v4 | File-based routing |
| Estado Global | Zustand 5 | `appStore`, `authStore`, `patientStore` |
| Persistência Local | AsyncStorage + Expo SecureStore | Dados sensíveis criptografados pelo SO |
| Backend | Supabase | PostgreSQL + Auth + RLS + Edge Functions |
| IA | Claude API (Haiku) | Via Supabase Edge Function `chat` |
| Eventos | Luma | Integração real em produção |
| Crash Reporting | Sentry | Sem PII nos eventos |
| Build/Deploy | Expo EAS Build + EAS Update (OTA) | Builds free tier reset em 1/junho |
| Integração futura | Communicare API (fase 3) | Mock ativo via `src/services/communicare.ts` |

## Arquitetura de Pastas
```
app/                          # Expo Router (screens — arquivo = rota)
  _layout.tsx                 # Stack root: auth gate, onboarding gate, AppLock
  login.tsx                   # Login e cadastro com rate limiting
  onboarding.tsx               # WhatsApp, especialidade, cidade/UF, tipo de atendimento, objetivo
  chatbot.tsx                 # Modal de IA com 5 personas especializadas
  perfil.tsx                  # Perfil do médico + biometria + conta
  mfa-setup.tsx               # Configuração de MFA
  mfa-verify.tsx              # Verificação de MFA
  politica-privacidade.tsx    # Política de privacidade (LGPD)
  (tabs)/
    _layout.tsx               # Tab bar inferior (5 abas)
    index.tsx                 # Dashboard: timer, reservas do dia
    agenda.tsx                # Salas, agendamento, encaixe, QR scanner
    pacientes.tsx             # CRM de pacientes (Supabase como fonte de verdade)
    ecossistema.tsx           # Plano BASE/PRO/VIP, especialistas IA, eventos Luma
    financeiro.tsx            # Faturas e pacotes de horas
    comunidade.tsx            # (placeholder — não iniciado)

src/
  theme/
    designSystem.ts           # Cores, tipografia, espaçamentos (única fonte de verdade)
  models/
    types.ts                  # Todos os tipos TypeScript do domínio
    database.types.ts         # Gerado pelo Supabase MCP — nunca editar manualmente
  store/
    appStore.ts               # Zustand: sessão ativa, salas, reservas, plano (BASE/PRO/VIP)
    authStore.ts              # Zustand: sessão Supabase, perfil do profissional
    patientStore.ts           # Zustand + AsyncStorage + Supabase (source of truth)
  hooks/
    useTimer.ts               # Timer de sessão sem drift (baseado em Date real)
    useAppLock.ts             # Bloqueio biométrico após 5 min em background
    useMFA.ts                 # Multi-factor authentication
    useSessionTimeout.ts      # Timeout de sessão inativa
    useSupabaseInit.ts        # Inicialização do cliente Supabase
  utils/
    formatters.ts             # Data/hora/moeda — DateFormatter criado uma vez
    whatsapp.ts               # Deep links WhatsApp (usa wa.me — compatível Expo Go)
    cpfHash.ts                # SHA-256 do CPF com salt (LGPD Art. 11)
    roomTimeline.ts           # Lógica de timeline de disponibilidade de salas
  services/
    supabase.ts               # Cliente Supabase com AsyncStorage (sessão persistida)
    auth.ts                   # signIn, signUp, signOut, getProfile, updateProfile
    communicare.ts            # Interface + mock para integração Communicare (fase 3)
    reservationService.ts     # CRUD de reservas no Supabase
    roomService.ts            # Consulta de salas e disponibilidade
    financeiroService.ts      # Faturas e pacotes de horas
    usageChargeService.ts     # Cobranças por minuto de sessão + rate limiting auth
    auditLog.ts               # Logs de acesso a dados de pacientes (LGPD Art. 37)
    accountService.ts         # Exportação e exclusão de conta (LGPD Art. 18)
    notificationService.ts    # Push notifications (Expo Notifications)
    chatService.ts            # Proxy para Supabase Edge Function `chat` (Claude API)
    luma.ts                   # Busca de eventos do Luma (integração real)
    sentryService.ts          # Crash reporting sem PII
    avatarService.ts          # Upload e gerenciamento de foto de perfil
    reportService.ts          # Relatórios e exportações
  components/
    AddPacienteModal.tsx      # Formulário de cadastro com consentimento LGPD
    PacienteRow.tsx           # Linha da lista de pacientes
    PacienteDetail.tsx        # Tela de detalhes do paciente
    ReservationModal.tsx      # Modal de reserva de sala
    RoomDetailModal.tsx       # Detalhes e itens de uma sala
    EncaixeModal.tsx          # Encaixe avulso de paciente
    RescheduleModal.tsx       # Reagendamento de reserva
    AppLockScreen.tsx         # Tela de bloqueio biométrico
    QRScannerModal.tsx        # Scanner QR para check-in
```

## Paleta de Cores OLI
```typescript
oliGreen:     '#5F7D67'   // Verde principal
oliGold:      '#B8893C'   // Dourado (plano, destaques)
oliBackground:'#F4EFEA'   // Fundo creme
oliDarkGray:  '#2F2F2F'   // Texto principal
oliLightGray: '#6B6B6B'   // Texto secundário
oliRed:       '#D9534F'   // Alertas e urgência
```

## Planos e Preços
> Fonte de negócio (preços, escopo): `docs/OLI_BASE.md`. Fonte de código: `src/models/oli-plans.ts`. Ao alterar, atualizar os dois.

```typescript
type PlanType = 'START' | 'PRO';   // BASE desativado, VIP nunca lançado

// Valores vigentes desde out/2026 (fundador, 02/10; vale para todos, sem congelamento — 05/10). Tabela `plans`, app, termos, site e prompts já atualizados; falta só publicar o OTA do app (HANDOFF §76)
RATE_PER_MINUTE = { START: 1.29, PRO: 0.79 }   // preços de out/2026 (02/10)
MONTHLY_PRICE   = { START: 0, PRO: 299.00 }   // PRO semestral: 199.00/mês, fidelidade 6 meses
```

- **START**: sem mensalidade, **padrão automático no cadastro** (a exigência de escolher plano existiu entre 19 e 26/ago e foi revertida).
- **PRO**: recorrente, mensal ou semestral. Ponto de virada: ~10h/mês no mensal, ~7h no semestral.
- **BASE**: desativado (`ativo=false`), zero assinantes, fora da vitrine — preservado só por histórico.
- **VIP**: nunca lançado — não comercializar nem implementar lógica.
- ⚠️ **`src/models/oli-plans.ts`**: preços de START e PRO atualizados em 02/10; `plan_base` ainda aparece como ativo (pendência desde 26/ago). A tabela `plans` do banco já está nos valores de out/2026; `taxa_min_congelada` foi zerada em todos os perfis (05/10).
- Benefícios por plano: matriz em `docs/OLI_BASE.md` §5. Estacionamento vale nos dois planos (05/out); endereço comercial (sem endereço fiscal, a princípio) é exclusivo do PRO.

## Olivia — assistente única de IA
As 5 personas antigas (Ana Luiza, Isabella, Amanda, Ronaldo, Olivia) foram **reduzidas a uma** em 19/ago — nenhuma tinha ponto de entrada ativo no app. A Edge Function `chat` não recebe mais `persona` no body.

| Frente | Onde | O que faz |
|--------|------|-----------|
| App | `app/chatbot.tsx` → Edge Function `chat` | Dúvidas sobre salas, planos, reservas, módulos, eventos, comunidade, indicação |
| WhatsApp | Edge Function `whatsapp-webhook` | **Responsável comercial**: descoberta, quebra de objeção, foto por especialidade, agendamento de visita, handoff para humano |

Ambas usam `claude-haiku-4-5-20251001`. O comportamento no WhatsApp é regido por **`docs/IA_ATENDIMENTO_WHATSAPP.md`** — o prompt em código implementa o manual, não o contrário; ao mexer no prompt, atualizar o manual junto e manter `test-lead-ai` sincronizada com `whatsapp-webhook`.

**Regras duras da Olivia:** nunca pede WhatsApp/telefone (o canal já é o WhatsApp); nunca inventa regra, preço ou política; nunca calcula total novo (só cita exemplos já conferidos); usa `*asterisco simples*` (WhatsApp não renderiza `**duplo**`); paciente nunca é atendido por IA (travado por constraint no banco).

## LGPD — Requisitos Obrigatórios (Lei 13.709/2018)
Dados de saúde são **dados sensíveis** (Art. 11). Status atual:

- [x] CPF nunca armazenado em texto puro — hash SHA-256 via `cpfHash.ts`
- [x] Consentimento explícito via WhatsApp antes de usar dados
- [x] Funcionalidade de exportação de dados (`accountService.ts` — Art. 18)
- [x] Funcionalidade de exclusão de conta (`accountService.ts` — Art. 18)
- [x] Logs de acesso a dados de pacientes (`auditLog.ts` — Art. 37)
- [x] Nenhum dado de saúde enviado via WhatsApp (somente logística)
- [x] Telefone da recepção via `EXPO_PUBLIC_OLI_RECEPTION_PHONE` (não hardcoded)
- [x] Política de privacidade linkada no cadastro
- [ ] Consentimento com timestamp ainda não registrado no Supabase após confirmação

## Integração Communicare
Toda comunicação passa por `src/services/communicare.ts`.
- Mock ativo durante desenvolvimento — salas e reservas são dados estáticos
- Para ativar: substituir implementação quando credenciais OAuth chegarem
- Nunca chamar o Communicare diretamente nas telas

## Supabase — Tabelas Relevantes
| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil do profissional (plano, CRM, onboarding) |
| `patients` | Pacientes com CPF hasheado e consentimento LGPD |
| `reservations` | Reservas de sala com status e timestamps |
| `audit_logs` | Logs de acesso (LGPD) |
| `usage_charges` | Cobranças por minuto de sessão |
| `hour_balance` | Saldo de pacotes de horas |
| `nps_responses` | NPS (tabela criada, sem UI ainda) |
| `plans` | Planos com preços — **fonte correta**, à frente do `oli-plans.ts` |
| `auth_attempts` | Rate limiting de login |
| `leads` | Funil comercial (9 etapas, 6 origens, vínculo com RD Station) |
| `conversations` / `messages` | Inbox de WhatsApp (lead e paciente), Olivia e equipe |
| `whatsapp_templates` | Templates aprovados pela Meta |
| `patient_charges` / `professional_asaas_accounts` | Cobrança de paciente via subconta Asaas |

RLS habilitado em todas as tabelas. `database.types.ts` gerado via Supabase MCP.

## Agentes Especializados
Use `/project:<agente>` para ativar um modo especializado:

| Comando | Papel |
|---------|-------|
| `/project:arquiteto` | Design de sistema, API contracts, modelos de dados |
| `/project:frontend` | Componentes React Native, telas, design system |
| `/project:seguranca-lgpd` | Auditoria de segurança e conformidade LGPD |
| `/project:qa` | Revisão de qualidade, bugs, testes |
| `/project:integrador` | Communicare e APIs externas |

## Convenções de Código
- Componentes: `PascalCase`
- Funções/variáveis: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`
- Arquivos de tela (Expo Router): `kebab-case` → `agenda.tsx`
- Arquivos de componente: `PascalCase` → `PacienteRow.tsx`
- Sem `any` no TypeScript
- Sem `console.log` em produção
- Estilos sempre em `StyleSheet.create()` no final do arquivo
- Sem objetos inline `{{ }}` dentro do JSX (causa re-renders)
- Todo elemento interativo deve ter `accessibilityLabel`
- `professionalId` sempre passado explicitamente para operações Supabase

## Diretrizes de Comportamento

**Pense antes de codar.** Não assuma. Superfície de tradeoffs.
- Antes de implementar: declare assumptions. Se incerto, pergunte.
- Se múltiplas interpretações existem, apresente-as.
- Se algo está confuso, nomeie o que está confuso. Pergunte.

**Simplicidade primeiro.** Mínimo de código que resolve o problema.
- Sem features além do que foi pedido.
- Sem abstrações para código de uso único.
- Se escrever 200 linhas e poderia ser 50, reescreva.

**Mudanças cirúrgicas.** Toque apenas o necessário.
- Não "melhore" código adjacente que não foi pedido.
- Combine o estilo existente, mesmo que faria diferente.
- Remova imports/variáveis que SUAS mudanças tornaram órfãos.

**Execução orientada a objetivos.** Defina critérios de sucesso. Loop até verificar.
