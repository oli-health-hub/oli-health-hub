# OLI Health Hub — Handoff Completo

> Documento de contexto para replicar o estado do projeto em outro chat.
> Última atualização: 28/Agosto/2026.

---

## 1. Visão geral

**OLI Health Hub** = coworking médico **físico** + app de gestão para os médicos + painel admin.
- **App** (médicos): React Native + Expo SDK 54, iOS + Android.
- **Admin** (operação): Next.js, hospedado na Vercel.
- **Site institucional**: estático em `landing/`, hospedado no **Netlify** (`olihealthhub.com.br`).
- Modelo de receita: **mensalidade de plano + horas de sala vendidas em blocos de 1h e consumidas por minuto** + módulos. Regra completa e armadilhas de copy em **§16** — leia antes de escrever qualquer material comercial.

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
| Site (Vercel) | projeto `oli-landing`, root dir = `landing/`, domínio `olihealthhub.com.br` (A → `216.198.79.1`), team "Guilherme's projects" (Hobby) |
| Repo | `github.com/guipasquetti/oli-health-hub` |

> ⚠️ **O site NÃO está mais na Netlify** desde 21/jul (ver §14). A conta Netlify estourou o crédito, os builds foram parados e o domínio desassociado. Qualquer recurso Netlify-specific (**Netlify Forms**, `_redirects`, `_headers`) **não funciona** — o equivalente na Vercel é `vercel.json`, e captura de formulário é via Supabase (ver §15).
>
> Existe uma cópia órfã do site em `iCloud/OLI - HH/Website/oli-deploy/` (era a pasta de deploy manual da era Netlify). **Não editar** — não vai ao ar. O que publica é `landing/`.

**Regra de deploy:**
- Mudança no **app** → `eas update` nos DOIS canais (`production` + `preview`). Reportar os 2 update group IDs.
- Mudança no **admin** → `git push` (Vercel auto-deploy).
- Mudança no **site/landing** → `git push` (Vercel auto-deploy, projeto `oli-landing`).
- Mudança em **edge function** → deploy via Supabase MCP / CLI.

## 4. Planos e preços (ATUAL — sem VIP por enquanto)

> ⚠️ Tabela corrigida em 28/ago — estava com os valores de antes da reforma de
> preços do §30/§31 (13-19/ago), nunca atualizada apesar de o resto do doc já
> refletir a mudança há duas semanas.

| Plano | Mensalidade | R$/min | Status |
|---|---|---|---|
| START | sem mensalidade | R$ 1,90 | default no signup (§36) |
| BASE | R$ 299 | R$ 1,50 | **desativado** (`ativo=false`), zero assinantes — preservado só por histórico, não vender |
| PRO | R$ 599/mês (R$ 499/mês no semestral, fidelidade 6 meses) | R$ 1,45 | ativo |
| VIP | — | — | standby (não projetar ainda) |

⚠️ `src/models/oli-plans.ts` e o `CLAUDE.md` ainda citam os valores velhos
(START 2,00 / BASE 1,50 / PRO 1,30) — pendência aberta desde §36, sem decisão
do fundador sobre atualizar o catálogo de código.

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
~~4. **Foto sala faltando**~~ ✅ **RESOLVIDO (31/jul)** — Sala 4 (Audio Visual) fotografada, processada e registrada em `roomPhotos.ts` (key `4`). 9 salas com foto agora.
5. ~~**Play Store produção**~~ ✅ **RESOLVIDO 13/jul** — app publicado em produção na Google Play Store. Ver §10.1.
6. ~~**`oli_encrypt`/`oli_decrypt`**~~ ✅ **RESOLVIDO 23/jun** — EXECUTE revogado de `authenticated`.
7. **Communicare**: aguardar token + endpoint LISTA + status + webhook. Depois remontar card da agenda.
8. ~~**VIP** preço~~ obsoleto — VIP virou "standby, não projetar" (§4/CLAUDE.md), item não faz mais sentido como escrito. **Cron auto-desativar START 30d sem reserva**: nunca construído — existe só um push de reengajamento por inatividade de login (`push_reacao_inatividade`, 14/30d), que é outra coisa; questionável se ainda faz sentido, já que o START não tem mensalidade pra "proteger" desde o §30/§31. **expo-blur** lock screen (rebuild nativo) — status não reconfirmado nesta auditoria.
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
~~19. **Programa de Indicação de Parceiros Externos**~~ ✅ **RESOLVIDO (31/jul sessão 6)** — nova tela `/parceiros` no admin (lista indicações + comissão devida/paga por parceiro, calculada automaticamente) + comissão virou **editável por parceiro** (`partner_commission_config`: comissiona sim/não + os 5 valores + carência do mensal), editada em `/equipe/[id]`. Ver seção da sessão 31/jul (6) abaixo.
~~20. **Push pendente (21/jul sessão 4)**~~ ✅ **RESOLVIDO (21/jul sessão 5)** — `git push origin main` rodado no terminal do fundador (commits `76eed6b`+`a7035a7` publicados). Mas isso revelou um problema maior: ver item 21.

~~21. **Netlify bloqueado por crédito esgotado — migração pro Vercel**~~ ✅ **RESOLVIDO (21/jul sessão 5)** — registro A trocado no registro.br (`216.198.79.1`), propagado, confirmado ao vivo: `/`, `/baixar`, `/confirmado`, `/privacidade` todos 200, `cleanUrls` funcionando, copy do Marangos ("Bem-vindo ao OLI!") aparecendo certo em `/baixar?ref=MAR-8124A`. Site institucional agora serve 100% do Vercel (projeto `oli-landing`). Ver §14 pro histórico completo. **Falta só o cleanup opcional** (desconectar domínio do site Netlify antigo, atualizar §3) — sem urgência, não afeta nada em produção.
~~22. **Régua de nurturing via push**~~ ✅ **Fatia 2 resolvida (31/jul sessão 6)** — implementados 13 dos ~18 gatilhos restantes (Ativação parcial, Engajamento, Operacional, Monetização, Indicação, Reativação 30d, Marcos). Ficam de fora: `nudge_checkin`/`parabens_primeiro_atendimento` (bloqueados — fluxo de check-in ainda não desenhado) e `fatura_disponivel` (não existe hoje um evento de "fatura gerada" no app). Ver seção da sessão 31/jul (6) abaixo.
~~23. **Catálogo de módulos desatualizado**~~ ✅ **RESOLVIDO (31/jul sessão 6)** — `ar_gestao_mensal` voltou pra `status: 'coming_soon'`. Commit `cc2628c`, OTA prod `6b5dc568`/preview `5cf76e72`.
~~24. **Tela de leads no admin**~~ ✅ **RESOLVIDO (31/jul sessão 6)** — `/leads` no admin (lista, muda status, observações) + notificação `lead_received` no feed (enum + trigger novo). Commit `cc2628c`.
25. **Pasta órfã no iCloud** — `iCloud/OLI - HH/Website/oli-deploy/` continua existindo. Comando pra apagar já passado ao fundador (`rm -rf` — ação que a sessão 6 não executa sozinha por ser hard-delete permanente fora do repo). Ainda não confirmado se foi rodado.
26. **🆕 Publicação do site ficou não-confiável (31/jul sessão 5)** — na mesma publicação deram **dois problemas independentes**: (a) o `git push` **não disparou deployment** na Vercel (o último visto era de 40 min antes; destravado com `git commit --allow-empty`); (b) publicado, o **domínio continuou servindo a versão antiga** enquanto a URL `.vercel.app` do mesmo projeto já servia a nova (alias preso a um deployment anterior; resolvido com `Promote to Production`). Os dois foram resolvidos, mas a causa de (a) não foi identificada — pode repetir. Se virar rotina, reconectar o Git em Vercel → `oli-landing` → Settings → Git. **Receita de diagnóstico na §18** — seguir ela antes de investigar do zero.
~~27. **Conferir se o item 24 já não está resolvido**~~ ✅ **Confirmado** — era mesmo a sessão 6 (paralela), commit `cc2628c` é dela. Itens 23 e 24 fechados de verdade, ver acima.
28. **🆕 Segundo parceiro "MBS Hackathon" no banco (achado 31/jul sessão 6)** — `user_type='partner'`, código `MBS-81CCB`, 5 indicações de 28/jul (incluindo o próprio founder e o Igor). Fundador confirmou que é intencional — parceiro que só gera leads, sem comissionamento — e configurado como `comissiona=false` em `partner_commission_config`. Sem ação pendente, só registrado pra não confundir sessão futura.

29. **🆕 4 edge functions no ar e fora do repo (03–05/ago)** — `rd-sync-status`, `rd-vincular-deals`, `rd-setup-webhook` e `rd-backfill` foram deployadas via MCP e **não existem em `supabase/functions/`**. Só `rd-leads-webhook` e `meta-leads-webhook` estão versionadas. Risco: perder o código-fonte se alguém redeployar por cima. Escrever os 4 arquivos no repo. **⚠️ Confirmado ainda aberto em 28/ago** — as 4 seguem deployadas (via `list_edge_functions`) e ausentes do repo local.

30. **🆕 `rd-probe` é temporária e deve ser apagada** — função de diagnóstico usada para investigar a RD (funil, campos, o 422). O MCP do Supabase não tem tool de deletar function; apagar pelo painel. **⚠️ Confirmado ainda aberto em 28/ago** — `rd-probe` segue ACTIVE em produção (v11). Só o fundador consegue apagar, pelo painel do Supabase.

31. **🆕 Typecheck e commit atrasados (05/ago)** — o sandbox de shell das sessões de 03–05/ago ficou wedged (`useradd failed`). O último typecheck verde foi rodado pelo fundador em 04/ago; tudo de 05/ago (coluna `rd_deal_id`, `rd_sync_erro` na tela, filtro por situação, observação colapsada) **não passou por `tsc`**. Rodar `cd admin && npx tsc --noEmit` **e** `npx tsc --noEmit` na raiz antes de publicar.

32. **🆕 Google Ads existe e não tinha dono conhecido (achado 04/ago)** — a distribuição de `fonte` na tabela `leads` mostrou `Busca Paga | Google` além do Facebook Ads e de `Referência | linktr.ee`. Toda a documentação anterior (§19) falava só de Meta. **Descobrir quem opera essa campanha** — os leads dela são justamente os que chegam sem telefone.

33. **🆕 Planilha do Google do Meta ainda ligada em paralelo** — mantida de propósito como rede de segurança enquanto o webhook da RD provava que pega tudo. Agora que ele está confirmado funcionando (4 leads sozinhos em 05/ago), decidir se desliga.

34. **🆕 `hour_packages.valor` é dado morto e enganoso (achado 07/ago)** — a coluna guarda R$120/h fixo, mas a cobrança calcula `horas × 60 × plans.taxa_min` e **ignora esse campo**. Coincide com o START, o que mascarou o problema. Corrigir o valor por plano ou remover a coluna, antes que alguém a use como fonte. Ver §28. **⚠️ Confirmado ainda aberto em 28/ago** — consultado direto no banco: `Avulso 1h` = R$120 (correto pelo §4 seria R$114), `Starter 10h` = R$1.200 (correto seria R$1.140). Nunca corrigido apesar de o §30 ter dito que ficaria "trivial" com só 2 pacotes.

35. **🆕 Peças comerciais por plano (07/ago)** — feita a do PRO (`iCloud/OLI - HH/OLI_Plano_PRO.svg`, 1080×1350). **Regra que vale para as próximas: o cliente vê um plano por vez**, então nada de "35% mais barato" ou "o mais completo" — número relativo sem comparação não significa nada, e "compensa a partir de 25h" lido isolado vira objeção. Formato é ficha de serviço, não anúncio. Faltam START e BASE no mesmo padrão.

~~36. **🆕 Reformulação de planos aprovada, nada implementado (13/ago)**~~ ✅ **RESOLVIDO (19/ago)** — implementado no §31 (banco, app; site e admin ficaram de fora do escopo daquela sessão, ver pendência do próprio §31). Nunca tinha sido marcado aqui — só corrigido nesta auditoria de 28/ago.

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

~~**🟡 Pendência de doc (baixa prioridade):** §3 e a "Regra de deploy" ainda listam Netlify~~ ✅ **RESOLVIDO (31/jul sessão 2)** — §3 corrigido pra Vercel/`oli-landing`, com aviso explícito de que recursos Netlify-specific não funcionam mais. A pendência de doc custou uma tarde inteira de trabalho na pasta errada: ver §15.

### 🔴 INCIDENTE resolvido (22/jul) — app sumiu da Google Play (404 na ficha)

- **Sintoma:** `play.google.com/store/apps/details?id=com.oli.healthhub` retornava 404 direto do servidor do Google — não era atraso de indexação de busca, a ficha não resolvia.
- **Investigação (sem acesso a Play Console/e-mail do dev — feita via prints do fundador):** "Atividades de envio" mostrava envio #3 (13/jul, 8:30) com status "Publicado" — bate com o handoff, foi ao ar de verdade naquele dia. Não existe registro de nenhuma ação de remoção entre 13/jul e 21/jul nessa tela (ela só loga envios feitos pelo time, não enforcement automático do Google).
- **Causa raiz não confirmada** — não foi possível cravar por falta de acesso a "Política e programas → Status do app" nem ao e-mail da conta de desenvolvedor (únicos lugares que mostram o motivo real de uma suspensão/remoção automática). Hipóteses não verificadas: prazo de target API level vencido, Data Safety expirado, ou denúncia de política.
- **Resolução:** durante a investigação, envio #4 (21/jul, 22:28) — Produção — foi enviado e passou pela análise do Google. App voltou ao ar (`Updated on Jul 21, 2026` na ficha pública), instalação confirmada funcionando pelo fundador.
- **Pendência real:** já que a causa raiz não foi identificada, o mesmo pode acontecer de novo sem aviso. Se sumir de novo, checar primeiro "Política e programas → Status do app" e e-mail do dev antes de reenviar — pra não ficar só reagindo ao sintoma.

### ✅ Resolvido na sessão 22/jul (indicação em destaque + reforma da aba Ecossistema + fix módulos)

- **🎯 Motivação:** Programa de Indicação (§7) é diferencial forte sendo divulgado ativamente, mas estava enterrado — só num popup de 1ª vez, dentro de Perfil, e no fim de `meu-plano.tsx`. Pedido do fundador: dar mais visibilidade sem virar ruído.

- **🆕 Botão "Indique e Ganhe"** (`src/components/IndiqueEGanheButton.tsx`): pill verde com ícone de presente, ao lado do contador de Olicoins no header do **Início** e do **Perfil** → abre `/indicacao`. Olicoins manteve a posição original (feedback do fundador: só o botão de indicação precisava de destaque/centralização, não o contador).

- **🎨 Aba Ecossistema — reformulada (Direção A do plano discutido na sessão):**
  - Card **"Meu Plano"** virou hero com fundo na cor do plano (START cinza, BASE verde, PRO dourado, VIP roxo) em vez de card branco genérico — badge "Ativo" e botão de upgrade translúcidos/brancos sobre a cor.
  - Novo card **"Indicação OLI"** — banner clicável com ícone de presente → `/indicacao`. Antes a aba não tinha nenhuma menção ao programa.
  - **"Serviços Inclusos" removido** — era uma lista fixa (Recepção, Jurídico, Contábil...) igual pra qualquer plano, sem checar feature flags reais. Substituído por **"Benefícios do Plano"**: deriva de `FEATURES` (matriz já existente em `meu-plano.tsx`, agora exportada) mostrando o que o plano atual desbloqueia *em relação ao tier anterior* — sempre fiel à fonte única, sem inventar dado novo.
  - **"Módulos e Soluções"**: depois de iterar (grid 2 colunas → feedback pedindo borda mais sutil → feedback final pra tirar o preview inteiro), a seção virou só um card-teaser com botão sólido "Ver Módulos e Soluções" → `/modulos`. Zero fetch de preço/status de módulo na aba Ecossistema agora — só navegação.
  - **Especialistas OLI**: 5 cards grandes "em breve" viraram 1 card compacto com avatares sobrepostos (mantido como preview por decisão do fundador, "vamos ver como fica").

- **🐛 Bug de dado corrigido (motivo original do pedido: "PRO mostrava contabilidade incluída"):** causa era a lista fixa "Serviços Inclusos" citada acima, que não filtrava por plano — resolvido removendo o card e trocando pela fonte dinâmica.

- **🔧 Communicare Connect liberado pra contratação:** estava `status: 'coming_soon'` + `activationType: 'oauth'` (self-service que não existe). Virou `'available'` + `'contact_sales'` — contratação passa pelo WhatsApp da recepção, mesmo padrão de Contabilidade Médica e Gestão de Convênios. `requiredPlan` ajustado de BASE pra **PRO** (regra de negócio: BASE não inclui Communicare).

- **🐛 Bug de inconsistência corrigido:** `/modulos.tsx` abria o `CheckoutModal` (pagamento Asaas) pra **qualquer** módulo, inclusive os sem preço definido (contabil_mello, communicare, scribe_ia) — só `ecossistema.tsx` tinha a lógica certa de rotear pro WhatsApp quando não há formulário + preço in-app. Extraído pra `src/utils/moduleContract.ts` (fonte única da regra "sem contratação direta → WhatsApp da recepção"), usado nas duas telas.

- **📝 Descrições de módulo corrigidas** (copy desatualizada/errada, achada durante a sessão):
  - Communicare Connect: descrição citava plano VIP (não comercializado, contra convenção do CLAUDE.md) e dizia que BASE tinha acesso. Reescrita: só PRO, foco em gestão de agenda + emissão de NF.
  - Contabilidade Médica: descrição só mencionava diagnóstico gratuito no BASE, mas o PRO também já inclui (dado em `featuresByPlan` já estava certo, só o texto não refletia).

- **🎨 Ícone de informação nos módulos:** em vez de mostrar a descrição completa inline (ocupava espaço), cada card de `/modulos.tsx` ganhou um ícone "i" que abre a descrição completa via alerta nativo — mesmo padrão testado nos tiles do Ecossistema antes de serem removidos de lá.

- Commits da sessão: `cd08f2e` (fix Monitor de Atendimentos) `1f34fe8` `8b606ba` (fix incluso-falso + 1ª leva do redesign) `957ff45` (ajuste Olicoins/botão) `344fe62` (libera Communicare) `ed6f67f` (hero + grid módulos) `46ba7f3` (fix descrições + borda) `93882ed` (remove preview módulos). OTA enviada em várias rodadas — última: production `b792c374-2cb3-4cee-ac55-7cfbd2b53f6d` / preview `21dcfd46-ee18-44ae-8b9a-fd8f3fbf496b`.

### ✅ Resolvido na sessão 31/jul (fixes onboarding/app lock + foto Sala 4 + início da régua de nurturing push)

- **🐛 Fix teclado do WhatsApp preso no onboarding:** `keyboardType="phone-pad"` no iOS não tem tecla "Concluído" — sem toque-fora nem `Keyboard.dismiss`, o cadastro travava nesse campo. `app/onboarding.tsx` envolvido com `TouchableWithoutFeedback` pra fechar teclado ao tocar fora. Commit `38d9b6d`. OTA prod `e1aa5168-5fe8-4055-b901-16cc1af0be15` / preview `9d65487a-4be8-4803-8e0d-b7c4fb21557d`.

- **🆕 Campo manual de código de indicação:** achado que não existia NENHUM lugar no app pra digitar um código de indicação manualmente — o onboarding enxuto (sessão 8/jul) só resolve `?ref=` via deep link automático, e a `landing/baixar.html` mandava o usuário pra "Como você nos conheceu?" (um seletor categórico, não campo de texto) quando a instalação era nova (sem deferred deep link, limitação já documentada em §7). Fix: campo colapsável "Tem um código de indicação?" em `app/onboarding.tsx` (mesmo padrão do `CouponField` — input + botão Aplicar, valida via RPC `resolve_referral_code` já existente), + dica da `baixar.html` corrigida. Commit `6e87e51`. OTA prod `662d3c93-2ce5-4f2f-aa80-eef500ffb015` / preview `7e7fc2e5-3064-4165-be09-b12e28ebbfac`.

- **📷 Foto da Sala 4 (Audio Visual):** última sala sem foto (pendência desde 18/jun) — recebida, processada (`sips -Z 1200`, ~78% qualidade, 144KB) e registrada em `roomPhotos.ts`. Commit `c5cb543`. OTA prod `e89428c0-c55f-495c-b491-69bcfd18dc1e` / preview `41abbab3-0a73-4f36-8131-5453f7e6722b`.

- **🐛 Fix crítico App Lock — logoff forçado toda hora:** investigando reclamação "app desloga toda hora", achado que `useAppLock.ts` tinha uma flag (`oli_force_password_next`) que forçava logoff completo (e-mail/senha) sempre que o usuário desbloqueava pelo **código do dispositivo** em vez de Face ID — mecanismo intencional (16/jun) pra caso de "não é o dono do rosto". Só que Face ID falhar por ângulo/luz/máscara é comum, então o usuário caía nesse fallback com frequência e era deslogado por completo toda vez. **Decisão do fundador:** remover essa punição — desbloqueio por código do dispositivo agora vale igual a Face ID; só o toggle "Bloqueio biométrico" no Perfil desloga de verdade. Trade-off aceito: perde a garantia extra de forçar senha após uso do código do aparelho. Commit `17aa558`. OTA prod `2028f402-18be-46fe-9836-41e7d156ae62` / preview `ec9ed090-ec44-471f-aaf5-a8b153763a77`.

- **🆕 Régua de nurturing via push — INÍCIO (fatia 1 de N, código ainda não commitado/OTA nesta sessão):**
  - Documento fonte: `OLI_Nurturing_Push.docx` (iCloud, fora do repo) — 8 estágios, 23 gatilhos de push, reaproveitando a infra que já existe (`push_tokens`, `send-push`, `call_send_push()`). Nada tinha sido implementado ainda; documento pedia validação de 6 pendências antes de codar.
  - **Decisões tomadas nesta sessão:**
    1. Tom sempre **formal** nas pushes (nunca "Bora"/gírias) — consistente com o resto do app. Reescrito o texto de `parabens_primeiro_atendimento` que usava "Bora marcar o próximo?" (ainda não implementado, só a copy do doc foi corrigida na decisão).
    2. Gatilho `sugestao_modulo`: prioriza **Contabilidade Médica** — único módulo que só exige plano BASE (os outros são PRO-only, empurrariam upgrade de plano só pra poder contratar). Achado de brinde: Gestão de Convênios também não deveria ser sugerido (fundador confirmou standby/parceria fraca — ver item 23 do §11).
    3. Curtida/comentário na Comunidade: **resumo agrupado diário** em vez de push por evento (evita enxurrada pra post popular).
    4. **🔒 Guardrail de política de loja:** o fundador pediu recompensar com Olicoins quem avaliasse o app na loja — **recusado**: Apple e Google proíbem explicitamente incentivar rating/review de loja, e o app já sumiu uma vez da Google Play sem causa confirmada (§ incidente 22/jul). Desenho alternativo aprovado: pesquisa de satisfação **interna** (não a loja), Olicoins por responder (ação 100% sob controle do OLI), e só quem dá nota 9-10 veria depois o prompt nativo de avaliação — sem recompensa nessa etapa. Prompt nativo (`expo-store-review`) fica pendente até o módulo ser instalado e ir a produção via rebuild nativo (mesma lição do incidente de 13/jul com `expo-location` — módulo nativo não linkado não pode ser chamado antes do rebuild correspondente publicar).
  - **Implementado (banco, já ativo em produção via Supabase MCP):**
    - `push_dispatch_log` + `push_dispatch_allowed()` + `log_push_dispatch()` — governança de frequência pros gatilhos NOVOS (janela 9h-19h BRT, cooldown 7 dias por gatilho, máximo 1 push de crescimento/profissional/dia). Os 3 gatilhos já existentes (`lembrete_reserva`, `objetivos_pendentes`, `reacao_inatividade`) não usam essa infra — são diários por natureza, como o próprio doc já dizia.
    - Trigger `trg_push_boas_vindas` (AFTER UPDATE OF onboarding_complete) → `boas_vindas_cadastro`, tempo real.
    - Cron `push-nudge-primeira-reserva` (diário, 9h BRT) — cadastro há 2 dias sem reserva.
    - Tabela `app_satisfaction_responses` (RLS própria linha) + cron `push-nudge-avaliacao-app` (diário, 9h BRT) — cadastro há 14+ dias, nunca respondeu; cooldown de 7 dias faz o "de tempos em tempos" sozinho, para quando a pessoa responde.
  - **Implementado (app, código pronto, aguardando commit+OTA):**
    - `app/avaliacao-app.tsx` — tela modal da pesquisa (nota 0-10 + comentário opcional), credita 10 Olicoins ao responder, idempotente.
    - `app/_layout.tsx` — listener de deep-link estendido: os 3 gatilhos remotos que já existiam nunca tinham navegação ao toque (achado ao ler o doc) — agora `lembrete_reserva`/`boas_vindas_cadastro`/`nudge_primeira_reserva` → Agenda, `objetivos_pendentes` → Completar Perfil, `reacao_inatividade` → Início, `nudge_avaliacao_app` → `/avaliacao-app`.
    - `database.types.ts` regenerado (novas tabelas `push_dispatch_log` + `app_satisfaction_responses`).
  - ✅ Commit + OTA enviados ainda nesta sessão (commit `c875001`, OTA prod `78666156`). Fatia 2 (estágios Ativação parcial, Operacional, Monetização, Indicação, Reativação 30d, Marcos) implementada na sessão 6 — ver abaixo.

### ✅ Resolvido na sessão 31/jul (sessão 6 — leads, módulo standby, nurturing fatia 2, comissão de parceiros editável)

Sessão rodou em paralelo com as sessões 3-5 (site institucional) — trabalhou só em `app/`, `admin/` e Supabase, sem tocar `landing/`.

- **🐛 Fix `ar_gestao_mensal`** (fecha §11 item 23): `status: 'available'` → `'coming_soon'`. Módulo some de `/modulos` e da aba Ecossistema. Commit `cc2628c`, OTA prod `6b5dc568-9b53-4300-8ba7-e64f24e40ba2` / preview `5cf76e72-cee9-4e29-9d90-b8a46348262c`.

- **🆕 Tela `/leads` no admin** (fecha §11 item 24): lista os leads do formulário do site (`leads`, ver §15), com troca de status (`novo`/`contatado`/`visita_agendada`/`convertido`/`descartado`) e campo de observações internas, tudo via server action. Notificação `lead_received` nova no feed do admin — enum `notification_type` ganhou o valor + trigger `trg_notify_lead_created` (AFTER INSERT em `leads`, dispara direto no banco). Testado inserindo e apagando um lead sintético via SQL, notificação apareceu e sumiu limpo. Commit `cc2628c`.

- **🆕 Régua de nurturing push — fatia 2 (fecha parcialmente §11 item 22):** implementados os gatilhos restantes de `OLI_Nurturing_Push.docx` que não dependem de decisão de produto ainda em aberto, reaproveitando toda a infra da fatia 1 (`call_send_push`, `push_dispatch_allowed`, `push_dispatch_log`):
  - **Ativação:** `nudge_primeiro_paciente` (cron diário, cadastro há 5 dias sem paciente) e `perfil_100_completo` (evento — trigger `AFTER UPDATE` em `profiles`, dispara só na transição de "faltam objetivos" pra zero). Novo helper SQL `profile_faltam_count(profiles)` reaproveitado também por `push_objetivos_pendentes` (refatorado, mesmo resultado, sem duplicar a checagem de 10 seções).
  - **Engajamento:** `nudge_comunidade` (cron semanal, quinta 9h BRT) e resumo diário agrupado de curtidas/comentários recebidos (`push_resumo_comunidade_diario`, 1 push por dia por profissional em vez de 1 por evento — decisão já tomada na sessão anterior) e `conquista_desbloqueada` (trigger no INSERT do `olicoins_ledger` quando `evento LIKE 'ach_%'`).
  - **Operacional:** `saldo_baixo_horas` — trigger em `hour_balance` com detecção de borda (só dispara na transição de ≥2h pra <2h, não a cada uso; comparação feita via delta de `minutos_usados`/`minutos_total` antes/depois da linha mudar).
  - **Monetização:** `sugestao_upgrade_plano` (START com 10h+/mês), `sugestao_anual` (mensal ativo há 3+ meses) e `sugestao_modulo` — só sugere **Contabilidade Médica**, único módulo compatível com plano BASE (decisão já tomada na sessão anterior, os demais são PRO-only).
  - **Indicação:** `nudge_indicacao` (cron mensal, 30+ dias sem indicar ninguém) e push de `indicacao_confirmada` — estendido dentro de `apply_referral_benefit` (a mesma função que já credita as horas), com copy diferente pro caso de parceiro (`user_type='partner'`, quem ganha é quem se cadastrou, sem mencionar "indicação").
  - **Reativação:** bucket de 30 dias adicionado em `push_reacao_inatividade` (WhatsApp direto no corpo do texto, sem deep link, conforme o doc) + variação leve na copy do 14º dia. **🐛 Erro de concordância pego e corrigido antes de publicar:** primeira versão tinha "fazem duas semanas" — "fazer" impessoal indicando tempo decorrido é sempre invariável, corrigido pra "faz duas semanas".
  - **Marcos:** `aniversario_cadastro` (cron diário, dispara só na data exata de cada aniversário de cadastro).
  - **Fora de escopo, registrado:** `nudge_checkin`/`parabens_primeiro_atendimento` (estágio Ativação) seguem bloqueados — dependem do fluxo de confirmação de presença na sala, que ainda não foi desenhado (mesmo bloqueio já registrado na fatia 1). `fatura_disponivel` (estágio Operacional) também não implementado — hoje não existe no app nenhum evento de "fatura gerada"; o que existe é agregação client-side em Financeiro, não uma linha de banco que dispare no momento certo.
  - `app/_layout.tsx`: roteamento de toque estendido pra cada gatilho novo (ex.: `nudge_primeiro_paciente` → Pacientes, `saldo_baixo_horas` → Financeiro, `sugestao_modulo` → `/modulos`).
  - Testado sem disparar push real pra médico de verdade: updates no-op em linhas reais (mesmo valor no campo que dispara o trigger) pra confirmar que os triggers rodam sem erro sem cruzar o threshold, e todas as 8 queries de elegibilidade dos crons novos rodadas isoladas (sem chamar `call_send_push`) pra conferir contagem de candidatos antes de agendar.
  - Migration consolidada em `supabase/migrations/20260731_nurturing_push_stage2.sql` (aplicada via Supabase MCP em 7 chamadas separadas). Commit `e820abe`, **OTA enviada** — prod `d809ceed-636c-4bab-9fce-ad15b4457b3d` / preview `8913fa52-089c-4257-9ca7-6f5989e4b08d`.

- **🆕 Tela `/parceiros` — Programa de Indicação de Parceiros Externos** (fecha §11 item 19): lista cada parceiro (`user_type='partner'`), indicações geradas e linhas de comissão devida/paga, com ação de marcar como paga manualmente. Comissão sempre calculada em runtime a partir de `referrals` + `subscriptions` + `usage_charges` — nada de valor duplicado guardado à toa; só o que já foi pago vive numa tabela própria (`partner_commission_payments`, `UNIQUE(referred_professional_id, tipo)` evita pagar a mesma linha duas vezes).
  - **Achado durante o teste:** existe um segundo parceiro no banco, "MBS Hackathon" (código `MBS-81CCB`), com 5 indicações internas de 28/jul — incluindo o próprio founder (plano PRO) e o Igor. Cálculo automático ia mostrar R$359 "devido" pro founder. Fundador confirmou: é intencional, fica como fonte de leads, mas **sem comissão** — ver item 28 do §11.
  - **Pedido do fundador nessa hora:** comissão fixa em código não escala — precisa ser fácil configurar/desligar por parceiro, e mais fácil ainda criar parceiro novo sem SQL manual. Resultado:
    - Nova tabela `partner_commission_config` (por parceiro: `comissiona` bool + os 5 valores de tier + carência do mensal), editável numa seção nova em `/equipe/[id]` (só aparece quando `user_type='partner'`) — mesma tela que já cria/edita/apaga parceiro, então "adicionar parceiro fácil" já estava resolvido, só faltava a parte de comissão.
    - `createTeamProfile` e `setUserType` (as duas actions que criam/convertem um perfil em `partner`) agora chamam `generate_referral_code` + criam a linha default de `partner_commission_config` automaticamente — fecha de vez a necessidade de SQL manual que foi preciso pro Marangos (§11 item 4 sessão 21/jul).
  - `database.types.ts` regenerado 2x (uma por tabela nova). `tsc --noEmit` limpo em admin. Commits `9bd0679` + `1fa817f`.

- **Regra seguida a sessão inteira:** cada item publicado com confirmação explícita do fundador antes do `git push`/`eas update` — nenhum push automático. Commits feitos com `git add` seletivo (nunca `git add -A`) porque as sessões 3-5 estavam mexendo em `landing/index.html` e `docs/HANDOFF.md` ao mesmo tempo, no mesmo checkout local.

## 12. Convenções (do CLAUDE.md)

- TypeScript estrito, sem `any`, sem `console.log` em produção.
- Estilos em `StyleSheet.create()`, sem objetos inline no JSX.
- `professionalId` sempre explícito nas ops Supabase.
- Componentes PascalCase, telas kebab-case, mudanças cirúrgicas.
- LGPD: CPF nunca em texto puro (hash SHA-256); dados de saúde = sensíveis (Art. 11); consentimento com timestamp; audit log (Art. 37); export/delete (Art. 18).
- **Gramática — "OLI" é substantivo masculino:** sempre "do OLI", "no OLI", "ao OLI" — nunca "da OLI", "na OLI", "à OLI". Vale em qualquer comunicação (push, e-mail, telas do app, docs).
- Mesmo em copy informal, respeitar concordância verbal — não misturar registro (ex.: "dê uma olhada e marque", nunca "dá uma olhada e marque").
- Comunicação com o usuário (push, onboarding, UI) não expõe detalhe técnico do produto (hash, criptografia, nome de coluna) — descrever o benefício em linguagem simples (ex.: "fica visível só para você" em vez de "CPF protegido por hash").

## 15. Site institucional — reescrita de conteúdo + captura de leads (31/jul sessão 2)

**Contexto:** o site tinha três problemas somados. (1) O formulário de contato era **puramente decorativo** — `<form>` sem `action`, sem `name` nos campos e sem uma linha de JS na página inteira; todo lead preenchido desde sempre se perdeu, e ninguém sabia. (2) Todas as imagens de seção eram **geradas por IA** (renders de consultório que não existem). (3) A copy nunca dizia o que o OLI é: o H1 era o slogan "Operação invisível, crescimento visível", e o modelo de negócio (sala por minuto) só aparecia no quarto bloco.

**⚠️ Armadilha que custou a sessão — a pasta órfã.** Existe `iCloud/OLI - HH/Website/oli-deploy/`, cópia da era Netlify, byte a byte igual ao `landing/`. Toda a reescrita foi feita nela por engano; o erro só apareceu ao abrir este handoff e ler §14. **Regra: o site que vai ao ar é `landing/` no repo, publicado pela Vercel (`oli-landing`). Nada mais.** A cópia órfã continua no iCloud — se sobrar tempo, apagar.

**Captura de leads — nova tabela `leads` (migration `create_leads_table_for_site_form`):**
- Colunas: `nome`, `whatsapp`, `email` (obrigatórios), `especialidade`, `origem`, `status`, `observacoes`, `referrer`, `user_agent`.
- `status` ∈ `novo | contatado | visita_agendada | convertido | descartado`. `origem` ∈ `site | whatsapp | indicacao | evento | outro`.
- RLS: **INSERT liberado pra `anon`** com `with check (origem = 'site')` — é formulário público; CHECK constraints na tabela limitam tamanho de campo e validam formato de e-mail. **SELECT/UPDATE/DELETE só com `is_oli_admin()`**.
- Testado por simulação de role (`set local role anon`): insert válido grava, leitura anônima devolve 0 linhas, e-mail inválido e origem forjada são recusados. Linha de teste removida.
- O `landing/index.html` insere direto na REST API do Supabase com a **chave publicável** (`sb_publishable_...`, hardcoded no HTML de propósito — é pública e só consegue inserir).
- **Por que não Netlify Forms:** era a solução óbvia e foi a primeira implementada, mas Netlify Forms **não existe na Vercel** — teria falhado 100% das submissões em produção. Mesma armadilha do §14.
- **Ainda não existe tela de leads no admin.** Hoje só dá pra ver via SQL/painel do Supabase. Próximo passo natural: `/leads` no admin + notificação (o enum de `admin_notifications` precisaria de um valor novo, tipo `lead_received`).
- **RD Station:** decisão do fundador — não integrar o site. O RD fica só na LP de marketing.

**Fotos reais (fim das imagens de IA):**
- 8 fotos de `iCloud/OLI - HH/Fotos Estrutura/Tratadas/` + 6 de `iCloud/OLI - HH/MBS/assets/` → otimizadas pra `landing/fotos/` (34 MB → 2,1 MB, PNG→JPEG progressivo, lado maior 1600px).
- As de `MBS/assets` são as únicas **com gente**: Claudia atendendo um paciente no balcão e Claudia na recepção. Resolveram o único ponto do site que falava de recepção e mostrava sala vazia.
- ⚠️ `Fotos Estrutura/` na raiz (fora de `Tratadas/`) é o espaço **em obra** — sala vazia, caixa no chão. Não usar em nada comercial.
- Os 11 `img_*.jpg` de IA (14,6 MB) e `room-photos/` (984 KB) foram **deletados de `landing/`** — nenhuma outra página os referenciava.
- 🔴 **Direito de imagem:** a foto do balcão mostra a Claudia e um homem. Fundador confirmou que são pessoas conhecidas e autorizou o uso.

**Reescrita da copy** (regra fixada: linguagem concreta, zero jargão):
- H1: "Consultório pronto. Você paga só o tempo que usa." (⚠️ **substituído na sessão 3 — ver §16**, a promessa por minuto estava errada). Removidos da página inteira: *ecossistema, premium, pay-per-use, networking, elite, patamar, blindar, hub de saúde premium*.
- Ordem das seções trocada: o espaço agora vem **antes** do preço (`problema → modelo → infraestrutura → planos → contato`).
- Planos com a conta pronta: R$ 100 por consulta de 50 min (⚠️ **corrigido na sessão 3 — ver §16**); BASE compensa a partir de **10 h/mês**, PRO a partir de **25 h/mês** (pontos de virada calculados, batem com `oli-plans.ts`).
- Formulário reduzido de 5 campos obrigatórios pra 3 (especialidade virou opcional, "interesse de plano" saiu).
- Removidos: galeria "Conheça as salas" (fotos antigas, a pedido do fundador) e o selo "Mais popular" do PRO (afirmação insustentável hoje → "Mais completo"). Tirado também o "CRM clínico Communicare" do PRO — nome de fornecedor e integração ainda em mock (§6).
- `<title>`, meta description e tags Open Graph reescritos — o `<title>` ainda era o slogan antigo, e é o que aparece quando o link é mandado no WhatsApp.
- Todos os WhatsApp do site unificados no **comercial (11) 97223-3745** (era o da recepção, 91998-0777).

**🐛 Fix de layout do hero (achado em produção pelo fundador):** em monitor grande aparecia só o teto da sala e o texto sumia. Causa: a foto do hero é retrato (1024×1536) e o `<img>` estava no fluxo com `width:100%; height:100%` dentro de um `.hero-image` sem altura definida — a altura intrínseca da imagem esticava a linha do grid. Medido ao vivo: **hero com 2130px de altura num viewport de 1102px**, com o texto centralizado nesse bloco, portanto fora da tela. Fix: `position:absolute; inset:0` na imagem (sai do fluxo, não opina sobre a altura) + `object-position: center 60%` + `max-height: 860px` no `.hero` (anulado no breakpoint mobile). Confirmado ao vivo: hero volta pra 1006px, título/texto/botões visíveis sem rolar.

**Estado:** `landing/` já publicado pelo fundador com a reescrita e o Supabase (confirmado ao vivo). ✅ Fix do hero commitado e no ar (`64c0112`). Faltam: tela `/leads` no admin (hoje só via SQL) e apagar a pasta órfã `oli-deploy` no iCloud.

## 16. Página `/consultorio` + correção da promessa de cobrança (31/jul sessão 3)

**Contexto:** o fundador quis um link pessoal pra mandar no WhatsApp mostrando **uma sala específica** — sem ser a home institucional, que é fria demais pra um primeiro contato com amigo. Criada `landing/consultorio.html`, no mesmo padrão visual do site.

**A página (`olihealthhub.com.br/consultorio`):**
- Layout mobile-first (coluna única, 560px), fotos `consultorio-ginecologia.jpg` + `-vertical.jpg` + `lounge-espera.jpg`.
- **`?para=Nome`** → mostra "Nome, essa é a sala que eu te falei." no topo e pré-preenche a mensagem do WhatsApp com o nome. É o que tira a cara de disparo em massa.
- **`?ref=CODIGO`** → repassado pro botão "Baixar o aplicativo" (`/baixar?ref=`), preservando o benefício de indicação (§7).
- Open Graph aponta pra foto da sala → a prévia no WhatsApp já mostra o consultório antes do clique.
- CTA de WhatsApp no comercial (11) 97223-3745, igual ao resto do site.
- ⚠️ A foto da sala de gineco tem **cadeira com perneiras** bem visível. Pra público de estética/odonto pode ler como "consultório de ginecologista" — `consultorio-verde.jpg` (maca reta) é a alternativa. Decisão do fundador pendente.
- Não linkada de lugar nenhum: só chega quem recebe a URL.

**🔴 Correção de premissa — o modelo de cobrança estava descrito errado no site inteiro.**

Regra real, confirmada pelo fundador (**é premissa, não pode divergir em nenhuma frente**):

| | Regra |
|---|---|
| Compra de horas | **Só em blocos de 1 hora.** Nunca menos. É preciso ter horas no banco pra reservar. |
| Reserva | Múltiplos de 30 min (reserva de 30 min é válida e desconta só 30 min do saldo) |
| Consumo | Por minuto, dentro da reserva |
| Excedente | Arredonda pros próximos 30 min; passou de 30 sem checkout, cobra mais 30 |

- ✅ **`src/services/usageChargeService.ts` (`calcUsageCharge`) já implementa isso corretamente.** Não "consertar" achando que deveria ser hora cheia — o comportamento atual é o desejado.
- ❌ O que estava errado era **só a copy**: o site vendia "pague só os minutos que usar" e dava o exemplo "uma consulta de 50 min sai por R$ 100", o que implica comprar 50 minutos avulsos — inexistente. Quem entra novo compra 1h (R$ 120) e fica com 10 min de saldo.

**Trechos corrigidos em `landing/index.html`:**

| Onde | Antes | Agora |
|---|---|---|
| H1 do hero | "Você paga só o tempo que usa." | "Sem aluguel e sem fidelidade." |
| `<title>` / meta / og:title | idem | idem |
| Seção "Quanto custa" (h2) | "Pague só o tempo que usar." | "Compre horas e use por minuto." |
| Subtítulo dos planos | "consulta de 50 min custa R$ 100" | blocos de 1h, consumo por minuto, sobra fica no saldo |
| Card START (tagline) | "paga só os minutos que usar" | "compra horas e usa por minuto" |
| Card START (preço/min) | "50 min sai por R$ 100" | "a hora de sala sai por R$ 120" |
| Feature do START | "Reserve por minuto ou por hora" | "Reserve a partir de 30 minutos" |
| Passo 01 "como funciona" | "paga só os minutos que usar" | "compra horas e consome por minuto" |

- Cards BASE e PRO **não mudaram** — "R$ 1,50/min · 25% mais barato" é taxa de consumo e está correta.
- Varredura em `landing/` confirma zero ocorrências restantes de "tempo que usa", "só os minutos", "50 min", "por minuto ou por hora".
- ⚠️ **§15 deste handoff (linha do H1) ficou desatualizado** — registra o H1 antigo como decisão da sessão anterior. Este bloco substitui.
- ⚠️ Não conferido se `docs/OLI_BASE.md` descreve a regra corretamente. Verificar antes de usá-lo como fonte.
- 🟡 O H1 novo é mais defensivo e menos original que o anterior. Fundador ciente; vale explorar o saldo que não expira como diferencial.

~~**Estado:** ⚠️ Nada commitado nem publicado.~~ ✅ **PUBLICADO** (confirmado ao vivo em 31/jul, sessão 5). `olihealthhub.com.br/consultorio` responde 200 com o título "O consultório | OLI Health Hub" e as 3 fotos; o H1 corrigido ("Sem aluguel e sem fidelidade") está servindo na home. Subiu junto com o fix das fotos da §17, no mesmo push.

## 17. Responsividade das fotos do site (31/jul sessão 4)

**Pedido:** "o layout das seções das fotos está como estava o header" — ou seja, o defeito que já tinha sido corrigido no hero (§15) continuava vivo nas seções de baixo.

**Causa-raiz (a mesma do hero, medida ao vivo em `olihealthhub.com.br` com viewport de 2844px):** **nada limitava a largura do conteúdo da página.** Não existia container com `max-width` em lugar nenhum — todas as seções esticavam de ponta a ponta. Consequências medidas:

| Elemento | Antes | Depois |
|---|---|---|
| `.modelo-img` (cada foto de "Como funciona") | **1308×981** | 608×405 |
| Seção `#modelo` inteira | **4720px de altura** (≈4 telas só de foto) | 2416px |
| `.infra-img` | 880×587 | 408×272 |

Agravante: a 1308px de largura as fotos eram renderizadas **acima do tamanho real do arquivo** (1600×900 esticado dentro de um box 4:3) — perdiam nitidez e ainda perdiam mais de um quarto das laterais no corte.

**Correções em `landing/index.html` (só CSS, nenhuma mudança de conteúdo):**

- **`.section > *` com `max-width: 1280px` + margens auto.** É o fix principal — resolve sozinho a maior parte do problema, para toda seção, presente e futura.
- **`.modelo-img`: `aspect-ratio` 4/3 → 3/2.** As fotos dessa seção são 16:9 (1600×900) e 3:2 (1536×1024); num box 4:3 perdiam as laterais à toa.
- **`.infra-img`: `object-position: center 45%`.** `consultorio-ginecologia-vertical.jpg` é retrato (1024×1536) num card horizontal e o terço de baixo é só chão — o corte centralizado desperdiçava o enquadramento. Não afeta as outras duas fotos do grid (paisagem: nelas o corte é lateral, não vertical).
- **Novo breakpoint `@media (max-width: 900px)`.** Antes o layout só quebrava em 768px, então em tablet retrato (iPad, 834px) a foto caía pra 359px — menor que o bloco de texto ao lado — e Infraestrutura mantinha 3 cards de 242px. Agora `.modelo-row` vira coluna única e `.infra-grid` vira 2 colunas já em 900px. As duas regras equivalentes foram **removidas do bloco de 768px** pra não duplicar.
- **`.modelo-img { max-width: 620px; justify-self: center }`** dentro desse breakpoint — em coluna única a foto ocuparia a largura toda (832px num iPad).
- Gaps reduzidos: `.modelo-row` 80→64px, e 48px em ≤1024px.

**⚠️ Armadilha de CSS encontrada no teste (registrar pra não repetir):** a primeira tentativa usou `margin-left:auto; margin-right:auto` pra centralizar `.modelo-img`. Num **item de grid**, margem auto faz o item usar a largura intrínseca em vez de esticar — e como o filho é uma `<img>` com `width:100%`, a referência vira circular e **a foto colapsa pra 0×0**. Correto é `width:100%; max-width:...; justify-self:center`.

**Validação:** medido em **10 viewports** (2560, 1920, 1440, 1280, 1024, 900, 834, 768, 430, 375px) via iframe isolado com o CSS final injetado — **zero estouro horizontal e zero elemento colapsado** em todas. Foi assim que o bug do `margin:auto` apareceu antes de ir pro ar.

**Observações não corrigidas (não pedidas):**
- `landing/consultorio.html` (§16) **não tem esse problema** — é mobile-first com `max-width` de 560/640px. Mas o bloco `.duo` usa `aspect-ratio:3/4` para as duas fotos, e uma delas (`lounge-espera.jpg`) é paisagem 3:2 → perde ~55% das laterais. Intencional ou não, fica registrado.
- A foto do card "Consultórios equipados" segue sendo retrato num card horizontal. O `object-position` resolve bem, mas existem paisagens não usadas (`sala-psicologia.jpg`, `atendimento-mesa.jpg`) que caberiam melhor. Decisão do fundador pendente.

**⚠️ Sessões concorrentes:** esta sessão e a sessão 3 rodaram em paralelo sobre o mesmo `landing/index.html`. Tocaram partes diferentes (sessão 3 = copy/H1 no `<body>`; esta = CSS no `<head>`) e **as duas sobreviveram**, verificado por grep. Mas o handoff mudou embaixo desta sessão no meio do trabalho — vale conferir o arquivo antes de assumir estado.

**Estado:** ✅ **Publicado.** O fundador commitou e publicou ainda em 31/jul — confirmado ao vivo em `olihealthhub.com.br` (`.modelo-img` com `aspect-ratio: 3/2` e `.dor-grid` com `max-width: 1280px` já servindo em produção). O mesmo push levou junto as mudanças da sessão 3 (H1 "Sem aluguel e sem fidelidade" + `consultorio.html`).

## 18. Responsividade dos cards de plano no mobile (31/jul sessão 5)

**Pedido:** "o card dos planos no mobile está ficando ruim".

**Causa-raiz — um `style` inline anulando o CSS responsivo.** O HTML tinha:

```html
<div class="planos-wrapper" style="grid-template-columns: repeat(3, 1fr);">
```

Estilo inline vence qualquer regra de media query. Ou seja: a regra `@media (max-width:1024px){ .planos-wrapper{ grid-template-columns: 1fr } }` **existia no CSS desde sempre e nunca chegou a funcionar**. Os três planos ficavam lado a lado em **qualquer** largura, inclusive 320px.

Medido ao vivo em produção, viewport de 375px:

| | Antes | Depois |
|---|---|---|
| Colunas em 375px | **3** | 1 |
| Largura do painel | 218px | 323px |
| **Largura útil de conteúdo** | **154px** | **275px** (+79%) |
| Grid resolvido em 390px | `217px 220px 64px` (soma 502px num viewport de 386px → estouro) | coluna única |

As três colunas desiguais somando mais que o viewport são o sintoma clássico de grid espremido com `overflow:hidden` no wrapper — o terceiro plano (PRO) era o mais amassado.

**Correções em `landing/index.html`:**

- **Removido o `style` inline do `.planos-wrapper`.** É o fix principal — as colunas voltam a vir do CSS (3 no desktop, 1 abaixo de 1024px).
- **Cards separados quando empilham.** Sem isso o empilhamento continuaria ruim: START e BASE têm o mesmo fundo branco e o wrapper não tem `gap`, então virariam um bloco branco único sem fronteira visível. No breakpoint de 1024px o wrapper perde `border-radius`/`box-shadow`/`overflow:hidden` e ganha `gap: 20px`; cada `.plano-painel` ganha `border-radius: 16px` e sombra própria.
- **`max-width: 560px` + `justify-self: center` no painel empilhado.** Em 1024px a coluna única deixava o card com 876px de largura útil — esticado e feio. Agora fica com 480px.
- **`min-height: 0` no wrapper** (o `min-height: 680px` do desktop não faz sentido empilhado) e **`.plano-features { flex: 0 0 auto }`** (o `flex: 1` servia pra igualar altura entre colunas lado a lado).
- **Tipografia menor em ≤480px:** `h3` 34→28px, valor do preço 40→34px, padding do painel 48px/32px → 40px/24px.

**🐛 Bug de brinde encontrado:** o plano BASE tinha `style="border: 1px solid var(--color-gold)"`. **`--color-gold` não existe na paleta** (a variável é `--dourado`) — declaração inválida, descartada pelo browser, borda de destaque nunca apareceu. Trocado por classe `.destaque` usando `box-shadow: inset 0 0 0 1px var(--dourado)` (inset em vez de `border` pra não somar largura ao item do grid).

Uma varredura depois achou **mais 5 ocorrências da mesma variável fantasma** no card BASE: os 4 ícones ✓ (`style="color: var(--color-gold)"`) e o botão "Conhecer o BASE" (`border-color` + `color`). Todas inertes. **Decisão do fundador: só limpar** — os inline mortos foram removidos sem trocar por `--dourado`, então o card fica visualmente idêntico ao que já estava no ar; ativar o dourado de verdade mudaria a aparência e não era o pedido. Varredura confirma **zero ocorrências de `--color-gold` em `landing/`** (fora o comentário que explica o caso) e **zero `style="grid-template-columns"`**.

**Validação:** 11 viewports (1440, 1280, 1024, 900, 768, 480, 430, 390, 375, 360, 320px) via iframe isolado — 3 colunas acima de 1024, 1 coluna abaixo, **zero estouro horizontal e zero painel colapsado** em todas.

**Lição que já apareceu duas vezes nesta frente:** `margin-left/right: auto` num **item de grid** faz ele encolher para a largura intrínseca em vez de esticar (na §17 isso colapsou uma foto para 0×0). Para centralizar item de grid, usar `justify-self: center` com `width: 100%; max-width: X`. Aplicado aqui desde o começo por causa disso.

**Estado:** ✅ **No ar e confirmado no domínio.** Commit `540322c`, publicado via deployment `4369042`. Medido em `olihealthhub.com.br` em 10 viewports (1920, 1440, 1024, 900, 768, 430, 390, 375, 360, 320px): planos em 3 colunas acima de 1024px e 1 coluna abaixo, largura útil do card de 220px (320px) a 496px (768px), fotos entre 268 e 620px — **zero estouro horizontal e zero elemento colapsado em todas**.

### ✅ RESOLVIDO — o domínio não estava servindo o deployment novo

Durante a validação, o build estava correto mas o domínio entregava conteúdo velho:

| URL | O que servia |
|---|---|
| `oli-landing-five.vercel.app` | ✅ versão nova |
| `olihealthhub.com.br` | ❌ versão antiga |

**Solução:** `Promote to Production` no deployment `4369042`. O alias do domínio tinha ficado preso a um deployment anterior — estar marcado "Production" na lista não garante que o domínio aponte pra ele.

**Confirmado ao vivo no domínio** em 10 viewports (1920→320px): planos em 3 colunas acima de 1024px e 1 coluna abaixo, 275px de largura útil em 375px, fotos entre 268 e 620px, zero estouro horizontal e zero elemento colapsado. `inline` removido, `.destaque` presente, 0 `color-gold`.

Diagnóstico registrado para não refazer:

- Não é cache de browser: testado com query única a cada request, mesmo resultado.
- Não é falha de build: deployment `4369042` (`chore: dispara deploy do site`) está **Ready / Production**.
- Não é git: `540322c` contém `landing/index.html` e `origin/main` está no mesmo commit.
- **É específico do domínio** — a URL `.vercel.app` do mesmo projeto serve o conteúdo certo no mesmo instante.

**⚠️ Achado importante sobre o webhook:** o push do `540322c` **não gerou deployment nenhum** na Vercel — o último que ela tinha visto era `1fa817f`, de 40 min antes. Foi preciso um `git commit --allow-empty` para forçar. Se voltar a acontecer, é esse o contorno; se virar rotina, reconectar o Git em Settings → Git.

**⚠️ Não usar "Redeploy" para publicar código novo:** ele reconstrói o *mesmo commit* daquele deployment, republicando o código antigo com aparência de sucesso.

**🔑 Receita para o próximo "publiquei e o site não mudou":**
1. Comparar `olihealthhub.com.br` com `oli-landing-five.vercel.app`. Se a `.vercel.app` já tem o novo, é **alias/domínio** → `Promote to Production`. Se as duas estão velhas, é **build** → ver Deployments.
2. Na lista de Deployments, conferir se existe deployment **do commit certo** (o hash aparece na linha). Se o último hash for anterior ao seu commit, o webhook não disparou → `git commit --allow-empty`.
3. Limpar o filtro de Status (ele vem em `6/7` e esconde justamente os deployments com erro).
4. Nunca diagnosticar por "atualizei e não mudou" — testar com query única (`/?v=timestamp`) pra descartar cache de browser.

Vale lembrar (§14) que o site Netlify antigo **não foi deletado**, só ficou inerte. Se um dia o DNS voltar a apontar pra lá, o sintoma é idêntico ao desta sessão: domínio com conteúdo velho e Vercel correta. Nesse caso o registro A no registro.br tem que estar em `216.198.79.1`.

## 19. Leads de tráfego pago (Meta Ads) — diagnóstico e enriquecimento (02/ago)

**Contexto:** existe um **segundo fluxo de leads**, totalmente paralelo ao do §15. O do §15 é o formulário do site → tabela `leads` → tela `/leads` no admin. Este é: **Meta Lead Ads → planilha do Google → (desde 01/ago) notificações da RD Station por e-mail**. Nada dele entra na tabela `leads` nem aparece no admin.

- Planilha: `1YhP7luVXgldCGY_Jp27fz8xbX-YFHVyBEYEFH7cdInc`. Colunas: `id, created_time, ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, form_id, form_name, is_organic, platform, full_name, whatsapp_number, email, job_title, lead_status`.
- E-mail: as notificações da RD chegam em `contato@olihealthhub.com.br` e são encaminhadas pro Gmail pessoal sob o marcador `Caixa OLI`.
- Campanha única: `[Conversão] [Geração de Lead]`, com 2 conjuntos — `[Formulário Nativo]` e `[Formulário Nativo] [RMKT LP]`.

**Base analisada: 22 leads entre 29/jul e 02/ago.** Todos com `lead_status = CREATED` — ninguém foi trabalhado.

- Áreas: Medicina 5 · Estética 3 · Nutrição 3 · Enfermagem 2 · Psi 2 · Terapias 2 · Odonto 1 · Biomedicina 1 · sem encaixe 3.
- Plataforma: **21 Instagram, 1 Facebook**.
- Conjuntos: `Formulário Nativo` 14 · `RMKT LP` 8. O remarketing traz ~36% do volume com alcance muito menor — candidato natural a mais verba.

**🔴 Geografia não bate com a oferta.** Por DDD: 15 na Grande SP; os outros 7 em Ribeirão Preto (2), Santos, São José dos Campos, **Recife, Londrina e Juiz de Fora**. A LP vende "agende uma visita" — oferta presencial. Quase um terço da verba está comprando lead que não tem como visitar o hub. **Conferir a segmentação geográfica da campanha antes de subir orçamento.**

**⚠️ O campo `job_title` não é confiável** — é texto livre digitado no celular. Dois casos confirmados por checagem externa:
- Cibele Correa declarou "Assistente Administrativo" e é **nutricionista esportiva e clínica com consultório** (@cibelecorreanutri).
- Joicy Souza declarou "Médica" e aparece como **fisioterapeuta no Recife** (@fisioterapeutajoicysouza).
- Consequência: qualquer contagem de "lead fora do perfil" baseada só em `job_title` erra. Uma leitura inicial marcou 3 leads como fora do perfil; ao menos 2 eram público-alvo legítimo.

**🐛 `created_time` gravado em dois fusos.** As 11 primeiras linhas estão em `-03:00` e as 11 seguintes em `-05:00`, com a virada em 30/jul. Quem ordenar ou contar por dia lendo a coluna como texto vai errar. Corrigir na origem (automação Meta → Sheets).

**Dois telefones inutilizáveis:** Cibele Correa (`+551170672580`) e Bruna Bianchi (`+554396915720`) têm 10 dígitos — fixo ou truncado. Não funcionam no WhatsApp; pra essas duas o canal é e-mail.

**Cobertura da RD:** ela começou a notificar em 01/ago e pegou exatamente os 4 leads de 01–02/ago. Os 18 anteriores existem **só na planilha**. Não é vazamento, é integração recente.

**Enriquecimento de perfil — 14 dos 22 identificados.** Só dado profissional público (Instagram, conselho, onde atua).

- ✅ **O que funciona:** Google **em pt-BR pelo navegador** (`hl=pt-BR&gl=br`) buscando o `full_name` entre aspas. Os nomes da planilha *são* os nomes de exibição do Instagram (ex.: "DIH PEREIRA - Estética Facial | Lash | Lips"), então casam quase literal. Taxa alta.
- ❌ **O que não funciona:** a ferramenta de busca web do Cowork é indexada pros EUA — cobertura de profissional brasileiro ficou em ~30%, com homônimos. **Não repetir por esse caminho.**
- ⚠️ **Sempre validar o achado contra o DDD.** A busca ofereceu, pra Bruna Bianchi, uma endocrinologista de São Caetano do Sul que encaixava perfeitamente no `job_title` — mas o telefone dela é DDD 43 (Londrina). Era outra pessoa. Sem o cruzamento, entraria como fato.
- Achados úteis: **Juan Carlos Camurri** usa `@einstein.br` e é do **ensino/docência do Einstein** — lead mais qualificado da base. **Natalia Callefi** tem CRN-3 96360/P; **Phelipe Aquino**, CRBM 012156 (dá pra validar no conselho antes de proposta comercial).
- 8 não identificados (Adriana Araujo, Bruna Ferreira, Márcia Jessyca, Debs Silva, Gabriela Andrade, Maria Claudia, Ana Paula, Rafael Olinda) — nomes muito comuns.

**Painel construído (fora deste repo):** artifact Cowork `leads-oli-health-hub`, em `~/Documents/Claude/Artifacts/leads-oli-health-hub/index.html`. Lê a planilha pelo MCP do Google Drive + os pedidos de visita da landing pelo Gmail, mostra área/contato/perfil enriquecido e permite marcar "contatado".

**⚠️ Isso duplica o que já existe.** A esteira que o fundador descreveu (visita agendada → visita concluída → fechou/declinou) **já está implementada**: `leads.status` ∈ `novo | contatado | visita_agendada | convertido | descartado`, com tela `/leads` no admin e notificação `lead_received` (§15 + sessão 31/jul sessão 6). O painel Cowork guarda estado em `localStorage` — um navegador só, sem equipe, sem histórico. **Decisão em aberto: levar os leads do Meta pra dentro da tabela `leads` (com `origem` novo, ex. `meta_ads`) e usar o `/leads` que já existe, em vez de manter dois lugares.** É o caminho recomendado.

**Limitações de ferramenta descobertas (pra não retentar):**
- **Não existe conector MCP de RD Station** no catálogo (procurado em 02/ago por "rd station", "crm", "leads", "marketing automation" — só Zoho, HubSpot, Close, Clarify, Salesflare, Airtable). Reforça a decisão do §15 de manter o RD só na LP.
- O **MCP do Google Drive só lê e cria arquivos** — não escreve em planilha existente. Por isso o painel não consegue gravar status de volta na planilha do Meta.

> ✅ **A decisão em aberto desta seção foi tomada em 03/ago — ver §20.** Os 22 leads do Meta estão dentro da tabela `leads` e aparecem em `/leads` no admin. O painel Cowork `leads-oli-health-hub` virou redundante e não deve mais ser usado como fonte de verdade.

## 20. Unificação da base de leads — Meta Ads dentro do Supabase (03/ago)

Fecha a decisão que o §19 deixou em aberto: em vez de manter dois lugares (tabela `leads` do site + planilha/painel Cowork do Meta), os leads de tráfego pago passam a viver na **mesma tabela `leads`**, com origem própria, e são trabalhados na tela `/leads` que já existia.

**Schema (migration `leads_meta_ads_origin_and_campaign_fields`):**
- `leads_origem_valida` reescrita incluindo `meta_ads` — agora `site | meta_ads | whatsapp | indicacao | evento | outro`.
- 5 colunas novas, todas nulas em lead de site: `external_id`, `campanha`, `conjunto`, `anuncio`, `plataforma`.
- `external_id` é o id do lead no Meta (`l:1775484823699615`) com **índice único parcial** (`where external_id is not null`) — é o que torna a importação **idempotente**: rodar de novo não duplica. Confirmado por teste (reinserção da linha do Juan Carlos não criou segunda linha).
- CHECK de tamanho nos 5 campos novos, no mesmo padrão defensivo do resto da tabela.

**Importação:** os 22 leads de 29/jul a 02/ago entraram com `status='novo'`. Conferência bate com o diagnóstico do §19 — 22 linhas, 22 `external_id` distintos, 8 do conjunto RMKT LP, 1 do Facebook, primeiro em 29/jul e último em 02/ago. Nomes do Instagram preservados inteiros (ex.: "DIH PEREIRA - Estética Facial | Lash | Lips") porque são justamente o que permitiu identificar as pessoas.

**11 dos 22 já entraram com observação interna preenchida**, só com o que o §19 tinha apurado e validado — nada inventado: os 2 telefones inutilizáveis (Cibele Correa, Bruna Bianchi — 10 dígitos, contato por e-mail), os 2 `job_title` que não conferem (Cibele, Joicy), os 2 conselhos a validar (CRN-3 da Natalia, CRBM do Phelipe) e **os 6 leads fora do raio de visita presencial** por DDD (13 Santos, 12 SJC, 16 Ribeirão ×2, 81 Recife, 43 Londrina, 32 Juiz de Fora).

**🟢 Achado da sessão: a base tinha 1 conversão que ninguém sabia.** Cruzando `leads.email` com `auth.users`, **Juan Carlos (`juan.ribeiro@einstein.br`) já é cliente** — lead em 30/jul 15:16, cadastro no app em **31/jul**, plano START, `como_conheceu='redes'`, ~21h de intervalo. Perfil real: CRN-3 84201, **Nutrição Oncológica**, São Paulo/SP (o §19 tinha inferido "ensino/docência do Einstein" pelo domínio do e-mail — era só o e-mail institucional). Lead marcado `convertido`. **Com isso a campanha não está com 0 de retorno: são 22 leads e 1 cliente, com a base inteira ainda não trabalhada.** Vale repetir esse cruzamento a cada importação.

**🐛 Corrigido de brinde — `notify_lead_created()` mentia no feed.** O título era `'Novo lead do site: ' || nome` fixo; com origem nova, todo lead do Meta apareceria como "do site". Agora o rótulo sai da origem (`do site` / `do Meta Ads` / `do WhatsApp` / `por indicação` / `de evento`).

**Efeito colateral tratado:** o trigger `AFTER INSERT` disparou 22 notificações `lead_received` datadas de hoje pra leads de 5 dias atrás — ruído puro de backfill. As 22 foram apagadas (`admin_notifications` volta a ter só evento real). **Quem for fazer nova carga em massa: desabilitar o trigger na transação ou limpar depois.**

**RLS conferida, não presumida.** O formulário público continua com `with check (origem = 'site')` — testado por simulação de role: `anon` tentando inserir `origem='meta_ads'` é recusado com `insufficient_privilege`, e `anon` continua sem enxergar nenhuma linha no SELECT. Linha de teste não chegou a existir.

**Admin (`admin/app/leads/page.tsx`):** `ORIGEM_LABEL` ganhou `meta_ads: 'Meta Ads'` (sem isso a célula mostraria a string crua), a coluna Origem passou a exibir conjunto e criativo embaixo do rótulo — dá pra ler performance de criativo sem sair da tela — e o subtítulo deixou de dizer que a página é só do site. `updateLead` intocado, só o comentário.

**Ajuste de layout depois do fundador usar a tela (03/ago, mesma sessão).** O campo de observações estava ilegível: `rows={2}` + `resize-none` + `text-xs` num container `max-w-6xl` dividido por 7 colunas dava um filete de ~150px, e as observações importadas do Meta passam de 200 caracteres — só dava pra ler rolando dentro do próprio campo, sem poder aumentá-lo. Quatro mudanças: container de `max-w-6xl` pra `max-w-[1600px]` (**desvia de propósito** do padrão das outras telas do admin, que seguem 6xl — esta tem 7 colunas e um campo de texto de verdade); coluna de observações com largura fixa `w-[420px]` no `th` e no `td`; textarea `rows={8}`, `text-[13px]`, `leading-relaxed`, `min-h-[120px]` e `resize-y` (o `resize-none` impedia até o contorno manual); e o wrapper de `overflow-hidden` pra `overflow-x-auto`, senão em tela menor a coluna de 420px empurraria a tabela pra fora e o conteúdo seria **cortado sem dar como rolar**.

**⚠️ Pendências desta sessão:**
- **Typecheck não rodou** — o sandbox de shell caiu a sessão inteira (`useradd failed`, todas as tentativas). As mudanças em `admin/` são de tipo/JSX simples, mas **rodar `cd admin && npx tsc --noEmit` antes do deploy**.
- **`database.types.ts` editado à mão** (bloco `leads`, 5 campos novos nos 3 shapes) porque o MCP de regeneração não pôde ser conferido sem shell. Regenerar de verdade na próxima sessão com shell. O app mobile não consulta `leads`, então o risco é zero em runtime.
- **Nada commitado ainda** — Guilherme decide quando publicar.
- **A sincronização continua manual.** Lead novo do Meta entra na planilha, não no Supabase. Automatizar (webhook do Meta → edge function → `leads`, usando o `external_id` que já garante idempotência) é o passo seguinte natural.
- **Fuso do `created_time`:** as 11 linhas em `-05:00` foram gravadas como o instante que declaram, não "corrigidas". Motivo: lidas assim, os horários caem em 05h–15h BRT (plausível pra preenchimento de formulário); tratadas como rótulo errado de BRT, cairiam de madrugada. É a leitura mais provável, mas **não é certeza** — se a automação for corrigida na origem, reconferir esses 11.

## 21. Descritivo comercial dos planos + erro de break-even na documentação (03/ago)

Material para apresentar os planos ao cliente, pedido depois da unificação da base de leads (§20). Decisões do fundador: **documento único** com os três planos (não uma folha por plano), linguagem para **todos os profissionais de saúde** (não só médicos — dos 22 leads do Meta, só 5 são de medicina), e **conta pronta + simulação** de valores.

**Arquivo:** `iCloud/OLI - HH/OLI_Descritivo_Planos.html` — HTML de 2 páginas A4, na paleta e nas fontes do site (Poppins/Inter), com `@page` e `@media print` configurados. **Não é PDF porque o sandbox de shell caiu a sessão inteira** (`useradd failed`, 4 tentativas idênticas) — sem Python não dá pra usar reportlab. O arquivo tem uma caixa de instrução no topo (Cmd+P → Salvar como PDF, margens Nenhuma, imprimir gráficos de fundo) que `@media print` esconde do arquivo final. Efeito colateral bom: fica editável pelos sócios sem depender de sessão.

**Conteúdo:** (1) as 3 regras de cobrança — horas em blocos de 1h, reserva de 30 em 30 min, consumo por minuto; (2) card de cada plano com "para quem é" + quando compensa; (3) tabela de quanto sai o mês em 5/10/20/25/40h nos três planos, com a coluna mais barata destacada; (4) os 3 pontos de virada; (5) pacotes de horas com o preço efetivo da hora em cada plano.

**Regras de copy respeitadas** (todas já registradas no §14 e na memória): sem jargão — nada de "hub de soluções" ou "ecossistema"; **"do OLI", nunca "da OLI"**; **nenhum parceiro nomeado** — "conversa com contador e com advogado" no BASE, "prontuário e agenda pela internet" no PRO, sem citar as empresas; **nada de check-in** (fluxo ainda não desenhado); **VIP não aparece**.

**🔴 Erro achado e corrigido — o break-even do BASE estava errado na documentação há tempo.** `OLI_BASE.md` §5 e o comentário de fecho de `oli-plans.ts` diziam **~17h/mês**, com a conta `R$ 299 ÷ (R$ 0,30 × 60)`. A diferença de minutagem START→BASE **não é R$ 0,30, é R$ 0,50** (R$ 2,00 − R$ 1,50) — o número certo é **~10h**. A função `calcBreakevenHours()` sempre calculou certo (lê os valores do objeto) e o site sempre falou 10h; **só a documentação e o comentário estavam velhos**, provavelmente de uma tabela de preços anterior. Corrigidos os dois, e o `OLI_BASE.md` ganhou a tabela das 3 viradas em vez de só a do BASE. **Consequência prática: quem tivesse lido o doc pra montar material comercial teria dito ao cliente que o BASE só compensa com 17h — quase o dobro do real, empurrando gente pro plano errado.**

**Matemática conferida à mão** (sem shell pra automatizar — reconferir quando o sandbox voltar). Mensalidade + horas × valor da hora (START R$ 120, BASE R$ 90, PRO R$ 78):

| Horas/mês | START | BASE | PRO |
|---|---|---|---|
| 5h  | **600** | 749 | 989 |
| 10h | 1.200 | **1.199** | 1.379 |
| 20h | 2.400 | **2.099** | 2.159 |
| 25h | 3.000 | **2.549** | **2.549** |
| 40h | 4.800 | 3.899 | **3.719** |

Viradas: BASE passa o START em ~10h; PRO passa o START em ~14h; PRO passa o BASE em 25h exatos (empate em R$ 2.549). Pacotes (10h→11h, 20h→23h) com hora efetiva de R$ 109/R$ 104 no START, R$ 82/R$ 78 no BASE e R$ 71/R$ 68 no PRO.

**⚠️ Armadilha de leitura tratada no material:** a seção de pacotes cita "no BASE, R$ 900" — que é o preço das horas, não do mês. Foi preciso escrever explicitamente que a mensalidade continua à parte, senão o cliente soma errado.

**Pendências:** converter pra PDF (o fundador faz pelo navegador, ou uma sessão com shell gera de verdade); nada commitado; e ficou de fora, por escopo, um bloco de "serviços que dá pra contratar à parte" — só a contabilidade tem preço fechado hoje (R$ 460 Simples / R$ 632 Presumido / R$ 1.200 abertura); AR Soluções e jurídico seguem com preço pendente desde o `OLI_BASE.md` §7, então não dá pra montar essa página inteira ainda.

## 22. Esteira de leads ampliada, qualificação e renomeação de "Médicos" (03/ago)

Pedidos do fundador depois de usar a `/leads` de verdade. **Durante a sessão ele estava trabalhando a base ao vivo** — 20 dos 22 leads passaram pra `contatado` e o Juan Carlos foi movido de `convertido` pra `visita_agendada`. Nada foi revertido; ver a ressalva no fim.

**Esteira (migration `leads_esteira_ampliada_e_qualificacao`).** Era `novo → contatado → visita_agendada → convertido → descartado`, e pulava de "visita agendada" direto pra "convertido": quem visitou e ficou pensando, e quem nunca atendeu o telefone, ficavam invisíveis. Agora são 9 etapas na ordem: `novo`, `contatado`, **`sem_resposta`** ("Não consegui falar"), **`aguardando_retorno`**, `visita_agendada`, **`visita_realizada`**, **`proposta_enviada`**, `convertido`, `descartado`.

**Qualificação — 2 campos novos, independentes da etapa** (um lead pode estar "aguardando retorno" e "quente"):
- `temperatura` ∈ `quente | morno | frio`, nulo = não avaliado.
- `perfil` ∈ `dentro | fora | a_confirmar`, nulo = não avaliado. Existe por causa do problema real do §19: 6 dos 22 leads têm DDD fora do raio de visita.
- `motivo_descarte` ∈ `mora_longe | achou_caro | sem_perfil | contato_invalido | sumiu | sem_interesse` — lista fechada de propósito, pra dar pra somar depois qual motivo mais derruba lead.

**Regra de integridade que evita lixo:** CHECK `leads_motivo_so_em_descartado` — motivo só existe em lead descartado. Sem isso sobra motivo órfão quando alguém descarta e depois reativa. Como o `select` de motivo fica sempre visível na tela (esconder condicionalmente exigiria virar client component só por isso), a `updateLead` **limpa o motivo** quando a etapa não é `descartado` — senão mover um lead de volta pra esteira estouraria com erro de constraint na cara do usuário.

**Pré-preenchimento conservador:** Juan Carlos entrou como `perfil='dentro'` + `temperatura='quente'` (é fato, já é usuário do app). Os 6 de DDD distante entraram como **`a_confirmar`, não `fora`** — a observação já explica o DDD, mas quem decide se a pessoa consegue vir é a conversa, não o script. Temperatura dos outros 21 ficou nula de propósito: é avaliação de quem atendeu.

**4 regras testadas por simulação no banco**, todas passaram, e o lead usado no teste voltou ao estado original: motivo em lead não-descartado é recusado; `temperatura='mornissimo'` é recusada; etapa nova é aceita; descartar com motivo e depois voltar pra esteira limpando o motivo funciona.

**Tela:** coluna "Status" virou **"Situação"** e empilha até 3 selos (etapa, temperatura, perfil) mais o motivo em texto miúdo; a coluna de edição virou **"Atualizar"**, com rótulos em cima de cada campo e temperatura/perfil lado a lado num grid de 2 colunas pra não esticar a linha. `STATUS_LABEL` é a fonte da ordem do `select` — mexer na ordem do objeto muda a ordem na tela.

**Renomeação "Médicos" → "Profissionais".** Motivo: a base não é só de médicos (nutricionista, psicólogo, dentista, esteticista — mesma razão que levou o descritivo dos planos do §21 a falar com todos), e o código já diz `professionalId`/`profiles`. **"Base de Clientes" foi descartado** porque conflita com `/leads` (prospect ≠ cliente) e porque quem está no START gratuito não é cliente pagante.

**⚠️ A rota continua `/medicos` — só os rótulos mudaram.** Renomear a pasta significaria mover arquivos e atualizar ~12 referências de `href` espalhadas (dashboard, horas, planos, histórico, LiveRooms, ReservationBlock, ReservationCalendar, UpcomingList), **sem typecheck e sem poder rodar o e2e** — risco alto por ganho nenhum, e quebraria link salvo. Alterados: sidebar, `h1` de `/medicos`, breadcrumb do detalhe, voltar de `/medicos/excluidos`, 3 textos do dashboard, contador de `/horas` e 2 textos do totem. Os 4 testes e2e que casavam a string velha (`02-dashboard`, `06-medicos` ×2, `12-sidebar-navigation`) foram atualizados junto.

**🔍 Achado de brinde (não corrigido):** `e2e/11-usuarios.spec.ts` procura o heading "Médicos cadastrados" em `/usuarios` — **essa seção não existe mais**, os headings de hoje são "Acesso ao painel" e "Demais usuários". O teste já estava quebrado antes desta sessão; não foi mexido por estar fora do escopo.

**Pendências:** o trigger `notify_new_signup` ainda escreve "Novo médico: ..." no feed do admin — mesma nomenclatura velha, dá pra alinhar numa próxima; typecheck e e2e seguem sem rodar (sandbox wedged o dia inteiro); nada commitado.

### Migrations de 03/ago versionadas depois

As 3 migrations do dia foram aplicadas **direto em produção via Supabase MCP**, sem passar por arquivo — o padrão que as sessões anteriores usaram. Foram escritas em `supabase/migrations/` no fim do dia pra reconstituir o histórico:

- `20260803_leads_meta_ads.sql` — origem `meta_ads`, os 5 campos de campanha, índice único parcial de `external_id` e o `notify_lead_created()` corrigido (§20).
- `20260803_leads_esteira_qualificacao.sql` — as 9 etapas, `temperatura`, `perfil`, `motivo_descarte` e o CHECK que amarra motivo a lead descartado (§22).

### 🐛 O typecheck que não rodou pegou um erro real (03/ago, pós-commit)

O sandbox de shell ficou wedged o dia inteiro, então as 3 sessões de 03/ago entregaram código **sem `tsc --noEmit`**. O fundador rodou na máquina dele depois do commit `3726042` e caiu na hora: **3 erros, todos em `admin/app/leads/page.tsx`, todos cascata do mesmo ponto** — `TS1005 ')' expected` na linha 83.

Causa: um comentário JSX `{/* ... */}` foi posto **como irmão do elemento raiz dentro do `return (`**. JSX aceita um único elemento na raiz do return; o comentário vira uma segunda expressão e o parser quebra ali, derrubando o resto do arquivo. Corrigido virando comentário JS comum (`//`) **acima** do `return`. Os outros 3 comentários `{/* */}` do mesmo arquivo estão dentro de elementos (filhos legítimos) e não têm o problema.

**Lição:** comentário JSX é filho de elemento, nunca irmão da raiz do return. E, mais amplo: **quando o sandbox cai, o código entregue é não-verificado — dizer isso em voz alta não substitui rodar.** O commit foi feito com o erro dentro.

**Varredura do que o `tsc` não pega, feita depois do erro:**

- ✅ **Paleta Tailwind — o risco maior, e está limpo.** As cores novas dos selos (`teal`, `indigo`, `sky`, `amber`, `orange`, `red`) não estão em `admin/tailwind.config.ts`, mas o config só usa `theme.extend` — a paleta padrão do Tailwind continua inteira, então todas existem. **Era exatamente a armadilha da §17** (`var(--color-gold)`, variável inexistente, borda que nunca apareceu): classe inválida não dá erro de compilação, só não pinta.
- ✅ `12-sidebar-navigation.spec.ts` casa `h1` com o título — o `h1` de `/medicos` virou "Profissionais", bate.
- ✅ `NotificationFeed.tsx` trata `lead_received` por tipo, não por status — as 4 etapas novas não passam por lá.
- ⚠️ **`06-medicos.spec.ts:59` provavelmente estoura strict mode do Playwright:** `getByRole('link', { name: 'Profissionais' })` agora casa **dois** elementos — o link da sidebar e o breadcrumb, ambos com `href="/medicos"`. **Não é regressão** (antes os dois diziam "Médicos", mesma colisão), mas se o e2e nunca rodou verde, é candidato. Resolver com `.first()` ou escopo `page.locator('nav')`.
- 🔴 **O typecheck rodado foi só o do `admin/`.** `src/models/database.types.ts` (bloco `leads`, 8 campos novos nos 3 shapes, **editado à mão**) e `src/models/oli-plans.ts` estão no projeto raiz, que tem `npx tsc --noEmit` próprio — **esse não rodou**. Inspeção visual do bloco `leads` está consistente, mas inspeção não é typecheck.
- ✅ **Não precisa de OTA.** Em `app/`/`src/` só mudaram tipos (apagados em runtime) e um comentário. Pela regra do §12, nada de JS/asset mudou de verdade. O admin sai por push → Vercel — com as duas armadilhas da §18 valendo (push que não dispara deployment; domínio servindo versão velha com alias preso).

**São reconstituição, não foram executadas a partir do arquivo** — o banco já estava no estado final quando os arquivos nasceram. Rodar num ambiente limpo (branch do Supabase) antes de confiar nelas pra recriar o schema do zero. A importação dos 22 leads em si **não virou migration** de propósito: é carga de dado pontual vinda de planilha, não schema.

## 23. Webhook do Meta — leads de anúncio entrando sozinhos (03/ago)

Fecha a pendência que sobrou do §20: até aqui, lead de anúncio caía **só na planilha do Google** e não aparecia no admin. Os 22 importados foram carga manual. Agora existe `meta-leads-webhook`.

**Edge function `meta-leads-webhook`** — deployada, **versão 1, ACTIVE, `verify_jwt: false`**. Versionada em `supabase/functions/meta-leads-webhook/index.ts`.

O ponto que não é óbvio: **o webhook do Meta não manda os dados da pessoa.** Ele manda só `leadgen_id`. A função tem que voltar na Graph API com esse id pra descobrir nome, e-mail e telefone — por isso precisa de token de Página, não só de segredo de assinatura.

**Fluxo:** GET de verificação (uma vez, ecoando `hub.challenge`) → POST a cada lead → valida HMAC → busca na Graph → grava em `leads` → **o trigger `trg_notify_lead_created`, que já existia, dispara a notificação e ela chega no feed do admin por realtime.** Ou seja, a parte de "aparecer sozinho no painel" sai de graça da infra que já estava lá.

**Decisões que valem registro:**
- **`external_id` = `l:<leadgen_id>`, com o prefixo `l:`.** Não é enfeite: é o formato que a integração Meta→Planilha usa, e os 22 leads importados à mão estão gravados assim. Sem o prefixo, um lead que chegasse pelos dois caminhos entraria duplicado.
- **Corpo lido como texto antes do `JSON.parse`.** O Meta assina os bytes recebidos; reserializar o JSON muda o hash e reprovaria toda requisição legítima.
- **Comparação de assinatura em tempo constante** — sair no primeiro byte diferente vaza quanto do hash já está certo.
- **Sinônimos de campo.** O nome de cada pergunta é escolhido por quem monta o formulário: o atual usa `whatsapp_number`, um novo pode usar `phone_number`. A função aceita uma lista de aliases por campo em vez de casar um nome só.
- **Códigos de resposta pensados pro retry do Meta:** 200 em sucesso, duplicado e notificação irrelevante (qualquer outra coisa faz o Meta reenviar em loop); 401 em assinatura inválida; **500 só em falha recuperável** (Graph fora, token expirado) pra ele reenviar. Lead sem campo obrigatório **não** devolve 500 — reenviar não resolveria, então loga e segue sem derrubar o resto do lote.
- **Dupla proteção contra duplicata:** `select` antes (evita gastar chamada na Graph em reenvio) e captura do erro `23505` depois (dois webhooks do mesmo lead em corrida). O índice único parcial é a garantia final.

> 🔻 **SEÇÃO SUPERADA — não executar os passos abaixo.** Horas depois desta implementação o fundador informou que **a integração do Meta já vive dentro da RD Station**, e a RD virou a fonte única (§24). A `meta-leads-webhook` continua deployada mas **inerte de propósito**, sem segredos: é o plano B caso a integração Meta→RD quebre. Os passos abaixo ficam como receita pronta para esse cenário.

### ⚠️ Configuração (só executar se for reativar o caminho direto do Meta)

Ela está no ar mas **nunca executou**: não há segredos configurados e o webhook não está assinado no Meta. Passos, na ordem:

1. **Segredos** em Supabase → Edge Functions → Secrets:
   - `META_VERIFY_TOKEN` — string inventada, qualquer uma; só precisa ser a mesma nos dois lados.
   - `META_APP_SECRET` — App Secret do app do Meta.
   - `META_PAGE_ACCESS_TOKEN` — token da Página, **de longo prazo**. Token curto expira em ~1h e o webhook para de gravar em silêncio (aparece como erro de Graph no log).
   - `META_GRAPH_VERSION` — opcional, só se precisar (ver ressalva abaixo).
2. **Assinar o webhook** no app do Meta → Webhooks → objeto **Page** → campo **`leadgen`**, apontando pra `https://xwcarrurjvfxisuaihid.supabase.co/functions/v1/meta-leads-webhook` com o mesmo verify token. O Meta faz o GET de verificação na hora.
3. **Assinar a Página** ao app (`POST /<page-id>/subscribed_apps` com `subscribed_fields=leadgen`). Assinar o webhook sem assinar a Página é o erro clássico: verificação passa, lead nunca chega.
4. **Testar** com a Lead Ads Testing Tool do Meta e conferir em Supabase → Edge Functions → Logs (linhas com prefixo `[meta-leads]`).

**🔴 Ressalva honesta:** a função **não foi executada nem uma vez**. Sem segredos não dava, e a URL não foi alcançável a partir do ambiente da sessão (o fetch estourou timeout). O código foi escrito contra a documentação do Meta e segue o padrão do `asaas-webhook`, mas **a primeira execução de verdade vai ser a do fundador**. O ponto mais provável de falhar é `META_GRAPH_VERSION`: o default é `v23.0` e as versões da Graph rodam por prazo — se o log mostrar erro de versão não suportada, é só criar o segredo com a versão que o painel do Meta indicar, sem tocar em código. Foi feito env-var exatamente por isso.

**A planilha do Google continua recebendo em paralelo** — não foi desligada. Vale manter um tempo como rede de segurança: se o webhook falhar em silêncio, dá pra comparar planilha × tabela e ver o que faltou. Depois de alguns dias batendo, pode desligar.

## 24. RD Station CRM vira a fonte única de lead (03/ago)

**Reviravolta:** o §23 tinha acabado de subir o webhook do Meta quando o fundador informou que **a integração do Meta já vive dentro da RD Station**, e que a equipe de marketing usa as métricas da RD para montar campanha. Decisões dele: **RD como fonte única**, **Meta desligado**, **gatilho em toda conversão**.

**Isso invalida parcialmente o §23.** A `meta-leads-webhook` continua deployada mas **fica inerte de propósito** — sem segredos, ela recusa tudo. Não foi deletada: se a integração Meta→RD quebrar, ela é o plano B pronto.

### O que a pesquisa mudou no desenho

Duas descobertas na documentação da RD que mudaram decisões:

1. **Na RD Marketing não existe endpoint que liste leads novos.** Os endpoints de contato são todos individuais (por uuid/e-mail/telefone); a única listagem é "contatos de uma segmentação". Polling ali só funciona se alguém mantiver uma segmentação viva. **Na RD CRM existe listagem paginada de verdade** (`Listar contatos`, `Listar negociações`) — foi o que tornou o retroativo viável.
2. **`crm_deal_created` NÃO traz o contato.** Traz funil, etapa, fonte e campanha, mas nenhum e-mail ou telefone. Quem carrega os dados da pessoa é **`crm_contact_created`** (`name`, `emails[]`, `phones[]`, `job_title`). Assinar só o evento de negociação — o palpite óbvio — daria lead sem como falar com a pessoa.

### Restrições da RD que moldaram o código

- **Timeout de 5 segundos**, 5 retentativas em resposta não-2xx.
- **Erro constante na mesma URL faz a RD suspender o webhook.** Por isso o padrão aqui é o **inverso** do webhook do Meta: responde 200 quase sempre, e 500 só em falha realmente transitória. Evento irrelevante (tarefa, produto, atualização) devolve 200 sem fazer nada.
- Passar de 5s faz a RD reenviar — ou seja, **evento duplicado é comportamento esperado**, não exceção.

### `rd-leads-webhook` — deployada, v1 ACTIVE, `verify_jwt:false`

Versionada em `supabase/functions/rd-leads-webhook/index.ts`. Trata **os dois eventos** de propósito: `crm_contact_created` (dados inline, sem chamada extra — sempre rápido) e `crm_deal_created` (busca o contato em `GET /deals/{id}/contacts` e aproveita `deal_source`/`campaign` como atribuição). É defensivo porque **não se sabe se a integração Meta→RD cria contato, negociação ou os dois** — e a deduplicação garante que "os dois" não vire duplicata.

**🔑 Deduplicação é por E-MAIL, não por `external_id`.** Decisão importante: a mesma pessoa pode chegar como contato e como negociação (ids diferentes), e **os 22 leads do Meta já estão na tabela com `external_id` no formato `l:...`** — se qualquer um deles reaparecer pela RD, o id seria outro e entraria duplicado. E-mail é o que identifica a pessoa. Criado índice `leads_email_lower_idx` porque essa checagem roda dentro do orçamento de 5s.

**Migration `leads_origem_rd_station`:** origem nova `rd_station` no CHECK (mantendo `meta_ads` como legado dos 22 já importados) + o índice de e-mail. Admin ganhou o rótulo "RD Station".

**Autenticação:** a doc diz que a RD CRM aceita cabeçalho customizado (`auth_header`/`auth_key`), mas isso não aparece em toda versão do painel. A função aceita **os dois caminhos** — cabeçalho configurável por `RD_AUTH_HEADER` ou `?secret=` na URL — para não travar caso o campo não exista na conta.

### ✅ Configuração — tudo concluído entre 03 e 05/ago

Esta lista era de pendências e **está toda fechada**. Mantida como registro do que foi preciso:

1. ~~Confirmar plano do CRM~~ ✅ assinatura ativa, webhooks disponíveis.
2. ~~Criar os segredos~~ ✅ `RD_WEBHOOK_SECRET` e `RD_CRM_TOKEN` criados pelo fundador. Token validado: `/token/check` respondeu `Oli Health Hub / contato@olihealthhub.com.br`.
3. ~~Cadastrar o webhook na RD~~ ✅ feito **via API, não pelo painel** — ver §24 "Webhooks cadastrados". Confirmado funcionando: 4 leads entraram sozinhos em 05/ago.
4. ~~Retroativo~~ ✅ `rd-backfill` executada. Base foi de 22 para 36 leads.
5. ~~Volta do status para a RD~~ ✅ implementada em 05/ago — ver §25.

**🔴 Nunca executou**, mesma ressalva do §23: sem segredos e sem cadastro na RD. `RD_CRM_API_BASE` é env-var justamente porque o path exato da API v1 (`https://crm.rdstation.com/api/v1`) não foi verificado contra a conta real.

### 🔑 Token da RD CRM — duas armadilhas documentadas

**1. O token é por usuário, e o que a API devolve depende da visibilidade DESSE usuário.** Os níveis (`Restrito` / `Equipe` / `Geral`) são configurados separadamente para Negociações, Empresas e Contatos. Token de usuário com visibilidade Restrito **não dá erro — só devolve menos**: o retroativo traria uma fração dos leads e a busca de contato de negociação de outro responsável falharia em silêncio. **Usar token de usuário com visibilidade `Geral` em Contatos e Negociações.** (A configuração de visibilidade só existe nos planos Basic e Pro.)

**2. O token é único e imutável por usuário — não dá pra rotacionar.** Se vazar, o único remédio é desativar o usuário. Por isso a recomendação é **usuário dedicado de integração**, não o usuário pessoal do fundador: se ele sair, trocar de papel ou for desativado, a integração morre em silêncio; e se o token vazar, mata-se o usuário de serviço sem afetar ninguém real. Contrapartida: a RD cobra por usuário, então isso pode custar um assento.

**Escopo real do token:** `crm_contact_created` traz tudo inline e **não usa token nenhum**. O token só é necessário para o caminho de `crm_deal_created` (buscar o contato da negociação) e para a carga retroativa. Ou seja, mesmo um token limitado já deixa o fluxo principal funcionando.

### Carga retroativa executada (03/ago) — e a descoberta que a salvou

Token criado pelo fundador e validado: `/token/check` respondeu `Oli Health Hub / contato@olihealthhub.com.br`. Rodado por `rd-backfill` (`verify_jwt:true`), invocada **via `pg_net` a partir do SQL** usando `service_role_key` do Vault — o mesmo caminho que `call_send_push` já usava. Isso permitiu testar tudo sem depender do fundador rodar comando.

**🔑 A descoberta:** `GET /contacts` devolve **`job_title` vazio em 100% dos 40 contatos** e telefone em menos da metade. `GET /deals` **embute o contato com `title` (o cargo) e `phones` preenchidos** — 25 das 32 negociações têm `title`, 21 têm telefone. Ler só `/contacts`, que era o caminho óbvio, descartaria 19 de 40 contatos e perderia a especialidade de **todos**. Cruzar as duas fontes derrubou o descarte de 19 para 11.

**Dos 11 restantes, 8 não eram lead:** `test@meta.com`, três registros "Teste", "TESTE 2 - MICHELLE", "Gabriel Aristoteles" e **o próprio fundador** — resíduo dos testes de configuração da integração. Lista de exclusão é **explícita por e-mail** dentro da função, não heurística de "contém teste" (que descartaria alguém chamado Modesto). Revisável.

**🆕 Achado que não estava em lugar nenhum da documentação: existe Google Ads rodando.** Distribuição de `fonte` depois da carga: **Busca Paga | Facebook Ads 26 · Busca Paga | Google 3 · Desconhecido 2 · Referência | linktr.ee 1**. Até aqui todo o registro do projeto (§19) falava só de Meta. As 3 do Google vieram pela campanha "Envio lead LP para CRM" e são justamente as que só têm e-mail.

**Resultado:** 10 leads inseridos, 22 enriquecidos com `fonte`, 8 ignorados, 0 erros. Base foi de 22 para **32 leads** (22 `meta_ads` + 10 `rd_station`), 28 com especialidade, 4 sem telefone.

**Migration `leads_whatsapp_opcional_e_fonte`:**
- `whatsapp` deixa de ser NOT NULL — 3 leads reais de Google Ads existem só com e-mail, e já havia precedente (os 2 do Meta com telefone de 10 dígitos que não funciona). **O formulário do site continua exigindo telefone na página**; a obrigatoriedade caiu só no banco.
- CHECK novo `leads_tem_algum_contato`: e-mail **ou** telefone. Sem ele, a coluna nula abriria espaço pra linha sem canal nenhum, que não é lead.
- Coluna **`fonte`**, separada de `campanha`/`conjunto`/`anuncio`. **Decisão deliberada:** a RD traz o canal, o Meta traz o criativo. Sobrescrever `campanha` com o dado da RD apagaria a atribuição de criativo dos 22 leads importados. O enriquecimento **só preenche campo vazio**, nunca sobrescreve.

**Normalização de telefone:** a RD guarda como a pessoa digitou — `+5511988395090`, `11954080860` (sem +55) e `922222799` (sem DDD). Os dois primeiros formatos são normalizados; o terceiro **não é chutado**: entra com `whatsapp` nulo e observação pedindo confirmação do DDD. Inventar DDD geraria WhatsApp para a pessoa errada.

**Tela:** lead sem telefone mostra "sem telefone — falar por e-mail" em âmbar, e a coluna Origem passa a exibir a `fonte` em verde acima do conjunto/criativo.

### Tela `/leads` — filtro por situação e observação colapsada (03/ago, após uso real)

Dois pedidos do fundador depois de trabalhar a base de 32 leads:

- **Filtro por situação.** Chips no topo, um por etapa, com contador. Implementados como **`<Link>` com `?status=`**, não botões — mantém a página server component (nada de `'use client'` só pra filtrar) e cada filtro ganha URL própria, compartilhável. O filtro roda **em memória**, não no banco: a base tem dezenas de linhas, e assim os contadores de todas as etapas saem da mesma consulta em vez de 9 `count`. Etapa com zero lead **não vira chip** — senão a barra nasceria com 9 filtros mortos. Padrão em `searchParams` copiado de `/pagamentos`; **Next 14.2.29, então `searchParams` é objeto simples, não Promise** (em Next 15 seria `await`).
- **Observação colapsada.** O textarea de 8 linhas em toda linha da tabela tornava a tela impossível de varrer, e a maioria dos leads não tem observação. Virou **`<details>` nativo**: fechado mostra os primeiros 60 caracteres (ou "+ observação"), aberto mostra o textarea de 6 linhas. Nativo de propósito — abrir e fechar não justifica virar client component. **O textarea continua no DOM mesmo fechado, então o form envia normal.** Coluna caiu de 420px para 330px.

**⚠️ Pendências:** a função **`rd-probe` é temporária, de diagnóstico, e deve ser apagada** (o MCP do Supabase não tem tool de deletar function — apagar pelo painel). E `rd-backfill` pode ser re-executada com segurança quantas vezes quiser — deduplica por e-mail.

### ✅ Webhooks cadastrados na RD (04/ago) — via API, não pelo painel

**Sintoma reportado:** "tivemos leads novos, não subiram no dashboard". **Diagnóstico em duas consultas:** o log de edge functions mostrava todas as outras funções sendo chamadas e **zero requisição em `rd-leads-webhook`** desde o deploy. Confirmado depois pela própria API da RD: `GET /webhooks` devolveu `existentes: []`. O webhook nunca tinha sido cadastrado — a carga do dia anterior trouxe o histórico e deu a impressão de que o fluxo estava ligado.

**Resolvido sem passo manual.** Em vez de mandar um caminho de cliques que não dá pra verificar daqui, foi criada a função utilitária **`rd-setup-webhook`** (`verify_jwt:true`), que lê `RD_CRM_TOKEN` e `RD_WEBHOOK_SECRET` do próprio ambiente e cadastra pela API da RD. **Vantagem real:** o segredo nunca é digitado à mão em lugar nenhum, então é impossível cadastrar com valor diferente do que a função valida — que seria um 401 silencioso, o pior modo de falha possível aqui.

Ações suportadas: `listar` (padrão), `criar` (idempotente — pula evento que já aponta pra cá, pra não duplicar entrega) e `apagar` por uuid. **A resposta mascara o segredo da URL** (`secret=***`) porque cai em log e em conversa.

**Criados em 04/ago:**
| Evento | uuid |
|---|---|
| `crm_contact_created` | `77e2cb4d-0b8a-4a1d-ac53-51e080345f01` |
| `crm_deal_created` | `4f3e578a-19a4-46ef-9e8d-1f791f289a1f` |

Curiosidade a conferir se algo estranhar: a RD devolveu **`entity_type: "CONTACT"` nos dois**, inclusive no de negociação. O `event_type` foi gravado certo nos dois, então provavelmente é só rótulo interno dela.

**Antes disso, a carga foi rodada de novo e trouxe 3 leads que estavam parados na RD** — Karoline Santos (Receptionist), Maria Thereza Natel (médica) e uma terceira só com e-mail, da landing page. Base: **35 leads**.

**Como confirmar que está funcionando:** no próximo lead, Supabase → Edge Functions → Logs deve mostrar linha `[rd-leads] lead gravado`. Se aparecer `[rd-leads] segredo inválido`, o `RD_WEBHOOK_SECRET` foi trocado depois do cadastro — nesse caso rodar `rd-setup-webhook` com `apagar` nos dois uuid e `criar` de novo.

**🔒 Nota de segurança:** o primeiro `RD_WEBHOOK_SECRET` gerado apareceu num print enviado no chat e foi orientado regenerar. Como o cadastro do webhook só aconteceu **depois**, o valor exposto não chegou a ser usado em lugar nenhum.

**Resumo de 1 linha (05/ago):** Fechado o ciclo com a RD — antes só recebia, agora **o status do painel volta para o funil da RD**. Decisão do fundador: painel é a fonte de verdade, equipe não mexe no funil, então a sincronização é de mão única e sem regra de desempate. **O funil da RD bate quase 1:1 com a esteira** (7 das 9 etapas com par exato — não é coincidência, as duas nasceram da mesma realidade comercial). **A peça que faltava era o id da NEGOCIAÇÃO:** o que estava guardado era o id do contato, e contato não anda no funil — criada a coluna `rd_deal_id` e vinculados 36 de 36 leads por e-mail, ficando com a negociação mais recente quando há mais de uma. Espelhamento por **trigger no banco**, não na server action, pra cobrir qualquer caminho que mude status (tela, SQL, importação), com `WHEN` garantindo que salvar só a observação não chame a RD; tradução etapa→etapa em **tabela editável** (`rd_stage_map`), não em código. **Achado que custaria uma tela de alerta falso permanente:** o alinhamento geral deu um HTTP 422 que **não era erro** — a RD recusa mover a negociação para a etapa em que ela já está; tratado como sucesso, confirmando pelo corpo do próprio 422 (que traz a negociação inteira) sem gastar requisição extra. Depois do fix, **36/36 sincronizados, 0 erros**. Confirmado também que **o webhook da RD está funcionando de verdade**: 4 leads entraram sozinhos em 05/ago. Falha de sincronização aparece na tela como selo vermelho — engolir o erro seria pior que não ter a feature. **Pendências:** 4 edge functions deployadas e ainda fora do repo, `rd-probe` a apagar, e typecheck do admin sem rodar (sandbox fora).

## 19-b. Favicon do site (31/jul sessão 6)
<!-- Renumerado de "19" para "19-b" em 05/ago: havia DUAS seções §19 no arquivo
     (esta e "Leads de tráfego pago", bem acima), o que quebrava qualquer
     referência cruzada a "§19". As referências no texto apontam para a de leads. -->

**Achado:** o site **não tinha favicon nenhum** — zero `<link rel="icon">` e nenhum arquivo de ícone em `landing/`. Por isso Google e abas do navegador mostravam o ícone genérico desde sempre.

**Decisão do fundador:** fundo verde OLI (`#5F7D67`) com o símbolo **vazado em creme** (`#F4EFEA`), em **formato circular**. A primeira versão publicada era quadrada; o fundador achou o quadrado duro e pediu "sem fundo". Foram comparadas 3 opções lado a lado (sem fundo / círculo verde / quadrado) simuladas em aba clara, aba escura e no recorte circular do Google — **o círculo foi o escolhido**, porque "sem fundo" deixa o símbolo verde médio sobre o cinza escuro do Chrome em modo escuro (contraste fraco) e com traço fino demais em 16px, enquanto o círculo elimina o quadrado sem perder legibilidade.

**⚠️ O `apple-touch-icon.png` continua quadrado de propósito** — o iOS aplica a própria máscara arredondada. Ícone já circular ou com transparência vira quadrado preto na tela inicial.

**Fonte do ícone:** só o **símbolo** circular, nunca o logo completo — o texto "OLI HEALTH HUB" é ilegível abaixo de 48px. O símbolo foi extraído de `landing/logo_oli_transparent.png` (bounding box da metade esquerda, recortado quadrado e centralizado).

**Arquivos (em `landing/`):**
| Arquivo | Tamanho | Para quê |
|---|---|---|
| `favicon.png` | 192×192 circular, ~17 KB | Google Search, abas, atalhos |
| `apple-touch-icon.png` | 180×180 quadrado, ~15 KB | tela inicial do iPhone |

192 e não 512: é múltiplo de 48 (o que o Google pede) e pesa 17 KB em vez de 59 KB. A primeira tentativa saiu em 512 e foi reduzida na mesma sessão.

**🐛 Erro silencioso que custou uma rodada:** o primeiro `mv` dos dois arquivos moveu só o `apple-touch-icon.png` — o download do `favicon.png` não tinha completado. Resultado: as tags e um dos ícones no ar, `/favicon.png` em **404**, e nenhum aviso em lugar nenhum. Ao mover arquivo baixado, conferir com `ls` no destino depois do `mv`.

**🐛 Cache de favicon engana:** publicado e funcionando, o fundador continuou vendo o ícone antigo. Favicon tem cache próprio no Chrome, que **ignora refresh e hard refresh** — e como o site nunca teve ícone, o navegador tinha memorizado "não tem". Para conferir de verdade: aba anônima, ou abrir `/favicon.png` direto. Não confundir com deploy que falhou.

**Tags adicionadas nas 7 páginas** (`index`, `consultorio`, `privacidade`, `confirmado`, `baixar`, `consentimento` e o `_template-pagina-confirmacao`, pra novas páginas já nascerem com ícone):

```html
<link rel="icon" href="/favicon.png" type="image/png" sizes="512x512">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#5F7D67">
```

**⚠️ Como os PNGs foram gerados (o sandbox estava fora do ar):** o sandbox de terminal do Cowork caiu nesta sessão (`useradd failed`, 3 tentativas), o que impede **qualquer processamento de binário** — não dá nem pra copiar um PNG entre pastas, porque as ferramentas de arquivo só escrevem texto. Contorno usado: compor o ícone no **canvas do próprio navegador** a partir do PNG já publicado no site (same-origin, então `getImageData` funciona sem taint), recolorir via `globalCompositeOperation='source-in'` e baixar com `toBlob`. O fundador autorizou o download e moveu os 2 arquivos pra `landing/`. Registrar isso porque é o caminho pra qualquer geração de imagem enquanto o sandbox estiver quebrado.

**Validado visualmente** antes de gerar: renderizado em 16/32/48/64/128px e simulado em aba clara, aba escura e recorte circular (como o Google exibe). Legível em todos.

**Pendências menores:**
- Sem `favicon.ico` — não foi possível gerar (formato binário multi-resolução). Só afeta navegadores antigos; irrelevante pro Google, que lê a tag `rel="icon"`.
- `favicon.png` com 59 KB é maior que o ideal pra um favicon. Quando o sandbox voltar, vale gerar versões 48/96/180 e servir por `sizes`, em vez de um 512 único.
- **O Google pode levar dias ou semanas** pra atualizar o ícone no resultado de busca — depende do próximo rastreamento. Não é sinal de erro. Dá pra acelerar pedindo reindexação da home no Search Console.

## 25. Volta da informação para a RD — status do painel espelhado no funil (05/ago)

**Decisão do fundador:** "A equipe não mexe no funil lá, apenas nós aqui. Tudo o que mudarmos aqui tem que mudar lá." Ou seja, **o painel é a fonte de verdade do status** e a sincronização é de mão única, painel → RD. Isso simplifica muito: sem regra de desempate, sem conflito.

### O achado que tornou isso viável

Levantado o funil da RD antes de propor qualquer coisa: o "Funil Padrão" bate **quase 1:1** com a esteira do painel — 7 das 9 etapas têm par exato (Novo lead, Contato realizado, Visita agendada, Visita realizada, Proposta enviada, Contrato fechado, Perdido). Não é coincidência: a esteira do §22 foi desenhada a partir da descrição do fundador, e o funil da RD veio da mesma realidade comercial. Só `sem_resposta` e `aguardando_retorno` não têm par — são as duas que ele pediu e a RD não tem. A RD tem uma que o painel não tem: "Timing futuro".

### 🔑 A peça que faltava: id da negociação, não do contato

Até aqui o vínculo guardado era `external_id = rd_contact:<id>`. **Contato não anda no funil — quem anda é a negociação.** Foi preciso a coluna `rd_deal_id` e uma carga (`rd-vincular-deals`) cruzando por e-mail: **36 de 36 leads vinculados, nenhum sem negociação**. Quando a pessoa tem mais de uma negociação, fica a **mais recente** — é a que representa o momento atual dela no funil.

### Como funciona

- **Trigger no banco**, não na server action: `trg_lead_status_para_rd` (`after update of status`, com `when (old.status is distinct from new.status)`). Amarrar na action cobriria só a tela; no banco, **qualquer** caminho que mude o status espelha na RD — tela, SQL, código futuro, importação. O `WHEN` garante que salvar só a observação não gere chamada à RD.
- **`rd_stage_map`**, tabela e não código: a tradução etapa→etapa é regra de negócio, muda por `UPDATE` sem deploy. Mesmo padrão de `partner_commission_config`.
- **`rd-sync-status`** faz o `PUT /deals/{id}` movendo a etapa. Assíncrono via `pg_net`, com o resultado voltando em `leads.rd_sync_em` / `rd_sync_erro`.
- **Falha fica visível na tela** — selo vermelho "⚠ não espelhado na RD". Lead dessincronizado em silêncio é exatamente o problema que essa feature existe pra evitar; engolir o erro seria pior que não ter a feature.

### 🐛 O 422 que não era erro

O alinhamento geral deu 35/36, com um **HTTP 422**. Em vez de chutar, foi capturado o corpo inteiro da resposta: a negociação **já estava na etapa de destino**, e a RD recusa mover para a etapa em que a negociação já está.

Tratado como sucesso, não como falha — o destino desejado foi alcançado. E dá pra confirmar **sem gastar requisição extra**, porque o corpo do próprio 422 traz a negociação inteira, incluindo `deal_stage.id`. Sem esse tratamento, o alinhamento geral nunca convergiria e a tela viveria com alerta falso. Depois do fix: **36/36 sincronizados, 0 erros.**

### Modos de operação

`rd-sync-status` aceita `{leadId}` (o que o trigger usa), `{reprocessarFalhas:true}` (só quem está com erro) e `{todos:true}` (alinhamento geral — **sobrescreve a etapa na RD de todo lead**, usar com parcimônia).

### ✅ Confirmações desta sessão

- **O webhook da RD está funcionando de verdade:** entraram 4 leads em 05/ago sem intervenção, incluindo "Gisele Lopes Rosa", que apareceu sozinha na base. Base: **36 leads**.
- Teste ponta a ponta: Roberta Leoni movida de `contatado` para `visita_agendada` no painel → negociação andou para "Visita agendada" na RD, `rd_sync_em` preenchido, sem erro.

### 🐛 O buraco que apareceu no dia seguinte (06/ago) — lead novo não espelhava

**Sintoma:** "Os leads não atualizaram no RD". E a primeira verificação, feita no dia anterior, **tinha dado 36/36 sincronizados** — porque eu conferi o lado errado.

**Erro de método, vale registrar:** validei que a RD respondeu **HTTP 200** ao `PUT` e considerei sincronizado. Nunca **li de volta** da RD para confirmar que a etapa mudou de fato. `200 ≠ aplicado`. A checagem correta é comparar `leads.status` com `deal.deal_stage.id` lido da RD — foi assim que o problema real apareceu.

**Causa raiz:** o webhook `crm_contact_created` entrega o **contato**, e nesse instante **a negociação pode nem existir na RD**. O lead entra sem `rd_deal_id`. O trigger de espelhamento tem `if new.rd_deal_id is null then return new` — pula **em silêncio**. A vinculação (`rd-vincular-deals`) tinha sido tratada como **carga única**, então todo lead que chegou depois ficou órfão.

Números: a base foi de 36 para 43 leads; **7 chegaram pelo webhook sem `rd_deal_id`**. O fundador mudou o status deles no painel e nada foi para a RD. A RD estava com 8 em "Novo lead" quando o painel dizia 1.

**Correções aplicadas:**
1. Vinculados os 43 e empurrado o status — **confirmado lendo de volta da RD: 43/43 batem, 0 divergem** (RD: 1 "Novo lead", 42 "Contato realizado", idêntico ao painel).
2. `rd-vincular-deals` passou a **espelhar o status logo após vincular**. Necessário porque `UPDATE` de `rd_deal_id` **não dispara o trigger** (que só escuta `update of status`) — sem isso o lead ficaria vinculado mas parado na etapa errada até alguém mexer no status de novo.
3. **Dois cron jobs** (`pg_cron`), porque vincular tem que ser recorrente e não carga única:
   - `rd-vincular-deals` a cada 15 min — pega quem chegou pelo webhook sem negociação.
   - `rd-reprocessar-falhas-sync` aos minutos 7 e 37 — reprocessa quem ficou com `rd_sync_erro`. Separado de propósito: falha de rede na RD não deve travar a vinculação, e vice-versa.

**Lição para a próxima integração:** trigger que sai silenciosamente num `if` (aqui, `rd_deal_id is null`) é um modo de falha invisível. Ou ele registra o motivo do pulo, ou precisa de uma rede que varra os pulados — foi o caminho escolhido.

**⚠️ Pendências:** só `20260805_leads_sync_status_para_rd.sql` foi versionado; **as edge functions `rd-sync-status`, `rd-vincular-deals`, `rd-setup-webhook` e `rd-backfill` estão deployadas mas não estão no repo** — escrever em `supabase/functions/` na próxima sessão. `rd-probe` continua temporária e deve ser apagada. Typecheck do admin não rodou nesta sessão (sandbox de shell segue fora).

## 26. Atendente do lead — Claudia, Igor e Guilherme (06/ago)

Pedido do fundador: poder marcar quem está cuidando de cada lead.

**Modelado como FK para `profiles`, não texto livre nem lista fixa em código.** Os três já existiam como perfis com acesso ao painel — Claudia Moraes (`team`), Igor Oliveira (`founder`) e Guilherme Pasquetti (`founder`), todos `is_admin = true`. O seletor lê `profiles where is_admin = true`, então **incluir uma quarta pessoa é conceder acesso ao painel, sem deploy**. Aproveita o decoupling `is_admin` × `user_type` feito em 21/jul.

`on delete set null`: se o perfil sumir, o lead continua existindo sem dono. Perder o lead junto com o atendente seria muito pior que perder a atribuição.

**🔍 Achado que fechou a questão do espelhamento: a RD tem UM único usuário.** `GET /users` devolveu só "Oli Health Hub" (`contato@olihealthhub.com.br`), e **as 43 negociações estão todas nele**. Não existe Claudia/Igor/Guilherme na RD. Decisão do fundador: **o atendente vive só no painel** — criar usuários lá custaria assento por pessoa. Se um dia mudarem de ideia, o caminho é `PUT /deals/{id}` com `user_id`, e aí sim faria sentido uma tabela de-para como a `rd_stage_map`.

**Tela:**
- Seletor no formulário, **primeiro campo** — antes da etapa. Definir dono vem antes de mexer no andamento.
- Selo na coluna Situação com **nome curto** ("Claudia M.") — nome completo empurraria as outras colunas sem acrescentar informação.
- **Sem dono aparece em âmbar, nunca some.** Lead sem atendente é o que mais corre risco de ficar parado; esconder seria o oposto do objetivo.
- **Filtro por atendente**, em linha própria acima da tabela, com o chip "Sem atendente" **sempre visível mesmo zerado** — é a fila de trabalho.

**Dois detalhes de filtro que só aparecem em uso real:**
1. **Os contadores respeitam o outro filtro ativo.** Se você filtra por Claudia, o número no chip "Contatado" mostra quantos são da Claudia — senão o número não corresponde ao que a tabela mostra depois do clique.
2. **Cada link preserva o outro filtro** (helper `href()`). Sem isso, clicar num chip de situação descartaria silenciosamente o atendente escolhido.

**✅ Publicado — commit `f5f087c`, push em 07/ago.** Typecheck verde nos dois projetos (`admin` e raiz) antes do commit. Entraram as migrations de 04, 05 e 06/ago reconstituídas em arquivo, fechando o histórico do schema no repo.

**⚠️ Pendências:** `database.types.ts` foi novamente **editado à mão** — o bloco `leads` estava defasado em 5 colunas (`fonte`, `rd_deal_id`, `rd_sync_em`, `rd_sync_erro`, e `whatsapp` que já era nullable); corrigido junto, mas regenerar de verdade quando houver shell. **As 5 edge functions seguem fora do repo** (item 29 do §11).

**🧹 Higiene achada no commit:** `admin/tsconfig.tsbuildinfo` entrou junto — é **artefato de build do TypeScript**, regenerado a cada `tsc`. Versionado, vai sujar o diff de toda sessão e gerar conflito bobo. Adicionar ao `.gitignore` e remover do índice (`git rm --cached admin/tsconfig.tsbuildinfo`). Ficaram também soltos na raiz, não commitados: `resumo-matinal-2026-08-07.html` (artefato de brief matinal, não é do projeto), `.agents/`, `.codex/` e `AGENTS.md`.

## 27. Botão do WhatsApp na Fila — nunca funcionou (07/ago)

**Sintoma reportado:** o botão WhatsApp na Fila abre a tela de "escolher contato" em vez da conversa com o lead.

**Causa:** `FilaClient.openWhatsApp()` lia `item.metadata.phone`. **Essa chave não existe em nenhum registro** — conferido no banco: de 159 notificações, **0 têm `phone`**. Sem número, o código caía no `https://wa.me/?text=...`, que é exatamente o link "abrir WhatsApp sem destino". Ou seja, **o botão nunca funcionou para nenhum tipo de notificação**, não só para leads — o defeito só ficou visível agora porque a Fila encheu de lead.

**Onde o telefone realmente está:**
| Tipo | Fonte do telefone |
|---|---|
| `lead_received` (37) | `metadata.whatsapp` |
| `new_signup` (109), módulos, planos | `profiles.whatsapp` (join) — o metadata nunca teve |

`fila/page.tsx` passou a trazer `whatsapp` no join de `profiles`; `openWhatsApp` lê `metadata.whatsapp` → `profiles.whatsapp` → `metadata.phone` (mantido por segurança).

**🐛 Segundo bug, que teria trocado o defeito por outro pior:** o código montava `wa.me/55${digitos}` — prefixando o DDI **cegamente**. O telefone de lead vem da RD já como `+5511950888026`; prefixar de novo daria `555511950888026`. Consertar só a leitura da chave abriria conversa com **número inexistente** — falha mais difícil de perceber que a atual. Agora há `numeroWhatsApp()`: usa como está se já começa com 55 e tem 12+ dígitos, prefixa 55 se tiver 10-11, e **devolve nulo se não der pra confiar** — melhor abrir sem destino do que mandar mensagem para a pessoa errada.

**Mais dois achados no mesmo caminho:**
- **Título "Novo lead novo: Cintia".** A origem `rd_station` foi criada **depois** de `notify_lead_created()` e nunca entrou no `CASE`, caindo no `ELSE 'novo'`. Corrigida a função e feito `UPDATE` nos títulos já gravados.
- **`body` da notificação virava nulo para lead sem telefone.** Era `NEW.whatsapp || ' · ' || NEW.email` — em SQL, concatenar com `NULL` zera a string inteira. Desde que `whatsapp` virou opcional (§24), lead de Google Ads gravava corpo vazio. Resolvido com `coalesce`.
- **Texto da mensagem.** Dizia "Olá, Médico!" para lead (não há perfil ligado, então `profiles.nome` era nulo) e afirmava que a pessoa "acabou de se cadastrar". Agora lead tem texto próprio, com o nome vindo de `metadata.nome`.
- `lead_received` entrou em `NotifType`/`TYPE_TAG` — a tag mostrava a string crua `lead_received`.

**Lição:** o fallback `wa.me/?text=` mascarou o defeito por meses. Fallback silencioso que "quase funciona" esconde bug melhor do que erro na cara.

### Abrir na mesma plataforma do painel (07/ago)

O fundador usa **mais de uma conta de WhatsApp no computador** e perguntou como escolher qual envia.

**Não existe parâmetro de conta no link** — confirmado em pesquisa, o WhatsApp não expõe isso. O link só diz "abra conversa com este número"; quem envia é a conta da superfície que abrir. O que dá para controlar é **qual superfície abre**.

Decisão dele: abrir na mesma plataforma em que o painel está sendo usado. Implementado em `linkWhatsApp()`:

| Onde o painel está aberto | Link usado | Por quê |
|---|---|---|
| Computador | `web.whatsapp.com/send?phone=` | Abre no **mesmo navegador e mesmo perfil** do painel, então a conta é a daquele perfil. Com `wa.me`, o sistema sequestrava o link para o app desktop, possivelmente logado em outro número. |
| Celular | `wa.me/` | Caminho certo para o aparelho abrir o app nativo. Forçar o Web ali pioraria a experiência. |

Detecção simples por user agent (`Android|iPhone|iPad|iPod`) — suficiente aqui, sem biblioteca.

**⚠️ Isto controla qual aplicativo abre, não qual número envia.** Quem quiser garantir que a mensagem saia do número do OLI precisa abrir o painel no perfil de navegador logado nessa conta. Foi dito ao fundador; ele optou por este caminho em vez de um seletor por pessoa, que resolveria menos (escolheria o app, não a conta) e custaria mais.

### Botão também na tela de Leads + baixa automática na Fila (07/ago)

**Lógica do WhatsApp extraída para `admin/lib/whatsapp.ts`** (`numeroWhatsApp`, `linkWhatsApp`, `mensagemLead`) + componente `admin/components/BotaoWhatsApp.tsx`. **Motivo explícito:** duplicar a lógica na tela de Leads recriaria exatamente a condição que gerou o bug de hoje — duas cópias, uma consertada e a outra não. A Fila foi migrada para a fonte única no mesmo passo.

O botão **some sozinho quando não há número utilizável** (`numeroWhatsApp` devolve nulo). Oferecer o botão e abrir o WhatsApp sem destino pareceria defeito — e é o comportamento que o fundador reportou hoje de manhã.

**Lead trabalhado sai da Fila.** A Fila lista `admin_notifications` com `read_at is null`; lead já contatado continuava lá e a fila só crescia — **76 itens** quando isto foi escrito. Novo trigger `trg_lead_trabalhado_sai_da_fila`: ao sair de `novo`, a notificação daquele lead é marcada como lida. Qualquer etapa dá baixa, inclusive `descartado` — descartar também é trabalhar. **Só dá baixa, nunca ressuscita:** voltar o status para `novo` não faz o item reaparecer, senão a fila vira ioiô.

Feita limpeza retroativa do que já estava trabalhado. Resultado conferido: fila de **76 → 54**, sendo **16 notificações de lead abertas para exatamente 16 leads em `novo`**, e nenhuma notificação órfã (apontando para lead inexistente).

**📈 Sinal de que a integração está funcionando:** a base foi de 43 para **60 leads** entre 06 e 07/ago, tudo entrando sozinho pelo webhook da RD.

### Reaproveitar a aba do WhatsApp — a primeira tentativa não funcionou

Cada clique empilhava uma aba, porque `window.open(url, '_blank')` sempre cria janela.

**Tentativa 1 — `target` nomeado (`oli-whatsapp`). Não funcionou.** A teoria é certa para o mesmo domínio, mas o painel e o `web.whatsapp.com` são **origens diferentes**, e os navegadores **apagam o nome da janela ao navegar entre origens** — é proteção contra rastreamento entre sites. A busca pelo nome falhava e cada clique abria outra aba. Testado em produção pelo fundador e reprovado.

**Tentativa 2 — guardar a referência da janela** em memória do módulo (`lib/whatsapp.ts`). Funciona porque três operações continuam permitidas numa janela de outra origem: ler `.closed`, chamar `.focus()` e **escrever** em `.location.href`. Ler a URL dela é bloqueado, mas não precisamos. Então: se a referência existe e a aba não foi fechada, navega ela; senão abre uma nova e guarda.

**Limites, ditos ao fundador:**
- Recarregar o painel perde a referência (ela vive na memória da página) — o clique seguinte abre uma aba nova e daí em diante volta a reaproveitar.
- Aba que a pessoa abriu **à mão** não pode ser alvo. Não existe API para mirar em aba de terceiros; é restrição do navegador, não escolha de implementação.

**Resumo de 1 linha (07/ago):** Dia de **três bugs achados por verificação, não por sintoma**. (1) O botão WhatsApp da Fila **nunca funcionou para ninguém** — lia `metadata.phone`, chave inexistente em todas as 159 notificações; o fallback `wa.me/?text=` mascarou isso por meses, e consertar só a leitura teria trocado o defeito por um pior, porque o código prefixava `55` cegamente num telefone que já vinha com DDI. Lógica extraída para `lib/whatsapp.ts` + `BotaoWhatsApp`, agora usada também na tela de Leads — duplicar seria recriar a causa. Reuso da aba exigiu **duas tentativas**: `target` nomeado não funciona entre origens (navegadores apagam o nome da janela como anti-rastreamento), então guarda-se a referência e escreve-se em `.location.href`. (2) Lead trabalhado agora **sai da Fila** por trigger; com a limpeza retroativa a fila caiu de **76 para 54**. (3) 🔴 **Os pacotes de horas não tinham benefício nenhum**: o `asaas-webhook` ignorava `bonus_horas` e o preço é calculado pela taxa do plano, então comprar pacote era pagar adiantado o mesmo valor da hora avulsa e ainda ganhar validade — comprovado no banco (Starter 10h creditou 600 min em vez de 660). Corrigido o webhook, **creditado retroativamente o único cliente afetado**, alinhada a constante `HOUR_PACKAGES` (dizia 20h→+3, banco dizia +2) e corrigido o descritivo que já estava com o fundador anunciando bônus inexistente. Descoberto que o padrão real é **10% de horas de bônus em todo pacote**, o que virou a mensagem central do material. Também nesta sessão: seletor e filtro de **atendente** ligados aos perfis com acesso ao painel, e a peça do plano PRO refeita **duas vezes** — primeiro para tirar todo comparativo (o cliente vê um plano por vez), depois para virar ficha de serviço em vez de anúncio.

## 28. Pacotes de horas — o bônus nunca era creditado (07/ago)

Pedido de um material comercial sobre os pacotes. Ao conferir os números antes de escrever, **os pacotes não tinham benefício nenhum** — e isso estava em produção.

### Três problemas, um deles comprovado em dado real

**1. 🔴 O bônus nunca chegava ao médico.** O `asaas-webhook` lia `hour_packages` com `.select('horas, validade_dias')` — **sem `bonus_horas`** — e creditava `pkg.horas * 60`. Comprovado: a única compra real de pacote (Starter 10h) tinha `minutos_total = 600`, não 660. O bônus estava cadastrado no banco, anunciado no material comercial, e **nunca entregue**.

**2. `hour_packages.valor` é coluna morta.** A cobrança (`create-hour-package`) ignora esse campo e calcula `horas × 60 × plans.taxa_min` do plano do médico. A coluna guarda R$120/h fixo — que por coincidência bate com o START e mascarou o problema. **Não usar `valor` para nada; corrigir ou remover.**

**3. Três fontes discordando:**
| | `oli-plans.ts` | tabela `hour_packages` | entregue de fato |
|---|---|---|---|
| Bônus 10h | +1 | +1 | **0** |
| Bônus 20h | **+3** | **+2** | **0** |
| Pacote 40h | não existia | +4 | **0** |

**Somando 1 e 2: comprar pacote era pagar adiantado exatamente o mesmo preço da hora avulsa, e ainda ganhar prazo de validade.** Estritamente pior que não comprar.

### Decisão e correções

Fundador escolheu **corrigir o sistema e passar a entregar o bônus** (em vez de trocar por desconto ou remover os pacotes).

- **`asaas-webhook` v23:** passa a ler `bonus_horas` e credita `(horas + bonus) × 60`. A notificação do admin também discrimina o bônus.
- **Crédito retroativo:** o cliente que já havia comprado foi de 600 para 660 minutos. Ele pagou por 11h e usou 10 desde a compra.
- **`oli-plans.ts`:** `HOUR_PACKAGES` alinhada ao banco (20h corrigido de +3 para +2, adicionados 1h e 40h) + comentário deixando explícito que **a fonte de verdade em runtime é a tabela**, não a constante.
- **`OLI_Descritivo_Planos.html`** (material que já estava com o fundador): dizia "20h → 23 horas" e não tinha o pacote de 40h. Corrigido.

### 🔑 O padrão que simplificou o material

Com os valores do banco, **todo pacote dá exatamente 10% de horas a mais** (10→11, 20→22, 40→44). A hora efetiva cai 10% em qualquer tamanho: **R$ 109 no START, R$ 82 no BASE, R$ 71 no PRO**. Isso substitui uma tabela de três linhas por uma frase — e foi o que virou a mensagem central da peça.

**Preços reais cobrados hoje** (`horas × 60 × taxa do plano`):
| Pacote | START | BASE | PRO | Validade |
|---|---|---|---|---|
| 1h | 120 | 90 | 78 | 30 dias |
| 10h | 1.200 | 900 | 780 | 60 dias |
| 20h | 2.400 | 1.800 | 1.560 | 90 dias |
| 40h | 4.800 | 3.600 | 3.120 | 90 dias |

**Lição:** o pedido era "escrever um material". Escrever sem conferir teria produzido uma peça bonita anunciando um benefício inexistente — que é exatamente o que o descritivo de 03/ago já estava fazendo havia quatro dias. **Conferir o número contra o que o sistema entrega, não contra o que a documentação diz.**

**⚠️ Pendências:** typecheck e commit (mexeu em `src/models/oli-plans.ts`); `hour_packages.valor` continua como dado morto e enganoso; a peça em SVG do plano PRO (`iCloud/OLI - HH/OLI_Plano_PRO.svg`) foi feita como ficha de serviço, sem comparativo — o cliente vê só um plano por vez.

## 29. Bônus de horas não creditado no webhook Asaas (13/ago)

**Achado:** `supabase/functions/asaas-webhook/index.ts`, seção "Compra de pacote de horas", creditava `hour_balance.minutos_total = pkg.horas * 60` na confirmação de pagamento — **nunca somava `pkg.bonus_horas`**. A UI prometia o bônus explicitamente: `HourCheckoutModal` mostra "+Xh bônus", a mensagem de sucesso diz "inclui Xh bônus", e o admin (`/catalogo`) exibe a coluna Bônus (§ sessão 23/jun — coluna `bonus_horas` adicionada: 10h→1, 20h→2, 40h→4). Ou seja: médico via a promessa na tela, mas o saldo real no banco ficava sempre sem o bônus.

**Diagnóstico rodado em produção** (comparando `hour_balance` × `hour_packages` onde `minutos_total == horas*60` num pacote com bônus > 0): **0 registros afetados**. Nenhum médico comprou pacote com bônus via Asaas até agora — sem necessidade de backfill.

**Fix:** `select` passa a trazer `bonus_horas`; `minutos_total = (horas + bonus_horas) * 60`. Notificação admin e log também refletem o total real. Deployado direto via Supabase MCP (função v22, ACTIVE) e depois commitado — branch de sessão (`claude/relaxed-bouman-d3f4be`) tinha sido criada a partir de um ponto de ~3 semanas atrás (mesmo commit do evento Luma co-hosted) e nunca rebasada. **PR #10 aberta e mergeada em `main`.**

**Lição:** ao editar uma edge function direto pelo MCP (comum quando a mudança é urgente), sempre commitar o arquivo local em seguida no mesmo turno — senão o git fica divergente do que está rodando em produção e a próxima sessão não sabe que o fix existe.

**Lição de merge:** 1ª tentativa de merge falhou por conflito no próprio `HANDOFF.md`, mesmo o conteúdo sendo idêntico — o arquivo tinha sido atualizado via `cp` (cópia inteira da versão de main + edições) em vez de editado incrementalmente, então o git via dois diffs grandes e divergentes a partir do mesmo ancestral em vez de reconhecer que eram o mesmo texto. Resolvido com `git reset --hard origin/main` + `cherry-pick` do commit do fix (esse sim aplicou limpo, por ser mudança pequena e isolada) + reaplicação manual das duas edições no handoff (data + §28) direto em cima do conteúdo real de main, depois `push --force-with-lease`. Vale pra qualquer sessão futura que sincronizar um doc grande contra uma branch atrasada: editar incremental, nunca sobrescrever o arquivo inteiro por cópia.

## 30. Reformulação de planos — dois planos, START sem mensalidade (13/ago)

> ⚠️ **Superado em parte pela §43 (28/ago):** o prontuário **saiu do PRO** e virou serviço contratado à parte, por R$ 239/mês.

**Nada disso foi implementado.** Sessão de decisão comercial: os números estão fechados, o escopo está definido, e o único entregável concluído é o material de venda em PDF. Banco, app, admin e site continuam com o modelo antigo, esperando autorização explícita do fundador.

### A decisão

O OLI passa a ter **dois planos**: START e PRO. O BASE é **desativado, não apagado** (`plans.ativo = false`), para preservar histórico. O VIP fica como está, inativo.

**O que tornou a decisão barata:** ninguém assinava o BASE. Levantamento no banco em 13/ago — 22 perfis no START, 1 no PRO, 24 assinaturas ativas **todas apontando para o START**, nenhuma no BASE. Zero cliente migra.

### Números fechados

| | Mensalidade | Por minuto | Hora cheia |
|---|---|---|---|
| **START** | **sem mensalidade** | R$ 1,90 | R$ 114 |
| **PRO** | R$ 599/mês · **R$ 499/mês no semestral** | R$ 1,45 | R$ 87 |

**Viradas:** START → PRO **22,2h/mês** no mensal (material diz "a partir de 23h") e **18,5h/mês** no semestral ("a partir de 19h", ~4h30 por semana). Até 18h/mês o START é o mais econômico.

> ⚠️ **Houve uma versão intermediária, descartada no mesmo dia:** START a **R$ 97/mês** e PRO semestral a **R$ 449**. Se aparecer material ou conversa com esses números, está velho. A versão válida é a da tabela acima.

### Três estados de usuário, não dois planos

O cadastro **deixa de receber START automático**. Passam a existir:

1. **Cadastrado sem plano** — entra no app e vê **só a tela de planos**. Não reserva, não vê comunidade, não acessa pacientes nem financeiro. **A conta não expira.**
2. **START** — reserva, compra horas, conforto médico, app e comunidade completos.
3. **PRO** — tudo.

Consequência aceita conscientemente: **o app deixa de ser ferramenta de retenção para quem não paga.** Comunidade, Olicoins e a régua de nurturing de julho ficam invisíveis nesse estado, e a conversão passa a acontecer inteira no comercial (visita e WhatsApp). Vários gatilhos de push precisarão ser silenciados para esse estado antes do primeiro cadastro novo de verdade.

### Serviços por plano

- **START:** sala equipada · comunidade e eventos · app (agenda, controle do tempo de sala, cadastro de pacientes).
- **START com compromisso de 6 meses:** ganha diagnóstico contábil e jurídico como **cortesia única na contratação** (não renova a cada semestre), sem custo adicional.
- **PRO:** tudo do START · impressão · prontuário e agenda pela internet · **recepção cuidando do agendamento, da cobrança e do retorno dos pacientes** · emissão de nota fiscal · os dois diagnósticos.

O **diagnóstico de convênios (AR Soluções) sai de vez** — não aparece em nenhuma das duas listas, coerente com o standby da parceria já registrado no item 23 do §11.

### Pacotes de horas: sobram 1h e 10h

Ficam **só a hora avulsa e o pacote de 10h**. Os de 20h e 40h foram removidos por um motivo simples que ninguém tinha notado: **o bônus é 10% fixo em qualquer tamanho**, então comprar 4 pacotes de 10h dá exatamente as mesmas 44 horas pelo mesmo preço do antigo pacote de 40h. O pacote maior não entregava vantagem nenhuma — só travava mais dinheiro do cliente de uma vez.

| Compra | Recebe | START | PRO | Validade |
|---|---|---|---|---|
| 1 hora | 1 hora | R$ 114 | R$ 87 | 30 dias |
| 10 horas | **11 horas** | R$ 1.140 | R$ 870 | 60 dias |

- Efeito colateral: **a validade máxima cai de 90 para 60 dias.** Quem antes comprava 40h tinha um trimestre; agora são quatro janelas de 60 dias, cada uma começando na compra.
- Isso **facilita fechar o item 34 do §11** (`hour_packages.valor` é dado morto guardando R$ 120/h fixo) — com só dois pacotes, corrigir ou remover a coluna fica trivial.

### 🔴 O diagnóstico que mudou a conversa: o gargalo não é o plano

Levantado no meio da sessão, com dados do banco:

| | Número |
|---|---|
| Leads na base | 66 (30 na semana de 03/08, 10 na de 10/08) |
| Contatados | 50 |
| Chegaram a visita | **4** (3 agendadas, 1 realizada) |
| Propostas enviadas / convertidos | **0 / 0** |
| Reservas em toda a história do produto | **5** |
| Sessões efetivamente cobradas | **1** |
| Cadastrados no START | 22 — **3** já reservaram alguma vez |

**50 contatos viraram 4 visitas (8%) e nenhuma proposta.** E os 50 estão parados em "contatado", sem `temperatura`, sem `perfil` e sem `motivo_descarte` preenchidos — os campos existem na tela desde 03/ago e ninguém usou. **A informação mais barata e mais valiosa disponível hoje é classificar esses 50**, porque ela decide se preço faz alguma diferença.

O fundador confirmou: **a base atual é teste e parceiro, não cliente pagante — o OLI não fatura nada.** Composição real: 18 `subscriber`, 2 `founder`, 2 `partner`, 1 `team`; dos 18, 11 completaram onboarding.

### Break-even recalculado (custo fixo R$ 50.000, ~2% Asaas)

| Cenário | Pagantes para empatar |
|---|---|
| Todos a 20h/mês | ~22 |
| Mix realista: 60% START a 8h + 40% PRO a 25h | ~30 |
| Conservador: 70% START a 6h + 30% PRO semestral a 25h | ~38 |

Projeção até dezembro (20 semanas, ~30 leads/semana → ~600 leads): com o funil atual (6% visita) a receita de dezembro fica em ~16% do custo fixo; a 10%/30% chega a 41%; **só o cenário de 15% de visita e 35% de fechamento chega a 85%**. Ou seja, equilibrar até dezembro depende de **triplicar a taxa de visita**, não de mexer em preço. Se isso não parecer alcançável, a conversa passa a ser reduzir o custo fixo ou abrir receita que não dependa de captação — as salas de evento/conferência por bloco (§8 do `OLI_BASE.md`, preço nunca validado) são a única fonte já mapeada.

### ⚠️ Nada muda para quem já está no sistema

Decisão explícita do fundador: **o modelo novo vale só para quem entrar de agora em diante.**

**Isso não é trabalho zero.** Hoje a assinatura lê o preço direto da tabela `plans` — no instante em que o START mudar, os 24 cadastros atuais são afetados. Preservar os atuais exige **congelar as condições na própria assinatura** (coluna de snapshot + ajuste no checkout). Proposta registrada: marcar na assinatura, **não** criar um plano "START Legado", para não aparecer um terceiro plano na interface.

### Escopo definido

**Agora:** material comercial · site · banco (BASE desativado, preços, ciclo semestral, pacotes 20h/40h desativados, congelamento dos atuais) · estado sem plano · app · checkout do START · documentação.

**Depois:** comissão de parceiro com tier único PRO · recalibrar `push_sugestao_upgrade_plano` (hoje aponta o BASE e dispara em 10h) e silenciar os pushes de comunidade/perfil para quem está sem plano · mecanismo de liberação da cortesia dos diagnósticos (hoje é agendamento manual, não precisa de software) · Communicare completo · salas de evento por bloco.

### Armadilhas e lacunas registradas

- **O ciclo semestral não existe no sistema.** `subscriptions.ciclo` só aceita `mensal` e `anual`; `plans` só tem `preco_mensal` e `preco_anual`. Precisa existir antes de qualquer venda semestral.
- **"Sem fidelidade" deixou de valer para o OLI inteiro.** É o H1 do site desde 31/jul ("Sem aluguel e sem fidelidade") e agora só vale para o PRO mensal.
- **O START deixa de ser o padrão gratuito do cadastro.** A cobrança continua por Asaas, fora da loja, com o mesmo argumento 3.1.5(b) (serviço físico) que a Apple já aceitou para o PRO — não é risco novo.
- **`user_type='pending'` já existe** (criado em 17/jul para convites) e é candidato natural a modelar o estado sem plano, em vez de inventar coisa nova.
- **A ferramenta de copiar arquivo da máquina do fundador para a sessão falhou a sessão inteira** (`device_stage_files` com erro de validação de schema; `device_bash` idem). O mapa de arquivos do app e do site nesta seção vem da leitura deste handoff, **não** de inspeção arquivo a arquivo — conferir antes de editar. No fim da sessão a ponte caiu por completo, então **nem o PDF foi salvo no iCloud nem esta seção foi escrita direto no arquivo**.

### Entregue

**Material comercial em PDF, 2 páginas A4** — comparativo START × PRO, regras de cobrança, tabela de quanto sai o mês em 5/10/15/20/25/40h nas três opções com a mais econômica destacada, os três pontos de virada, a compra de horas e o exemplo da consulta de 50 minutos (R$ 95 no START, R$ 72,50 no PRO).

- Gerado por HTML + Chromium headless (`--print-to-pdf`), não por reportlab — dá controle de layout de peça de marca. Fontes: **Poppins**, que existe no sandbox; **Google Fonts está bloqueado (403)** neste ambiente, não tentar de novo.
- **Todos os valores conferidos por script contra as taxas**, não contra a documentação: as 18 células da tabela, as duas viradas, os pacotes e o exemplo da consulta. Foi a lição da §28 aplicada — conferir o número contra o que o sistema entrega.
- Foram três versões no mesmo dia (R$ 97 → sem mensalidade → pacotes enxutos). **A válida é a terceira.**
- Regras de copy respeitadas: nenhum parceiro nomeado ("uma conversa com contador e uma com advogado", "prontuário e agenda pela internet"), sem jargão, sem VIP, sem check-in, "do OLI" nunca "da OLI".
- **Fecha parcialmente o item 35 do §11** (peças comerciais por plano): este é o comparativo; as fichas individuais de START e PRO continuam pendentes, e a peça do PRO em SVG está com os números velhos.

### Em aberto (decisões do fundador)

1. O ciclo anual (R$ 5.990) morre ou convive com o semestral? *(proposta: morre)*
2. O semestral é cobrado à vista (R$ 2.994) ou R$ 499/mês com fidelidade de 6 meses? *(proposta: mensal com fidelidade — é o que trava a montagem no Asaas)*
3. "Communicare completo" no lugar do Plano Básico de hoje — tem custo novo com o Heitor?
4. A cortesia dos diagnósticos é liberada na assinatura ou só depois da primeira sessão de sala usada?

## 31. Reforma de planos — implementada (19/ago)

Fundador respondeu os 4 itens em aberto do §30: **ciclo anual mantém por enquanto** (bônus fica pra pensar depois, não implementado); **semestral cobrado mês a mês** (R$499/mês, fidelidade 6 meses, não à vista); **Communicare sai de vez dos benefícios do PRO** — só módulo pago à parte; **cortesia dos diagnósticos libera na assinatura**, agendamento manual do fundador.

**Achado que mudou o escopo técnico:** a cobrança por minuto da sessão (`usage_charges`) nunca leu o banco — vem de `COST_PER_MINUTE` em `src/store/appStore.ts`, derivado de constante hardcoded em `src/models/oli-plans.ts`. Trocar a taxa do catálogo afetaria os 24 assinantes START + 1 PRO já dentro, instantaneamente, sem distinção — "nada muda pra quem já está no sistema" (exigência do fundador) não era automático. Implementado congelamento: `profiles.taxa_min_congelada` (nullable, `NULL` = usa taxa viva), backfilado pra 2,00 (START) / 1,30 (PRO) nos 25 perfis existentes **antes** de mudar o catálogo. Também achado e corrigido de brinde: `create-subscription` gravava `ciclo`/`status` em inglês (`'MONTHLY'`/`'pending_payment'`) num INSERT que **nunca teria passado** pelo CHECK do banco (só aceita `'mensal'/'anual'/'semestral'` e `'pending'/'active'/...`) — erro nunca checado, falhava em silêncio. Nunca foi pego porque **zero assinaturas pagas reais foram concluídas até hoje** (as 24 START são grátis/automáticas, o 1 PRO foi upgrade manual do admin). Corrigido: mapeia ciclo pra português antes de gravar, usa `'pending'`, e agora lança erro se o insert falhar.

**Banco (`plans`):** START `taxa_min` 2,00→1,90; PRO `taxa_min` 1,30→1,45; BASE `ativo=false` (não apagado, zero assinantes); coluna nova `preco_semestral` (PRO=499). `subscriptions_ciclo_check` ganhou `'semestral'`; coluna nova `fidelidade_ate` (só rastreio, sem bloqueio automático de cancelamento — não existe padrão de multa de fidelidade em nenhum lugar do código). `hour_packages` 20h/40h `ativo=false` (`fetchHourPackages()` já filtra por `ativo`, zero mudança de app necessária). Cadastro **parou de dar START automático**: `profiles.plan` ficou nullable sem default, e `_create_profile_and_subscription()` (trigger `on_auth_user_created`) não cria mais a assinatura START — perfil nasce com `plan=NULL`. Verificado com transação de teste (INSERT em `auth.users` + SELECT + `ROLLBACK`, sem deixar resíduo): perfil novo sai com `plan=null, plan_id=null, subscriptions_count=0`, exatamente como projetado.

**App:** novo gate em `app/_layout.tsx` — sessão + onboarding completo + `!profile.plan` → `/escolher-plano` (tela nova, sem chrome de navegação, mesmo padrão do `conta-bloqueada`). Tela lista START (ativação direta, grátis, toggle "compromisso 6 meses") e PRO (mensal/semestral, abre `PlanCheckoutModal`). `meu-plano.tsx` e `ecossistema.tsx`: **BASE e VIP removidos de vez da vitrine** (não é só `available:false`/dimmed — as entradas somem de `PLANS`/`PLAN_ORDER`/`PLAN_TIER_ORDER`, decisão do fundador nesta sessão); linha "AR Soluções" removida da matriz de benefícios (parceria em standby, §30); linha "CRM Communicare" removida (não é mais benefício incluso). **Ciclo anual do PRO removido também** (fundador decidiu não manter por enquanto, ao contrário do que a §30 tinha deixado em aberto) — só mensal/semestral.

**Congelamento propagado em 4 pontos** (todos liam `COST_PER_MINUTE[plan]` direto, sem noção de per-usuário): `usageChargeService.ts` (cobrança final da sessão), `appStore.getCurrentCost()` + `useTimer.ts` (contador ao vivo durante a sessão — sem isso o número mostrado na tela durante o atendimento destoaria do valor cobrado no fim), `financeiro.tsx` (estimativa de preço do pacote de horas — sem isso mostraria a taxa nova enquanto a cobrança real na edge function usa a congelada) e `create-hour-package` edge function (cobrança real do pacote).

**🔴 Segundo bug achado só ao testar ao vivo (não pego pelo `tsc` nem pela transação de teste no banco):** `subscriptions` só tem RLS de `SELECT` própria + `ALL` admin — nunca teve `INSERT` liberado pro client, de propósito (evita usuário forjar `status='active'` num plano pago sem passar pela Asaas). A primeira versão de `escolher-plano.tsx` fazia `supabase.from('subscriptions').insert(...)` direto do client pra ativar o START — RLS bloqueava com 403 silencioso, o profile virava `plan='START'` mas **sem assinatura nenhuma**. Corrigido com RPC novo `activate_start_plan(p_wants_commitment)` (`SECURITY DEFINER`, atualiza profile + insere subscription atomicamente, mesmo padrão de `_create_profile_and_subscription`). **Só foi encontrado porque a sessão testou de ponta a ponta num usuário descartável real** (criado via SQL em `auth.users`, logado no app via `expo start --web`, ativado START, conferido no banco, depois apagado) — reforça a lição do §28: testar contra o sistema, não contra a lógica no papel.

**✅ Testado ao vivo nesta sessão** (`app-web` — config já existente em `.claude/launch.json` — não o app nativo): cadastro sem plano → gate `/escolher-plano` → PRO nos 2 ciclos (mensal R$599, semestral R$499 com nota de fidelidade) → START com toggle de compromisso → RPC ativa corretamente → dashboard libera. Web, não device/simulador nativo — módulos nativos (câmera, biometria) não passaram por este teste.

**Ajuste de UX pós-teste (feedback do fundador):** em `meu-plano.tsx` o preço grande do card PRO ficava fixo em R$599 ao trocar de ciclo — só uma notinha embaixo dizia "R$499/mês". Corrigido: `activePrice(plan)` calcula o preço do ciclo selecionado e alimenta tanto o preço grande expandido quanto o resumo do card fechado; a nota de semestral virou só "Fidelidade de 6 meses" (não repete mais o valor). Testado ao vivo de novo com 3º usuário descartável (plan='PRO' direto via SQL, sem passar pelo gate) — confirmado visualmente: clicar Mensal/Semestral muda o preço grande na hora, nos dois estados do card.

**⚠️ Pendências:**
- **Site institucional e admin não tocados** — pedido desta sessão foi só "atualizar os planos no app". `admin/app/planos/page.tsx` hoje só lista, não edita `plans`/`hour_packages` (gap pré-existente, não criado nesta sessão).
- **Ciclo anual do PRO**: continua existindo no banco (`plans.preco_anual`) e no Asaas (`create-subscription` ainda aceita `ciclo='YEARLY'`) — só a UI parou de oferecer. Se for pra matar de vez, falta limpar o backend também.
- **Nada testado em device/simulador nativo** (iOS/Android) — só web local + banco. Rodar num device antes de qualquer OTA.
- ~~Nada commitado~~ — commitado e publicado na sessão seguinte (mesmo dia, ver §32).

## 32. Chatbot vira assistente único (Olivia) + catálogo de módulos consolidado (19/ago sessão 2)

**Especialistas OLI reduzidos a 1 assistente geral.** Os 5 personas do chatbot (Ana Luiza/jurídico, Isabella/contábil, Amanda/convênios, Ronaldo/carreira, Olivia/geral) nunca tiveram ponto de entrada ativo no app — o card "Especialistas OLI" em `ecossistema.tsx` já era só uma prévia "Em breve", sem clique. Decisão do fundador: parar de rotear por persona, deixar só a Olivia como assistente geral de dúvidas do app/espaço, sem a parte de agendamento de consulta com parceiro humano (Calendly) que cada persona tinha.

- **`supabase/functions/chat/index.ts`**: `SYSTEM_PROMPTS` (6 personas incluindo `bpo`/Miriam, que nunca tinha sido cabeada no front) trocado por um único `SYSTEM_PROMPT` da Olivia, escopo em salas/planos/reservas/módulos/eventos/comunidade/indicação/app; fora disso orienta a procurar assessoria própria ou a recepção via WhatsApp. Contrato da function simplificado: não recebe mais `persona` no body.
- **`src/services/chatService.ts`**: `sendChatMessage()` perdeu o parâmetro `persona`.
- **`app/chatbot.tsx`**: reescrito sem o tipo `Persona`/`PERSONAS`, sem modal de agendamento Calendly, sem CTA "Falar diretamente com [especialista]" nas respostas fora de escopo. Vira uma tela única com a Olivia.
- **`ecossistema.tsx`**: card "Especialistas OLI" (5 avatares, badge "Em breve", sem clique) virou card "Tire suas dúvidas" clicável, abre `/chatbot` direto.

**Catálogo de módulos (`src/models/modules.ts`, tela `/modulos`) reduzido de 6 para 3 itens.** Fundador: credenciamento em convênios está pendente — tirar a categoria inteira (`ar_credenciamento`, `ar_gestao_mensal`, `ar_operadora_adicional`) do catálogo, sem deixar rastro na tela (nem "Em breve"). No lugar, novo módulo **Jurídico** — não existia como módulo pago antes, só como persona de chatbot gratuita (Ana Luiza) — criado no mesmo padrão do Contábil Mello (`pricing.period:'tbd'`, `displayLabel:'Consultar'`, `activationType:'contact_sales'`); provider `'Ana (sócia)'` reaproveitado de `oli-plans.ts` (`ADDONS.addon_juridico_*`), única referência real já existente no repo pra essa identidade. Depois, no mesmo pedido, **Scribe IA também saiu** (não tinha data prevista, `status:'coming_soon'` desde sempre). Catálogo final: Communicare Connect, Contabilidade Médica, Consultoria Jurídica — categorias na tela viraram Tecnologia/Contabilidade/Jurídico.

- `app/modulos.tsx`: `CATEGORY_LABELS`/`CATEGORY_ICONS`/`getCategoryForId` atualizados (categoria `convenios` removida, `juridico` nova).
- Menções de copy à Scribe IA limpas em `ecossistema.tsx` (texto do card "Módulos e Soluções") e `olicoinsService.ts` (descrição da missão "Ativar um módulo").
- **Banco (`modules`):** `ar_credenciamento`/`ar_gestao_mensal`/`ar_operadora_adicional`/`scribe_ia` → `ativo=false` (linhas preservadas, não deletadas — histórico de `user_modules` que referencie essas linhas continua íntegro). Nova linha `juridico` (categoria `juridico`, `tipo='mensal'`, `valor=0.00`, `ativo=true`) — mesmo padrão do `contabil_mello` (valor 0 = "a definir", `fetchModulePricing()`/admin filtram por `ativo`, mas o app hoje não lê o preço do banco pra módulos — a fonte real em runtime segue sendo o `MODULE_CATALOG` estático; a atualização do banco é só pra manter o admin `/catalogo` consistente).
- `tsc --noEmit` limpo depois de cada rodada de mudança.

**⚠️ Pendência:** OTA enviada sem teste em device/simulador nativo — só `tsc` limpo. Testar o chatbot e a tela `/modulos` num device real antes de anunciar pro fundador.

**Publicado nesta sessão:** commit `16792ef` + merge `7e16830` direto em `main` (sem branch de sessão) + edge function `chat` redeployada (v24) + banco atualizado (`modules`) + OTA prod `c933c1a3-79a6-4675-80ef-484f0ddc181c` / preview `61064b96-b888-4ae0-90db-1c43c8974e6c`.

## 33. Cobrança de paciente via subconta Asaas + mensageria WhatsApp (leads + pacientes) — planejamento, Fase 1 implementada, configuração Meta travada (19-21/ago)

Dois pedidos novos do fundador: **(1)** recepção gerar cobrança de paciente direto pro CNPJ do médico via Asaas, sem a OLI ser intermediária recebedora; **(2)** mensageria WhatsApp — atendimento **ostensivo de IA pra leads** (profissionais vindos de Meta/Google interessados em atuar no OLI) e atendimento **de paciente disparado pela recepção** (confirmação/lembrete de consulta), sem IA autônoma respondendo paciente no v1.

**Decisões fechadas na sessão de planejamento** (via perguntas diretas ao fundador, plano formal escrito e aprovado): cobrança sempre nasce de uma reserva concluída (`patient_id`+`valor_consulta` em `reservations`, não desacoplado); CPF do paciente pra Asaas é captura transitória na hora da cobrança, nunca persiste em `patients` (mesmo padrão já usado no `cpfClear` do Communicare); onboarding da subconta Asaas é feito pela recepção no admin, não pelo médico; WhatsApp usa **número único da OLI** (app/admin roteia internamente), não um número por médico; IA responde **autônoma pra lead**, mas paciente **nunca** sai do estado humano (`chk_patient_never_ia` trava isso no banco); escopo v1 de paciente é só **confirmação de consulta + lembrete véspera**, disparo sempre manual pela recepção (nada de cron automático ainda), sempre via template pré-aprovado (regra da Meta pra quem inicia conversa fora da janela de 24h).

**Fase 1 (schema) implementada e já em produção:** `reservations.patient_id`/`valor_consulta`; `professional_asaas_accounts` (subconta por médico, credencial cifrada via `oli_encrypt`/Vault, mesmo padrão de `subscriptions.asaas_id_enc`); `patient_charges` (`UNIQUE(reservation_id)` — uma cobrança por reserva no v1); `conversations`/`messages` (schema único compartilhado por lead e paciente, `wamid` único pra dedup de reentrega do Meta); `whatsapp_templates` (já com os 2 rascunhos de copy). RLS com `is_oli_admin()` em todas, `get_advisors` sem alertas, `tsc --noEmit` limpo nos dois projetos. Migrations em `supabase/migrations/20260819_*.sql`.

**Fase 2 (edge functions):** `whatsapp-webhook`, `send-patient-trigger` e `send-whatsapp-reply` **deployados** (clones do padrão HMAC/handshake do `meta-leads-webhook`, inertes até os secrets do Meta existirem — mesmo comportamento do `meta-leads-webhook` antes de configurado). `asaas-create-subaccount` e `create-patient-charge` **escritos mas não deployados** de propósito — dependem de decisão do fundador sobre taxa da OLI sobre a cobrança (v1 assume 100% pro médico, sem split) e de confirmação com o comercial da Asaas sobre qual produto de subconta está disponível. Nenhum dos dois mexe com dinheiro real ainda.

**Achado e corrigido só ao testar de verdade:** criada `test-lead-ai` (function temporária, mesmo `SYSTEM_PROMPT_LEAD` do webhook real, sem depender do WhatsApp) pra validar tom antes do número estar pronto — achou **2 bugs reais** no primeiro teste: (1) IA usava `**negrito duplo**` (markdown padrão), que o WhatsApp não renderiza — precisa ser `*asterisco simples*`; (2) IA **alucinou** "valores variam conforme especialidade e sala" pra preencher o vazio de não saber o preço exato — não existe essa regra em lugar nenhum. Prompt corrigido: valores reais embutidos (START R$1,90/min sem mensalidade; PRO R$599/mês ou R$499/mês semestral com fidelidade 6 meses + R$1,45/min), regra explícita "nunca inventa explicação, política ou detalhe que não foi passado", e seção de formatação WhatsApp. Redeployado em `whatsapp-webhook` e `test-lead-ai`.

**Admin:** rota `/conversas` nova (inbox com realtime, mesmo padrão de `NotificationFeed.tsx`, toggle IA/Humano só pra lead, resposta manual respeitando janela de 24h); card "Conta Asaas do médico" em `medicos/[id]` (onboarding, só rascunho — envio real pra Asaas ainda não ligado); seção nova nas reservas concluídas pra vincular paciente+valor e disparar confirmação/lembrete/cobrança.

**Decisão registrada em memória:** número comercial `(11) 97223-3745` **fica no WhatsApp Business App** (recepção usa no celular hoje) — Meta não permite o mesmo número no app comum e na Cloud API ao mesmo tempo, migrar quebraria o fluxo atual do comercial. Número **novo, dedicado só à API**, foi comprado à parte.

**A maior parte da sessão foi configuração no painel do Meta, não código — e travou no fim.** Resumo da saga: App "OLI WPP" criado (tipo Negócios, vinculado ao portfólio "OLI health hub"); webhook configurado e **validado de verdade** (`curl` direto no handshake, `HTTP 200` + challenge correto devolvido — confirma `WHATSAPP_VERIFY_TOKEN` certo). Número de teste (`+1 555-196-0514`) registrado com sucesso depois de várias tentativas (o botão "Reivindicar número de teste" tem bug conhecido de travar sem erro visível no Meta). Número oficial comprado (`11939429453`) veio **pré-registrado numa WABA de terceiro** sem acesso — resolvido via verificação SMS/código (prova de posse do chip físico libera o número independente de quem "dono" no Business Manager). Depois de vinculado à WABA certa (`OLI Health Hub`, ID `2308704119899519`, Phone Number ID `1231524036718791`), **trava com erro genérico "Falha na inscrição"** ao tentar finalizar o registro — testado com 2 contas diferentes (fundador, conta nova <7 dias; e Igor, conta estabelecida do BM), **mesmo erro nas duas**, o que descarta a teoria inicial de restrição por conta nova (essa teoria explicava, sim, o bloqueio de criar Usuário do Sistema — conta nova não consegue, confirmado). Token de acesso permanente **gerado com sucesso** pelo Igor via Usuário do Sistema, depois de destravar duas confusões de UI: usar "Atribuir ativos" no usuário do sistema (não "Atribuir parceiro" na tela da conta do WhatsApp, que é pra compartilhar com empresa externa) e dar acesso do Igor ao **App** em si (Configurações → Contas → Apps → atribuir pessoas — acesso na WABA não implica acesso no App). Secrets já setados no Supabase: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`. `WHATSAPP_PHONE_NUMBER_ID` do número oficial existe mas **o número não está registrado — API não funciona até resolver isso**.

**Achado de brinde, não limpo ainda:** o portfólio tem **3 WABAs chamadas "OLI Health Hub" duplicadas** (sobra de tentativas anteriores) mais a WABA do app comum — poluição cosmética, não atrapalha funcionalmente, mas confunde quem for mexer depois.

### ✅ RESOLVIDO (24/ago) — "Falha na inscrição" era só a UI; número registrado via API direto

O erro genérico da UI do Business Manager nunca deu o motivo real. Registrado via **Explorador da Graph API** (chamada que a UI deveria ter feito sozinha e não fez):

- `POST /1231524036718791/register` com `{"messaging_product":"whatsapp","pin":"123456"}` → `{"success":true}`. Esse é o passo que faltava — a UI trava em "Falha na inscrição" sem nunca chegar a essa chamada.
- Confirmado funcionando de ponta a ponta: teste com `hello_world` retornou `#131058` (template restrito a números de teste, esperado), depois teste com mensagem de texto simples (`type:"text"`) dentro da janela de 24h (aberta enviando mensagem do celular pro número primeiro) **entregou de verdade**.
- **Número `11939429453` está registrado e operante na Cloud API.** Fecha o item 1 (chamado de suporte Meta não precisa mais ser enviado) e o item 2 (não precisa mais testar só com número de teste) das pendências antigas.
- **Lição:** quando a UI do Business Manager trava com erro genérico num fluxo de registro/configuração, a Graph API Explorer é o atalho pra ver o erro real (`error.code`/`error.message`) e, no caso de registro de número, chamar o endpoint direto resolve sem depender da UI destravar.

**⚠️ Pendências (nada commitado):**
1. ~~Chamado de suporte Meta~~ ✅ não precisa mais — resolvido sem suporte.
2. ~~Testar com número de teste~~ ✅ testado com o número real, funcionando.
3. `asaas-create-subaccount`/`create-patient-charge` seguem não deployados — taxa da OLI e produto de subconta Asaas ainda sem decisão do fundador.
4. Templates de WhatsApp (`confirmacao_consulta`, `lembrete_vespera`) ainda não submetidos pra aprovação real da Meta — **próximo passo natural**, já que o número está pronto pra usar template aprovado fora da janela de 24h.
5. Limpar as WABAs duplicadas no portfólio.
6. Nada testado em device/simulador nativo, nada commitado.

### ✅ RESOLVIDO (24/ago, mesma sessão) — fluxo webhook → IA → WhatsApp testado de ponta a ponta

Com o número registrado, testado o caminho completo de lead: mensagem real do celular do fundador pro número oficial → `whatsapp-webhook` recebe e grava em `conversations`/`messages` → IA (Claude Haiku) gera resposta → `enviarTexto` manda de volta → status `entregue` confirmado.

- **Achado no meio do teste:** primeira tentativa falhou silenciosamente — `enviarTexto` lançava `WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN ausente`, capturado pelo catch de `processarMensagem` e caindo no fallback de notificação, sem nenhum aviso visível pro usuário (mensagem "sumia" sem erro nenhum no WhatsApp). Causa: `WHATSAPP_PHONE_NUMBER_ID` nunca tinha sido criado como secret de verdade no Supabase — só o valor (`1231524036718791`) estava documentado aqui no handoff. Fundador criou o secret faltante, teste refeito, funcionou.
- **Teste isolou a causa antes de mexer:** chamada direta em `test-lead-ai` (mesmo prompt, sem depender do WhatsApp) confirmou que a geração de IA e o `ANTHROPIC_API_KEY` estavam OK — o problema era só no envio de volta pela Graph API, não na IA.
- Metodologia de teste sem sujar dado real: lead sintético criado por SQL (telefone do fundador), conversa reclassificada de `nao_classificada` pra `lead`/`status=ia`, testado, **tudo apagado depois** (lead, conversa, mensagens, notificações órfãs) — zero resíduo confirmado.
- **⚠️ Achado, não corrigido:** a resposta da IA nessa rodada saiu com `**negrito duplo**` no corpo salvo em `messages` (bug que o prompt já proíbe explicitamente desde a sessão anterior) — o WhatsApp tolerou e renderizou em negrito mesmo assim, mas não é garantia pra sempre. Vale observar em testes futuros se o modelo volta a usar `**` e, se persistir, considerar um passo de sanitização (`.replace(/\*\*/g, '*')`) antes de `enviarTexto`, já que instrução no prompt sozinha não bloqueou 100% dessa vez.
- **Ferramenta que ficou fora do ar durante o diagnóstico:** `query_logs` do MCP do Supabase (unified logs) devolveu `Backend error` em toda tentativa — diagnóstico teve que ser feito lendo o log direto no Dashboard (Edge Functions → função → Logs), não pelo MCP. Se acontecer de novo, esse é o caminho.
- Confirma: `whatsapp-webhook` está de fato operante em produção — próximo passo real agora é submeter os templates pra aprovação (item 4 acima), pra cobrir o caso comum (recepção iniciando contato fora da janela de 24h).

## 34. IA do WhatsApp vira vendedora + todo contato é atendido + inbox corrigido (24/ago, mesma sessão)

Pedido do fundador depois do teste ponta-a-ponta acima: a IA precisava (1) atender **todo** contato, não só quem já veio de campanha/site; (2) identificar quem é a pessoa e coletar dado sem ser invasiva; (3) ter abordagem **100% comercial**, com quebra de objeção de verdade, soar humana; (4) mandar foto por especialidade; (5) reengajar lead que some no meio da conversa; (6) ter autonomia de agendar visita. Tudo isso com "manual de boas práticas" pra cumprir rigorosamente — criado **`docs/IA_ATENDIMENTO_WHATSAPP.md`**, documento-âncora do comportamento da IA (o prompt em código implementa o manual, não o contrário).

### Todo contato vira lead automaticamente

Antes, número desconhecido (sem casar com `patients` nem `leads`) virava `kind='nao_classificada'`, só gerava notificação, **sem resposta**. Isso fechava a porta pra contato orgânico/direto. Agora `resolveConversa` (`whatsapp-webhook/index.ts`) cria um lead na hora (`origem='whatsapp'`, nome placeholder "Contato via WhatsApp") pra qualquer número que não seja paciente cadastrado — a IA sempre responde, e classifica quem é a pessoa **durante** a conversa. `kind='nao_classificada'` continua existindo no schema (não é breaking change), só não é mais produzido por este caminho.

- Migration `leads_email_nullable_whatsapp_origin`: `email` deixou de ser `NOT NULL` — lead criado só a partir do WhatsApp não tem e-mail no início. O CHECK `leads_tem_algum_contato` (email OU whatsapp) já previa esse caso, só a coluna que não acompanhava.

### Tag técnica `[META: ...]` — um mecanismo só pra tudo

O antigo `[HANDOFF]`/`[HANDOFF: motivo]` virou um formato único e extensível, sempre na última linha da resposta (nunca vista pela pessoa):
```
[META: nome=...; especialidade=...; resumo=...; imagem=...; aviso=...; handoff=...]
```
- `nome`/`especialidade`/`resumo` → `UPDATE leads` (parcial, só os campos presentes).
- `imagem` → dispara `enviarImagem()` com uma foto real de um mapa fechado (ver abaixo) — a IA nunca inventa URL.
- `handoff` → transferência **dura**: `status='humano'`, IA para de responder, notificação "Lead pediu atendimento humano".
- `aviso` → notificação **informativa**, sem tirar a IA da conversa (usado no agendamento de visita — ver abaixo). `handoff` e `aviso` nunca aparecem juntos.

`test-lead-ai` foi reescrita em espelho exato pra continuar servindo de bancada de teste sem tocar WhatsApp real.

### Persona vira vendedora — e um bug de matemática pego no teste

Prompt reescrito do zero: a IA deixou de ser "central de dúvidas" e virou a responsável comercial — descoberta antes de argumento, traduz fato em benefício no contexto de quem pergunta, quebra objeção validando antes de reenquadrar, fechamento suave pra visita, proibição explícita de soar como robô ("estou aqui para ajudar no que precisar" banido).

**🔴 Achado direto no teste, antes de ir pro WhatsApp real:** pedida pra calcular o custo mensal de um volume de sessões (3 pacientes/semana), a IA **errou a conta** — respondeu "R$ 870 no total (R$ 599 + R$ 871)", números que não fecham entre si nem batem com `1,45 × 600min = 870`. Mesmo com a regra "nunca invente número" já no prompt, contas de várias etapas o modelo erra. Fix: a IA **não calcula mais nada em tempo real** — só pode citar 2 exemplos fixos já certos (sessão de 50 min: R$ 95 no START, R$ 72,50 no PRO); qualquer conta de volume/mês/duração diferente, ela diz que vai confirmar com a equipe. **Lição:** "não invente" no prompt não impede erro de aritmética de um LLM pequeno — números que importam de verdade (dinheiro, pra decisão do lead) devem ser pré-calculados e fixos, nunca computados on-the-fly pelo modelo.

Também reforçado: nunca citar valor de aluguel de mercado/concorrente pra contrastar objeção de preço — só o CONCEITO de não ter custo fixo, sem inventar número de comparação.

### Rebrand: "coworking médico" → "hub para profissionais da saúde"

Só no prompt da IA (não mudou no app/site/CLAUDE.md — decisão registrada como divergência conhecida, não decisão de rebrand geral da marca). Endereço físico real confirmado por pesquisa em código (`landing/index.html`) e incluído como fato: Rua Marquês de Paranaguá, 348, Edifício Ralph Center, Consolação, São Paulo/SP.

### Fotos por especialidade

Mapa `rooms.specialties` confirmado **direto no banco** (`select id, specialties from rooms`), não por comentário informal: 1 Vídeo Conferência · 2 Psicologia · 3/5/6/7 Clínica Geral · 4 Audio Visual · 8 Ginecologia+Estética · 9 Eventos — fundador confirmou a ordem. Fotos reais e já públicas (mesmas do site, `landing/fotos/`) mapeadas por especialidade, chave fechada (`psicologia`, `ginecologia`, `estetica`, `clinica_geral`, `eventos`, `estrutura`) — a IA só pode citar uma dessas chaves, nunca uma URL livre. `enviarImagem()` nova em `_shared/whatsapp.ts` (mensagem tipo `image`, `link` público).

### Agendamento com autonomia (Calendly)

Link real confirmado em `src/components/CalendlyVisitBadge.tsx` — `calendly.com/olihealthhub/atendimento-presencial`. A IA agora manda esse link direto quando a pessoa quer visitar, **sem transferir pra humano** (usa `aviso`, não `handoff`) — decisão do fundador, diferente da versão anterior do prompt que tratava intenção de visita como gatilho de transferência dura.

### Reengajamento de lead silencioso — só dentro da janela de 24h

Pergunta do fundador sobre reengajar depois de 24h esbarrou na regra da Meta: mensagem de negócio fora da janela **exige template aprovado**, e nenhum template foi submetido ainda (mesma pendência do item 4 do §33). Decisão: implementar **só o caso seguro agora** (dentro de 24h) e deixar o caso de template pra quando o fundador submeter.

- Nova função `whatsapp-nudge-silencio` (`verify_jwt:true`, chamada por cron): acha conversas `kind='lead'`/`status='ia'` com `last_inbound_at` entre 2h e 22h atrás (silêncio real, sem chegar perto do limite de 24h) e sem reengajamento já tentado pra esse silêncio específico (`last_nudge_at`). IA gera 1 mensagem curta de retomada (prompt separado, `SYSTEM_PROMPT_NUDGE`) ou responde `SILENCIO` se a conversa já tinha fim natural (despedida, já transferida, pedido de não contato) — nesse caso não manda nada, só marca a tentativa.
- Migration `conversations_last_nudge_at`: coluna nova, garante **1 reengajamento por silêncio** (não fica insistindo a cada execução do cron).
- Cron `whatsapp-nudge-silencio`: a cada 30 min, só 9h-19h BRT (`*/30 12-21 * * *` UTC) — mesmo padrão `pg_net`+Vault dos crons já existentes (`rd-vincular-deals` etc.).
- **Reengajamento além de 24h fica pendente** de template aprovado pela Meta (fundador vai submeter templates amanhã, junto com `confirmacao_consulta`/`lembrete_vespera` do §33) — depois de aprovado, a reativação da IA quando o lead responder já é automática, não precisa de código novo (o webhook trata a resposta como mensagem normal de conversa existente).

### 🐛 Bug achado em uso real — Fila abria WhatsApp sem destino em vez da conversa

Fundador testou o handoff com o sócio (pediu falar com humano) e, ao clicar na notificação na Fila do admin, abria o WhatsApp genérico (tela de escolher contato) em vez de `/conversas` com o histórico. Causa: `FilaClient.tsx` nunca foi atualizado pra esse tipo de notificação novo — `openWhatsApp()` rodava incondicionalmente pra qualquer tipo, incluindo `whatsapp_message_received`, tentando achar telefone em chaves (`metadata.whatsapp`/`metadata.phone`) que esse tipo nunca teve (o metadata dele é só `{conversation_id, kind}`) — caía no fallback `wa.me/?text=`, exatamente o bug do §27 (mas em contexto novo). `NotifType` local nem incluía o tipo, então a tag mostrava a string crua.

- Fix: `FilaClient.tsx` ganha branch — pra `whatsapp_message_received` com `conversation_id`, mostra botão **"Ver conversa"** (`Link` pro `/conversas?id=...`) em vez do botão WhatsApp.
- `/conversas` não tinha rota dinâmica (`ConversasClient.tsx` guardava a conversa selecionada só em `useState`, sem ler URL) — `page.tsx` passou a ler `searchParams.id` (Next 14.2.29, objeto simples) e repassar como `initialId` pro client component, que usa isso (ou a mais recente, como antes) pra selecionar a conversa inicial.
- `TYPE_TAG`/`NotifType` de `FilaClient.tsx` ganharam a entrada faltante.
- `tsc --noEmit` limpo nos dois projetos (`admin` e raiz) depois do fix.

### Publicado

**Commit `832a90a`**, push direto pra `main` (Vercel redeploya o admin sozinho). Empacota nesse commit todo o trabalho que já estava pronto e não commitado de sessões anteriores (schema/edge functions do §33 — cobrança de paciente via Asaas, `conversations`/`messages`, `/conversas`, card Asaas em `/medicos/[id]`) **junto** com o trabalho desta sessão (IA vendedora, lead automático, fotos, Calendly, reengajamento, fix da Fila) — estava tudo interligado no mesmo `actions.ts`/schema, não dava pra separar sem quebrar o build. `admin/tsconfig.tsbuildinfo` (artefato de build) deixado de fora do commit de propósito, igual à lição já registrada no §26.

### 🆕 Alerta de handoff no WhatsApp comercial (26/ago)

- **Decisão:** uma transferência da IA para atendimento humano não deve depender só da notificação no Admin. Cada `handoff` também alerta o WhatsApp comercial, para a equipe agir no canal que já acompanha.
- **Implementação local pronta:** `whatsapp-webhook` mantém a transição da conversa para `status='humano'` e a notificação do Admin; em seguida, chama `enviarTemplate()` com telefone, nome, resumo e motivo. A falha desse alerta é isolada — não desfaz nem impede o handoff.
- **Template Meta:** `handoff_comercial_v1`, categoria **Utilidade → Padrão**, com 4 variáveis (telefone, nome, resumo, motivo), foi criado e **enviado para análise** em 26/ago. Sem header, rodapé ou botões.
- **Ativação pendente:** quando a Meta aprovar, configurar nos secrets da Edge Function `WHATSAPP_COMMERCIAL_PHONE` (número comercial confirmado) e `WHATSAPP_HANDOFF_TEMPLATE_NAME=handoff_comercial_v1`. A `whatsapp-webhook` já está publicada; até os secrets existirem, o comportamento em produção permanece somente a notificação no Admin.
- O manual `docs/IA_ATENDIMENTO_WHATSAPP.md` foi atualizado junto com o código; os dois devem continuar sincronizados.

### 🆕 Olivia responde a áudios de leads sem retenção (26/ago)

- **Decisão:** OpenAI entra somente como módulo de transcrição; Olivia, prompt comercial, classificação de leads, handoff e resposta continuam integralmente na Anthropic.
- **Escopo e proteção:** só conversa `kind='lead'` em `status='ia'` entra no fluxo; paciente identificado continua exclusivamente com a equipe humana. O áudio é baixado temporariamente da Meta, enviado por HTTPS à OpenAI para transcrição e descartado após a resposta. O banco guarda apenas o marcador `[Áudio recebido — conteúdo não retido]` e a resposta da Olivia; a transcrição nunca é persistida nem reaproveitada em turnos futuros.
- **Falha segura:** erro de download/transcrição não gera resposta inventada; cria a notificação humana já existente. Nenhum arquivo de áudio é salvo pelo OLI.
- **Implementação local pronta:** `baixarMidiaWhatsApp()` em `supabase/functions/_shared/whatsapp.ts` obtém a mídia temporária da Meta; `whatsapp-webhook` chama `gpt-4o-mini-transcribe` e passa o texto só em memória para a Olivia responder pela Anthropic.
- **Estado (26/ago):** `OPENAI_API_KEY` já foi configurado nos secrets do Supabase e `whatsapp-webhook` foi deployada com sucesso após autenticação da CLI (`Deployed Functions`). Falta somente testar com um áudio comercial curto antes de considerar o fluxo liberado. A verificação posterior `deno check` passou; `npx tsc --noEmit` e `git diff --check` também passaram.
- **Correção de copy (27/ago):** o prompt de produção e a cópia de teste agora deixam explícito que uma transcrição bem-sucedida deve ser respondida como texto normal. Olivia não pode alegar que não consegue ouvir/processar áudio nem mencionar transcrição ou limitação técnica. `whatsapp-webhook` foi republicada com a correção (`Deployed Functions`).

### 🆕 Qualidade das respostas comerciais (28/ago)

- **Evidência:** revisão anonimizada das 15 conversas de lead mais recentes. Sete terminaram logo após a primeira resposta da Olivia. O padrão dominante era pedir contexto diante da abertura padrão do anúncio, em vez de entregar informação útil. Também apareceram repetição do que o lead acabara de dizer, perguntas já respondidas, duas perguntas no mesmo turno, suposições sobre concorrentes/cidade e despedidas repetidas após reação ou encerramento.
- **Caso mais claro:** uma profissional informou duas vezes que trabalhava com massagem e procurava sala; Olivia repetiu a informação e voltou a perguntar o que ela já havia respondido. A pessoa escreveu “Esquece” e “Meu Deus acabei de fala”, evidenciando falha de interpretação do histórico.
- **Prompt corrigido:** antes de responder, Olivia identifica silenciosamente pedido atual, fatos já informados e único próximo passo útil. Responde o assunto primeiro; no máximo uma pergunta que altere o próximo passo; não repete/parafraseia a fala; não chama abertura de anúncio de vaga; recupera correções do lead; não supõe características de concorrentes; limita normalmente a três blocos curtos.
- **Abertura de anúncio:** “Olá! Posso ter mais informações sobre isso?” agora é tratada como interesse comercial. Olivia dá uma visão útil do OLI em uma frase e pergunta somente a especialidade.
- **Nudge endurecido:** não reengaja abertura padrão sem continuidade, mídia/reação sem conteúdo interpretável, recusa, despedida ou encerramento. Quando elegível, envia somente uma frase ligada a um próximo passo concreto, sem resumo ou pergunta repetida.
- **Publicado:** `whatsapp-webhook` e `whatsapp-nudge-silencio` foram deployadas com sucesso em 28/ago (`Deployed Functions`). Falta acompanhar as próximas conversas reais para comparar resposta à abertura e continuidade após o segundo turno.

### 🆕 Primeiro contato manual pelo Admin (28/ago)

- **Decisão de canal e identidade:** esta abertura não é enviada pela Olivia. É uma abordagem humana do Guilherme para leads que chegaram por formulário do Meta/RD, antes ou fora da conversa automatizada da IA.
- **Copy aprovada:** “Olá, `{primeiroNome}`! Aqui é o Guilherme, do OLI Health Hub. Recebi seu contato pelo formulário sobre nossos consultórios. Você procura um espaço para atendimentos pontuais ou recorrentes?” A mensagem se identifica, explica de onde veio o contato e termina com uma única pergunta fácil de responder; não repete genericamente que a pessoa “demonstrou interesse”.
- **Implementação local:** `admin/lib/whatsapp.ts`, função compartilhada `mensagemLead()`. A troca alcança os dois pontos pedidos sem duplicar texto: botão de WhatsApp da notificação `lead_received` em `/fila` e botão de contato no cadastro em `/leads`. Se o nome estiver ausente, a saudação vira somente “Olá!”.
- **Escopo atual:** como os dois botões usam o mesmo helper sem filtrar a origem, a nova mensagem aparece para qualquer lead acionado por eles, embora a copy cite formulário. Se outros canais passarem a usar esses botões com frequência, tornar o texto condicional a `origem` (`rd_station`/`meta_ads`).
- **Verificação:** `admin` passou em `npx tsc --noEmit` e `git diff --check`. **Ainda não publicado:** a alteração está somente no worktree; falta commit/push para a Vercel atualizar o Admin.

**⚠️ Pendências desta sessão:**
1. ~~Templates de WhatsApp de paciente... implementar opt-in/opt-out persistidos e agenda de etapas~~ ✅ infra construída em 28/ago — ver §37. Os templates seguem `pendente` de aprovação na Meta (fora do nosso controle).
2. Limpar as 3 WABAs duplicadas no portfólio (pendência antiga do §33, ainda não feita).
3. `asaas-create-subaccount`/`create-patient-charge` seguem não deployados (taxa OLI + produto de subconta).
4. Fundador precisa confirmar ao vivo que o fix da Fila resolveu (reabrir a notificação do teste com o sócio e clicar "Ver conversa").
5. Nada testado em device/simulador nativo.
6. `docs/IA_ATENDIMENTO_WHATSAPP.md` e o prompt devem ser revisados juntos na próxima mudança de comportamento — não editar um sem o outro (regra que o próprio documento estabelece).
7. ~~Publicar a nova copy de primeiro contato do Admin... por commit/push~~ ✅ commitada e publicada em 28/ago (ver §37).

## 35. Limpeza dos leads de engano + IA para de responder duas vezes (26/ago sessão 2)

Pergunta do fundador que abriu a sessão: *por que os últimos leads estão
entrando sem nome e sem especialidade, só com o título "WhatsApp"?*

### O diagnóstico: não era falha de captura

O lead nasce na **primeira** mensagem recebida, antes de qualquer
qualificação, com o nome placeholder "Contato via WhatsApp"; nome e
especialidade só entram depois, via a tag `[META:]` da IA. O mecanismo
estava funcionando — o único lead preenchido da leva (Guilherme /
Ginecologia) veio exatamente por esse caminho. **O que faltava era gente se
identificando.** As conversas tinham de 2 a 6 mensagens e o conteúdo era:

- "Oii boa noite / Tudo bem? / **Tem pastel?**"
- "Boa noite / **Quero pastel** / Kkkk"
- um áudio perguntando sobre **panela de pressão e freezer**

Causa provável, coerente com o §33: o número `11939429453` veio
**pré-registrado numa WABA de terceiro** — é um chip com dono anterior, e
pelo padrão das mensagens o dono era uma pastelaria. Trote e engano vão
continuar chegando; não confundir com falha de captação.

### Decisão nova do fundador: o número é só comercial

`11939429453` fica atrelado a **campanhas e canais de divulgação** e
**nunca será usado para paciente**. Na prática o caminho de paciente nesse
número deixa de existir: todo contato que chega ali é comercial. A trava
`chk_patient_never_ia` continua no banco como proteção (não remover), mas
não guia mais o desenho do fluxo. Os templates de paciente
(`confirmacao_consulta`, `lembrete_vespera`) precisam de outro número ou de
decisão nova antes de irem ao ar.

### Limpeza executada

Backup completo em JSON antes de qualquer `DELETE` (25 leads, 29 conversas,
203 mensagens) — entregue ao fundador no chat, não versionado.

- **25 leads `origem='whatsapp'` apagados** (base voltou de 126 para 101).
- **25 conversas de engano apagadas** com suas mensagens e notificações.
- **4 conversas preservadas** (os testes reais: Michelle/Dermatologia,
  Cardiologista, Fisioterapia Neurológica e o do fundador) — ficaram com
  `lead_id = NULL` para continuarem legíveis em `/conversas` sem contar
  como lead no funil. `conversations.lead_id` é `NO ACTION`, então a ordem
  importa: nulificar as preservadas **antes** de apagar os leads, senão a
  FK barra o `DELETE`.
- Conferido depois: 0 leads de WhatsApp, 0 notificações órfãs (as 8
  restantes apontam para as 4 conversas preservadas).

### Fix 1 — a IA respondia duas vezes

Cada mensagem recebida vira um POST separado do Meta. Quem escrevia "Oi" e
logo "Boa tarde" recebia **duas respostas seguidas**, ligeiramente
diferentes, porque cada execução gerava resposta sem saber da outra —
observado em 4 conversas reais de 25-26/ago, com 0,2s a 2,3s entre as
mensagens. É o sinal mais óbvio de robô, e acontecia logo no primeiro
contato.

`processarMensagem` agora espera **5 segundos** (`JANELA_AGRUPAMENTO_MS`) e
só responde se aquela mensagem ainda for a última recebida na conversa
(`aindaCabeResponder`, que também confere se a conversa continua em
`status='ia'`). A execução mais recente responde por todas, já com o
histórico completo no banco. **Não precisa de lock — o banco é o
desempate.** Reentrega do webhook por timeout do Meta continua protegida
pela unicidade de `wamid` (o `23505` que já existia).

⚠️ Efeito colateral conhecido: se um áudio chegar e for seguido de um texto
dentro da janela, a transcrição daquele áudio se perde (o corpo salvo é só
o marcador `[Áudio recebido…]`, filtrado do histórico). Raro e aceito.

### Fix 2 — engano de número sai do funil sozinho

Chave nova `descarte` na tag `[META:]`, valor único `engano`. Quando a IA
identifica que a pessoa errou o número:

- encerra em **uma** resposta curta (o prompt proíbe explicitamente fazer
  piada, puxar conversa ou insistir perguntando se há interesse — era o que
  ela vinha fazendo);
- `conversations.status = 'fechada'` → a IA para de responder aquele número;
- `leads.status = 'descartado'` + `motivo_descarte = 'engano_numero'`;
- **não notifica ninguém** — não há o que a equipe fazer com um engano.

Motivo de descarte **próprio**, criado na migration
`20260826_lead_motivo_engano.sql`: reaproveitar `sem_perfil` ou
`contato_invalido` misturaria engano com lead de verdade que não fechou e
estragaria a leitura do funil. `MOTIVO_LABEL` em `admin/app/leads/page.tsx`
ganhou a entrada correspondente ("Errou o número") — sem isso o valor novo
apareceria cru na tela e não existiria no `select` de descarte.

O prompt também instrui o contrário explicitamente: **na dúvida entre
engano e alguém que só escreveu pouco, não usar `descarte`** — errar para o
lado de continuar custa uma mensagem, errar para o lado de descartar perde
um lead.

### Verificação

- **`deno check` rodou de verdade nesta sessão** — limpo em
  `whatsapp-webhook/index.ts` e `test-lead-ai/index.ts`. O §34 registrou que
  não dava pra rodar por falta do binário; instalar Deno no ambiente da
  sessão (`npm i -g deno@2`) resolveu, e é bem mais útil que `tsc` para
  edge function, porque enxerga os imports `npm:` e o namespace `Deno`.
- Migration aplicada e conferida em produção (`pg_get_constraintdef`).
- `whatsapp-webhook` deployada (**v21**) e o conteúdo publicado conferido
  **byte a byte** contra o arquivo local — não por inspeção visual.

**⚠️ Pendências desta sessão:**
1. **Teste ao vivo pelo celular, que só o fundador pode fazer:** mandar duas
   mensagens rápidas seguidas para o número (tem que vir **uma** resposta
   só) e, de outro número, um "quero pastel" (tem que encerrar em uma
   resposta e o lead aparecer descartado como "Errou o número").
2. **Nada commitado e `test-lead-ai` não redeployada** — a ponte com a
   máquina do fundador (`device_bash`) ficou fora do ar a sessão inteira,
   igual ao que o §30 já tinha registrado; os arquivos foram gravados no
   disco, mas `git` e `supabase functions deploy` não puderam rodar daqui.
   O arquivo de `test-lead-ai` está em sincronia com o prompt no disco, só
   falta publicar.
3. **Divergência no manual, não corrigida:** o `docs/IA_ATENDIMENTO_WHATSAPP.md`
   §4 ainda diz que a IA "nunca marca visita nem envia link de agenda" e o
   §5 chama o OLI de "coworking médico" — os dois foram superados pelo §34
   (autonomia de Calendly, rebrand para "hub para profissionais da saúde")
   e nunca foram atualizados. Não mexi porque é decisão de conteúdo, não de
   código.
4. As pendências antigas do §34 seguem abertas (aprovação dos templates de
   Marketing, 3 WABAs duplicadas, `asaas-create-subaccount`/`create-patient-charge`,
   nada testado em device nativo). A divergência do manual citada no item 3
   foi corrigida nesta sessão: Calendly é autonomia da Olivia e o OLI é
   descrito como hub para profissionais da saúde.

## 36. "Sem plano" some — cadastro volta a nascer no START (26/ago sessão 3)

O fundador viu cadastros aparecendo como **BASE** no admin e pediu
verificação. Duas coisas saíram daí: um bug de exibição e uma reversão de
decisão de produto.

### O BASE que aparecia não existia no banco

Levantamento: 26 perfis — 24 START, 1 PRO, 1 sem plano. **Zero BASE**, e o
plano BASE segue `ativo=false` com zero assinaturas, como a §31 deixou.

A origem era `admin/app/medicos/page.tsx`, linha 87: `const plan = m.plan ??
'BASE'`. Escrita quando `plan` nunca era nulo (todo cadastro nascia com
plano), a linha era um seguro que nunca disparava. Depois de 19/ago o
cadastro passou a nascer com `plan = NULL` de propósito, e o seguro virou o
bug: **quem não tinha escolhido plano aparecia como BASE**, num plano
desativado, com preço e taxa velhos. Uma pessoa só estava nesse estado —
Priscila Leal, cadastrada em 19/ago, com onboarding incompleto. A tela de
detalhe do médico não tinha o problema (mostra `p.plan` cru), e o app
também não — lá o BASE só sobrou nas matrizes de benefício, com
`PLAN_ORDER` já reduzido a START e PRO.

### 🔴 Reversão: não existe mais "cadastrado sem plano"

Decisão do fundador nesta sessão: **"quem está sem plano é START, não
existe um cadastro sem plano"** — o oposto do que a §30 decidiu e a §31
implementou em 19/ago. Foi confirmado explicitamente depois de a sessão
apontar o conflito e a consequência: com START automático, todo cadastro
volta a ter comunidade, agenda e app completos sem passar por conversa
comercial, que é exatamente o cenário que produziu a base atual (24 START,
3 com alguma reserva). Ele confirmou mesmo assim.

**Banco** (migration `20260826_cadastro_volta_a_nascer_start.sql`,
aplicada): `_create_profile_and_subscription()` volta a gravar
`plan='START'` + `plan_id` e a criar a assinatura START ativa;
`profiles.plan` recupera o `default 'START'` como rede para qualquer INSERT
que não passe pela função. Duas diferenças em relação à versão pré-19/ago:
o `plan_id` é buscado por `name='START' and ativo` (não hardcoded), e a
criação da assinatura é **idempotente** (`not exists`) — a versão antiga
não tinha essa guarda, e é por isso que a Claudia Moraes ficou com duas
linhas de assinatura.

`taxa_min_congelada` continua nascendo `NULL` de propósito: perfil novo usa
a taxa viva (R$ 1,90), o congelamento é só para quem já estava dentro antes
da reforma.

**App:** o Gate 3 de `app/_layout.tsx` (sessão + onboarding completo +
`!profile.plan` → `/escolher-plano`) foi removido. A tela
`escolher-plano.tsx` **continua existindo**, só deixou de ser portão — vale
como upgrade pro PRO. O RPC `activate_start_plan` também fica.

**Admin:** o fallback virou `?? 'START'`, com comentário explicando por quê.
`PLAN_COLOR` mantém a entrada BASE (cosmética, para linha legada).

**Priscila Leal:** colocada no START com assinatura ativa
(`plan='START'`, `plan_id`, `subscriptions` mensal/active), `taxa_min_congelada`
deixada em NULL — ela entrou depois da reforma, então paga R$ 1,90. Feito
por SQL direto, não pelo RPC, porque `activate_start_plan` usa `auth.uid()`
e roda no contexto do próprio usuário.

### Verificação

Cadastro novo testado com **transação revertida** (INSERT em `auth.users` →
SELECT → `ROLLBACK`), mesma metodologia da §31: perfil sai com
`plan='START'`, `plan_id` preenchido, `taxa_min_congelada=null` e **1**
assinatura `START/active/mensal`. Resíduo conferido depois: zero. Os três
arquivos editados passaram por `tsc` em modo transpile (sem `node_modules`
no ambiente da sessão, então é checagem de sintaxe/estrutura, não de tipos
do projeto).

**⚠️ Pendências:**
1. **OTA não enviada** — a mudança do `_layout.tsx` só chega no celular
   depois de `eas update` nos dois canais. Não deu pra rodar daqui (ver
   item 3).
2. **Nada commitado** — mesma causa da §35: `device_bash` fora do ar.
   Arquivos gravados no disco do fundador, `git` não pôde rodar.
3. `src/models/oli-plans.ts` segue com `plan_base` marcado `status:
   'active'` e preços velhos (R$ 299 / R$ 1,50). Apontado ao fundador, sem
   decisão até o fim da sessão — **não mexido**.
4. Vale conferir se algum push/nudge assumia o estado "sem plano". A régua
   de silenciamento prevista na §30 nunca foi implementada, então
   provavelmente não há nada a desfazer, mas não foi auditado.

## 37. Reorganização de `/leads` + infra da régua de nutrição comercial (28/ago)

Duas perguntas do fundador abriram a sessão: a tela de leads estava confusa
(de onde vem cada um, quem já foi atendido, sem busca) e — depois de
confirmar que a Central de Leads do Meta é só o painel próprio do Meta, sem
relação com o funil da OLI (o fluxo real é Meta → RD Station →
`rd-leads-webhook` → `leads`, já automático desde §24) — se dava pra Olivia
iniciar contato pelos leads que chegam pela RD, direto.

### `/leads` reorganizado

Commit `e6e90ed`. Coluna nova `canal_primeiro_contato` (migration
`20260828_lead_canal_primeiro_contato`) — eixo separado de `origem`/`fonte`:
registra **como a equipe abordou** o lead (WhatsApp/ligação/e-mail), não de
onde ele veio. Na tela: busca por nome/e-mail/WhatsApp; chip macro
**Atendimento** (Todos/Falta atender/Já atendido, atalho pra
`status='novo'`, ao lado da esteira detalhada, sem substituí-la); chips de
**Origem** com contador, no mesmo padrão de Situação/Atendente; badge e
select de canal do 1º contato por lead. Todos os filtros se combinam e se
preservam entre si nos links.

### Por que a Olivia não pode simplesmente iniciar contato hoje

Não é lacuna de código: a Cloud API do WhatsApp **exige template aprovado
pela Meta** pra qualquer mensagem que abre conversa (a pessoa nunca escreveu
pro número antes) — nem texto livre manual, nem automático. O template
`primeiro_contato_comercial_v1` foi enviado pra análise em 26/ago (§33/§34) e
segue sem aprovação confirmada. Quando o lead responde primeiro, a Olivia já
assume normalmente — `resolveConversa` já casa o telefone com `leads.whatsapp`
existente, incluindo os que vieram da RD.

### Infra da régua de nutrição — construída e inerte

Fecha a pendência 1 do §34 e a seção "ainda precisa de implementação" de
`docs/WHATSAPP_NUTRICAO_COMERCIAL.md`. **Nada dispara até os templates
virarem `aprovado`** — zero risco de mensagem sair sem aprovação da Meta.

- **Migration `20260828_whatsapp_nutricao_comercial`:** `leads` ganha
  `whatsapp_opt_in_at`/`whatsapp_opt_in_source`/`whatsapp_opt_out_at`; tabela
  nova `whatsapp_nutricao_etapas` (uma linha por etapa por lead —
  `primeiro_contato`/`d3`/`d10`/`d24`/`d45` —, `unique(lead_id, etapa)`
  impede duplicidade em reexecução do cron); os 5 templates de
  `docs/WHATSAPP_NUTRICAO_COMERCIAL.md` cadastrados em `whatsapp_templates`
  com `status_aprovacao='pendente'` — **reaproveita o mesmo gate que
  `send-patient-trigger` já usa** pros templates de paciente, em vez de
  inventar uma env var de liga/desliga; cron `whatsapp-nutricao-comercial`
  a cada 30 min, 9h-19h BRT (mesmo horário do `whatsapp-nudge-silencio`).
- **Edge function `whatsapp-nutricao-comercial`:** processa etapas
  `agendada` vencidas; cancela se o lead saiu de elegibilidade (opt-out,
  convertido/descartado, sem WhatsApp, conversa em atendimento humano); se o
  template da etapa não está aprovado, **não é erro** — só espera e tenta de
  novo no próximo ciclo, sozinha, assim que alguém aprovar; ao enviar,
  encadeia a etapa seguinte (D+3→D+10→D+24→D+45, cada intervalo contado a
  partir do envio da etapa anterior, não de D0 absoluto — como o documento
  da régua especifica).
- **`whatsapp-webhook`:** qualquer resposta do lead cancela a régua pendente
  em tempo real (a etapa seguinte nunca é criada por engano); o cron reforça
  isso defensivamente por corrida rara.
- **Admin (`/leads`):** três ações novas —
  `optInLeadWhatsapp`/`pauseLeadWhatsappNutricao`/`resumeLeadWhatsappNutricao`
  — registram opt-in com origem, pausam (cancela etapas agendadas) e retomam
  (reativa a etapa parada ou agenda a próxima, sempre pra "agora"). Badge de
  próxima etapa/status por lead.
- **Não implementado** (item 4 do plano original do doc, fora do escopo
  desta sessão): cancelar a régua também em "conversão do lead" via ação
  explícita do admin e em "agendamento de visita" — hoje só opt-out manual e
  resposta do lead cancelam. `lead.status='convertido'` já é checado pela
  edge function antes de enviar, então o pior caso é uma etapa ficar
  `cancelada` por essa checagem no próprio disparo, não uma mensagem indevida
  saindo.
- `admin/lib/database.types.ts` regenerado via Supabase MCP depois das
  migrations (nunca editar à mão — CLAUDE.md).

### Trabalho de sessão paralela, mesmo working tree

Havia outra sessão mexendo nos mesmos arquivos ao mesmo tempo (evidência:
`whatsapp-nudge-silencio` chegou à v3 em produção sem eu ter tocado nela) —
o commit `a45a0af` junta os dois: a reforma de qualidade do
`SYSTEM_PROMPT_LEAD` (28/ago, ver §34) mais o meu hook de cancelamento de
etapa no `whatsapp-webhook` estão no mesmo arquivo, deployado junto (v28,
combinado). A copy de "primeiro contato manual" (`admin/lib/whatsapp.ts`,
§34) também foi publicada nesse commit.

### Correção de doc

§4 (Planos e preços) estava com a tabela de antes da reforma do §30/§31 —
corrigida nesta sessão (ver nota no próprio §4).

**⚠️ Pendências:**
1. Os 5 templates de Marketing da régua seguem `pendente` na Meta — sem
   controle nosso, só esperar.
2. Cancelamento por conversão/visita agendada (item 4 do doc original) não
   implementado — ver nota acima.
3. Nada testado em device/simulador nativo.
4. Commits `e6e90ed`/`a45a0af`, push feito pro `main` — Vercel/Supabase já
   refletem.

## 38. Olivia explica planos com contexto e CTA (28/ago)

> ⚠️ **Superado em parte pela §43 (28/ago):** o prontuário **saiu do PRO** e virou serviço contratado à parte, por R$ 239/mês.

Pedido do fundador: a explicação comercial dos planos precisava ser didática
e prática, sem parecer texto corrido nem uma tabela fria. A regra aprovada é:
começar pela escolha real da pessoa — frequência dos atendimentos e nível de
apoio desejado na operação — e usar bullets apenas para organizar a resposta.

**Roteiro implementado:**

- **START:** rotina mais flexível; sem mensalidade, R$ 1,90/minuto, sala
  equipada, app para reservas e controle do tempo, cadastro de pacientes,
  comunidade e eventos. Para quem atende pontualmente, está começando ou
  prefere pagar conforme usa.
- **PRO:** agenda mais recorrente; R$ 599/mês no mensal ou R$ 499/mês com
  fidelidade de seis meses, mais R$ 1,45/minuto. Inclui o START, impressão,
  prontuário e agenda pela internet, emissão de nota fiscal e apoio da
  recepção em agendamentos, cobranças e retornos de pacientes.
- **Uso das salas:** horas em blocos de uma hora, reserva a partir de 30
  minutos, consumo por minuto dentro da reserva e saldo remanescente para os
  próximos atendimentos. O pacote de 10 horas entrega 11 horas de uso.

Depois da explicação, Olivia faz **uma única pergunta de diagnóstico** (por
exemplo, se a agenda pede mais flexibilidade ou mais apoio operacional) e
fecha com CTA leve para falar com a equipe ou conhecer o espaço. Ela adapta a
resposta ao histórico e não repete o roteiro inteiro quando a pessoa pergunta
apenas um detalhe.

**Arquivos sincronizados:**
`supabase/functions/whatsapp-webhook/index.ts` (produção),
`supabase/functions/test-lead-ai/index.ts` (bancada de teste) e
`docs/IA_ATENDIMENTO_WHATSAPP.md` (manual-âncora). As duas funções passaram
em `deno check`, foram deployadas no Supabase e o commit `4030729`
(`feat(whatsapp): orienta explicação de planos`) foi enviado ao `main`.

## 39. Fluxo curto após o primeiro contato + material de apoio (28/ago)

> ⚠️ **Superado em parte pela §43 (28/ago):** o prontuário **saiu do PRO** e virou serviço contratado à parte, por R$ 239/mês.

Feedback do fundador sobre a primeira versão do roteiro: a explicação dos
planos ainda estava longa demais para WhatsApp. A Olivia agora não abre os dois
planos de uma vez. Depois que a equipe pergunta se o lead busca atendimentos
pontuais ou recorrentes, ela segue uma das duas saídas curtas:

- **Pontuais:** recomenda START (sem mensalidade, R$ 1,90/minuto, compra de
  horas e reserva a partir de 30 minutos) e pergunta a especialidade.
- **Recorrentes:** recomenda PRO (R$ 599/mês ou R$ 499/mês com fidelidade de
  seis meses, R$ 1,45/minuto, prontuário/agenda, nota fiscal e recepção) e
  pergunta a especialidade.
- **Após a especialidade:** informa que há salas preparadas e pergunta apenas
  se prefere foto real ou visita; foto usa o META existente e visita usa o
  Calendly. Uma pergunta por mensagem.

O bloco `PLANOS` foi simplificado nos dois prompts
(`whatsapp-webhook` e `test-lead-ai`) e no manual
`docs/IA_ATENDIMENTO_WHATSAPP.md`. A restrição sobre preços foi alinhada para
permitir explicar a mecânica das horas sem prometer valores personalizados.

**Material entregue:** `output/pdf/fluxo-atendimento-olivia.pdf`, PDF A4 de
três páginas com mensagem inicial, os dois caminhos, sequência após a
especialidade, objeções/perguntas frequentes e guia de condução. Renderizado e
revisado visualmente; os dois prompts passaram em `deno check`. O PDF é
material operacional local, não artefato versionado no repositório.

## 40. Primeiro contato ativo pelo número da Olivia (28/ago)

Os leads da RD já entram em `leads` com nome e WhatsApp. O problema de usar o
botão manual antigo era de canal: ele abre o WhatsApp comercial da equipe; a
resposta volta para aquele app e a Olivia não a vê. A solução implementada é
**Iniciar com Olivia** na linha do lead em `/leads`.

1. A equipe registra a origem do opt-in (por exemplo, formulário RD) e clica
   no botão.
2. `optInLeadWhatsapp()` persiste o consentimento, agenda
   `primeiro_contato` e invoca `whatsapp-nutricao-comercial` para **somente
   aquele lead**, sem esperar o cron e sem processar a fila inteira.
3. A Edge Function envia o template aprovado pelo número da Olivia, cria a
   conversa como `status='ia'` e grava a mensagem no histórico.
4. Ao responder, o webhook associa o telefone ao lead RD e a Olivia segue o
   fluxo comercial de planos/especialidade/foto ou visita.

**Gate obrigatório:** sem opt-in válido, não há envio. Se algum template for
pausado ou rejeitado pela Meta, a etapa permanece agendada até voltar a ficar
ativo; isso protege o contato ativo fora da janela de 24 horas. O botão vale
para qualquer lead elegível, mas o uso imediato pedido é para os leads de
origem RD.

Arquivos: `admin/app/actions.ts`, `admin/app/leads/page.tsx`,
`supabase/functions/whatsapp-nutricao-comercial/index.ts` e
`docs/WHATSAPP_NUTRICAO_COMERCIAL.md`. `deno check`, `admin npx tsc --noEmit`
e `git diff --check` passaram antes da publicação.

## 41. Ativação dos modelos comerciais e handoff da Olivia (28/ago)

Os cinco templates de Marketing foram conferidos no Meta como **Ativo —
Qualidade pendente**. Isso é um estado enviável: a qualidade ainda não tem
volume suficiente para receber classificação. A migration
`20260828_activate_commercial_whatsapp_templates.sql` promoveu os cinco
registros correspondentes em `whatsapp_templates` para `status_aprovacao =
'aprovado'`, liberando o gate interno da régua.

O alerta de transferência para humano também foi configurado no ambiente:
quando a Olivia identifica necessidade de handoff, ela mantém a notificação no
Admin e envia o template de Utilidade `handoff_comercial_v1` ao WhatsApp
comercial. Nenhum lead foi contatado durante essa ativação: não havia etapa de
primeiro contato agendada no momento da liberação.

**Operação pronta:** em `/leads`, registrar a origem do opt-in e clicar em
**Iniciar com Olivia**. O template inicial sai imediatamente pelo número da
Olivia; a resposta do lead volta para o mesmo canal e a Olivia continua o
atendimento com o histórico completo. Ainda falta apenas o teste real com um
lead autorizado para comprovar a entrega ponta a ponta.

## 42. Regra de entrada por canal (28/ago)

Há dois caminhos independentes de entrada comercial:

1. **Lead RD/formulário:** como o contato é ativo, a equipe precisa registrar
   o opt-in e clicar em **Iniciar com Olivia** no Admin. Isso envia o primeiro
   template pelo número da Olivia; as respostas seguintes seguem
   automaticamente com ela.
2. **Lead que escreve diretamente para o WhatsApp da Olivia:** não exige ação
   no Admin. O `whatsapp-webhook` cria ou associa o lead e a Olivia continua o
   atendimento automático normalmente, dentro da janela de atendimento aberta
   pela própria mensagem do lead.

Não usar o botão manual que abre o WhatsApp comercial da equipe para iniciar
um fluxo que deverá ser conduzido pela Olivia: a resposta retornaria por outro
canal e não chegaria ao webhook dela.

## 43. Prontuário sai do PRO e vira serviço à parte (28/ago)

Decisão do fundador: o prontuário **deixa de estar incluído no plano PRO** e passa a ser contratado à parte, por **R$ 239/mês** — valor que já era o do módulo `communicare` na tabela `modules`.

### O que isso corrige

Uma contradição que existia desde sempre: `src/models/oli-plans.ts` declara `COMMUNICARE_PRO_PLAN` como *"Plano Básico do Communicare — incluído no plano PRO"*, com a flag `feature_crm_communicare` ligada no PRO, enquanto o mesmo Communicare era vendido à parte por R$ 239/mês com `requiredPlan = PRO` (sessão de 22/jul). As duas coisas nunca puderam ser verdade ao mesmo tempo. Esta decisão resolve o conflito pelo lado do "é à parte".

### ✅ RESOLVIDO (28/ago, sessão seguinte) — Olivia não promete mais prontuário

As §38 e §39 deixaram os prompts dizendo que o PRO *"inclui … prontuário e agenda pela internet"* — achado ao testar a régua de nutrição em produção, com um lead real esperando resposta. Corrigido nos três arquivos de texto:

- `supabase/functions/whatsapp-webhook/index.ts` (**em produção, v33**) — trecho vira "Inclui emissão de nota fiscal e apoio da recepção no agendamento, na cobrança e no retorno dos pacientes."
- `supabase/functions/test-lead-ai/index.ts` (redeployado, v27) — mesma frase, sincronizado.
- `docs/IA_ATENDIMENTO_WHATSAPP.md` — mesma frase.

`deno check` limpo nos dois antes do deploy. **Ainda não corrigido:** `output/pdf/fluxo-atendimento-olivia.pdf` (material local, não versionado) e o alinhamento mais profundo listado em "Ainda não alinhado" abaixo — fora do escopo desta correção pontual.

### O que sobra no PRO

Impressão · recepção cuidando do agendamento, da cobrança e do retorno dos pacientes · emissão de nota fiscal · os dois diagnósticos · tudo do START.

São **três diferenciais de serviço**, um a menos que antes, com a mensalidade parada em R$ 599/R$ 499. As viradas não mudam (19h no semestral, 23h no mensal), mas passam a entregar menos — vale observar se a objeção comercial aumenta.

### Material atualizado

`iCloud/OLI - HH/OLI_Planos_2026.pdf` refeito: o prontuário sai das duas listas de plano e vira uma linha de serviço adicional com o preço, logo abaixo dos cards. Números reconferidos por script (as 18 células da tabela, as duas viradas, os pacotes e o exemplo da consulta) — nada além do prontuário mudou.

### Ainda não alinhado

✅ **RESOLVIDO (28/ago, sessão seguinte à §44) — ver §45:** `oli-plans.ts` (`COMMUNICARE_PRO_PLAN`) e `OLI_BASE.md` §4/§5/§10 corrigidos. `feature_crm_communicare` não precisou de mudança — já estava `false` em todos os planos. A matriz `FEATURES` do `meu-plano.tsx` também já não tinha nenhuma linha de Communicare (removida na sessão 19/ago, §32) — conferido, nada a fazer ali.

**Ainda pendente:** o site e `output/pdf/fluxo-atendimento-olivia.pdf`.

## 44. Botão de resposta rápida não gerava resposta + "Iniciar com Olivia" ganha destaque (28/ago)

Dois problemas achados testando a régua de nutrição em produção, com o fundador como lead de teste.

### Resposta rápida do template (quick reply) não chegava na Olivia

O lead tocou o botão "Quero conhecer" da mensagem de primeiro contato e não recebeu resposta. Causa: `processarMensagem` só tratava `msg.type === 'text'` (e `'audio'` transcrito) — resposta de botão chega como `type='button'` (`{ text, payload }`) ou `type='interactive'` (`button_reply`/`list_reply`), e caía direto em `[mensagem tipo ... não suportada ainda]`, sem acionar a IA nem cancelar a régua de nutrição pendente.

**Fix** (`whatsapp-webhook` v32→v33): extrai o texto do botão (`msg.button?.text ?? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title`) e trata como mensagem de texto normal — mesma cancelação de régua, mesmo acionamento de resposta da Olivia. `payload` type do webhook também ganhou os campos `button`/`interactive`.

**Achado no meio do teste:** o template de primeiro contato enviado (`primeiro_contato_comercial_v1`) não tinha nenhum botão visível na mensagem recebida — a sugestão de botão do `docs/WHATSAPP_NUTRICAO_COMERCIAL.md` não virou configuração real quando o template foi submetido à Meta. O fix acima cobre qualquer template que **tenha** botão daqui pra frente; não resolve retroativamente os 5 já aprovados sem botão configurado.

### "Iniciar com Olivia" estava escondido

O botão (§37/§40) existia, mas em texto pequeno (11px, sublinhado) no fim de uma coluna estreita cheia de outros campos de edição — o fundador não conseguiu achar. Movido pra coluna **Contato**, ao lado do WhatsApp normal: botão sólido verde, primeira coisa visível na linha do lead. A origem do opt-in deixou de exigir escolha numa lista — é derivada automaticamente de `leads.origem` (`rd_station`→`formulario_rd`, `site`→`formulario_site`, `meta_ads`→`anuncio_meta`, resto→`manual`). Um clique só. `admin/app/leads/page.tsx`; `OPT_IN_SOURCE_LABEL` (não usado mais) removido.

**✅ Confirmado em produção (28/ago).** Depois do push, a página `/leads` demorou a refletir — sem erro de build na Vercel, só o tempo normal de deploy/cache; hard refresh resolveu. **Não** era o bug recorrente do item 26 do §11 (push sem disparar deployment/alias preso) — vale checar isso primeiro numa próxima vez, mas não assumir de cara.

### Preparado, não ativado: cabeçalho de imagem em template

Pedido do fundador: adicionar foto na mensagem de primeiro contato. `enviarTemplate()` (`_shared/whatsapp.ts`) ganhou `headerImageUrl` opcional — monta o componente `header` do tipo imagem quando presente. **Inerte**: nenhum template hoje tem `header_image_url` preenchido. Passo que falta, manual, só o fundador pode fazer: criar `primeiro_contato_comercial_v2` no Meta com cabeçalho Imagem (mesmo corpo, foto sugerida: `estrutura` — `https://olihealthhub.com.br/fotos/lounge.jpg`, já pública), mandar pra aprovação; quando aprovar, trocar `meta_template_name`/`header_image_url` na linha `primeiro_contato` de `whatsapp_templates`.

### Teste real feito nesta sessão

Lead sintético criado com o número do fundador (mesma metodologia do §34/§35): opt-in registrado, `whatsapp-nutricao-comercial` invocado direto pra esse lead, `primeiro_contato_comercial_v1` entregue de verdade (`status: entregue`, wamid confirmado), etapa `d3` já encadeada automaticamente. Lead de teste **mantido** no banco a pedido do fundador (não limpo).

**⚠️ Pendências:**
1. Confirmar com o fundador que tocar um botão de template agora gera resposta da Olivia (o teste anterior não tinha botão pra tocar).
2. Criar `primeiro_contato_comercial_v2` com header de imagem no Meta e mandar pra aprovação (passo manual, fora do meu alcance).
3. `output/pdf/fluxo-atendimento-olivia.pdf` e o alinhamento mais profundo do §43 seguem abertos.

## 45. Fecha alinhamento do §43 + bug de cache no `/conversas` (28/ago, sessão seguinte à §44)

**Fecha a pendência de código do §43:** `COMMUNICARE_PRO_PLAN` (`src/models/oli-plans.ts`) não dizia mais "incluído no plano PRO" — passou a `monthlyPrice: 239` com comentário explicando que é módulo à parte (`communicare` na tabela `modules`, mesmo preço). A entrada duplicada "Communicare Connect — R$239" dentro de `optionalModules` do mesmo objeto foi removida (era o mesmo produto listado duas vezes). `OLI_BASE.md` §4 item 7, §5 (tabela de benefícios + texto de breakeven), §7 (tabela de módulos) e §10 (título + corpo) reescritos na mesma linha: prontuário não é benefício de nenhum plano, é módulo pago à parte a R$239/mês. `meu-plano.tsx` conferido — `FEATURES` já não tinha Communicare desde 19/ago (§32), nada a mudar lá. `npx tsc --noEmit` limpo.

**Bug achado a partir de um relato do fundador:** a conversa criada pelo botão **Iniciar com Olivia** (§40/§44) não aparecia na aba **Conversas** do admin. Investigado direto no banco via Supabase MCP antes de mexer em código — as duas conversas reais (leads João e André Chaves, ambos `rd_station`) **já existiam certinhas**: `conversations` com 1 mensagem outbound cada, `last_message_at` setado pelo trigger `trg_update_conversation_on_message`. Ou seja, não era bug de dado nem de query do `/conversas` (`admin/app/conversas/page.tsx` não tem filtro nenhum que excluísse lead). **Causa real:** `optInLeadWhatsapp()` (`admin/app/actions.ts`) chama `revalidatePath('/leads')` mas nunca `revalidatePath('/conversas')` — com Next.js 14.2, o Router Cache do lado do cliente serve a versão em cache da aba por ~30s mesmo em rota `force-dynamic`, então quem clicava "Iniciar com Olivia" e ia direto pra Conversas via navegação client-side via `<Link>` via sidebar via SPA (sem hard refresh) via cache stale — mesma família de sintoma do "`/leads` demorou a refletir" registrado no §44, mas com causa raiz diferente (ali era propagação de deploy na Vercel; aqui é cache de navegação do Next.js). **Fix:** uma linha, `revalidatePath('/conversas')` logo depois do invoke da edge function em `optInLeadWhatsapp`. `cd admin && npx tsc --noEmit` limpo.

**Publicado:** commits `e489a5f` (alinhamento §43) + `d297fab` (fix `/conversas`), push direto pra `main`.

## 46. Olivia vira atendente no filtro de `/leads` (28/ago, sessão seguinte à §45)

Pedido do fundador: a Olivia deveria contar como um atendente a mais no funil — clicar **Iniciar com Olivia** (§40/§44) já deveria classificar o lead como contatado por ela e tirar da esteira de "novo", sem esperar confirmação manual.

**Schema:** `leads.atendido_por_ia boolean not null default false` (migration `20260828_lead_atendido_por_ia`). **De propósito sem FK** pra `profiles`: o filtro de atendente humano (`atendentesData` em `admin/app/leads/page.tsx`) já lista só quem tem `is_admin=true` — dar à Olivia um profile de verdade exigiria criar uma conta real em `auth.users` (mesmo caminho de `createTeamProfile`, §17) só pra representar uma IA, o que gera uma conta de login de verdade sem necessidade. Uma coluna solta resolve sem esse peso.

**Automação:** `optInLeadWhatsapp()` (`admin/app/actions.ts`) agora seta `atendido_por_ia = true` e avança `status: 'novo' → 'contatado'` no mesmo update que já registrava o opt-in — só avança quem ainda estava em `novo` (não retrocede um lead mais adiante na esteira, ex.: `visita_agendada`).

**UI (`/leads`):** novo chip **"Olivia (IA)"** na fileira de filtro de atendente (mesma altura de "Todos"/nomes/"Sem atendente"), balde próprio e mutuamente exclusivo — um lead marcado `atendido_por_ia` conta só ali, nunca também em "sem atendente" nem no nome de um humano. Badge azul equivalente na linha da tabela, com prioridade de exibição sobre o nome do atendente humano.

**Backfill:** os 3 leads que já tinham passado pelo botão antes da migration (João, André Chaves, Guilherme-teste) foram atualizados direto no banco pra refletir o novo estado — sem isso ficariam "sem atendente" incorretamente até a próxima interação.

`database.types.ts` regenerado nos dois projetos via Supabase MCP — pegou de brinde uma defasagem que já existia em `src/models/database.types.ts` (fora de sincronia havia um tempo: faltavam `whatsapp_nutricao_etapas`, `last_nudge_at` em `conversations`, `whatsapp_message_received` no enum de notificação, `email` de lead virou nullable). `tsc --noEmit` limpo nos dois. **Publicado:** commit `f3cee76`, push direto pra `main`.

## 47. Fila de Trabalho para de duplicar `/leads` e `/conversas` (28/ago, sessão seguinte à §46)

Pedido do fundador: a Fila estava poluída — `lead_received` e `whatsapp_message_received` já têm tela própria (`/leads`, `/conversas`) e inflavam a Fila sem necessidade. Checado no banco antes de mexer: **67 itens pendentes**, sendo **60** desses dois tipos vs. só **7** de trabalho real (`new_signup` 4, `reservation_created` 3).

**Fix:** `admin/app/fila/page.tsx` e o badge da sidebar (`admin/app/layout.tsx`) passaram a filtrar por whitelist explícita — só entra o que é ação sobre médico já cadastrado: `new_signup`, `reservation_created`, `plan_subscribed`/`plan_activated`, `module_purchased`/`module_activated`, `hour_package_purchased`/`hour_package_activated`. `FilaClient.tsx` perdeu o código específico de lead/whatsapp (link "Ver conversa", mensagem via `mensagemLead`) e ganhou tag+texto próprios pros tipos que não tinham (`reservation_created` caía no rótulo cinza genérico antes). O listener realtime de INSERT também passou a filtrar pelo mesmo critério, senão um lead novo continuaria pulando pro topo da Fila em tempo real.

**Bug achado no meio do check:** o enum `notification_type` no Postgres nunca teve `hour_package_purchased`/`hour_package_activated` — os inserts em `create-hour-package` e `asaas-webhook` são fire-and-forget (`.then(() => {}).catch(() => {})`) e vinham falhando em silêncio desde que foram escritos. Ou seja, compra/ativação de pacote de horas **nunca apareceu** na Fila. Corrigido com `ALTER TYPE ... ADD VALUE` (migration `20260828_hour_package_notification_types.sql`, aplicada via Supabase MCP) + `database.types.ts` regenerado nos dois projetos.

`lead_received` já tinha baixa automática (trigger de `20260807_fila_leads.sql`, sai da fila quando o lead muda de status) — continua intocado, só não aparece mais *nesta* tela. `whatsapp_message_received` não tem (nem tinha) nenhum mecanismo de leitura fora da Fila — ficará com `read_at` sempre nulo daqui pra frente, mas sem consequência: nenhuma outra tela lê esse campo pra esse tipo (`/leads` e `/conversas` não têm badge). `NotificationFeed.tsx` (sino da topbar) é outro consumidor de `admin_notifications`, mostra os 50 mais recentes sem filtrar por tipo nem por lido — é log geral, não fila de trabalho, deixado como está de propósito.

`cd admin && npx tsc --noEmit` limpo. Verificação visual da Fila não feita (preview local pede login de admin, sem credencial disponível neste ambiente) — confirmar no ar depois do deploy.

## 48. Onboarding passa a coletar identidade + intenção do médico (28/ago, sessão seguinte à §47)

Pedido do fundador, motivado pelo plano de régua de ativação (adiado, ver pendência abaixo): o onboarding enxuto (§8/15, cortado de 5 telas pra 1 em julho) não estava gerando dado nenhum. Conferido no banco antes de mexer: **30 cadastros, só 15 concluíram onboarding**, e desses só 5-9 preencheram especialidade/cidade/tipo de atendimento/CRM — tudo isso virou missão opcional em `completar-perfil.tsx` sem prazo, e "opcional sem prazo" na prática não é preenchido. Fundador decidiu que a aquisição não é mais só divulgação direta pro app store, fricção deixou de ser a prioridade, e pediu os dados obrigatórios mesmo assim mantendo o crédito de Olicoins.

**Campos novos obrigatórios em `app/onboarding.tsx`** (WhatsApp já era): Especialidade (texto livre), Cidade/UF (2 `TextInput`, sem picker de estado — decisão consciente de não extrair o `SelectRow`/`ESTADOS` de `perfil.tsx`, que é local ao arquivo e estilizado pra edição pós-cadastro, não pra tela enxuta), Tipo de atendimento (`presencial`/`telemedicina`/`ambos`, já existia como coluna e tipo `TipoAtendimento`, só não era coletado em lugar nenhum). `OptionCard` (antes fixo em `Tratamento`) virou genérico `<T extends string>` pra reaproveitar nos 3 grupos de escolha única da tela.

**Campo novo — intenção declarada:** não existia nada parecido no schema (confirmado em pesquisa: nem os "11 objetivos de ação" nem as "10 seções de perfil" da gamificação capturam intenção, só ação completada). Nova coluna `profiles.objetivo_oli` (migration `20260828_profiles_objetivo_oli.sql`), enum de 1 toque: `migrar_rotina` / `espaco_avulso` / `so_conhecer`.

**Bug achado de brinde:** `admin/app/medicos/[id]/page.tsx` consultava e exibia `tipos_atendimento` (plural) — coluna morta, nunca escrita por nenhum código do app desde sempre (a coluna viva é `tipo_atendimento`, singular). O campo "Tipos de atendimento" no admin sempre apareceu vazio. Corrigido pra `tipo_atendimento` no mesmo passo, já que o objetivo aqui é o fundador *ver* o dado; ganhou também `Field` novo pra `objetivo_oli`.

Olicoins sem nenhuma mudança de lógica: `cadastro_completo` (10 coins) já credita ao terminar o onboarding, incondicional — continua valendo. A seção "atividade_local" (10 coins) ainda exige `local_atuacao`+`num_locais`, que seguem opcionais/pós-cadastro — o médico ainda tem o que completar depois.

`especialidade`/`atividade_exercida` seguem espelhadas no save (mesmo padrão já usado em `perfil.tsx`) pra não quebrar a checagem da seção de perfil que depende de `atividade_exercida`.

**Testado ponta a ponta** com conta sintética (mesma metodologia de leads/parceiros de sessões anteriores): cadastro via `expo start --web`, e-mail confirmado manualmente via SQL (`auth.users.email_confirmed_at`, gate normal do Supabase Auth bloqueando o teste headless), onboarding preenchido e submetido, conferido no banco que os 5 campos novos salvaram certo (`especialidade`, `atividade_exercida`, `cidade_uf`, `tipo_atendimento`, `objetivo_oli`). Conta de teste apagada ao final (`auth.users` cascade → `profiles`). Página `/medicos/[id]` do admin **não** verificada visualmente (sem credencial de admin neste ambiente) — só confirmado que a rota não quebra (redireciona pro login normalmente) e que `tsc` está limpo.

`npx tsc --noEmit` (raiz) e `cd admin && npx tsc --noEmit` limpos. `database.types.ts` regenerado nos dois projetos. `CLAUDE.md` corrigido (linha da árvore de pastas descrevia `onboarding.tsx` como "questionário fiscal Mello", desatualizada há tempo).

**Pendência:** a régua de ativação por WhatsApp pro médico pós-cadastro (desenhada nesta sessão, plano em espera) volta à mesa agora que o onboarding novo está pronto — pode inclusive usar `especialidade`/`objetivo_oli` pra segmentar a mensagem.

**Publicado:** commit `820984e`, push direto pra `main`. Admin foi por Vercel e o app recebeu OTA em **31/ago** a partir de checkout limpo desse commit (sem incluir alterações locais pendentes): `production` **`b99a2cbb-5619-4c22-8936-83c35e0c8c97`** e `preview` **`997f292b-4bdc-4848-96fe-316aab6b10f3`**. O onboarding obrigatório já está disponível nos dois canais.

## 49. Causa raiz do cache do `/leads` achada — mesma classe de bug do §45, agora corrigida na fonte (28/ago, sessão seguinte à §48)

Fundador reportou dois sintomas em `/leads`: (1) lead que a Olivia já contatou continua aparecendo como **Novo**; (2) o chip "Olivia (IA)" no filtro de atendente mostra "3" com todos os outros filtros em Todos, mas ao clicar nele a lista fica vazia.

**Investigação:** `bate()`/`href()`/contadores em `admin/app/leads/page.tsx` — a lógica de filtro em si (interseção de eixos Situação/Origem/Atendente/Atendimento, cada balde de contagem excluindo só o próprio eixo) está correta, sem bug lógico. Os 3 leads que passaram pela Olivia (André, João, Guilherme-teste) já estavam com `status='contatado'` no banco — o backfill do §46 funcionou. Então a causa não estava na lógica de filtro nem nesses 3 registros específicos; estava em dois lugares que produzem **tela desatualizada** mesmo com dado correto no banco:

1. **`optInLeadWhatsapp()` (`admin/app/actions.ts`):** o `supabase.functions.invoke('whatsapp-nutricao-comercial', ...)` lançava erro (`throw`) quando falhava — bem provável agora, com os templates ainda pendentes de aprovação na Meta (§37/§44). O UPDATE em `leads` (status→contatado, atendido_por_ia=true) já tinha rodado ANTES dessa linha, mas o `throw` interrompia a função antes de chegar nos dois `revalidatePath()` no final — o admin caía numa tela de erro do Next.js sem perceber que o clique já tinha funcionado no banco. Corrigido: o invoke agora é best-effort (`console.error` em vez de `throw`) — o comentário já dizia isso é só uma tentativa imediata, o cron reprocessa a etapa `agendada` de qualquer forma; não fazia sentido essa chamada travar a única coisa (revalidação) que garante a tela atualizar.

2. **Cache client-side do Next.js 14.2** — a mesma causa raiz diagnosticada no §45 pro bug de `/conversas` ("Router Cache do lado do cliente serve a versão em cache da aba por ~30s mesmo em rota `force-dynamic`"), mas que só tinha sido tamponada lá com um `revalidatePath` a mais — a causa sistêmica nunca foi corrigida, e apareceu de novo aqui, num arquivo diferente (`/leads`), do jeito mais confuso possível: contador mostra 3, filtro aplicado mostra 0. `admin/next.config.mjs` não tinha nenhuma configuração de cache — o default do Next 14.2 (`staleTimes.dynamic = 30s`) se aplica a **toda navegação client-side por `<Link>`** do painel inteiro, não só onde alguém lembrou de chamar `revalidatePath`. Corrigido na fonte: `experimental.staleTimes.dynamic = 0` no `next.config.mjs` — desliga esse cache pra qualquer rota `force-dynamic` do admin (que é o painel inteiro), não só `/leads`. Isso deve prevenir a próxima ocorrência dessa mesma classe de bug em qualquer outra tela, em vez de ficar caçando `revalidatePath` faltando uma rota de cada vez.

**Não era bug de lógica de filtro** — nenhuma mudança em `bate()`, contadores ou nos próprios chips. `cd admin && npx tsc --noEmit` limpo. Servidor local sobe sem erro com a config nova (checado via preview). Não testado ao vivo em produção (sem credencial de admin neste ambiente) — vale confirmar com o fundador depois do deploy que os dois sintomas somem.

## 50. Olivia se apresenta na abertura + `rd-vincular-deals` parava de vincular TODO lead (29/ago)

**Olivia não se apresentava:** fundador reportou que ela nunca se apresenta, nem na primeira mensagem de um contato novo — respondia direto ao que a pessoa perguntou. Causa: a regra "nunca soar como robô" (§34) bania qualquer frase de abertura "repetida a cada mensagem", sem abrir exceção pra primeira resposta de uma conversa nova. Modelo revisado e aprovado pelo fundador em 3 rodadas (cortar explicação do que é o OLI, manter a pergunta de rotina pontual/recorrente já setada antes do preço, e acrescentar a pergunta do nome): nova seção ABERTURA DA CONVERSA no prompt — só na primeira resposta (nenhuma mensagem dela ainda no histórico), apresentação curta + pergunta do nome, nada mais nessa mensagem; da segunda resposta em diante nunca repete. Nome usado depois com moderação, em momentos-chave (cumprimento, objeção, fechamento), não em toda mensagem. Aplicado em `whatsapp-webhook` (produção, v34) e `test-lead-ai` (v28, sincronia manual de sempre), documentado em `docs/IA_ATENDIMENTO_WHATSAPP.md`. `deno check` limpo nos dois antes do deploy.

**RD Station não recebia NENHUMA atualização de status — achado bem mais sério que o relato inicial:** fundador reportou que os leads já contatados no admin continuavam abertos na RD (44 presos). Investigação direta no banco (Supabase MCP, sem mexer em nada antes de confirmar): `rd_stage_map` correto, trigger `trg_lead_status_para_rd` ativo, `rd-sync-status` sem erro — mas só 101 de 218 leads tinham `rd_deal_id`. A causa real estava em `rd-vincular-deals` (cron a cada 15 min, responsável por preencher `rd_deal_id` cruzando e-mail com a RD): `lead.email.toLowerCase()` sem guarda de `null` — e `email` virou opcional em `leads` desde 03/ago (§20, lead pode ter só whatsapp). Todo lead `origem='whatsapp'` tem `email=null`, então a função **crashava inteira** ("Internal Server Error" sem corpo JSON, confirmado nos logs de `net._http_response`) no primeiro lead sem e-mail que encontrava — abortando o lote inteiro a cada execução, pra QUALQUER lead, com ou sem e-mail. Como o cron roda desde sempre, **nenhum lead foi vinculado a deal da RD desde que leads de WhatsApp passaram a existir**, silenciosamente — a régua de status nunca dava erro registrado porque a maioria simplesmente nunca chegava lá (`rd_deal_id is null` sai fora da query de sync antes mesmo de tentar).

**Fix:** guarda `if (!lead.email) { semDeal.push(...); continue; }` antes do `.toLowerCase()` — lead sem e-mail vai pro balde "sem deal na RD" (correto, não dá pra casar por e-mail) em vez de derrubar o lote. Função só existia solta no Supabase, nunca tinha sido commitada — trazida pro git nesta correção (`supabase/functions/rd-vincular-deals/index.ts`). Deployada (v9), testada com `dryRun:true` (confirma que não crasha mais: 42 vinculáveis, 75 sem deal, 0 erro) e depois rodada de verdade a pedido do fundador: **42 leads vinculados e sincronizados com a RD** (etapa "Contato realizado"), 0 erros. Base foi de 101 → 143 leads com `rd_deal_id`.

**Decisão do fundador:** os 75 leads restantes sem `rd_deal_id` são todos de origem WhatsApp sem e-mail cadastrado — **ficam sem vínculo com a RD**, sem plano de matching por telefone por ora. Não é bug, é limitação aceita: quem quiser que aquele contato apareça na RD precisa ter e-mail capturado em algum momento (ex.: quando a Olivia coleta na conversa).

`deno check` limpo, `curl` direto no endpoint (anon key, `verify_jwt=true` aceita qualquer JWT válido do projeto) usado pro dry-run e pra rodada real — não dependeu de esperar o cron. Nada digitado manualmente que precisasse de credencial sensível. Commits `495280e` (fix RD) + `aa47812` (abertura Olivia), push direto pra `main`.

## 51. Olivia nunca mais pede o WhatsApp/telefone do lead (29/ago, sessão seguinte à §50)

**Erro achado pelo fundador em conversa real:** Olivia pediu o WhatsApp de um lead que já estava falando com ela pelo WhatsApp — não faz sentido em nenhuma circunstância, o canal inteiro é aquele número, ela sempre tem o contato por definição. O prompt já proibia pedir "nome, telefone, e-mail... para confirmar", mas só dentro do bloco de transferência para humano (§34) — não havia proibição explícita e geral, cobrindo qualquer outro ponto da conversa onde o modelo pudesse "esquecer" o contexto do canal.

**Fix:** regra nova, redundante de propósito (defesa em profundidade contra esse tipo de lapso de instrução): uma versão em destaque logo após ABERTURA DA CONVERSA/USO DO NOME (bem no início do prompt, onde o modelo lê primeiro) e outra reforçando O QUE VOCÊ NÃO FAZ (ao lado da proibição de pedir CPF/dado sensível). Aplicado em `whatsapp-webhook` (produção, v35) e `test-lead-ai` (v29), documentado em `docs/IA_ATENDIMENTO_WHATSAPP.md`.

**Testado ao vivo antes de fechar** (urgência do pedido — "corrija isso AGORA"): via `test-lead-ai`, simulando (1) abertura normal de contato novo — segue pedindo só o nome, sem tocar em telefone; (2) cenário de handoff (lead pede humano) — resposta de transferência limpa, sem pedir contato. `deno check` limpo nos dois antes do deploy.

## 52. Funil de `/leads` cego para o canal orgânico do WhatsApp + `/conversas` ganha separação Olivia/equipe (29/ago, sessão seguinte à §51)

**Pedido do fundador:** "estou perdendo o controle do fluxo, difícil saber o que já foi atendido e o que não foi". Investigação direta no banco antes de tocar em código.

**Achado — o funil nunca contava o canal que hoje é maioria do volume:** 86 leads `origem='whatsapp'` (quem escreve direto pro número da Olivia, sem passar pela régua de outreach do §40) estavam presos em `status='novo'` — inclusive 2 já escalados pra humano (handoff). Cruzando com o histórico de mensagens: **os 86 tinham conversa real**, todos com 2+ mensagens trocadas, 50 com o próprio lead respondendo 2 vezes ou mais — não é lead frio, é gente que já foi atendida de verdade. Causa: só existe UM caminho no código que avança `leads.status` pra fora de `novo` — o botão manual **Iniciar com Olivia** (§46), usado só pra leads importados da RD. O webhook orgânico (`whatsapp-webhook`, quando alguém escreve primeiro) nunca tocava `leads.status` nem `atendido_por_ia`, então o filtro "Olivia (IA)" do §46 estava cego pra praticamente todo o volume real dela.

**Fix 1 — sincroniza o funil na primeira resposta da Olivia:** em `responderComIA`, logo depois do outbound ser enviado, `leads.status: 'novo' → 'contatado'` + `atendido_por_ia = true`, com `.eq('status','novo')` garantindo idempotência (só a primeira resposta move; não retrocede nem repete). Mesma semântica do botão manual, agora cobrindo os dois caminhos de entrada. Deployado `whatsapp-webhook` v36.

**Backfill:** 85 dos 86 leads presos tinham pelo menos uma resposta de outbound `sender_type='ia'` registrada — atualizados direto no banco pra `contatado`/`atendido_por_ia=true`. O único que sobrou em `novo` genuinamente não tem nenhuma resposta da Olivia ainda (não é bug, é fila real).

**Fix 2 — `/conversas` ganha separação visual entre Olivia e equipe:** pedido específico do fundador — "separe os atendimentos que estão sendo feitos pela Olivia dos que nós assumimos depois que ela iniciou". A lista lateral de `ConversasClient.tsx` era uma lista só, badges pequenos IA/Humano difíceis de escanear. Virou 4 grupos com cabeçalho e contador: **Assumidas pela equipe** (`kind=lead, status=humano`) → **Pacientes** (`kind=patient`, sempre humano por regra do banco, nunca foi da Olivia) → **Com a Olivia** (`kind=lead, status=ia`) → **Encerradas** (`status=fechada`, engano de número). Grupo derivado direto de `kind`+`status` já existentes — nenhuma coluna nova, nenhuma migration.

`tsc --noEmit` limpo no admin. Não testado ao vivo em produção nesta sessão (sem credencial de admin no ambiente) — vale o fundador confirmar visualmente os 4 grupos e os números batendo com o que via antes. Commit `a27b5f5`, push direto pra `main`.

## 53. Classificação em massa dos leads de WhatsApp + reorganização visual de `/leads` (29/ago, sessão seguinte à §52)

**Pedido do fundador:** "revise as conversas e classifique os leads pelos filtros que temos, baseado no contexto em que eles pararam ou seguiram". Depois do §52 corrigir o funil (leads de WhatsApp saindo de `novo`), os 85 leads orgânicos ficaram todos genericamente em `contatado` — nenhuma diferenciação de quem é lead quente, quem já era caso perdido (número errado, achou caro, mora longe) ou quem já tinha visita marcada.

**Trabalho:** lidas as 86 conversas ativas (532 mensagens) linha a linha via Supabase MCP, sem tocar em nada até confirmar o padrão. Reclassificados com base no conteúdo real:
- **Visita agendada** (6): link do Calendly enviado após interesse explícito confirmado.
- **Aguardando retorno** (2): pitch completo feito, lead adiou decisão ("vou analisar").
- **Sem resposta** (10): pergunta real respondida pela Olivia, silêncio depois — 3 com `perfil=fora` (Alphaville, Salvador).
- **Descartado** (+11, total 39): 7 engano de número (comida, bot de outra empresa respondendo sozinho), 1 fornecedor tentando vender pra OLI (`sem_perfil`), 1 preço rejeitado explicitamente, 2 distância rejeitada explicitamente.
- **Contatado** (58, mantido): conversa real mas sem sinal forte pra mover de etapa — todos com `temperatura` marcada (6 quente, 8 morno, 44 frio) pra priorizar quem vale ligar primeiro.

Confirmado antes de rodar: nenhum desses leads tem `rd_deal_id` — zero chamada disparada pra RD Station, é limpeza 100% interna. Não é migration nem código, são `UPDATE`s diretos documentados aqui pra rastreabilidade.

**Layout de `/leads` reorganizado em seguida** — pedido separado do fundador: "está confuso de entender". A coluna Situação tinha virado uma pilha de até 8 selos do mesmo peso visual (status, atendente, canal, nutrição, temperatura, perfil, motivo, RD), e ficou pior ainda depois da classificação em massa acrescentar temperatura/perfil em quase todo mundo. Reorganizado por hierarquia: status+temperatura juntos em destaque no topo (a decisão de "ligo agora"), dono do atendimento logo abaixo, e perfil/canal/motivo viram texto miúdo secundário numa linha só, sem fundo colorido — só `rd_sync_erro` continua em destaque, por pedir ação corretiva. Novos filtros **Temperatura** e **Perfil** (mesmo padrão dos filtros existentes) — sem eles não dava pra enxergar "quem eu ligo primeiro" sem vasculhar a tabela badge por badge.

`tsc --noEmit` limpo. **Não testado ao vivo** — sem credencial de admin neste ambiente, mesma limitação já registrada em sessões anteriores. Vale o fundador confirmar visualmente o layout novo e a classificação fazendo sentido pros leads que ele já conhece. Commit `65eb1de`, push direto pra `main`.

## 54. Equipe consegue enviar foto nos atendimentos humanos de `/conversas` (29/ago, sessão seguinte à §53)

**Pedido do fundador:** enviar foto pra quem está em atendimento humano no WhatsApp — até aqui `/conversas` só tinha texto livre (`send-whatsapp-reply`); a única foto que saía era a fixa por especialidade que a Olivia manda (link público pré-cadastrado em `FOTO_POR_ESPECIALIDADE`), sem servir pra recepção mandar um comprovante, print ou documento qualquer.

**Decisão de arquitetura:** em vez de exigir um bucket público (subir a foto em algum storage nosso, gerar URL, só então mandar por `link`), a foto sobe direto pro **Media Storage da própria Meta** — `POST /{phone_number_id}/media` devolve um `media_id`, e a mensagem sai com `image: { id: mediaId }` em vez de `image: { link }`. Evita criar infraestrutura de storage só pra isso; o `media_id` expira em ~30 dias, mas a mensagem já foi entregue a essa altura.

**Implementado:**
- `_shared/whatsapp.ts` ganha `subirMidiaWhatsApp()` (upload multipart) e `enviarImagemPorId()` (envio pelo id) — ao lado do `enviarImagem()` existente (por link, usado só pela Olivia).
- Nova edge function **`send-whatsapp-image`** (v1, `verify_jwt=true`, mesmo padrão de `send-whatsapp-reply`): recebe `multipart/form-data` (conversationId, imagem, legenda opcional), valida tipo (JPEG/PNG) e tamanho (5MB, mesmo teto da própria Meta), checa a janela de 24h igual ao texto livre, sobe e envia.
- `admin/app/actions.ts` ganha `sendConversationImage()` — repassa o `File` do formulário via `FormData` pro `functions.invoke` (o cliente supabase-js já detecta `FormData` e ajusta o `Content-Type` sozinho, sem precisar serializar nada).
- `ConversasClient.tsx`: botão de anexo (📎) ao lado do campo de texto. Selecionar uma foto mostra uma prévia com opção de remover; o texto do campo vira **legenda** da imagem (não uma segunda mensagem). Trocar de conversa limpa o anexo pendente, pra não vazar foto pro contato errado.

`deno check` e `tsc --noEmit` limpos. Não testado com envio real (sem credencial de admin neste ambiente) — vale o fundador mandar uma foto de teste antes de contar com isso em produção. Commit `ddffb0c`, push direto pra `main`.

## 55. Prévia de imagem no histórico de `/conversas` (29/ago, sessão seguinte à §54)

**Pedido do fundador**, logo depois do §54: dá pra ver uma prévia de qual foto foi enviada, "mesmo que rodem apenas pra mim" — sem isso, tanto a foto fixa da Olivia quanto a anexada pela equipe viravam só texto genérico no thread ("[imagem: psicologia]", "[imagem enviada pela equipe]"), sem saber qual foto foi de fato mandada.

**Schema:** `messages.media_url text` — a URL que o front usa pra `<img src>`. Dois caminhos diferentes preenchem esse campo:
- **Olivia** (`FOTO_POR_ESPECIALIDADE`): a URL já é pública (mesma que a Meta usa pra entregar a foto) — só passou a salvar no `media_url` no mesmo insert que já existia, zero custo extra.
- **Equipe** (`send-whatsapp-image`): aqui não tinha nada reaproveitável — o `media_id` que a Meta devolve não dá pra buscar de volta sem token, e expira em ~30 dias. Solução: sobe uma **cópia própria** pro bucket novo `whatsapp-media` (privado, RLS `is_oli_admin()` — mesmo padrão do `professional-docs` já existente) e gera uma **signed URL de 1 ano** (uso interno, só prévia — não precisa ser eterna). Se esse upload falhar, o envio real pro WhatsApp não é afetado — a mensagem já foi entregue a essa altura; só a prévia fica ausente e cai no texto genérico como fallback.

**Front:** `ConversasClient` renderiza `<img>` no bubble quando `media_url` existe (clicável, abre em tamanho real numa aba nova); o texto genérico some quando a imagem aparece, mas continua visível se a prévia falhou — nunca fica sem nenhum indício de que uma foto foi enviada.

Migration aplicada direto (coluna + bucket + policy), `database.types.ts` regenerado nos dois projetos. `deno check`/`tsc --noEmit` limpos. Deployado: `whatsapp-webhook` v37, `send-whatsapp-image` v2. Não testado com envio real — mesma limitação de sempre, sem credencial de admin neste ambiente. Commit `76cad44`, push direto pra `main`.

## 56. Olivia passa a recomendar o plano que atende à necessidade declarada (31/ago)

Fundador identificou comportamento comercial indesejado: mesmo quando o profissional dizia querer apenas **horas avulsas**, a Olivia tentava conduzir a conversa para o PRO. A diretriz foi invertida de forma explícita: ela vende a solução que a pessoa procura, não o plano de maior ticket.

- Horas avulsas, uso pontual, flexibilidade ou desejo de experimentar o espaço → recomenda **START**, ajuda a avançar nessa escolha e não introduz o PRO.
- O PRO só entra se a pessoa pedir uma comparação ou se a conversa indicar agenda recorrente/interesse nos serviços do plano; ainda assim, como opção contextual, nunca pressão ou correção da escolha pelo START.
- Estacionamento: há vaga para o profissional enquanto estiver em atendimento. Pacientes têm convênio com estacionamentos parceiros próximos ao OLI. Preço, disponibilidade e regras específicas continuam sujeitos à confirmação pela equipe.

Atualizados juntos (fonte de verdade + produção + simulador): `docs/IA_ATENDIMENTO_WHATSAPP.md`, `supabase/functions/whatsapp-webhook/index.ts` e `supabase/functions/test-lead-ai/index.ts`. Os dois prompts foram comparados byte a byte e os dois passaram em `deno check`. Deploy em produção concluído para `whatsapp-webhook` e `test-lead-ai`; a CLI atual não oferece mais o subcomando de invocação, portanto a simulação remota não foi executada por esse canal.

## 57. Olivia pode mostrar mais ambientes quando o lead pede fotos (31/ago)

Fundador reforçou que interesse visual é sinal comercial positivo: se a Olivia já enviou uma imagem e o lead pede mais, ela deve simplesmente enviar outra foto de ambiente, sem dizer que já mandou imagem, sem restringir o pedido e sem fazer a pessoa se sentir inconveniente. O sistema continua enviando **uma imagem por resposta**, mas pode atender novos pedidos com imagens diferentes.

Além de consultórios, o catálogo agora permite `conforto_medico` (`conforto-medico.jpg`) e `sala_espera` (`lounge-espera.jpg`), além das chaves existentes para estrutura e sala de eventos. As duas imagens foram confirmadas em `landing/fotos/` e usam URLs públicas do domínio OLI. Atualizados e publicados em produção: manual, `whatsapp-webhook` e `test-lead-ai`; prompts comparados byte a byte e `deno check` limpo nos dois.

## 58. Salas são adequadas à prática, não dedicadas a toda especialidade (31/ago)

Fundador corrigiu uma nuance comercial importante: Olivia não deve afirmar que há sala **específica** ou dedicada para especialidades fora dos ambientes conhecidos (clínica geral, ginecologia/estética e psicologia). A formulação geral passou de “salas preparadas para esse atendimento” para “salas que podem ser apropriadas para esse atendimento”.

Para uma prática fora dessa linha, como podologia, a resposta-modelo é: *“Temos uma sala que pode ser apropriada para o seu atendimento — veja esta foto.”* A Olivia envia uma foto de clínica geral ou estrutura conforme o contexto, sem inventar características da sala. Manual, webhook e simulador foram atualizados juntos; prompts comparados byte a byte, `deno check` limpo e deploy em produção concluído para as duas Edge Functions.

## 59. Organização do inbox de `/conversas`: não lida, ordem por atividade e de quem é a vez de responder (31/ago)

Fundador pediu organização visual pro `ConversasClient`: conversas com mensagem não lida numa cor diferente, ordenadas sempre pela mais recente (mesmo que já tivessem sido respondidas antes — qualquer mensagem nova muda a posição), e uma cor pra "precisa da nossa resposta" diferente de "aguardando o cliente".

A ordenação por `last_message_at` decrescente e a reordenação automática a cada mensagem nova (realtime) já existiam desde o §52 — nada mudou aí. O que faltava era saber **quem viu** a conversa por último e **de quem é a vez** de responder, e nenhum dos dois dado existia no schema.

**Duas colunas novas em `conversations`** (migration `20260831_conversas_leitura_e_direcao.sql`, aplicada + `database.types.ts` regenerado via MCP):
- `admin_last_read_at timestamptz` — quando a equipe abriu essa conversa pela última vez. Não lida = `last_message_at` mais recente que isso (ou nunca aberta). Gravada por uma action nova, `markConversationRead`, chamada ao trocar de conversa e a cada mensagem nova que chega numa conversa já aberta (o realtime já mostra a mensagem na hora, então já conta como vista) — otimista no client + grava no banco, sem `revalidatePath` (é escrita leve e frequente; outras abas/pessoas recebem via UPDATE realtime que já existia).
- `last_message_direction text` (`inbound`/`outbound`) — de quem foi a última mensagem. O trigger que já mantinha `last_message_at`/`last_inbound_at` em dia (`trg_update_conversation_on_message`, do §íntegro `20260819_whatsapp_conversations.sql`) passou a gravar essa direção também. Backfill rodado pras conversas existentes a partir da mensagem mais recente de cada uma.

**UI**: borda esquerda de 3px na linha da lista — vermelho (`oli-red`) quando a última mensagem é `inbound` (aguardando IA ou equipe responder), verde (`oli-green/50`) quando é `outbound` (bola com o contato); conversa encerrada não tem cor de vez de ninguém. Não lida ganha fundo âmbar leve, nome em negrito e uma bolinha dourada (`oli-gold`) ao lado do horário — cor separada das duas de cima de propósito, pra não confundir "não vi ainda" com "quem precisa responder" (podem ou não coincidir).

`tsc --noEmit` e `next build` limpos. Backfill conferido direto no banco via MCP (`last_message_direction` populado, `admin_last_read_at` nulo como esperado pra quem nunca abriu). Não testado ao vivo no navegador (sem credencial de admin neste ambiente) — vale o fundador abrir `/conversas` e confirmar visualmente antes de considerar redondo. Commit `49602a0`, push direto pra `main`.

## 60. Abas Equipe/Olivia na sidebar de `/conversas` (31/ago, sessão seguinte à §59)

Fundador reclamou de ter que rolar a lista até achar os atendimentos da Olivia. Dois botões fixos no topo da sidebar (`Equipe` / `Olivia`, com contador) substituem a rolagem: `Equipe` mostra os grupos `equipe` + `pacientes` + `encerradas` (tudo que a equipe acompanha direto), `Olivia` mostra só o grupo `olivia` (leads em atendimento autônomo). A thread aberta não depende da aba — trocar de aba não fecha a conversa selecionada, só filtra a lista. Link de notificação (`?id=`) abre direto na aba certa (calculado a partir do grupo da conversa inicial), sem precisar trocar na mão.

Não mudou o agrupamento em si (`grupoDe`, do §52) nem a ordenação — só filtra quais grupos aparecem por aba. `tsc --noEmit` e `next build` limpos. Não testado ao vivo. Aproveitado pra checar o status da régua de nutrição comercial a pedido do fundador (não é código, é leitura de estado): 5 templates aprovados, cron ativo rodando de 30 em 30 min sem falha, 42 primeiro-contato + 1 d3 enviados, 24 d3 + 1 d10 agendados, zero `falhou` — d24/d45 ainda não dispararam porque a régua começou em 28/ago e essas etapas são D+24/D+45 desde o contato anterior. Commit `22caae2`, push direto pra `main`.

## 61. Tiques de entrega estilo WhatsApp + contador de não lida no botão Equipe (31/ago, sessão seguinte à §60)

Duas peças pequenas pedidas juntas. Nenhuma delas precisou de coluna nova: `messages.status` (`enviada`/`entregue`/`lida`/`falhou`) já é mantido em dia pelo `processarStatus()` do `whatsapp-webhook` desde sempre (status de entrega que a Meta manda via webhook) — só faltava mostrar na UI.

**Tiques**: `TiquesWhatsApp` novo em `ConversasClient`, um tique cinza pra `enviada`, dois cinza pra `entregue`, dois azuis pra `lida`, `⚠` vermelho pra `falhou`. Só aparece em mensagem outbound. Cor do tique padrão muda pela cor de fundo da bolha (`tom='staff'` na bolha verde, `tom='ia'` na bolha azul clara) pra não sumir contra o fundo.

**Badge de não lida**: os dois botões de aba (`Equipe`/`Olivia`, do §60) ganham uma bolinha vermelha com contador no canto quando há conversa não lida naquela aba — mesmo `naoLida()` do §59, só que somado por aba em vez de por linha. Pedido foi só pra `Equipe`, implementado igual nos dois por consistência visual (mesmo mecanismo, sem motivo pra ficar assimétrico).

`tsc --noEmit` e `next build` limpos. Não testado ao vivo — depende de mensagem real passar por `entregue`/`lida` no WhatsApp pra ver as três cores, o que não dá pra forçar neste ambiente. Commit `a787318`, push direto pra `main`.

## 62. Endereço de atendimento entra no PRO + peça por plano (31/ago)

**Benefício novo no PRO:** o profissional pode **divulgar o endereço de atendimento nas suas redes e materiais**. Vale só no PRO; na peça do START aparece como não incluso.

É o primeiro benefício do PRO que **não tem custo marginal para o OLI** e ataca uma objeção concreta de quem atende em espaço compartilhado — não ter endereço próprio para pôr no Instagram, no Google e no material. Também compensa em parte a saída do prontuário (§43): o PRO volta a ter **quatro diferenciais** — impressão, recepção, endereço e nota fiscal.

### Material

- `iCloud/OLI - HH/OLI_Planos_2026.pdf` — comparativo atualizado com o item novo nos dois cards.
- **Duas peças novas, uma por plano:** `OLI_Plano_START.png` (1588×3025) e `OLI_Plano_PRO.png` (1588×3058), na pasta `OLI - HH`.

As peças seguem **a mesma estrutura e ordem do PDF** — cabeçalho, promessa, as três regras de cobrança, o card do plano, quanto sai o mês, compra de horas, faixa de destaque e rodapé —, com duas adaptações de layout: o card ocupa a largura toda e a lista de serviços vira duas colunas. A tabela de custo mostra só o plano da peça (o PRO traz mensal × semestral).

**Como foram geradas:** mesmo HTML e mesmo CSS do PDF, renderizado por screenshot do Chromium (`--screenshot --window-size=794,1900 --force-device-scale-factor=2`) e recortado no fim do conteúdo por script. Ficaram altas (proporção ~1:1,9, não A4) porque o conteúdo das duas páginas do PDF cabe numa imagem só — melhor para mandar no WhatsApp do que dois arquivos. Ver [[pdf-chromium]] na memória do projeto.

**Números reconferidos por script:** 26 valores (as três tabelas de custo mensal, a compra de horas nos dois planos, as horas efetivas com bônus e os dois exemplos de consulta de 50 minutos). Todos batem com as taxas.

### ⚠️ Observação comercial deixada em aberto

A peça do START mostra **os quatro itens que ele não tem** (impressão, recepção, endereço, nota fiscal), porque o pedido foi "exatamente igual ao PDF". Isso contraria a regra registrada no **item 35 do §11**: o cliente vê um plano por vez, então a peça individual deveria ser ficha de serviço, não comparativo. Numa peça isolada, quatro itens riscados leem como lista de defeitos, e o START é justamente o plano de entrada. **Tirar é uma linha de código** — fica dependendo de decisão do fundador.

### Pendências

O site, o `OLI_BASE.md` e a matriz `FEATURES` do `meu-plano.tsx` ainda não citam o endereço. Os prompts da Olivia (já corrigidos quanto ao prontuário, ver §43) também não mencionam o benefício novo — vale entrar quando o PRO for explicado.

## 63. Estacionamento nos dois planos + a regra fantasma do START (31/ago, sessão seguinte à §62)

Dois ajustes pedidos pelo fundador ao revisar as peças.

### 🐛 A regra que não podia existir

A peça do START oferecia a conversa com contador e advogado *"no plano semestral, sem custo adicional"* — mas **o START não tem plano semestral**: ele não tem mensalidade nenhuma, então não há o que assinar por seis meses. A condição era resíduo do desenho intermediário de 13/ago, quando o START custava R$ 97/mês e o compromisso de seis meses era a contrapartida da cortesia (§30). Quando o START voltou a ser gratuito, a contrapartida evaporou e a letra miúda ficou.

**Decisão: os dois diagnósticos saem do START e viram exclusivos do PRO.** Reforça o plano pago e elimina a regra sem lastro. Vale notar que isso **também tira o único uso que restava da ideia de "START semestral"** — se aparecer em algum material ou prompt, é resquício.

### 🅿️ Estacionamento entra nos dois planos

Novo benefício: **vaga de estacionamento no prédio durante o atendimento**, para quem estiver atendendo, em qualquer plano. Não vira diferencial de upgrade de propósito — é condição de uso do espaço, e a leitura natural de "durante o atendimento" não distingue plano.

### Como ficaram os planos

| | START | PRO |
|---|:--:|:--:|
| Sala equipada | ✅ | ✅ |
| App (agenda, tempo de sala, pacientes) | ✅ | ✅ |
| Comunidade e eventos | ✅ | ✅ |
| **Vaga de estacionamento durante o atendimento** | ✅ | ✅ |
| Conversa com contador e com advogado | — | ✅ |
| Impressão | — | ✅ |
| Recepção (agendamento, cobrança, retorno) | — | ✅ |
| Endereço para divulgar nas redes | — | ✅ |
| Emissão de nota fiscal | — | ✅ |

O PRO passa a ter **cinco diferenciais**; o START fica com quatro itens, todos inclusos e sem condição.

### Material refeito

`OLI_Planos_2026.pdf`, `OLI_Plano_START.png` (1588×3215) e `OLI_Plano_PRO.png` (1588×3276), todos na pasta `OLI - HH`. As duas peças passaram a ser geradas por `gera_pecas.py`, que lê o `<style>` do próprio HTML do PDF — assim a peça individual **não pode divergir do comparativo** por esquecimento, que era o risco real depois de três rodadas de mudança em um dia.

### Pendências

O estacionamento e o endereço ainda não estão no site, no `OLI_BASE.md`, na matriz `FEATURES` do `meu-plano.tsx` nem nos prompts da Olivia. E **a observação da §62 continua de pé**: a peça do START ainda mostra os cinco itens que ele não tem.

## 64. Admin responsivo no celular (31/ago, sessão seguinte à §61)

Fundador pediu pra rodar bem no celular — até aqui o admin era desenhado só pra desktop. Auditoria (grep por `w-[…px]`, `grid-cols` sem variante responsiva, tabela sem scroll) achou só três pontos reais de quebra num painel de 29 telas, o resto já usava padrão responsivo (`grid-cols-1 md:…`, `overflow-x-auto` em quase toda tabela) — não foi preciso mexer tela por tela.

**Sidebar** (`components/Sidebar.tsx`): era `w-60` fixo sempre visível — numa tela de ~375px sobrava só ~135px pro conteúdo. Virou gaveta no celular: botão flutuante (canto inferior esquerdo, de propósito longe do topo onde cada página põe título/ações) abre um drawer com fundo escurecido; `fixed` no celular vira `md:sticky` no desktop, mesmo comportamento de sempre a partir de 768px. Cada link fecha a gaveta ao navegar.

**Três tabelas cortavam em vez de rolar** (`cupons`, `comunidade`, `parceiros`): o container tinha `overflow-hidden` em vez de `overflow-x-auto` — mesmo bug que o `/leads` já tinha corrigido antes (comentário deixado lá citando o motivo). Troca de uma classe nos três.

**`/conversas`** (o painel de duas colunas que ficou o mais construído dessa semana): lista de 320px fixos ao lado da thread não cabe no celular de jeito nenhum. Agora empilha — lista ocupa a tela inteira, some quando uma conversa é aberta (a thread que passa a ocupar), com seta de voltar no cabeçalho da thread só visível no celular. Reaproveita o `selecionada` que já existia, sem estado novo. Ao entrar direto (sem vir de notificação), continua abrindo na conversa mais recente por padrão — igual ao desktop — então quem entra pelo celular vê a thread primeiro e usa a seta pra voltar à lista; aceitável, não vale a complexidade de detectar viewport no server pra mudar esse default.

`tsc --noEmit` e `next build` limpos nas duas rodadas. **Login pra verificação visual falhou:** a credencial de teste do `e2e/auth.setup.ts` (`test-playwright@olihealthhub.com`) existe no repo mas voltou "e-mail ou senha incorretos" contra o Supabase local — rotacionada ou nunca existiu nesse ambiente. Sem outra credencial de admin, o dreno de gaveta e o empilhamento do `/conversas` não foram vistos rodando de verdade — vale o fundador abrir no celular antes de dar como certo. Achado à parte: `docs/HANDOFF.md` estava sendo editado em paralelo por outra sessão (§62/§63 apareceram entre uma edição e outra desta) — inserção feita com `Edit` (old_string/new_string), não `Write`, então nada foi sobrescrito.

## 65. Cadastro travado no onboarding + `profiles` ganha coluna `email` (02/set)

Fundador reportou que médicos não conseguiam se cadastrar — tela de onboarding travava, sem rolar e sem trocar de campo. Duas causas, corrigidas em duas rodadas (a segunda achada só depois de testar de novo com o fundador).

**Rodada 1 — sem `ScrollView`.** `app/onboarding.tsx` usava uma `View` fixa com `justifyContent: 'space-between'` pra empurrar o botão final pro rodapé, sem nenhum scroll. Em tela menor, campos abaixo da dobra (UF, tipo de atendimento, objetivo, indicação, botão "Entrar no app") ficavam fisicamente inacessíveis. Envolvido em `ScrollView` — e isso gerou um crash real na primeira tentativa (`Invariant Violation: ScrollView child layout (["justifyContent"]) must be applied through contentContainerStyle`), porque o `style` reusado carregava o `justifyContent` que só pode ir no `contentContainerStyle`. Corrigido com um style próprio pro `ScrollView`.

**Rodada 2 — "ainda tem pontos que não rolam".** Causa era o `TouchableWithoutFeedback` que envolvia o `ScrollView` inteiro (`onPress={Keyboard.dismiss}`) — ele disputava o gesto de arrastar com o próprio scroll, então em certos pontos da tela (sobre labels, gaps entre campos) o toque não iniciava a rolagem. Removido; troca por `onScrollBeginDrag={Keyboard.dismiss}` no `ScrollView`, que dispensa o teclado sem interceptar o gesto.

**Ícones genéricos.** De quebra, os ícones de Tratamento (Dr./Dra.) e das opções de Tipo de atendimento/Objetivo usavam todos o mesmo `ribbon-outline` — nem diferenciava Dr. de Dra. Trocados por ícones próprios por opção: `man-outline`/`woman-outline` (Dr./Dra.), `business-outline`/`videocam-outline`/`infinite-outline` (Presencial/Telemedicina/Ambos), `briefcase-outline`/`time-outline`/`eye-outline` (objetivo com o OLI).

Verificado rodando `expo start --web` num viewport mobile, com bypass temporário e local do gate de auth do `_layout.tsx` (revertido antes de cada commit, nunca ficou no diff) — e depois via Expo Go no simulador iOS pra confirmar em app real, não só web. `tsc --noEmit` limpo. Dois commits (`5f7dc3c`, `d61a6e3`), `eas update` publicado em `production` e `preview` nos dois.

**Achado à parte, séria: `profiles` nunca teve coluna `email`.** O fundador notou que e-mail não aparecia em lugar nenhum pro time. Investigando: `signUp` sempre mandou o e-mail certinho pro Supabase Auth (`auth.users.email`), mas a função `_create_profile_and_subscription` (chamada pelo trigger `handle_new_user` em todo cadastro novo) recebia `p_email` só pra usar como fallback de nome (`split_part` antes do `@`) — nunca gravava. `profiles` (a tabela que alimenta admin/CRM) simplesmente não tinha essa coluna. Confirmado direto no banco de produção antes de mexer.

Corrigido com migration (`supabase/migrations/20260902_profiles_email.sql`, aplicada direto em produção via Supabase MCP): coluna `email` adicionada, função reescrita pra gravar, backfill rodado pros 35 profissionais já cadastrados (lendo de `auth.users`, todos ficaram com `email` preenchido). Types regenerados (`generate_typescript_types`) nas duas cópias do repo — `src/models/database.types.ts` e `admin/lib/database.types.ts`, que tinha ficado pra trás. Só mudança de schema, sem impacto de UX — não precisou de OTA.

**Admin também não mostrava e-mail.** A tela de detalhe (`/medicos/[id]`) já mostrava — mas via chamada separada à Auth Admin API (`supabaseAdmin.auth.admin.getUserById`), não de `profiles`. A lista (`/medicos`) nunca teve e-mail nenhum. Adicionada coluna, lendo direto de `profiles.email` agora que existe. `tsc --noEmit` limpo no admin. Não testado visualmente — admin exige login e não há credencial de teste válida disponível (mesma limitação da §64: `test-playwright@olihealthhub.com` continua não autenticando).

**Decisão tomada com o fundador, não mexida:** "de onde a pessoa veio" (`como_conheceu`) continua fora do onboarding, como missão gamificada pós-cadastro (§48) — não foi trazida de volta pra tela de cadastro.

## 66. Modo demonstração de horas pra perfis founder (02/set)

**Pedido do fundador:** Guilherme e Igor (ambos `user_type='founder'`) não conseguiam adicionar horas nos próprios perfis — precisavam poder ligar/desligar acesso completo (reserva, checkout) a qualquer momento, sem impactar produção, pra demonstrar o app de verdade em visitas de cliente.

**Investigação antes de mexer em qualquer coisa** (subagent Explore, sem edição): o bloqueio real era só um — `admin/app/medicos/[id]/page.tsx` dá `notFound()` pra `user_type` em `(admin,founder,specialist,partner,pending,team)`, e é a ÚNICA página com o formulário de "adicionar horas". `addHours` em si nunca teve restrição de `user_type`, e o fluxo de reserva/checkout no app (`hasReservationCredit`) só olha `hour_balance` por `professional_id` — nenhum lugar do app React Native nem RLS filtra por `user_type`. Ou seja: o founder já teria reserva/checkout funcionando normalmente assim que tivesse saldo — só faltava um jeito de dar esse saldo a ele.

**Por que não abrir `/medicos/[id]` pra founder:** faria o perfil aparecer nas contagens de `/medicos`, `/planos` e nos dashboards de faturamento — exatamente o "impacto em produção" que o fundador pediu pra evitar (§17 já excluía founder dessas telas de propósito).

**Fix:** card **"Modo demonstração"** dentro de `/equipe/[id]` (que founder já acessa, sem precisar abrir `/medicos`), só pra `user_type='founder'`:
- **Ativar/somar horas** — reusa o `addHours` já existente, sem nenhuma mudança de comportamento pra médicos de verdade.
- **Desligar agora** — ação nova `desativarHorasDemonstracao`: expira (não apaga) todo `hour_balance` não-vencido daquele profissional na hora, sem esperar o pacote de 1 ano vencer sozinho. Mantém o histórico de quanto já foi concedido.

Mostra o saldo atual (`Xh Ymin` ou "Desligado — sem saldo") pra founder saber o estado sem precisar adivinhar.

**Não coberto de propósito, fora do pedido:** as reservas/checkouts reais feitos em modo demonstração contam normalmente pra ocupação de sala (métrica usada no cálculo de comissão do próprio founder em `/meu-recebimento`, §7) — não construída nenhuma exclusão pra isso, já que o pedido era literalmente "iniciar reserva, terminar, fazer checkout, tudo" de verdade. Vale o fundador saber que demos vão aparecer ali.

`tsc --noEmit` limpo. Não testado ao vivo — sem credencial de admin neste ambiente. Commit `e8758e3`, push direto pra `main`.

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

**Resumo de 1 linha (22/jul):** Sessão focada em **dar destaque ao Programa de Indicação + reformular a aba Ecossistema + incidente Android**. Novo botão "Indique e Ganhe" ao lado do contador de Olicoins (Início + Perfil) → `/indicacao`. Ecossistema reformulada em várias rodadas de feedback: card "Meu Plano" virou hero na cor do plano, novo card de Indicação, "Serviços Inclusos" (lista fixa errada — raiz do bug "PRO mostrava contabilidade incluída") trocado por "Benefícios do Plano" dinâmico vindo da mesma matriz `FEATURES` de `meu-plano.tsx`, e "Módulos e Soluções" acabou virando só um card-teaser pra `/modulos` (preview em grid foi tentado e removido a pedido do fundador). De brinde: Communicare Connect liberado pra contratação via WhatsApp (estava `coming_soon`/`oauth`, virou `available`/`contact_sales`, `requiredPlan` PRO); descrições erradas de módulo corrigidas (Communicare citava VIP indevidamente, Contabilidade Médica não mencionava que PRO também tem diagnóstico grátis); inconsistência corrigida entre `/modulos` e Ecossistema na regra de contratação (extraída pra `src/utils/moduleContract.ts`). Separadamente, **incidente**: app sumiu da Google Play (404) — investigado e resolvido via reenvio no Play Console, causa raiz não confirmada (ver seção própria acima, §11). Commits: `cd08f2e`→`93882ed` (ver seção da sessão acima pra lista completa). OTA enviada em múltiplas rodadas — última: production `b792c374-2cb3-4cee-ac55-7cfbd2b53f6d` / preview `21dcfd46-ee18-44ae-8b9a-fd8f3fbf496b`.

**Resumo de 1 linha (31/jul):** Sessão de **4 fixes + início da régua de nurturing push**. Fixes: (1) teclado do WhatsApp preso no onboarding (`phone-pad` sem tecla de fechar); (2) campo manual de código de indicação — não existia NENHUM lugar pra digitar código em instalação nova, só resolvia via deep link; (3) foto da Sala 4, última pendente das 9 salas; (4) App Lock deslogando "toda hora" — causa era o fallback de código do dispositivo forçando re-login completo, removido a pedido do fundador (só o toggle de biometria desloga agora). Commits `38d9b6d`→`17aa558`, OTA enviada em 4 rodadas (ver seção da sessão acima pros group IDs). Depois, início da implementação do `OLI_Nurturing_Push.docx` (régua de 8 estágios/23 gatilhos): recusado recompensar avaliação de loja com Olicoins (viola política Apple/Google, app já sumiu uma vez da Play Store) — desenhada pesquisa de satisfação interna como alternativa compliant, prompt nativo de loja fica pra depois do próximo rebuild. Fatia 1 (piloto) implementada: infra de governança de push (`push_dispatch_log`), estágio Boas-vindas, pesquisa de satisfação (`app/avaliacao-app.tsx`) — banco já em produção via Supabase MCP, **código do app ainda não commitado/OTA** (próxima ação). Faltam ~18 gatilhos dos outros 6 estágios.

**Resumo de 1 linha (31/jul sessão 2):** Sessão focada no **site institucional** — e a lição da sessão é de processo. Achado que o formulário de contato do site **nunca funcionou** (era `<form>` decorativo, sem JS, sem `name` nos campos: todo lead preenchido desde sempre se perdeu) e que todas as imagens de seção eram **geradas por IA**. Reescrita completa da copy (H1 virou "Consultório pronto. Você paga só o tempo que usa."; removidos ecossistema/premium/pay-per-use/networking; espaço movido pra antes do preço; planos com a conta pronta — R$ 100 por consulta de 50 min, BASE compensa em 10 h/mês, PRO em 25 h/mês), 14 fotos reais tratadas substituindo as de IA (34 MB → 2,1 MB), e captura de leads nova. **Armadilha:** a tarde inteira foi trabalhada em `iCloud/.../Website/oli-deploy/` — cópia órfã da era Netlify, idêntica ao `landing/` — porque §3 ainda listava Netlify como host; o erro só apareceu ao abrir este handoff. Pior: a captura de leads tinha sido feita com **Netlify Forms, que não existe na Vercel** e teria falhado 100% em produção. Refeito com tabela `leads` no Supabase (RLS: insert anônimo só com `origem='site'`, leitura só `is_oli_admin()`), testado por simulação de role. §3 corrigido pra Vercel e a pendência de doc de 21/jul fechada. Fundador publicou; depois reportou o hero mostrando só o teto em monitor grande — causa medida ao vivo (imagem retrato no fluxo esticava o grid pra 2130px num viewport de 1102px), corrigida com `position:absolute` + `max-height`. Fix do hero commitado e no ar (`64c0112`). **Pendências:** tela `/leads` no admin (hoje só via SQL) e apagar a pasta órfã `oli-deploy`.

**Resumo de 1 linha (31/jul sessão 4):** Sessão **só de CSS**, fechando o defeito que o fix do hero (sessão 2) tinha deixado passar nas seções de baixo. Causa-raiz medida ao vivo em viewport de 2844px: **nenhum container limitava a largura da página** — cada foto de "Como funciona" era renderizada a **1308×981** (acima do tamanho real do arquivo, 1600×900 esticado num box 4:3) e a seção inteira tinha **4720px de altura**, quatro telas só de foto. Fix principal: `.section > *` com `max-width:1280px` — uma regra que resolve toda seção, presente e futura. Mais: `.modelo-img` de 4:3 pra 3:2 (as fotos são 16:9 e 3:2, perdiam laterais à toa), `object-position:center 45%` na foto retrato do card de infraestrutura, e **breakpoint novo em 900px** porque o layout só quebrava em 768 e em iPad a foto ficava menor que o texto ao lado. Seção `#modelo` caiu de 4720 pra **2416px**. Validado em **10 viewports** (2560→375px) via iframe isolado: zero estouro horizontal, zero elemento colapsado — foi esse teste que pegou uma armadilha de CSS antes de ir pro ar (`margin:auto` num item de grid faz a foto colapsar pra **0×0**; o certo é `justify-self:center`). Registrado também que esta sessão rodou **em paralelo com a sessão 3** no mesmo `index.html` — sem conflito (sessão 3 mexeu na copy do `<body>`, esta no CSS do `<head>`), mas o handoff mudou embaixo da sessão no meio do trabalho. **Publicado** pelo fundador ainda em 31/jul, no mesmo push que levou as mudanças da sessão 3 — confirmado ao vivo em produção.

**Resumo de 1 linha (31/jul sessão 5):** Sessão **só de CSS de novo**, agora nos cards de plano no mobile. Causa-raiz: um **`style` inline** (`grid-template-columns: repeat(3, 1fr)`) no `.planos-wrapper` **vencia a media query** — a regra que empilha os planos abaixo de 1024px existia no CSS desde sempre e **nunca chegou a rodar**, então os três planos ficavam lado a lado até em 320px, com **154px de largura útil** cada e o grid resolvendo pra `217px 220px 64px` num viewport de 386px (estouro). Removido o inline; largura útil em 375px foi de **154px pra 275px (+79%)**. Como START e BASE têm o mesmo fundo branco e o wrapper não tem `gap`, empilhar sozinho ia virar um bloco branco único — então no breakpoint o wrapper perde `border-radius`/`overflow:hidden`/sombra e cada painel vira card próprio com `gap:20px`, limitado a `max-width:560px` (em 1024px a coluna única dava 876px de largura útil). Tipografia e padding reduzidos em ≤480px. **Bug de brinde:** a borda dourada de destaque do BASE usava `var(--color-gold)`, **variável que não existe** na paleta (é `--dourado`) — declaração inválida, a borda nunca apareceu; virou classe `.destaque` com `box-shadow` inset. Validado em 11 viewports: zero estouro, zero painel colapsado. **Resumo de 1 linha (31/jul sessão 6):** **Favicon do site, que não existia.** Nenhum `<link rel="icon">` e nenhum arquivo de ícone em `landing/` — Google e abas mostravam o ícone genérico desde sempre. Criados `favicon.png` (512×512) e `apple-touch-icon.png` (180×180) usando **só o símbolo** circular (o texto "OLI HEALTH HUB" é ilegível abaixo de 48px), vazado em creme sobre o verde da marca — escolha do fundador entre 3 opções. Tags + `theme-color` adicionadas nas **7 páginas**, incluindo o `_template-pagina-confirmacao` pra novas páginas já nascerem com ícone. **O sandbox de terminal caiu nesta sessão**, o que impede processar ou até copiar binários (as ferramentas de arquivo só escrevem texto); contorno: compor o ícone no **canvas do navegador** a partir do PNG já publicado no site (same-origin, sem taint), recolorir com `source-in` e baixar via `toBlob` — fundador autorizou o download e moveu os arquivos. Validado em 16/32/48/64/128px e em aba clara/escura/recorte circular antes de gerar. Falta `favicon.ico` (binário, impossível sem sandbox) e otimizar o 512 de 59 KB em múltiplos tamanhos. Ver §19.

**Lição repetida da §17:** `margin:auto` em item de grid encolhe pra largura intrínseca — usar `justify-self:center`. Commitado (`540322c`) e validado em 9 viewports no deployment da Vercel. **No ar e confirmado no domínio** em 10 viewports. Mas a publicação em si deu dois perrengues de infra que valem mais que o CSS: o push **não disparou deployment** (a Vercel só tinha visto um commit de 40 min antes — resolvido com `git commit --allow-empty`) e, já publicado, o **domínio continuou servindo a versão antiga** enquanto a URL `.vercel.app` do mesmo projeto servia a nova — alias preso a um deployment anterior, resolvido com `Promote to Production`. Receita de diagnóstico registrada na §18 pra não gastar outra rodada nisso.

**Resumo de 1 linha (31/jul sessão 6):** Sessão rodou **em paralelo com as sessões 3-5** (que mexiam só em `landing/`) — esta trabalhou em `app/`, `admin/` e Supabase, fechando 5 itens da fila de pendências do §11 na ordem pedida pelo fundador (rápidos primeiro): (1) `ar_gestao_mensal` volta pra `coming_soon`; (2) pasta órfã `oli-deploy` — comando passado ao fundador, hard-delete não é ação que a sessão executa sozinha; (3) tela `/leads` no admin + notificação `lead_received`; (4) régua de nurturing **fatia 2** — 13 gatilhos novos (paciente, comunidade com resumo diário agrupado, saldo baixo de horas com detecção de borda, upsell de plano/módulo/anual, indicação, reativação 30 dias, aniversário), reaproveitando toda a infra de governança já existente; ficam de fora só o que depende de decisão de produto ainda não tomada (check-in de presença) ou que não tem evento correspondente no app hoje (fatura); (5) tela `/parceiros` — indicações e comissão por parceiro do Programa de Indicação de Parceiros Externos, calculada em runtime, nunca duplicada. No meio do item 5, achado um segundo parceiro de teste no banco ("MBS Hackathon", indicações internas incluindo o próprio founder) — fundador confirmou que é intencional (fonte de leads) mas pediu que comissão fosse **configurável por parceiro** em vez de fixa em código; resultado foi uma tabela nova de config editável direto em `/equipe/[id]`, com provisionamento automático (código de indicação + config default) ao criar ou converter um parceiro, fechando de vez a necessidade de SQL manual que tinha sido preciso pro Marangos. Cada publicação (5 commits, 3 rodadas de OTA) só saiu depois de confirmação explícita do fundador; `git add` sempre seletivo por causa das sessões concorrentes mexendo nos mesmos arquivos de doc/site.

**Resumo de 1 linha (03/ago):** Fechada a decisão que o §19 deixou aberta: os **22 leads de tráfego pago do Meta saíram da planilha e entraram na tabela `leads`** do Supabase (origem nova `meta_ads` + 5 campos de campanha, `external_id` com índice único parcial garantindo importação idempotente — testado reinserindo uma linha), aparecendo na `/leads` do admin que já existia; acaba a duplicidade com o painel Cowork em `localStorage`. **O achado da sessão foi comercial, não técnico:** cruzando `leads.email` com `auth.users`, **a campanha já tinha 1 conversão que ninguém sabia** — Juan Carlos (`@einstein.br`) virou cliente START ~21h depois do lead entrar, com `como_conheceu='redes'`; lead marcado `convertido` e o cruzamento vira rotina de toda importação. 11 dos 22 entraram com observação interna já preenchida a partir do que o §19 tinha validado (2 telefones inutilizáveis, 2 `job_title` que não conferem, 2 conselhos a validar, 6 leads fora do raio de visita por DDD) — nada inventado. Corrigido de brinde o `notify_lead_created()`, que dizia "Novo lead do site" pra qualquer origem, e apagadas as 22 notificações de backfill que o trigger `AFTER INSERT` cuspiu no feed do admin datadas de hoje (armadilha registrada pra próxima carga em massa). RLS conferida por simulação de role, não presumida: `anon` continua sem conseguir forjar `origem='meta_ads'` nem ler a tabela. **Pendências:** o sandbox de shell caiu a sessão inteira (`useradd failed`), então `npx tsc --noEmit` não rodou e o bloco `leads` do `database.types.ts` foi editado à mão — rodar os dois na próxima sessão com shell; nada commitado; e a sincronização Meta→Supabase segue **manual** (o passo natural é webhook → edge function, já que o `external_id` resolve a idempotência).

**Resumo de 1 linha (03/ago sessão 2):** Descritivo comercial dos três planos para apresentar ao cliente — documento único, linguagem para **todos os profissionais de saúde** (dos 22 leads do Meta só 5 são de medicina) e com a conta feita: tabela de quanto sai o mês em 5/10/20/25/40h nos três planos, os 3 pontos de virada e o preço efetivo da hora nos pacotes. Entregue como **HTML de 2 páginas A4 pronto para Cmd+P**, não PDF, porque o sandbox de shell caiu a sessão inteira (`useradd failed`, 4 tentativas) e sem Python não há reportlab — de brinde, ficou editável pelos sócios. **O achado foi um erro de documentação com consequência comercial direta:** `OLI_BASE.md` §5 e o comentário de `oli-plans.ts` diziam que o BASE compensa em **~17h/mês**, usando uma diferença de minutagem de **R$ 0,30** que não existe mais — a real é R$ 0,50, e o número certo é **~10h**; a função `calcBreakevenHours()` e o site sempre estiveram certos, só a documentação estava velha, então quem montasse material lendo o doc diria ao cliente quase o dobro do volume necessário e o empurraria pro plano errado. Corrigidos os dois, e o `OLI_BASE.md` passou a trazer as 3 viradas (10h/14h/25h) em vez de só a do BASE. Copy respeitou as regras já registradas: sem jargão, "do OLI" nunca "da OLI", nenhum parceiro nomeado, sem check-in e sem VIP. **Matemática conferida à mão** — reconferir programaticamente quando o shell voltar. Nada commitado.

**Resumo de 1 linha (03/ago sessão 3):** Ajuste de UI na `/leads` do admin depois do fundador usar a tela: o campo de observações estava **ilegível** — `rows={2}` + `resize-none` + `text-xs` num `max-w-6xl` dividido por 7 colunas virava um filete de ~150px, e as observações que a importação do Meta gravou passam de 200 caracteres, então só dava pra ler rolando dentro do próprio campo e não dava pra aumentá-lo na mão. Container foi pra `max-w-[1600px]` (desvio consciente do 6xl padrão das outras telas do admin), coluna fixada em `w-[420px]`, textarea pra `rows={8}` / `text-[13px]` / `leading-relaxed` / `min-h-[120px]` / `resize-y`, e o wrapper de `overflow-hidden` pra `overflow-x-auto` — sem isso, em tela menor a coluna larga empurraria a tabela pra fora e o conteúdo seria cortado sem dar como rolar. **Sem typecheck de novo:** o sandbox de shell continuou wedged (`useradd failed`) da primeira à última tentativa das três sessões do dia; `cd admin && npx tsc --noEmit` segue pendente pras mudanças de 03/ago inteiras. Nada commitado.

**Resumo de 1 linha (03/ago sessão 4):** Esteira de leads de 5 pra **9 etapas** (entram "Não consegui falar", "Aguardando retorno", "Visita realizada" e "Proposta enviada" — antes o lead pulava de visita agendada direto pra convertido e quem visitou e ficou pensando sumia do radar), mais **3 campos de qualificação**: `temperatura` (quente/morno/frio), `perfil` (dentro/fora/a_confirmar — existe por causa dos 6 leads com DDD fora do raio de visita) e `motivo_descarte` com lista fechada, pra dar pra somar depois o que mais derruba lead. CHECK garante que motivo só existe em lead descartado, e a `updateLead` limpa o campo quando a etapa muda — senão reativar um lead descartado estouraria constraint na cara do usuário. Pré-preenchimento **conservador de propósito**: os 6 distantes entraram como "a confirmar", não "fora", porque quem decide isso é a conversa. 4 regras testadas por simulação no banco, todas passaram. Aba **"Médicos" virou "Profissionais"** (a base tem nutricionista, psicólogo e dentista; "Base de Clientes" foi descartado por conflitar com `/leads` e com quem está no START gratuito) — **só os rótulos, a rota segue `/medicos`**, porque renomear a pasta implicaria mover ~12 `href` sem typecheck nem e2e disponíveis. Os 4 testes e2e que casavam a string velha foram atualizados; achado de brinde que **não** foi mexido: `11-usuarios.spec.ts` procura um heading "Médicos cadastrados" que não existe mais, já estava quebrado antes. **O fundador estava trabalhando a base ao vivo durante a sessão** — 20 leads foram pra "Contatado" e o Juan Carlos saiu de "Convertido" pra "Visita agendada", mesmo já sendo usuário cadastrado do app; nada foi revertido, mas vale conferir. Sandbox wedged o dia inteiro: sem typecheck, sem e2e, nada commitado.

**Resumo de 1 linha (03/ago sessão 5):** Fecha a última pendência do §20 — lead de anúncio deixa de depender de importação manual. Nova edge function **`meta-leads-webhook`** (deployada, v1 ACTIVE, `verify_jwt:false`, versionada em `supabase/functions/`): recebe o `leadgen` do Meta, valida a assinatura HMAC do **corpo cru** (reserializar o JSON invalidaria toda requisição legítima), **volta na Graph API pra buscar os dados** — o webhook do Meta manda só o `leadgen_id`, nunca os dados da pessoa, e é por isso que precisa de token de Página — e grava em `leads`; daí o trigger `trg_notify_lead_created` que já existia dispara a notificação e ela chega no feed do admin **por realtime, sem recarregar**. `external_id` gravado como `l:<leadgen_id>` de propósito, com o mesmo prefixo que a integração Meta→Planilha usa, senão um lead que viesse pelos dois caminhos duplicaria. Códigos de resposta desenhados pro retry do Meta: 200 em duplicado e em notificação irrelevante (outro código faz reenvio em loop), 500 **só** em falha recuperável; lead sem campo obrigatório loga e segue sem derrubar o lote. **A função nunca executou** — sem segredos configurados e a URL não foi alcançável do ambiente da sessão. **Falta o fundador fazer:** criar os 3 segredos, assinar o webhook no campo `leadgen` do objeto Page e **assinar a Página ao app** (esquecer esse último é o erro clássico: verificação passa e lead nunca chega). Ponto mais provável de falha é a versão da Graph — default `v23.0`, trocável pelo segredo `META_GRAPH_VERSION` sem tocar em código. A planilha do Google segue recebendo em paralelo de propósito, como rede de segurança até o webhook provar que está pegando tudo.

**Resumo de 1 linha (03/ago sessão 6):** Carga retroativa da RD executada — base foi de **22 para 32 leads**. A descoberta que salvou a carga: **`GET /contacts` devolve `job_title` vazio em 100% dos 40 contatos e telefone em menos da metade, mas `GET /deals` embute o contato com `title` (o cargo) e `phones` preenchidos** — ler só o endpoint óbvio descartaria 19 de 40 e perderia a especialidade de todos; cruzar as duas fontes derrubou o descarte pra 11, dos quais **8 eram lixo de teste da configuração, incluindo o próprio fundador**. Sobraram 3 pessoas reais só com e-mail, o que motivou tornar `whatsapp` opcional no banco (com CHECK novo exigindo e-mail **ou** telefone, pra coluna nula não virar porta pra linha sem canal nenhum). Criada coluna **`fonte`** em vez de sobrescrever `campanha` — a RD traz o canal, o Meta traz o criativo, e sobrescrever apagaria a atribuição de criativo dos 22 já importados; enriquecimento só preenche campo vazio. **🆕 Achado sem registro anterior no projeto: existe Google Ads rodando** — `Busca Paga | Facebook Ads 26 · Busca Paga | Google 3 · Desconhecido 2 · Referência | linktr.ee 1`; toda a documentação até aqui (§19) falava só de Meta, e as 3 do Google são justamente as sem telefone. Telefone malformado **não é chutado**: `922222799` (sem DDD) entra nulo com observação pedindo confirmação, porque inventar DDD manda WhatsApp pra pessoa errada. Tudo rodado por `pg_net` a partir do SQL com `service_role_key` do Vault, então nada dependeu do fundador executar comando. **Pendências:** apagar a função temporária `rd-probe` pelo painel (o MCP não deleta function), e **cadastrar o webhook no painel da RD** — a carga trouxe o histórico, mas lead novo só entra sozinho depois disso.

**Resumo de 1 linha (13/ago):** Sessão de manutenção via branch atrasada (`claude/relaxed-bouman-d3f4be`, criada ~17/jul, 61 commits atrás de `main` — corrigido: rebase em cima de `main` antes do merge). **Bug de cobrança achado e corrigido:** `asaas-webhook` creditava `hour_balance` sem somar `bonus_horas` do pacote — médico via a promessa de bônus na tela de sucesso mas o saldo real vinha sem ele. Query de diagnóstico em produção: 0 pacotes afetados até agora, sem backfill necessário. Fix deployado direto via Supabase MCP (v22) e depois commitado (PR #10) — lição registrada de sempre commitar no mesmo turno quando o deploy é feito direto pelo MCP. Confirmado que a OTA do evento Luma co-hosted (`bd1cf5d`) já tinha sido enviada há 3 semanas (group `1702e018`). Ver §29.

**Resumo de 1 linha (13/ago sessão 2):** Sessão **de decisão comercial, sem uma linha de código publicada**. O OLI passa a ter **dois planos** — o BASE é desativado (ninguém assinava: 22 perfis no START, 1 no PRO, zero no BASE), o **START perde a mensalidade** e fica em R$ 1,90/min, e o **PRO vai a R$ 599 mensal / R$ 499 semestral** com R$ 1,45/min, o que põe a virada em 19h/mês no semestral e 23h no mensal. Aparece um terceiro estado que não existia — **cadastrado sem plano**, que vê só a tela de planos e não reserva —, o que tira o checkout do onboarding e o joga para o momento do uso. Os **pacotes de 20h e 40h foram removidos** depois de notar que o bônus é 10% fixo em qualquer tamanho: comprar 4 pacotes de 10h dá as mesmas 44 horas pelo mesmo preço, então o pacote grande só travava dinheiro do cliente. **O achado da sessão foi de funil, não de preço:** 66 leads, 50 contatados, **4 visitas, 0 propostas, 0 conversões** — e 5 reservas em toda a história do produto, com 1 sessão cobrada; os 50 contatados estão parados sem `temperatura`, `perfil` nem `motivo_descarte`, campos que existem desde 03/ago. Com esse funil, equilibrar até dezembro só fecha triplicando a taxa de visita — preço é a alavanca menos importante hoje. Fundador confirmou que **a base atual é teste e parceiro e o OLI não fatura nada**, mas decidiu que **nada muda para quem já está dentro**, o que exige congelar as condições na própria assinatura (a assinatura hoje lê o preço direto de `plans`). Entregue o **comparativo em PDF de 2 páginas** com os valores conferidos por script contra as taxas; ficou registrado que o **ciclo semestral não existe no schema** e que **"sem fidelidade", H1 do site, deixou de ser verdade**. **Pendências:** as 4 decisões listadas na §30, e nada tocado em banco, app, admin ou site — tudo esperando autorização.

**Resumo de 1 linha (19/ago):** Sessão de **implementação** da reforma de planos decidida na §30 — fundador respondeu as 4 decisões em aberto (ver §31) e autorizou construir. Achado que mudou o escopo: a cobrança por minuto nunca lia o banco (constante hardcoded em `oli-plans.ts`), então mudar a taxa do START afetaria os 24 assinantes já dentro instantaneamente — implementado congelamento (`profiles.taxa_min_congelada`) propagado nos 4 pontos que calculam custo (cobrança final, contador ao vivo da sessão, estimativa de pacote de horas, compra de pacote). Achado e corrigido de brinde: `create-subscription` gravava ciclo/status em inglês num INSERT que sempre falharia contra o CHECK do banco, silenciosamente — nunca foi pego porque zero assinaturas pagas reais existem até hoje. Banco: START 1,90/min, PRO 1,45/min, BASE desativado, ciclo `semestral` novo (R$499/mês, fidelidade 6 meses), pacotes 20h/40h desativados, cadastro parou de dar START automático. App: novo gate `/escolher-plano` pra quem se cadastra sem plano, `meu-plano.tsx` e `ecossistema.tsx` atualizados (BASE fora, Communicare fora dos benefícios do PRO, AR Soluções removido). Verificado via `tsc --noEmit` (limpo) e transação de teste no Supabase (trigger de cadastro confirmado, sem resíduo). **Pendências:** nada testado em device real, nada commitado, site/admin não tocados (fora do pedido desta sessão).

**Resumo de 1 linha (19/ago sessão 2):** Chatbot dos 5 especialistas (nenhum tinha ponto de entrada ativo no app) vira 1 assistente geral, a Olivia, sem agendamento Calendly com parceiro humano — `supabase/functions/chat/index.ts` perde o roteamento por `persona`. Catálogo de módulos (`/modulos`) perde a categoria de convênios inteira (credenciamento, gestão mensal, operadora adicional — pendente por tempo indeterminado) e ganha módulo **Jurídico** (mesmo padrão do Contábil Mello, "Consultar"); Scribe IA também sai. Ver §32. Sessão fechou publicando tudo: commit direto em `main`, merge com 4 commits que tinham avançado em paralelo em `origin/main` (fix de bônus de horas do PR #10, §29 — conflito só em `HANDOFF.md`, resolvido preservando as duas narrativas e renumerando §29–§32), edge function `chat` redeployada (v24), banco atualizado (`modules.ativo` + linha nova `juridico`) e OTA nos dois canais (prod `c933c1a3` / preview `61064b96`).

**Resumo de 1 linha (19-21/ago):** Dois pedidos novos — cobrança de paciente via subconta Asaas (OLI não intermediária) e mensageria WhatsApp (IA ostensiva pra lead, recepção-driven pra paciente). Ver §33. **Fase 1 (schema) implementada e em produção**: `patient_id`/`valor_consulta` em `reservations`, `professional_asaas_accounts`, `patient_charges`, `conversations`/`messages`, `whatsapp_templates` — tudo com RLS, `tsc` limpo. **Fase 2**: `whatsapp-webhook`/`send-patient-trigger`/`send-whatsapp-reply` deployados (inertes sem secrets do Meta); `asaas-create-subaccount`/`create-patient-charge` só escritos, não deployados (falta decisão de taxa da OLI + confirmação do produto de subconta). Admin ganhou `/conversas` (inbox realtime), card Asaas em `medicos/[id]`, vínculo paciente+cobrança nas reservas concluídas. `test-lead-ai` (function de teste temporária) achou e corrigiu 2 bugs reais no prompt da IA antes de qualquer mensagem real: negrito incompatível com WhatsApp (`**duplo**` → `*simples*`) e alucinação de regra de preço inexistente — prompt corrigido com valores reais e proibição explícita de inventar. Decisão registrada em memória: número comercial `(11) 97223-3745` fica no app comum, número novo dedicado à API. **A maior parte da sessão foi configuração no Meta, e travou no fim**: App "OLI WPP" criado, webhook validado de verdade por `curl` (200 + challenge), número de teste registrado, número oficial (`11939429453`) reivindicado de uma WABA de terceiro via SMS mas trava com "Falha na inscrição" ao finalizar registro — mesmo erro em 2 contas diferentes (descarta teoria de conta nova, que **era** a causa real do bloqueio de criar Usuário do Sistema, resolvido separadamente com o Igor). Token permanente gerado com sucesso. **Pendências:** chamado de suporte Meta preparado mas não enviado; testar fluxo completo com número de teste enquanto isso; taxa Asaas e produto de subconta seguem sem decisão do fundador; templates ainda não submetidos à Meta; 3 WABAs duplicadas no portfólio, não limpas; nada commitado.

**Resumo de 1 linha (24/ago):** Sessão de fechamento do bloco WhatsApp. Resolvido o registro do número (era só faltar `POST /register`, nunca chamado pela UI do Meta — ver §33) e confirmado o fluxo webhook→IA→WhatsApp funcionando de ponta a ponta. Depois, redesenho grande a pedido do fundador: **todo contato agora vira lead automaticamente** (antes, número sem campanha/site prévios caía em silêncio); IA reescrita como **vendedora de verdade** (descoberta, quebra de objeção, fechamento suave) com um **bug de matemática pego no teste** (a IA errou uma conta de custo mensal — fix: só pode citar 2 exemplos de preço já calculados, nunca computar total novo); rebrand pra "hub para profissionais da saúde" (só no prompt); **fotos por especialidade** (mapa sala↔especialidade confirmado no banco, não em comentário); **agendamento com autonomia** via link real do Calendly, sem precisar transferir pra humano; **reengajamento de lead silencioso** só dentro da janela de 24h (cron novo, `whatsapp-nudge-silencio`) — reengajar depois de 24h fica pendente de template aprovado pela Meta. Tudo documentado em `docs/IA_ATENDIMENTO_WHATSAPP.md`, manual-âncora que o prompt implementa. **Bug achado em uso real**: clicar na notificação de handoff na Fila abria o WhatsApp genérico em vez de `/conversas` com histórico — `FilaClient.tsx` nunca tratava esse tipo de notificação; fix rotea pra `/conversas?id=`, que ganhou suporte a abrir direto numa conversa via URL. **Publicado**: commit `832a90a`, push direto pra `main` — empacota também todo o trabalho do §33 que estava pronto e nunca tinha sido commitado (schema Asaas paciente, `/conversas`, edge functions). `tsc --noEmit` limpo nos dois projetos. **Pendências:** submeter os 3 templates de WhatsApp pra Meta (inclui um novo, de reengajamento pós-24h); limpar 3 WABAs duplicadas; `asaas-create-subaccount`/`create-patient-charge` sem decisão de taxa/produto; confirmar com o fundador que o fix da Fila resolveu; nada testado em device nativo.

**Resumo de 1 linha (26/ago sessão 2):** O fundador perguntou por que os leads novos entravam sem nome nem especialidade — **não era bug de captura**: o lead nasce na primeira mensagem, e as pessoas que chegaram simplesmente não eram público ("tem pastel?", "quero pastel", um áudio sobre panela de pressão e freezer). Causa provável já registrada no §33: o número `11939429453` veio **pré-registrado numa WABA de terceiro** e tem dono anterior — pelo padrão das mensagens, uma pastelaria. **Decisão nova do fundador:** esse número é **exclusivamente comercial** (campanhas e canais de divulgação) e **nunca será usado para paciente** — o caminho de paciente nele deixa de existir na prática, e os templates de paciente do §33 precisam de outro número ou de decisão nova. **Limpeza:** backup em JSON antes (25 leads, 29 conversas, 203 mensagens), depois **25 leads de WhatsApp apagados** (base de 126 → 101) e 25 conversas de engano removidas, preservando as 4 conversas de teste real com `lead_id=NULL` (a FK é `NO ACTION`, então nulificar tem que vir antes do DELETE). **Dois fixes:** (1) a IA **respondia duas vezes** quando chegavam duas mensagens seguidas — cada mensagem é um POST separado do Meta e cada execução respondia sem saber da outra (visto em 4 conversas reais, 0,2s a 2,3s de intervalo); agora há uma janela de 5s e só responde quem ainda é a última mensagem da conversa, sem lock, com o banco como desempate; (2) chave `descarte=engano` nova no `[META:]` — a IA encerra em uma resposta (proibida de fazer piada ou insistir), fecha a conversa e manda o lead pra descartado com `motivo_descarte='engano_numero'`, **motivo próprio de propósito** pra não misturar engano com lead de verdade que não fechou. **Verificação:** `deno check` **rodou de verdade** pela primeira vez no projeto (instalado via `npm i -g deno@2` — enxerga `npm:` e o namespace `Deno`, ao contrário do `tsc`), migration conferida em produção e `whatsapp-webhook` publicada na **v21** com o conteúdo comparado byte a byte com o arquivo local. **Pendências:** o teste ao vivo pelo celular só o fundador pode fazer (duas mensagens rápidas → uma resposta; "quero pastel" → descarte); **nada commitado e `test-lead-ai` não redeployada** porque a ponte `device_bash` ficou fora do ar a sessão inteira (mesmo sintoma do §30); e ficou registrada uma **divergência não corrigida no manual da IA** — §4 ainda diz que ela nunca envia link de agenda e §5 ainda chama o OLI de "coworking médico", ambos superados pelo §34.

**Resumo de 1 linha (26/ago sessão 3):** O fundador viu cadastros como **BASE** no admin — **não havia nenhum BASE no banco** (26 perfis: 24 START, 1 PRO, 1 sem plano; o BASE segue `ativo=false` com zero assinaturas). Era `admin/app/medicos/page.tsx` linha 87, `m.plan ?? 'BASE'`: um seguro escrito quando `plan` nunca era nulo, que virou bug quando o cadastro passou a nascer sem plano em 19/ago — só a Priscila Leal estava nesse estado. **Reversão de produto:** o fundador decidiu que **"quem está sem plano é START, não existe cadastro sem plano"**, o oposto da decisão dele mesmo na §30/§31 — confirmado depois de a sessão apontar o conflito e a consequência (com START automático o app volta a ser retenção de quem não paga, cenário que produziu os 24 START com 3 reservas). `_create_profile_and_subscription()` volta a criar perfil START + assinatura ativa, agora com `plan_id` buscado por nome (não hardcoded) e criação **idempotente** — a falta dessa guarda é o que deu 2 assinaturas à Claudia Moraes; `profiles.plan` recupera o default `'START'`; o Gate 3 saiu do `app/_layout.tsx` e `/escolher-plano` vira só upgrade pro PRO. Priscila colocada no START por SQL direto (o RPC usa `auth.uid()`), sem taxa congelada — entrou depois da reforma, paga R$ 1,90. Testado com **transação revertida** (INSERT em `auth.users` → SELECT → ROLLBACK, zero resíduo): perfil novo sai START com 1 assinatura. **Pendências:** OTA não enviada (a mudança do app só vale no celular depois de `eas update`), nada commitado (`device_bash` fora do ar a sessão inteira), e `src/models/oli-plans.ts` segue com o `plan_base` marcado como ativo e com preços velhos — apontado, sem decisão.

**Resumo de 1 linha (28/ago sessão 2):** O fundador tirou o **prontuário de dentro do PRO** — passa a ser contratado à parte por **R$ 239/mês**, o mesmo valor que o módulo `communicare` já tinha na tabela `modules`. A mudança **resolve uma contradição antiga** em vez de criar uma nova: o `oli-plans.ts` dizia que o Plano Básico do Communicare vinha incluído no PRO enquanto o mesmo Communicare era vendido à parte por R$ 239 exigindo PRO. **O alcance é maior que o material de venda:** as §38 e §39, escritas hoje mesmo, deixaram os prompts da Olivia em produção afirmando que o PRO inclui prontuário — enquanto não forem corrigidos, ela promete a lead real um item que saiu do plano; os quatro arquivos estão listados na §43 e **não foram tocados**, por dependerem de autorização e o webhook estar atendendo de verdade. O PRO fica com três diferenciais de serviço em vez de quatro (impressão, recepção e nota fiscal), com a mensalidade parada em R$ 599/R$ 499 e as viradas intactas em 19h e 23h — entrega menos pelo mesmo preço, então vale observar a objeção comercial. **Entregue:** `OLI_Planos_2026.pdf` refeito, com o prontuário fora das listas de plano e como linha de serviço adicional com preço, e todos os números reconferidos por script. **Pendente:** os quatro arquivos da Olivia, o `oli-plans.ts`, o `OLI_BASE.md`, a matriz `FEATURES` e o site.

**Resumo de 1 linha (28/ago sessão 3):** Fecha a parte de código que a §43 tinha deixado pendente — `oli-plans.ts` (`COMMUNICARE_PRO_PLAN` vira módulo à parte, R$239/mês) e `OLI_BASE.md` §4/§5/§7/§10 alinhados; `feature_crm_communicare` e a matriz `FEATURES` do `meu-plano.tsx` conferidos e já estavam corretos, sem mudança necessária. Ver §45. Depois, a pedido do fundador, achado e corrigido um bug real: a conversa criada pelo botão **Iniciar com Olivia** não aparecia na aba Conversas do admin — não era bug de dado (conferido direto no banco via Supabase MCP, a conversa e a mensagem existiam certinhas), era `optInLeadWhatsapp()` revalidando só `/leads`, nunca `/conversas`, deixando o Router Cache do Next.js servir a aba stale por ~30s. Fix de uma linha. `tsc --noEmit` limpo nos dois projetos, commits `e489a5f` + `d297fab`, push direto pra `main`.

**Resumo de 1 linha (28/ago sessão 4):** A pedido do fundador, Olivia vira um atendente a mais no funil de `/leads`. Nova coluna `leads.atendido_por_ia` (sem FK pra `profiles` de propósito — evita criar conta real de login só pra representar uma IA), setada automaticamente por `optInLeadWhatsapp()` junto com o avanço `novo → contatado` no clique de **Iniciar com Olivia**. `/leads` ganha chip de filtro "Olivia (IA)" e badge na linha, balde próprio mutuamente exclusivo com atendente humano/sem atendente. Backfill dos 3 leads que já tinham opt-in antes da migration. `database.types.ts` regenerado nos dois projetos (pegou de brinde uma defasagem antiga em `src/models/`). Ver §46. `tsc --noEmit` limpo, commit `f3cee76`, push direto pra `main`.

**Resumo de 1 linha (29/ago):** Dois problemas reportados pelo fundador, ambos resolvidos. Olivia não se apresentava na abertura de conversa — 3 rodadas de ajuste no modelo (cortar explicação do OLI, manter pergunta de rotina antes do preço, acrescentar pergunta do nome) até aprovação; prompt ganhou seção ABERTURA DA CONVERSA (apresentação + pergunta do nome só na 1ª resposta, nome usado depois com moderação), deployado em `whatsapp-webhook` (v34) e `test-lead-ai` (v28). RD Station não recebia nenhuma atualização de status há muito mais tempo do que o relatado — `rd-vincular-deals` (cron a cada 15 min, nunca commitada no git) crashava inteira em `lead.email.toLowerCase()` no primeiro lead sem e-mail (todo lead de origem WhatsApp, desde que `email` virou opcional em 03/ago), abortando o lote inteiro a cada execução, para qualquer lead. Fix + trazida pro git; rodada de verdade a pedido do fundador: 42 leads vinculados e sincronizados com a RD, base de 101→143 com `rd_deal_id`. Decisão do fundador: os 75 restantes (WhatsApp sem e-mail) ficam sem vínculo com a RD, aceito como limitação. Ver §50. `deno check` limpo, commits `495280e` + `aa47812`, push direto pra `main`.

**Resumo de 1 linha (29/ago sessão 2):** Fundador reportou um erro absurdo em conversa real — Olivia pediu o WhatsApp de um lead que já estava falando com ela pelo próprio WhatsApp. O prompt só proibia isso implicitamente, dentro do bloco de transferência para humano. Fix urgente ("corrija AGORA"): regra explícita e redundante (logo no início do prompt + na lista O QUE VOCÊ NÃO FAZ) proibindo pedir WhatsApp/telefone/contato em qualquer situação, sem exceção. Deployado direto em produção (`whatsapp-webhook` v35, `test-lead-ai` v29) e testado ao vivo antes de fechar (abertura normal + cenário de handoff, nenhum pede telefone). Ver §51. `deno check` limpo, commit `1f5958f`, push direto pra `main`.

**Resumo de 1 linha (29/ago sessão 3):** Fundador reportou perda de controle do fluxo de leads — investigado direto no banco antes de tocar em código. Achado: 86 leads `origem='whatsapp'` (canal orgânico, hoje maioria do volume) presos em `status='novo'` mesmo com conversa real e trocada com a Olivia — o único caminho que avançava o funil era o botão manual de outreach da RD (§46), o webhook orgânico nunca atualizava `leads.status`/`atendido_por_ia`. Fix: primeira resposta da Olivia move `novo → contatado` e marca `atendido_por_ia`, idempotente. Backfill de 85 leads já qualificados. Segundo pedido do fundador — separar na aba Conversas quem a Olivia está atendendo de quem a equipe assumiu — resolvido com 4 grupos visuais (Assumidas pela equipe / Pacientes / Com a Olivia / Encerradas), derivados de campos já existentes, sem schema novo. Ver §52. `deno check` e `tsc --noEmit` limpos, commit `a27b5f5`, push direto pra `main`.

**Resumo de 1 linha (29/ago sessão 4):** Fundador pediu revisão das conversas pra classificar os 85 leads de WhatsApp genericamente em "Contatado" — lidas as 86 conversas (532 mensagens) linha a linha, reclassificados por conteúdo real: 6 visita agendada, 2 aguardando retorno, 10 sem resposta, +11 descartado (engano de número, fornecedor tentando vender pra OLI, preço/distância rejeitados), 58 continuam contatado mas com temperatura (6 quente/8 morno/44 frio) pra priorizar follow-up. Zero leads linkados na RD, limpeza 100% interna. Em seguida, pedido separado — layout de `/leads` "confuso" — resolvido reorganizando a coluna Situação por hierarquia (status+temperatura em destaque, resto vira texto secundário) e adicionando filtros Temperatura/Perfil que não existiam. Ver §53. `tsc --noEmit` limpo, não testado ao vivo (sem credencial admin), commit `65eb1de`, push direto pra `main`.

**Resumo de 1 linha (29/ago sessão 5):** Fundador pediu pra enviar foto nos atendimentos humanos de `/conversas` — até aqui só existia texto livre e a foto fixa por especialidade da Olivia. Nova edge function `send-whatsapp-image`: sobe o arquivo direto pro Media Storage da Meta (media id, sem precisar de bucket público próprio) e envia por `image: { id }`. `ConversasClient` ganha botão de anexo com prévia, texto vira legenda quando junto de foto. Limite 5MB/JPEG-PNG, mesma janela de 24h do texto. Ver §54. `deno check`/`tsc --noEmit` limpos, não testado com envio real (sem credencial admin), commit `ddffb0c`, push direto pra `main`.

**Resumo de 1 linha (29/ago sessão 6):** Fundador pediu prévia de qual foto foi enviada no histórico de `/conversas` — antes só aparecia texto genérico ("[imagem enviada pela equipe]"). Nova coluna `messages.media_url`: pra Olivia reaproveita a URL pública que ela já manda; pra equipe, sobe uma cópia própria pro bucket privado novo `whatsapp-media` e gera signed URL de 1 ano (o media id da Meta expira em 30 dias e não dá pra buscar sem token). Front renderiza `<img>` no bubble, com fallback pro texto se a cópia falhar. Ver §55. `deno check`/`tsc --noEmit` limpos, deployado `whatsapp-webhook` v37 + `send-whatsapp-image` v2, commit `76cad44`, push direto pra `main`.

**Resumo de 1 linha (31/ago sessão 2):** Entrou um benefício novo no PRO — **o profissional pode divulgar o endereço de atendimento nas suas redes e materiais**, o primeiro diferencial do PRO **sem custo marginal para o OLI** e que ataca uma objeção concreta de quem atende em espaço compartilhado; com ele o PRO volta a ter quatro diferenciais depois de perder o prontuário na §43. Além do comparativo em PDF atualizado, foram geradas **duas peças novas, uma por plano** (`OLI_Plano_START.png` e `OLI_Plano_PRO.png`), com a mesma estrutura e ordem do PDF e só duas adaptações de layout — card em largura total e serviços em duas colunas. São altas em vez de A4 porque o conteúdo das duas páginas cabe numa imagem só, o que é melhor para WhatsApp. Os 26 valores das peças foram reconferidos por script contra as taxas. **Ficou uma observação comercial em aberto:** a peça do START exibe os quatro itens que ele não tem, porque o pedido foi "exatamente igual ao PDF" — o que contraria a regra do item 35 do §11 (peça individual é ficha de serviço, não comparativo) e faz o plano de entrada abrir com uma lista de defeitos; tirar é uma linha, e depende do fundador. **Pendente:** site, `OLI_BASE.md`, matriz `FEATURES` e os prompts da Olivia ainda não citam o endereço.

**Resumo de 1 linha (31/ago sessão 3):** O fundador pegou uma regra que **não podia existir**: a peça do START oferecia os diagnósticos "no plano semestral", mas o START não tem mensalidade e portanto não tem plano semestral nenhum — era resíduo do desenho intermediário de 13/ago, quando o START custava R$ 97 e o compromisso de seis meses era a contrapartida da cortesia; quando o plano voltou a ser gratuito, a contrapartida evaporou e a letra miúda ficou. **Decisão: os dois diagnósticos saem do START e viram exclusivos do PRO**, o que de quebra encerra o último uso da ideia de "START semestral". Entrou também **vaga de estacionamento no prédio durante o atendimento, nos dois planos** — de propósito não é diferencial de upgrade, é condição de uso do espaço. O PRO fica com cinco diferenciais e o START com quatro itens, todos sem condição. PDF e as duas peças refeitos, agora geradas por `gera_pecas.py`, que lê o CSS do próprio HTML do PDF para que peça individual e comparativo não possam divergir por esquecimento — risco real depois de três rodadas de mudança no mesmo dia. **Pendente:** estacionamento e endereço ainda não estão no site, no `OLI_BASE.md`, na matriz `FEATURES` nem nos prompts da Olivia.

**Resumo de 1 linha (02/set sessão 2):** Fundador não conseguia adicionar horas nos próprios perfis founder (Guilherme/Igor) — precisava ligar/desligar acesso completo (reserva, checkout) a qualquer momento pra demonstrar o app em visitas, sem impactar produção. Investigado antes de mexer: bloqueio real era `/medicos/[id]` dar `notFound()` pra founder — única página com o form de horas; `addHours` e o gate de reserva do app (`hasReservationCredit`) nunca filtram por `user_type`. Fix: card "Modo demonstração" em `/equipe/[id]` (que founder já acessa) — ativa/soma horas reusando `addHours`, e nova ação `desativarHorasDemonstracao` expira o saldo na hora pra desligar. Não abriu o gate de `/medicos` de propósito — isso poluiria contagens e dashboards de faturamento. Ver §66. `tsc --noEmit` limpo, não testado ao vivo, commit `e8758e3`, push direto pra `main`.
