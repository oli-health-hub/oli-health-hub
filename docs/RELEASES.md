# Versões e publicações do app

Fonte rápida para saber o que está no ar. Detalhes de cada sessão ficam em `docs/HANDOFF.md`.

## Como ler as versões
- **`version` = `1.0.0`** não muda entre OTAs. Só sobe quando houver mudança nativa (permissão, biblioteca nativa, upgrade do Expo); aí sobe também o build da loja.
- **`runtimeVersion`** usa a política `appVersion` (`app.json`): hoje **1.0.0**. Todo OTA vale para quem tem um build 1.0.0 instalado.
- **`buildNumber` (iOS) e `versionCode` (Android)** sobem só em build de loja.
- **OTA** não tem número: identifique pelo *update group*, data e mensagem. Padrão da mensagem: `OTA AAAA-MM-DD: resumo`.
- O app baixa o OTA na abertura e aplica na **abertura seguinte** (`ON_LOAD`, `fallbackToCacheTimeout: 0`).
- Outros deploys são separados do EAS: `admin/` (Vercel) e Edge Functions (Supabase).

## Builds de loja (EAS, canal `production`)
| Data | Versão | Build | Plataformas | Commit |
|---|---|---|---|---|
| 05/10/2026 | 1.0.0 | 3 | iOS e Android | `d8ca029` |
| 23 e 24/06/2026 | 1.0.0 | 2 | iOS e Android | `8a88b9f` (iOS), `277ec4d` (Android) |
| 22 e 23/06/2026 | 1.0.0 | 1 | iOS e Android | `277ec4d` |

O binário de 23/06 (builds 1 e 2) engole erros ao gravar a reserva (§76.8 do handoff). Quem não atualizou para o build 3 não tem esse conserto.

## OTAs recentes (runtime 1.0.0, Android e iOS)
| Data | Canal | Update group | Mensagem | Commits |
|---|---|---|---|---|
| 09/11/2026 | production | `a33ffaa4-725c-4cbf-9297-a01b8916d488` | OTA 2026-11-09: timer inicia ao voltar do background (recarrega reservas) | `30aa520` |
| 09/11/2026 | preview | `7e7ec415-e929-4e15-9579-35a588ad61cc` | idem | `30aa520` |
| ~20/10/2026 | production | `38c05a59-640e-4d51-981c-6a316f34fc89` | CPF obrigatório e sem boleto no checkout; saldo de horas soma todos os pacotes | `f585b0e`, `995431a` (inferido pela mensagem) |
| ~15/10/2026 | production | `8ccfab16…` | fix(teclado): campos de digitação não ficam mais escondidos | `8959ac4` (inferido) |
| ~15/10/2026 | production | `a4732b4c…` | fix(financeiro): preço/h do seletor de pacotes usa taxa do plano | `fb8372f` (inferido) |

Os updates antigos não gravaram o hash do commit; a coluna "Commits" deles é inferência pela mensagem e pela data.

## Em produção hoje
- **App:** build 3 da loja (05/10) + OTA de 09/11 (production).
- **Não vale para:** aparelhos com os builds 1 ou 2.

## Como publicar
```bash
eas update --branch preview --message "OTA AAAA-MM-DD: resumo" --non-interactive
eas update --branch production --message "OTA AAAA-MM-DD: resumo" --non-interactive
```
Antes: árvore commitada (o EAS marca o commit com `*` se estiver suja) e `npx tsc --noEmit` limpo. Depois: conferir com `eas update:list --branch production --limit 3`.

## Pendências de versão
- Reservas vencidas sem checkout continuam sem desconto de saldo (handoff §81.4).
- Decidir se o checkout ganha fechamento automático no servidor.
