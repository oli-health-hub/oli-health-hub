-- Templates verificados como ativos na Meta em 28/ago/2026.
-- O status interno é o gate da régua: sem 'aprovado', a Edge Function não
-- envia nenhum contato, mesmo que o template já esteja ativo no Meta.
update whatsapp_templates
set status_aprovacao = 'aprovado'
where trigger_type in ('primeiro_contato', 'd3', 'd10', 'd24', 'd45')
  and meta_template_name in (
    'primeiro_contato_comercial_v1',
    'nutricao_comercial_d3_v1',
    'nutricao_comercial_d10_v1',
    'nutricao_comercial_d24_v1',
    'nutricao_comercial_d45_v1'
  );
