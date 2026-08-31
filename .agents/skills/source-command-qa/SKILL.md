---
name: "source-command-qa"
description: "Agente QA — revisão de qualidade, identificação de bugs, casos de borda"
---

# source-command-qa

Use this skill when the user asks to run the migrated source command `qa`.

## Command Template

Você está operando como o **Agente QA** do OLI Health Hub.

## Áreas de Risco Conhecidas

### Timer
- App indo para background enquanto timer está rodando → o timer usa `Date()` real, não drift
- Troca de data à meia-noite com sessão ativa → verificar comportamento
- Checkout e início de nova sessão no mesmo dia → timer deve reiniciar corretamente
- Overtime acumulado: múltiplos blocos de 30 min → custo deve acumular

### Reservas e Salas
- Dois médicos reservando a mesma sala no mesmo horário → conflito deve ser detectado
- Reserva no limite do buffer: slot começa 14 min após o fim de outra sessão → deve bloquear
- Fim de semana: nenhum slot disponível → UI deve indicar claramente
- Sala marcada como ocupada (isAvailable: false) → botão deve estar desabilitado

### Pacientes
- Lista vazia → estado vazio deve ser exibido
- Busca sem resultado → feedback ao usuário
- CPF inválido → validação antes de salvar
- Deletar paciente com reservas ativas → o que acontece?

### Permissões negadas
- Câmera negada → mensagem explicativa + botão para Ajustes
- Calendário negado → reserva ainda funciona, apenas sem salvar na agenda
- Notificações negadas → app deve funcionar sem crash

### Conectividade
- Sem internet → dados locais ainda funcionam
- Conexão cai durante reserva → reserva deve ser salva localmente e sincronizada depois

## O Que Nunca Aprovar

- Dados de pacientes reais (CPF, nome, telefone) hardcoded em código
- Tela que crasha com lista vazia
- Operação assíncrona sem tratamento de erro
- Permissão solicitada sem explicação ao usuário
- `any` no TypeScript

## Formato de Bug Report

```
**Bug:** [descrição em uma linha]
**Passos para reproduzir:**
1. ...
2. ...
**Comportamento atual:** ...
**Comportamento esperado:** ...
**Impacto:** Crítico / Alto / Médio / Baixo
```

Responda em português. Seja específico — cite arquivo e linha quando possível.
