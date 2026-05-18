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
- [ ] **Rate limiting de autenticação** — máx. 5 tentativas / 15 min

---

## 🟡 Segurança — Sprint 1 (primeiras 4 semanas em produção)

- [ ] Direito ao esquecimento — exclusão em cascade (LGPD Art. 18)
- [ ] Portabilidade de dados — exportação JSON (LGPD Art. 18)
- [ ] Criptografia de colunas financeiras — pgcrypto
- [ ] Timeout de sessão — logout automático após 30 min
- [ ] Política de privacidade — publicada e linkada no cadastro
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

## Fase 1 — MVP com Gestão de Planos e Cobrança 🚧 Próxima

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

**Tarefas:**
- [ ] Migration: tabela `plans` com planos e preços
- [ ] Migration: tabela `subscriptions` (usuario, plano, status, datas, asaas_id)
- [ ] Migration: tabela `hour_packages` (tipo, horas, valor, validade)
- [ ] Migration: tabela `hour_balance` (saldo de horas por usuário)
- [ ] Migration: tabela `usage_charges` (log de minutagem cobrada por sessão)
- [ ] Coluna `user_type` e `plan_id` em `profiles`
- [ ] RLS separado para `subscriber` vs `hour_user` vs `admin`

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

**Mentoria (César) — Futuro:**
| Módulo | Valor | Tipo |
|--------|-------|------|
| Mentoria de Carreira | R$ 500/mês | Mensal |
| Posicionamento Profissional | R$ 1.000 | Único |
| Estruturação de Agenda | R$ 600 | Único |

**Tarefas:**
- [ ] Migration: tabela `modules` (nome, descrição, valor, tipo: mensal/avulso)
- [ ] Migration: tabela `user_modules` (usuario, modulo, status, ativo_ate)
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

- [ ] Ao finalizar reserva: calcular `minutos × taxa_plano` e gravar em `usage_charges`
- [ ] Deduzir do saldo de horas (se `hour_user` ou pacote)
- [ ] Somar na fatura mensal (se `subscriber`)
- [ ] Exibir extrato de minutagem no app (tela Financeiro)
- [ ] Resumo mensal: horas usadas, valor da mensalidade, minutagem, total

---

### 1.5 — Gateway de Pagamento (Asaas)

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

### 1.6 — Dashboard Admin (Web)

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

### 1.7 — Tela de Planos e Assinatura no App (para o profissional)

- [ ] Tela "Meu Plano" com plano atual, benefícios, data de renovação
- [ ] Tela de upgrade (comparação BASE → PRO → VIP)
- [ ] Tela de módulos disponíveis e ativos
- [ ] Fluxo de contratação (gera cobrança Asaas → exibe QR PIX / boleto)
- [ ] Status de pagamento em tempo real (webhook → Supabase → app)
- [ ] Tela Financeiro: faturas, extrato de minutagem, histórico de pagamentos

---

## Fase 2 — Funcionalidades OLI Completas (Semanas 8–12)

- [ ] Tela de comunidade e networking (eventos, grupos)
- [ ] Notificações push: alertas de sessão, fatura, buffer, saldo baixo
- [ ] Timer em background (app minimizado)
- [ ] Chatbot OLI com personas reais (Ana/Isabella/César via API Claude)
- [ ] Relatórios PDF (`expo-print`): extrato mensal, comprovantes
- [ ] QR Code funcional com `expo-camera`
- [ ] NPS: `useNPSGate` + modal de coleta → tabela `nps_responses`
- [ ] Métricas CRM: de histórico real de consultas

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
