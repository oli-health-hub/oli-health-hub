# Manual de Funcionalidades — Dashboard Admin OLI Health Hub

**URL:** https://admin.olihealthhub.com.br  
**Acesso:** Somente usuários com `user_type = 'admin'` no Supabase  
**Stack:** Next.js 14 (App Router, Server Components) + Supabase  
**Dados:** Todos server-side, `force-dynamic` — sem cache, sempre ao vivo  
**Fuso:** America/Sao_Paulo em todos os cálculos de data/hora

---

## Navegação (menu de 6 itens)

Reorganizado em 19/11/2026. Cada item do menu é um grupo; as telas do grupo são **abas** na barra abaixo do topo.
Os endereços antigos continuam funcionando (redirecionam para o novo).

| Item | Rota base | Abas |
|------|-----------|------|
| **Hoje** | `/` | — (pendências, reservas do dia com paciente, salas agora, atividade recente) |
| **Reservas** | `/reservas` | Mapa das salas · Histórico (`/reservas/historico`) · Minutagem (`/reservas/minutagem`) |
| **Profissionais** | `/medicos` | Profissionais · Horas · Assinaturas · Módulos contratados · Excluídas (todas em `/medicos/...`; a ficha `/medicos/[id]` não tem abas) |
| **Comercial** | `/comercial` | Leads · Conversas · Cupons · Promoções |
| **Financeiro** | `/financeiro` | Resumo · Recebimentos · Contas · Fluxo de caixa · Fornecedores |
| **Configurações** | `/configuracoes` | Catálogo · Usuários · Equipe · Parceiros · Notificações · Comunidade · Totem QR · Meu Recebimento (só o fundador) |

### Onde foi parar cada tela antiga

| Antes | Agora |
|-------|-------|
| `/` Dashboard, `/fila` Fila | **Hoje** (`/`) |
| `/salas` · `/historico` · `/pagamentos` | `/reservas` · `/reservas/historico` · `/reservas/minutagem` |
| `/horas` · `/planos` · `/modulos` | `/medicos/horas` · `/medicos/assinaturas` · `/medicos/modulos` |
| `/leads` · `/conversas` · `/cupons` · `/promocoes` | `/comercial` · `/comercial/conversas` · `/comercial/cupons` · `/comercial/promocoes` |
| `/recebimentos` · `/contas` · `/fluxo-de-caixa` · `/fornecedores` | `/financeiro/recebimentos` · `/financeiro/contas` · `/financeiro/fluxo` · `/financeiro/fornecedores` |
| `/catalogo` · `/usuarios` · `/equipe` · `/parceiros` · `/notificacoes` · `/comunidade` · `/totem` · `/meu-recebimento` | `/configuracoes` e `/configuracoes/<mesmo nome>` |

> Este manual descreve em detalhe as telas originais (seções 3 em diante). Comercial, Financeiro e Configurações ainda não têm descrição aqui (pendente).

---

## 1. Hoje (`/`)

Tela da recepção. Server Component `force-dynamic`, fuso America/Sao_Paulo. Substitui o Dashboard e a Fila.

- **Cabeçalho:** data por extenso, "N reservas · M pendências" e atalho "Abrir Totem QR".
- **Cartões de resumo** (clicáveis, com ícone e cor por estado): Reservas hoje (e a próxima), Pendências (vermelho se houver), Salas livres (X/total) e Aguardando resposta (leads + conversas).
- **Pendências** (só o que exige ação; cada linha leva a quem resolve). Tolerância de **30 min** após o fim da reserva:
  - **Check-out aberto:** reserva `em_uso` que já devia ter terminado.
  - **Reserva vencida sem check-in:** `agendado` que já passou, nos últimos 14 dias (até 10 linhas, com "e mais N").
  - **Assinaturas PRO** ativas que terminam em até 7 dias (precisa faturar).
  - **Comercial:** contagem de leads `novo`/`sem_resposta` e de conversas aguardando nossa resposta (últimos 7 dias), com link; sem listar linhas.
- **Reservas do dia:** linha do tempo com faixa colorida pelo status, horário, inicial do profissional, sala, status e o campo **Paciente**.
  - Texto livre: **só nome e inicial do sobrenome** (ex.: "Maria S."), até 60 caracteres, sem CPF ou telefone (a validação recusa 8 ou mais dígitos).
  - Só reservas que começam **hoje** aceitam rótulo. Salvar vazio apaga.
  - **LGPD:** apagado automaticamente 7 dias após o fim da reserva (job `pg_cron` `limpar_patient_label_reservas`). O texto nunca vai para `audit_logs`; a auditoria guarda só ids e tamanho (`set_patient_label`, `clear_patient_label`) e a visualização, uma vez por dia por admin (`view_patient_labels`).
  - Se a coluna `reservations.patient_label` ainda não existir no banco, o campo some e o resto da tela funciona.
- **Salas agora:** grade com as 9 salas da tabela `rooms`; verde "Livre", dourado "Em uso · profissional até HH:MM".
- **Atividade recente:** as 10 notificações operacionais não lidas mais recentes (cadastro, reserva, plano, módulo, pacote de horas), com WhatsApp e Dispensar.

Status de reserva: o banco usa `agendado`, `em_uso`, `concluido` (e `cancelado`). O helper `lib/reservation-status.ts` converte também os nomes antigos em inglês e é a fonte única de rótulo e cor.

---

## 3. Profissionais (`/medicos`)

Lista dos profissionais cadastrados (os clientes da OLI), em linhas compactas.

- Ordenado por cadastro (mais recente primeiro); máx. 200 registros.
- **Linha:** inicial, nome, especialidade · CRM, selo de plano (START com ícone de broto, PRO dourado com coroa) e selo de status (Ativa, Pausada, Suspensa, Banida, com ícone e cor). O botão da linha abre os detalhes: e-mail, módulos ativos, cadastro e as 4 assessorias (Contabilidade, Jurídica, Convênios, Marketing; "não possui" é oportunidade de oferta). O ícone de link à direita abre a ficha `/medicos/[id]`.
- **Filtros** (botão "Filtros", agrupados): Assinatura (plano), Situação da conta (status) e Perfil profissional (especialidade); mais a busca por nome, e-mail ou CRM. Plano e status são seleções visuais com ícone, cor e contagem. Os filtros ativos aparecem como chips removíveis e cada combinação tem endereço próprio (`?plano=PRO&status=active&especialidade=…&q=…`).
- Sem plano gravado conta como START.

---

## Leads (`/comercial`)

- **Filtros** em listas suspensas atrás do botão "Filtros", agrupadas: Fila de trabalho (atendimento, revisita, atendente), Qualificação (situação, temperatura, perfil) e Origem; mais a busca. Chips removíveis mostram o que está ativo.
- **Linha compacta** por lead: nome, situação, temperatura, revisita, atendente (ou "Sem atendente"), régua de nutrição, especialidade, origem, telefone e data; barra lateral colorida pela temperatura. Botões WhatsApp e "Iniciar com Olivia" na linha. "Detalhes e edição" abre o restante (e-mail, fonte, anúncio, perfil) e o formulário de edição; nada do que se edita mudou.

## Conversas (`/comercial/conversas`)

- Visual do WhatsApp: lista com avatar e hora, cabeçalho do contato, bolhas (equipe verde, Olivia azul clara, contato branca) com tiques de entrega e separador de dia, fundo bege e campo de mensagem com botão redondo de enviar.
- **Etiquetas** derivadas dos dados que já existem (sem tabela nova): Aguardando resposta, quem atende (Olivia, Equipe, Paciente, Encerrada), temperatura, situação do lead, origem e "Fora da janela 24h". A linha da lista mostra as duas mais importantes; o botão à direita (`+N`) expande as demais. O cabeçalho da conversa mostra todas.
- **Filtros** (botão "Filtros" na lista): vez de responder, atendimento, temperatura, situação do lead e origem, mais a busca por nome ou telefone.
- Etiquetas manuais (livres) ainda não existem; exigiriam tabela própria.

---

## 4. Salas (`/reservas`)

Timeline visual de ocupação das 7 salas para o dia atual.

- **Grade horária:** 07:00 às 22:00 (15 horas)
- Cada sala tem cor própria (emerald, blue, violet, amber, rose, teal, indigo)
- Blocos de reserva posicionados proporcionalmente na grade (CSS `left` + `width` em %)
- Status exibido: Agendado · Confirmado · Concluído · No-show · Cancelado
- Sala livre = fundo suave da cor da sala
- Sala ocupada agora = fundo saturado + ponto pulsante

---

## 5. Histórico (`/reservas/historico`)

Log completo de reservas com paginação.

- 50 registros por página (`PER_PAGE = 50`)
- Paginação via query param `?page=N`
- Colunas: data · horário · duração · médico · sala · plano · status
- Badge de plano e status coloridos
- Duração calculada em horas/minutos
- Ordenado por `start_time DESC` (mais recente primeiro)

---

## 6. Horas (`/medicos/horas`)

Gestão de saldo de pacotes de horas por profissional.

- Agrupa pacotes por profissional (saldo consolidado)
- Exibe: total comprado · minutos usados · saldo disponível · data de expiração
- Expandível por profissional para ver pacotes individuais
- Ação inline: **Adicionar horas** (Server Action `addHours`)
- Alerta visual para saldos críticos (próximos de zero)
- Formato: `Xh Ymin` ou `Xh`

---

## 7. Planos (`/medicos/assinaturas`)

Assinaturas ativas e médicos sem plano.

- Lista de assinaturas da tabela `subscriptions` (join `profiles` + `plans`)
- Colunas: médico · CRM · especialidade · plano · ciclo · datas de início/fim · status
- Seção separada: **médicos sem assinatura** (profiles sem entrada em `subscriptions`)
- Status: Ativo (verde) · Pendente (amarelo) · Cancelado (vermelho) · Inativo (cinza)
- Ciclo: mensal ou anual

---

## 8. Módulos (`/medicos/modulos`)

Módulos adicionais contratados por médicos.

- Join `user_modules` → `profiles` → `modules`
- Campos: médico · módulo (nome, categoria, tipo) · valor · data de ativação · validade · status
- Contadores no header: ativos / pendentes de pagamento
- Ação inline: **Ativar/Desativar** módulo (Server Action `setModuleStatus`)
- Status: Ativo · Pendente · Cancelado · Inativo

---

## 9. Minutagem por Sessão (`/reservas/minutagem`)

Cobranças de minutagem (`usage_charges`).

- Exibe cobranças com: médico · data · duração · sala · plano · valor · status
- Formatos: duração em h/min · valor em R$ BRL · data pt-BR
- Status de cobrança coloridos (Ativo, Pendente, Cancelado, Inativo)
- Suporte a status uppercase do Supabase (`ACTIVE`, `CANCELLED`)

---

## 10. Usuários (`/configuracoes/usuarios`)

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
