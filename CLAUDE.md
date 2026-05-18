# OLI Health Hub — Documentação do Projeto

## Visão Geral
App multiplataforma (iOS + Android) para médicos que utilizam o OLI Health Hub.
Permite gerenciar reservas de salas, pacientes, finanças e acesso ao ecossistema OLI.
Desenvolvido com React Native + Expo para publicação simultânea na App Store e Google Play.

## Stack Tecnológica
| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| UI | React Native + Expo SDK 52 | Cross-platform iOS + Android |
| Linguagem | TypeScript | Tipagem forte, similar ao Swift |
| Navegação | Expo Router v4 | File-based routing, mais simples |
| Estado Global | Zustand 5 | Simples, sem boilerplate do Redux |
| Persistência Local | AsyncStorage + Expo SecureStore | Dados sensíveis criptografados pelo SO |
| Backend (fase 2) | Supabase | PostgreSQL + Auth + Realtime gratuito |
| Integração | Communicare API (fase 3) | Via serviço isolado em `src/services/` |
| Build/Deploy | Expo EAS Build | Gera .ipa e .aab para as lojas |

## Arquitetura de Pastas
```
app/                        # Expo Router (screens — arquivo = rota)
  _layout.tsx               # Stack root com modal
  (tabs)/
    _layout.tsx             # Tab bar inferior
    index.tsx               # Dashboard (timer, reservas)
    agenda.tsx              # Salas e agendamento
    pacientes.tsx           # CRM de pacientes
    ecossistema.tsx         # Plano, serviços, chatbot jurídico
    financeiro.tsx          # Faturas e pacotes de horas
  chatbot.tsx               # Modal de assessoria jurídica (Ana)
src/
  theme/
    designSystem.ts         # Cores, tipografia, espaçamentos (único lugar)
  models/
    types.ts                # Todos os tipos TypeScript
  store/
    appStore.ts             # Estado global (Zustand) — sessão, salas, reservas
    patientStore.ts         # Estado de pacientes com AsyncStorage
  hooks/
    useTimer.ts             # Timer sem drift (baseado em Date real, não contagem)
  utils/
    formatters.ts           # Data/hora/moeda — DateFormatter criado uma vez
    whatsapp.ts             # Deep links WhatsApp centralizados
  services/
    communicare.ts          # Interface + mock para integração Communicare
  components/
    PacienteRow.tsx         # Linha da lista de pacientes
    PacienteDetail.tsx      # Tela de detalhes do paciente
    AddPacienteModal.tsx    # Formulário de cadastro com consentimento LGPD
    ReservationModal.tsx    # Modal de reserva de sala
```

## Paleta de Cores OLI
```typescript
oliGreen:     '#5F7D67'   // Verde principal
oliGold:      '#B8893C'   // Dourado (plano, destaques)
oliBackground:'#F4EFEA'   // Fundo creme
oliDarkGray:  '#2F2F2F'   // Texto principal
oliLightGray: '#6B6B6B'   // Texto secundário
oliRed:       '#D9534F'   // Alertas e urgência
```

## LGPD — Requisitos Obrigatórios (Lei 13.709/2018)
Dados de saúde são **dados sensíveis** (Art. 11). Regras aplicadas neste projeto:

- [ ] CPF nunca armazenado em texto puro — usar hash SHA-256 + últimos 3 dígitos
- [ ] Dados sensíveis em `expo-secure-store` (criptografado pelo SO nativo)
- [ ] Consentimento explícito registrado com timestamp antes de coletar dados
- [ ] Funcionalidade de exportação de dados (Art. 18 — direito de portabilidade)
- [ ] Funcionalidade de exclusão de conta e dados (Art. 18 — direito ao esquecimento)
- [ ] Logs de acesso a dados de pacientes para auditoria
- [ ] Nenhum dado de saúde enviado via WhatsApp (somente agendamento)
- [ ] Número de telefone da recepção em variável de ambiente, não hardcoded
- [ ] Política de privacidade linkada na tela de cadastro

## Integração Communicare
Toda comunicação com o Communicare passa por `src/services/communicare.ts`.
- Nunca chamar a API do Communicare diretamente nas telas
- Implementação mock ativa durante desenvolvimento
- Substituir por implementação real quando credenciais OAuth forem fornecidas
- Dados esperados: profissionais, salas, reservas, planos

## Agentes Especializados
Use `/project:<agente>` para ativar um modo especializado:

| Comando | Papel |
|---------|-------|
| `/project:arquiteto` | Design de sistema, API contracts, modelos de dados |
| `/project:frontend` | Componentes React Native, telas, design system |
| `/project:seguranca-lgpd` | Auditoria de segurança e conformidade LGPD |
| `/project:qa` | Revisão de qualidade, bugs, testes |
| `/project:integrador` | Communicare e APIs externas |

## Convenções de Código
- Componentes: `PascalCase`
- Funções/variáveis: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`
- Arquivos de tela (Expo Router): `kebab-case` → `agenda.tsx`
- Arquivos de componente: `PascalCase` → `PacienteRow.tsx`
- Sem `any` no TypeScript
- Sem `console.log` em produção
- Estilos sempre em `StyleSheet.create()` no final do arquivo
- Sem objetos inline `{{ }}` dentro do JSX (causa re-renders)
- Todo elemento interativo deve ter `accessibilityLabel`
