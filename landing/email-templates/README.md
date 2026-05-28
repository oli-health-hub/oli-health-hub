# OLI Health Hub — Email Templates

Templates de email com branding OLI para configurar no Supabase.

## Como aplicar no Supabase

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) → projeto OLI
2. **Authentication → Email Templates**
3. Para cada template, selecione o tipo e cole o HTML do arquivo correspondente

| Arquivo                 | Tipo no Supabase        | Subject sugerido                          |
|-------------------------|-------------------------|-------------------------------------------|
| `confirm-signup.html`   | **Confirm signup**      | `Confirme seu e-mail — OLI Health Hub`    |
| `reset-password.html`   | **Reset password**      | `Redefina sua senha — OLI Health Hub`     |
| `magic-link.html`       | **Magic link**          | `Seu link de acesso — OLI Health Hub`     |
| `invite-admin.html`     | **Invite user**         | `Convite de acesso — OLI Health Hub`      |

## Variáveis do Supabase

Estas variáveis são substituídas automaticamente pelo Supabase na hora do envio:

| Variável              | Valor                            |
|-----------------------|----------------------------------|
| `{{ .ConfirmationURL }}`| URL da ação (confirmar/resetar) |
| `{{ .Email }}`        | E-mail do destinatário           |
| `{{ .SiteURL }}`      | URL base do projeto              |

## Design system usado

| Token          | Valor     | Uso                          |
|----------------|-----------|------------------------------|
| `oliGreen`     | `#5F7D67` | Cor primária, ações positivas|
| `oliGold`      | `#B8893C` | Ações neutras, avisos        |
| `oliRed`       | `#D9534F` | Ações destrutivas            |
| `oliDark`      | `#2F2F2F` | Ações admin, convites        |
| `oliBackground`| `#F4EFEA` | Fundo dos emails             |

A cor da barra no topo do card indica o tipo de ação:
- 🟢 Verde → confirmação, autorização (use `confirm-signup`, `magic-link`)
- 🟡 Dourado → recuperação, aviso
- ⚫ Escuro → ações admin (use `invite-admin`)

## Template para páginas web

Para criar novas páginas de confirmação (como `consentimento.html`), use como base:

```
landing/_template-pagina-confirmacao.html
```

Substituir os placeholders `[MAIUSCULO]` e configurar a Edge Function.
