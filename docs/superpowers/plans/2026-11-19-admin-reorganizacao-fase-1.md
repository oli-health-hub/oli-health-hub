# Reorganização do Admin, Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o menu do Admin por 6 itens (Hoje, Reservas, Profissionais, Comercial, Financeiro, Configurações), regrupar as telas atuais como abas com redirects dos endereços antigos, e criar a tela "Hoje" com pendências e pacientes agendados.

**Architecture:** Mover as páginas com `git mv` para as rotas novas, um `layout.tsx` por grupo com uma barra de abas (`TabNav`), redirects em `next.config.mjs`. A "Hoje" é nova: regras puras e testadas em `lib/`, carregador de dados no servidor, componentes em `components/hoje/`. O rótulo de paciente é uma coluna nova em `reservations`, apagada por `pg_cron` em 7 dias.

**Tech Stack:** Next.js 14.2 (App Router), React 18, Tailwind (tokens `oli-*`), `lucide-react`, Supabase (`@supabase/ssr`), Playwright, `node --test` (Node 25, TypeScript nativo) para testes unitários.

**Spec:** `docs/superpowers/specs/2026-11-19-admin-reorganizacao-design.md`

## Global Constraints

- Tudo em `admin/` salvo a migration (`supabase/migrations/`) e docs. Português do Brasil formal em todo texto de tela ("para", nunca "pra").
- Next.js 14 App Router, páginas `force-dynamic`; manter `experimental.staleTimes.dynamic = 0` em `next.config.mjs`.
- Fuso **America/Sao_Paulo** em qualquer cálculo de "dia"; tolerância de pendência **30 min** após `end_time`.
- Status de reserva reais no banco: `agendado`, `em_uso`, `concluido` (e `cancelado`). Os legados em inglês (`scheduled`, `active`, `completed`, `cancelled`, `no_show`) continuam aceitos.
- Rótulo de paciente: texto livre, **máximo 60 caracteres**, formato "Nome + inicial" (ex.: "Maria S."), sem sequência de 8 ou mais dígitos; retenção **7 dias** após `end_time`; **o texto nunca vai para `audit_logs`**.
- O repositório é público: nenhum segredo nem dado real de paciente em código, testes ou docs.
- Ações de servidor com feedback devolvem `{ ok: boolean; message: string }` (tipo `ActionResult` de `app/actions.ts`) e formulários usam `components/ActionForm.tsx`.
- Todo elemento interativo novo com `aria-label` ou texto acessível; layout funciona em celular (a `Sidebar` já vira gaveta).
- Nada entra em `main`; tudo em branch `feat/admin-reorganizacao`, com push só para gerar o preview da Vercel.

## Review Focus

1. Rótulo com CPF ou telefone digitado (ex.: "Maria 123.456.789-00"): rejeitado com mensagem clara (Task 3).
2. Reserva que cruza a meia-noite de São Paulo (23:30–00:30) e horário UTC que já é o dia seguinte mas ainda é "hoje" em SP: a "Hoje" não pode perder nem duplicar reservas (Task 4).
3. Link antigo com subcaminho e query: `/equipe/novo`, `/equipe/<id>`, `/fluxo-de-caixa?x=1` redirecionam sem perder nada (Task 6).
4. Reserva com status desconhecido ou em inglês legado: mostra rótulo neutro, não quebra a tela (Task 2).
5. Mais de 10 pendências do mesmo tipo ou nenhuma: mostra o total real e um estado vazio, nunca uma lista sem fim (Tasks 4 e 8).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `admin/lib/reservation-status.ts` (novo) | Normalizar status, rótulo e classes de cor |
| `admin/lib/patient-label.ts` (novo) | Validar e normalizar o rótulo de paciente |
| `admin/lib/hoje.ts` (novo) | Regras puras das pendências, janela do dia em SP, constantes |
| `admin/lib/hoje-data.ts` (novo) | Consultas ao Supabase que montam os dados da "Hoje" |
| `admin/lib/audit.ts` (novo) | Gravar em `audit_logs` sem texto de paciente |
| `admin/lib/nav.ts` (novo) | `isNavActive(pathname, href)` e definição das abas por grupo |
| `admin/lib/founder.ts` (novo) | `FOUNDER_EMAIL` e `isFounder(email)` num só lugar |
| `admin/lib/legacy-redirects.mjs` (novo) | Tabela de redirects antigos→novos |
| `admin/components/TabNav.tsx` (novo) | Barra de abas |
| `admin/components/hoje/*` (novos) | `PendenciasCard`, `ReservasDoDia`, `PacienteForm`, `SalasAgora`, `AtividadeRecente` |
| `admin/app/actions-hoje.ts` (novo) | Server action `setReservationPatientLabel` |
| `admin/app/page.tsx` (substituído) | Tela "Hoje" |
| `supabase/migrations/20261119_reservations_patient_label.sql` (novo) | Coluna + job de limpeza |

Testes unitários ao lado do código: `admin/lib/*.test.ts`. E2E em `admin/e2e/`.

---

### Task 1: Branch, worktree e linha de base

**Files:**
- Create: worktree `../OLIHealthHub-admin-reorg` na branch `feat/admin-reorganizacao`
- Commit: `docs/superpowers/specs/2026-11-19-admin-reorganizacao-design.md`, este plano

**Interfaces:**
- Produces: diretório de trabalho isolado onde todas as tarefas seguintes rodam.

- [ ] **Step 1:** Seguir `superpowers:using-git-worktrees`: `git worktree add ../OLIHealthHub-admin-reorg -b feat/admin-reorganizacao main` a partir de `/Users/guilhermepasquetti/Developer/OLIHealthHub`.
- [ ] **Step 2:** Copiar para o worktree, nos mesmos caminhos, o spec e este plano (hoje não rastreados na `main`) e commitar: `docs: design e plano da reorganização do Admin (Fase 1)`.
- [ ] **Step 3:** No worktree, `cd admin && npm ci`; copiar `admin/.env.local` do repositório principal (arquivo ignorado pelo git, não commitar).
- [ ] **Step 4:** Linha de base. Run: `cd admin && npx tsc --noEmit && npm run build`. Expected: ambos terminam sem erro. Se falharem, anotar o erro e parar: a base não está limpa.

---

### Task 2: Status de reserva (helper único) e infraestrutura de teste unitário

**Files:**
- Create: `admin/lib/reservation-status.ts`, `admin/lib/reservation-status.test.ts`
- Modify: `admin/tsconfig.json` (adicionar `"allowImportingTsExtensions": true`), `admin/package.json` (script `"test:unit": "node --test \"lib/**/*.test.ts\""`)

**Interfaces:**
- Produces:
  - `type ReservationStatusKey = 'agendado' | 'em_uso' | 'concluido' | 'cancelado' | 'nao_compareceu' | 'desconhecido'`
  - `normalizeReservationStatus(raw: string | null | undefined): ReservationStatusKey`
  - `reservationStatusLabel(key: ReservationStatusKey): string` (rótulos: "Agendada", "Em sessão", "Concluída", "Cancelada", "Não compareceu", "Status desconhecido")
  - `reservationStatusClass(key: ReservationStatusKey): string` (classes Tailwind de fundo e texto, mesmas famílias de cor já usadas nas telas)
  - `CANCELLED_STATUS_VALUES: readonly string[]` (`['cancelado','cancelled','no_show','nao_compareceu']`, para `.not('status','in', ...)`)
- Arquivos de `lib/` testados com `node --test` **não podem importar nada com alias `@/`** e importam outros módulos com extensão `.ts`.

- [ ] **Step 1:** Escrever `reservation-status.test.ts` com `node:test` e `node:assert/strict`. Casos: `'agendado'→'agendado'`, `'scheduled'→'agendado'`, `'em_uso'→'em_uso'`, `'active'→'em_uso'`, `'concluido'→'concluido'`, `'completed'→'concluido'`, `'cancelled'→'cancelado'`, `'no_show'→'nao_compareceu'`, `'EM_USO'→'em_uso'` (caixa), `null→'desconhecido'`, `'xpto'→'desconhecido'`; `reservationStatusLabel('em_uso') === 'Em sessão'`; `reservationStatusLabel('desconhecido') === 'Status desconhecido'`; `CANCELLED_STATUS_VALUES` contém `'cancelado'` e `'cancelled'`.
- [ ] **Step 2:** Run: `cd admin && npm run test:unit`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar o módulo com as assinaturas acima (mapa de normalização em minúsculas; sem enums).
- [ ] **Step 4:** Run: `npm run test:unit && npx tsc --noEmit`. Expected: PASS e sem erro de tipo.
- [ ] **Step 5:** Commit: `feat(admin): helper único de status de reserva e testes unitários`.

---

### Task 3: Validação do rótulo de paciente

**Files:**
- Create: `admin/lib/patient-label.ts`, `admin/lib/patient-label.test.ts`

**Interfaces:**
- Produces: `sanitizePatientLabel(input: string | null | undefined): { ok: true; value: string | null } | { ok: false; message: string }`
  - Vazio ou só espaços → `{ ok: true, value: null }` (limpa o rótulo).
  - Colapsa espaços internos; mais de 60 caracteres → `{ ok: false, message: 'Use no máximo 60 caracteres.' }`.
  - Qualquer sequência de 8 ou mais dígitos, com ou sem pontos, traços, espaços ou parênteses entre eles → `{ ok: false, message: 'Informe só o nome e a inicial do sobrenome, sem CPF ou telefone.' }`.
  - Caracteres de controle e `<`/`>` são removidos.

- [ ] **Step 1:** Escrever os testes: `'  Maria   S. '→{ok:true,value:'Maria S.'}`; `''→{ok:true,value:null}`; `'Maria 123.456.789-00'→ok:false` (mensagem do CPF); `'João (11) 91234-5678'→ok:false`; `'João 12345'→ok:true` (5 dígitos é permitido); string de 61 caracteres → `ok:false` com a mensagem de limite; `'<b>Ana</b> P.'→{ok:true,value:'bAna/b P.'}` (os caracteres `<` e `>` somem, o resto fica).
- [ ] **Step 2:** Run: `npm run test:unit`. Expected: FAIL.
- [ ] **Step 3:** Implementar. Detectar dígitos juntando só os caracteres `0-9` da string e checando blocos: a regra é "8 dígitos em sequência ignorando `. - ( ) espaço`"; uma regex sobre a string com esses separadores removidos resolve.
- [ ] **Step 4:** Run: `npm run test:unit`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): validação do rótulo de paciente`.

---

### Task 4: Regras puras das pendências e janela do dia em SP

**Files:**
- Create: `admin/lib/hoje.ts`, `admin/lib/hoje.test.ts`

**Interfaces:**
- Consumes: `normalizeReservationStatus` de `./reservation-status.ts`.
- Produces:
  - Constantes: `TOLERANCIA_MIN = 30`, `JANELA_VENCIDAS_DIAS = 14`, `LIMITE_LINHAS = 10`, `JANELA_CONVERSAS_DIAS = 7`, `ASSINATURA_AVISO_DIAS = 7`.
  - `spDayRange(now: Date): { startISO: string; endISO: string; label: string }` — início e fim do dia em São Paulo (UTC−03, sem horário de verão) como ISO em UTC; `label` = `'AAAA-MM-DD'` do dia em SP.
  - `interface ReservaMin { id: string; status: string | null; start_time: string; end_time: string }`
  - `isCheckoutAberto(r: ReservaMin, now: Date): boolean` — status normalizado `em_uso` e `now > end_time + 30 min`.
  - `isVencidaSemCheckin(r: ReservaMin, now: Date): boolean` — `agendado` e `now > end_time + 30 min` e `end_time >= now − 14 dias`.
  - `assinaturaVencendo(s: { status: string; ends_at: string | null; planName: string | null }, now: Date): boolean` — `status === 'active'`, plano `PRO`, `ends_at` não nulo, entre agora e agora + 7 dias.
  - `limitarComTotal<T>(itens: T[], limite?: number): { itens: T[]; total: number }`.

- [ ] **Step 1:** Testes: `spDayRange(new Date('2026-11-19T02:30:00Z')).label === '2026-11-18'` (ainda é 18/11 em SP) e `startISO === '2026-11-18T03:00:00.000Z'`; `spDayRange(new Date('2026-11-19T12:00:00Z')).label === '2026-11-19'`; reserva 23:30–00:30 SP aparece no dia da sua `start_time` (não duplica). `isCheckoutAberto`: `em_uso` com fim há 31 min → true, há 29 min → false; `active` legado conta como `em_uso`; `agendado` → false. `isVencidaSemCheckin`: `agendado` com fim há 31 min → true; há 15 dias → false; `concluido` → false. `assinaturaVencendo`: PRO `active` terminando em 3 dias → true; `cancelled` → false; START (`planName: 'START'`) → false; `ends_at: null` → false; terminando em 8 dias → false. `limitarComTotal([...12 itens])` → 10 itens e `total === 12`; `limitarComTotal([])` → `{ itens: [], total: 0 }`.
- [ ] **Step 2:** Run: `npm run test:unit`. Expected: FAIL.
- [ ] **Step 3:** Implementar. Aritmética de fuso com offset fixo de −3 h (o Brasil não usa horário de verão desde 2019); `spDayRange` deve ser exportada e usada por `hoje-data.ts` e pela página.
- [ ] **Step 4:** Run: `npm run test:unit`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): regras das pendências da tela Hoje`.

---

### Task 5: Migration do rótulo de paciente e limpeza em 7 dias

**Files:**
- Create: `supabase/migrations/20261119_reservations_patient_label.sql`

**Interfaces:**
- Produces: coluna `public.reservations.patient_label text null` com `check (char_length(patient_label) <= 60)`; job `pg_cron` `limpar_patient_label_reservas`.

- [ ] **Step 1:** Escrever a migration, idempotente: `alter table public.reservations add column if not exists patient_label text check (patient_label is null or char_length(patient_label) <= 60);` mais `comment on column` explicando LGPD e retenção; e o agendamento diário (06:15 UTC) que roda `update public.reservations set patient_label = null where patient_label is not null and end_time < now() - interval '7 days'`, protegido para não duplicar o job se a migration rodar duas vezes (`cron.unschedule` do mesmo nome antes, se existir). Não mexer nas políticas de RLS.
- [ ] **Step 2:** Aplicar no projeto `xwcarrurjvfxisuaihid` com a ferramenta `apply_migration` do Supabase MCP. A mudança é aditiva e não apaga dados; mesmo assim, é produção: relatar ao fundador antes de aplicar.
- [ ] **Step 3:** Verificar. Run (SQL): `select column_name, data_type from information_schema.columns where table_name='reservations' and column_name='patient_label';` Expected: 1 linha `text`. Run: `select jobname, schedule from cron.job where jobname='limpar_patient_label_reservas';` Expected: 1 linha com `15 6 * * *`.
- [ ] **Step 4:** Commit: `feat(db): coluna patient_label em reservations com limpeza em 7 dias`.

---

### Task 6: Mover as páginas, redirects, links e `revalidatePath`

**Files:**
- Move (`git mv`, **sem alterar o conteúdo** além de caminhos relativos de import):

| De | Para |
|---|---|
| `app/salas/` | `app/reservas/` (o `page.tsx` vira a aba Mapa em `/reservas`) |
| `app/historico/` | `app/reservas/historico/` |
| `app/pagamentos/` | `app/reservas/minutagem/` |
| `app/medicos/page.tsx` | `app/medicos/(lista)/page.tsx` |
| `app/medicos/excluidos/` | `app/medicos/(lista)/excluidos/` |
| `app/horas/` | `app/medicos/(lista)/horas/` |
| `app/planos/` | `app/medicos/(lista)/assinaturas/` |
| `app/modulos/` | `app/medicos/(lista)/modulos/` |
| `app/leads/` | `app/comercial/` |
| `app/conversas/` | `app/comercial/conversas/` |
| `app/cupons/` | `app/comercial/cupons/` |
| `app/promocoes/` | `app/comercial/promocoes/` |
| `app/recebimentos/` | `app/financeiro/recebimentos/` |
| `app/contas/` | `app/financeiro/contas/` |
| `app/fluxo-de-caixa/` | `app/financeiro/fluxo/` |
| `app/fornecedores/` | `app/financeiro/fornecedores/` |
| `app/catalogo/` | `app/configuracoes/` |
| `app/usuarios/` | `app/configuracoes/usuarios/` |
| `app/equipe/` | `app/configuracoes/equipe/` |
| `app/parceiros/` | `app/configuracoes/parceiros/` |
| `app/notificacoes/` | `app/configuracoes/notificacoes/` |
| `app/comunidade/` | `app/configuracoes/comunidade/` |
| `app/totem/` | `app/configuracoes/totem/` |
| `app/meu-recebimento/` | `app/configuracoes/meu-recebimento/` |

  `app/medicos/[id]/` **não se move** (fica fora do grupo `(lista)` para não herdar a barra de abas). `app/page.tsx`, `app/fila/`, `app/financeiro/page.tsx`, `login` e `definir-senha` ficam como estão nesta tarefa.
- Create: `admin/lib/legacy-redirects.mjs`, `admin/lib/legacy-redirects.test.ts`
- Modify: `admin/next.config.mjs`, `admin/app/actions.ts` (todos os `revalidatePath`), todos os `href` internos listados abaixo

**Interfaces:**
- Produces: `export const LEGACY_REDIRECTS: ReadonlyArray<{ source: string; destination: string }>` em `legacy-redirects.mjs`, usado por `next.config.mjs` via `async redirects()` com `permanent: false`.
  Pares: `/salas→/reservas`, `/historico→/reservas/historico`, `/pagamentos→/reservas/minutagem`, `/horas→/medicos/horas`, `/planos→/medicos/assinaturas`, `/modulos→/medicos/modulos`, `/leads→/comercial`, `/conversas→/comercial/conversas`, `/cupons→/comercial/cupons`, `/promocoes→/comercial/promocoes`, `/recebimentos→/financeiro/recebimentos`, `/contas→/financeiro/contas`, `/fluxo-de-caixa→/financeiro/fluxo`, `/fornecedores→/financeiro/fornecedores`, `/catalogo→/configuracoes`, `/usuarios→/configuracoes/usuarios`, `/equipe→/configuracoes/equipe`, `/equipe/:path*→/configuracoes/equipe/:path*`, `/parceiros→/configuracoes/parceiros`, `/notificacoes→/configuracoes/notificacoes`, `/comunidade→/configuracoes/comunidade`, `/totem→/configuracoes/totem`, `/meu-recebimento→/configuracoes/meu-recebimento`.
  Atenção: `/medicos/horas`, `/medicos/assinaturas` e `/medicos/modulos` ficam sob `(lista)`, que não aparece na URL.

- [ ] **Step 1:** Teste `legacy-redirects.test.ts`: nenhuma `destination` é igual a alguma `source` (sem laço); `source`s únicas; `/equipe/:path*` presente; toda `destination` começa com `/`.
- [ ] **Step 2:** Run: `npm run test:unit`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Criar `legacy-redirects.mjs` com a tabela e ligar em `next.config.mjs` (`async redirects()`), mantendo `staleTimes`.
- [ ] **Step 4:** Executar os `git mv` da tabela e corrigir imports relativos quebrados. Run: `npx tsc --noEmit`. Expected: sem erro.
- [ ] **Step 5:** Atualizar **todos** os `revalidatePath` de `app/actions.ts` para os caminhos novos (a lista de antigos está no spec, §3) e os `href` internos: `app/configuracoes/CatalogoClient.tsx` (`/planos`→`/medicos/assinaturas`, `/modulos`→`/medicos/modulos`, `/horas`→`/medicos/horas`), `app/financeiro/FinanceiroClient.tsx` (`/recebimentos`, `/contas`, `/fornecedores`), `app/financeiro/fluxo/page.tsx` e `app/financeiro/recebimentos/page.tsx` (links cruzados), `app/page.tsx` (`/horas`), `app/medicos/(lista)/page.tsx` (`/medicos/excluidos`), `app/configuracoes/usuarios/page.tsx` e `parceiros/page.tsx` (`/equipe`), e qualquer `href`/`router.push` achado por `grep -rn "href=\|router.push" app components` apontando para rota antiga. Run: `grep -rnE "\"/(salas|historico|pagamentos|horas|planos|modulos|leads|conversas|cupons|promocoes|recebimentos|contas|fluxo-de-caixa|fornecedores|catalogo|usuarios|equipe|parceiros|notificacoes|comunidade|totem|meu-recebimento)" app components lib | grep -v legacy-redirects`. Expected: nenhuma ocorrência fora dos redirects.
- [ ] **Step 6:** Run: `npm run test:unit && npx tsc --noEmit && npm run build`. Expected: tudo passa e o build lista as rotas novas.
- [ ] **Step 7:** Commit: `refactor(admin): move telas para os grupos novos com redirects dos endereços antigos`.

---

### Task 7: Menu de 6 itens, abas por grupo e acesso do fundador

**Files:**
- Create: `admin/lib/nav.ts`, `admin/lib/nav.test.ts`, `admin/lib/founder.ts`, `admin/components/TabNav.tsx`, `admin/app/reservas/layout.tsx`, `admin/app/medicos/(lista)/layout.tsx`, `admin/app/comercial/layout.tsx`, `admin/app/financeiro/layout.tsx`, `admin/app/configuracoes/layout.tsx`
- Modify: `admin/components/Sidebar.tsx`, `admin/app/layout.tsx`, `admin/app/configuracoes/meu-recebimento/page.tsx` (usar `lib/founder.ts`)

**Interfaces:**
- Produces:
  - `lib/founder.ts`: `export const FOUNDER_EMAIL = 'guilherme.pasquetti@gmail.com'` e `export function isFounder(email: string | null | undefined): boolean`.
  - `lib/nav.ts`: `isNavActive(pathname: string, href: string): boolean` (`'/'` só casa com `'/'` exato; os demais casam por prefixo de segmento: `/medicos` ativa em `/medicos/abc` mas não `/medicosx`); `interface TabDef { href: string; label: string; exact?: boolean }`; `GROUP_TABS: Record<'reservas'|'medicos'|'comercial'|'financeiro'|'configuracoes', TabDef[]>`.
  - Abas: reservas = Mapa das salas `/reservas` (exact), Histórico, Minutagem; medicos = Profissionais `/medicos` (exact), Horas, Assinaturas, Módulos contratados, Excluídas; comercial = Leads `/comercial` (exact), Conversas, Cupons, Promoções; financeiro = Resumo `/financeiro` (exact), Recebimentos, Contas, Fluxo de caixa, Fornecedores; configuracoes = Catálogo `/configuracoes` (exact), Usuários, Equipe, Parceiros, Notificações, Comunidade, Totem (Meu Recebimento só se `isFounder`).
  - `TabNav({ tabs }: { tabs: TabDef[] })` (client, `usePathname`, `<nav aria-label="Abas da seção">`, aba ativa com a cor `oli-green`).
  - `Sidebar({ userEmail }: { userEmail: string })` — **sem** `unreadCount`.

- [ ] **Step 1:** Testes de `nav.test.ts`: `isNavActive('/', '/')` true; `isNavActive('/reservas/historico', '/')` false; `isNavActive('/medicos/abc', '/medicos')` true; `isNavActive('/medicosx', '/medicos')` false; `isNavActive('/financeiro/fluxo', '/financeiro')` true; `GROUP_TABS.financeiro` tem 5 abas e a primeira é exact; nenhuma `href` repetida dentro de um grupo.
- [ ] **Step 2:** Run: `npm run test:unit`. Expected: FAIL.
- [ ] **Step 3:** Implementar `nav.ts` e `founder.ts` (os dois, sem imports com `@/`).
- [ ] **Step 4:** Implementar `TabNav.tsx` e os cinco `layout.tsx` de grupo (o de configurações é servidor: lê o usuário com `createSupabaseServer` e acrescenta a aba "Meu Recebimento" só para o fundador; a página continua com o `notFound()` que já tem). Verificar visualmente que `ConversasClient` e `salas` (altura total da tela) não quebram com a barra de abas acima; se quebrarem, ajustar o contêiner da página, não o conteúdo.
- [ ] **Step 5:** Reescrever `NAV` do `Sidebar.tsx` para os 6 itens (ícones `lucide-react` já usados no projeto ou os SVGs existentes; rótulos exatos: "Hoje", "Reservas", "Profissionais", "Comercial", "Financeiro", "Configurações"), usar `isNavActive`, remover badge, remover a seção "Pessoal" e o comentário "9 itens". Em `app/layout.tsx`, remover a consulta de `admin_notifications` e a prop `unreadCount`.
- [ ] **Step 6:** Run: `npm run test:unit && npx tsc --noEmit && npm run build`. Expected: passa. Subir `npm run dev` (porta 3001) e abrir `/medicos`, `/reservas`, `/comercial/conversas`, `/financeiro`, `/configuracoes` conferindo menu, aba ativa e celular (largura 375).
- [ ] **Step 7:** Commit: `feat(admin): menu de 6 itens e abas por grupo`.

---

### Task 8: Ação de servidor do rótulo de paciente e auditoria

**Files:**
- Create: `admin/lib/audit.ts`, `admin/app/actions-hoje.ts`

**Interfaces:**
- Consumes: `sanitizePatientLabel` (Task 3), `spDayRange` (Task 4), `createSupabaseAdmin`/`createSupabaseServer` de `@/lib/supabase-server`, tipo `ActionResult` de `@/app/actions`.
- Produces:
  - `registrarAuditoriaAdmin(p: { adminId: string; action: string; targetType: string; targetId: string | null; metadata?: Record<string, string | number | boolean | null> }): Promise<void>` — insere em `audit_logs` (`professional_id` = `adminId`); falha de auditoria **não** derruba a ação principal, mas é reportada com `console.error` sem o texto do rótulo.
  - `registrarVisualizacaoUmaVezPorDia(adminId: string, qtdRotulos: number): Promise<void>` — grava `action='view_patient_labels'` só se ainda não houver linha do mesmo admin e ação no dia de SP.
  - `setReservationPatientLabel(formData: FormData): Promise<ActionResult>` em `app/actions-hoje.ts` (`'use server'`): lê `reservation_id` e `patient_label`; exige admin autenticado (lê o usuário da sessão; rejeita se não houver); valida com `sanitizePatientLabel`; confirma que a reserva existe e que `start_time` cai no dia de SP de hoje; atualiza `reservations.patient_label` com service role; grava auditoria `action='set_patient_label'` (ou `'clear_patient_label'` quando o valor é nulo), `targetType='reservation'`, `targetId=reservation_id`, `metadata` só com `{ length: n }`; `revalidatePath('/')`.
  - **Nenhuma** função aqui grava o texto do rótulo em `audit_logs`, nem em mensagens de erro.

- [ ] **Step 1:** Implementar `audit.ts` e `actions-hoje.ts` conforme as assinaturas. Nota: o arquivo `'use server'` só pode exportar funções assíncronas; não exportar constantes nem tipos de valor.
- [ ] **Step 2:** Verificação manual contra o banco real, com cuidado: com a branch rodando localmente, definir um rótulo de teste `Teste T.` numa reserva **concluída de hoje ou de ontem que não seja de cliente real**; se não houver, usar a reserva mais recente e **limpar o campo em seguida**. Run (SQL): `select id, patient_label from reservations where patient_label is not null;` Expected: 1 linha com `Teste T.`; `select action, metadata from audit_logs where action in ('set_patient_label','clear_patient_label') order by created_at desc limit 2;` Expected: `metadata` sem a palavra "Teste". Depois limpar o rótulo pela própria ação e confirmar `clear_patient_label`.
- [ ] **Step 3:** Run: `npx tsc --noEmit`. Expected: sem erro.
- [ ] **Step 4:** Commit: `feat(admin): ação para informar o paciente da reserva, com auditoria sem dado pessoal`.

---

### Task 9: Tela "Hoje"

**Files:**
- Create: `admin/lib/hoje-data.ts`, `admin/components/hoje/PendenciasCard.tsx`, `admin/components/hoje/ReservasDoDia.tsx`, `admin/components/hoje/PacienteForm.tsx`, `admin/components/hoje/SalasAgora.tsx`, `admin/components/hoje/AtividadeRecente.tsx`
- Modify: `admin/app/page.tsx` (substituir o Dashboard), `admin/lib/legacy-redirects.mjs` (acrescentar `/fila→/`)
- Move: `admin/app/fila/FilaClient.tsx` → `admin/components/FilaClient.tsx`; depois remover `admin/app/fila/`
- Delete: `admin/components/LiveRooms.tsx` (não usado), e os blocos do Dashboard antigo que saem (rosca, ranking, receita, resumo do mês, "Dica operacional")

**Interfaces:**
- Consumes: `spDayRange`, `isCheckoutAberto`, `isVencidaSemCheckin`, `assinaturaVencendo`, `limitarComTotal`, constantes (Task 4); `normalizeReservationStatus`, `reservationStatusLabel`, `reservationStatusClass` (Task 2); `registrarVisualizacaoUmaVezPorDia` e `setReservationPatientLabel` (Task 8); `ActionForm`.
- Produces:
  - `carregarHoje(now: Date): Promise<HojeData>` em `lib/hoje-data.ts`, com
    `HojeData = { dia: string; reservas: ReservaHoje[]; checkoutsAbertos: { itens: PendenciaReserva[]; total: number }; vencidasSemCheckin: { itens: PendenciaReserva[]; total: number }; leadsAguardando: number; conversasAguardando: number; assinaturasVencendo: { itens: PendenciaAssinatura[]; total: number }; salas: SalaHoje[]; atividade: AtividadeItem[] }`.
  - `ReservaHoje = { id; room_name; start_time; end_time; status: string | null; patient_label: string | null; profissional: string | null }`.
  - `leadsAguardando` = `leads` com `etapa in ('novo','sem_resposta')` (usar o nome real da coluna: conferir em `database.types.ts` ou com `select * from leads limit 1`, já que a etapa pode se chamar `etapa` ou `status`). `conversasAguardando` = `conversations` com `status <> 'fechada'`, `last_message_direction = 'inbound'` e `last_message_at` nos últimos 7 dias.
  - `SalasAgora({ salas, emUso })` mostra todas as salas da tabela `rooms` (9), "Livre" ou "Em uso: <profissional> até <hora>"; **nunca** uma lista fixa de salas.
  - `AtividadeRecente` reaproveita `FilaClient` com os 10 itens mais recentes dos 8 tipos operacionais (a consulta que `app/fila/page.tsx` fazia, com `limit(10)`).

- [ ] **Step 1:** Implementar `carregarHoje` (consultas em paralelo com `createSupabaseServer`; reservas do dia pela janela `spDayRange`, ordenadas por `start_time`, excluindo `CANCELLED_STATUS_VALUES`; pendências por filtro no servidor e depois pelas funções puras da Task 4, aplicando `limitarComTotal`).
- [ ] **Step 2:** Implementar os componentes. `PendenciasCard`: cada pendência com ícone, texto no singular/plural correto, contagem e link ("Resolver"): check-out aberto e vencida → `/medicos/<professional_id>`; leads → `/comercial`; conversas → `/comercial/conversas`; assinatura → `/medicos/<professional_id>`. Estado vazio: "Nenhuma pendência. Tudo em dia." Quando `total > itens.length`, mostrar "e mais N". `ReservasDoDia`: horário, sala, profissional, badge de status via helper, e `PacienteForm` (client, `ActionForm` + `setReservationPatientLabel`, campo `maxLength={60}`, placeholder "Nome e inicial do sobrenome", `aria-label="Paciente da reserva das <hora> na <sala>"`, mensagem de LGPD curta ao lado: "Informe só nome e inicial. Apagado 7 dias após a reserva."). Estado vazio: "Nenhuma reserva para hoje."
- [ ] **Step 3:** Substituir `app/page.tsx` pela nova página (`export const dynamic = 'force-dynamic'`): cabeçalho com data por extenso em pt-BR e "N reservas · M pendências"; seções na ordem do spec §6.2; atalho "Abrir Totem QR" (`/configuracoes/totem`); chamar `registrarVisualizacaoUmaVezPorDia` quando houver ao menos um rótulo. Usar a skill `emil-design-eng` para o acabamento visual, mantendo os tokens `oli-*`.
- [ ] **Step 4:** Mover `FilaClient`, apagar `app/fila/`, apagar `LiveRooms.tsx` e acrescentar `/fila→/` a `legacy-redirects.mjs`.
- [ ] **Step 5:** Run: `npm run test:unit && npx tsc --noEmit && npm run build`. Expected: passa. Em `npm run dev`, abrir `/` e conferir: pendências reais (inclui o check-out aberto da Rose de 12/11, em Sala 7), a lista do dia, as 9 salas, o campo de paciente (gravar e limpar um rótulo de teste como na Task 8), estado vazio com um dia sem reservas, celular (375). Conferir também que `/fila` redireciona para `/`.
- [ ] **Step 6:** Commit: `feat(admin): tela Hoje com pendências, reservas do dia e paciente`.

---

### Task 10: Status corretos no Mapa e no Histórico

**Files:**
- Modify: `admin/app/reservas/page.tsx` (ex-`salas`), `admin/app/reservas/historico/page.tsx`, `admin/components/ReservationBlock.tsx` se usar status

**Interfaces:**
- Consumes: `normalizeReservationStatus`, `reservationStatusLabel`, `reservationStatusClass`, `CANCELLED_STATUS_VALUES`.

- [ ] **Step 1:** Trocar toda comparação com literais em inglês (`'completed'`, `'cancelled'`, `'no_show'`, `'active'`, `'scheduled'`) e os mapas `STATUS_LABEL` locais pelo helper; trocar `.not('status','in','("cancelled")')` e variantes por um filtro baseado em `CANCELLED_STATUS_VALUES`. Não alterar mais nada nessas telas.
- [ ] **Step 2:** Run: `grep -nE "'(completed|cancelled|no_show|active|scheduled)'" app/reservas app/page.tsx components`. Expected: nenhuma ocorrência fora de `lib/reservation-status.ts`.
- [ ] **Step 3:** Run: `npx tsc --noEmit && npm run build`. Em `npm run dev`, abrir `/reservas` e `/reservas/historico` e conferir que reservas `concluido` aparecem como "Concluída" e `em_uso` como "Em sessão".
- [ ] **Step 4:** Commit: `fix(admin): status de reserva corretos no Mapa e no Histórico`.

---

### Task 11: Testes e2e, documentação e entrega do preview

**Files:**
- Modify: `admin/playwright.config.ts` (`baseURL: process.env.E2E_BASE_URL ?? 'https://admin.olihealthhub.com.br'`), `admin/e2e/02-dashboard.spec.ts` (vira "Hoje"), `03-fila`, `04-salas`, `05-historico`, `07-planos`, `08-modulos`, `09-horas`, `10-pagamentos`, `12-sidebar-navigation.spec.ts`, e os demais que citem rota antiga
- Modify: `admin/MANUAL.md` (reescrever a seção de navegação para os 6 itens e as abas), `docs/HANDOFF.md` (nova seção `## 82.` no padrão das anteriores: o que mudou, decisões, pendências, link do preview)

**Interfaces:**
- Consumes: rotas novas (Task 6) e a tela "Hoje" (Task 9).

- [ ] **Step 1:** Reescrever `12-sidebar-navigation.spec.ts`: o menu tem exatamente 6 links com os rótulos "Hoje", "Reservas", "Profissionais", "Comercial", "Financeiro", "Configurações"; cada um leva à rota esperada; o item ativo tem a classe `bg-oli-green`; e um teste que, para cada par de `LEGACY_REDIRECTS` (importado de `../lib/legacy-redirects.mjs`, trocando `:path*` por um segmento de exemplo), faz `page.goto(source)` e espera terminar em `destination`. Atualizar os demais specs para as rotas novas e títulos reais (o de `/pagamentos` esperava "Pagamentos" mas o título é "Minutagem por Sessão"). Remover as asserções do Dashboard antigo (rosca, ranking, receita) do spec 02 e cobrir "Hoje": título, seção "Pendências", seção "Reservas do dia".
- [ ] **Step 2:** Atualizar `MANUAL.md` (a tabela de navegação e as seções de cada grupo; apagar o que descreve Dashboard antigo, Fila e rotas movidas) e escrever a seção `## 82.` do HANDOFF. Registrar também, na seção do HANDOFF, as pendências conhecidas: abas do Financeiro ainda com conteúdo repetido (Fase 2), Leads e Conversas ainda separados (Fase 3), ficha do profissional ainda sem abas (Fase 4), campo de paciente no app (futuro), perfis de acesso.
- [ ] **Step 3:** Verificação final. Run: `npm run test:unit && npx tsc --noEmit && npm run build`. Expected: tudo passa. Os testes e2e rodam contra a URL de produção por padrão e usam login de teste; **rodá-los só depois que o preview ou a produção tiverem a branch**, com `E2E_BASE_URL=<url do preview> npm run test:e2e`. Se o preview exigir login da Vercel, anotar e pedir ao fundador para rodar ou liberar.
- [ ] **Step 4:** Commit: `test(admin): e2e do menu novo e dos redirects; docs: manual e handoff §82`.
- [ ] **Step 5:** `git push -u origin feat/admin-reorganizacao` para gerar o preview da Vercel (a Vercel faz preview por branch). **Não abrir PR nem mesclar na `main`**: entregar ao fundador o link do preview e o resumo do que foi verificado e do que não foi (login admin no navegador do Claude não disponível).

---

## Self-Review

- **Spec coverage:** menu de 6 e abas (T6, T7); redirects incluindo `/equipe/:path*` e `/fila` (T6, T9); "Hoje" com pendências, reservas, salas, atividade, atalho do Totem (T9); paciente com coluna, validação, auditoria sem texto, retenção 7 dias (T3, T5, T8); helper de status em Hoje, Mapa e Histórico (T2, T9, T10); atualização de `revalidatePath`, `href`, e2e, Sidebar, MANUAL, HANDOFF (T6, T7, T11); badge removido (T7); acesso do fundador mantido (T7); entrega em branch com preview e sem merge (T1, T11). Sem lacunas.
- **Consistência de tipos:** `ReservaMin` e as funções de Task 4 usam `normalizeReservationStatus` da Task 2; `setReservationPatientLabel` (Task 8) é consumida só por `PacienteForm` (Task 9); `HojeData` e `spDayRange` definidos antes do uso.
- **Proporção:** o plano é mais curto que o design somado às decisões; assinaturas e testes aparecem, corpos de função não.
