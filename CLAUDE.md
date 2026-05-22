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
  onboarding.tsx              # Questionário fiscal (contábil Mello)
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
```typescript
type PlanType = 'BASE' | 'PRO' | 'VIP';  // STARTER foi renomeado para BASE

COST_PER_MINUTE = { BASE: 2.00, PRO: 1.60, VIP: 1.20 }  // R$/min
```
O catálogo completo de benefícios por plano está em `app/(tabs)/ecossistema.tsx` — componente `PLAN_BENEFITS`.

## Especialistas IA (Chatbot)
5 personas ativas em `app/chatbot.tsx`, roteadas via `?persona=`:

| Persona | Nome | Especialidade |
|---------|------|--------------|
| `ana` | Ana Luiza | Direito Médico (CFM, LGPD, contratos) |
| `isabella` | Isabella | Contabilidade Médica (PJ, impostos) |
| `convenios` | Amanda | OLI Convênios (TISS, credenciamento) |
| `carreira` | Ronaldo | OLI Carreira (captação, posicionamento) |
| `olivia` | Olivia | OLI Health Hub (salas, planos, reservas) |

Todas roteiam para a Edge Function `chat` no Supabase que chama `claude-haiku-4-5-20251001`.
`consultaUrl` está `null` em todas — preencher com links Calendly quando disponíveis.

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
| `plans` | Planos BASE/PRO/VIP com preços |
| `auth_attempts` | Rate limiting de login |

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
