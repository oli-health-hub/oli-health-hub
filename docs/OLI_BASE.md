# OLI Health Hub — Documento Base do Negócio

> Documento-âncora: quem somos, quem é quem, o que vendemos, planos, preços e condições.
> Fonte da verdade de negócio. Atualizar sempre que preço, plano, produto ou quadro societário mudar.
> **Versão:** 2.0 · **Data:** 02/Setembro/2026 (v1.0 era de 17/jun e ficou 2,5 meses defasada)
>
> Fontes internas: `src/models/oli-plans.ts` (catálogo em código), `docs/HANDOFF.md` (estado operacional e histórico de decisão), `docs/ROADMAP.md` (retrato de arquitetura), `CLAUDE.md` (convenções).

---

## 1. Quem somos

**OLI Health Hub** é um **coworking médico físico** com um **ecossistema digital de gestão** construído por cima dele.

Não vendemos apenas sala por hora. Entregamos infraestrutura clínica pronta + tecnologia própria (app do profissional, painel de operação, atendimento comercial por IA) + apoio administrativo (recepção, agenda, nota fiscal) que o profissional teria que montar e gerenciar sozinho.

**Proposta de valor:** o profissional chega, atende e cresce — sem aluguel fixo, pagando pelo tempo real de sala, com a operação cuidada pela OLI a partir do plano PRO.

**Público-alvo:** profissionais de saúde de nível superior (CRM, CRP, CRN, CRO…) — autônomos (PF), PJ ou ambos — que atendem presencial e/ou por telemedicina. **Não é só médico**: a base já tem nutricionista, psicólogo, dentista e esteticista, e foi por isso que "Médicos" virou "Profissionais" no painel.

**Unidade:** Rua Marquês de Paranaguá, 348 — Edifício Ralph Center, Consolação, São Paulo/SP.
**9 salas em operação:** 4 de clínica geral (3, 5, 6, 7), 1 de psicologia (2), 1 de ginecologia + estética (8), 1 de vídeo conferência (1), 1 audiovisual (4), 1 de eventos (9).
**Custo fixo:** R$ 50.000/mês.

---

## 2. Quem é quem

| Pessoa | Papel |
|---|---|
| **Cesar** | Sócio, **investidor e conselheiro**. Tomador de decisão para estrutura física e caminho organizacional. É hoje o único elo com conselho consultivo e com respaldo para novos aportes. |
| **Guilherme Pasquetti** | **Diretor de Operações.** Concentra as decisões de precificação, produto, comercial e parceria. |
| **Igor Oliveira** | Sócio-fundador. Acesso pleno ao painel, envolvido na configuração comercial. |
| **Ana** | Sócia **e** parceira externa — presta assessoria jurídica remunerada aos clientes, sob demanda. |
| **Edna** | Sócia. Gestão de pessoas, organização e conforto dos espaços e da estrutura. |
| **Claudia Moraes** | Equipe operacional — recepção, atendimento e fluxo comercial no painel. |

> ⚠️ **`user_type='founder'` no banco é rótulo técnico de papel de acesso, não título societário.** Guilherme e Igor têm esse rótulo; só o Igor é sócio-fundador. Não confundir os dois em material externo.
>
> ⚠️ **Partes relacionadas sem política escrita:** a assessoria jurídica da Ana (sócia prestando serviço remunerado ao cliente) e o mecanismo de comissão de indicação, que já calculou valor devido a membro da própria operação. Registrado para a consultoria de governança.

---

## 3. Modelo de negócio

Receita composta por **5 fontes**:

1. **Mensalidade de plano** (recorrente) — hoje só no PRO.
2. **Minutagem** — cobrança por minuto de uso real de sala, em todos os planos. É o motor.
3. **Pacotes de horas** — pré-compra com 10% de bônus.
4. **Módulos / add-ons** — serviços de parceiros.
5. **Locação de salas de evento/conferência** *(roadmap — ver §9, preço nunca validado)*.

**Por que minutagem:** a sala é custo **fixo** para a OLI. Cada minuto vendido é margem ~100% (menos ~2% de taxa Asaas). Isso permite oferecer o START sem mensalidade como porta de entrada e ganhar escala no uso, não na adesão.

**Receita por profissional a 20h/mês** (preços de out/2026) — o PRO sai mais barato que o START a partir de ~10h/mês:

| Plano | Conta | Receita/mês |
|---|---|---|
| START | 1.200 min × R$ 1,29 | **R$ 1.548** |
| PRO mensal | R$ 299 + 1.200 × R$ 0,79 | **R$ 1.247** |
| PRO semestral | R$ 199 + 1.200 × R$ 0,79 | **R$ 1.147** |

Com os preços de outubro a receita por profissional caiu de 32% (START) a 47% (PRO mensal) frente aos valores anteriores, a 20h/mês (START de R$ 2.280 para R$ 1.548; PRO mensal de R$ 2.339 para R$ 1.247). O risco do START é atrair cadastro que **nunca usa a sala** — comportamento já observado (24 cadastros gratuitos, 3 com alguma reserva).

---

## 4. Capacidade e ponto de equilíbrio

Pela métrica de ocupação usada no `/meu-recebimento` (horas reservadas ÷ salas × dias do mês × 15h úteis):

| | Número |
|---|---|
| Capacidade teórica | **4.050 h/mês** (9 salas × 15h × 30 dias) |
| Horas necessárias para empatar | **~480 h/mês** (24 profissionais × 20h) |
| **% da capacidade instalada** | **~12%** |
| Salas efetivamente lotadas nesse cenário | 2 a 4 |

**O negócio empata usando cerca de um oitavo da estrutura que já paga.** O problema não é capacidade nem preço — é volume de profissional ativo.

Pagantes necessários conforme o mix (recalculado após a reforma de agosto):

| Cenário | Pagantes para empatar |
|---|---|
| Todos a 20h/mês | ~22 |
| Realista — 60% START a 8h + 40% PRO a 25h | ~30 |
| Conservador — uso mais baixo em ambos | ~38 |

---

## 5. Planos e preços

> Fonte em código: `src/models/oli-plans.ts` (preços de START e PRO atualizados em 02/out; `plan_base` ainda aparece como ativo, pendência de 26/ago). **Preços de outubro/2026 definidos pelo fundador em 02/10** — banco (`plans`), app, termos, site e prompts da Olivia já foram atualizados em 02 e 05/10; o app só passa a cobrar o valor novo na sessão depois do OTA (ver `HANDOFF.md` §76). Vale para todos os assinantes: o congelamento de taxa foi removido em 05/10.

| Plano | Mensalidade | R$/min | Hora cheia | Status |
|---|---|---|---|---|
| **START** | sem mensalidade | R$ 1,29 | R$ 77,40 | Ativo — **padrão automático no cadastro** |
| **PRO** | R$ 299/mês · **R$ 199/mês no semestral** (fidelidade 6 meses) | R$ 0,79 | R$ 47,40 | Ativo |
| ~~BASE~~ | — | — | — | Desativado (`ativo=false`), zero assinantes, fora da vitrine |
| ~~VIP~~ | — | — | — | Nunca lançado — não projetar nem vender |

### O que cada plano inclui

| Benefício | START | PRO |
|---|:--:|:--:|
| Sala equipada, sob demanda | ✅ | ✅ |
| App (agenda, tempo de sala, pacientes) | ✅ | ✅ |
| Comunidade e eventos | ✅ | ✅ |
| Vaga de estacionamento durante o atendimento | ✅ | ✅ |
| Conforto médico | nos dias de atendimento | acesso completo |
| Site (LP) e cartão de visita | — | ✅ |
| ~~Conversa com contador e com advogado~~ — fora por enquanto (05/out) | — | — |
| Impressão | — | ✅ |
| Recepção (agendamento, cobrança, retorno) | — | ✅ |
| **Endereço comercial** (sem endereço fiscal, a princípio) | — | ✅ |
| Emissão de nota fiscal | — | ✅ |

> O **endereço comercial** é o único diferencial do PRO **sem custo marginal para a OLI** — serve para divulgar (Instagram, Google, material) e **não** para domiciliar a empresa. Entrou em 31/ago com escopo só de divulgação, foi ampliado para comercial e fiscal em 02/set e **voltou a só comercial em 05/out** (decisão do fundador, a princípio).
>
> O **estacionamento** valeu nos dois planos entre 31/ago e 02/set, foi restrito ao PRO e **voltou a valer nos dois planos em 05/out** (decisão do fundador, a princípio).
>
> **Prontuário eletrônico não é benefício de plano nenhum** — é serviço do parceiro Communicare, apenas indicado (ver §8).

### Ponto de virada entre os planos

Calculado sobre a diferença de minutagem (R$ 0,50/min), não sobre a mensalidade cheia:

| Virada | Horas/mês | Conta |
|---|---|---|
| START → PRO mensal | **~10h** (9,97 exatas) | R$ 299 ÷ (R$ 0,50 × 60) |
| START → PRO semestral | **~7h** (6,6 exatas) | R$ 199 ÷ (R$ 0,50 × 60) |

Abaixo de ~7h/mês o START é sempre mais econômico para o profissional — e ainda entrega margem maior por minuto para a OLI.

---

## 6. Regra de cobrança (premissa — não pode divergir em nenhuma frente)

| | Regra |
|---|---|
| Compra de horas | **Só em blocos de 1 hora.** Nunca menos. É preciso ter saldo para reservar. |
| Reserva | Múltiplos de 30 min (reserva de 30 min é válida e desconta só 30 min do saldo) |
| Consumo | Por minuto, dentro da reserva |
| Excedente | Arredonda para os próximos 30 min; passou de 30 sem checkout, cobra mais 30 |

`src/services/usageChargeService.ts` (`calcUsageCharge`) já implementa isso corretamente — **não "consertar" achando que deveria ser hora cheia**.

⚠️ **Armadilha de copy:** nunca escrever "pague só os minutos que usar" ou dar exemplo tipo "consulta de 50 min por R$ X" — implica comprar minutos avulsos, que não existe. O certo é "compre horas e use por minuto; a sobra fica no saldo".

**Taxa congelada por perfil:** `profiles.taxa_min_congelada` guarda a taxa de quem entrou antes da reforma de 19/ago (`NULL` = usa a taxa viva). Mudar preço no catálogo **não** afeta quem já estava dentro.

---

## 7. Pacotes de horas

Custo calculado pela minutagem do plano ativo, só sobre as horas pagas (bônus é cortesia). Saldo decrementado por minuto; esgotado, volta à minutagem avulsa.

| Compra | Recebe | START | PRO | Validade |
|---|---|---|---|---|
| 1 hora | 1 hora | R$ 114 | R$ 87 | 30 dias |
| 10 horas | **11 horas** | R$ 1.140 | R$ 870 | 60 dias |

Os pacotes de 20h e 40h foram desativados em 19/ago: **o bônus é 10% fixo em qualquer tamanho**, então 4 pacotes de 10h dão as mesmas 44h pelo mesmo preço — o pacote grande só travava dinheiro do cliente.

> ⚠️ **Divergência aberta no banco:** `hour_packages.valor` guarda R$ 120 (avulso) e R$ 1.200 (10h) — valores da tabela antiga. A cobrança real ignora essa coluna e calcula `horas × 60 × plans.taxa_min`, então o cliente paga certo, mas **não usar essa coluna como fonte**.
>
> Crédito manual de horas pelo admin = **cortesia/sem custo** (não gera cobrança Asaas). É também o mecanismo do "Modo demonstração" dos perfis `founder`.

---

## 8. Módulos e parceiros

| Módulo | Parceiro | Preço | Status |
|---|---|---|---|
| Honorários Contábeis — Simples Nacional | Contábil Mello | **R$ 460/mês** | Ativo |
| Honorários Contábeis — Lucro Presumido | Contábil Mello | **R$ 632/mês** | Ativo |
| Abertura de Empresa (SP) | Contábil Mello | **R$ 1.200** (avulso) | Ativo |
| Consultoria Jurídica | Ana (sócia) | a definir | Ativo, sem tabela fechada |
| Teleconsulta | Communicare | R$ 97/profissional | Direto com o parceiro |
| Prontuário / CRM clínico | Communicare | **R$ 239/mês** | **Só indicação** — ver abaixo |

**Fora do quadro:**
- **AR Soluções** (convênios, gestão de agenda, carreira médica) — **não faz mais parte** dos parceiros. Categoria inteira removida do catálogo em 19/ago.
- **MBS Hackathon** — não faz mais parte do quadro.
- **Scribe IA** — saiu do catálogo (sem data prevista).

### Communicare — decisão de 02/set

O Communicare passa a ser **apenas um parceiro indicado**, contratado direto pelo profissional. **Não será mais absorvido como funcionalidade nativa do app.** A integração técnica construída (client, sync, SSO, 4 edge functions, migrations — ver `HANDOFF.md` §6 e `docs/COMMUNICARE_INTEGRATION.md`) fica **inerte por decisão de produto**, não mais por falta de token do parceiro.

---

## 9. Salas de Evento e Conferência *(roadmap — preço nunca validado)*

Cobrança por **bloco/hora** (não minutagem — evento é planejado).

| Sala | Capacidade | Preço sugerido | Mínimo |
|---|---|---|---|
| **Conferência** | 6–12 pax | R$ 150/h | 1h |
| **Eventos** | 20–40 pax | R$ 280/h · pacote 4h R$ 960 | 2h |

**Benchmark SP (cowork médico premium):** conferência R$ 80–300/h; evento/workshop R$ 150–500/h.
**Implementação:** novo `room_type` com `hourly_rate` + `min_duration`, sem timer de minutagem.

É a **única fonte de receita mapeada que não depende do funil de captação de profissionais** — e continua sem preço validado desde a concepção.

---

## 10. Aquisição e funil comercial

**Origens registradas:** `site`, `meta_ads`, `rd_station`, `whatsapp`, `indicacao`, `evento`, `outro`.
O **WhatsApp orgânico é hoje o maior canal de volume** — quem escreve direto para o número da Olivia sem passar por campanha.

**Esteira de 9 etapas:** `novo` → `contatado` → `sem_resposta` → `aguardando_retorno` → `visita_agendada` → `visita_realizada` → `proposta_enviada` → `convertido` / `descartado`. Sete delas têm par exato no funil do RD Station.

**Retrato da base (29/ago):** 218 leads · 143 vinculados ao RD Station · 86 conversas de WhatsApp revisadas uma a uma · 6 com visita agendada · 58 em acompanhamento com temperatura (6 quente / 8 morno / 44 frio) · 39 descartados com motivo.

**Achados de qualidade que impactam custo de aquisição:**
- ~1/3 da verba de tráfego pago comprava lead **fora do raio de visita presencial** (Recife, Londrina, Juiz de Fora, Santos, SJC, Ribeirão) — a oferta é presencial.
- Existe campanha de **Google Ads sem responsável identificado**.
- O número de WhatsApp comercial tem **passivo de dono anterior** (era de uma pastelaria) — gerou 25 leads de engano, apagados em ago.

---

## 11. Atendimento por IA — Olivia

**Uma única assistente**, não cinco personas (as 5 antigas — Ana Luiza, Isabella, Amanda, Ronaldo, Olivia — foram reduzidas a 1 em 19/ago; nenhuma tinha ponto de entrada ativo no app).

| Frente | O que faz |
|---|---|
| **App** (`app/chatbot.tsx` → edge function `chat`) | Tira dúvidas sobre salas, planos, reservas, módulos, eventos, comunidade e indicação. |
| **WhatsApp comercial** (`whatsapp-webhook`) | **Responsável comercial**: descoberta, quebra de objeção, foto por especialidade, agendamento de visita por link do Calendly, reengajamento de lead silencioso, handoff para humano. |

Documento-âncora do comportamento: **`docs/IA_ATENDIMENTO_WHATSAPP.md`** — o prompt em código implementa o manual, não o contrário.

**Regras duras:** nunca pede WhatsApp/telefone (o canal já é o WhatsApp); nunca inventa regra, preço ou política; nunca computa total novo, só cita exemplos já calculados; formatação `*asterisco simples*` (WhatsApp não renderiza `**duplo**`); paciente **nunca** é atendido por IA (travado no banco por constraint).

**Números:** número comercial `(11) 97223-3745` fica no WhatsApp Business App (recepção); número dedicado à Cloud API é o `11939429453`, **exclusivamente comercial — nunca usado para paciente**.

---

## 12. Programa de Indicação

Indicador ganha **+60 min / 90 dias** quando o indicado completa o onboarding — crédito automático server-side, idempotente, sem autoindicação. Compartilhamento via `olihealthhub.com.br/baixar?ref=CÓDIGO`; o indicado também pode digitar o código no cadastro.

Existe ainda um **programa de indicação de parceiros externos** (comissão em R$), com modelo fechado e mecanismo de atribuição construído, mas **nunca acionado comercialmente**.

---

## 13. Produtos e infraestrutura

| Produto | O que é | Stack | Hospedagem |
|---|---|---|---|
| **App do profissional** | Reservas, pacientes, financeiro, planos, comunidade, IA | React Native + Expo | App Store + Google Play (**publicado nas duas**) |
| **Painel Admin** | Operação: profissionais, pagamentos, salas, leads, conversas, faturamento | Next.js | Vercel |
| **Site institucional** | Captação, download, política de privacidade | HTML estático | **Vercel** (`olihealthhub.com.br`) — não é mais Netlify desde 21/jul |

**Backend comum:** Supabase (Postgres + Auth + RLS + Edge Functions + Storage). **Pagamentos:** Asaas, validado em produção ponta a ponta (mínimo R$ 5 por cobrança). **IA:** Claude Haiku via edge function. **Mensageria:** WhatsApp Business Cloud API, ativa desde 24/ago. **CRM comercial:** RD Station, espelhado por trigger no banco.

---

## 14. Condições e regras gerais

- **Cobrança:** via Asaas (PIX/boleto/cartão), taxa ~2%. Webhook confirma pagamento e ativa plano/módulo.
- **Minutagem:** a taxa é "fotografada" no início da sessão — mudança de plano não afeta sessão em andamento.
- **START:** padrão automático no cadastro desde 26/ago (a exigência de escolher plano, criada em 19/ago, foi revertida em 7 dias). Consequência assumida: o app volta a ser retenção de quem não paga.
- **LGPD (Lei 13.709/2018):** dados de saúde = sensíveis (Art. 11). CPF nunca em texto puro (hash SHA-256); consentimento explícito; export/exclusão de conta (Art. 18); audit log de acesso (Art. 37); nenhum dado de saúde via WhatsApp (só logística). **Pendentes:** consentimento com timestamp no banco, DPO designado, teste de intrusão.
- **VIP:** não comercializar nem prometer.

---

## 15. Paleta de marca

| Cor | Hex | Uso |
|---|---|---|
| oliGreen | `#5F7D67` | Principal |
| oliGold | `#B8893C` | Destaques / plano |
| oliBackground | `#F4EFEA` | Fundo creme |
| oliDarkGray | `#2F2F2F` | Texto principal |
| oliLightGray | `#6B6B6B` | Texto secundário |
| oliRed | `#D9534F` | Alertas |

---

*Manutenção: ao alterar preço/plano/módulo, editar `src/models/oli-plans.ts` (código), este documento **e** o material comercial (`gera_pecas.py`). O preço vive hoje em quatro lugares — banco, código, material e site — e já divergiu em todos. Estado operacional e histórico de decisão ficam em `docs/HANDOFF.md`.*
