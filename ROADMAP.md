# OLI Health Hub — Roadmap de Desenvolvimento

## Status Atual
- [x] Protótipo funcional em Swift (iOS apenas)
- [x] Design System OLI definido
- [x] Lógica de negócio validada (timer, buffer, checkout)
- [x] Migração concluída para React Native + Expo
- [x] Autenticação Supabase (email + senha)
- [x] Reservas de salas com detecção de conflito
- [x] CRM de pacientes com consentimento LGPD
- [x] Ecossistema OLI — Soluções, Especialistas e Eventos
- [x] Onboarding diagnóstico contábil (10 perguntas)
- [x] Migração Supabase: onboarding + NPS

---

## 🔴 Segurança — Sprint Imediato (antes de qualquer dado real)

> Itens obrigatórios antes de coletar dados de produção. Violações ativas.

- [x] RLS habilitado em todas as tabelas (profiles, patients, reservations, rooms)
- [ ] **Hash SHA-256 do CPF** — está sendo armazenado em texto puro (violação LGPD Art. 11)
- [ ] **Variáveis de ambiente** — telefone da recepção hardcoded em `whatsapp.ts`
- [ ] **Gateway de pagamento PCI DSS** — nunca armazenar cartão (Stripe ou Pagar.me)
- [ ] **MFA obrigatório** — TOTP via Supabase Auth para todos os médicos
- [ ] **App lock biométrico** — Face ID / Touch ID com timeout de 5 min inatividade
- [ ] **Audit log de acesso** — tabela imutável registrando acesso a dados de pacientes

---

## 🟡 Segurança — Sprint 1 (primeiras 4 semanas em produção)

- [ ] **Direito ao esquecimento** — exclusão em cascade de todos os dados do médico (LGPD Art. 18)
- [ ] **Portabilidade de dados** — exportação JSON com todos os dados do usuário (LGPD Art. 18)
- [ ] **Criptografia de colunas financeiras** — pgcrypto nas colunas do onboarding contábil
- [ ] **Rate limiting de autenticação** — máx. 5 tentativas / 15 min por IP
- [ ] **Timeout de sessão** — logout automático após 30 min de inatividade
- [ ] **Sanitização de logs** — Sentry configurado para nunca logar dados pessoais
- [ ] **Política de privacidade** — publicada e linkada no cadastro de paciente

---

## 🟢 Segurança — Sprint 2 (antes da publicação nas lojas)

- [ ] **Certificate pinning** — prevenir MITM em redes hospitalares comprometidas
- [ ] **Disable screenshot** — em telas com dados de pacientes e financeiros
- [ ] **Penetration testing** — contratar empresa especializada em apps de saúde
- [ ] **DPO designado** — responsável pela proteção de dados (exigência LGPD para dados de saúde)
- [ ] **Dependency audit** — `npm audit` automatizado no CI/CD
- [ ] **Retenção de dados** — política de expiração automática de dados inativos (+2 anos)

---

## Fase 0 — Fundação Cross-Platform ✅ Concluída

- [x] Decisão de tecnologia: React Native + Expo SDK 52
- [x] Perfis de agentes definidos em CLAUDE.md
- [x] Design System OLI (cores, tipografia, espaçamentos)
- [x] Navegação por abas (Início, Salas, Pacientes, Ecossistema, Financeiro)
- [x] Autenticação completa (login, logout, perfil)

---

## Fase 1 — Backend e MVP ✅ Em andamento

### Concluído
- [x] Projeto Supabase criado (sa-east-1)
- [x] Tabelas: `profiles`, `rooms`, `reservations`, `patients`
- [x] RLS configurado em todas as tabelas
- [x] Onboarding diagnóstico (migração aplicada)
- [x] Tabela `nps_responses` com RLS
- [x] Tela de onboarding com gate no `_layout.tsx`

### Pendente
- [ ] Realtime subscription para conflito de salas em tempo real
- [ ] Sincronização de pacientes com flag `isSincronizado`
- [ ] Reservas por data (query por `start_time::date` para datas futuras)
- [ ] Dashboard com indicadores por parceiro OLI (`partnerStore`)
- [ ] NPS: hook `useNPSGate` + modal de coleta

---

## Fase 2 — Funcionalidades Reais (Semanas 6–9)

- [ ] Notificações push: alertas de buffer, check-in e encaixe
- [ ] Timer em background: manter rodando com app minimizado
- [ ] Chatbot OLI (Ana / Isabella / Olivia): integrar API Claude com personas reais
- [ ] Relatórios financeiros: gerar PDF com `expo-print`
- [ ] QR Code: leitura real com `expo-camera`
- [ ] Métricas CRM: calcular de histórico real de consultas

---

## Fase 3 — Integração Communicare (Semanas 10–12)

- [ ] Obter documentação e credenciais OAuth 2.0 do Communicare
- [ ] Substituir `CommunicareMockService` por `CommunicareApiService`
- [ ] Sincronização bidirecional de reservas
- [ ] Disponibilidade de salas em tempo real
- [ ] Sincronização de profissionais e planos
- [ ] Cache local com TTL de 5 minutos

---

## Fase 4 — Publicação nas Lojas (Semana 15)

### Pré-requisitos de segurança (todos os itens 🔴 e 🟡 concluídos)

### Preparação
- [ ] Ícone e splash screen finais
- [ ] Screenshots para App Store e Google Play (6 telas cada)
- [ ] Descrição do app em português

### App Store
- [ ] Conta Apple Developer ($99/ano)
- [ ] `eas build --platform ios --profile production`
- [ ] Submissão via EAS Submit

### Google Play
- [ ] Conta Google Play ($25 único)
- [ ] `eas build --platform android --profile production`
- [ ] Submissão via EAS Submit

### Pós-publicação
- [ ] Monitoramento de crashes (Sentry)
- [ ] Analytics de uso (sem dados pessoais)
- [ ] OTA updates para correções urgentes

---

## Mapa de Riscos Atualizado

| Risco | Probabilidade | Impacto | Status | Mitigação |
|-------|--------------|---------|--------|-----------|
| CPF em texto puro | **Ativa** | Crítico | 🔴 Pendente | Hash SHA-256 imediato |
| Telefone hardcoded | **Ativa** | Médio | 🔴 Pendente | Mover para `.env` |
| Dados de cartão sem gateway | Alta | Crítico | 🔴 Pendente | Stripe/Pagar.me antes de cobrar |
| Acesso sem MFA | Alta | Alto | 🟡 Planejado | TOTP Supabase Auth |
| Prontuário sem audit log | Alta | Alto | 🟡 Planejado | Tabela imutável |
| MITM em rede hospitalar | Média | Alto | 🟢 Planejado | Certificate pinning |
| Rejeição na App Store | Baixa | Alto | Mitigado | LGPD antes de submeter |
| Conflito de reservas de sala | Baixa | Alto | ✅ Resolvido | RLS + check servidor |
| API Communicare sem doc | Média | Alto | Mitigado | Mock pronto, integra depois |
