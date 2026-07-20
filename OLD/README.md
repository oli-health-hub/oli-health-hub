# OLD — Material arquivado

Arquivos que **não fazem parte** da estrutura definida em `docs/OLI_BASE.md` (documento-âncora do projeto). Mantidos aqui para referência histórica; **não usar em produção**.

> Reorganização feita em 17/06/2026, alinhando o repositório aos 3 produtos do OLI_BASE: app (React Native + Expo, na raiz), painel admin (`admin/`, Next.js) e site institucional (`landing/`, HTML estático).

## Conteúdo

| Pasta | O que é | Por que foi arquivado |
|---|---|---|
| `swift-xcode-legacy/` | Projeto nativo iOS em Swift (`OLIHealthHub/`, `*.xcodeproj`, testes Swift) | Legado de antes da migração para React Native + Expo. O app atual é gerenciado pelo Expo (config em `app.json`/`eas.json`); este projeto não é mais usado em build/deploy. |
| `caveman/` | Ferramenta open-source de terceiros (`JuliusBrussee/caveman`) | Repositório git aninhado, sem relação com o produto OLI. Já era ignorado pelo git. |
| `mockups/` | `admin-mockup.html`, `totem-qr.html` | Mockups HTML soltos na raiz, substituídos pelo admin Next.js (`admin/`) e pela rota de totem (`admin/app/totem`). Não referenciados por nenhum deploy. |
| `notas-sessao/` | `SESSAO_2026-05-26.md` | Nota de sessão de trabalho pontual; estado operacional vivo fica em `docs/HANDOFF.md`. |

## Como restaurar
Itens versionados (Swift, mockups, nota) preservam histórico no git — use `git mv` para trazer de volta. O `caveman/` é um repositório externo independente.
