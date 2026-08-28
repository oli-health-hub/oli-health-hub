-- Motivo de descarte novo: engano de número.
--
-- O número da Cloud API tem histórico de dono anterior e recebe contato de
-- engano com frequência (ver docs/HANDOFF.md). A IA passa a marcar esses
-- casos sozinha, e eles precisam de um motivo próprio: 'sem_perfil' e
-- 'contato_invalido' misturariam engano com lead de verdade que não fechou,
-- estragando a leitura do funil.
alter table leads drop constraint if exists leads_motivo_descarte_valido;
alter table leads add constraint leads_motivo_descarte_valido
  check (
    motivo_descarte is null
    or motivo_descarte = any (array[
      'mora_longe', 'achou_caro', 'sem_perfil', 'contato_invalido',
      'sumiu', 'sem_interesse', 'engano_numero'
    ])
  );
