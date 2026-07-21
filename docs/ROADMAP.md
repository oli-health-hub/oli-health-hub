# OLI Health Hub — Roadmap de Desenvolvimento

> **Modelo de Negócio:** Plataforma de Operação Assistida Integrada para médicos independentes.
> Consolação/Paulista — SP. **9 salas operantes** (inclui Vídeo Conferência, Audio Visual e Eventos). Custo fixo: **R$ 50.000/mês**.
> **Última atualização:** 2026-07-21
>
> Este documento é um **retrato de arquitetura** (o que existe, macro). Pendências do dia a dia,
> bugs em aberto e histórico de sessão vivem em `docs/HANDOFF.md` (§11 "Em aberto") — é a fonte
> viva; aqui é só pra orientação estrutural de quem chega no projeto.

---

## Legenda
- ✅ Implementado e funcionando
- 🚧 Parcialmente implementado
- ⏳ Planejado — sem data
- ❌ Não iniciado
- 🔒 Bloqueado por decisão de negócio / terceiro (ex.: Communicare aguarda token)

---

## Estado Atual do Código

### Mobile App (React Native + Expo)

#### Telas (Expo Router)
| Tela | Arquivo | Status | Observações |
|------|---------|--------|-------------|
| Boas-vindas | `app/welcome.tsx` | ✅ | Tela antes do login/cadastro |
| Login / Cadastro | `app/login.tsx` | ✅ | Rate limiting, reset de senha |
| Nova senha | `app/nova-senha.tsx` | ✅ | Fluxo de recovery via deep link |
| Onboarding | `app/onboarding.tsx` | ✅ | Reduzido a 1 tela (WhatsApp+CRM); resto virou gamificação |
| Completar perfil | `app/completar-perfil.tsx` | ✅ | Hub de objetivos/Olicoins (10 seções + 11 objetivos + 5 trilhas) |
| Conta bloqueada | `app/conta-bloqueada.tsx` | ✅ | Tela de bloqueio de acesso (suspensão/banimento) |
| Dashboard (Início) | `app/(tabs)/index.tsx` | ✅ | Timer real, reservas do dia, badges gamificação |
| Agenda | `app/(tabs)/agenda.tsx` | ✅ | Salas, reserva, encaixe, QR scanner, Mapa de Ocupação |
| Pacientes | `app/(tabs)/pacientes.tsx` | ✅ | CRM, Supabase source of truth |
| Ecossistema | `app/(tabs)/ecossistema.tsx` | ✅ | START/BASE/PRO, 5 especialistas IA (Calendly ativo), eventos Luma reais |
| Financeiro | `app/(tabs)/financeiro.tsx` | ✅ | Faturas, pacotes de horas, checkout Asaas |
| Comunidade | `app/(tabs)/comunidade.tsx` | ✅ | Switcher Feed/Colegas (posts, curtir, comentar) + diretório |
| Meu Plano | `app/meu-plano.tsx` | ✅ | Plano atual, "Seus serviços", banner indicação |
| Módulos | `app/modulos.tsx` | ✅ | Listagem e ativação de módulos à la carte |
| Indicação | `app/indicacao.tsx` | ✅ | Compartilhar código/link de indicação |
| Chatbot IA | `app/chatbot.tsx` | ✅ | 5 personas, Calendly configurado em todas |
| Perfil | `app/perfil.tsx` | ✅ | Biometria, exportação, exclusão de conta |
| MFA Setup/Verify | `app/mfa-*.tsx` | ✅ | TOTP via Supabase Auth |
| Política Privacidade | `app/politica-privacidade.tsx` | ✅ | LGPD, linkada no cadastro |

#### Componentes
| Componente | Status | Função |
|-----------|--------|--------|
| `AddPacienteModal` | ✅ | Cadastro com consentimento LGPD |
| `AppLockScreen` | ✅ | Bloqueio biométrico, fundo vidro fosco OLI |
| `CheckoutModal` / `HourCheckoutModal` / `PlanCheckoutModal` | ✅ | Checkout via Asaas (Cartão/PIX/Boleto), cupom de desconto |
| `EncaixeModal` / `RescheduleModal` / `ReservationModal` | ✅ | Fluxos de reserva — usam `upcomingReservations` (hoje+180d) |
| `PacienteDetail` / `PacienteRow` | ✅ | Detalhes e linha do CRM |
| `QRScannerModal` | ✅ | Scanner QR pra check-in de sala |
| `RoomDetailModal` | ✅ | Detalhes, fotos e itens da sala |
| `PostFeed` / `TagInput` | ✅ | Feed social da Comunidade |
| `ProfileCompletionCard` / `OlicoinsBadge` / `OlicoinsToast` | ✅ | Gamificação (Olicoins) |
| `CalendlyVisitBadge` | ✅ | Badge flutuante pra agendar visita presencial |
| `CouponField` | ✅ | Input de cupom de desconto no checkout |

#### Services (destaques)
| Service | Status | Função |
|---------|--------|--------|
| `auth` / `authStore` | ✅ | signIn/signUp/signOut, `profileLoaded` gate |
| `reservationService` | ✅ | `fetchUpcomingReservations` (hoje+180d), CRUD |
| `roomService` | ✅ | 9 salas, disponibilidade |
| `financeiroService` | ✅ | Faturas, `fetchHourPackages` (DB é fonte única) |
| `moduleService` | ✅ | `fetchModulePricing` (DB é fonte única) |
| `checkoutService` | ✅ | Módulos + horas + planos via Asaas, cupom |
| `chatService` | ✅ | Proxy Edge Function `chat` → Claude Haiku |
| `communicare*` (api/sync/mock/agenda/SSO) | 🔒 | Pronto no código, **inerte sem token** — aguarda Heitor |
| `luma` | ✅ | Eventos reais via feed iCal público |
| `pushService` | ✅ | Push remoto (Expo Notifications) + 3 campanhas automáticas |
| `locationService` | 🚧 | Código pronto, **inerte até rebuild nativo** (expo-location não linkado) |
| `olicoinsService` / `achievementsService` | ✅ | Gamificação — ledger + trilhas |
| `communityService` | ✅ | Feed social |
| `accountService` | ✅ | Exportação + exclusão (LGPD Art. 18) |
| `auditLog` | ✅ | Log de acesso a dados (LGPD Art. 37) |
| `avatarService` | ✅ | Upload de foto de perfil |
| `sentryService` | ✅ | DSN configurado, sem PII |
| `usageChargeService` | ✅ | Minutagem por sessão |

#### Edge Functions (Supabase)
| Função | Status |
|--------|--------|
| `chat` | ✅ |
| `create-charge` / `create-hour-package` / `create-subscription` | ✅ |
| `asaas-webhook` | ✅ Produção validada ponta-a-ponta |
| `send-push` | ✅ |
| `notify-reservation` | ✅ (+ e-mail via Resend) |
| `auth-confirm` / `privacy` | 🚧 Fallback — fluxo oficial migrou pro domínio OLI (`landing/`) |
| `communicare-proxy` / `communicare-sync-worker` / `communicare-webhook` / `communicare-migrate-patients` | 🔒 Deployadas, inertes sem token CC |

---

### Admin (Next.js)

| Página | Status | Observação |
|--------|--------|------------|
| `/` (Dashboard) | ✅ | KPIs, salas ao vivo, agenda do dia |
| `/login` + `/definir-senha` | ✅ | Auth admin, aceite de convite |
| `/medicos` + `/medicos/[id]` + `/medicos/excluidos` | ✅ | Contas excluídas separadas (LGPD) |
| `/equipe` + `/equipe/[id]` + `/equipe/novo` | ✅ | Founder/especialista/parceiro/team |
| `/usuarios` | ✅ | Concede/revoga acesso ao painel (`is_admin`, independente do `user_type`) |
| `/salas` | ✅ | Dinâmica via tabela `rooms` (9 salas) |
| `/pagamentos` / `/financeiro` / `/meu-recebimento` | ✅ | KPIs, minutagem, salário+comissão do founder |
| `/horas` / `/catalogo` / `/cupons` | ✅ | Pacotes de horas, módulos, cupons — DB é fonte única |
| `/planos` | ✅ | Assinaturas |
| `/comunidade` | ✅ | Moderação de posts do feed |
| `/notificacoes` | ✅ | Broadcast manual de push |
| `/historico` | ✅ | Reservas e minutagem |

---

## Segurança e LGPD

| Item | Status |
|------|--------|
| RLS em todas as tabelas | ✅ |
| Hash SHA-256 do CPF (Art. 11) | ✅ |
| MFA TOTP | ✅ |
| App lock biométrico | ✅ |
| Audit log imutável (Art. 37) | ✅ |
| Rate limiting auth | ✅ |
| Exclusão + exportação de conta (Art. 18) | ✅ |
| Timeout de sessão (30min) | ✅ |
| Gate de reserva server-side (exige saldo) | ✅ Trigger Postgres |
| Exclusion constraint anti-dupla-reserva | ✅ |
| `oli_encrypt`/`oli_decrypt` restritos a `service_role` | ✅ |
| Acesso admin desacoplado do papel (`is_admin`) | ✅ |
| Consentimento LGPD com timestamp no Supabase | ❌ Pendente |
| Certificate pinning | ❌ |
| Disable screenshot em telas sensíveis | ❌ |
| Penetration testing / DPO designado | ❌ |

---

## Publicação nas Lojas

| Item | Status |
|------|--------|
| iOS — App Store | ✅ **Publicado** (argumento 3.1.5(b) aceito) |
| Android — Google Play | ✅ **Publicado em produção** (13/jul) |
| Sentry DSN | ✅ Configurado |
| Asaas produção | ✅ Validado ponta-a-ponta |

---

## Frentes em aberto (visão macro — detalhe/prazo em HANDOFF §11)

| Frente | Status |
|--------|--------|
| Integração Communicare (prontuário/agenda CC) | 🔒 Aguarda token + endpoints do Heitor |
| Login social (Google/Apple) | 🚧 Deferido, precisa rebuild nativo |
| Localização sutil (cidade/UF) | 🚧 Código pronto, precisa rebuild nativo |
| Salas Evento/Conferência (cobrança por hora, não minutagem) | ❌ Precisa validar preço com fundador |
| Plano VIP | 🔒 Standby — não comercializar nem implementar |
| Telemedicina como modo de reserva (hoje só módulo no catálogo) | ❌ |
| Programa de Indicação de Parceiros Externos (comissão B2B) | ❌ Modelo fechado, mecanismo não implementado |
| Streak de dias ativos + selos customizados (gamificação) | ❌ |
| Cron auto-desativar START sem uso 30d | ❌ |
| `expo-blur` real no AppLockScreen | ❌ Precisa rebuild nativo |

---

## Escalabilidade

| Horizonte | Meta |
|-----------|------|
| Ano 1 | Break-even ≈ 24 médicos (mix BASE/PRO), meta 50–60 |
| Anos 2–3 | 2ª unidade SP, produtos digitais |
| Anos 4–5 | Franquias, expansão nacional, possível M&A |

Ver `docs/OLI_BASE.md` (preços/planos) e `HANDOFF.md` §5 (break-even) para os números vivos.
