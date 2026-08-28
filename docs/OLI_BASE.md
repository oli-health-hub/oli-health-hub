# OLI Health Hub — Documento Base do Negócio

> Documento-âncora: quem somos, o que vendemos, planos, preços e condições.
> Fonte da verdade de negócio. Atualizar sempre que preço, plano ou produto mudar.
> **Versão:** 1.0 · **Data:** 17/Junho/2026
>
> Fontes de dados internas: `src/models/oli-plans.ts` (preços/feature flags), `docs/HANDOFF.md` (estado operacional), `CLAUDE.md` (arquitetura).

---

## 1. Quem somos

**OLI Health Hub** é um **coworking médico físico** com um **ecossistema digital de gestão e serviços** para profissionais de saúde.

Não vendemos apenas sala por hora. Entregamos infraestrutura clínica premium + tecnologia (app próprio) + uma rede de assessorias especializadas (contábil, jurídica, convênios, carreira) que normalmente o profissional teria que contratar e gerenciar separadamente.

**Proposta de valor:** o profissional chega, atende e cresce — sem custo fixo de consultório, sem gerir fornecedores avulsos, com a operação (recepção, agenda, NF, cobrança) cuidada pela OLI.

**Público-alvo:** médicos e profissionais de saúde de nível superior (CRM, CRP, CRN, CRO…) — autônomos (PF), PJ ou ambos — que atendem presencial e/ou por telemedicina.

---

## 2. Modelo de negócio

Receita composta por **5 fontes**:

1. **Mensalidade de plano** (recorrente) — BASE/PRO.
2. **Minutagem** — cobrança por minuto de uso real de sala (todos os planos).
3. **Pacotes de horas** — pré-compra de horas com bônus.
4. **Módulos / add-ons** — serviços de parceiros (contábil, jurídico, convênios, CRM avançado).
5. **Locação de salas de evento/conferência** *(em roadmap — ver §8)*.

**Por que minutagem:** a sala é custo **fixo** para a OLI. Cada minuto vendido é margem ~100% (menos ~2% de taxa Asaas). Isso permite oferecer o plano START gratuito como funil e ganhar na escala de uso.

**Break-even do negócio (modelo acordado):** custo fixo ~R$ 50.000/mês, premissa 20h/médico/mês → **≈ 24 médicos** para empatar (mix BASE/PRO). Cada médico adicional ≈ +R$ 2.100/mês.

---

## 3. Produtos

| Produto | O que é | Stack | Hospedagem |
|---|---|---|---|
| **App do Médico** | Gestão de reservas, pacientes, finanças, acesso ao ecossistema, IA | React Native + Expo (iOS + Android) | App Store + Google Play |
| **Painel Admin** | Operação OLI: médicos, cobranças, pipeline de upsell | Next.js | Vercel |
| **Site Institucional** | Captação, download, política de privacidade, página de indicação | HTML estático | Netlify (`olihealthhub.com.br`) |

**Backend comum:** Supabase (Postgres + Auth + RLS + Edge Functions + Storage). **Pagamentos:** Asaas. **IA:** Claude (Haiku) via Edge Function.

**Status de lançamento (17/jun/2026):**
- **Google Play:** em Internal Testing (AAB de produção pronto). Falta liberação pública (Data Safety/rating/listing + 14 dias de closed testing).
- **iOS:** TestFlight (canal production).

---

## 4. Soluções (o que o ecossistema entrega)

1. **Salas clínicas sob demanda** — reserva, encaixe, check-in por QR, timer de sessão sem drift.
2. **CRM de pacientes** — cadastro com consentimento LGPD, CPF hasheado, histórico.
3. **Gestão operacional pela OLI** (planos superiores) — recepção, agenda, emissão de NF.
4. **Assessorias especializadas** — contábil (Mello), jurídica (Ana), convênios e carreira (AR Soluções).
5. **Assistentes de IA** — 5 personas especializadas (ver §9).
6. **Comunidade + eventos** — feed Luma real (workshops/eventos OLI).
7. **CRM clínico Communicare** (módulo pago à parte, qualquer plano) — prontuário, agenda online, pagamento integrado *(integração em andamento — ver §10)*.

---

## 5. Planos e preços

> Fonte única: `src/models/oli-plans.ts`. VIP em desenvolvimento — **não projetar/vender ainda**.

| Plano | Mensalidade | R$/min | Desconto minutagem | Status |
|---|---|---|---|---|
| **START** | R$ 0 | R$ 2,00 | — | Ativo (default no signup) |
| **BASE** | R$ 299 | R$ 1,50 | −25% vs START | Ativo |
| **PRO** | R$ 599 | R$ 1,30 | −35% vs START | Ativo · *Mais popular* |
| **VIP** | — | — | — | Em breve (standby) |

### O que cada plano inclui

| Recurso | START | BASE | PRO |
|---|:--:|:--:|:--:|
| App (timer, agenda própria, pacientes) | ✅ | ✅ | ✅ |
| Comunidade | ✅ | ✅ | ✅ |
| Conforto médico (infra premium) | — | ✅ | ✅ |
| Impressão | — | — | ✅ |
| Diagnóstico contábil / convênios / jurídico (sessão única) | — | ✅ | ✅ |
| Gestão de agenda pela recepção OLI | — | — | ✅ |
| Emissão de NF gerenciada pela OLI | — | — | ✅ |
| Nível de suporte | Essencial | Essencial | Profissional |

> Serviços "plenos" (gestão contínua AR, jurídico contínuo, contabilidade inclusa, gestão de carreira) ficam reservados ao **VIP** quando lançado.
>
> CRM Communicare (prontuário) não é benefício de nenhum plano — é módulo pago à parte, R$ 239/mês, para quem contratar (ver §7/§10).

### Break-even entre planos
Calculado sobre a diferença de minutagem, não sobre o valor cheio da mensalidade.

| Virada | Horas/mês | Conta |
|---|---|---|
| START → BASE | **~10h** | R$ 299 ÷ (R$ 0,50 × 60) |
| START → PRO | **~14h** | R$ 599 ÷ (R$ 0,70 × 60) |
| BASE → PRO | **25h** (exatos) | (R$ 599 − R$ 299) ÷ (R$ 0,20 × 60) |

Abaixo de 10h/mês o START é o mais econômico. Em 25h/mês BASE e PRO custam o mesmo (R$ 2.549); acima disso o PRO fica mais barato **e** inclui agenda e NF pela recepção OLI.

> ⚠️ Este bloco dizia **~17h** até 03/ago, com a conta `R$ 299 ÷ (R$ 0,30 × 60)` — a diferença de R$ 0,30/min é de uma tabela de preços antiga. A diferença real START→BASE é **R$ 0,50/min**. O site e a função `calcBreakevenHours()` sempre estiveram certos (~10h); só a documentação e o comentário no código é que estavam velhos.

---

## 6. Pacotes de horas (pré-compra com bônus)

Custo calculado pela minutagem do plano ativo, **só sobre as horas pagas** (bônus é cortesia). Saldo decrementado por minuto; esgotado, volta à minutagem avulsa.

| Pago | Bônus | Total |
|---|---|---|
| 10h | +1h | 11h |
| 20h | +3h | 23h |

> Crédito manual de horas pelo admin = **cortesia/sem custo** (não gera cobrança Asaas).

---

## 7. Módulos / Add-ons (serviços de parceiros)

| Módulo | Parceiro | Preço | Status |
|---|---|---|---|
| Honorários Contábeis — Simples Nacional | Contábil Mello | **R$ 460/mês** | Ativo |
| Honorários Contábeis — Lucro Presumido | Contábil Mello | **R$ 632/mês** | Ativo |
| Abertura de Empresa (SP) | Contábil Mello | **R$ 1.200** (avulso) | Ativo |
| Cadastramento em Convênios | AR Soluções | a definir | Preço pendente |
| Gestão de Agenda / Retenção | AR Soluções | a definir | Preço pendente |
| Otimização de Carreira Médica | AR Soluções | a definir | Preço pendente |
| Consulta Jurídica Avulsa | Ana (sócia) | a definir | Preço pendente |
| Consultoria Jurídica Contratual | Ana (sócia) | a definir | Preço pendente |
| CRM Communicare (Plano Básico / prontuário) | Communicare (Heitor) | **R$ 239/mês** | Ativo *(inerte até token — ver §10)* |

> Regra AR/Jurídico: preço avulso = valor de referência VIP × 1,15 (aplicar após validação com parceiros). Add-ons marcados `includedInVip` entram no VIP sem cobrança à parte quando lançado.

### Módulos Communicare (opcionais, além do Plano Básico)
- Teleconsulta — **R$ 97**/profissional
- Scribe IA — **R$ 149**/profissional
- Chat Omnichannel Digisac — R$ 197 base (até 2 atendentes) + R$ 30/atendente extra *(contratação direta com Digisac, não passa pela OLI)*

---

## 8. Salas de Evento e Conferência *(roadmap — preços a validar)*

Novo tipo de sala, cobrança **por bloco/hora** (não minutagem — evento é planejado).

| Sala | Capacidade | Cobrança | Preço sugerido | Mínimo |
|---|---|---|---|---|
| **Conferência** | 6–12 pax | bloco/hora | R$ 150/h | 1h |
| **Eventos** | 20–40 pax | bloco/hora | R$ 280/h · pacote 4h R$ 960 | 2h |

**Benchmark SP (cowork médico premium):** conferência R$ 80–300/h; evento/workshop R$ 150–500/h (diária 4h R$ 800–1.500).
**Implementação:** novo `room_type` com `hourly_rate` + `min_duration` (sem timer de minutagem). **Preço final pendente de validação do fundador.**

---

## 9. Assistentes de IA (chatbot)

5 personas via Claude (Haiku), na Edge Function `chat`:

| Persona | Nome | Especialidade |
|---|---|---|
| `ana` | Ana Luiza | Direito Médico (CFM, LGPD, contratos) |
| `isabella` | Isabella | Contabilidade Médica (PJ, impostos) |
| `convenios` | Amanda | OLI Convênios (TISS, credenciamento) |
| `carreira` | Ronaldo | OLI Carreira (captação, posicionamento) |
| `olivia` | Olivia — **"Assistente Virtual OLI"** | App, salas, planos, reservas, eventos |

---

## 10. Communicare (CRM clínico — módulo pago à parte)

> ⚠️ Até 28/ago este Plano Básico era descrito como incluso no PRO — contradição com o preço à parte já cobrado pelo módulo `communicare` desde 22/jul. Resolvido pelo lado do "é à parte": nenhum plano inclui prontuário.

Plano Básico do Communicare, **R$ 239/mês, contratado à parte de qualquer plano**: prontuário eletrônico, agenda online, lembretes, pagamento integrado via Asaas (split clínica × profissional), NF automática, dashboards (NPS, carteira), modelos clínicos, logins administrativos ilimitados.

**Estado:** integração técnica construída no app mas **inerte** (aguardando token + endpoints do parceiro Heitor). Sync invisível de decisão, visível de status (badges ✓ Sincronizado / Pendente). Master de cadastro = Communicare; mapa de salas continua na OLI.

---

## 11. Programa de Indicação

Indicador ganha **+60 min / 90 dias** quando o indicado completa o onboarding (crédito automático server-side, idempotente, sem auto-indicação). Compartilhamento via link `olihealthhub.com.br/baixar?ref=CÓDIGO`; indicado pode digitar o código manualmente no cadastro.

---

## 12. Condições e regras gerais

- **Cobrança:** via Asaas (PIX/boleto/cartão). Taxa ~2%. Webhook confirma pagamento e ativa plano/módulo.
- **Minutagem:** taxa do plano é "fotografada" no início da sessão — mudança de plano não afeta sessão em andamento.
- **START:** plano de entrada gratuito; em roadmap auto-desativar após 30 dias sem reserva.
- **LGPD (Lei 13.709/2018):** dados de saúde = sensíveis (Art. 11). CPF nunca em texto puro (hash SHA-256); consentimento explícito; export/exclusão de conta (Art. 18); audit log de acesso (Art. 37); nenhum dado de saúde via WhatsApp (só logística).
- **VIP:** não comercializar nem prometer — preço e escopo ainda em definição.

---

## 13. Paleta de marca

| Cor | Hex | Uso |
|---|---|---|
| oliGreen | `#5F7D67` | Principal |
| oliGold | `#B8893C` | Destaques / plano |
| oliBackground | `#F4EFEA` | Fundo creme |
| oliDarkGray | `#2F2F2F` | Texto principal |
| oliLightGray | `#6B6B6B` | Texto secundário |
| oliRed | `#D9534F` | Alertas |

---

*Manutenção: ao alterar preço/plano/módulo, editar `src/models/oli-plans.ts` (código) **e** este documento. Estado operacional/deploys ficam em `docs/HANDOFF.md`.*
