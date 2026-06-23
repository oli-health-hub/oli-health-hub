# OLI Health Hub — Handoff Completo

> Documento de contexto para replicar o estado do projeto em outro chat.
> Última atualização: 23/Junho/2026.

---

## 1. Visão geral

**OLI Health Hub** = coworking médico **físico** + app de gestão para os médicos + painel admin.
- **App** (médicos): React Native + Expo SDK 54, iOS + Android.
- **Admin** (operação): Next.js, hospedado na Vercel.
- **Site institucional**: estático em `landing/`, hospedado no **Netlify** (`olihealthhub.com.br`).
- Modelo de receita: **mensalidade de plano + cobrança por minuto de uso de sala** (minutagem) + módulos + pacotes de horas.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| App | React Native + Expo SDK 54, Expo Router v4, runtime 1.0.0 |
| Estado | Zustand (appStore, authStore, patientStore) |
| Persistência local | AsyncStorage + Expo SecureStore |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions + Storage) |
| Pagamentos | Asaas |
| Prontuário/agenda (futuro) | Communicare API (staging) |
| Crash | Sentry (sem PII) |
| Build/OTA | EAS Build + EAS Update (canais `preview`, `production`) |
| Admin | Next.js (Vercel, projeto "admin") |
| Site | HTML estático (Netlify, fonte = `landing/` deste repo) |

## 3. Infra — IDs e ambientes

| Item | Valor |
|---|---|
| Supabase project ref | `xwcarrurjvfxisuaihid` |
| Supabase URL | `https://xwcarrurjvfxisuaihid.supabase.co` |
| App scheme (deep link) | `olihealthhub://` (ex.: `olihealthhub://login`) |
| Bundle iOS | `com.oli.healthhub` |
| EAS canais | `production` (TestFlight) + `preview` |
| Admin (Vercel) | projeto `admin`, root dir = `admin/` |
| Site (Netlify) | `olihealthhub.com.br`, publish dir = `landing/`, repo GitHub `guipasquetti/oli-health-hub` branch `main` |
| Repo | `github.com/guipasquetti/oli-health-hub` |

**Regra de deploy:**
- Mudança no **app** → `eas update` nos DOIS canais (`production` + `preview`). Reportar os 2 update group IDs.
- Mudança no **admin** → `git push` (Vercel auto-deploy).
- Mudança no **site/landing** → `git push` (Netlify auto-deploy — ⚠️ ver pendência §11).
- Mudança em **edge function** → deploy via Supabase MCP / CLI.

## 4. Planos e preços (ATUAL — sem VIP por enquanto)

| Plano | Mensalidade | R$/min | Status |
|---|---|---|---|
| START | R$ 0 | R$ 2,00 | default no signup |
| BASE | R$ 299 | R$ 1,50 | ativo |
| PRO | R$ 599 | R$ 1,30 | ativo |
| VIP | — | — | standby (não projetar ainda) |

**Módulos avulsos (tabela `modules` no Supabase):**
- Communicare Connect — **R$ 239/mês**
- Scribe IA (AI Scribe) — **R$ 149/mês**
- (Teleconsulta R$ 97, contábil 460–632, etc. em `oli-plans.ts`)

**Pacotes de horas:** crédito manual pelo admin = **cortesia/sem custo** (não gera cobrança Asaas).

## 5. Break-even (modelo acordado)

Premissas: **custo fixo R$ 50.000/mês**, **20h/médico/mês** (1.200 min). VIP fora.

- Receita/médico a 20h: START R$ 2.400 · BASE R$ 2.099 · PRO R$ 2.159 (média ~R$ 2.100)
- **Break-even ≈ 24 médicos** (mix BASE/PRO). Cada médico extra ≈ +R$ 2.100/mês.
- Custo de sala é **fixo** → margem ~100% por médico (menos ~2% Asaas).
- **START**: ponto de virada em **~10h/mês** (acima disso BASE compensa pro médico). START = funil de baixo uso, maior margem por minuto (2,00). Mix com START sobe o nº de médicos pra empatar (ex.: 40% START 8h / 40% BASE / 20% PRO → média ~R$ 1.656 → **~31 médicos**).
- Capacidade: 24×20h = 480h/mês → mínimo 2 salas lotadas, realista 3–4.

Tabela lucro (custo fixo 50k, ~R$2.100/médico): 20 méd = −8k · 24 = ~0 · 30 = +13k · 40 = +34k · 50 = +55k.

## 6. Integração Communicare — estado completo

**Decisões de produto:**
- CC = **master de cadastro** (pacientes/médicos), exceto quando o médico cadastra pelo app → form do app espelha 1:1 o schema CC (dedup, sem duplicidade).
- Sync **sempre ativo** (não é opção do usuário), com **badges** de status: ✓ Sincronizado / Pendente (%). **Sem** estado de erro visível (erro = retry interno).
- **Agenda de PACIENTES** (fila do dia) = CC já tem → prioridade. Card no Início: tempo real, **morre todo dia** (só dia corrente, zera na virada). Histórico vai pro CC.
- **Mapa de SALAS** (reservas independente de paciente) = CC **ainda não tem** → OLI continua master.
- Integração **invisível de decisão** mas **visível de status** (transparência/robustez).

**Implementado no app (gated por config — inerte sem token):**
- `src/services/communicareApi.ts` — client + endpoints (patient CRUD, SSO, health-plans, history) + `ccIsConfigured()`
- `src/services/communicareSync.ts` — orquestrador create/update/delete + retry; `externalId = oli_patient_id` (chave de vínculo)
- `src/services/communicareMock.ts` — **simulador** (`EXPO_PUBLIC_COMMUNICARE_MOCK=true`) p/ testar sem token
- `src/services/communicareAgenda.ts` + `src/hooks/useCommunicareAgenda.ts` — fila do dia (poll 20s, reset diário, só hoje)
- `src/services/communicareSSO.ts` — SSO médico silencioso no login
- `src/services/healthPlans.ts` — convênios cacheados (dropdown)
- `src/components/CommunicareAgendaCard.tsx` — card 4 buckets (**desmontado do Início até CC ir a produção**)
- Badges sync em PacienteRow/PacienteDetail (gated por `ccIsConfigured`)
- Aba Histórico no PacienteDetail
- AddPacienteModal alinhado ao schema CC (email, convênio estruturado, healthPlanId)

**Edge functions (Supabase):**
- `communicare-proxy` — esconde token server-side
- `communicare-sync-worker` — cron, handlers create/update/delete + backoff
- `communicare-webhook` — recebe `form_response` + eventos futuros
- `communicare-migrate-patients` — job admin batch (dedup por externalId/email)

**Migrations:** `20260601_communicare_sync.sql` (colunas sync + `communicare_sync_queue` + `communicare_webhook_events`)

**Doc detalhado:** `docs/COMMUNICARE_INTEGRATION.md`

**🔴 Bloqueadores (dependem do Heitor / Communicare):**
1. Endpoint **LISTA de agenda do dia por profissional** — não existe no Swagger staging. Precisamos `GET /v1/agenda?professionalId=X&clinicId=Y&data=YYYY-MM-DD` retornando `{scheduleId, patientId, patientName, startTime, procedure, status}`, **só o dia informado** (fila que zera diário).
2. **GET de fila** (`/v1/queue` só tem POST).
3. **Valores reais** do campo `status` (AttendanceHistoricalItemDto).
4. **Webhook** de mudança de status de atendimento (hoje seria polling).
5. **Token** `x-sso-api-key` (staging + prod).
6. Mapa de salas (futuro).

**Como ligar quando token chegar:** setar `EXPO_PUBLIC_COMMUNICARE_PROXY_URL` + secrets CC no Supabase, deploy das 4 functions, aplicar migration, OTA, e remontar `<CommunicareAgendaCard />` no `app/(tabs)/index.tsx`.

## 7. Programa de Indicação (referral) — FLUXO COMPLETO

**Backend:**
- `supabase/migrations/20260607_referral_program.sql` — colunas `referral_code`/`referido_por`, tabela `referrals`, RPCs `generate_referral_code` + `apply_referral_benefit`.
- **Automação server-side:** trigger `trg_referral_on_onboarding` → ao completar onboarding com indicador, credita **+60 min / 90 dias** ao indicador, idempotente, sem auto-indicação.
- `supabase/migrations/20260611_resolve_referral_code.sql` — RPC `resolve_referral_code(p_code)` → retorna `{id, nome}` do indicador a partir do código. **Aplicada em produção.** `database.types.ts` regenerado.

**Fluxo fim a fim (commit `3c452aa`, OTA prod `6c8662f4-0788-4314-a2b3-e32c61f5aed3` + preview `e409f618-c388-49a3-ac0a-e3b0c9d2ad39`):**
1. **Compartilhar** — `app/indicacao.tsx` envia link `https://olihealthhub.com.br/baixar?ref=CODIGO`.
2. **Página de download** — `landing/baixar.html`: mostra código grande, botão copiar, botões App Store + Google Play (destaca loja do device por UA), e "Já tenho o app" → deep link `olihealthhub://onboarding?ref=CODIGO`.
3. **Captura no app** — `app/_layout.tsx` lê `?ref=` de deep/universal link (cold + warm start via `Linking.getInitialURL` + listener) → `src/utils/referral.ts` persiste em AsyncStorage (`@oli:pending_referral_code`).
4. **Cadastro do indicado** — `app/onboarding.tsx` step 3: pré-preenche o indicador automaticamente (lê código pendente → `resolveCode` via RPC → seta `referido_por`, limpa flag). Campo manual "Tem um código?" como alternativa à busca por nome.
5. **Benefício** — trigger server-side credita 1h ao indicador quando o indicado completa onboarding.
- UI extra: banner em `app/meu-plano.tsx`; `ReferralPromoModal` no Início (1º acesso).

**⚠️ Limitação conhecida:** sem SDK de attribution (Branch etc.), instalações novas NÃO fazem deferred deep link — o indicado **digita o código manualmente** (mostrado/copiável na landing). Deep link `?ref=` só pré-preenche se o app já estiver instalado.

## 8. Autenticação / App Lock (biometria) — estado final

- `useAppLock.ts`: bloqueia no cold start e ao voltar do background (`LOCK_AFTER_MS=0`).
- **Biometria pura** (`disableDeviceFallback: true`) na tentativa normal → só a animação nativa do Face ID, sem 2º popup.
- **Guards** contra duplo prompt: `authInFlightRef` + supressão de re-lock por 2s após desbloqueio (corrige 2º popup causado por background→active no fechamento do prompt).
- `AppLockScreen.tsx`: fundo **vidro fosco claro** `rgba(244,239,234,0.96)` (identidade OLI, não preto; blur real via expo-blur fica pro próximo build nativo). Sem quadro verde no fluxo normal — botão "Desbloquear" só aparece se Face ID falhar.
- **Fallback de código do dispositivo:** após falha, botão "Usar código do dispositivo" (`disableDeviceFallback:false`). Se usado, grava flag `oli_force_password_next` → **próxima sessão exige login e-mail/senha** (cold start consome a flag e faz signOut).
- Reset de senha: **COMPLETO E TESTADO** (16/jun) — `resetPasswordForEmail` com `redirectTo=olihealthhub://nova-senha`; `_layout` intercepta o link de recovery (`src/utils/passwordRecovery.ts`) e roteia pra `app/nova-senha.tsx`. Redirect URLs adicionadas no Supabase; fluxo ponta-a-ponta validado.
- **🐛 Fix deadlock auth (16/jun):** `authStore.ts` `onAuthStateChange` era `async` e fazia `await supabase.from('profiles')` DENTRO do lock de auth → `updateUser`/`signOut` nunca resolviam (salvar nova senha travava no spinner pra sempre). Corrigido: callback síncrono, fetch de profile deferido via `setTimeout(0)` fora do lock. Afetava qualquer signOut/login que coincidisse com o lock — fix geral. OTA prod `a7bb9ead-5012-4e81-84fa-ccb07edc40b4` + preview `8de17401-dd7a-40ad-9146-45b3be33beda`.

## 9. Ciclo de confirmação de e-mail — estado

- `signUp` (`src/services/auth.ts`) com `emailRedirectTo = https://olihealthhub.com.br/confirmado`.
- Páginas no domínio OLI (em `landing/`): `confirmado.html` (sucesso + botão "Voltar ao app" + detecta link expirado) e `privacidade.html` (política + botão voltar).
- Links de privacidade dos 4 templates de email + auth-confirm → `https://olihealthhub.com.br/privacidade`.
- Templates de email: `landing/email-templates/confirm-signup.html` (e reset/magic/invite). Usam `{{ .ConfirmationURL }}`.
- Edge functions `auth-confirm` e `privacy` (supabase) existem como **fallback** mas o fluxo oficial migrou pro domínio OLI.

**⚠️ Pendências do ciclo de email (§11).**

## 10. Limpezas de dados feitas

- Removidas contas/dados de teste: Apple Reviewer, Playwright, pacientes "Demo", pacientes-teste da conta do fundador, reservas-teste.
- Excluído usuário `guilherme@olihealthhub.com.br` (completo).
- Simulador CC **desligado** em produção (mock off). Banco com perfis reais apenas.
- `RELEASE_CHECKLIST.md` na raiz: **desligar mock CC antes de qualquer release público** + passos de ativação CC.

## 10.1. GOOGLE PLAY — status (sessão 14-15/jun)

**Onde está:** AAB de produção no ar em **Internal Testing**.
- Package/Application ID: `com.oli.healthhub`. App signing = **Google Play** (upload key do EAS; não trocar).
- Conta Play Developer = **Individual** (não Organization; sem DUNS). Verificação Google concluída.
- Build atual com ícone corrigido (adaptive icon com margem): EAS build `c0936887` → `.aab`.
- Assets prontos em `assets/play-store/`: `feature-graphic.png` (1024×500), `icon-512.png`, `logo-white.png`, `_render.html` (fonte editável).
- Screenshots: `assets/Print Screen App/selected/` (01..10, nomes por tela; comunidade/perfil com nome/email borrados).
- Textos + respostas de formulário: **`docs/PLAY_STORE_LISTING.md`** (short/full desc pt-BR, Data Safety exato, Content rating IARC, App access, Target audience).

**Falta pra ir a PRODUÇÃO pública (tudo no Console, fundador):**
- App content: **Data Safety** + **Content rating** + **App access** + **Target audience (18+)** + Saúde/Financeiro/Gov — respostas prontas no doc. ⚠️ Confirmar enquadramento "Saúde" (dado de paciente) com jurídico.
- Main store listing: colar desc + subir ícone 512 + feature graphic + screenshots.
- Conta demo dedicada pro revisor Google (só pra produção; internal testing não precisa).
- Regra Google p/ conta nova: produção pública exige **14 dias de closed testing com 12+ testers**. Internal testing **não** tem essa regra.

## 11. PENDÊNCIAS / próximos passos

### ✅ Resolvido na sessão 18/jun (parte 3 — Asaas produção + back Android)
- **💳 Asaas em produção — VALIDADO ponta-a-ponta.** Webhook criado no painel Asaas (URL `…/functions/v1/asaas-webhook`, header token `asaas-access-token`, eventos `PAYMENT_CONFIRMED`+`PAYMENT_RECEIVED`, tipo Sequencial, fila ativa). Secrets `ASAAS_ENV=production` + `ASAAS_API_KEY` + `ASAAS_WEBHOOK_TOKEN` setados (Dashboard). Fluxo testado com módulo a R$5: criar cobrança (`create-charge`) → PIX → pagar → `asaas-webhook` `PAYMENT_CONFIRMED` → `user_modules.status=active` + `admin_notifications`. `asaas-webhook` e `create-charge` têm `verify_jwt=false` (Asaas/app não mandam JWT do Supabase).
  - **⚠️ Aprendizados Asaas:** (a) **mínimo R$5** por cobrança — valores < R$5 retornam `invalid_object`; (b) **PIX em produção exige chave PIX cadastrada** na conta Asaas (sem ela `getPixQrCode` volta vazio e o app não exibe QR); (c) todos os módulos reais são ≥ R$149, então o mínimo R$5 não afeta produção.
  - Cleanup pós-teste: preço do módulo restaurado, `user_modules` de teste removido, tabela `_debug_charge` dropada, `create-charge` revertido pro original (v16).
- **🆕 Tarefa futura:** campo de **cupom de desconto** no checkout (schema `coupons` + validação na Edge Function respeitando mínimo R$5 + UI no CheckoutModal/PlanCheckoutModal + admin). Registrada como background task.
- **🔙 Botão voltar Android** corrigido (commit `897704e`): hook `src/hooks/useAndroidBack.ts` em 7 modais sem `<Modal>` nativo (RoomDetail, Reservation, Encaixe, Reschedule, AddPaciente, QRScanner, PacienteDetail) + `onRequestClose` em PlanCheckoutModal e no Modal de encaixe aninhado. Também: capa do card 84→120px com badge de contagem + tira de miniaturas no RoomDetailModal. OTA prod `66c333c2` / preview `b24299c1`.

### ✅ Resolvido na sessão 18/jun (parte 2 — salas/fotos)
- **🏠 Reestruturação de salas (7 → 9):** tabela `rooms` (fonte de verdade, runtime via `fetchRooms`) reescrita. Nova ordem: **1 Vídeo Conferência · 2 Psicologia · 3 Clínica Geral · 4 Audio Visual · 5/6/7 Clínica Geral · 8 Ginecologia/Estética · 9 Eventos** (nota "por bloco/hora"). `INITIAL_ROOMS` (fallback em `appStore.ts`) e filtro `SPECIALTIES` (`agenda.tsx`) sincronizados. 7 reservas de teste apagadas. `reservations` referencia sala por `room_name` (texto), sem FK — renumerar foi seguro.
- **📷 Fotos das salas refeitas:** 8/9 salas com foto (faltou só **Sala 4 — Audio Visual**, o fundador não tem ainda). Processadas com `sips -Z 1200 -s formatOptions ~78` (JPEG, ~70–130 KB, 1200px largura). Sala 9 (Eventos) clareada via PIL (brilho 1.32 / contraste 1.05). Registradas em `src/utils/roomPhotos.ts` (map estático id→foto[]; cover = 1ª foto). Conteúdo conferido visualmente sala a sala.
- **🐛 Fix layout foto única:** `RoomDetailModal` style `photo` tinha `height:200` sem `width` → RN Image com `resizeMode:cover` renderizava largura 0 ("quebrada"). Add `width:'100%'`. (Carrossel e cover do card já tinham largura.) **Era a causa real do "fotos quebradas".**
- OTA: prod `a063f331-727a-4428-a513-57df6c4c1097` + preview `46dcb504-a6af-4711-b92b-dea0655cef12`.
- ⚠️ Itens/equipamentos das salas novas (Vídeo Conf, Audio Visual, Eventos) = defaults — revisar com fundador.

### ✅ Resolvido na sessão 18/jun
- **🐛 Deadlock auth (crítico):** `authStore.ts` `onAuthStateChange` era `async` + `await supabase.from()` dentro do lock → `updateUser`/`signOut` nunca resolviam (salvar nova senha travava no spinner). Callback agora síncrono, fetch de profile deferido via `setTimeout(0)`. OTA prod `a7bb9ead-5012-4e81-84fa-ccb07edc40b4` + preview `8de17401-dd7a-40ad-9146-45b3be33beda`.
- **Reset de senha:** Redirect URLs adicionadas no Supabase (`olihealthhub://nova-senha`, `olihealthhub://*`, `…/confirmado`) → testado ponta-a-ponta, **funcionando**.
- **Regra de reserva — exige saldo de horas:** só reserva sala com saldo em `hour_balance` (pacote pré-pago OU crédito de indicação — mesma tabela). Helper `hasReservationCredit()` em `financeiroService.ts` (soma todas as linhas não-expiradas); gates em `ReservationModal.handleConfirm` + `EncaixeModal.handleBookRoom`; sem saldo → Alert "Comprar horas" → aba financeiro. ⚠️ **client-side** (ver hardening §11.9). OTA prod `58d8c979-57ae-434a-bbdd-cc6d27bc1cd3` + preview `e0fcfbd7-d8dc-4ed2-8cef-52fdd014a560`.
- **Ícones Dr./Dra.:** trocados símbolos ♂/♀ (`male/female-outline`) por `ribbon-outline` (neutro) no onboarding.
- **Tratamento duplicado:** se `profile.nome` já começa com Dr/Dra (`/^\s*dra?\.?\s/i`), `handleFinish` salva `tratamento=null`; `displayName` em comunidade também guarda (perfis já duplicados). Evita "Dr. Dr. João". OTA prod `52752877-8aa3-4e96-b538-d3bd3be9afbd` + preview `5df4df8c-3ad2-4589-ba3b-e26903ce2715`.
- **Olivia (chatbot):** persona olivia `role` "OLI Health Hub" → **"Assistente Virtual OLI"**.
- **📄 Documento base do negócio:** novo `docs/OLI_BASE.md` (quem somos, produtos, soluções, planos, preços, módulos, condições) — âncora do projeto. Atualizar junto com `src/models/oli-plans.ts` ao mudar preço/plano.
- **Spec de fotos de sala** (pra pendência §11.4): JPEG, **1200×800 px (3:2 horizontal)**, ~80–150 KB; nomes `sala-3.jpg`/`sala-4.jpg`/`sala-5.jpg`/`sala-digital.jpg` em `assets/room-photos/`. Array por sala suportado. `conforto-medico.jpg` (sobrou) ainda sem destino definido.

### ✅ Resolvido na sessão 14-15/jun
- **Netlify**: causa real era **gitlink fantasma `caveman`** (submódulo sem `.gitmodules`) travando o checkout → todo deploy falhava. Removido + `.gitignore`. `netlify.toml` na raiz (`publish=landing`, sem build). `confirmado/privacidade/baixar` agora 200.
- **Reset de senha COMPLETO**: `app/nova-senha.tsx` + `src/utils/passwordRecovery.ts`; `resetPasswordForEmail` com `redirectTo=olihealthhub://nova-senha`; `_layout` intercepta o link de recovery (setSession via fragmento) e roteia. Gate de auth + AppLock não interferem. **Falta só testar 1x ponta-a-ponta + add `olihealthhub://nova-senha` nas Redirect URLs do Supabase.**
- **Eventos Luma REAIS**: lê o feed iCal público (`cal-BHFzthdc75sAu98`, sem API key/sem Plus) em `src/services/luma.ts` (parser RFC5545; extrai link do evento da DESCRIPTION; pula CANCELLED). Era mock antes.
- **Segurança**: `ErrorBoundary` global (Sentry) em `src/components/ErrorBoundary.tsx`; `android.allowBackup=false`.
- **A11y 100%**: 0 touchables sem rótulo (detector custom).
- **Telefone recepção** corrigido: `5511919980777` (fallback em `whatsapp.ts`).
- **Onboarding**: atendimento virou **multi-select** (Presencial e/ou Telemedicina → deriva `ambos`); campo CRM → **"Conselho de classe" opcional** (CRP/CRN/CRO; grava null se vazio); nova pergunta **"assessorias que já possui"** (Contabilidade/Jurídica/Convênios/Marketing) → `profiles.assessorias_atuais text[]`.
- **Admin**: coluna **Assessorias** em `/medicos` (chips verde=tem / cinza=oferta) pra pipeline de upsell.
- **Fotos das salas**: salas 1, 2, 6 no card da agenda (banner) + RoomDetailModal; bundle em `assets/room-photos/` via `src/utils/roomPhotos.ts` (mapa estático id→foto, atualizável por OTA).

### ✅ Resolvido na sessão 23/jun (publicação nas lojas)

- **🎟️ Sistema de cupom de desconto — COMPLETO:**
  - Schema: tabelas `coupons` + `coupon_redemptions` (migration `20260619_coupons.sql`); RPC `validate_coupon` enforça mínimo R$5 Asaas.
  - Edge function compartilhada `supabase/functions/_shared/coupon.ts` (`validateCoupon` + `recordRedemption`).
  - Componente `src/components/CouponField.tsx` (input + apply + remove, callback `onApplied`).
  - `checkoutService.ts`: `validateCouponPreview`, `createModuleCharge`, `createPlanSubscription`, `createHourPackageCharge` — todos aceitam `couponCode`.
  - Admin: `admin/app/cupons/page.tsx` (criar/listar/ativar) + actions `createCoupon`/`toggleCoupon` + sidebar "Cupons".
  - OTA prod + preview (autorizado pelo fundador, testado com sucesso).

- **📋 Seção "Seus serviços" em meu-plano.tsx** — componente `SeusServicos` com `ServiceRow` mostrando módulos ativos, plano e pacotes de horas.

- **🐛 Fix onboarding loop no login e-mail/senha:**
  - Race condition: `onAuthStateChange` deferria fetch de profile via `setTimeout(0)`, mas o gate de routing em `_layout.tsx` rodava antes do profile chegar → redirecionava pro onboarding.
  - Fix: flag `profileLoaded: boolean` no `authStore`. Gate só roteia quando `profileLoaded=true`. OTA autorizado pelo fundador.

- **🤖 Conta demo para revisor Google Play criada:**
  - `revisor.google@olihealthhub.com.br` / `RevisorOLI@2026`
  - Plano BASE, onboarding completo, 1 paciente demo, 1 reserva (Sala 5, agendado).
  - UUID: `9f29d91d-7243-4449-93f0-8387fe46d6e6`

- **📱 Google Play — progresso (23/jun):**
  - Data Safety: preenchido (nome, e-mail, IDs, financeiro, saúde, fotos, diagnóstico, device ID).
  - App content: ID publicidade (não usa), Apps de saúde (declarado).
  - App access: credenciais revisor adicionadas.
  - Categoria: Negócios.
  - Main store listing: textos colados (descrição curta/longa, política de privacidade).
  - Assets: `icon-512.png` (512×512), `feature-graphic.png` (1024×500), 10 screenshots Android (720×1600) em `assets/Print Screen App/selected/`.
  - **Build versionCode 2** em fila (`f4e9242b`) — versionCode 1 conflitava com release anterior. `app.json` android adicionou `"versionCode": 2`, `eas.json` mudou `appVersionSource: local`.
  - ⚠️ Quando build terminar: baixar AAB, subir no Play Console (teste fechado), adicionar 12+ testadores.

- **🍎 App Store Connect — progresso (23/jun):**
  - Build iOS `2ea6728b` (1.0.0 build 1) já no TestFlight.
  - Screenshots iOS capturadas (12 prints 1290×2796 iPhone Pro Max) em `assets/Print Screen App iOS/selected/`.
  - ⚠️ Pendente: upload screenshots + preencher Description/Keywords/Support URL + App Privacy + Submit for review.
  - ⚠️ App Store Connect instável na sessão (sessão caindo/erro ao carregar apps) — retomar quando estável.

- **🔑 Sentry DSN configurado:** `EXPO_PUBLIC_SENTRY_DSN` setado em `.env`.

### 🔴 Em aberto
1. **Config Supabase dashboard** (em `Authentication`):
   - ✅ `URL Configuration` → **Redirect URLs** adicionadas (`olihealthhub://nova-senha`, `olihealthhub://*`, `https://olihealthhub.com.br/confirmado`). **Reset de senha testado ponta-a-ponta e FUNCIONANDO (16/jun).**
   - `Sign In / Providers` → Email → **Confirm email = ON**; min password length = 8.
   - `Emails` → Confirm signup: colar `landing/email-templates/confirm-signup.html` (e reset-password.html).
   - Leaked password protection = só plano Pro (pulado).
2. ~~**🔴 Asaas sandbox → produção**~~ ✅ **RESOLVIDO 18/jun** (ver §11 resolvidos). Cobranças reais funcionando ponta-a-ponta.
3. **Sentry DSN ausente** → lançamento cego a crashes. Setar `EXPO_PUBLIC_SENTRY_DSN` (build-time → precisa OTA/rebuild).
4. **Foto sala faltando**: só **Sala 4 (Audio Visual)** + destino do `conforto-medico.jpg` (sobrou, não-sala). Quando chegar: solta em `assets/room-photos/` como `4a.jpg`/`4b.jpg`, processa com `sips -Z 1200 -s formatOptions 78 4a.jpg --out sala-4.jpg`, registra em `roomPhotos.ts` (key `4`), `eas update`.
5. **Play produção**: ver §10.1 (Data Safety/rating/listing + 14d closed testing).
6. **`oli_encrypt`/`oli_decrypt`** executáveis por qualquer authenticated (advisor) — revisar/restringir.
7. **Communicare**: aguardar token + endpoint LISTA + status + webhook. Depois remontar card da agenda.
8. **VIP** preço; **Cron** auto-desativar START 30d sem reserva; **expo-blur** lock screen (rebuild nativo).
9. **🔒 Gate de reserva server-side (hardening):** regra "só reserva com saldo de horas" hoje é **client-side** (`hasReservationCredit` em `financeiroService.ts`, gates em ReservationModal/EncaixeModal). `createReservation` insere direto via RLS → bypass possível. Blindar com trigger/policy no insert de `reservations` checando `hour_balance` não-expirado.
10. **🆕 Salas de Evento + Conferência (roadmap)** — adicionar 2 tipos de sala com cobrança **por bloco/hora** (NÃO minutagem — evento é planejado, bloco = receita previsível). Benchmark cowork médico SP: conferência 6–12 pax R$ 80–300/h; evento/workshop 20–40 pax R$ 150–500/h (diária 4h R$ 800–1.500). **Proposta:** Conferência **R$ 150/h** (mín 1h); Eventos **R$ 280/h** ou pacote 4h **R$ 960** (mín 2h). Impl: novo `room_type` com `hourly_rate` + `min_duration` em vez de `cost_per_minute`; reserva por bloco (sem timer de minutagem). Validar preço final com fundador.

### Regra de atualização (importante)
- **JS/assets** (telas, lógica, fotos via require, Luma, reset) → **OTA** (`eas update` nos 2 canais). Sem loja.
- **Nativo** (`app.json` android/ios, permissões, ícone, SDK, versão) → **rebuild AAB** + submit.
- **Secret de Edge Function** (Asaas, CC token) → muda no Supabase, vale na hora.
- **`EXPO_PUBLIC_*`** (Sentry, Luma) → está no bundle → OTA/rebuild.

## 12. Convenções (do CLAUDE.md)

- TypeScript estrito, sem `any`, sem `console.log` em produção.
- Estilos em `StyleSheet.create()`, sem objetos inline no JSX.
- `professionalId` sempre explícito nas ops Supabase.
- Componentes PascalCase, telas kebab-case, mudanças cirúrgicas.
- LGPD: CPF nunca em texto puro (hash SHA-256); dados de saúde = sensíveis (Art. 11); consentimento com timestamp; audit log (Art. 37); export/delete (Art. 18).

## 13. Comandos úteis

```bash
# OTA nos dois canais (rodar após mudança no app)
eas update --branch production --message "..." --non-interactive
eas update --branch preview --message "..." --non-interactive

# Testar integração CC localmente (mock)
echo "EXPO_PUBLIC_COMMUNICARE_MOCK=true" >> .env   # LEMBRAR de remover antes de release

# Typecheck
npx tsc --noEmit              # app
cd admin && npx tsc --noEmit  # admin

# QA harness Communicare (30 usuários)
node --experimental-strip-types scripts/test-communicare.ts
```

---

**Resumo de 1 linha (23/jun):** Sessão focada em **publicação nas lojas**. Implementados: **sistema de cupom de desconto** (schema+edge+UI+admin, testado), **"Seus serviços"** em meu-plano, **fix onboarding loop** (flag `profileLoaded`), **conta demo revisor Google** (`revisor.google@olihealthhub.com.br`/`RevisorOLI@2026`). Play Console: Data Safety+App content+listing preenchidos; **build versionCode 2 em fila** (`f4e9242b`) — quando terminar, subir AAB + adicionar 12 testadores. App Store Connect instável na sessão; screenshots iOS prontas em `assets/Print Screen App iOS/selected/`; pendente upload+metadata+submit. Pendências principais: **AAB versionCode 2 → Play Console** + **App Store Connect listing+submit** + Confirm email/templates Supabase + foto Sala 4 + gate reserva server-side.
