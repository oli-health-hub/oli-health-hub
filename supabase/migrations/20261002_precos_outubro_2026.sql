-- Preços de outubro/2026 (fundador, 02/10). Aplicada no Supabase como
-- `precos_outubro_2026`. Não toca profiles.taxa_min_congelada (assinantes
-- anteriores à reforma de ago/2026 seguem na taxa congelada).
update plans set taxa_min = 1.29, updated_at = now() where name = 'START';
update plans set taxa_min = 0.79, preco_mensal = 299.00, preco_semestral = 199.00, updated_at = now() where name = 'PRO';
