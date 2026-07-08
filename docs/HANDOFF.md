# OLI Health Hub — Handoff Completo

> Documento de contexto para replicar o estado do projeto em outro chat.
> Última atualização: 8/Julho/2026.

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

## 10.1. GOOGLE PLAY — status (atualizado 23/jun sessão 2)

**Onde está:** `versionCode 2` (1.0.0) em **Closed Testing (Alpha) — Google APROVOU a revisão (23/jun)**.
- 12 testers adicionados e conectados. Testers precisam instalar o app via link de opt-in para iniciar o contador de 14 dias.
- Package/Application ID: `com.oli.healthhub`. App signing = **Google Play** (upload key do EAS; não trocar).
- Build: EAS `f4e9242b` → AAB entregue no Play Console.
- Assets: `feature-graphic.png` (1024×500), `icon-512.png`, screenshots (10 prints 720×1600) em `assets/Print Screen App/selected/`.
- Textos: `docs/PLAY_STORE_LISTING.md` (short/full desc, Data Safety, Content rating IARC, App access, target audience).
- Conta demo revisor: `revisor.google@olihealthhub.com.br` / `RevisorOLI@2026` (plano BASE, onboarding completo).

**Próximo passo (fundador):**
1. Enviar link de opt-in do closed testing para os 12 testers → contador de 14 dias começa com o primeiro opt-in.
2. Após 14 dias → Play Console → Teste fechado → Promover para Produção.

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

### ✅ Resolvido na sessão 23/jun (sessão 2 — admin, DB, fonte única de verdade)

- **🔒 Gate de reserva server-side — RESOLVIDO** (fecha §11.9): trigger PostgreSQL `trg_check_reservation_credit` BEFORE INSERT em `reservations`. Checa `hour_balance` não-expirado (minutosLivres > 0). Bypass liberado para `service_role` (admin pode criar reservas de cortesia). Migration `20260623_reservation_credit_gate` aplicada e verificada.

- **🔒 oli_encrypt/oli_decrypt restrito — RESOLVIDO** (fecha §11.6): EXECUTE revogado de `authenticated` via migration `20260623_restrict_oli_crypto_functions`. Funções agora só acessíveis por `postgres` e `service_role`. App nunca chamava client-side — apenas `database.types.ts` as listava como tipos.

- **🗑️ Limpeza de dados de teste no DB:**
  - `usage_charges`: 12 registros de teste do fundador (sessão Asaas 12/jun, R$156 cada) → **deletados** (0 restantes).
  - `profiles` de teste: `thhibk`, `Test User` (×2) → **deletados de `auth.users`** com cascade completo (profiles, subscriptions, reservations, audit_logs, etc.).
  - `hour_balance`: 2 entradas legítimas preservadas (Guilherme com charge Asaas real, Nathalia com crédito cortesia).

- **💣 Hard delete no admin:** `hardDeleteUser()` em `admin/app/actions.ts` — limpa FKs sem CASCADE (`coupon_redemptions`, `coupons.created_by`, `profiles.referido_por`), depois `auth.admin.deleteUser()` que cascata tudo. Zona de perigo vermelha adicionada no `MedicoManagementCard` com modal de confirmação explícita. Diferente de `softDeleteUser` (status='deleted', dados preservados).

- **🏢 Admin salas dinâmicas:** `admin/app/salas/page.tsx` — array de 7 salas hardcoded substituído por fetch da tabela `rooms`. Paleta de cores por posição (PALETTE[idx]). Todas as 9 salas agora aparecem corretamente.

- **🏷️ Admin labels financeiro corrigidos:** tab "Pagamentos" → "Recebimentos", tab "Contas" → "Faturas", H2 atualizado, `/pagamentos` heading → "Minutagem por Sessão".

- **💰 Pacotes de horas — fonte única DB:**
  - DB corrigido: `hour_packages` tinha preços com desconto por volume (R$1.100, R$2.000, R$3.600) diferentes do app (R$140/h fixo). Corrigido para R$140, R$1.400, R$2.800, R$5.600.
  - Coluna `bonus_horas` adicionada (`0, 1, 2, 4` por pacote).
  - Admin: coluna "Bônus" adicionada na tabela do catálogo (`admin/app/catalogo/`).
  - App: `fetchHourPackages()` em `financeiroService.ts` busca do DB em runtime. `HOUR_PACKAGES` hardcoded removido de `financeiro.tsx`. `HourPackagePickerModal` recebe `packages` como prop.

- **🧩 Módulos — preços do DB:**
  - Coluna `slug` adicionada em `modules` (`communicare`, `contabil_mello`, `ar_credenciamento`, `ar_gestao_mensal`, `ar_operadora_adicional`, `scribe_ia`).
  - `src/services/moduleService.ts` criado: `fetchModulePricing()` busca por slug.
  - `ecossistema.tsx`: `MODULE_CATALOG` mantém metadados (ativação, features, logos); preços sobrescritos em runtime com dados do DB via `modulePriceMap`. `buildModuleLabel()` formata valor/tipo para displayLabel.

- **Regra arquitetural estabelecida:** Admin é a **única fonte de verdade** para preços de pacotes de horas e módulos. Alteração no painel → DB atualiza → app reflete na próxima abertura. Zero código.

- **Commits desta sessão:** `681db32`, `de5e8de`, `76ba201` (branch `main`, deployados na Vercel).

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

- **🍎 App Store Connect — progresso (23/jun sessão 2):**
  - Build iOS `2ea6728b-27bc-4aac-b447-37c91fb6ad3e` (1.0.0) já no TestFlight.
  - Bundle ID `com.oli.healthhub` confirmado registrado na Apple.
  - Screenshots iOS prontas: 12 prints 1290×2796 iPhone Pro Max em `assets/Print Screen App iOS/selected/`.
  - `eas submit --platform ios --id 2ea6728b-27bc-4aac-b447-37c91fb6ad3e` — **falhou com Internal Server Error 500 da Apple** (servidores ASC instáveis). Retentativas esgotadas.
  - ⚠️ **Pendente: re-rodar o mesmo comando quando ASC estabilizar.** Não precisa rebuild — o build está no EAS, o comando é direto.
  - ⚠️ Após submission aceita: preencher na versão do ASC → Description, Keywords, Support URL, Screenshots, App Privacy → Submit for Review.

- **🔑 Sentry DSN configurado:** `EXPO_PUBLIC_SENTRY_DSN` setado em `.env`.

### ✅ Resolvido na sessão 7-8/jul (página de recebimento + feed social)

- **💰 Página pessoal de recebimento do founder** — `admin/app/meu-recebimento/page.tsx`, restrita por e-mail (`guilherme.pasquetti@gmail.com`, `notFound()` pra qualquer outro admin; link na sidebar só aparece pra ele). Calcula salário-base (R$4.000 até ago/2026, R$6.000 a partir de set/2026 **só se** `CONTRATO_RENOVADO=true` no topo do arquivo) + comissão em alíquota única (cliff) sobre faturamento total do mês conforme ocupação de sala: 8% até 30%, 12% até 60%, 15% acima. Ocupação = horas reservadas ÷ (salas × dias do mês × 15h), mesma métrica do Mapa do Dia. **Lembrete agendado pra 05/09/2026** perguntando se o contrato foi renovado (pra virar o switch do salário). Commit `158fb6d`.

- **📱 Feed social interno na Comunidade** — `comunidade.tsx` ganhou switcher **Feed / Colegas** (era só diretório antes) com **swipe horizontal** pra trocar de aba (`PanResponder` nativo, sem lib nova) + animação de slide. Feed: posts de texto livre (sem categoria fixa), curtir, comentar (1 nível, sem thread), autor apaga próprio post. Schema novo: `community_posts`/`community_post_likes`/`community_post_comments` com RLS (bloqueia post de usuário `comunidade_banned` — reusa coluna de moderação que já existia). Migration `20260707_community_feed.sql` aplicada em produção. Novo `src/services/communityService.ts`, componente `src/components/community/PostFeed.tsx`.
  - **Admin:** `/comunidade` lista todos os posts + apaga qualquer um (moderação), link na sidebar.
  - **Cards de profissional enriquecidos:** `profiles` ganhou colunas `whatsapp` + `subespecialidades` (text[]). Editáveis em `perfil.tsx` (WhatsApp como `EditableRow`, subespecialidades via `TagInput.tsx` novo — até 5 tags livres). Aparecem no `ProfessionalDetailModal` (WhatsApp em REDES SOCIAIS, subespecialidades em card próprio).
  - **🐛 Fix Instagram duplicando `@`:** placeholder sugeria digitar com `@`, mas exibição já prefixava `@` → ficava `@@handle`. Corrigido nos 3 pontos: `perfil.tsx` salva sem `@` (`.replace(/^@/, '')`), exibição e link do card também normalizam (defensivo pra quem já salvou torto antes do fix).
  - **Fora de escopo (registrado, não construído):** compartilhar/repost, mídia em post, notificação push de curtida/comentário, edição de post, busca por subespecialidade, swipe entre as abas inferiores do app (só dentro de Comunidade por ora — mudar a navegação principal é risco maior, ver pedido do fundador).
  - Commit `458f805` (feature) + `0d8db0d` (handoff anterior). **OTA ainda não enviada** — só testado via `expo start` local (LAN/hotspot + Expo Go) nesta sessão.

- **🐛 Fix Expo web SSR quebrando (achado ao testar preview):** `expo-secure-store` e o storage do Supabase Auth (`AsyncStorage`→`localStorage`) não têm guard pra ambiente SSR do Expo web (`window` indefinido em Node) — crash total ao abrir `expo start --web`. Guard `Platform.OS==='web'` adicionado em `src/services/supabase.ts` e novo `src/utils/secureStoreWeb.ts` (usado por `useAppLock.ts` + `communicareSSO.ts`). **Zero efeito no app nativo** (guard só ativa em `Platform.OS==='web'`, que o app não usa em produção — só ajuda quem quiser rodar preview web local). App não tem alvo web oficial (só iOS/Android); outros módulos nativos (câmera, picker etc.) provavelmente ainda quebram no preview web, não foram testados.

### 🔴 Em aberto
1. **Config Supabase dashboard** (em `Authentication`):
   - ✅ `URL Configuration` → Redirect URLs adicionadas. Reset de senha FUNCIONANDO.
   - ✅ `Sign In / Providers` → Email → Confirm email = ON; min password 8.
   - ✅ `Emails` → Templates `confirm-signup.html` + `reset-password.html` configurados (OLI-branded, verde/dourado).
2. ~~**🔴 Asaas sandbox → produção**~~ ✅ **RESOLVIDO 18/jun**.
3. ~~**Sentry DSN ausente**~~ ✅ **RESOLVIDO** — `EXPO_PUBLIC_SENTRY_DSN` setado em `.env`.
4. **Foto sala faltando**: só **Sala 4 (Audio Visual)**. Quando chegar: `assets/room-photos/4a.jpg`, processa com `sips -Z 1200 -s formatOptions 78 4a.jpg --out sala-4.jpg`, registra em `roomPhotos.ts` (key `4`), `eas update`.
5. **Play Store produção**: Google aprovou closed testing. **Enviar link de opt-in aos 12 testers** → aguardar 14 dias → promover para produção. Ver §10.1.
6. ~~**`oli_encrypt`/`oli_decrypt`**~~ ✅ **RESOLVIDO 23/jun** — EXECUTE revogado de `authenticated`.
7. **Communicare**: aguardar token + endpoint LISTA + status + webhook. Depois remontar card da agenda.
8. **VIP** preço; **Cron** auto-desativar START 30d sem reserva; **expo-blur** lock screen (rebuild nativo).
9. ~~**🔒 Gate de reserva server-side**~~ ✅ **RESOLVIDO 23/jun** — trigger `trg_check_reservation_credit` BEFORE INSERT.
10. **🆕 Salas de Evento + Conferência (roadmap)** — cobrança por bloco/hora (NÃO minutagem). Conferência R$150/h (mín 1h); Eventos R$280/h ou 4h R$960. Impl: `room_type` + `hourly_rate` + `min_duration`. Validar preço com fundador.
~~11. **🍎 App Store Connect**~~ ✅ **RESOLVIDO** — argumento 3.1.5(b) (serviço físico) **aceito pela Apple**. App **publicado** na App Store.
~~12. **OTA pendente**~~ ✅ **ENVIADA (6/jul)** — commit `8f55c8b`. Update group ID prod `502b009d-44a8-479f-9c46-3b9dad0924df` / preview `5086acf8-73b1-4ec5-8caf-6122019559a0`. Inclui: welcome screen, fix Face ID routing, fix Dr./Dra. (ícone neutro + anti-duplicação), preços DB.
13. **Login social (Google + Apple)** — deferido para após aprovação da produção. Requer rebuild nativo (versionCode 3). Ver memory `project-roadmap`.
14. **🆕 OTA pendente (feed social)** — commit `458f805` só testado localmente (`expo start`), não foi pra produção/preview ainda. Rodar `eas update` nos 2 canais quando aprovado.
15. **🆕 Lembrete 05/09/2026** — tarefa agendada pra perguntar se contrato renovou (salário founder 4000→6000). Ver `admin/app/meu-recebimento/page.tsx` (`CONTRATO_RENOVADO`).

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

**Resumo de 1 linha (23/jun sessão 1):** Sessão focada em **publicação nas lojas**. Implementados: **sistema de cupom de desconto** (schema+edge+UI+admin, testado), **"Seus serviços"** em meu-plano, **fix onboarding loop** (flag `profileLoaded`), **conta demo revisor Google**. Play Console: Data Safety+listing preenchidos; build versionCode 2 (`f4e9242b`) entregue + 12 testers adicionados. App Store Connect instável; screenshots iOS prontas.

**Resumo de 1 linha (23/jun sessão 2):** Sessão focada em **segurança, qualidade de dados e fonte única de verdade**. Resolvidos: gate de reserva server-side, oli_encrypt restrito, limpeza de teste (12 usage_charges + 3 contas), hard delete admin, salas dinâmicas admin, labels financeiro, pacotes de horas + módulos lidos do DB em runtime. **Play Store: Google aprovou closed testing** — enviar link de opt-in aos 12 testers → aguardar 14 dias. **App Store Connect: `eas submit` falhou com 500 da Apple** — re-rodar `eas submit --platform ios --id 2ea6728b-27bc-4aac-b447-37c91fb6ad3e` quando ASC estabilizar, depois preencher metadata + submit for review. Pendências: OTA production + ASC metadata+submit + foto Sala 4.

**Resumo de 1 linha (6/jul):** Sessão focada em **publicação iOS e UX de entrada**. Screenshots iOS redimensionadas para 1284×2778 (`assets/Print Screen App iOS/resized-65/`). ASC preenchido (metadata pt-BR, App Privacy, Medical, Free) e build 1.0.0(1) submetido → rejeitado 3.1.1 (IAP) → argumento 3.1.5(b) serviço físico enviado à Apple → **aceito, app publicado na App Store**. `buildNumber` iOS atualizado `1→2` (próximo rebuild). Fix ícones Dr./Dra. no onboarding (prop `flex` no `OptionCard`). Nova tela `app/welcome.tsx` (boas-vindas antes do login). Fix Face ID loop: `session && (inLogin || inWelcome)` no routing do `_layout.tsx`. **OTA acumulada ainda não enviada** — rodar agora que app está publicado.

**Resumo de 1 linha (7-8/jul):** Sessão focada em **página de recebimento do founder + feed social na Comunidade**. OTA da sessão 6/jul enviada (`8f55c8b`, groups `502b009d`/`5086acf8`). Nova `/meu-recebimento` no Admin (salário+comissão por ocupação, só o founder vê, lembrete agendado 05/09 pra checar renovação de contrato). Comunidade virou parcialmente rede social: feed de posts (curtir/comentar), switcher Feed/Colegas com swipe, WhatsApp+subespecialidades no perfil/card, moderação de posts no Admin. Fix bug de `@` duplicado no Instagram. Testado ponta-a-ponta em device real via `expo start` (LAN de casa não funcionou por isolamento de rede — contornado com hotspot do Mac e depois WiFi da clínica). Achado e corrigido de brinde: crash de SSR no Expo web (Supabase/SecureStore sem guard pra `window` indefinido) — não afeta o app nativo. **Pendente: OTA do feed social ainda não enviada** (commit `458f805`).
