# OLI Health Hub — Handoff Completo

> Documento de contexto para replicar o estado do projeto em outro chat.
> Última atualização: 21/Julho/2026.

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

**⚠️ Não confundir com:** o **Programa de Indicação de Parceiros Externos** (sessão 21/jul, ver §11 item 19) é outra coisa — comissão em R$ pra parceiros comerciais (ex.: distribuidores) que trazem profissionais novos. Mecanismo de atribuição do piloto (Marangos) reaproveita esta mesma infra (`user_type='partner'` + `referral_code` + `?ref=`), mas o cálculo/pagamento de comissão ainda não tem tela própria. Este §7 é o programa peer-to-peer entre médicos, já em produção.

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

**✅ PUBLICADO EM PRODUÇÃO (13/jul).** Faixa Produção configurada (países/regiões + versão) e enviada — app live na Google Play Store. Sem próximo passo pendente aqui.

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

### ✅ Resolvido na sessão 8/jul (sessão 2 — onboarding enxuto, gamificação Olicoins, fix RLS avatar)

- **🐛 Fix upload de foto de perfil quebrado:** bucket `avatars` no Storage só tinha policies INSERT/UPDATE/DELETE, faltava **SELECT**. 1º upload de cada usuário funcionava (INSERT puro), mas trocar foto já existente usa `upsert:true` → vira `INSERT...ON CONFLICT DO UPDATE`, que exige o Postgres enxergar a linha conflitante via policy SELECT — sem ela, RLS bloqueava com `new row violates row-level security policy`. Migration `avatar_select_own_policy` (policy SELECT restrita à própria pasta, igual as outras). **Resolvido em produção**, sem mudança de código.
- **🐛 Fix miniaturas de foto de sala:** `RoomDetailModal` — thumbnails abaixo do carousel principal eram só decorativas (clique não fazia nada, só swipe funcionava). Agora tocar na miniatura chama `scrollTo` no carousel + borda verde marca a ativa.

- **🎯 Onboarding enxuto:** reduzido de 5 steps (~1400 linhas) pra 1 tela — WhatsApp (obrigatório) + CRM/conselho (opcional) + tratamento Dr./Dra. Indicação por `?ref=` resolvida em silêncio (sem UI). O resto (atendimento, situação jurídica, financeiro, como conheceu) saiu do onboarding e virou missão gamificada dentro do app, editável em **Perfil → Editar** (novos `SelectRow`/`ToggleRow` reaproveitando o mesmo padrão do WhatsApp).

- **🪙 Sistema de gamificação Olicoins** (nome interno pro programa de recompensas — conceito de resgate/câmbio pra R$ ainda **não definido**, registrado como pendência):
  - `olicoins_ledger` (migration): ledger append-only, evento único por profissional (idempotente — creditar 2x não duplica).
  - `src/utils/profileSections.ts`: **10 seções de perfil** (atendimento/jurídico, atividade/local, financeiro, como conheceu, foto de perfil, bio, rede social, subespecialidades, visita agendada, plano pago).
  - `src/services/olicoinsService.ts`: **11 objetivos de ação** (1ª reserva, 1º paciente, 1º post, indicação enviada, módulo ativo, 1º atendimento realizado, 1º pacote de horas, curtir, comentar, ativar MFA, fechar plano anual) — reconciliados automaticamente ao abrir o Início (retroativo pra quem já tinha feito antes de existir a feature).
  - `src/services/achievementsService.ts`: **5 trilhas de conquista por quantidade** (reservas, pacientes, engajamento comunidade, horas de sala usadas, pacotes de horas comprados), tiers Bronze/Prata/Ouro/Platina, mesmo ledger.
  - `app/completar-perfil.tsx`: hub "Seus objetivos" — grid de medalhas redondas (sem card de fundo, só círculo+texto), separado em 3 seções com divisória e contador X/Y. Cada medalha mostra descrição de como completar + chip "🪙+X" quando pendente.
  - `ProfileCompletionCard` (Início + Perfil): barra de progresso com shimmer contínuo + respiração de brilho (efeito "líquido subindo"), nunca some — vira dourada quando 100%.
  - `OlicoinsBadge`: contador animado (conta pra cima + "pop" ao ganhar), visível no header do Início e do Perfil.
  - `OlicoinsToast`: toast "+X Olicoins!" ao completar seção/objetivo.
  - Ícone: `FontAwesome5 coins` (moedinha), não bitcoin.
  - Badge "Perfil completo" no card da Comunidade quando os 20 objetivos de perfil+ação (não conta conquistas) estão feitos.
  - **Pendente:** streak de dias consecutivos ativo (precisa trigger Postgres + fundador definir o que conta como "dia ativo") e selos customizados com significado próprio (hoje são ícones genéricos Ionicons) — ambos registrados em memory `project-roadmap`.

- **📅 Badge flutuante "Agendar visita"** (`CalendlyVisitBadge`, Início): linka pro Calendly (`calendly.com/olihealthhub/atendimento-presencial`). Fecha com X mas volta a cada abertura do app até 1º agendamento. **Modo otimista** (marca `profiles.visita_solicitada_em` ao clicar, sem confirmação real) — plano Calendly é free, sem API/webhook disponível pra confirmar de verdade.

- **🐛 Achado, registrado, não corrigido:** NPS picker pós-checkout (`app/(tabs)/index.tsx` `recentPatients`) mostra os 6 últimos pacientes CADASTRADOS, não os atendidos NAQUELE DIA. Fix real: derivar de `todayReservations` (já existe no mesmo arquivo). Ver memory `project-roadmap`.

- Commits `5eaab52` (fix fotos sala) + `5ac50a5` (feature onboarding+gamificação). **OTA enviada** — prod `c0170fc2-d00b-4458-a0e2-718c297f6709` / preview `8d701be8-7c74-480c-bf0b-61417d48bd6b`.

### ✅ Resolvido na sessão 12/jul (sábado liberado + push notifications + localização)

- **🗓️ Sábado liberado no mesmo horário dos dias úteis:** `ReservationModal`, `RescheduleModal` e `EncaixeModal` bloqueavam sábado junto com domingo (`getDay()===0 || getDay()===6`). Agora só domingo fecha — sábado usa o mesmo 08:00–18:30 e mesma lógica de slots. Commit `8a1e5fd`. OTA prod `789d4a6f-dd8b-45d8-916f-f0444b3e1a9d` / preview `1f3d207a-0862-4876-8712-606c594091cb`.

- **🔔 Push notifications remotas — ativo, sem precisar de rebuild** (`expo-notifications` já estava no binário publicado, foi tudo por OTA):
  - `push_tokens` (migration): 1 token por device/profissional, RLS própria linha (select/insert/update/delete só o dono).
  - `src/services/pushService.ts`: `registerPushToken` no login (Início), `unregisterPushToken` no logout (Perfil).
  - Edge function `send-push` (deployada, v1 ACTIVE): aceita JWT de admin OU `service_role`, dispara via Expo Push API em chunks de 100, limpa tokens mortos (`DeviceNotRegistered`).
  - **Admin → Notificações** (`/notificacoes`, novo item na sidebar): formulário de broadcast manual (título+mensagem pra todos os devices), usa `createSupabaseAdmin` direto — não depende do secret abaixo.
  - **3 campanhas automáticas** via `pg_cron` + `pg_net` (extensões habilitadas nesta sessão): `push_lembrete_reserva_amanha` (diário 18h BRT — quem tem reserva amanhã), `push_reacao_inatividade` (diário — 7 e 14 dias sem login, via `auth.users.last_sign_in_at`), `push_objetivos_pendentes` (segunda-feira — nudge de perfil incompleto, replica em SQL puro as 10 seções de `profileSections.ts`).
  - **✅ RESOLVIDO (15/jul):** secret `service_role_key` criado no Vault. **Pegadinha encontrada:** projeto já migrou pro sistema novo de API keys (Settings → API Keys → aba "Publishable and secret API keys") — a key JWT legacy (`eyJ...`, aba "Legacy") **não bate mais** com o `SUPABASE_SERVICE_ROLE_KEY` que as Edge Functions recebem em runtime (retornava 401 "Invalid token"). A key certa é a **secret key nova** (`sb_secret_...`, seção "Secret keys" → linha `default`). Testado ponta-a-ponta via `call_send_push()` direto no SQL Editor → `send-push` retornou 200 `{"sent":2,"total":2,"removed":0}`, push real recebido em 2 devices do fundador. **Lição:** em projetos Supabase migrados pro novo sistema de keys, sempre usar a aba "Publishable and secret API keys" (não "Legacy") ao configurar `service_role_key` em qualquer lugar (Vault, `.env`, CI) — a legacy JWT ainda aparece no dashboard mas não é mais o valor ativo em runtime.

- **📍 Localização sutil — código pronto, mas INERTE até rebuild nativo** (`expo-location` é módulo novo, não linkado no binário atual, não vai por OTA):
  - `src/services/locationService.ts` (`captureCityFromLocationOnce`): pede permissão 1x (nunca reprompta — usa o próprio estado do SO pra saber se já foi decidido), reverse-geocode só pra preencher `profiles.cidade_uf` quando vazio. Zero tracking contínuo, zero coordenadas salvas.
  - Chamado silenciosamente no Início junto do registro de push token.
  - `app.json`: `NSLocationWhenInUseUsageDescription` (iOS) + `ACCESS_COARSE_LOCATION` (Android) + plugin `expo-location`, **versionCode/buildNumber bumped pra 3** — batched com o login social que já estava na fila (evita 2 submissions separadas pra loja).
  - **Ativa só depois do próximo `eas build` + submit.** Testar em device real antes de submeter (Expo Go/`expo start` não tem o módulo nativo linkado).

- Commit `08406a3`. **OTA enviada** — prod `9ea30a10-6654-4898-aff5-818d6ca7955e` / preview `ad274cb8-2665-4710-a1d3-40e4f478244c`.

### 🔴 INCIDENTE resolvido (13/jul) — app não abria em produção (iOS)
- **Causa:** `app/(tabs)/index.tsx` chamava `captureCityFromLocationOnce` (import `expo-location`) direto no mount do Início. Módulo nativo **não estava linkado** no binário publicado (App Store + Play Store) — só entra no próximo rebuild (versionCode/buildNumber 3). Import de módulo nativo não-linkado derrubava a tela Início pra quem recebeu a OTA de 12/jul → `ErrorBoundary` global capturava ("Algo deu errado") e reabria em loop; alguns casos nem chegavam a mostrar o fallback.
- **Fix:** removida a chamada + import em `index.tsx` (commit `c9574f5`). `src/services/locationService.ts` mantido intacto — reativar (re-adicionar a chamada) só depois do próximo `eas build` que compile `expo-location`.
- **OTA hotfix enviada** — prod `b5530d83-ec12-48eb-a284-35693dca1637` / preview `be16775c-2382-414d-89b6-230c31329dbf`.
- **Lição:** código que depende de módulo nativo novo (adicionado via `app.json` plugin) **não pode ser chamado em caminho ativo** antes do rebuild nativo correspondente ir pra loja — só o `import`/require já quebra em binários antigos, mesmo com try/catch na função (o import roda fora do catch). Daqui pra frente, features assim devem ficar behind um guard explícito (feature flag ou try/catch no import dinâmico) até confirmar que o build com o módulo nativo já está em produção.

### ✅ Resolvido na sessão 15/jul (base de usuários limpa + perfis de equipe)

- **🧹 Limpeza da base de usuários:** dos 17 profiles existentes, excluídos 7 (hard delete): `alciambelli@gmail.com` (admin sem função clara), `revisor.google@olihealthhub.com.br` (conta demo Google Play), `idp24g38b0hhf2eg1yt@icloud.com` (conta do App Review Apple), `meloi.michelle@gmail.com` + `mi_eloi@hotmail.com` (Michelle Eloi duplicada), `mi.marangos@gmail.com` + `gui.pasquetti@gmail.com` (a pedido do fundador). Ficaram **10 contas**: founder + 9 profissionais reais. Zero dependência órfã (checado `referido_por`/`coupons.created_by`/`coupon_redemptions` antes de cada delete).

- **🆕 Feature: Perfis de Equipe (founder/especialista/parceiro)** — hoje `profiles` só modelava médico (CRM, especialidade clínica etc.); founder e os especialistas do chatbot (Ana Luiza, Isabella, Amanda, Ronaldo, Olivia — hoje só personas hardcoded em `app/chatbot.tsx`, sem presença na Comunidade) não tinham onde existir. Implementado:
  - Migration `20260715_team_profile_types.sql`: `profiles_user_type_check` liberado pra `founder`/`specialist`/`partner` (além de `subscriber`/`hour_user`/`admin`). `plan` continua `START` pra esses perfis (irrelevante, só não aparece badge de plano).
  - `admin/app/actions.ts`: `createTeamProfile` (cria `auth.users` interno via `auth.admin.createUser`, sem e-mail de convite — usa `inviteUser`/`inviteUserByEmail` só pra usuários reais) + `updateTeamProfileFields` (whitelist update, mesmo padrão de `updateProfileFields`). Ambas **zeram sempre** `tratamento`/`crm`/`subespecialidades`/`tipos_atendimento`/`convenios` — perfil de equipe nunca carrega campo clínico, mesmo convertendo um médico existente.
  - Admin: nova área `/equipe` (lista, `/equipe/novo`, `/equipe/[id]` com zona de perigo pra hard delete). Sidebar novo item "Equipe". `/medicos`, dashboard e `/planos` agora excluem esses `user_type` das contagens/listas.
  - `/usuarios`: seletor "Converter em Equipe" (Founder/Especialista/Parceiro) tanto na tabela de Admins quanto na de médicos — único jeito de transformar um cadastro **já existente** (não dá pra fazer isso por `/equipe/novo`, que só cria conta nova).
  - App (`app/(tabs)/comunidade.tsx`): perfis de equipe mostram badge de papel ("Founder"/"Especialista OLI"/"Parceiro") no lugar do badge de plano; seção "Perfil Clínico", "Subespecialidades" e "Indicado por" somem (`!roleBadge` guard); `displayName()` nunca prefixa Dr./Dra. pra esses `user_type`.

- **🐛 3 bugs achados ao rodar o fluxo com a própria conta do founder (converter admin → founder):**
  1. **Lockout do painel:** `admin/middleware.ts` só liberava `user_type==='admin'` — founder ficava trancado fora do admin inteiro ao converter. Fix: aceita `admin` OU `founder`.
  2. **Segundo gate esquecido:** `admin/app/login/page.tsx` tinha checagem **própria e separada** do middleware (`!== 'admin'` → signOut + "Acesso não autorizado") — mesmo depois do fix #1, o login continuava rejeitando founder. Fix igual, no mesmo padrão. **Lição:** ao adicionar um novo `user_type` com acesso ao painel, checar TODOS os pontos de auth gate, não só o middleware (grep por `user_type.*admin` pega os dois).
  3. **Dados clínicos residuais:** converter um médico existente (founder já tinha `tratamento='Dr.'`, `crm`, `subespecialidades=['Clínico Geral']`) não limpava esses campos — sobrava "Dr." no nome e chip de subespecialidade médica no card da Comunidade mesmo com badge de Founder. Fix: `createTeamProfile`/`updateTeamProfileFields` zeram esses campos sempre (não só quando o admin lembra de apagar manualmente).
  - Perfil do founder convertido e testado ponta-a-ponta: aparece em `/equipe`, sumiu de `/medicos`, card da Comunidade mostra "Founder" limpo (nome sem Dr., sem plano, sem perfil clínico, sem indicação).

- **🎨 Feedback visual ao salvar:** `/equipe/[id]` e `/equipe/novo` eram `<form action={...}>` puro (sem indicação de sucesso — parecia não salvar nada). Convertidos pra client components (`TeamProfileForm.tsx`, `NewTeamProfileForm.tsx`) com `useTransition` — mostra "✓ Salvo" ao editar, redireciona pra `/equipe` ao criar.

- **⚠️ Lição de processo:** mudança em `app/(tabs)/comunidade.tsx` foi commitada mas a OTA só foi rodada numa sessão de retrabalho depois — o fundador testou no app e viu o comportamento antigo (badge de plano, "Indicado por") porque a mudança nunca tinha chegado no bundle. **Sempre rodar `eas update` nos 2 canais logo após editar qualquer arquivo em `app/`/`src/`, no mesmo turno — não deixar acumulado.**

- Commits: `9aa3f6f`, `6a0ee25`, `8eb3dd3`, `9cd13c6`, `41ef75e`, `2fb4a7e` (branch `main`, Vercel auto-deploy). **OTA enviada em 2 rodadas** — 1ª leva (badge + esconde indicação): prod `254c6abc-359c-4279-8030-c1926abade71` / preview `9ccafeb7-1a9b-44d8-b86b-cea663413d62`. 2ª leva (limpa Dr./subespecialidade residual): prod `669e4657-ebd5-41fe-9d88-05b77193c43f` / preview `d2cc665c-3da9-41e3-a792-eea9f74e9929`.

### ✅ Resolvido na sessão 17/jul (link de confirmação de e-mail + bug de reservas invisíveis + notificação de reserva)

- **🐛 Fix link de confirmação de e-mail caindo em `localhost:3000`:** causa era o **Site URL** do projeto no Supabase (Authentication → URL Configuration) ainda apontando pro default `http://localhost:3000` — quando o `redirect_to` não batia exato com a allowlist, o GoTrue caía nesse fallback e o usuário via "página não encontrada" no celular. `Redirect URLs` já tinha `https://olihealthhub.com.br/confirmado` cadastrado corretamente; só o Site URL estava desatualizado. Corrigido pelo fundador direto no painel (mudança de config, não código). **Sem código pra revisar** — só confirmar que reduz reclamação de novos cadastros.

- **🐛 Bug crítico achado ao investigar reserva "sumida" da Nathalia (nutricionista, sábado 18/jul):** a reserva sempre existiu no banco (`reservations`, Sala 7, criada 13/jul) — o problema era **client-side**. `todayReservations` no `appStore` só carregava reservas de **hoje** (`fetchTodayReservations`), mas essa mesma lista era a única fonte de dados pra:
  - Tela `agenda.tsx` (lista "Minhas Reservas", pontos no calendário mensal, timeline de ocupação das salas) — qualquer reserva de dia ≠ hoje ficava **invisível pro próprio profissional**, mesmo existindo no banco.
  - `ReservationModal`, `RescheduleModal` e `EncaixeModal` (que oferece os próximos 5 dias úteis) — a checagem de conflito de horário ao **criar/reagendar/encaixar** reserva só olhava pras reservas de hoje, ou seja, reservar pra qualquer dia futuro tinha risco real de **dupla-reserva sem detecção**.
  - **Fix:** `reservationService.ts` ganhou `fetchUpcomingReservations()` (hoje + 180 dias, no lugar de `fetchTodayReservations`, removida). `appStore.ts` ganhou `upcomingReservations` como fonte de verdade pros 4 componentes acima; `todayReservations` continua existindo e é **derivado** de `upcomingReservations` filtrado por hoje — mantido intocado no dashboard (`index.tsx`, `pacientes.tsx`) porque ali a semântica "hoje" é proposital (timer de sessão auto-start, cobrança por minutagem). Toda mutação (`addReservation`/`cancelReservation`/`rescheduleReservation`/`startRoomUse`/`endRoomUse`) atualiza as duas listas em sincronia.
  - **Escopo real do bug:** não era específico da Nathalia nem de sábado — qualquer reserva pra um dia diferente de hoje ficava invisível pro profissional que a criou, desde sempre. `npx tsc --noEmit` limpo em app e admin depois do refactor.
  - Commit `8648209`. **OTA enviada** — prod `c4a362ec-6deb-4637-9bff-c3000b843025` / preview `5cb13c3a-64ea-4022-87db-20792f0a61e3`.

- **🆕 Feature: notificação automática de nova reserva (central de notificação do admin + e-mail):**
  - Reaproveitada a infra que já existia (`admin_notifications` + `NotificationFeed.tsx`, tempo real via Postgres changes, badge de não-lidas na sidebar do admin — usada até então só pra novo cadastro/módulo/plano). Novo tipo `reservation_created` no enum `notification_type` + ícone/label no `NotificationFeed.tsx`.
  - Trigger Postgres `trg_notify_reservation_created` (AFTER INSERT em `reservations`, mesmo padrão do `call_send_push` já usado nas campanhas de push — lê `service_role_key`/`supabase_url` do Vault, chama a function via `net.http_post`) → dispara sozinho, sem precisar configurar Database Webhook manual no painel.
  - Nova edge function `notify-reservation` (deployada): insere a notificação admin **e** envia e-mail via **Resend** pros endereços em `RESERVATION_ALERT_EMAILS` (secret, lista separada por vírgula). Se `RESEND_API_KEY`/`RESERVATION_ALERT_EMAILS` não estiverem setados, só pula o e-mail silenciosamente — não quebra a notificação.
  - Resend já era usado no projeto (SMTP customizado do Supabase Auth pros e-mails de confirmação/reset — não estava documentado aqui antes). Domínio `olihealthhub.com.br` já verificado nele.
  - **🐛 Achado no teste:** 1ª tentativa de e-mail falhou silenciosamente — Resend rejeitou o request inteiro com 422 `"Invalid \`to\` field. The email address contains non-ASCII characters"` porque um dos endereços em `RESERVATION_ALERT_EMAILS` tinha "ç" (Gmail não aceita acento no usuário — endereço tava digitado errado). Corrigido o secret, testado de novo com sucesso (e-mail + notificação chegando). **Lição:** Resend valida o array `to` inteiro de uma vez — 1 endereço malformado derruba o envio pra todos os destinatários da lista, silenciosamente (o código só loga o erro, não alerta em lugar nenhum visível). Vale revisitar se um alerta mais visível compensa no futuro.
  - Secrets `RESEND_API_KEY` + `RESERVATION_ALERT_EMAILS` configurados em produção pelo fundador (Supabase Dashboard → Edge Functions → Secrets, é global do projeto).
  - `database.types.ts` regenerado (novo enum value).

### ✅ Resolvido na sessão 17/jul (sessão 2 — contas excluídas, conflito de sala, convite/onboarding de equipe, Mapa das Salas semana, perfil "Equipe OLI")

- **🏢 Admin: `/medicos` deixa de misturar contas excluídas na lista** — soft-delete (`account_status='deleted'`) não tinha nenhuma indicação visual, ficava mesma linha que médico ativo. Nova `/medicos/excluidos` arquiva as soft-deleted (LGPD/auditoria — dados preservados, só saem da base principal); lista principal ganha badge de status (Pausada/Suspensa/Banida) + link de contagem. Commit `bea6754`.

- **🐛🔒 Bug crítico de dupla-reserva entre profissionais diferentes:** achado ao usuário reportar que o calendário não mostrava reserva de outro dia. Investigando, a checagem de conflito nos 3 fluxos de reserva (`ReservationModal`/`EncaixeModal`/`RescheduleModal`) e o timeline visual de salas usavam `upcomingReservations`, que o RLS de `reservations` escopa só ao **próprio profissional** (`auth.uid() = professional_id`) — médico A nunca enxergava reserva do médico B na mesma sala/horário, podia reservar por cima sem aviso nenhum.
  - **Fix client-side** (commit `31628a6`): nova RPC `get_room_occupancy` (SECURITY DEFINER) expõe sala/horário/status de **todos** os profissionais sem paciente e sem identificar o outro médico; novo campo `roomOccupancy` no `appStore` alimenta as 3 telas de reserva + timeline. `upcomingReservations` continua "minha agenda" (dashboard, calendário, encaixe).
  - **Fix server-side / race condition** (commit `8c0da83`): checagem client-side não impede dois profissionais confirmando no mesmo segundo. Migration `reservations_no_room_overlap` — **exclusion constraint** (`btree_gist`) na tabela `reservations`: Postgres rejeita qualquer INSERT/UPDATE com horário sobreposto na mesma sala, testado via SQL Editor (`23P01`). `addReservation`/`rescheduleReservation` no `appStore` viram `async` — em rejeição do servidor, reverte o estado otimista local (evitava reserva "fantasma": aparecia confirmada no app sem existir no banco) e mostra alerta "sala já reservada" em vez de erro genérico.

- **🐛 Convite de admin caía direto no site institucional:** `inviteUserByEmail()` não passava `redirectTo` — GoTrue caía no Site URL do projeto (mesma causa-raiz do bug de confirmação de e-mail de mais cedo no dia), então o botão "Aceitar convite e criar senha" do e-mail abria `olihealthhub.com.br` em vez de qualquer formulário. Não existia página nenhuma pra esse fluxo desembocar. Fix (commit `b15bb6b`): `redirectTo: https://admin.olihealthhub.com.br/definir-senha` + nova página `admin/app/definir-senha` (extrai token do fragmento da URL, `setSession`, formulário de senha via `updateUser`) + `middleware.ts` libera a rota sem exigir sessão de admin. **⚠️ Precisou cadastrar a URL em Authentication → URL Configuration → Redirect URLs no painel do Supabase — feito pelo fundador.**

- **🆕 Convite aceito não vira usuário automaticamente até ser classificado** (commit `7915bb5`): `accept_invite()` sempre criava `user_type='subscriber'` na hora do convite (via trigger `handle_new_user` em qualquer INSERT em `auth.users`, mesmo antes de aceitar) — qualquer convite (admin, equipe, etc.) caía direto na base clínica. Fix: trigger pula criação de profile/subscription quando `invited_at IS NOT NULL`; nova página `/definir-senha` pergunta "você é profissional de saúde?" depois de salvar a senha — Sim → `subscriber` (base clínica, igual antes); Não → novo `user_type='pending'`, fora de `/medicos`, aparece em `/usuarios` numa seção "Aguardando classificação" até alguém classificar manualmente. Rename "médico"→"profissional de saúde" feito só nessa área (decisão de escopo — resto do admin não tocado).

- **📅 Mapa das Salas ganha visão Semana** (commit `ba32bf8`): só dava pra ver um dia por vez, navegando ‹›/data. Nova aba "Semana" ao lado de "Dia" (que ficou intocada): grid salas×dias (Seg–Dom), chips compactos por reserva (horário+profissional, clicável pra abrir o dia). KPIs trocam Em sessão/Próximas por Profissionais únicos no modo semana. **🐛 Achado e corrigido no meio do caminho:** range da semana começava ao meio-dia de segunda em vez de 00:00 (reuso indevido do truque `T12:00:00` usado só pra evitar virada de dia por DST/timezone).

- **🆕 Perfil de equipe genérico "Equipe OLI"** (commit `9777305`): só existiam founder/especialista/parceiro — recepção e outros papéis internos (pedido pra Claudia, recepção) não tinham onde entrar sem forçar rótulo errado. Em vez de tipo específico por papel (migration toda vez que surge um novo cargo), `user_type='team'` é bucket genérico; reaproveita o campo **"Título/Papel"** que perfis de equipe já tinham (sem coluna nova) pra distinguir ("Recepção", "Operações"...). Adicionado em todo ponto que tratava founder/specialist/partner como bloco fechado: seletores de conversão em `/usuarios`+`/equipe`, listagem/guard de `/equipe`, exclusão de `/medicos`+`/medicos/excluidos`, contagens do dashboard e `/planos`, badge de papel (`ROLE_BADGE`) na Comunidade do app mobile.
  - **Bio da Claudia (recepção) escrita e aprovada** — Título/Papel: "Recepção". Bio: "Sou a porta de entrada do OLI — recebo pacientes e profissionais com atenção desde a concepção do coworking. No dia a dia, cuido de cada detalhe e resolvo com agilidade tudo que aparece, para que cada consulta comece tranquila. Carrego no cuidado o espírito do OLI." **Perfil ainda não criado no admin** — falta cadastrar em `/equipe/novo` (Tipo: Equipe OLI, Nome: Claudia + sobrenome).

- **⚙️ Processo — branch de sessão + PR (revertido pra commit direto):** a sessão começou trabalhando no branch `claude/hopeful-sanderson-6de50e` (atribuído automaticamente pelo harness) com PR pra `main` a cada mudança (#1 a #9, todos merged). Branch default do GitHub tinha ficado como esse branch de sessão em vez de `main` — corrigido. Fundador achou o ciclo de PR repetitivo → `main` local reconfigurado pra rastrear `origin/main` direto; a partir do PR #9 voltou a ser commit direto em `main`, sem branch de sessão nem PR.

- **Dados de teste:** reservas de teste (`test-week-1`..`6`) criadas pra visualizar a semana com dados reais e **excluídas depois** — não sobrou nada na base.

### ✅ Resolvido na sessão 21/jul (site institucional + decoupling admin↔equipe)

- **🌐 Site: planos START/BASE/PRO reais + galeria de salas.** `landing/index.html` ainda mostrava BASE/PRO/VIP antigo com preços/features desatualizados. Corrigido pra refletir `oli-plans.ts` (START grátis R$2,00/min, BASE R$299 R$1,50/min, PRO R$599 R$1,30/min) + nova seção com fotos das 9 salas (`landing/room-photos/`). De brinde: `OLD/README.md` (nunca commitado) documentando o reorg de 17/06, e lock stale de sessão de maio removido. Commit `c4a419a`, push direto (Netlify auto-deploy).

- **🔒 Decoupling admin↔equipe — RESOLVIDO** (fecha §11.18): Claudia (recepção, `user_type='team'`) não conseguia entrar no admin porque `admin/middleware.ts` e `admin/app/login/page.tsx` só liberavam `user_type in (admin, founder)` — acesso ao painel e papel na Comunidade usavam o mesmo campo.
  - Migration `decouple_admin_access_from_user_type`: nova coluna `profiles.is_admin boolean`, independente do `user_type`. Backfill deu `true` pra quem já tinha acesso (founders). Claudia recebeu `is_admin=true` manualmente — mantém `user_type='team'` intocado (badge "Equipe OLI" na Comunidade não muda).
  - **Bug relacionado corrigido de brinde:** `is_oli_admin()` (usada em 9 policies RLS — plans, subscriptions, hour_packages, hour_balance, usage_charges, modules, user_modules, referrals) só reconhecia `user_type='admin'`, nem `founder` contava. Agora checa `is_admin`.
  - `admin/middleware.ts` + `admin/app/login/page.tsx`: gate trocado pra `is_admin`.
  - `admin/app/usuarios/page.tsx` + `actions.ts`: nova ação `toggleAdminAccess` — concede/revoga acesso ao painel sem mexer no `user_type`/papel da pessoa (era o pedido original do fundador, não implementado até agora). Seção "Administradores" da página lista por `is_admin`, mostra o `user_type` como badge de papel.
  - `database.types.ts` regenerado. `tsc --noEmit` limpo em app e admin. Advisors de segurança sem novidade (warnings de `is_oli_admin` — search_path mutable, security definer executável por `authenticated` — já existiam antes, não são regressão).
  - Estado final dos 13 perfis: 3 com acesso ao painel (Guilherme/founder, Igor/founder, Claudia/team), 10 `subscriber` sem acesso — nenhum `user_type` de médico foi alterado.
  - Commit `c31f6d7`, push direto.

- **🧹 Organização de assets e docs.**
  - **QR code único de download** (`landing/assets/qr-baixar-app.png`/`.svg`) apontando pra `https://olihealthhub.com.br/baixar` — confirmado por decode (`zbarimg`) que é **idêntico** ao QR já usado no material impresso de sensibilização (`OLI_Onboarding_Verso.pdf`, passo 1 "Baixe o app"). Não gerar QR novo pra isso — reaproveitar este.
  - **Comportamento de `landing/baixar.html` documentado** (2 estados, controlados por `?ref=` na URL):
    - **Sem `?ref=`** (uso normal — QR do material impresso, links genéricos): ícone 📲, título "Baixe o OLI Health Hub", texto institucional, sem caixa de código, **redireciona automático** pra loja certa via UA.
    - **Com `?ref=CODIGO`** (só dentro do fluxo `app/indicacao.tsx`, indicação médico→médico): ícone 🎁, título "Você foi indicado!", mostra código + botão copiar + dica "informe seu código em Como você nos conheceu", botão extra "Já tenho o app" (deep link), **não** redireciona sozinho.
    - **Regra:** o link/QR de indicação (`?ref=`) só deve circular dentro do fluxo de indicação entre médicos — nunca em material de captação genérico (impresso, site, QR de sensibilização), que deve sempre usar o link limpo sem `?ref=`.
  - **Fotos das lojas organizadas:** `assets/Print Screen App/selected/` (10 Android) e `assets/Print Screen App iOS/resized-65/` (12 iOS, versão final 1284×2778 submetida) **versionados no git pela primeira vez** — nunca tinham entrado, risco de perda se trocasse de máquina. Brutos já processados (16 WhatsApp jpegs Android + 12 `IMG_970x.PNG` iOS) movidos pra `OLD/fotos-brutas/` — fora do caminho ativo, preservados por precaução.
  - **`docs/ROADMAP.md` reescrito** — estava com dados de 27/mai (VIP ativo, 6 salas, custo fixo R$25k, dezenas de itens ❌ que já estão ✅ há semanas). Agora reflete o estado real e vira um retrato de arquitetura só; pendências vivas continuam só no HANDOFF §11 (evita duplicar/desalinhar).
  - `assets/Print App material Impresso/` (10MB, sem referência em código) — confirmado com o fundador que **ainda está em uso**, mantido como está, sem mexer.
  - Commit `e088971`, push pendente de confirmação do fundador.

### 🆕 Sessão 21/jul (sessão 4) — Campanha WhatsApp do Marangos + mecanismo de indicação de parceiro implementado + fix crítico

- Continuação da sessão 1 de hoje (modelo de comissão do parceiro) — esta sessão implementou a divulgação e o mecanismo técnico de atribuição.
- **Criativos WhatsApp (skill canvas-design):** arte 1080×1350 com fotos reais das salas (`room-photos/sala-8.jpg` estética/ginecologia, `sala-2.jpg` psicologia, `sala-3.jpg` clínica geral) + identidade OLI (Lora/Outfit, verde/dourado/creme). Layout fechado após várias rodadas com o fundador: selo dourado com a especialidade sobre a foto, título objetivo "Consultório pronto, sem aluguel." (sem kicker, sem jargão), 2 checks (marca a hora/paga só o tempo · recepção inclusa), faixa CTA verde com seta apontando pro link na legenda ("Toque no link abaixo e agende sua visita"). Arquivos em `OLI - HH/Parceiros/Marangos/` (fora do repo, não versionado).
- **Mecanismo de atribuição implementado** reaproveitando o programa de indicação peer-to-peer já existente (§7) em vez de construir um sistema novo:
  - Perfil `user_type='partner'` criado para o Marangos (`id 11196b82-f1b0-4cac-84e0-5044db647f19`) direto via SQL espelhando o que `admin.createUser` faz (insert em `auth.users`+`auth.identities`, trigger `on_auth_user_created`/`handle_new_user` disparou normal e criou a linha em `profiles`). `comunidade_banned=true` — não aparece na Comunidade do app (decisão do fundador).
  - Código gerado pela RPC já existente `generate_referral_code`: **`MAR-8124A`**. Link pessoal dele: `https://olihealthhub.com.br/baixar?ref=MAR-8124A`.
  - **Ajuste em `apply_referral_benefit`:** por padrão o programa credita quem indicou (médico→médico, 60 min). Quando o indicador é `user_type='partner'`, invertido — quem ganha as 60 min é **quem se cadastra** (o parceiro não usa sala). Indicação entre médicos continua idêntica, sem regressão.
  - Tabela `referrals` já loga indicador/indicado/data pra cada cadastro via código do Marangos — dá de graça boa parte da base de atribuição que o programa de comissão de parceiros externos vai precisar (pendência §11.19), mesmo sem a "tela no admin" ainda existir.
  - **⚠️ Refina a regra da sessão 3 de hoje:** "`?ref=` só circula entre médicos" (§11, `landing/baixar.html`) continua valendo pra material de captação **genérico/anônimo** (QR impresso, site institucional) — não se aplica a um código **dedicado e nominal** como o do Marangos, que é conceitualmente uma indicação (mesmo com parceiro externo em vez de médico). Registrar essa distinção pra não confundir sessões futuras.
- **🐛 Bug crítico encontrado e corrigido (não relacionado ao pedido original):** a tabela `referrals` foi alterada depois da migration original (`20260607_referral_program.sql`) — sumiu a `UNIQUE(indicador_id, indicado_id)` que a função usava no `ON CONFLICT` e surgiu uma `UNIQUE(codigo)` incorreta (o código do indicador se repete a cada indicação dele, não é token de uso único), além do `status` CHECK ter mudado pra `pending/converted/rewarded` (a função ainda gravava `'active'`). Resultado: **qualquer indicação real, de médico ou de parceiro, ia falhar e derrubar a transação inteira do cadastro** (o trigger roda dentro do mesmo UPDATE que salva o onboarding — erro no trigger reverte tudo). Corrigido: `apply_referral_benefit` reescrita sem depender de `ON CONFLICT` (upsert manual via UPDATE + INSERT condicional); `referrals_codigo_key` removida (sem FK dependente, confirmado antes de dropar). Testado ponta a ponta com contas sintéticas via SQL (indicação de parceiro E entre médicos), limpas depois — **nenhum profissional real foi afetado**, `referido_por` estava zerado pra todo mundo até este teste (ninguém tinha usado indicação ainda).
- Migrations aplicadas: `referral_partner_credits_new_user`, `fix_referral_benefit_schema_drift`.

- **🐛 Achado depois de testar o link do Marangos:** o banner de `landing/baixar.html` (`?ref=CODIGO`) tinha texto fixo — "Você foi indicado! ... você e quem te indicou ganham crédito de horas" — mostrado igual pra qualquer código. Pra um parceiro comercial externo (não médico), isso soa como se ele estivesse se beneficiando de uma indicação como usuário interno. Fix: novo objeto `PARTNER_COPY` no script da página, mapeando código → texto individual (heading + subtext) só pra esse código; qualquer código fora do mapa mantém o texto padrão de benefício mútuo entre médicos, sem regressão. `MAR-8124A` → "Bem-vindo ao OLI!" / "Indicação do Marangos: baixe o app, cadastre-se e ganhe uma hora de uso grátis nas salas." (sem mencionar benefício pro indicador). Adicionar outro parceiro = 1 linha nova nesse objeto.
- **⚠️ Achado de infraestrutura — Cowork (chat) não consegue publicar mudanças de site/app:** o ambiente desta sessão (Cowork, diferente de uma sessão do Claude Code rodando na máquina do fundador) não tem credenciais do GitHub (sem `gh`, sem SSH key, sem token, sem resolução de DNS pra `github.com` fora do proxy) — `git push` sempre falha com `could not read Username for 'https://github.com'`. Commit local funciona (com ressalvas abaixo), mas o push final **sempre depende do fundador rodar `git push` no terminal dele, ou editar o arquivo direto pelo `github.com/.../edit/main/...`** (sem terminal). Documentar isso evita repetir a tentativa em sessões futuras.
  - **Efeito colateral encontrado:** este mount específico bloqueia a chamada de "apagar arquivo" (`unlink`) mas permite "renomear" (`rename`) — todo `git commit`/`git status` cria um `.git/index.lock` que o próprio git não consegue remover sozinho no final (erro "Operation not permitted"), travando o próximo comando de git. Contorno: `mv .git/index.lock .git/index.lock.bak` (ou qualquer nome) antes de repetir o comando — nunca `rm`. Aconteceu também com `.git/objects/*/tmp_obj_*` e `.git/HEAD.lock` — inofensivo (são só arquivos soltos, não corrompem o repo), mas acumulam lixo em `.git/` que pode ser limpo manualmente depois.
  - Este ambiente também não tinha `user.name`/`user.email` configurados — commit falhava com "Author identity unknown" até setar localmente (`git config user.email/name`, sem `--global`).
  - **Estado real ao fim desta sessão:** commit `76eed6b` (fix da copy do Marangos + este handoff) existe **só localmente** — `main` ficou "ahead 1" de `origin/main`. Repassado ao fundador pra publicar via terminal ou editor web do GitHub.

### 🔴 Achado (13/jul) — MRR do admin inflado por assinatura de teste
- **Sintoma:** tile "MRR Asaas" no admin (`/` e `/financeiro`) mostrava ~R$499, sem nenhuma assinatura BASE/PRO real ativa na DB (`subscriptions` só tinha START/R$0).
- **Causa:** assinatura **real e ativa no Asaas** (não só na nossa DB) da conta demo do revisor Google Play — cliente "Revisor Google", Plano PRO, **R$5.990,00/Anual** (rateado = R$499,17/mês, batendo exato com o valor exibido). Criada durante a config da conta demo (§10.1) e nunca cancelada — cobrança recorrente real com cartão vinculado, risco de cobrar de verdade no próximo ciclo.
- **Ação:** fundador confirmou ser teste, vai cancelar direto no Asaas (Cobranças → Assinaturas → lixeira). Depois de cancelar, MRR volta a refletir só clientes reais.
- **Lição:** contas demo/revisor não devem ter assinatura Asaas real — usar crédito manual (`hour_balance`) ou plano sem cobrança de verdade, nunca uma subscription recorrente de cartão.

### 🆕 Sessão 21/jul — Programa de Indicação de Parceiros Externos (comercial, ainda não implementado)

- **Não é código** — decisão de negócio, sem commit/migration/OTA. Documento formal em `Programa de Indicação - Modelo de Comissionamento.docx`, pasta `OLI - HH` (fora do repo).
- **Contexto:** piloto com um parceiro comercial (representante de distribuidora de produtos estéticos, carteira própria de clientes da área de estética) que vai divulgar o OLI pra base dele em troca de comissão — diferente do programa de indicação peer-to-peer já implementado (§7).
- **Papel do parceiro:** indicação passiva — só divulga, sem prospecção ativa nem acompanhamento de fechamento. Volume estimado: 4 a 10 indicações/mês.
- **Mecanismo de atribuição definido:** link de indicação único por parceiro, rastreado num admin (indicações geradas, status do cadastro, comissão devida/paga), janela de atribuição de 90 dias entre clique e cadastro. **Não implementado ainda** — hoje só existe o `referral_code` do programa peer-to-peer (§7), que não serve pra esse caso (não gera R$, gera minutos).
- **Estrutura de comissão fechada (tier passivo, 10%):**
  - START sem uso → R$ 0.
  - START, cliente aluga a 1ª hora → 100% do valor da 1ª hora (≈R$120), pago uma vez na 1ª sessão faturada.
  - BASE anual (R$3.588/ano) → R$359, pago uma vez na confirmação do plano anual.
  - PRO anual (R$7.188/ano) → R$719, pago uma vez na confirmação.
  - BASE mensal → 10% sobre 6 meses de mensalidade = R$179, pago uma vez, 60 dias após a ativação.
  - PRO mensal → 10% sobre 6 meses de mensalidade = R$359, pago uma vez, 60 dias após a ativação.
- **Por que esse desenho:** comissão ancorada na mensalidade do plano (não na minutagem — parceiro não controla nem prevê uso); pagamento único, sem obrigação recorrente mês a mês (pedido explícito do fundador); plano mensal paga sobre 6 meses (não 12) e só após carência de 60 dias porque a receita não é garantida como no anual (cliente pode cancelar a qualquer momento); percentual calibrado pra esforço passivo — um tier ativo (15-20%) fica documentado como degrau futuro, não decidido agora.
- **Escalabilidade:** se o piloto funcionar, mesmo modelo (link + comissão) pode ser replicado pra outros parceiros indicadores.
- **Fonte de preços usada:** `src/models/oli-plans.ts` (BASE R$299/mês, PRO R$599/mês, START gratuito).

### 🔴 Em aberto
1. **Config Supabase dashboard** (em `Authentication`):
   - ✅ `URL Configuration` → Redirect URLs adicionadas. Reset de senha FUNCIONANDO.
   - ✅ `Sign In / Providers` → Email → Confirm email = ON; min password 8.
   - ✅ `Emails` → Templates `confirm-signup.html` + `reset-password.html` configurados (OLI-branded, verde/dourado).
2. ~~**🔴 Asaas sandbox → produção**~~ ✅ **RESOLVIDO 18/jun**.
3. ~~**Sentry DSN ausente**~~ ✅ **RESOLVIDO** — `EXPO_PUBLIC_SENTRY_DSN` setado em `.env`.
4. **Foto sala faltando**: só **Sala 4 (Audio Visual)**. Quando chegar: `assets/room-photos/4a.jpg`, processa com `sips -Z 1200 -s formatOptions 78 4a.jpg --out sala-4.jpg`, registra em `roomPhotos.ts` (key `4`), `eas update`.
5. ~~**Play Store produção**~~ ✅ **RESOLVIDO 13/jul** — app publicado em produção na Google Play Store. Ver §10.1.
6. ~~**`oli_encrypt`/`oli_decrypt`**~~ ✅ **RESOLVIDO 23/jun** — EXECUTE revogado de `authenticated`.
7. **Communicare**: aguardar token + endpoint LISTA + status + webhook. Depois remontar card da agenda.
8. **VIP** preço; **Cron** auto-desativar START 30d sem reserva; **expo-blur** lock screen (rebuild nativo).
9. ~~**🔒 Gate de reserva server-side**~~ ✅ **RESOLVIDO 23/jun** — trigger `trg_check_reservation_credit` BEFORE INSERT.
10. **🆕 Salas de Evento + Conferência (roadmap)** — cobrança por bloco/hora (NÃO minutagem). Conferência R$150/h (mín 1h); Eventos R$280/h ou 4h R$960. Impl: `room_type` + `hourly_rate` + `min_duration`. Validar preço com fundador.
~~11. **🍎 App Store Connect**~~ ✅ **RESOLVIDO** — argumento 3.1.5(b) (serviço físico) **aceito pela Apple**. App **publicado** na App Store.
~~12. **OTA pendente**~~ ✅ **ENVIADA (6/jul)** — commit `8f55c8b`. Update group ID prod `502b009d-44a8-479f-9c46-3b9dad0924df` / preview `5086acf8-73b1-4ec5-8caf-6122019559a0`. Inclui: welcome screen, fix Face ID routing, fix Dr./Dra. (ícone neutro + anti-duplicação), preços DB.
13. **Login social (Google + Apple)** — deferido para após aprovação da produção. Requer rebuild nativo (versionCode 3). Ver memory `project-roadmap`.
~~14. **OTA (feed social)**~~ ✅ **ENVIADA (8/jul)** — commit `6d8eff4`. Update group ID prod `1b7e983d-40be-44ab-9bf2-55c740c745f7` / preview `e13ecccc-6929-42af-b36e-51e1f4563aaa`.
15. **🆕 Lembrete 05/09/2026** — tarefa agendada pra perguntar se contrato renovou (salário founder 4000→6000). Ver `admin/app/meu-recebimento/page.tsx` (`CONTRATO_RENOVADO`).
~~16. **OTA (fix reservas invisíveis)**~~ ✅ **ENVIADA (17/jul)** — commit `8648209`. Update group ID prod `c4a362ec-6deb-4637-9bff-c3000b843025` / preview `5cb13c3a-64ea-4022-87db-20792f0a61e3`.
~~17. **OTA (fix conflito de sala + badge Equipe OLI + evento Luma)**~~ ✅ **ENVIADA (17/jul sessão 2)** — commits `31628a6`+`9777305`+`bd1cf5d`. Update group ID prod `1702e018-3adc-4740-ab14-49a73bd4a1ea` / preview `c3795e25-e23d-4e6a-b31c-7deca7593a42`.
~~18. **Decoupling admin↔equipe**~~ ✅ **RESOLVIDO (21/jul)** — ver sessão 21/jul abaixo. Fix do acesso da Claudia.
19. **🆕 Programa de Indicação de Parceiros Externos** — modelo de comissão fechado (sessão 21/jul) + **mecanismo de atribuição do piloto (Marangos) implementado (21/jul sessão 4)**: perfil `user_type='partner'` + código `MAR-8124A` + `?ref=` na `/baixar`, reaproveitando o programa de indicação peer-to-peer (§7). Falta ainda: **tela no admin** pra listar indicações/comissão por parceiro (hoje só dá pra consultar via SQL na tabela `referrals`) e o **fluxo de pagamento** (cálculo de comissão devida + registro de pago). Sem prazo definido — depende do piloto validar volume.
~~20. **Push pendente (21/jul sessão 4)**~~ ✅ **RESOLVIDO (21/jul sessão 5)** — `git push origin main` rodado no terminal do fundador (commits `76eed6b`+`a7035a7` publicados). Mas isso revelou um problema maior: ver item 21.

~~21. **Netlify bloqueado por crédito esgotado — migração pro Vercel**~~ ✅ **RESOLVIDO (21/jul sessão 5)** — registro A trocado no registro.br (`216.198.79.1`), propagado, confirmado ao vivo: `/`, `/baixar`, `/confirmado`, `/privacidade` todos 200, `cleanUrls` funcionando, copy do Marangos ("Bem-vindo ao OLI!") aparecendo certo em `/baixar?ref=MAR-8124A`. Site institucional agora serve 100% do Vercel (projeto `oli-landing`). Ver §14 pro histórico completo. **Falta só o cleanup opcional** (desconectar domínio do site Netlify antigo, atualizar §3) — sem urgência, não afeta nada em produção.

### Regra de atualização (importante)
- **JS/assets** (telas, lógica, fotos via require, Luma, reset) → **OTA** (`eas update` nos 2 canais). Sem loja.
- **Nativo** (`app.json` android/ios, permissões, ícone, SDK, versão) → **rebuild AAB** + submit.
- **Secret de Edge Function** (Asaas, CC token) → muda no Supabase, vale na hora.
- **`EXPO_PUBLIC_*`** (Sentry, Luma) → está no bundle → OTA/rebuild.

## 14. Migração do site (landing/) — Netlify → Vercel (sessão 21/jul sessão 5, ✅ CONCLUÍDA)

**Causa raiz (achada nesta sessão):** o site institucional (`landing/`, domínio `olihealthhub.com.br`) parou de publicar deploys — todo commit desde `c31f6d7` (mais cedo em 21/jul) falhava silenciosamente. Diagnóstico via Netlify API (`netlify-cli api getSiteDeploy`, CLI já estava autenticada localmente na máquina do fundador, user `contato@olihealthhub.com.br`, team **Oliteam**):
- Site real é **`olihealthhub`** (site_id `cc03c6f3-1725-4527-83a8-d26b6413ec17`, não o `bespoke-starship-3fd6f9` vazio que o `.netlify/state.json` da raiz do repo linkava — por isso o fundador não achava o projeto procurando no painel).
- Todos os deploys recentes (git-triggered **e** manual via API) retornavam `error_message: "Skipped due to account credit usage exceeded"` — conta **Oliteam (Free)** estourou o crédito de uso da Netlify. Reset previsto **23/jul** (`next_usage_period_start`).
- `git push` em si funcionava normal (GitHub recebe o commit) — só o **deploy** (build→publish) que ficava pulado. Por isso parecia "push travado" (item 20 do §11) quando na real o push já tinha ido, só o site que não atualizava.

**Decisão:** migrar só `landing/` pro **Vercel** (mesma conta que já hospeda `admin/`, plano Free/Hobby, sem esse teto de crédito pra site estático simples). Escopo explicitamente **não inclui** `admin/` (fica no Vercel como já estava) nem o app mobile (não é hospedado em nenhum dos dois).

**Feito:**
- `landing/vercel.json` criado (commit `4f2a3e0`) — `{"cleanUrls": true, "trailingSlash": false}`, replica o `pretty_urls` do Netlify (`/baixar`, `/confirmado`, `/privacidade` sem `.html`, sem redirect visível). Nenhum outro arquivo Netlify-specific existia (sem `_redirects`/`_headers` em `landing/`).
- Projeto Vercel novo criado pelo fundador: nome **`oli-landing`**, team "Guilherme's projects" (Hobby), root directory `landing`, preset "Other", build command vazio, output directory `.`. Deploy inicial ok (`oli-landing-five.vercel.app` com "Valid Configuration").
- Domínio `olihealthhub.com.br` adicionado ao projeto Vercel. Registro **TXT** de verificação (`_vercel` → `vc-domain-verify=olihealthhub.com.br,c6c49421679b56206c16`) criado no registro.br e **já verificado** (domain ownership confirmado pela Vercel).

**Concluído (confirmado ao vivo, 21/jul sessão 5):** registro A trocado no registro.br pra `216.198.79.1`, propagado. `dig olihealthhub.com.br` retorna o IP da Vercel. Testado direto no domínio: `/`, `/baixar`, `/confirmado`, `/privacidade` → todos HTTP 200; `/baixar?ref=MAR-8124A` mostra a copy individual do Marangos ("Bem-vindo ao OLI!") — confirma que o fix do `76eed6b` (que nunca tinha ido ao ar por causa do Netlify) finalmente está em produção.

**✅ Cleanup feito (21/jul sessão 5, via API):**
- Site Netlify antigo (`olihealthhub`, site_id `cc03c6f3-...`) teve **builds parados** (`build_settings.stop_builds = true`) — não tenta mais buildar a cada push, não gasta crédito à toa.
- **Domínio desassociado** do site Netlify (`custom_domain = null`) — era só config órfã, DNS já não apontava mais pra lá havia horas.
- Site **não foi deletado** (decisão consciente — fica inerte, sem custo/risco, dá pra reverter se precisar). Repo continua linkado no GitHub app da Netlify; se quiser remover de vez, é em Site settings → General → Delete site, ou revogar o GitHub App em `github.com/settings/installations`.

**🟡 Pendência de doc (baixa prioridade):**
- **§3 (Infra — IDs e ambientes) e a "Regra de deploy"** ainda listam Netlify como host do site — atualizar pra Vercel (projeto `oli-landing`) na próxima passada de limpeza de docs.

## 12. Convenções (do CLAUDE.md)

- TypeScript estrito, sem `any`, sem `console.log` em produção.
- Estilos em `StyleSheet.create()`, sem objetos inline no JSX.
- `professionalId` sempre explícito nas ops Supabase.
- Componentes PascalCase, telas kebab-case, mudanças cirúrgicas.
- LGPD: CPF nunca em texto puro (hash SHA-256); dados de saúde = sensíveis (Art. 11); consentimento com timestamp; audit log (Art. 37); export/delete (Art. 18).
- **Gramática — "OLI" é substantivo masculino:** sempre "do OLI", "no OLI", "ao OLI" — nunca "da OLI", "na OLI", "à OLI". Vale em qualquer comunicação (push, e-mail, telas do app, docs).
- Mesmo em copy informal, respeitar concordância verbal — não misturar registro (ex.: "dê uma olhada e marque", nunca "dá uma olhada e marque").
- Comunicação com o usuário (push, onboarding, UI) não expõe detalhe técnico do produto (hash, criptografia, nome de coluna) — descrever o benefício em linguagem simples (ex.: "fica visível só para você" em vez de "CPF protegido por hash").

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

**Resumo de 1 linha (7-8/jul):** Sessão focada em **página de recebimento do founder + feed social na Comunidade**. OTA da sessão 6/jul enviada (`8f55c8b`, groups `502b009d`/`5086acf8`). Nova `/meu-recebimento` no Admin (salário+comissão por ocupação, só o founder vê, lembrete agendado 05/09 pra checar renovação de contrato). Comunidade virou parcialmente rede social: feed de posts (curtir/comentar), switcher Feed/Colegas com swipe, WhatsApp+subespecialidades no perfil/card, moderação de posts no Admin. Fix bug de `@` duplicado no Instagram. Testado ponta-a-ponta em device real via `expo start` (LAN de casa não funcionou por isolamento de rede — contornado com hotspot do Mac e depois WiFi da clínica). Achado e corrigido de brinde: crash de SSR no Expo web (Supabase/SecureStore sem guard pra `window` indefinido) — não afeta o app nativo. **OTA do feed social enviada** (commit `6d8eff4`, groups `1b7e983d`/`e13ecccc`).

**Resumo de 1 linha (8/jul sessão 2):** Sessão focada em **onboarding enxuto + gamificação (Olicoins)**. Fix RLS do upload de avatar (faltava policy SELECT no bucket) e fix clique nas miniaturas de foto de sala. Onboarding cortado de 5 steps pra 1 tela (WhatsApp+CRM); resto virou 10 seções de perfil + 11 objetivos de ação + 5 trilhas de conquista, tudo creditando Olicoins num ledger novo, com reconciliação automática/retroativa, barra de progresso animada e hub visual em grid de medalhas (`completar-perfil.tsx`). Badge flutuante "Agendar visita" linkando Calendly (modo otimista, sem webhook — plano free). Achado e registrado (não corrigido): NPS picker do checkout lista pacientes errados. **OTA enviada** (commits `5eaab52`+`5ac50a5`, groups `c0170fc2`/`8d701be8`).

**Resumo de 1 linha (12/jul):** Sessão focada em **agenda de sábado + comunicação com o cliente (push notifications) + fundação de localização**. Sábado liberado no mesmo horário dos dias úteis nos 3 fluxos de reserva (só domingo fecha). Sistema de push remoto completo: `push_tokens` + edge function `send-push` + broadcast manual no Admin (`/notificacoes`) + 3 campanhas automáticas via `pg_cron`/`pg_net` (lembrete de reserva, reação a inatividade 7/14 dias, nudge de objetivos pendentes) — tudo foi por OTA, sem rebuild, porque `expo-notifications` já estava no binário. **Pendência do fundador:** criar secret `service_role_key` no Vault do Supabase (SQL Editor, nunca aqui no chat) pras campanhas automáticas disparar de verdade. `expo-location` instalado pra captura sutil de cidade/UF (1x, sem tracking) — código pronto mas inerte até o próximo rebuild nativo (versionCode/buildNumber já bumped pra 3, batched com o login social). Commits `8a1e5fd` + `08406a3`. **OTA enviada** (groups `789d4a6f`/`1f3d207a` e `9ea30a10`/`ad274cb8`).

**Resumo de 1 linha (15/jul):** Sessão focada em **secret do push (fechado), limpeza da base de usuários e feature nova de Perfis de Equipe**. `service_role_key` criado no Vault com a key certa (sistema novo `sb_secret_...`, não a legacy JWT) — push testado e funcionando. Base de 17 usuários reduzida a 10 (7 contas de teste/duplicadas excluídas). Nova feature: `user_type` founder/especialista/parceiro pra dar presença na Comunidade a gente que não é médico (founder, especialistas do chatbot, futuros parceiros), com CRUD completo no admin (`/equipe`) e conversão de conta existente via `/usuarios`. Rollout com o próprio founder revelou 3 bugs (middleware + login page só liberavam `user_type==='admin'`, travando founder fora do painel; dados clínicos residuais não eram limpos ao converter médico existente) — todos corrigidos, mais feedback visual "✓ Salvo" no admin que não existia antes. Lição registrada: mudança em `app/` sem OTA no mesmo turno gera confusão ("não salvou" quando na verdade só não tinha chegado no bundle). Commits `9aa3f6f`…`2fb4a7e`. **OTA enviada em 2 rodadas** (groups `254c6abc`/`9ccafeb7` e `669e4657`/`d2cc665c`).

**Resumo de 1 linha (17/jul):** Sessão focada em **e-mail de confirmação quebrado + bug crítico de reservas invisíveis + notificação automática de reserva**. Fix do link de confirmação caindo em `localhost:3000`: Site URL do Supabase Auth desatualizado (config, não código). Investigando reserva "sumida" da Nathalia, achado bug real bem mais amplo: `todayReservations` no `appStore` só carregava reservas de hoje, mas alimentava agenda, criação, reagendamento e encaixe de reserva pra QUALQUER dia — reservas futuras ficavam invisíveis pro próprio profissional e checagem de conflito de horário não enxergava reservas de outros dias (risco de dupla-reserva). Corrigido com `upcomingReservations` (hoje+180d) como fonte pros 4 fluxos, `todayReservations` virou derivado, dashboard intocado. Commit `8648209`, **OTA enviada** (groups `c4a362ec`/`5cb13c3a`). Nova feature: notificação de reserva reaproveitando a central de notificação do admin já existente (`admin_notifications`/`NotificationFeed.tsx`) + trigger Postgres automático + edge function `notify-reservation` + e-mail via Resend (SMTP dos e-mails de auth já usava Resend, não documentado antes). Achado e corrigido no teste: endereço de e-mail com "ç" derrubava o envio inteiro (Resend rejeita o array `to` todo se 1 endereço for inválido) — testado com sucesso depois do fix.

**Resumo de 1 linha (17/jul sessão 2):** Sessão focada em **higiene do admin + um bug crítico de segurança de reservas + onboarding de convite/equipe**. `/medicos` separa contas excluídas numa página própria com badge de status. Achado e corrigido o bug mais sério da sessão: checagem de conflito de sala usava dados escopados por RLS ao próprio profissional — médico A nunca via reserva do médico B na mesma sala, dupla-reserva sem aviso; fix em duas camadas (RPC `get_room_occupancy` client-side + exclusion constraint `reservations_no_room_overlap` no Postgres, race-condition-safe). Convite de admin corrigido (caía no site institucional por falta de `redirectTo` — mesma causa-raiz do bug de e-mail de confirmação de mais cedo) + nova página `/definir-senha`. Convite aceito não vira usuário automaticamente até classificação (`user_type='pending'` até alguém decidir se é profissional de saúde ou equipe). Mapa das Salas ganha visão Semana. Novo `user_type='team'` genérico ("Equipe OLI") pra papéis como recepção, sem precisar de migration por cargo. **Processo novo:** branch de sessão (`claude/hopeful-sanderson-6de50e`) + PR pra `main` a cada mudança (#1–#6, todos merged), branch default do GitHub corrigido de volta pra `main`. **OTA pendente** (commits `31628a6` + `9777305`) — rodar antes do próximo teste em device.

**Resumo de 1 linha (21/jul):** Sessão **comercial, sem código**. Fechado o modelo de comissão do Programa de Indicação de Parceiros Externos — piloto com um parceiro (representante de distribuidora de estética, indicação passiva via link, 4-10 indicações/mês estimadas). Comissão de 10% ancorada na mensalidade do plano (não na minutagem), pagamento único (não recorrente): 1ª hora integral no START, valor cheio na confirmação do plano anual, valor sobre 6 meses após 60 dias de carência no plano mensal. Documento formal gerado (`OLI - HH/Programa de Indicação - Modelo de Comissionamento.docx`). Mecanismo de atribuição (link + tela admin) e fluxo de pagamento **ainda não implementados** — ver item 19 em §11.

**Resumo de 1 linha (21/jul sessão 2):** Sessão focada em **site institucional + acesso da Claudia ao admin**. Landing page corrigida pra refletir preços reais START/BASE/PRO (estava com BASE/PRO/VIP antigo) + galeria de 9 fotos de sala; commit `c4a419a`. Resolvido o bug de decoupling admin↔equipe registrado na sessão 17/jul: Claudia (`user_type='team'`) não conseguia entrar no painel porque acesso e papel na Comunidade usavam o mesmo campo. Nova coluna `profiles.is_admin` independente do `user_type`; `is_oli_admin()` (9 RLS policies) corrigida de brinde pra reconhecer founder também, não só admin; `/usuarios` ganha ação de conceder/revogar acesso sem trocar o papel. Claudia com acesso, nenhum `user_type` de médico alterado. Commit `c31f6d7`, push direto (Vercel auto-deploy).

**Resumo de 1 linha (21/jul sessão 3):** Sessão focada em **organização de assets/docs + QR code de download**. Gerado QR único pra `/baixar`, confirmado por decode que é idêntico ao já usado no material impresso de sensibilização — reaproveitar, não duplicar. Documentado os 2 estados de `landing/baixar.html` (com/sem `?ref=`) e fixada a regra: link de indicação (`?ref=`) só circula entre médicos, nunca em material de captação genérico. Screenshots finais das lojas (Android `selected/`, iOS `resized-65/`) versionados no git pela primeira vez — nunca tinham entrado, risco de perda. Brutos já processados arquivados em `OLD/fotos-brutas/`. `docs/ROADMAP.md` reescrito (estava com dados de maio, totalmente desalinhado do estado real). Commit `e088971`.

**Resumo de 1 linha (21/jul sessão 4):** Sessão focada em **campanha WhatsApp do parceiro Marangos + automação da indicação**. Criativo 1080×1350 com foto real de sala (canvas-design), iterado até título objetivo sem jargão + 2 checks + CTA apontando pro link na legenda. Em vez de um cupom falado, reaproveitado o programa de indicação peer-to-peer: Marangos ganhou perfil `user_type='partner'` (invisível na Comunidade) e código `MAR-8124A` — link `/baixar?ref=MAR-8124A` credita 1h automaticamente a quem se cadastra (não a ele, já que não usa sala; ajuste feito em `apply_referral_benefit` só pra indicadores `partner`, indicação médico-médico intocada). **Bug crítico achado e corrigido de brinde:** a função de crédito de indicação estava quebrada havia semanas (schema de `referrals` mudou e a função não acompanhou) — qualquer indicação real ia falhar e derrubar o cadastro inteiro da pessoa; corrigido e testado ponta a ponta, zero profissionais reais afetados até aqui. Migrations `referral_partner_credits_new_user` + `fix_referral_benefit_schema_drift`. Depois, achado que o texto do banner de indicação (`landing/baixar.html`) soava como se o parceiro externo ganhasse crédito de horas também — corrigido com mapa `PARTNER_COPY` (texto individual por código). **Publicação travada:** este ambiente (Cowork) não tem credenciais de GitHub — commit `76eed6b` ficou só local, fundador precisa dar `git push` ou editar pelo site do GitHub pra ir ao ar. Documentado o contorno de lock de git deste ambiente (`mv` no lugar de `rm`) pra sessões futuras.

**Resumo de 1 linha (21/jul sessão 5):** Sessão focada em **destravar publicação do site (achado: não era o push, era o Netlify) + iniciar migração pro Vercel**. Push do commit `76eed6b` (pendência da sessão 4) rodado com sucesso pelo fundador — mas o site ao vivo continuou com a copy antiga do Marangos. Investigado via Netlify API (CLI já autenticada localmente): conta **Oliteam** estourou o crédito de uso da Netlify, todo deploy (git-triggered ou manual) desde `c31f6d7` retornava `"Skipped due to account credit usage exceeded"` — reset só em 23/jul. Decisão: migrar `landing/` pro **Vercel** (mesma conta do admin, sem esse teto). Criado `landing/vercel.json` (`cleanUrls` — equivalente ao pretty_urls do Netlify), commit `4f2a3e0`. Fundador criou projeto `oli-landing` no Vercel (root dir `landing`, sem build), adicionou o domínio, verificou o registro TXT de ownership. **Falta só trocar o registro A no registro.br** (`75.2.60.5` → `216.198.79.1`) pra completar a migração — ver §14 pro estado exato e checklist de conferência pós-migração.
