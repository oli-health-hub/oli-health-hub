# Manual de Funcionalidades — Dashboard Admin OLI Health Hub

**URL:** https://admin.olihealthhub.com.br  
**Acesso:** Somente usuários com `user_type = 'admin'` no Supabase  
**Stack:** Next.js 14 (App Router, Server Components) + Supabase  
**Dados:** Todos server-side, `force-dynamic` — sem cache, sempre ao vivo  
**Fuso:** America/Sao_Paulo em todos os cálculos de data/hora

---

## Navegação (sidebar)

| Item | Rota | Status |
|------|------|--------|
| Dashboard | `/` | ✅ Implementado |
| Fila de Trabalho | `/fila` | ✅ Implementado |
| Médicos | `/medicos` | ✅ Implementado |
| Salas | `/salas` | ✅ Implementado |
| Histórico | `/historico` | ✅ Implementado |
| Horas | `/horas` | ✅ Implementado |
| Planos | `/planos` | ✅ Implementado |
| Módulos | `/modulos` | ✅ Implementado |
| Pagamentos | `/pagamentos` | ✅ Implementado |
| Usuários | `/usuarios` | ✅ Implementado |

---

## 1. Dashboard (`/`)

Visão executiva do dia. Executa **12 queries em paralelo** (`Promise.all`) a cada request.

### 1.1 Top Bar
- Saudação dinâmica: **Bom dia** (0–11h) / **Boa tarde** (12–17h) / **Boa noite** (18–23h)
- Data formatada em pt-BR: `"Terça-feira, 27 de maio"`
- Hora atual no fuso SP
- Badge pulsante **"Tempo real"** (indica que a página não é cacheada)

### 1.2 KPIs (5 cartões)

| Cartão | Fonte de dados | Delta |
|--------|---------------|-------|
| **Receita hoje** | `usage_charges.valor_total` do dia atual | vs. ontem (mesmo período) |
| **Reservas hoje** | `reservations` do dia, excluindo `cancelled` e `no_show` | vs. ontem |
| **Salas em uso** | `reservations` onde `start_time ≤ agora ≤ end_time` (ativas agora) | — |
| **Médicos** | `profiles` com `user_type ≠ 'admin'` (total cadastrado) | novos hoje no subtítulo |
| **Próxima reserva** | próxima `reservation` futura, mais cedo | tempo em min ou horas até início |

Delta exibe `+X%` verde / `-X%` vermelho vs. período equivalente ontem.  
Se não há dados ontem e hoje, delta é omitido.

### 1.3 Gráficos (linha de 3 colunas)

#### Reservas do dia — Status (barra horizontal)
Decompõe as reservas de hoje por status:
- **Em sessão** (verde) — `status = 'active'`
- **Agendadas** (azul) — `status = 'scheduled'`
- **Concluídas** (verde OLI) — `status = 'completed'`
- **No-show** (laranja) — `status = 'no_show'`
- **Canceladas** (vermelho) — `status = 'cancelled'`

Cada barra mostra largura proporcional ao total de reservas do dia.

#### Reservas por sala — Donut (hoje)
- Gráfico CSS puro (`conic-gradient`), sem biblioteca JS
- Centro exibe total de reservas
- Legenda lateral com nome da sala e % do total
- Máximo 7 salas na legenda
- Paleta: verde OLI, dourado, variações da paleta OLI

#### Salas mais utilizadas — Ranking
- Lista ordenada por número de reservas hoje
- Numeração (1º, 2º...) + cor da paleta + contagem

### 1.4 Reservas do dia + Receita (linha de 3 colunas)

#### Tabela de reservas (2/3 da largura)
- Lista cronológica das reservas do dia (máx. 8 exibidas)
- Colunas: horário início/fim · divisor · nome do médico + sala · badge de status
- Estado vazio: ícone `CalendarX` + mensagem

**Badges de status:**

| Status | Label | Cor |
|--------|-------|-----|
| `active` | Em sessão | Verde |
| `scheduled` | Agendada | Azul |
| `completed` | Concluída | Cinza |
| `cancelled` | Cancelada | Vermelho |
| `no_show` | No-show | Laranja |

#### Receita (1/3 da largura)
- Receita hoje (valor em R$) + delta vs. ontem
- Receita do mês atual + delta vs. mês passado
- Estatísticas rápidas: reservas do mês · ticket médio · médicos ativos

### 1.5 Resumo do mês (4 métricas)

| Métrica | Cálculo |
|---------|---------|
| Receita total | Soma `usage_charges` desde dia 1 do mês |
| Reservas | Contagem de reservas do mês (excluindo canceladas/no-show) |
| Ticket médio | Receita total ÷ número de reservas |
| Novos médicos | Profiles criados hoje (`created_at` = hoje) |

### 1.6 Dica operacional
Card verde fixo com alerta sobre médicos com saldo zerado de horas, com link para `/horas`.

---

## 2. Fila de Trabalho (`/fila`)

Notificações não lidas da tabela `admin_notifications`.

- Exibe até 100 notificações pendentes (`read_at IS NULL`)
- Cada item mostra: nome do médico, CRM, especialidade, plano, tipo de notificação
- Componente client-side (`FilaClient`) para ações inline (marcar como lida etc.)
- Badge vermelho com contagem de pendentes no header

---

## 3. Médicos (`/medicos`)

Lista completa de profissionais cadastrados.

- Ordenado por data de cadastro (mais recente primeiro)
- Máx. 200 registros
- Campos: nome · CRM · especialidade · plano (badge colorido) · data de cadastro · módulos ativos
- Badge de plano: `BASE` cinza · `PRO` verde · `VIP` dourado
- Contagem de módulos ativos por médico (join `user_modules`)
- Link para página de detalhe: `/medicos/[id]`

---

## 4. Salas (`/salas`)

Timeline visual de ocupação das 7 salas para o dia atual.

- **Grade horária:** 07:00 às 22:00 (15 horas)
- Cada sala tem cor própria (emerald, blue, violet, amber, rose, teal, indigo)
- Blocos de reserva posicionados proporcionalmente na grade (CSS `left` + `width` em %)
- Status exibido: Agendado · Confirmado · Concluído · No-show · Cancelado
- Sala livre = fundo suave da cor da sala
- Sala ocupada agora = fundo saturado + ponto pulsante

---

## 5. Histórico (`/historico`)

Log completo de reservas com paginação.

- 50 registros por página (`PER_PAGE = 50`)
- Paginação via query param `?page=N`
- Colunas: data · horário · duração · médico · sala · plano · status
- Badge de plano e status coloridos
- Duração calculada em horas/minutos
- Ordenado por `start_time DESC` (mais recente primeiro)

---

## 6. Horas (`/horas`)

Gestão de saldo de pacotes de horas por profissional.

- Agrupa pacotes por profissional (saldo consolidado)
- Exibe: total comprado · minutos usados · saldo disponível · data de expiração
- Expandível por profissional para ver pacotes individuais
- Ação inline: **Adicionar horas** (Server Action `addHours`)
- Alerta visual para saldos críticos (próximos de zero)
- Formato: `Xh Ymin` ou `Xh`

---

## 7. Planos (`/planos`)

Assinaturas ativas e médicos sem plano.

- Lista de assinaturas da tabela `subscriptions` (join `profiles` + `plans`)
- Colunas: médico · CRM · especialidade · plano · ciclo · datas de início/fim · status
- Seção separada: **médicos sem assinatura** (profiles sem entrada em `subscriptions`)
- Status: Ativo (verde) · Pendente (amarelo) · Cancelado (vermelho) · Inativo (cinza)
- Ciclo: mensal ou anual

---

## 8. Módulos (`/modulos`)

Módulos adicionais contratados por médicos.

- Join `user_modules` → `profiles` → `modules`
- Campos: médico · módulo (nome, categoria, tipo) · valor · data de ativação · validade · status
- Contadores no header: ativos / pendentes de pagamento
- Ação inline: **Ativar/Desativar** módulo (Server Action `setModuleStatus`)
- Status: Ativo · Pendente · Cancelado · Inativo

---

## 9. Pagamentos (`/pagamentos`)

Cobranças de minutagem (`usage_charges`).

- Exibe cobranças com: médico · data · duração · sala · plano · valor · status
- Formatos: duração em h/min · valor em R$ BRL · data pt-BR
- Status de cobrança coloridos (Ativo, Pendente, Cancelado, Inativo)
- Suporte a status uppercase do Supabase (`ACTIVE`, `CANCELLED`)

---

## 10. Usuários (`/usuarios`)

Gerenciamento de perfis e permissões.

- Usa cliente admin Supabase (`supabase.auth.admin`) para buscar e-mails
- Duas seções: **Administradores** · **Médicos/Outros**
- Colunas: nome · e-mail · tipo de usuário · data de cadastro
- Ação inline: **Promover/Rebaixar** tipo de usuário (Server Action `setUserType`)
- Máx. 200 perfis + 1000 usuários auth

---

## Limitações conhecidas / não implementado

| Item | Situação |
|------|----------|
| Filtros e busca | Nenhuma página tem campo de busca — dados são listados sem filtro |
| Paginação | Só `/historico` pagina; demais têm limite fixo (200 registros) |
| Gráfico de linha (receita por dia) | Dashboard mostra só receita hoje e do mês — sem série temporal |
| Exportação CSV | Não implementado em nenhuma página |
| Responsividade mobile | Dashboard não otimizado para telas < 768px (deferred) |
| Refresh automático | `force-dynamic` mas sem polling — requer F5 manual para atualizar |
| `/medicos/[id]` | Rota existe mas página de detalhe pode estar vazia (placeholder) |
| Ações de pagamento | Nenhuma ação de cobrar/estornar — somente visualização |

---

## Dados que o dashboard NÃO mostra (oportunidades)

- Receita por plano (BASE vs PRO vs VIP)
- Taxa de no-show histórica
- Médicos com sessão mais longa
- Ocupação média por sala (%)
- Receita diária dos últimos 30 dias (gráfico de linha)
- Alertas de médicos com saldo < 1h
