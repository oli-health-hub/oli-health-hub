# Google Play Store — Listing (pt-BR)

Textos prontos para colar no Play Console em **Main store listing**.
Idioma: Portuguese (Brazil) – pt-BR (padrão).

---

## App name (≤30 chars)

```
OLI Health Hub
```
(13 chars)

---

## Short description (≤80 chars)

```
Gestão de salas, pacientes e finanças para médicos do OLI Health Hub.
```
(69 chars)

Alternativa A (foco em coworking):
```
Coworking médico OLI: reservas de sala, pacientes e gestão profissional.
```
(72 chars)

Alternativa B (foco em ferramentas):
```
Reservas de sala, pacientes, financeiro e assistentes IA para médicos.
```
(70 chars)

---

## Full description (≤4000 chars)

```
O OLI Health Hub é o aplicativo oficial dos médicos do nosso coworking médico
em São Paulo. Em um único lugar, você reserva salas, gerencia seus pacientes,
acompanha suas finanças e acessa o ecossistema completo de serviços OLI.

— Para quem é —
Aplicativo exclusivo para médicos clientes do OLI Health Hub. Não é um app de
saúde para o público em geral.

— Principais recursos —

• Reserva de salas em tempo real
Veja a disponibilidade do dia, faça reservas, encaixes, reagendamentos e
cancelamentos diretamente do celular. Check-in por QR Code na chegada.

• Timer de sessão
Inicie e finalize sua sessão dentro da sala. O cronômetro registra cada
minuto utilizado para que a cobrança seja exata e transparente.

• Agenda de pacientes
Cadastre, organize e acompanhe seus pacientes. Histórico, contatos,
convênios e observações em um só lugar — com proteção integral aos dados
sensíveis conforme a Lei Geral de Proteção de Dados (LGPD).

• Assistentes especializados de IA
Tire dúvidas com cinco especialistas treinados pela OLI:
  - Direito Médico (CFM, LGPD, contratos)
  - Contabilidade Médica (PJ, impostos, regime tributário)
  - OLI Convênios (TISS, credenciamento)
  - OLI Carreira (posicionamento, captação)
  - OLI Health Hub (salas, planos e operação do coworking)

• Eventos e comunidade
Confira a programação de cursos, mentorias e encontros do ecossistema OLI
e inscreva-se com um toque.

• Financeiro transparente
Acompanhe suas faturas, pacotes de horas e o uso real de cada minuto. Sem
surpresas no fim do mês.

• Planos sob medida
Escolha entre os planos START, BASE e PRO conforme seu volume de
atendimentos. Compare benefícios e altere quando quiser.

• Privacidade e segurança
Bloqueio por biometria (Face ID ou impressão digital), autenticação em duas
etapas opcional, criptografia em trânsito e em repouso. Dados de saúde
nunca são compartilhados via WhatsApp — apenas avisos logísticos.

— Sobre a OLI —
A OLI Health Hub é um coworking médico físico em São Paulo que reúne
infraestrutura premium, comunidade e tecnologia para que médicos exerçam a
clínica com mais qualidade e menos burocracia.

Saiba mais em: https://olihealthhub.com.br

Política de Privacidade: https://olihealthhub.com.br/privacidade
```

(~2.000 chars — folga p/ ajustes)

---

## Categorização

- **Category**: Medical
- **Tags** (até 5): `medical records`, `healthcare professionals`, `appointment scheduling`, `patient management`, `medical practice`

---

## Contact details

| Campo | Valor |
|---|---|
| Email | `contato@olihealthhub.com.br` |
| Phone | (opcional — deixar em branco se preferir) |
| Website | `https://olihealthhub.com.br` |

---

## Privacy Policy URL

```
https://olihealthhub.com.br/privacidade
```

(Já está no ar — passo §11.1 do HANDOFF resolvido.)

---

## App access (declaração para revisor)

App exige login. Fornecer ao Google credenciais demo:

```
URL: app instalado (sem URL web)
Usuário: revisor.google@olihealthhub.com.br
Senha: <gerar>
Instruções:
1. Abra o app.
2. Toque em "Já tenho conta" e use as credenciais acima.
3. Pule o questionário fiscal se aparecer (toque em "Pular").
4. Explore as abas Início, Agenda, Pacientes, Ecossistema, Financeiro.
5. A aba Ecossistema mostra os 5 assistentes de IA (Olivia/Ana/Isabella/
   Amanda/Ronaldo). Toque em qualquer um para conversar.
```

**Ação pendente**: criar a conta `revisor.google@olihealthhub.com.br` no
Supabase com plano BASE e algumas reservas/pacientes demo populados, antes
de submeter o app para revisão.

---

## Content rating — respostas sugeridas (questionário IARC)

- Violência: Não.
- Conteúdo sexual: Não.
- Linguagem ofensiva: Não.
- Drogas/álcool/tabaco: Não.
- Jogos/apostas: Não.
- Compartilha localização do usuário: Não (não usamos GPS).
- Permite comunicação entre usuários: Não (sem chat usuário-usuário; apenas
  IA e contato com recepção).
- Compra digital: Não (cobrança via Asaas externo, não via Play Billing).

Resultado esperado: **Livre (L) / Everyone**.

---

## Target audience

- Idade-alvo: **18 ou mais** (uso profissional).
- Designed for kids: **No**.

---

## Ads

- Contains ads: **No**.

---

## Data safety — declaração

| Tipo de dado | Coletado | Compartilhado | Obrigatório | Finalidade |
|---|---|---|---|---|
| Endereço de e-mail | Sim | Não | Sim | Conta, comunicação |
| Nome | Sim | Não | Sim | Identificação do profissional |
| Número de telefone | Sim | Não | Sim | Contato e recepção |
| CPF (hash SHA-256) | Sim | Não | Sim | Identificação fiscal |
| CRM | Sim | Não | Sim | Verificação profissional |
| Foto de perfil | Sim | Não | Não | Personalização |
| Informações de saúde (de pacientes) | Sim | Não | Sim | Funcionalidade core do app |
| Outras informações financeiras | Sim | Não | Não | Faturas e pacotes |
| Fotos (câmera) | Não persistido | Não | Não | QR scanner |
| Eventos do calendário | Sim (leitura/escrita) | Não | Não | Sincronia de reservas |

Práticas de segurança:
- ✅ Dados criptografados em trânsito (HTTPS/TLS)
- ✅ Dados criptografados em repouso (Supabase + Expo SecureStore)
- ✅ Usuário pode solicitar exclusão dos dados (in-app, conforme LGPD Art. 18)
- ✅ Sigo as Play Families Policy: **N/A** (app não é para crianças)

---

## Checklist pré-submit

- [ ] Conta Play Developer aprovada.
- [ ] App criado, package `com.oli.healthhub` registrado.
- [ ] Política de privacidade acessível (já ✅).
- [ ] Conta revisor demo criada no Supabase.
- [ ] Ícone 512×512 PNG.
- [ ] Feature graphic 1024×500 PNG/JPG (sem transparência).
- [ ] 2-8 screenshots (16:9 ou 9:16, lado mínimo 320px).
- [ ] Service account JSON salvo como `./google-services.json`.
- [ ] AAB produção buildado via `eas build -p android --profile production`.
- [ ] `eas submit -p android --latest` com track `internal`.
