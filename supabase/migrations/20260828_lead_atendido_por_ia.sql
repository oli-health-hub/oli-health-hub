-- Marca o lead como atendido pela Olivia (IA), pra ela funcionar como um
-- atendente a mais no filtro de /leads — eixo independente de `atendente_id`
-- (que só aceita profiles com acesso ao painel, ver comentário em
-- admin/app/leads/page.tsx). Sem FK: não faz sentido criar um profile/conta
-- de verdade só pra representar a IA.
alter table leads add column if not exists atendido_por_ia boolean not null default false;
