# Reorganização do Admin OLI Health Hub — design

Data: 19/11/2026 · Autor: Claude, com decisões do fundador (Guilherme) · Escopo deste documento: visão geral das 4 fases e **detalhe só da Fase 1**.

## 1. Intenção e por quê

O Admin (`admin/`, Next.js 14 na Vercel) tem **29 rotas e 21 itens de menu**. A equipe (Cláudia, recepção; Igor) tem dificuldade de entender o fluxo e onde cada coisa entra. Causas medidas:

- O dinheiro aparece em 6 telas com fontes diferentes (`/financeiro`, `/recebimentos`, `/fluxo-de-caixa`, `/contas`, `/pagamentos`, "Receita" do Dashboard).
- A Fila e seu badge no menu contam 46 notificações não lidas, quase todas informativas (`new_signup` 22 e `reservation_created` 20, que ninguém marca como lida) e sem uma ação clara. (A tabela `admin_notifications` tem 559 não lidas no total, mas 501 são WhatsApp e 12 de lead, tipos que a Fila e o badge já excluem; o número de 559 **não** é o do badge.)
- Leads e Conversas são a mesma tarefa em duas telas (817 leads, 751 conversas, todas de lead).
- Telas de recurso quase sem uso têm o mesmo peso no menu que as principais: Fornecedores 0 registros, Promoções 0, Módulos contratados 1, Comunidade 1 post.
- 6 telas estão fora do menu (`/contas`, `/fornecedores`, `/horas`, `/planos`, `/modulos`, `/medicos/excluidos`) e `/pagamentos` não tem link de lugar nenhum.

Objetivo: um Admin que a recepção entenda sozinha, em **6 itens de menu**, sem perder função nem dado.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Menu com 6 itens: **Hoje, Reservas, Profissionais, Comercial, Financeiro, Configurações**.
- A recepção abre o Admin e vê: reservas do dia, pacientes agendados e pendências acionáveis.
- Toda tela atual continua acessível (agora como aba do grupo certo) e todo endereço antigo redireciona para o novo.

**Não-objetivos (Fase 1)**
- Fundir o conteúdo de Leads+Conversas (Fase 3), unificar as fontes financeiras (Fase 2), ficha do profissional com abas (Fase 4).
- Perfis de acesso (`recepcao`/`financeiro`/`dono`): fica para depois; hoje é `is_admin` sim/não.
- Faturamento mensal, conciliação do Inter, extrato de horas, correção do check-in/out, mudanças no app mobile, Communicare.

**Anti-objetivos (seria fracasso mesmo que "funcione")**
- Perder qualquer função, dado ou link salvo.
- Mostrar dado de paciente além de **nome e inicial do sobrenome**.
- Badge ou contador que não signifique uma ação a tomar.

## 3. Restrições

- Next.js 14 App Router, páginas `force-dynamic`, Supabase; `staleTimes.dynamic = 0` em `next.config.mjs` (manter).
- `admin/app/actions.ts` (1.422 linhas) chama `revalidatePath` com rotas antigas (`/horas`, `/conversas`, `/medicos`, `/leads`, `/fluxo-de-caixa`, `/equipe`, `/usuarios`, `/planos`, `/cupons`, `/contas`, `/recebimentos`, `/promocoes`, `/parceiros`, `/fornecedores`, `/notificacoes`, `/modulos`, `/comunidade`). Ao mover páginas, **atualizar todas**.
- Os 12 testes Playwright em `admin/e2e/` apontam para as rotas antigas (`07-planos`, `08-modulos`, `09-horas`, `10-pagamentos`, `03-fila`, `12-sidebar-navigation` etc.).
- O repositório é **público**: nada de segredos ou dados reais de paciente em código, testes ou docs.
- Padrão visual existente: tokens Tailwind `oli-*` (`oli-green`, `oli-sidebar`, `oli-dark`, `oli-border`), `lucide-react`, `ActionForm` para formulários com server action (`{ ok, message }`).
- O Admin deve funcionar em celular (a Sidebar já vira gaveta).

## 4. Abordagens consideradas

- **A. Reagrupar primeiro, fundir depois — ESCOLHIDA.** Menu novo + "Hoje" nova; telas antigas viram abas do grupo certo, quase sem reescrever; redirects dos endereços antigos. Fases 2–4 fundem o conteúdo. Troca: por um tempo há conteúdo repetido por baixo das abas.
- B. Mover e fundir tudo de uma vez. Resultado final mais cedo, mas mudança grande, difícil de revisar/reverter, e atrasa faturamento e Inter.
- C. Só menu e "Hoje", sem abas. Rápido, mas o menu de 6 itens ficaria enganoso, sem onde as telas soltas morarem.

## 5. Estrutura final (visão das 4 fases)

| Item | Rota base | Conteúdo ao fim das 4 fases |
|---|---|---|
| Hoje | `/` | Pendências, reservas do dia com paciente, salas agora, atividade recente |
| Reservas | `/reservas` | Mapa das salas, Histórico, Minutagem (Fase 4: filtro por data/profissional, tudo numa lista) |
| Profissionais | `/medicos` | Lista + ficha 360 com abas (Resumo, Plano e contrato, Horas/extrato, Reservas, Financeiro, Documentos, Pacientes); Horas, Assinaturas, Módulos contratados e Excluídas viram abas/filtros |
| Comercial | `/comercial` | Inbox único Leads+Conversas; Campanhas (Cupons, Promoções) |
| Financeiro | `/financeiro` | Visão geral, A receber (faturamento), Recebido (Asaas+Inter+dinheiro, conciliação), A pagar (contas+fornecedores), Fluxo de caixa |
| Configurações | `/configuracoes` | Catálogo, Pessoas e acessos (Usuários, Equipe, Parceiros), Notificações push, Comunidade, Totem QR, Meu Recebimento (só fundador) |

Ordem das fases: 1 menu+Hoje+abas · 2 Financeiro unificado · 3 Comercial · 4 Profissional com abas. A reorganização vem **antes** do faturamento mensal, da conciliação do Inter e da fila de check-outs.

## 6. Fase 1 — detalhe

### 6.1 Menu e rotas

Mover as páginas fisicamente (`git mv`) para as novas rotas, com um `layout.tsx` por grupo que renderiza uma barra de abas (componente novo `TabNav`). Sem reescrever o conteúdo das telas antigas.

| Grupo | Abas (rota nova ← rota antiga) |
|---|---|
| Hoje `/` | — (página nova) |
| Reservas | Mapa das salas `/reservas` ← `/salas` · Histórico `/reservas/historico` ← `/historico` · Minutagem `/reservas/minutagem` ← `/pagamentos` |
| Profissionais | Lista `/medicos` · Horas `/medicos/horas` ← `/horas` · Assinaturas `/medicos/assinaturas` ← `/planos` · Módulos `/medicos/modulos` ← `/modulos` · Excluídas `/medicos/excluidos` (já existe). `/medicos/[id]` não muda. |
| Comercial | Leads `/comercial` ← `/leads` · Conversas `/comercial/conversas` ← `/conversas` · Cupons `/comercial/cupons` ← `/cupons` · Promoções `/comercial/promocoes` ← `/promocoes` |
| Financeiro | Resumo `/financeiro` (inalterado, mantém as abas internas existentes até a Fase 2) · Recebimentos `/financeiro/recebimentos` ← `/recebimentos` · Contas `/financeiro/contas` ← `/contas` · Fluxo de caixa `/financeiro/fluxo` ← `/fluxo-de-caixa` · Fornecedores `/financeiro/fornecedores` ← `/fornecedores` |
| Configurações | Catálogo `/configuracoes` ← `/catalogo` · Usuários `/configuracoes/usuarios` ← `/usuarios` · Equipe `/configuracoes/equipe` ← `/equipe` (inclui `[id]` e `novo`) · Parceiros `/configuracoes/parceiros` ← `/parceiros` · Notificações `/configuracoes/notificacoes` ← `/notificacoes` · Comunidade `/configuracoes/comunidade` ← `/comunidade` · Totem `/configuracoes/totem` ← `/totem` · Meu Recebimento `/configuracoes/meu-recebimento` ← `/meu-recebimento` (visível só ao fundador, como hoje) |

Redirects em `next.config.mjs` (`redirects()`, não permanentes nesta fase) de **todas** as rotas antigas para as novas. `/fila` → `/`. Verificado: as únicas rotas dinâmicas ou com subcaminho são `/equipe/[id]` e `/equipe/novo` (use `/equipe/:path*`) e `/medicos/[id]` (não se move); não há `route.ts` nem `/leads/[id]`, `/conversas/[id]` ou `/cupons/novo`. O Next repassa a query string nos redirects, e `/financeiro?mes=...` não muda de endereço. Ordem dos redirects não importa, pois nenhuma origem é prefixo de outra.

Atualizar: todos os `href` internos (por exemplo `CatalogoClient` aponta para `/planos`, `/modulos`, `/horas`; `FinanceiroClient` para `/recebimentos`, `/contas`, `/fornecedores`; `app/page.tsx` para `/horas`), todos os `revalidatePath` em `actions.ts`, o `Sidebar` (ativo por prefixo de rota, não só igualdade), os testes e2e, o comentário do `Sidebar` ("9 itens") e o `MANUAL.md` (documenta 10 itens, defasado).

O badge da Fila sai do menu. O `layout.tsx` raiz deixa de consultar `admin_notifications` para o contador do menu.

### 6.2 Tela "Hoje" (`/`)

Substitui Dashboard, Mapa do Dia (como entrada) e Fila. Seções, de cima para baixo:

1. **Cabeçalho:** data, "N reservas · M pendências".
2. **Pendências** (só o que exige ação; cada linha leva à tela onde se resolve):
   Tolerância e fuso: todas as regras usam America/Sao_Paulo (reaproveitar o cálculo de "dia" de `app/page.tsx`) e a mesma tolerância de 30 min após o `end_time`.
   - Check-out aberto: reserva `em_uso` cujo `end_time` + 30 min já passou (inclui as antigas; lista as 10 mais recentes e mostra o total).
   - Reserva vencida sem check-in: `agendado` com `end_time` + 30 min já passado, nos últimos 14 dias, no máximo 10 linhas. As mais antigas ficam só em Reservas.
   - Comercial, **só contagens com link para `/comercial`, sem listar linhas** (evita inundar a tela): "N leads novos ou sem resposta" (`leads` em `novo` e `sem_resposta`, hoje 12 e 11) e "M conversas aguardando nossa resposta" (regra `precisaNossaResposta` de `ConversasClient`: status diferente de `fechada` e última mensagem inbound, limitada aos últimos 7 dias, porque o total histórico é 151). As duas contagens são medidas diferentes, sem deduplicação.
   - Assinaturas PRO com `status = 'active'` e `ends_at` em até 7 dias (cancelada não conta; START tem `ends_at` nulo). No PRO mensal em dinheiro isso significa "precisa faturar".
3. **Reservas do dia:** horário, sala, profissional, status, **paciente** (campo editável inline, ver 6.3). Ordenadas por horário.
4. **Salas agora:** um painel novo, lendo a tabela `rooms` (9 salas) e as reservas em andamento. **Não** reaproveitar `components/LiveRooms.tsx`: nenhuma página o usa, ele fixa só 5 salas (a Sala 7 da Rose ficaria de fora) e compara status em inglês.
5. **Atividade recente:** as notificações operacionais que a Fila mostrava (`new_signup`, `reservation_created`, `plan_*`, `module_*`, `hour_package_*`), as 10 mais recentes não lidas, reaproveitando `FilaClient` (que já marca como lida). Preserva a função da Fila. **Sem alteração de dados:** as 46 não lidas atuais ficam como estão; não marcar nada em massa.
6. Atalho "Abrir Totem QR".

O bloco estático "Dica operacional" do Dashboard (aviso de médicos com saldo de horas zerado, link para `/horas`) **sai**; saldo de horas volta como pendência quando existir o extrato de horas.

Saem: gráfico de rosca, ranking de salas, "Receita hoje/mês" (soma `usage_charges.valor_total`, que não é dinheiro recebido) e o resumo do mês. A "Visão do mês" de receita real fica no Financeiro.

**Status de reserva — correção incluída no escopo.** O banco usa `agendado`, `em_uso`, `concluido` (e `cancelado`), mas Dashboard, Mapa e Histórico comparam com `scheduled`, `active`, `completed`, `cancelled`, `no_show`. Criar um único helper (`lib/reservation-status.ts`) que mapeia os valores reais (e aceita os legados em inglês) para rótulo e cor, e usá-lo em **Hoje, Mapa e Histórico**.

### 6.3 Paciente na reserva (decisão do fundador: "Cláudia digita + app depois")

- Nova coluna `reservations.patient_label text` (nullable), migration `supabase/migrations/20261119_reservations_patient_label.sql`. Formato orientado: nome + inicial do sobrenome ("Maria S."), máximo 60 caracteres, sem telefone, CPF ou motivo da consulta.
- Texto livre, **não** `patient_id`: esse vínculo exige um registro completo de paciente com CPF e consentimento, o que a recepção não precisa para cumprimentar alguém.
- Escrita pelo Admin por server action nova (`setReservationPatientLabel`) com `createSupabaseAdmin` (service role), validação (trim, limite, sem números longos que pareçam CPF/telefone) e retorno `{ ok, message }` via `ActionForm`.
- **Quais reservas aceitam rótulo:** qualquer reserva do dia (`agendado`, `em_uso`, `concluido`).
- **LGPD:** registrar em `audit_logs` (colunas `professional_id` = quem acessou, `action`, `target_type`, `target_id`, `metadata`) cada escrita (criar, alterar, limpar) e a visualização, esta no máximo **uma vez por dia por admin** quando a "Hoje" exibir ao menos um rótulo. **O texto do rótulo nunca vai para o log**: `metadata` guarda só ids de reserva e contagens, então o log não contém dado de paciente e não precisa ser apagado.
- **Retenção:** **7 dias** contados do `end_time` da reserva; um job `pg_cron` diário (`pg_cron` e `pg_net` já estão instalados) grava `NULL` em `patient_label` das reservas com `end_time` anterior a 7 dias. Prazo ajustável.
- As políticas atuais de RLS de `reservations` ("Reservas próprias" ALL e `reservations_admin_select` SELECT) já permitem que o profissional escreva o próprio rótulo no futuro campo do app; **o app não muda na Fase 1**.

### 6.4 Entrega e verificação

- Branch `feat/admin-reorganizacao` em worktree; **nada entra em `main` sem aprovação do fundador**. Preview da Vercel para Cláudia e Igor olharem antes.
- **Acesso:** o middleware segue checando só `is_admin`. Na Fase 1 ninguém perde acesso a nada (a Cláudia já vê tudo hoje); só "Meu Recebimento" continua restrito ao fundador, pela regra atual do `Sidebar`, que passa a valer também para a rota nova.
- `tsc` e `next build` limpos; testes e2e atualizados: `e2e/12-sidebar-navigation.spec.ts` (hoje lista 10 rotas com títulos de `h1`, e um deles já está desatualizado: `/pagamentos` espera "Pagamentos" mas o título é "Minutagem por Sessão") é reescrito para os 6 itens e suas abas, mais um teste que confere que cada rota antiga redireciona para a nova; os specs 03, 04, 05, 07, 08, 09 e 10 mudam para as rotas novas; verificação visual da "Hoje" e das abas no preview (o login admin não está disponível no navegador do Claude, então a verificação visual pode depender do fundador).
- Registrar a mudança em `docs/HANDOFF.md` (nova seção) e atualizar `admin/MANUAL.md`.
- Design da "Hoje" com a skill `emil-design-eng`, seguindo os tokens existentes.

## 7. Deixado ao construtor

Estilo exato da `TabNav`, nomes de componentes e arquivos, como o `Sidebar` marca o grupo ativo, textos dos estados vazios, ordem e visual dos cartões da "Hoje", o desenho da consulta de "conversa não lida", e como o preview da Vercel é disparado.

## 8. Decisões do fundador (registro)

- Menu de 6 itens e abordagem A (reagrupar primeiro): aprovados.
- Pacientes na "Hoje": Cláudia digita agora, campo no app depois (caminho 3); armazenamento em texto livre, nome + inicial, 7 dias: aprovado.
- Rotina da recepção: ver pacientes agendados, ver se há reservas no dia, ver se há algo pendente.
