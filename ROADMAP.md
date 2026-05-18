# OLI Health Hub — Roadmap de Desenvolvimento

> **Modelo de Negócio:** Plataforma de Operação Assistida Integrada para médicos independentes.
> Consolação/Paulista — SP. 6 salas operantes + sala de eventos. Custo fixo: R$ 25.000/mês.

---

## Status Atual
- [x] Protótipo funcional (React Native + Expo)
- [x] Design System OLI definido
- [x] Autenticação Supabase (email + senha + MFA TOTP)
- [x] App lock biométrico (Face ID / Touch ID, 5 min inatividade)
- [x] Reservas de salas com timer de minutagem
- [x] CRM de pacientes com consentimento LGPD
- [x] Ecossistema OLI — Soluções, Especialistas e Eventos
- [x] Onboarding diagnóstico contábil (10 perguntas → Supabase)
- [x] Segurança: hash CPF SHA-256, audit log imutável, variáveis de ambiente
- [x] Build Android distribuído (EAS Preview)

---

## 🔴 Segurança — Sprint Imediato (antes de dados reais)

- [x] RLS em todas as tabelas
- [x] Hash SHA-256 do CPF (LGPD Art. 11)
- [x] Variáveis de ambiente (telefone, chaves)
- [x] MFA TOTP via Supabase Auth
- [x] App lock biométrico
- [x] Audit log imutável
- [ ] **Gateway de pagamento PCI DSS** — Asaas (PIX, boleto, cartão, recorrência)
- [x] **Rate limiting de autenticação** — máx. 5 tentativas / 15 min

---

## 🟡 Segurança — Sprint 1 (primeiras 4 semanas em produção)

- [x] Direito ao esquecimento — exclusão em cascade (LGPD Art. 18)
- [x] Portabilidade de dados — exportação JSON (LGPD Art. 18)
- [ ] Criptografia de colunas financeiras — pgcrypto
- [x] Timeout de sessão — logout automático após 30 min
- [x] Política de privacidade — publicada e linkada no perfil
- [ ] Sentry configurado para nunca logar dados pessoais

---

## 🟢 Segurança — Sprint 2 (antes das lojas)

- [ ] Certificate pinning
- [ ] Disable screenshot em telas sensíveis
- [ ] Penetration testing (empresa especializada em saúde)
- [ ] DPO designado (exigência LGPD para dados de saúde)
- [ ] Dependency audit automatizado no CI/CD

---

## Fase 0 — Fundação ✅ Concluída

- [x] React Native + Expo SDK, Expo Router v4, Zustand 5
- [x] Design System OLI (verde, dourado, creme)
- [x] Navegação por abas (Início, Agenda, Pacientes, Ecossistema, Financeiro)
- [x] Supabase: profiles, rooms, reservations, patients + RLS

---

## ⚠️ Decisões Pendentes (bloqueia implementação da Fase 1)

> Baseado na Reunião de Parceiros de 15/05/2026. Aguardando definição até 06/06/2026.

| Decisão | Responsável | Prazo | Impacto no App |
|---------|-------------|-------|----------------|
| Composição final dos planos BASE/PRO/VIP | Guilherme/Igor | 06/06 | Tela de planos, onboarding |
| Precificação definitiva (mensal + anual + modular) | Guilherme/Igor | 06/06 | Gateway Asaas, cobrança |
| BPO Financeiro (Miriam) — escopo e parceria | Guilherme | reunião 19/05 | Módulo VIP + contratação avulsa |
| Produto "sem espaço físico" para médicos de outros estados | Guilherme/Igor | 15/08 | Novo perfil de usuário |
| Configuração e precificação da telemedicina nas salas | Guilherme/Igor | 06/06 | Módulo Telemedicina |
| Programa de indicação (regras e benefícios) | Guilherme/Igor/Mint | 15/07 | Funcionalidade referral |

> 🔒 **Preço e composição de planos NÃO serão hardcoded no app** — virão de tabela no Supabase para facilitar ajustes sem novo build.

---

## Fase 1 — MVP com Gestão de Planos e Cobrança 🚧 Próxima

### 1.0 — Novos Parceiros no Ecossistema

A reunião de 15/05 revelou parceiros estratégicos ainda não representados no app:

| Parceiro | Empresa | Serviço | Plano |
|----------|---------|---------|-------|
| Amanda | AR Soluções | Convênios médicos + gestão de carreira | PRO/VIP |
| Ronaldo | AR Soluções | Redução de no-show + faturamento em operadoras | PRO/VIP |

**Tarefas:**
- [x] Adicionar card "OLI Convênios" (AR Soluções) na tela Ecossistema
- [x] Adicionar card "OLI Carreira" (AR Soluções) na tela Ecossistema
- [ ] Adicionar agente virtual para AR Soluções quando disponível

---

### 1.1 — Modelo de Usuários e Planos

**Tipos de usuário:**
| Tipo | Descrição | Acesso |
|------|-----------|--------|
| `subscriber` | Assina um plano recorrente (BASE/PRO/VIP) | Funcionalidades do plano |
| `hour_user` | Sem plano — compra horas avulsas ou pacotes | Só reserva de sala |
| `admin` | Equipe OLI — gerencia tudo | Dashboard admin completo |

**Planos:**
| Plano | Mensalidade | Minutagem | Público-alvo |
|-------|-------------|-----------|--------------|
| BASE  | R$ 299/mês  | R$ 1,70/min (R$ 102/h) | Médicos em transição (R1-R2) |
| PRO   | R$ 599/mês  | R$ 1,60/min (R$ 96/h) | Volume crescente, quer automação |
| VIP   | R$ 1.199/mês | R$ 1,50/min (R$ 90/h) | Consolidados, ecossistema completo |

**Benefícios por plano:**
- **BASE:** Infraestrutura + Jurídico (diagnóstico inicial, CNPJ) + Contabilidade (orientação CNPJ) + 1 evento/mês
- **PRO (tudo do BASE +):** Communicare básico (prontuário, agenda, WhatsApp) + Operação assistida (faturamento, recepção WA, automações) + Jurídico expandido (documentos personalizados) + Contabilidade consultoria inicial
- **VIP (tudo do PRO +):** Communicare Premium (IA, transcrição, chatbot avançado) + Contabilidade integrada (IR PF gratuito, previdência, certificado digital) + Jurídico contínuo (3h/trimestre, MADD, revisão contratos) + Networking VIP (grupo de negócios OLI)

**Regras de negócio validadas na reunião de parceiros:**
- **Pré-pago sempre** — sem acesso ao espaço antes do pagamento confirmado
- **Assinatura anual é prioridade**, especialmente no VIP — exibida primeiro, com desconto em destaque
- **Assinatura mensal disponível** como opção secundária (mais acessível na entrada)
- **VIP exige anual** como padrão — marketing e contabilidade precisam de histórico mínimo
- **Minutagem separada da assinatura** — já pode operar independente
- **Planos e preços no banco** — nunca hardcoded, para ajustar sem novo build
- **BPO Financeiro** — incluso no VIP + disponível como módulo avulso (igual demais serviços de parceiros)

**Tarefas:**
- [x] Migration: tabela `plans` (id, nome, preco_mensal, preco_anual, taxa_min, features_json)
- [x] Migration: tabela `subscriptions` (usuario, plano, ciclo: mensal/anual, status, datas, asaas_id)
- [x] Migration: tabela `hour_packages` (tipo, horas, valor, validade_dias)
- [x] Migration: tabela `hour_balance` (saldo de horas por usuário, expira_em)
- [x] Migration: tabela `usage_charges` (log de minutagem por sessão: inicio, fim, minutos, valor)
- [x] Migration: tabela `referrals` (indicador_id, indicado_id, status, beneficio_aplicado)
- [x] Coluna `user_type` e `plan_id` em `profiles`
- [x] Coluna `pre_paid_ok` — boolean que libera ou bloqueia acesso às salas
- [x] RLS separado para `subscriber` vs `hour_user` vs `admin`

---

### 1.2 — Módulos À La Carte (compra avulsa)

Módulos disponíveis para compra independente de plano:

**Tecnologia:**
| Módulo | Valor | Recorrência |
|--------|-------|-------------|
| Telemedicina | R$ 150/mês | Mensal |
| Prontuário com IA | R$ 200/mês | Mensal |
| Chatbot Inteligente | R$ 100/mês | Mensal |

**Jurídico (Ana):**
| Módulo | Valor | Tipo |
|--------|-------|------|
| Documentos Personalizados | R$ 300–600 | Único |
| Análise de Post (MADD) | R$ 200/post | Avulso |
| Consultoria Pontual | R$ 300/h | Avulso |
| Revisão de Contrato | R$ 400 | Único |

**Contabilidade (Isabela/Mello):**
| Módulo | Valor | Tipo |
|--------|-------|------|
| Gestão Contábil Mensal | R$ 500/mês | Mensal |
| Consultoria Tributária | R$ 500 | Avulso |
| Previdência | R$ 300 | Avulso |

**Tarefas:**
- [x] Migration: tabela `modules` (nome, descrição, valor, tipo: mensal/avulso)
- [x] Migration: tabela `user_modules` (usuario, modulo, status, ativo_ate)
- [ ] Tela de Módulos no app (listagem com status: ativo/inativo/disponível)
- [ ] Fluxo de compra de módulo individual

---

### 1.3 — Pacotes de Horas (hour_user e suplemento)

Para usuários sem plano e para assinantes que precisam de horas extras:

| Pacote | Horas | Valor | Validade |
|--------|-------|-------|----------|
| Avulso | 1h | ~R$ 120–150 | 30 dias |
| Pacote Starter | 10h | ~R$ 1.100 | 60 dias |
| Pacote Médio | 20h | ~R$ 2.000 | 90 dias |
| Pacote Intensivo | 40h | ~R$ 3.600 | 90 dias |

> Valores a definir pelo Guilherme antes de implementar na loja.

**Tarefas:**
- [ ] Tela de compra de pacotes no app
- [ ] Exibição de saldo de horas no Dashboard
- [ ] Alerta quando saldo < 2h
- [ ] Histórico de uso de horas

---

### 1.4 — Cobrança por Minutagem

O timer já rastreia minutos em tempo real. Precisa alimentar o faturamento:

- [x] Ao finalizar reserva: calcular `minutos × taxa_plano` e gravar em `usage_charges`
- [ ] Deduzir do saldo de horas (se `hour_user` ou pacote)
- [ ] Somar na fatura mensal (se `subscriber`)
- [ ] Exibir extrato de minutagem no app (tela Financeiro)
- [ ] Resumo mensal: horas usadas, valor da mensalidade, minutagem, total

---

### 1.5 — Programa de Indicação

Consenso da reunião: médico que indica ganha mês grátis ou benefício definido.

- [ ] Gerar código de indicação único por usuário
- [ ] Tela "Indicar Colega" com link compartilhável
- [ ] Webhook/trigger: quando indicado assina, aplicar benefício ao indicador automaticamente
- [ ] Histórico de indicações no perfil

---

### 1.6 — Gateway de Pagamento (Asaas)

**Por que Asaas:**
- Brasileiro (sem conversão de moeda)
- PIX nativo, boleto, cartão de crédito
- Recorrência automática para assinaturas
- Webhook confiável para atualizar Supabase
- API REST simples

**Arquitetura:**
```
App → Supabase Edge Function → Asaas API
                ↓
         Asaas Webhook → Supabase Edge Function → update subscription status
```

**Tarefas:**
- [ ] Criar conta Asaas e obter API keys
- [ ] Edge Function: `create-subscription` (plano recorrente)
- [ ] Edge Function: `create-charge` (módulo avulso ou pacote de horas)
- [ ] Edge Function: `asaas-webhook` (atualiza status da assinatura no Supabase)
- [ ] Tela de checkout no app (exibe boleto/PIX/link cartão — usuário paga fora do app)
- [ ] Tela de Financeiro com histórico de faturas e status de pagamento
- [ ] Alertas de vencimento e inadimplência

> ⚠️ Nunca armazenar dados de cartão no app. Asaas gera links seguros para o pagamento.

---

### 1.7 — Dashboard Admin (Web)

Painel web para a equipe OLI gerenciar usuários, assinaturas e receita:

**Stack:** Next.js + Supabase (mesmo banco) + Tailwind CSS

**Funcionalidades:**
- [ ] Lista de usuários (subscribers + hour_users)
- [ ] Criar/editar/suspender assinaturas manualmente
- [ ] Ver saldo de horas por usuário
- [ ] Histórico de reservas e minutagem por profissional
- [ ] Receita mensal (mensalidades + minutagem + módulos)
- [ ] Inadimplência com ação rápida (suspender acesso)
- [ ] Aprovar upgrades de plano
- [ ] Adicionar módulos manualmente (ex: presente)
- [ ] Relatório de viabilidade econômica (break-even tracker)
- [ ] Gestão de usuários sem plano (hour_users)

> Dashboard web separado do app mobile. Acesso restrito por `user_type = 'admin'`.

---

### 1.8 — Tela de Planos e Assinatura no App (para o profissional)

- [ ] Tela "Meu Plano" com plano atual, benefícios, data de renovação
- [ ] Tela de upgrade (comparação BASE → PRO → VIP)
- [ ] Tela de módulos disponíveis e ativos
- [ ] Fluxo de contratação (gera cobrança Asaas → exibe QR PIX / boleto)
- [ ] Status de pagamento em tempo real (webhook → Supabase → app)
- [ ] Tela Financeiro: faturas, extrato de minutagem, histórico de pagamentos

---

## Fase 2 — Funcionalidades OLI Completas (Semanas 8–12)

> Funcionalidades solicitadas pelos parceiros na reunião de 15/05/2026

### App do Profissional
- [ ] **Vídeo de boas-vindas personalizado** no primeiro login (diferencial de onboarding)
- [ ] **Dashboard de indicadores por parceiro** — card por parceiro (contábil, marketing, convênios, agendamento)
- [ ] **Chat entre profissionais do Hub** — networking virtual interno
- [ ] **Agenda de eventos do espaço** — workshops, grupos de negócios, palestras
- [ ] **NPS do profissional** — métrica de permanência e curadoria (`useNPSGate` + modal)
- [ ] **Programa de indicação** — gerar link, rastrear, aplicar benefício automaticamente
- [x] Timer em background (app minimizado) — notificações agendadas cobrem o gap
- [x] Notificações push: alertas de sessão, buffer urgente, saldo baixo
- [x] Relatórios PDF (`expo-print`): extrato mensal com ROI, serviços e histórico de faturas
- [ ] QR Code funcional com `expo-camera`
- [ ] Métricas CRM: de histórico real de consultas

### Assistentes Virtuais (parceiros representados no app)
- [ ] **Ana** (Jurídico) — já no app, expandir para documentos personalizados
- [ ] **Isabella** (Contábil Melo) — já no app, conectar ao dashboard contábil real
- [ ] **Agente AR Soluções** — convênios, carreira, gestão de agenda (a nomear com Amanda/Ronaldo)

### Telemedicina
- [ ] Todas as salas habilitadas para tele (não apenas sala dedicada)
- [ ] Módulo de reserva de sala com modo "telemedicina" (configuração de câmera/light)
- [ ] Precificação de tele via módulo separado (R$ 150/mês)

---

## Fase 3 — Integração Communicare (Semanas 12–16)

> Disponível a partir do Plano PRO

- [ ] Obter documentação e credenciais OAuth 2.0 (Heitor)
- [ ] Substituir `CommunicareMockService` por `CommunicareApiService`
- [ ] Prontuário digital integrado (PRO)
- [ ] Agenda online com confirmações automáticas WA (PRO)
- [ ] Faturamento direto no CNPJ do médico (PRO)
- [ ] Communicare com IA: transcrição automática (VIP)
- [ ] Chatbot inteligente avançado (VIP)
- [ ] Cache local TTL 5 min

---

## Fase 4 — Publicação nas Lojas (Semana 18+)

### Pré-requisitos
- [ ] Todos os itens 🔴 e 🟡 de segurança concluídos
- [ ] Gateway de pagamento em produção
- [ ] Política de privacidade publicada
- [ ] Ícone e splash screen finais
- [ ] Screenshots para App Store e Google Play

### iOS (aguardando validação Apple Developer)
- [ ] `eas build --platform ios --profile preview` (TestFlight interno)
- [ ] `eas build --platform ios --profile production`
- [ ] Submissão via EAS Submit

### Android
- [x] Build preview disponível (APK direto)
- [ ] `eas build --platform android --profile production` (AAB)
- [ ] Submissão Google Play

---

## Escalabilidade (Anos 2–5)

| Horizonte | Meta |
|-----------|------|
| Ano 1 | 50–60 médicos residentes, break-even 12 médicos, validar modelo |
| Anos 2–3 | 2ª unidade SP, Grupo de Negócios OLI, produtos digitais |
| Anos 4–5 | Franquias, expansão nacional, possível M&A |

---

## Mapa de Riscos

| Risco | Status | Mitigação |
|-------|--------|-----------|
| CPF em texto puro | ✅ Resolvido | Hash SHA-256 + salt |
| Telefone hardcoded | ✅ Resolvido | `.env` |
| Acesso sem MFA | ✅ Resolvido | TOTP Supabase Auth |
| Dados sem audit log | ✅ Resolvido | Tabela imutável RLS |
| Dados de cartão sem gateway | 🔴 Pendente | Asaas antes de cobrar |
| Cobrança sem recorrência | 🔴 Pendente | Asaas webhooks |
| Rate limiting auth | 🔴 Pendente | Supabase / Edge Function |
| Direito ao esquecimento | 🟡 Planejado | Delete cascade |
| MITM rede hospitalar | 🟢 Planejado | Certificate pinning |
| Conflito de reservas | ✅ Resolvido | RLS + check servidor |
| Guerra de preços (concorrência) | Mitigado | Posicionamento: operação integrada, não espaço |
| Alta rotatividade (churn) | Mitigado | Switching cost alto: contador + jurídico + prontuário integrados |
| Baixa adesão inicial | Mitigado | Break-even em 12 médicos (viável) |
