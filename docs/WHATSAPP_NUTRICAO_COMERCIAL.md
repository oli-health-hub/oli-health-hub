# Régua de nutrição comercial — WhatsApp

> Roteiro e configuração dos contatos comerciais do OLI Health Hub.
> **Versão:** 1.0 · **Data:** 26/Agosto/2026.

## Objetivo e limites

Esta régua serve exclusivamente para leads comerciais que autorizaram o
contato pelo WhatsApp. Não se aplica a pacientes e não envia dados de saúde.

Antes de cada disparo, o sistema deve confirmar: opt-in registrado com data e
origem, ausência de opt-out, lead ainda não convertido, conversa não está em
`humano` e não houve mensagem recebida desde o agendamento do próximo contato.
Uma resposta do lead cancela todos os próximos disparos e abre uma nova janela
de atendimento de 24 horas. As mensagens devem sair somente entre 9h e 19h,
horário de São Paulo.

Não enviar mais de uma mensagem por etapa nem mais de cinco contatos ativos
por lead nesta régua. Após a mensagem de encerramento, o lead fica pausado: não
há nova automação sem novo opt-in ou iniciativa do próprio lead.

## Fluxo

| Etapa | Quando | Canal | Finalidade |
|---|---:|---|---|
| Primeiro contato | D0 | Template de Marketing | Abrir conversa com um lead que deu opt-in |
| Retomada contextual | 2h a 22h de silêncio | Texto livre | Retomar somente um assunto pendente na janela de 24h |
| Nutrição 1 | D+3 sem resposta | Template de Marketing | Reabrir a conversa com baixa fricção |
| Nutrição 2 | D+10 sem resposta | Template de Marketing | Mostrar relevância do OLI para a rotina profissional |
| Nutrição 3 | D+24 sem resposta | Template de Marketing | Convidar para visitar o espaço |
| Encerramento | D+45 sem resposta | Template de Marketing | Pausar o contato de modo respeitoso |

O relógio de cada etapa começa na última mensagem enviada pela régua. Caso o
lead responda, todas as etapas seguintes são canceladas e a Olivia atende
normalmente. Caso peça uma pessoa, haja reclamação ou use termos de opt-out
(`PARAR`, `SAIR`, `REMOVER`, `CANCELAR`), a régua é cancelada imediatamente.

## Roteiro dentro da janela de 24 horas

Não é template: é uma única mensagem livre, gerada pela Olivia a partir do
histórico, após pelo menos duas horas de silêncio. Deve retomar o último ponto
em aberto, sem repetir a pergunta literalmente ou introduzir informação nova.

| Contexto aberto | Intenção da Olivia | Exemplo de tom |
|---|---|---|
| Interesse genérico no OLI | Facilitar a descoberta da necessidade | “Posso te ajudar a entender qual formato de uso faz mais sentido para a sua rotina.” |
| Estrutura ou planos explicados | Abrir espaço para uma dúvida concreta | “Se quiser, posso esclarecer algum ponto sobre o funcionamento do OLI.” |
| Visita mencionada | Reoferecer o próximo passo, sem pressão | “Quando fizer sentido, posso encaminhar novamente o link para agendar uma visita.” |
| Pergunta específica em aberto | Retomar o assunto exato | “Fico à disposição caso queira retomar aquele ponto ou tirar alguma dúvida.” |

Não enviar retomada quando a conversa terminou naturalmente, já foi transferida
ao comercial, o lead pediu para não receber mensagens ou não há um assunto
comercial pendente. O job existente `whatsapp-nudge-silencio` já aplica uma
única retomada por silêncio entre 2h e 22h.

## Templates enviados para análise na Meta

Os cinco modelos de Marketing abaixo foram enviados para análise em
26/Agosto/2026. Manter nomes, idioma, variáveis e botões descritos aqui como
referência até a decisão da Meta; não ativar a régua enquanto o status não for
**Aprovado**.

Todos os cinco modelos abaixo são de **Marketing**, idioma **Português
(Brasil)**, e usam cabeçalho de texto opcional. O conteúdo não deve mencionar
dados de pacientes, condições clínicas, nem informações que a Olivia não pode
confirmar. A variável `{{1}}` recebe apenas o primeiro nome informado pelo
lead; se não houver nome, não enviar o modelo.

### 1. `primeiro_contato_comercial_v1`

**Uso:** D0, somente para lead com opt-in válido.  
**Corpo:**

```text
Olá, {{1}}! Sou a Olivia, assistente virtual do OLI Health Hub.

Posso ajudar você a conhecer como funcionam os nossos espaços para profissionais da saúde?
```

**Botão sugerido:** resposta rápida `Quero conhecer`.

### 2. `nutricao_comercial_d3_v1`

**Uso:** D+3 sem resposta ao primeiro contato.  
**Corpo:**

```text
Olá, {{1}}! Passando para saber se ainda faz sentido conhecer o OLI Health Hub.

Se quiser, posso responder dúvidas sobre os espaços e como funciona o uso no dia a dia.
```

**Botões sugeridos:** respostas rápidas `Quero saber mais` e `Agora não`.

### 3. `nutricao_comercial_d10_v1`

**Uso:** D+10 sem interação desde D+3.  
**Corpo:**

```text
Olá, {{1}}! O OLI reúne estrutura física para atendimento e ferramentas de gestão para a rotina profissional.

Se esse formato fizer sentido para você, posso ajudar a indicar o melhor próximo passo.
```

**Botões sugeridos:** respostas rápidas `Entender o OLI` e `Falar com a equipe`.

### 4. `nutricao_comercial_d24_v1`

**Uso:** D+24 sem interação desde D+10.  
**Corpo:**

```text
Olá, {{1}}! Se quiser conhecer o OLI de perto, você pode agendar uma visita no momento que for melhor para você.
```

**Botão sugerido:** URL `Agendar visita`, apontando para o Calendly oficial do
OLI (`https://calendly.com/olihealthhub/atendimento-presencial`).

### 5. `nutricao_comercial_d45_v1`

**Uso:** D+45 sem interação desde D+24.  
**Corpo:**

```text
Olá, {{1}}! Como não tivemos retorno, vamos pausar nossas mensagens por aqui.

Quando quiser retomar e conhecer o OLI Health Hub, basta responder a esta conversa.
```

**Botão sugerido:** resposta rápida `Quero retomar`.

### Modelo interno já criado

`handoff_comercial_v1` é separado desta régua: categoria **Utilidade**, enviado
somente ao WhatsApp comercial quando a Olivia transfere o lead. Mantém quatro
variáveis na ordem: telefone, nome, resumo e motivo do handoff.

## Procedimento de configuração na Meta

1. Acesse **Configurações do negócio → Contas → Contas do WhatsApp** e selecione
   a conta que contém o número do OLI.
2. Abra **Gerenciador do WhatsApp → Modelos de mensagem → Criar modelo**.
3. Selecione **Marketing**, idioma **Português (Brasil)** e informe exatamente
   um dos nomes listados acima. Não reutilize o mesmo nome de versão anterior.
4. Cole o corpo correspondente. Insira `{{1}}` pelo botão **Adicionar variável**
   e preencha uma amostra fictícia, por exemplo `Ana`.
5. Adicione apenas os botões indicados no roteiro. No modelo D+24, cadastre a
   URL estática oficial do Calendly; nos demais, use respostas rápidas.
6. Em **Enviar para análise**, confirme a categoria e aguarde o status
   **Aprovado**. Não ative automações enquanto qualquer modelo estiver em
   revisão, pausado ou rejeitado.
7. Registre para cada modelo aprovado: nome Meta, idioma `pt_BR`, categoria,
   status, versão, data de aprovação e o texto efetivamente aprovado.

## Configuração no Supabase e no Admin

Esta parte deve ser feita antes de ligar os disparos. Ela ainda precisa de
implementação no projeto, pois a tabela de leads não registra hoje o opt-in de
WhatsApp com timestamp nem possui uma agenda persistente para as etapas D+3 a
D+45.

1. Adicionar ao lead: `whatsapp_opt_in_at`, `whatsapp_opt_in_source`,
   `whatsapp_opt_out_at` e, se necessário, a evidência de consentimento. Sem
   `whatsapp_opt_in_at`, o lead é inelegível.
2. Criar uma agenda persistente de nutrição por lead, com etapa, data prevista,
   status (`agendada`, `cancelada`, `enviada`, `falhou`) e `template_name`.
   O histórico precisa impedir duplicidade em reexecuções do cron.
3. Criar um job que execute em horário comercial, busque somente etapas
   elegíveis e envie o template pelo helper `enviarTemplate()`.
4. Cancelar etapas futuras em qualquer mensagem inbound, mudança da conversa
   para `humano`, conversão do lead, agendamento de visita ou opt-out.
5. Na tela de leads, mostrar consentimento, próxima etapa e uma ação explícita
   de pausar/retomar. A ação de retomar nunca substitui um opt-in ausente.
6. Configurar os nomes aprovados como variáveis de ambiente, sem hardcode,
   por exemplo `WHATSAPP_TEMPLATE_NUTRICAO_D3`.
7. Testar com um número autorizado: primeiro contato, resposta que cancela a
   agenda, silêncio que agenda a etapa seguinte, opt-out e handoff humano.

## Critérios para ativação

- Os cinco templates de Marketing estão aprovados pela Meta.
- O `handoff_comercial_v1` está aprovado e configurado no ambiente.
- O opt-in e o opt-out são persistidos antes do primeiro disparo.
- Não existe envio automático para lead sem nome ou sem consentimento.
- As mensagens não incluem informação de saúde, preço não confirmado ou PII
  além do primeiro nome e telefone necessário ao envio.
- O teste ponta a ponta comprova que uma resposta do lead interrompe as etapas
  futuras.
