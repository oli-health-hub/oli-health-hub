# OLI Health Hub — Roadmap de Desenvolvimento

> **Modelo de Negócio:** Plataforma de Operação Assistida Integrada para médicos independentes.
> Consolação/Paulista — SP. 6 salas operantes + sala de eventos. Custo fixo: R$ 25.000/mês.
> **Última atualização:** 2026-05-27

---

## Legenda
- ✅ Implementado e funcionando
- 🚧 Parcialmente implementado
- ⏳ Planejado — próxima sprint
- ❌ Não iniciado
- 🔒 Bloqueado por decisão de negócio

---

## Estado Atual do Código

### Mobile App (React Native + Expo)

#### Telas (Expo Router)
| Tela | Arquivo | Status | Observações |
|------|---------|--------|-------------|
| Login / Cadastro | `app/login.tsx` | ✅ | Rate limiting, reset de senha, validações |
| Onboarding Fiscal | `app/onboarding.tsx` | ✅ | 10 perguntas → Supabase |
| Dashboard (Início) | `app/(tabs)/index.tsx` | ✅ | Timer real, reservas do dia |
| Agenda | `app/(tabs)/agenda.tsx` | ✅ | Salas, reserva, encaixe, QR scanner |
| Pacientes | `app/(tabs)/pacientes.tsx` | ✅ | CRM, Supabase source of truth, sem métricas falsas |
| Ecossistema | `app/(tabs)/ecossistema.tsx` | ✅ | BASE/PRO/VIP, 5 especialistas IA, eventos Luma, botão "Comprar horas" → financeiro |
| Financeiro | `app/(tabs)/financeiro.tsx` | ✅ | Dados reais Supabase, checkout de horas, PDF, histórico |
| Comunidade | `app/(tabs)/comunidade.tsx` | ✅ | Grid de profissionais, busca, modal de detalhes, Supabase |
| Chatbot IA | `app/chatbot.tsx` | ✅ | 5 personas (Ana, Isabella, Amanda, Ronaldo, Olivia) |
| Perfil | `app/perfil.tsx` | ✅ | Biometria, exportação, exclusão de conta |
| MFA Setup | `app/mfa-setup.tsx` | ✅ | TOTP via Supabase Auth |
| MFA Verify | `app/mfa-verify.tsx` | ✅ | Verificação TOTP |
| Política Privacidade | `app/politica-privacidade.tsx` | ✅ | LGPD, linkada no cadastro |

#### Componentes
| Componente | Status | Função |
|-----------|--------|--------|
| `AddPacienteModal` | ✅ | Cadastro com consentimento LGPD |
| `AppLockScreen` | ✅ | Bloqueio biométrico |
| `CheckoutModal` | ✅ | Checkout módulos (Cartão/PIX/Boleto) via Asaas |
| `EncaixeModal` | ✅ | Encaixe avulso de paciente |
| `HourCheckoutModal` | ✅ | Checkout pacotes de horas via Asaas |
| `PacienteDetail` | ✅ | Detalhes do paciente |
| `PacienteRow` | ✅ | Item da lista de pacientes |
| `QRScannerModal` | 🚧 | Scanner QR — modal implementado, integração check-in pendente |
| `RescheduleModal` | ✅ | Reagendamento com userId real |
| `ReservationModal` | ✅ | Reserva de sala |
| `RoomDetailModal` | ✅ | Detalhes e itens da sala |

#### Services
| Service | Status | Função |
|---------|--------|--------|
| `accountService` | ✅ | Exportação + exclusão (LGPD Art. 18) |
| `auditLog` | ✅ | Log de acesso a dados (LGPD Art. 37) |
| `auth` | ✅ | signIn, signUp, signOut, reset senha, perfil |
| `avatarService` | ✅ | Upload/gerenciamento foto de perfil |
| `chatService` | ✅ | Proxy para Edge Function `chat` (Claude Haiku) |
| `checkoutService` | ✅ | Módulos + horas via Asaas (4 funções) |
| `communicare` | 🚧 | Interface + mock ativo (fase 3) |
| `financeiroService` | ✅ | `fetchUsageSummary`, `fetchMonthlyUsageHistory`, `fetchHourBalance` |
| `luma` | ✅ | Busca de eventos reais do Luma |
| `notificationService` | ✅ | Push notifications (Expo Notifications) |
| `reportService` | ✅ | Relatório PDF mensal |
| `reservationService` | ✅ | CRUD reservas Supabase |
| `roomService` | ✅ | Salas e disponibilidade |
| `sentryService` | 🚧 | Estrutura pronta, DSN não configurado |
| `supabase` | ✅ | Cliente com AsyncStorage, sessão persistida |
| `usageChargeService` | ✅ | Minutagem: locação=ceil/min, excedente=ceil/30min |

#### Stores (Zustand)
| Store | Status | Conteúdo |
|-------|--------|----------|
| `appStore` | ✅ | Sessão ativa, salas, reservas, plano real (setUserPlan), `scheduledEndTime` |
| `authStore` | ✅ | Sessão Supabase, perfil do profissional |
| `moduleStore` | ✅ | Módulos ativos do usuário |
| `patientStore` | ✅ | Pacientes + AsyncStorage + Supabase |

#### Hooks
| Hook | Status | Função |
|------|--------|--------|
| `useAppLock` | ✅ | Bloqueio biométrico após 5min background |
| `useFeature` | ✅ | Feature flags por plano |
| `useMFA` | ✅ | Multi-factor authentication |
| `useSessionTimeout` | ✅ | Logout automático 30min inativo |
| `useSupabaseInit` | ✅ | Inicialização do cliente |
| `useTimer` | ✅ | Timer anti-drift baseado em `Date` real |

#### Edge Functions (Supabase)
| Função | Status | Função |
|--------|--------|--------|
| `chat` | ✅ | Roteamento 5 personas → Claude Haiku |
| `create-charge` | ✅ | Cobrança avulsa Asaas para módulos |
| `create-hour-package` | ✅ | Cobrança Asaas para pacotes de horas |
| `create-subscription` | ✅ | Assinatura recorrente Asaas para planos |
| `asaas-webhook` | ✅ | Confirma pagamentos → ativa módulos, planos e horas |
| `notify-signup` | ✅ | Notificação admin de novo cadastro |

#### Banco de Dados (Supabase)
| Tabela | Status | Descrição |
|--------|--------|-----------|
| `profiles` | ✅ | Profissional: plano, CRM, onboarding, `pre_paid_ok` |
| `patients` | ✅ | CPF hasheado, consentimento LGPD |
| `reservations` | ✅ | Reservas com status e timestamps |
| `audit_logs` | ✅ | Logs de acesso (LGPD Art. 37) |
| `usage_charges` | ✅ | Minutagem por sessão |
| `hour_balance` | ✅ | Saldo de pacotes de horas |
| `hour_packages` | ✅ | Catálogo de pacotes (horas, valor, validade) |
| `plans` | ✅ | BASE/PRO/VIP com preços |
| `subscriptions` | ✅ | Assinaturas recorrentes Asaas |
| `modules` | ✅ | Catálogo de módulos à la carte |
| `user_modules` | ✅ | Módulos ativos por usuário |
| `referrals` | ✅ | Programa de indicação (estrutura) |
| `auth_attempts` | ✅ | Rate limiting de login |
| `admin_notifications` | ✅ | Feed de notificações para admin |
| `nps_responses` | 🚧 | Tabela criada, sem UI |

---

### Admin (Next.js)

#### Páginas
| Página | Status | Função |
|--------|--------|--------|
| `/` (Dashboard) | ✅ | KPIs operacionais, salas ao vivo, agenda do dia |
| `/login` | ✅ | Auth admin |
| `/medicos` | ✅ | Lista de profissionais |
| `/medicos/[id]` | ✅ | Perfil completo: plano, horas, reservas, módulos, assinaturas |
| `/pagamentos` | ✅ | KPIs financeiros, minutagem, assinaturas, módulos, filtros, paginação |
| `/horas` | ✅ | Gestão de saldo de horas por médico |
| `/historico` | ✅ | Histórico de reservas e minutagem |
| `/modulos` | ✅ | Gestão de módulos ativos |
| `/planos` | ✅ | Gestão de assinaturas |
| `/salas` | ✅ | Disponibilidade e ocupação de salas |
| `/usuarios` | ✅ | Gestão de usuários e permissões |
| `/fila` | 🚧 | Fila de atendimento (parcial) |

#### Componentes Admin
| Componente | Status | Função |
|-----------|--------|--------|
| `Sidebar` | ✅ | Navegação lateral com todas as rotas |
| `KpiCard` | ✅ | Card de métrica com variação |
| `LiveRooms` | ✅ | Salas em uso em tempo real |
| `NotificationFeed` | ✅ | Feed de ações recentes |
| `ReservationCalendar` | ✅ | Calendário de reservas |
| `UpcomingList` | ✅ | Próximas reservas |

---

## Segurança

### 🔴 Crítico — Antes de dados reais em produção
| Item | Status |
|------|--------|
| RLS em todas as tabelas | ✅ |
| Hash SHA-256 do CPF (LGPD Art. 11) | ✅ |
| Variáveis de ambiente (telefone, chaves) | ✅ |
| MFA TOTP via Supabase Auth | ✅ |
| App lock biométrico (5min inatividade) | ✅ |
| Audit log imutável | ✅ |
| Rate limiting auth (5 tentativas / 15min) | ✅ |
| Gateway de pagamento PCI DSS (Asaas) | ✅ |
| Nunca armazenar dados de cartão no app | ✅ |

### 🟡 Sprint 1 — Primeiras 4 semanas em produção
| Item | Status |
|------|--------|
| Direito ao esquecimento — exclusão cascade (LGPD Art. 18) | ✅ |
| Portabilidade de dados — exportação JSON (LGPD Art. 18) | ✅ |
| Timeout de sessão — logout automático 30min | ✅ |
| Política de privacidade publicada e linkada | ✅ |
| Criptografia de colunas financeiras (pgcrypto) | ❌ |
| Sentry configurado sem logar dados pessoais | 🚧 DSN pendente |
| Consentimento com timestamp no Supabase | ❌ |

### 🟢 Sprint 2 — Antes das lojas
| Item | Status |
|------|--------|
| Certificate pinning | ❌ |
| Disable screenshot em telas sensíveis | ❌ |
| Penetration testing | ❌ |
| DPO designado | ❌ |
| Dependency audit automatizado no CI/CD | ❌ |

---

## Pendências Imediatas — Antes do TestFlight

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Deploy Edge Function `create-hour-package` | ✅ Feito (27/05) |
| 2 | Atualizar `asaas-webhook` com handler `hour_package::` | ✅ Feito (27/05) |
| 3 | Criar projeto Sentry, preencher `EXPO_PUBLIC_SENTRY_DSN` em `eas.json` | ❌ Manual |
| 4 | `eas build --platform ios --profile production` | ⏳ Aguarda #3 |
| 5 | `eas submit --platform ios` | ⏳ Aguarda #4 |

---

## Fase 1 — MVP Completo 🚧

### 1.0 — Parceiros no Ecossistema
| Item | Status |
|------|--------|
| Card "OLI Convênios" (Amanda / AR Soluções) | ✅ |
| Card "OLI Carreira" (Ronaldo / AR Soluções) | ✅ |
| Agente virtual AR Soluções (quando disponível) | ❌ |

### 1.1 — Modelo de Usuários e Planos
| Item | Status |
|------|--------|
| Tabela `plans` | ✅ |
| Tabela `subscriptions` | ✅ |
| Tabela `hour_packages` + `hour_balance` | ✅ |
| Tabela `usage_charges` | ✅ |
| Tabela `referrals` (estrutura) | ✅ |
| `user_type` + `plan_id` + `pre_paid_ok` em `profiles` | ✅ |
| RLS separado por `user_type` | ✅ |
| Tela "Meu Plano" com plano atual, benefícios, renovação | ❌ |
| Tela de upgrade (comparação BASE → PRO → VIP) | ❌ |
| Fluxo de contratação de plano no app | ❌ |
| Status de pagamento em tempo real (webhook → app) | 🚧 webhook pronto, UI pending |
| Alertas de vencimento e inadimplência | ❌ |

### 1.2 — Módulos À La Carte
| Item | Status |
|------|--------|
| Tabela `modules` + `user_modules` | ✅ |
| `CheckoutModal` (compra módulo: Cartão/PIX/Boleto) | ✅ |
| Edge Functions `create-charge` + `asaas-webhook` | ✅ |
| Tela de Módulos no app (listagem status: ativo/inativo/disponível) | ❌ |
| Integração CheckoutModal com tela de módulos | ❌ |

### 1.3 — Pacotes de Horas
| Item | Status |
|------|--------|
| Tabela `hour_packages` + `hour_balance` | ✅ |
| Edge Function `create-hour-package` | ✅ |
| `HourCheckoutModal` (Cartão/PIX/Boleto) | ✅ |
| Botão "Comprar" na tela Financeiro | ✅ |
| Botão "Comprar horas" no Ecossistema → scroll para pacotes | ✅ |
| Exibição de saldo de horas no Dashboard | ✅ |
| Alerta quando saldo < 2h | ✅ Widget com borda vermelha + ícone warning |
| Histórico de uso de horas | ❌ |

### 1.4 — Minutagem e Cobrança
| Item | Status |
|------|--------|
| Timer anti-drift em tempo real | ✅ |
| Gravar `usage_charges` ao finalizar reserva | ✅ |
| Cálculo excedente em blocos de 30min | ✅ |
| `scheduledEndTime` opcional na cobrança | ✅ |
| Extrato de minutagem no app (tela Financeiro) | ✅ |
| Histórico 3 meses (real Supabase) | ✅ |
| Deduzir do saldo de horas (`hour_user`) | ❌ |
| Somar na fatura mensal (`subscriber`) | ❌ |

### 1.5 — Programa de Indicação
| Item | Status |
|------|--------|
| Tabela `referrals` | ✅ |
| Gerar código de indicação único por usuário | ❌ |
| Tela "Indicar Colega" com link compartilhável | ❌ |
| Webhook: indicado assina → benefício automático ao indicador | ❌ |
| Histórico de indicações no perfil | ❌ |

### 1.6 — Gateway Asaas
| Item | Status |
|------|--------|
| Conta Asaas configurada | ✅ |
| Edge Function `create-subscription` | ✅ |
| Edge Function `create-charge` (módulos) | ✅ |
| Edge Function `create-hour-package` (horas) | ✅ |
| Edge Function `asaas-webhook` (módulos + planos + horas) | ✅ |
| `findOrCreateCustomer` compartilhado | ✅ |
| PIX QR Code | ✅ |
| Boleto | ✅ |
| Cartão (link Asaas PCI compliant) | ✅ |
| Sandbox → Produção (variável `ASAAS_ENV`) | ⏳ |

### 1.7 — Dashboard Admin
| Item | Status |
|------|--------|
| Stack Next.js + Supabase + Tailwind | ✅ |
| Autenticação admin | ✅ |
| Dashboard operacional (KPIs, salas ao vivo, agenda) | ✅ |
| Lista de médicos | ✅ |
| Perfil individual do médico | ✅ |
| Gestão de horas (saldo, crédito manual) | ✅ |
| Histórico de reservas e minutagem | ✅ |
| Gestão de módulos | ✅ |
| Gestão de planos/assinaturas | ✅ |
| Gestão de salas | ✅ |
| Gestão de usuários | ✅ |
| Pagamentos: KPIs + minutagem + assinaturas + módulos + filtros | ✅ |
| Relatório de viabilidade econômica (break-even tracker) | ❌ |
| Inadimplência com ação rápida (suspender acesso) | ❌ |
| Aprovar upgrades de plano | ❌ |

### 1.8 — Tela de Planos no App (profissional)
| Item | Status |
|------|--------|
| Exibição de plano atual no Ecossistema | ✅ |
| Tela dedicada "Meu Plano" | ❌ |
| Comparativo BASE → PRO → VIP | ❌ |
| Fluxo de contratação (gera cobrança Asaas) | ❌ |
| Contratação anual com desconto destacado | ❌ |

---

## Fase 2 — Funcionalidades OLI Completas

### App do Profissional
| Item | Status |
|------|--------|
| Notificações push (sessão, buffer urgente, saldo baixo) | ✅ |
| Timer em background / notificações agendadas | ✅ |
| Relatório PDF mensal com ROI e serviços inclusos | ✅ |
| NPS do profissional (tabela criada, sem modal) | 🚧 |
| QR Code funcional (scanner implementado, check-in pendente) | 🚧 |
| Métricas CRM reais (aguarda Communicare fase 3) | ❌ |
| Vídeo de boas-vindas no primeiro login | ❌ |
| Dashboard de indicadores por parceiro | ❌ |
| Chat entre profissionais do Hub | ❌ |
| Agenda de eventos do espaço | ❌ |
| Programa de indicação (tela + link) | ❌ |
| Comunidade (tab) | ✅ Grid de profissionais do hub, busca, perfil detalhado |
| Calendly links nos especialistas IA (`consultaUrl`) | ❌ |

### Assistentes Virtuais
| Persona | Status | Observações |
|---------|--------|-------------|
| Ana Luiza (Jurídico) | ✅ | Ativa, sem link Calendly |
| Isabella (Contábil Melo) | ✅ | Ativa, sem link Calendly |
| Amanda (OLI Convênios) | ✅ | Ativa, sem link Calendly |
| Ronaldo (OLI Carreira) | ✅ | Ativo, sem link Calendly |
| Olivia (OLI Health Hub) | ✅ | Ativa, sem link Calendly |
| Agente AR Soluções dedicado | ❌ | Aguarda Amanda/Ronaldo |

### Telemedicina
| Item | Status |
|------|--------|
| Módulo no catálogo (R$ 150/mês) | ✅ tabela |
| Todas as salas habilitadas para tele | ❌ |
| Modo "telemedicina" na reserva | ❌ |
| Precificação via módulo separado | ❌ |

---

## Fase 3 — Integração Communicare

| Item | Status |
|------|--------|
| Mock ativo em `communicare.ts` | ✅ |
| Documentação e credenciais OAuth 2.0 (Heitor) | ❌ |
| `CommunicareApiService` substituindo o mock | ❌ |
| Prontuário digital integrado (PRO) | ❌ |
| Agenda online com confirmação automática WA (PRO) | ❌ |
| Faturamento direto no CNPJ do médico (PRO) | ❌ |
| Communicare com IA: transcrição automática (VIP) | ❌ |
| Chatbot inteligente avançado (VIP) | ❌ |
| Cache local TTL 5min | ❌ |

---

## Fase 4 — Publicação nas Lojas

### Pré-requisitos
| Item | Status |
|------|--------|
| Itens 🔴 de segurança concluídos | ✅ |
| Itens 🟡 de segurança (pgcrypto, consentimento timestamp) | 🚧 |
| Gateway de pagamento em produção (`ASAAS_ENV=production`) | ⏳ |
| `EXPO_PUBLIC_SENTRY_DSN` configurado | ❌ |
| Política de privacidade publicada | ✅ |
| Ícone e splash screen finais | ✅ |
| Screenshots para lojas | ❌ |

### iOS (TestFlight → App Store)
| Item | Status |
|------|--------|
| Conta Apple Developer ativa | ✅ |
| `eas.json` perfil production configurado | ✅ |
| `buildNumber: "1"` em `app.json` | ✅ |
| `eas build --platform ios --profile production` | ⏳ aguarda Sentry DSN |
| Upload TestFlight + testes internos | ❌ |
| `eas submit --platform ios` | ❌ |

### Android
| Item | Status |
|------|--------|
| Build preview (APK direto) | ✅ |
| `eas build --platform android --profile production` (AAB) | ❌ |
| Submissão Google Play | ❌ |

---

## Decisões de Negócio Pendentes

> Reunião de Parceiros 15/05/2026 — Prazo: 06/06/2026

| Decisão | Responsável | Prazo | Impacto |
|---------|-------------|-------|---------|
| Composição final BASE/PRO/VIP | Guilherme/Igor | 06/06 | Tela de planos, onboarding |
| Precificação definitiva (mensal + anual + modular) | Guilherme/Igor | 06/06 | Asaas, cobrança |
| BPO Financeiro (Miriam) — escopo e parceria | Guilherme | — | Módulo VIP |
| Produto sem espaço físico (outros estados) | Guilherme/Igor | 15/08 | Novo perfil de usuário |
| Telemedicina — config e precificação | Guilherme/Igor | 06/06 | Módulo Telemedicina |
| Programa de indicação — regras e benefícios | Guilherme/Igor/Mint | 15/07 | Feature referral |
| Calendly links para especialistas IA | Equipe OLI | — | `consultaUrl` nos 5 agentes |

> 🔒 **Preços NUNCA hardcoded** — virão de tabela `plans` no Supabase.

---

## Escalabilidade

| Horizonte | Meta |
|-----------|------|
| Ano 1 | 50–60 médicos, break-even 12, validar modelo |
| Anos 2–3 | 2ª unidade SP, Grupo de Negócios OLI, produtos digitais |
| Anos 4–5 | Franquias, expansão nacional, possível M&A |

---

## Mapa de Riscos

| Risco | Status | Mitigação |
|-------|--------|-----------|
| CPF em texto puro | ✅ Resolvido | Hash SHA-256 + salt |
| Telefone hardcoded | ✅ Resolvido | `.env` |
| Acesso sem MFA | ✅ Resolvido | TOTP Supabase Auth |
| Dados sem audit log | ✅ Resolvido | Tabela imutável RLS |
| Dados de cartão sem gateway | ✅ Resolvido | Asaas PCI compliant |
| Cobrança sem recorrência | ✅ Resolvido | Asaas webhooks |
| Rate limiting auth | ✅ Resolvido | Edge Function + tabela `auth_attempts` |
| Direito ao esquecimento | ✅ Resolvido | Delete cascade + exportação |
| Colunas financeiras em texto | 🔴 Pendente | pgcrypto |
| Consentimento sem timestamp | 🔴 Pendente | INSERT `consent_at` no Supabase |
| Sentry com dados pessoais | 🟡 Pendente | Filtro PII antes do DSN ser configurado |
| MITM rede hospitalar | 🟢 Planejado | Certificate pinning |
| Conflito de reservas | ✅ Resolvido | RLS + check servidor |
| Break-even | Mitigado | 12 médicos cobre custo fixo |
| Churn | Mitigado | Switching cost alto (contador + jurídico + prontuário) |
| Concorrência | Mitigado | Posicionamento: operação integrada, não espaço |
